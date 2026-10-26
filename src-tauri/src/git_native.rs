use std::{
    collections::HashSet,
    fs::{self, File},
    io::{BufRead, BufReader, Read},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

const PAGE_SIZE_MAX: usize = 500;
const MAX_CAPTURE_BYTES: usize = 256 * 1024;
const MAX_GIT_PATH_BYTES: usize = 16 * 1024;
const MAX_GITIGNORE_BYTES: u64 = 1024 * 1024;
const MAX_CACHED_PROJECT_PATHS: usize = 2000;
const MAX_CONCURRENT_GIT_OPERATIONS: usize = 1;
const PROCESS_TIMEOUT: Duration = Duration::from_secs(15 * 60);
const LARGE_FILE_WARNING: u64 = 50 * 1024 * 1024;
const LARGE_FILE_BLOCK: u64 = 100 * 1024 * 1024;
const MAX_PREVIEW_BYTES: u64 = 512 * 1024;

pub struct GitOperations {
    cancellations: Arc<Mutex<std::collections::HashMap<String, Arc<AtomicBool>>>>,
    project_scan_cache: Arc<Mutex<Option<CachedProjectScan>>>,
}

impl Default for GitOperations {
    fn default() -> Self {
        Self {
            cancellations: Arc::new(Mutex::new(std::collections::HashMap::new())),
            project_scan_cache: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(Clone)]
struct CachedProjectScan {
    root: PathBuf,
    analysis: ProjectAnalysis,
    files: Vec<String>,
    scanned_at: Instant,
}

fn cached_scan_page(
    cached: CachedProjectScan,
    offset: usize,
    page_limit: usize,
) -> ProjectScan {
    let files = cached
        .files
        .iter()
        .skip(offset)
        .take(page_limit)
        .cloned()
        .collect::<Vec<_>>();
    let end = offset.saturating_add(files.len());
    let has_more = end < MAX_CACHED_PROJECT_PATHS && (end as u64) < cached.analysis.file_count;
    ProjectScan {
        analysis: cached.analysis,
        has_more,
        files,
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectScan {
    pub analysis: ProjectAnalysis,
    pub files: Vec<String>,
    pub has_more: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAnalysis {
    #[serde(rename = "type")]
    pub project_type: String,
    pub suggested_gitignore: String,
    pub has_existing_git: bool,
    pub sensitive_files: Vec<String>,
    pub file_count: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusPage {
    pub branch: String,
    pub remote_url: Option<String>,
    pub changed_files: u64,
    pub conflict_files: Vec<String>,
    pub recent_commits: Vec<RecentCommit>,
    pub files: Vec<FileStatus>,
    pub offset: usize,
    pub has_more: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStatus {
    pub path: String,
    pub status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentCommit {
    pub oid: String,
    pub message: String,
    pub timestamp: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitPreparation {
    pub excluded_large_files: Vec<String>,
    pub warning_large_files: Vec<String>,
    pub excluded_sensitive_files: Vec<String>,
    pub excluded_generated_folders: Vec<String>,
}

#[derive(Clone, Serialize)]
struct ProgressEvent {
    operation_id: String,
    phase: String,
    loaded: Option<u64>,
    total: Option<u64>,
}

struct ProcessResult {
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

fn validate_dir(dir: &str) -> Result<PathBuf, String> {
    let path = fs::canonicalize(dir)
        .map_err(|error| format!("Impossible de vérifier le dossier du projet : {error}"))?;
    if !path.is_dir() {
        return Err("Le chemin du projet n’est pas un dossier.".to_string());
    }
    Ok(path)
}

fn validate_github_remote(raw: &str) -> Result<String, String> {
    let parsed = url::Url::parse(raw.trim())
        .map_err(|_| "L’URL du dépôt GitHub est invalide.".to_string())?;
    let path = parsed.path().trim_matches('/');
    let parts: Vec<&str> = path.split('/').collect();
    if parsed.scheme() != "https"
        || parsed.host_str() != Some("github.com")
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
        || parts.len() != 2
        || parts[0].is_empty()
        || parts[1].trim_end_matches(".git").is_empty()
    {
        return Err(
            "Utilisez une URL HTTPS GitHub valide, sans identifiants intégrés.".to_string(),
        );
    }
    Ok(parsed.to_string().trim_end_matches('/').to_string())
}

fn configured_github_remote(root: &Path) -> Result<Option<String>, String> {
    match run_simple(root, &["config", "--get", "remote.origin.url"]) {
        Ok(value) => {
            let raw = String::from_utf8_lossy(&value);
            validate_github_remote(raw.trim()).map(Some)
        }
        Err(error) if error.starts_with("GIT_NATIVE_ERROR:1:") => Ok(None),
        Err(error) => Err(error),
    }
}

fn operation_flag(
    operations: &Mutex<std::collections::HashMap<String, Arc<AtomicBool>>>,
    operation_id: &str,
) -> Result<Arc<AtomicBool>, String> {
    if operation_id.is_empty() || operation_id.len() > 128 {
        return Err("Identifiant d’opération invalide.".to_string());
    }
    let flag = Arc::new(AtomicBool::new(false));
    let mut active = operations
        .lock()
        .map_err(|_| "Impossible de gérer l’opération Git.".to_string())?;
    if active.len() >= MAX_CONCURRENT_GIT_OPERATIONS {
        return Err("GIT_OPERATION_BUSY".to_string());
    }
    active.insert(operation_id.to_string(), flag.clone());
    Ok(flag)
}

fn remove_operation(
    operations: &Mutex<std::collections::HashMap<String, Arc<AtomicBool>>>,
    operation_id: &str,
) {
    if let Ok(mut active) = operations.lock() {
        active.remove(operation_id);
    }
}

fn emit_progress(
    app: &AppHandle,
    operation_id: &str,
    phase: &str,
    loaded: Option<u64>,
    total: Option<u64>,
) {
    let _ = app.emit(
        "git-operation-progress",
        ProgressEvent {
            operation_id: operation_id.to_string(),
            phase: phase.to_string(),
            loaded,
            total,
        },
    );
}

fn command_for(dir: &Path, args: &[String], token: Option<&str>) -> Command {
    let mut command = Command::new("git");
    command
        .arg("-C")
        .arg(dir)
        .args(args)
        .stdin(Stdio::null());
    command.env("GIT_TERMINAL_PROMPT", "0");
    let mut config = vec![
        ("pack.threads", "1".to_string()),
        ("pack.windowMemory", "64m".to_string()),
        ("pack.window", "10".to_string()),
        ("core.bigFileThreshold", "50m".to_string()),
    ];
    if let Some(token) = token.filter(|value| !value.trim().is_empty()) {
        let credential = format!(
            "AUTHORIZATION: basic {}",
            base64_basic(&format!("x-access-token:{}", token.trim()))
        );
        config.push(("http.https://github.com/.extraheader", credential));
    }
    command.env("GIT_CONFIG_COUNT", config.len().to_string());
    for (index, (key, value)) in config.into_iter().enumerate() {
        command
            .env(format!("GIT_CONFIG_KEY_{index}"), key)
            .env(format!("GIT_CONFIG_VALUE_{index}"), value);
    }
    command
}

fn base64_basic(value: &str) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes = value.as_bytes();
    let mut encoded = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let a = chunk[0] as usize;
        let b = chunk.get(1).copied().unwrap_or(0) as usize;
        let c = chunk.get(2).copied().unwrap_or(0) as usize;
        encoded.push(TABLE[a >> 2] as char);
        encoded.push(TABLE[((a & 3) << 4) | (b >> 4)] as char);
        encoded.push(if chunk.len() > 1 {
            TABLE[((b & 15) << 2) | (c >> 6)] as char
        } else {
            '='
        });
        encoded.push(if chunk.len() > 2 {
            TABLE[c & 63] as char
        } else {
            '='
        });
    }
    encoded
}

fn run_git(
    app: &AppHandle,
    operation_id: &str,
    dir: &Path,
    args: &[String],
    token: Option<&str>,
    cancel: &AtomicBool,
    timeout: Duration,
) -> Result<ProcessResult, String> {
    if cancel.load(Ordering::Relaxed) {
        return Err("GIT_OPERATION_CANCELLED".to_string());
    }

    let mut command = command_for(dir, args, token);
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                format!("GIT_NOT_INSTALLED: {error}")
            } else {
                format!("Impossible de démarrer Git : {error}")
            }
        })?;
    let stdout = child.stdout.take().ok_or("Sortie Git indisponible.")?;
    let stderr = child.stderr.take().ok_or("Sortie Git indisponible.")?;
    let (sender, receiver) = std::sync::mpsc::sync_channel::<(bool, Vec<u8>)>(8);

    let stdout_sender = sender.clone();
    let stdout_thread = thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut buffer = [0u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(read) => {
                    if stdout_sender.send((true, buffer[..read].to_vec())).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });
    let stderr_thread = thread::spawn(move || {
        let mut reader = BufReader::new(stderr);
        let mut buffer = [0u8; 4096];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(read) => {
                    if sender.send((false, buffer[..read].to_vec())).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    let started = Instant::now();
    let mut result = ProcessResult {
        stdout: Vec::new(),
        stderr: Vec::new(),
    };
    let mut exit_status = None;
    let mut output_closed = false;
    let mut last_progress_event = Instant::now() - Duration::from_secs(1);
    loop {
        if !output_closed {
            match receiver.recv_timeout(Duration::from_millis(30)) {
                Ok((is_stdout, bytes)) => {
                    let destination = if is_stdout {
                        &mut result.stdout
                    } else {
                        &mut result.stderr
                    };
                    let room = MAX_CAPTURE_BYTES.saturating_sub(destination.len());
                    destination.extend_from_slice(&bytes[..bytes.len().min(room)]);
                    if !is_stdout && last_progress_event.elapsed() >= Duration::from_millis(100) {
                        let text = String::from_utf8_lossy(&bytes);
                        if let Some(line) = text.lines().find(|line| !line.trim().is_empty()) {
                            emit_progress(app, operation_id, line, None, None);
                            last_progress_event = Instant::now();
                        }
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => output_closed = true,
            }
        }

        if cancel.load(Ordering::Relaxed) {
            let _ = child.kill();
            let _ = child.wait();
            drop(receiver);
            let _ = stdout_thread.join();
            let _ = stderr_thread.join();
            return Err("GIT_OPERATION_CANCELLED".to_string());
        }
        if started.elapsed() > timeout {
            let _ = child.kill();
            let _ = child.wait();
            drop(receiver);
            let _ = stdout_thread.join();
            let _ = stderr_thread.join();
            return Err("GIT_OPERATION_TIMEOUT".to_string());
        }
        if exit_status.is_none() {
            match child.try_wait() {
                Ok(status) => exit_status = status,
                Err(error) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    drop(receiver);
                    let _ = stdout_thread.join();
                    let _ = stderr_thread.join();
                    return Err(format!("Impossible de suivre le processus Git : {error}"));
                }
            }
        }
        if output_closed && exit_status.is_some() {
            break;
        }
    }

    let _ = stdout_thread.join();
    let _ = stderr_thread.join();
    if cancel.load(Ordering::Relaxed) {
        return Err("GIT_OPERATION_CANCELLED".to_string());
    }
    let status = exit_status
        .ok_or_else(|| "Le processus Git s’est arrêté sans résultat.".to_string())?;
    if !status.success() {
        let detail = String::from_utf8_lossy(&result.stderr);
        return Err(format!(
            "GIT_NATIVE_ERROR:{}:{}",
            status.code().unwrap_or(-1),
            detail.trim()
        ));
    }
    Ok(result)
}

fn run_simple(dir: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
    let mut child = Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                format!("GIT_NOT_INSTALLED: {error}")
            } else {
                format!("Impossible de démarrer Git : {error}")
            }
        })?;
    let stdout = child.stdout.take().ok_or("Sortie standard Git indisponible.")?;
    let stderr = child.stderr.take().ok_or("Sortie d’erreur Git indisponible.")?;
    let stdout_capture = Arc::new(Mutex::new(Vec::new()));
    let stderr_capture = Arc::new(Mutex::new(Vec::new()));
    let stdout_thread = capture_process_output(stdout, stdout_capture.clone());
    let stderr_thread = capture_process_output(stderr, stderr_capture.clone());
    let started = Instant::now();
    let status = loop {
        if started.elapsed() > PROCESS_TIMEOUT {
            let _ = child.kill();
            let _ = child.wait();
            let _ = stdout_thread.join();
            let _ = stderr_thread.join();
            return Err("GIT_OPERATION_TIMEOUT".to_string());
        }
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => thread::sleep(Duration::from_millis(25)),
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = stdout_thread.join();
                let _ = stderr_thread.join();
                return Err(format!("Impossible de suivre le processus Git : {error}"));
            }
        }
    };
    stdout_thread
        .join()
        .map_err(|_| "Impossible de récupérer la sortie Git.".to_string())?
        .map_err(|error| format!("Impossible de lire la sortie Git : {error}"))?;
    stderr_thread
        .join()
        .map_err(|_| "Impossible de récupérer l’erreur Git.".to_string())?
        .map_err(|error| format!("Impossible de lire l’erreur Git : {error}"))?;
    let stdout = stdout_capture
        .lock()
        .map_err(|_| "Impossible de récupérer la sortie Git.".to_string())?
        .clone();
    let stderr = stderr_capture
        .lock()
        .map_err(|_| "Impossible de récupérer l’erreur Git.".to_string())?
        .clone();
    if !status.success() {
        return Err(format!(
            "GIT_NATIVE_ERROR:{}:{}",
            status.code().unwrap_or(-1),
            String::from_utf8_lossy(&stderr).trim()
        ));
    }
    Ok(stdout)
}

fn capture_process_output<R: Read + Send + 'static>(
    mut reader: R,
    captured: Arc<Mutex<Vec<u8>>>,
) -> thread::JoinHandle<std::io::Result<()>> {
    thread::spawn(move || {
        let mut buffer = [0u8; 8192];
        loop {
            let read = reader.read(&mut buffer)?;
            if read == 0 {
                return Ok(());
            }
            let mut output = captured.lock().map_err(|_| {
                std::io::Error::other("Le tampon de sortie Git est indisponible.")
            })?;
            let room = MAX_CAPTURE_BYTES.saturating_sub(output.len());
            output.extend_from_slice(&buffer[..read.min(room)]);
        }
    })
}

fn run_with_operation<T: Send + 'static>(
    app: AppHandle,
    operations: Arc<Mutex<std::collections::HashMap<String, Arc<AtomicBool>>>>,
    operation_id: String,
    work: impl FnOnce(AppHandle, String, Arc<AtomicBool>) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    let cancel = operation_flag(&operations, &operation_id)?;
    let result = work(app, operation_id.clone(), cancel);
    remove_operation(&operations, &operation_id);
    result
}

async fn run_with_operation_async<T: Send + 'static>(
    app: AppHandle,
    operations: Arc<Mutex<std::collections::HashMap<String, Arc<AtomicBool>>>>,
    operation_id: String,
    work: impl FnOnce(AppHandle, String, Arc<AtomicBool>) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || {
        run_with_operation(app, operations, operation_id, work)
    })
    .await
    .map_err(|error| format!("L’opération Git a échoué : {error}"))?
}

fn lower_basename(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase()
}

fn sensitive_path(path: &Path) -> bool {
    let name = lower_basename(path);
    if [".env.example", ".env.sample", ".env.template"]
        .iter()
        .any(|allowed| name == *allowed)
    {
        return false;
    }
    if path.components().any(|component| {
        let value = component.as_os_str().to_string_lossy().to_lowercase();
        value == ".ssh" || value == ".aws"
    }) {
        return true;
    }
    name == ".env"
        || name.starts_with(".env.")
        || [".npmrc", ".pypirc", ".netrc"].contains(&name.as_str())
        || name.contains("secret")
        || name.contains("credential")
        || [".pem", ".key", ".p12", ".pfx", ".keystore", ".jks", ".cer", ".crt"]
            .iter()
            .any(|extension| name.ends_with(extension))
        || name.starts_with("id_rsa")
        || name.starts_with("id_ed25519")
        || name.starts_with("id_ecdsa")
        || name.contains("access_token")
        || name.contains("private_key")
}

fn generated_directory(name: &str) -> bool {
    matches!(
        name,
        ".git"
            | ".godot"
            | "node_modules"
            | "dist"
            | "target"
            | ".venv"
            | "venv"
            | "vendor"
            | "build"
            | ".next"
            | ".cache"
            | "coverage"
            | ".tox"
            | ".mypy_cache"
            | ".ruff_cache"
            | ".pytest_cache"
            | ".idea"
            | ".vscode"
    )
}

fn sensitive_rules() -> Vec<String> {
    vec![
        ".env".to_string(),
        ".env.*".to_string(),
        "!.env.example".to_string(),
        "!.env.sample".to_string(),
        "**/.ssh/".to_string(),
        "**/.aws/".to_string(),
        "**/*.pem".to_string(),
        "**/*.key".to_string(),
        "**/*secret*".to_string(),
        "**/*credential*".to_string(),
    ]
}

fn default_ignore_rules() -> Vec<String> {
    [
        ".git/",
        "node_modules/",
        "dist/",
        "target/",
        "vendor/",
        "build/",
        ".godot/",
        ".next/",
        ".cache/",
        "coverage/",
        ".venv/",
        "venv/",
        ".tox/",
        ".mypy_cache/",
        ".ruff_cache/",
        ".pytest_cache/",
        ".idea/",
        ".vscode/",
        ".DS_Store",
        "*.log",
    ]
    .iter()
    .map(|rule| rule.to_string())
    .chain(sensitive_rules())
    .collect()
}

fn generated_folder_names(path: &Path, names: &mut HashSet<String>) {
    for component in path.components() {
        let name = component.as_os_str().to_string_lossy().to_string();
        if generated_directory(&name) && names.len() < PAGE_SIZE_MAX {
            names.insert(name);
        }
    }
}

fn append_ignore_rules(dir: &Path, rules: &[String]) -> Result<(), String> {
    let path = dir.join(".gitignore");
    let mut existing = match File::open(&path) {
        Ok(file) => {
            let metadata = file
                .metadata()
                .map_err(|error| format!("Impossible de vérifier .gitignore : {error}"))?;
            if metadata.len() > MAX_GITIGNORE_BYTES {
                return Err(".gitignore dépasse la taille maximale de 1 Mio.".to_string());
            }
            let mut bytes = Vec::with_capacity(metadata.len() as usize);
            file.take(MAX_GITIGNORE_BYTES + 1)
                .read_to_end(&mut bytes)
                .map_err(|error| format!("Impossible de lire .gitignore : {error}"))?;
            if bytes.len() as u64 > MAX_GITIGNORE_BYTES {
                return Err(".gitignore dépasse la taille maximale de 1 Mio.".to_string());
            }
            String::from_utf8(bytes)
                .map_err(|error| format!(".gitignore n’est pas encodé en UTF-8 : {error}"))?
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(error) => return Err(format!("Impossible de lire .gitignore : {error}")),
    };
    let mut known: HashSet<String> = existing.lines().map(str::to_string).collect();
    let additions: Vec<&String> = rules.iter().filter(|rule| known.insert((*rule).clone())).collect();
    if additions.is_empty() {
        return Ok(());
    }
    if !existing.is_empty() && !existing.ends_with('\n') {
        existing.push('\n');
    }
    existing.push_str("\n# Gsimplifie: protections automatiques\n");
    for rule in additions {
        existing.push_str(rule);
        existing.push('\n');
    }
    fs::write(path, existing)
        .map_err(|error| format!("Impossible de mettre à jour .gitignore : {error}"))
}

fn detect_project_type(root_files: &HashSet<String>) -> (String, String) {
    if root_files.contains("package.json") {
        ("node".to_string(), "node_modules/\ndist/\n.env\n*.log".to_string())
    } else if root_files.contains("requirements.txt") || root_files.contains("pyproject.toml") {
        ("python".to_string(), "__pycache__/\n*.pyc\n.venv/\n.env".to_string())
    } else if root_files.contains("pom.xml") {
        ("java-maven".to_string(), "target/\n*.class".to_string())
    } else if root_files.contains("build.gradle") || root_files.contains("build.gradle.kts") {
        ("java-gradle".to_string(), "build/\n.gradle/".to_string())
    } else if root_files.contains("Cargo.toml") {
        ("rust".to_string(), "target/\nCargo.lock".to_string())
    } else if root_files.contains("index.html") {
        ("static".to_string(), String::new())
    } else {
        ("inconnu".to_string(), String::new())
    }
}

struct DirectoryFrame {
    relative: PathBuf,
    entries: fs::ReadDir,
}

#[tauri::command]
pub async fn git_scan_project(
    app: AppHandle,
    operations: State<'_, GitOperations>,
    dir: String,
    offset: usize,
    limit: usize,
    operation_id: String,
) -> Result<ProjectScan, String> {
    let cache = operations.project_scan_cache.clone();
    run_with_operation_async(app, operations.cancellations.clone(), operation_id, move |app, id, cancel| {
        let root = validate_dir(&dir)?;
        let page_limit = limit.clamp(1, PAGE_SIZE_MAX);
        emit_progress(&app, &id, "scan-project", Some(0), None);
        if offset > 0 {
            let cached = cache
                .lock()
                .map_err(|_| "Impossible de consulter le cache d’analyse.".to_string())?
                .clone();
            if let Some(cached) = cached.filter(|cached| {
                cached.root == root && cached.scanned_at.elapsed() < Duration::from_secs(30)
            }) {
                return Ok(cached_scan_page(cached, offset, page_limit));
            }
        }
        let root_entries = fs::read_dir(&root)
            .map_err(|error| format!("Impossible de parcourir le dossier du projet : {error}"))?;
        let mut stack = vec![DirectoryFrame {
            relative: PathBuf::new(),
            entries: root_entries,
        }];
        let mut cached_files = Vec::with_capacity(MAX_CACHED_PROJECT_PATHS);
        let mut sensitive_files = Vec::new();
        let mut root_files = HashSet::new();
        let mut file_count = 0u64;
        let scan_started = Instant::now();
        let has_existing_git = root.join(".git").exists();

        while let Some(frame) = stack.last_mut() {
            if cancel.load(Ordering::Relaxed) {
                return Err("GIT_OPERATION_CANCELLED".to_string());
            }
            if scan_started.elapsed() > PROCESS_TIMEOUT {
                return Err("GIT_OPERATION_TIMEOUT".to_string());
            }
            let entry = match frame.entries.next() {
                Some(entry) => entry.map_err(|error| format!("Impossible de lire une entrée du projet : {error}"))?,
                None => {
                    stack.pop();
                    continue;
                }
            };
            let file_type = entry.file_type().map_err(|error| format!("Impossible de lire les métadonnées du projet : {error}"))?;
            let name = entry.file_name();
            let name_string = name.to_string_lossy().to_string();
            let relative = frame.relative.join(&name);
            if file_type.is_symlink() {
                continue;
            }
            if file_type.is_dir() {
                if generated_directory(&name_string) {
                    continue;
                }
                let child_path = entry.path();
                let entries = fs::read_dir(&child_path)
                    .map_err(|error| format!("Impossible de parcourir un sous-dossier : {error}"))?;
                stack.push(DirectoryFrame { relative, entries });
                continue;
            }
            if !file_type.is_file() {
                continue;
            }
            file_count += 1;
            if relative.parent().is_some_and(|parent| parent.as_os_str().is_empty())
                && matches!(
                    name_string.as_str(),
                    "package.json"
                        | "requirements.txt"
                        | "pyproject.toml"
                        | "pom.xml"
                        | "build.gradle"
                        | "build.gradle.kts"
                        | "Cargo.toml"
                        | "index.html"
                )
            {
                root_files.insert(name_string);
            }
            let relative_string = relative.to_string_lossy().replace('\\', "/");
            if sensitive_path(&relative) && sensitive_files.len() < PAGE_SIZE_MAX {
                sensitive_files.push(relative_string.clone());
            }
            if cached_files.len() < MAX_CACHED_PROJECT_PATHS {
                cached_files.push(relative_string);
            }
            if file_count % 256 == 0 {
                emit_progress(&app, &id, "scan-project", Some(file_count), None);
            }
        }
        let (project_type, suggested_gitignore) = detect_project_type(&root_files);
        let project_analysis = ProjectAnalysis {
            project_type,
            suggested_gitignore,
            has_existing_git,
            sensitive_files,
            file_count,
        };
        eprintln!(
            "project-scan files={} elapsed_ms={}",
            file_count,
            scan_started.elapsed().as_millis()
        );
        let cached = CachedProjectScan {
            root,
            analysis: project_analysis,
            files: cached_files,
            scanned_at: Instant::now(),
        };
        *cache
            .lock()
            .map_err(|_| "Impossible de mettre à jour le cache d’analyse.".to_string())? =
            Some(cached.clone());
        emit_progress(&app, &id, "scan-project", Some(file_count), Some(file_count));
        Ok(cached_scan_page(cached, offset, page_limit))
    })
    .await
}

#[tauri::command]
pub async fn git_detect_project(dir: String) -> Result<ProjectAnalysis, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let started = Instant::now();
        let root = validate_dir(&dir)?;
        let mut root_files = HashSet::new();
        for name in [
            "package.json",
            "requirements.txt",
            "pyproject.toml",
            "pom.xml",
            "build.gradle",
            "build.gradle.kts",
            "Cargo.toml",
            "index.html",
        ] {
            if root.join(name).is_file() {
                root_files.insert(name.to_string());
            }
        }
        let (project_type, suggested_gitignore) = detect_project_type(&root_files);
        eprintln!("project-detect elapsed_ms={}", started.elapsed().as_millis());
        Ok(ProjectAnalysis {
            project_type,
            suggested_gitignore,
            has_existing_git: root.join(".git").exists(),
            sensitive_files: Vec::new(),
            file_count: 0,
        })
    })
    .await
    .map_err(|error| format!("La détection rapide du projet a échoué : {error}"))?
}

