#[tauri::command]
fn charger_jeton_github() -> Result<Option<String>, String> {
    // Keep the existing keyring service name so app identity changes do not log
    // out users who already have a token stored in the system credential store.
    let entry = keyring::Entry::new("com.root.github-simplifie", "github-oauth-token")
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
    let entry = keyring::Entry::new("com.root.github-simplifie", "github-oauth-token")
        .map_err(|error| format!("Impossible d’ouvrir le trousseau sécurisé : {error}"))?;
    entry
        .set_password(&token)
        .map_err(|error| format!("Impossible d’enregistrer le jeton GitHub : {error}"))
}

#[tauri::command]
fn supprimer_jeton_github() -> Result<(), String> {
    let entry = keyring::Entry::new("com.root.github-simplifie", "github-oauth-token")
        .map_err(|error| format!("Impossible d’ouvrir le trousseau sécurisé : {error}"))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Impossible de supprimer le jeton GitHub : {error}")),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Requis par src/services/githubAuth.ts et src/services/tauriGitHttp.ts,
        // qui font leurs requêtes via @tauri-apps/plugin-http pour éviter
        // les blocages CORS du WebView sur les domaines github.com/api.github.com
        .plugin(tauri_plugin_http::init())
        // Requis pour lire et modifier le dossier de projet local.
        .plugin(tauri_plugin_fs::init())
        // Requis pour choisir un dossier avec le sélecteur natif.
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            charger_jeton_github,
            enregistrer_jeton_github,
            supprimer_jeton_github
        ])
        .run(tauri::generate_context!())
        .expect("erreur lors du lancement de l'application Tauri");
}
