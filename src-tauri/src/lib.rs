mod git_native;

const KEYRING_SERVICE: &str = "com.root.github-simplifie";

fn account_index() -> Result<Vec<String>, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, "github-accounts-index")
        .map_err(|error| format!("Impossible d’ouvrir le trousseau sécurisé : {error}"))?;
    match entry.get_password() {
        Ok(value) => serde_json::from_str(&value)
            .map_err(|error| format!("La liste des comptes enregistrés est invalide : {error}")),
        Err(keyring::Error::NoEntry) => Ok(Vec::new()),
        Err(error) => Err(format!(
            "Impossible de lire les comptes enregistrés : {error}"
        )),
    }
}

fn save_account_index(accounts: &[String]) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, "github-accounts-index")
        .map_err(|error| format!("Impossible d’ouvrir le trousseau sécurisé : {error}"))?;
    let serialized = serde_json::to_string(accounts)
        .map_err(|error| format!("Impossible de préparer la liste des comptes : {error}"))?;
    entry
        .set_password(&serialized)
        .map_err(|error| format!("Impossible d’enregistrer la liste des comptes : {error}"))
}

#[tauri::command]
fn charger_jeton_github() -> Result<Option<String>, String> {
    // Keep the existing keyring service name so app identity changes do not log
    // out users who already have a token stored in the system credential store.
    let entry = keyring::Entry::new(KEYRING_SERVICE, "github-oauth-token")
        .map_err(|error| format!("Impossible d’ouvrir le trousseau sécurisé : {error}"))?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Impossible de lire le jeton GitHub : {error}")),
    }
}

#[tauri::command]
fn enregistrer_jeton_github(token: String) -> Result<(), String> {
    if token.trim().is_empty() {
        return Err("Le jeton GitHub ne peut pas être vide.".to_string());
    }
    let entry = keyring::Entry::new(KEYRING_SERVICE, "github-oauth-token")
        .map_err(|error| format!("Impossible d’ouvrir le trousseau sécurisé : {error}"))?;
    entry
        .set_password(&token)
        .map_err(|error| format!("Impossible d’enregistrer le jeton GitHub : {error}"))
}

#[tauri::command]
fn supprimer_jeton_github() -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, "github-oauth-token")
        .map_err(|error| format!("Impossible d’ouvrir le trousseau sécurisé : {error}"))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Impossible de supprimer le jeton GitHub : {error}")),
    }
}

#[tauri::command]
fn lister_comptes_github() -> Result<Vec<String>, String> {
    account_index()
}

#[tauri::command]
fn charger_jeton_github_compte(login: String) -> Result<Option<String>, String> {
    if !login
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err("Identifiant GitHub invalide.".to_string());
    }
    let entry = keyring::Entry::new(KEYRING_SERVICE, &format!("github-account-{login}"))
        .map_err(|error| format!("Impossible d’ouvrir le trousseau sécurisé : {error}"))?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Impossible de charger ce compte GitHub : {error}")),
    }
}

#[tauri::command]
fn enregistrer_compte_github(login: String, token: String) -> Result<(), String> {
    if !login
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err("Identifiant GitHub invalide.".to_string());
    }
    if token.trim().is_empty() {
        return Err("Le jeton GitHub ne peut pas être vide.".to_string());
    }
    let entry = keyring::Entry::new(KEYRING_SERVICE, &format!("github-account-{login}"))
        .map_err(|error| format!("Impossible d’ouvrir le trousseau sécurisé : {error}"))?;
    entry
        .set_password(&token)
        .map_err(|error| format!("Impossible d’enregistrer ce compte GitHub : {error}"))?;

    let mut accounts = account_index()?;
    if !accounts
        .iter()
        .any(|account| account.eq_ignore_ascii_case(&login))
    {
        accounts.push(login);
        accounts.sort_by_key(|account| account.to_lowercase());
        save_account_index(&accounts)?;
    }

    let legacy_entry = keyring::Entry::new(KEYRING_SERVICE, "github-oauth-token")
        .map_err(|error| format!("Impossible d’ouvrir le trousseau sécurisé : {error}"))?;
    legacy_entry
        .set_password(&token)
        .map_err(|error| format!("Impossible d’enregistrer le jeton GitHub historique : {error}"))
}

#[tauri::command]
fn oublier_compte_github(login: String) -> Result<(), String> {
    if !login
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err("Identifiant GitHub invalide.".to_string());
    }
    let entry = keyring::Entry::new(KEYRING_SERVICE, &format!("github-account-{login}"))
        .map_err(|error| format!("Impossible d’ouvrir le trousseau sécurisé : {error}"))?;
    let removed_token = entry.get_password().ok();
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {}
        Err(error) => return Err(format!("Impossible d’oublier ce compte GitHub : {error}")),
    }
    let accounts = account_index()?
        .into_iter()
        .filter(|account| !account.eq_ignore_ascii_case(&login))
        .collect::<Vec<_>>();
    save_account_index(&accounts)?;

    if let Some(removed_token) = removed_token {
        let legacy_entry = keyring::Entry::new(KEYRING_SERVICE, "github-oauth-token")
            .map_err(|error| format!("Impossible d’ouvrir le trousseau sécurisé : {error}"))?;
        if legacy_entry.get_password().ok().as_deref() == Some(removed_token.as_str()) {
            match legacy_entry.delete_credential() {
                Ok(()) | Err(keyring::Error::NoEntry) => {}
                Err(error) => {
                    return Err(format!("Impossible de supprimer l’ancien jeton : {error}"))
                }
            }
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(git_native::GitOperations::default())
        // Requis pour les appels HTTPS vers l’API GitHub depuis le WebView.
        .plugin(tauri_plugin_http::init())
        // Requis pour choisir un dossier avec le sélecteur natif.
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            charger_jeton_github,
            enregistrer_jeton_github,
            supprimer_jeton_github,
            lister_comptes_github,
            charger_jeton_github_compte,
            enregistrer_compte_github,
            oublier_compte_github,
            git_native::git_detect_project,
            git_native::git_scan_project,
            git_native::git_read_file_preview,
            git_native::git_status_project,
            git_native::git_init,
            git_native::git_set_remote,
            git_native::git_set_ignore,
            git_native::git_prepare_ignore,
            git_native::git_commit_project,
            git_native::git_push_project,
            git_native::git_sync_project,
            git_native::git_clone_project,
            git_native::git_cancel_operation,
            git_native::git_list_sensitive_tracked
        ])
        .run(tauri::generate_context!())
        .expect("erreur lors du lancement de l'application Tauri");
}