#[tauri::command]
pub async fn git_read_file_preview(dir: String, filepath: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = validate_dir(&dir)?;
        let relative = Path::new(&filepath);
        if relative.is_absolute()
            || relative.components().any(|component| {
                matches!(
                    component,
                    std::path::Component::ParentDir | std::path::Component::RootDir
                )
            })
        {
            return Err("Chemin de fichier invalide.".to_string());
        }
        let path = fs::canonicalize(root.join(relative))
            .map_err(|error| format!("Impossible d’ouvrir ce fichier : {error}"))?;
        if !path.starts_with(&root) {
            return Err("Le fichier sélectionné sort du dossier du projet.".to_string());
        }
        let metadata = fs::metadata(&path)
            .map_err(|error| format!("Impossible de vérifier le fichier : {error}"))?;
        if !metadata.is_file() {
            return Err("L’aperçu est disponible uniquement pour les fichiers.".to_string());
        }
        if metadata.len() > MAX_PREVIEW_BYTES {
            return Err("GIT_PREVIEW_TOO_LARGE".to_string());
        }
        let mut bytes = Vec::with_capacity(metadata.len() as usize);
        File::open(path)
            .and_then(|file| file.take(MAX_PREVIEW_BYTES + 1).read_to_end(&mut bytes))
            .map_err(|error| format!("Impossible de lire l’aperçu du fichier : {error}"))?;
        if bytes.len() as u64 > MAX_PREVIEW_BYTES {
            return Err("GIT_PREVIEW_TOO_LARGE".to_string());
        }
        if bytes.contains(&0) {
            return Err("GIT_PREVIEW_BINARY".to_string());
        }
        String::from_utf8(bytes).map_err(|_| "GIT_PREVIEW_INVALID_UTF8".to_string())
    })
    .await
    .map_err(|error| format!("La lecture de l’aperçu a échoué : {error}"))?
}

fn parse_status_record(record: &[u8]) -> Option<FileStatus> {
    if record.len() < 4 {
        return None;
    }
    let status = String::from_utf8_lossy(&record[..2]).trim().to_string();
    let path = String::from_utf8_lossy(&record[3..]).to_string();
    Some(FileStatus { path, status })
}

fn stream_nul_output(
    root: &Path,
    args: &[&str],
    cancel: Option<&AtomicBool>,
    mut on_record: impl FnMut(&[u8]) -> Result<(), String>,
) -> Result<(), String> {
    let mut command = Command::new("git");
    command
        .arg("-C")
        .arg(root)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("GIT_TERMINAL_PROMPT", "0");
    let mut child = command
        .spawn()
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                format!("GIT_NOT_INSTALLED: {error}")
            } else {
                format!("Impossible de démarrer Git : {error}")
            }
        })?;
    let stdout = child.stdout.take().ok_or("Sortie de statut Git indisponible.")?;
    let stderr = child.stderr.take().ok_or("Sortie d’erreur Git indisponible.")?;
    let (sender, receiver) = std::sync::mpsc::sync_channel::<Result<Vec<u8>, String>>(16);
    let stdout_sender = sender.clone();
    let stdout_thread = thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        loop {
            let mut record = Vec::new();
            match reader.read_until(0, &mut record) {
                Ok(0) => break,
                Ok(_) => {
                    if record.last() == Some(&0) {
                        record.pop();
                    }
                    if record.len() > MAX_GIT_PATH_BYTES {
                        let _ = stdout_sender.send(Err("Un chemin Git dépasse la limite autorisée.".to_string()));
                        break;
                    }
                    if stdout_sender.send(Ok(record)).is_err() {
                        break;
                    }
                }
                Err(error) => {
                    let _ = stdout_sender.send(Err(format!("Impossible de lire le statut Git : {error}")));
                    break;
                }
            }
        }
    });
    drop(sender);
    let stderr_capture = Arc::new(Mutex::new(Vec::new()));
    let stderr_thread = capture_process_output(stderr, stderr_capture.clone());

    let started = Instant::now();
    let mut stdout_closed = false;
    let mut exit_status = None;
    while !stdout_closed || exit_status.is_none() {
        match receiver.recv_timeout(Duration::from_millis(25)) {
            Ok(Ok(record)) => {
                if let Err(error) = on_record(&record) {
                    let _ = child.kill();
                    let _ = child.wait();
                    drop(receiver);
                    let _ = stdout_thread.join();
                    let _ = stderr_thread.join();
                    return Err(error);
                }
            }
            Ok(Err(error)) => {
                let _ = child.kill();
                let _ = child.wait();
                drop(receiver);
                let _ = stdout_thread.join();
                let _ = stderr_thread.join();
                return Err(error);
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => stdout_closed = true,
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
        }
        if cancel.is_some_and(|flag| flag.load(Ordering::Relaxed)) {
            let _ = child.kill();
            let _ = child.wait();
            drop(receiver);
            let _ = stdout_thread.join();
            let _ = stderr_thread.join();
            return Err("GIT_OPERATION_CANCELLED".to_string());
        }
        if started.elapsed() > PROCESS_TIMEOUT {
            let _ = child.kill();
            let _ = child.wait();
            drop(receiver);
            let _ = stdout_thread.join();
            let _ = stderr_thread.join();
            return Err("GIT_OPERATION_TIMEOUT".to_string());
        }
        if exit_status.is_none() {
            match child.try_wait() {
                Ok(status) => exit_status = status,
                Err(error) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    drop(receiver);
                    let _ = stdout_thread.join();
                    let _ = stderr_thread.join();
                    return Err(format!("Impossible de suivre le statut Git : {error}"));
                }
            }
        }
    }

    let _ = stdout_thread.join();
    stderr_thread
        .join()
        .map_err(|_| "Impossible de récupérer l’erreur Git.".to_string())?
        .map_err(|error| format!("Impossible de lire l’erreur Git : {error}"))?;
    let stderr = stderr_capture
        .lock()
        .map_err(|_| "Impossible de récupérer l’erreur Git.".to_string())?
        .clone();
    match exit_status {
        Some(status) if status.success() => Ok(()),
        Some(status) => Err(format!(
            "GIT_NATIVE_ERROR:{}:{}",
            status.code().unwrap_or(-1),
            String::from_utf8_lossy(&stderr).trim()
        )),
        None => Err("GIT_STATUS_FAILED".to_string()),
    }
}

#[tauri::command]
pub async fn git_status_project(dir: String, offset: usize, limit: usize) -> Result<GitStatusPage, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = validate_dir(&dir)?;
        let page_limit = limit.clamp(1, PAGE_SIZE_MAX);
        let branch = String::from_utf8_lossy(&run_simple(&root, &["branch", "--show-current"])?)
            .trim()
            .to_string();
        let remote_url = configured_github_remote(&root)?;
        let log_output = match run_simple(&root, &["log", "-n", "100", "--format=%h%x00%.200s%x00%ct"]) {
            Ok(output) => output,
            Err(error)
                if error.contains("does not have any commits yet")
                    || error.contains("unknown revision or path not in the working tree") =>
            {
                Vec::new()
            }
            Err(error) => return Err(error),
        };
        let log_fields: Vec<&[u8]> = log_output.split(|byte| *byte == 0).collect();
        let mut recent_commits = Vec::new();
        for fields in log_fields.chunks(3) {
            if fields.len() < 3 { continue; }
            let timestamp = String::from_utf8_lossy(fields[2]).trim().parse().unwrap_or(0);
            recent_commits.push(RecentCommit {
                oid: String::from_utf8_lossy(fields[0]).to_string(),
                message: String::from_utf8_lossy(fields[1]).trim().to_string(),
                timestamp,
            });
        }

        let mut files = Vec::with_capacity(page_limit);
        let mut conflict_files = Vec::new();
        let mut changed_files = 0u64;
        let mut renamed_source = false;
        stream_nul_output(&root, &["status", "--porcelain=v1", "-z", "--untracked-files=normal"], None, |record| {
            if renamed_source {
                renamed_source = false;
                return Ok(());
            }
            let Some(item) = parse_status_record(record) else { return Ok(()) };
            if item.status.contains('U') || item.status == "AA" || item.status == "DD" {
                if conflict_files.len() < PAGE_SIZE_MAX {
                    conflict_files.push(item.path.clone());
                }
            }
            changed_files += 1;
            let is_rename = item.status.contains('R') || item.status.contains('C');
            if changed_files > offset as u64 && files.len() < page_limit {
                files.push(item);
            }
            if is_rename {
                renamed_source = true;
            }
            Ok(())
        })?;
        Ok(GitStatusPage {
            branch: if branch.is_empty() { "main".to_string() } else { branch },
            remote_url,
            changed_files,
            conflict_files,
            recent_commits,
            files,
            offset,
            has_more: changed_files > offset.saturating_add(page_limit) as u64,
        })
    })
    .await
    .map_err(|error| format!("La lecture du statut Git a échoué : {error}"))?
}

#[tauri::command]
pub async fn git_init(dir: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = validate_dir(&dir)?;
        run_simple(&root, &["init", "--initial-branch=main"])?;
        run_simple(&root, &["config", "user.name", "GitHub Simplifié"])?;
        run_simple(&root, &["config", "user.email", "github-simplifie@users.noreply.github.com"])?;
        Ok(())
    })
    .await
    .map_err(|error| format!("L’initialisation Git a échoué : {error}"))?
}

#[tauri::command]
pub async fn git_set_remote(dir: String, url: String, replace: bool) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = validate_dir(&dir)?;
        let validated_url = validate_github_remote(&url)?;
        let existing = configured_github_remote(&root)?;
        if existing.is_some() {
            if !replace { return Err("Un dépôt distant est déjà associé.".to_string()); }
            run_simple(&root, &["remote", "set-url", "origin", &validated_url])?;
        } else {
            run_simple(&root, &["remote", "add", "origin", &validated_url])?;
        }
        Ok(())
    })
    .await
    .map_err(|error| format!("L’association du dépôt distant a échoué : {error}"))?
}

#[tauri::command]
pub async fn git_set_ignore(dir: String, filepath: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = validate_dir(&dir)?;
        let relative = Path::new(&filepath);
        if relative.is_absolute() || relative.components().any(|component| matches!(component, std::path::Component::ParentDir | std::path::Component::RootDir)) {
            return Err("Chemin de fichier invalide.".to_string());
        }
        let rule = format!("/{}", filepath.replace('\\', "/"));
        append_ignore_rules(&root, &[rule])?;
        run_simple(&root, &["rm", "--cached", "--ignore-unmatch", "--", &filepath])?;
        Ok(())
    })
    .await
    .map_err(|error| format!("Impossible d’ignorer ce fichier : {error}"))?
}

#[tauri::command]
pub async fn git_prepare_ignore(dir: String, suggested: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = validate_dir(&dir)?;
        let mut rules = default_ignore_rules();
        rules.extend(suggested.lines().map(str::to_string));
        append_ignore_rules(&root, &rules)
    })
    .await
    .map_err(|error| format!("La préparation de .gitignore a échoué : {error}"))?
}

fn generated_pathspecs() -> [&'static str; 18] {
    [
        ":(glob)**/node_modules/**",
        ":(glob)**/target/**",
        ":(glob)**/dist/**",
        ":(glob)**/vendor/**",
        ":(glob)**/build/**",
        ":(glob)**/.git/**",
        ":(glob)**/.godot/**",
        ":(glob)**/.next/**",
        ":(glob)**/.cache/**",
        ":(glob)**/coverage/**",
        ":(glob)**/.venv/**",
        ":(glob)**/venv/**",
        ":(glob)**/.tox/**",
        ":(glob)**/.mypy_cache/**",
        ":(glob)**/.ruff_cache/**",
        ":(glob)**/.pytest_cache/**",
        ":(glob)**/.idea/**",
        ":(glob)**/.vscode/**",
    ]
}

fn untrack_paths(root: &Path, paths: &[String]) -> Result<(), String> {
    for batch in paths.chunks(32) {
        let mut command = Command::new("git");
        command
            .arg("-C")
            .arg(root)
            .args(["rm", "--cached", "--ignore-unmatch", "--"])
            .args(batch)
            .env("GIT_TERMINAL_PROMPT", "0")
            .stdout(Stdio::null())
            .stderr(Stdio::piped());
        let output = command
            .output()
            .map_err(|error| format!("Impossible de préparer l’index Git : {error}"))?;
        if !output.status.success() {
            return Err(format!(
                "GIT_NATIVE_ERROR:{}:{}",
                output.status.code().unwrap_or(-1),
                String::from_utf8_lossy(&output.stderr)
            ));
        }
    }
    Ok(())
}

fn remove_generated_from_index(
    app: &AppHandle,
    operation_id: &str,
    root: &Path,
    cancel: &AtomicBool,
) -> Result<(), String> {
    let mut args = vec![
        "rm".to_string(),
        "-r".to_string(),
        "--cached".to_string(),
        "--ignore-unmatch".to_string(),
        "--".to_string(),
    ];
    args.extend(generated_pathspecs().iter().map(|path| path.to_string()));
    run_git(app, operation_id, root, &args, None, cancel, PROCESS_TIMEOUT)?;
    Ok(())
}

fn prepare_tracked_exclusions(
    root: &Path,
    cancel: &AtomicBool,
) -> Result<CommitPreparation, String> {
    let mut sensitive = Vec::new();
    let mut generated = HashSet::new();
    let mut excluded_large_files = Vec::new();
    let mut warning_large_files = Vec::new();
    stream_nul_output(root, &["ls-files", "-z"], Some(cancel), |raw| {
        let path = PathBuf::from(String::from_utf8_lossy(raw).to_string());
        let filepath = path.to_string_lossy().replace('\\', "/");
        if sensitive_path(&path) {
            if sensitive.len() == PAGE_SIZE_MAX {
                return Err("GIT_TOO_MANY_SENSITIVE_FILES".to_string());
            }
            sensitive.push(filepath.clone());
        }
        generated_folder_names(&path, &mut generated);
        if let Ok(metadata) = fs::symlink_metadata(root.join(&path)) {
            if metadata.is_file() {
                let size = metadata.len();
                if size >= LARGE_FILE_BLOCK {
                    if excluded_large_files.len() == PAGE_SIZE_MAX {
                        return Err("GIT_TOO_MANY_LARGE_FILES".to_string());
                    }
                    excluded_large_files.push(filepath.clone());
                } else if size >= LARGE_FILE_WARNING {
                    if warning_large_files.len() < PAGE_SIZE_MAX {
                        warning_large_files.push(filepath);
                    }
                }
            }
        }
        Ok(())
    })?;
    Ok(CommitPreparation {
        excluded_large_files,
        warning_large_files,
        excluded_sensitive_files: sensitive,
        excluded_generated_folders: generated.into_iter().collect(),
    })
}

fn scan_changed_file_sizes(root: &Path, app: &AppHandle, operation_id: &str, cancel: &AtomicBool) -> Result<CommitPreparation, String> {
    let mut excluded_large_files = Vec::new();
    let mut warning_large_files = Vec::new();
    let mut excluded_sensitive_files = Vec::new();
    let mut excluded_generated_folders = HashSet::new();
    let mut total = 0u64;
    let mut renamed_source = false;
    stream_nul_output(
        root,
        &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
        Some(cancel),
        |record| {
        if renamed_source {
            renamed_source = false;
            return Ok(());
        }
        let Some(item) = parse_status_record(record) else { return Ok(()) };
        total += 1;
        let relative = Path::new(&item.path);
        if sensitive_path(relative) {
            if excluded_sensitive_files.len() == PAGE_SIZE_MAX {
                return Err("GIT_TOO_MANY_SENSITIVE_FILES".to_string());
            }
            if excluded_sensitive_files.len() < PAGE_SIZE_MAX {
                excluded_sensitive_files.push(item.path.clone());
            }
        }
        if relative.components().any(|component| {
            let name = component.as_os_str().to_string_lossy();
            generated_directory(&name)
        }) {
            if excluded_generated_folders.len() < PAGE_SIZE_MAX {
                for component in relative.components() {
                    let name = component.as_os_str().to_string_lossy().to_string();
                    if generated_directory(&name) {
                        excluded_generated_folders.insert(name);
                    }
                }
            }
        }
        let path = root.join(&item.path);
        let metadata = match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.is_file() => metadata,
            _ => {
                renamed_source = item.status.contains('R') || item.status.contains('C');
                return Ok(());
            }
        };
        let size = metadata.len();
        if size >= LARGE_FILE_BLOCK {
            if excluded_large_files.len() == PAGE_SIZE_MAX {
                return Err("GIT_TOO_MANY_LARGE_FILES".to_string());
            }
            if excluded_large_files.len() < PAGE_SIZE_MAX {
                excluded_large_files.push(item.path.clone());
            }
        } else if size >= LARGE_FILE_WARNING && warning_large_files.len() < PAGE_SIZE_MAX {
            warning_large_files.push(item.path);
        }
        if total % 128 == 0 {
            emit_progress(app, operation_id, "large-file-scan", Some(total), None);
        }
        renamed_source = item.status.contains('R') || item.status.contains('C');
        Ok(())
    })?;
    emit_progress(app, operation_id, "large-file-scan", Some(total), Some(total));
    Ok(CommitPreparation {
        excluded_large_files,
        warning_large_files,
        excluded_sensitive_files,
        excluded_generated_folders: excluded_generated_folders.into_iter().collect(),
    })
}

#[tauri::command]
pub async fn git_commit_project(
    app: AppHandle,
    operations: State<'_, GitOperations>,
    dir: String,
    message: String,
    name: String,
    email: String,
    operation_id: String,
) -> Result<CommitPreparation, String> {
    let operations_ref = operations.cancellations.clone();
    run_with_operation_async(app, operations_ref, operation_id, move |app, id, cancel| {
        let root = validate_dir(&dir)?;
        let mut ignore = default_ignore_rules();
        ignore.extend(sensitive_rules());
        append_ignore_rules(&root, &ignore)?;
        let tracked_protection = prepare_tracked_exclusions(&root, &cancel)?;
        let mut preparation = scan_changed_file_sizes(&root, &app, &id, &cancel)?;
        for filepath in tracked_protection.excluded_sensitive_files {
            if !preparation.excluded_sensitive_files.contains(&filepath) {
                preparation.excluded_sensitive_files.push(filepath);
            }
        }
        for filepath in tracked_protection.excluded_large_files {
            if !preparation.excluded_large_files.contains(&filepath) {
                preparation.excluded_large_files.push(filepath);
            }
        }
        for filepath in tracked_protection.warning_large_files {
            if !preparation.warning_large_files.contains(&filepath) {
                preparation.warning_large_files.push(filepath);
            }
        }
        for folder in tracked_protection.excluded_generated_folders {
            if !preparation.excluded_generated_folders.contains(&folder) {
                preparation.excluded_generated_folders.push(folder);
            }
        }
        let mut protected_files = preparation.excluded_sensitive_files.clone();
        protected_files.extend(preparation.excluded_large_files.iter().cloned());
        protected_files.sort();
        protected_files.dedup();
        if !protected_files.is_empty() {
            let rules = protected_files
                .iter()
                .map(|filepath| format!("/{}", filepath.replace('\\', "/")))
                .collect::<Vec<_>>();
            append_ignore_rules(&root, &rules)?;
            untrack_paths(&root, &protected_files)?;
        }
        remove_generated_from_index(&app, &id, &root, &cancel)?;
        emit_progress(&app, &id, "stage", Some(0), None);
        let args = vec!["add".to_string(), "-A".to_string(), "--".to_string(), ".".to_string()];
        run_git(&app, &id, &root, &args, None, &cancel, PROCESS_TIMEOUT)?;
        if cancel.load(Ordering::Relaxed) { return Err("GIT_OPERATION_CANCELLED".to_string()); }
        run_simple(&root, &["config", "user.name", &name])?;
        run_simple(&root, &["config", "user.email", &email])?;
        emit_progress(&app, &id, "commit", Some(0), Some(1));
        let commit_message = message.trim();
        if commit_message.is_empty() { return Err("Le message du commit ne peut pas être vide.".to_string()); }
        run_git(&app, &id, &root, &["commit".to_string(), "-m".to_string(), commit_message.to_string()], None, &cancel, PROCESS_TIMEOUT)?;
        emit_progress(&app, &id, "commit", Some(1), Some(1));
        Ok(preparation)
    }).await
}

fn push_args(branch: &str) -> Vec<String> {
    vec![
        "push".to_string(),
        "--porcelain".to_string(),
        "origin".to_string(),
        format!("refs/heads/{branch}:refs/heads/{branch}"),
    ]
}

#[tauri::command]
pub async fn git_push_project(
    app: AppHandle,
    operations: State<'_, GitOperations>,
    dir: String,
    token: String,
    operation_id: String,
) -> Result<(), String> {
    let operations_ref = operations.cancellations.clone();
    run_with_operation_async(app, operations_ref, operation_id, move |app, id, cancel| {
        let root = validate_dir(&dir)?;
        configured_github_remote(&root)?
            .ok_or("Associez un dépôt GitHub avant de publier.".to_string())?;
        let branch = String::from_utf8_lossy(&run_simple(&root, &["branch", "--show-current"])?).trim().to_string();
        if branch.is_empty() { return Err("Aucune branche Git n’est active.".to_string()); }
        let result = run_git(&app, &id, &root, &push_args(&branch), Some(&token), &cancel, PROCESS_TIMEOUT)?;
        let output = String::from_utf8_lossy(&result.stdout).to_lowercase();
        if output.contains("[rejected]") {
            return Err("GitHub a rejeté le push. Récupérez les changements distants et vérifiez les protections de branche.".to_string());
        }
        Ok(())
    }).await
}

#[tauri::command]
pub async fn git_sync_project(
    app: AppHandle,
    operations: State<'_, GitOperations>,
    dir: String,
    token: String,
    operation_id: String,
) -> Result<(), String> {
    let operations_ref = operations.cancellations.clone();
    run_with_operation_async(app, operations_ref, operation_id, move |app, id, cancel| {
        let root = validate_dir(&dir)?;
        configured_github_remote(&root)?
            .ok_or("Associez un dépôt GitHub avant de synchroniser.".to_string())?;
        let branch = String::from_utf8_lossy(&run_simple(&root, &["branch", "--show-current"])?).trim().to_string();
        if branch.is_empty() { return Err("Aucune branche Git n’est active.".to_string()); }
        let remote_ref = format!("refs/heads/{branch}");
        let ls_remote = vec!["ls-remote".to_string(), "--heads".to_string(), "origin".to_string(), remote_ref.clone()];
        let refs = run_git(&app, &id, &root, &ls_remote, Some(&token), &cancel, PROCESS_TIMEOUT)?;
        if !refs.stdout.is_empty() {
            let pull_args = vec![
                "pull".to_string(),
                "--ff-only".to_string(),
                "origin".to_string(),
                branch.clone(),
            ];
            run_git(&app, &id, &root, &pull_args, Some(&token), &cancel, PROCESS_TIMEOUT)?;
        }
        run_git(&app, &id, &root, &push_args(&branch), Some(&token), &cancel, PROCESS_TIMEOUT)?;
        Ok(())
    }).await
}

#[tauri::command]
pub async fn git_clone_project(
    app: AppHandle,
    operations: State<'_, GitOperations>,
    url: String,
    destination: String,
    token: String,
    operation_id: String,
) -> Result<(), String> {
    let operations_ref = operations.cancellations.clone();
    run_with_operation_async(app, operations_ref, operation_id, move |app, id, cancel| {
        let validated_url = validate_github_remote(&url)?;
        let requested_target = PathBuf::from(&destination);
        let parent = requested_target.parent().ok_or("Dossier parent invalide.")?;
        let parent = fs::canonicalize(parent)
            .map_err(|error| format!("Impossible de vérifier le dossier de destination : {error}"))?;
        let name = requested_target.file_name().ok_or("Nom de dossier cible invalide.")?;
        let target = parent.join(name);
        if target.exists() { return Err("Le dossier cible existe déjà.".to_string()); }
        let safe_id: String = id.chars().filter(|character| character.is_ascii_alphanumeric()).collect();
        if safe_id.is_empty() { return Err("Identifiant d’opération invalide.".to_string()); }
        let temporary = parent.join(format!(".gsimplifie-clone-{safe_id}"));
        if temporary.exists() { return Err("Un dossier temporaire de clonage existe déjà.".to_string()); }
        let args = vec![
            "clone".to_string(),
            "--progress".to_string(),
            "--single-branch".to_string(),
            validated_url,
            temporary.to_string_lossy().into_owned(),
        ];
        if let Err(error) = run_git(&app, &id, &parent, &args, Some(&token), &cancel, PROCESS_TIMEOUT) {
            if temporary.exists() {
                fs::remove_dir_all(&temporary)
                    .map_err(|cleanup| format!("{error}; nettoyage du clonage temporaire impossible : {cleanup}"))?;
            }
            return Err(error);
        }
        if let Err(error) = fs::rename(&temporary, &target) {
            if temporary.exists() {
                fs::remove_dir_all(&temporary)
                    .map_err(|cleanup| format!("Impossible de finaliser le clonage : {error}; nettoyage impossible : {cleanup}"))?;
            }
            return Err(format!("Impossible de finaliser le clonage : {error}"));
        }
        Ok(())
    }).await
}

#[tauri::command]
pub async fn git_cancel_operation(
    operations: State<'_, GitOperations>,
    operation_id: String,
) -> Result<(), String> {
    let active = operations
        .cancellations
        .lock()
        .map_err(|_| "Impossible d’annuler l’opération Git.".to_string())?;
    if let Some(flag) = active.get(&operation_id) {
        flag.store(true, Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
pub async fn git_list_sensitive_tracked(dir: String) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = validate_dir(&dir)?;
        let mut sensitive = Vec::new();
        stream_nul_output(&root, &["ls-files", "-z"], None, |raw| {
            let path = PathBuf::from(String::from_utf8_lossy(raw).to_string());
            if sensitive_path(&path) && sensitive.len() < PAGE_SIZE_MAX {
                sensitive.push(path.to_string_lossy().replace('\\', "/"));
            }
            Ok(())
        })?;
        Ok(sensitive)
    })
    .await
    .map_err(|error| format!("La vérification des fichiers suivis a échoué : {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TemporaryGitProject(PathBuf);

    impl TemporaryGitProject {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "gsimplifie-git-test-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .expect("system clock should be after the Unix epoch")
                    .as_nanos()
            ));
            fs::create_dir(&path).expect("create isolated Git test directory");
            Self(path)
        }
    }

    impl Drop for TemporaryGitProject {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn base64_encodes_github_basic_auth() {
        assert_eq!(base64_basic("x-access-token:token"), "eC1hY2Nlc3MtdG9rZW46dG9rZW4=");
    }

    #[test]
    fn status_records_preserve_spaces_in_paths() {
        let record = parse_status_record(b" M file with spaces.txt").unwrap();
        assert_eq!(record.status, "M");
        assert_eq!(record.path, "file with spaces.txt");
    }

    #[test]
    fn generated_folders_match_gitignore_names() {
        assert!(generated_directory("node_modules"));
        assert!(generated_directory("target"));
        assert!(!generated_directory("Node_Modules"));
        assert!(!generated_directory("src"));
    }

    #[test]
    fn sensitive_examples_are_not_excluded() {
        assert!(!sensitive_path(Path::new(".env.example")));
        assert!(sensitive_path(Path::new(".env.production")));
    }

    #[test]
    fn remote_validation_rejects_embedded_credentials() {
        assert!(validate_github_remote("https://github.com/owner/repo.git").is_ok());
        assert!(validate_github_remote("https://user:token@github.com/owner/repo.git").is_err());
        assert!(validate_github_remote("https://github.com/owner/repo?token=secret").is_err());
    }

    #[test]
    fn cached_scan_pages_are_bounded_and_ordered() {
        let cached = CachedProjectScan {
            root: PathBuf::from("/project"),
            analysis: ProjectAnalysis {
                project_type: "static".to_string(),
                suggested_gitignore: String::new(),
                has_existing_git: false,
                sensitive_files: Vec::new(),
                file_count: 3,
            },
            files: vec!["a.txt".to_string(), "b.txt".to_string(), "c.txt".to_string()],
            scanned_at: Instant::now(),
        };
        let page = cached_scan_page(cached, 1, 1);
        assert_eq!(page.files, vec!["b.txt"]);
        assert!(page.has_more);
    }

    #[test]
    fn cached_scan_stops_pagination_at_the_path_limit() {
        let cached = CachedProjectScan {
            root: PathBuf::from("/project"),
            analysis: ProjectAnalysis {
                project_type: "static".to_string(),
                suggested_gitignore: String::new(),
                has_existing_git: false,
                sensitive_files: Vec::new(),
                file_count: (MAX_CACHED_PROJECT_PATHS + 1) as u64,
            },
            files: (0..MAX_CACHED_PROJECT_PATHS)
                .map(|index| format!("file-{index}.txt"))
                .collect(),
            scanned_at: Instant::now(),
        };
        let page = cached_scan_page(cached, MAX_CACHED_PROJECT_PATHS - PAGE_SIZE_MAX, PAGE_SIZE_MAX);
        assert_eq!(page.files.len(), PAGE_SIZE_MAX);
        assert!(!page.has_more);
    }

    #[test]
    fn simple_git_commands_check_exit_status_and_capture_output() {
        if Command::new("git").arg("--version").output().is_err() {
            return;
        }
        let project = TemporaryGitProject::new();
        run_simple(&project.0, &["init"]).expect("initialize isolated test repository");
        let status = run_simple(&project.0, &["status", "--short"]).expect("read Git status");
        assert!(status.is_empty());

        let failure = run_simple(&project.0, &["not-a-real-git-subcommand"])
            .expect_err("unknown Git subcommand must fail");
        assert!(failure.starts_with("GIT_NATIVE_ERROR:"));
        assert!(failure.contains("not-a-real-git-subcommand"));
    }
}
