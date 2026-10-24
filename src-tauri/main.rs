// On empêche la console Windows de s'ouvrir en plus de la fenêtre de l'app
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        // Requis par src/services/githubAuth.ts et src/services/tauriGitHttp.ts
        // pour éviter les blocages CORS du WebView vers github.com/api.github.com
        .plugin(tauri_plugin_http::init())
        // Requis par src/services/tauriFsBridge.ts : accès au vrai disque
        // pour que git opère directement sur le dossier déposé
        .plugin(tauri_plugin_fs::init())
        // Requis pour le sélecteur de dossier de destination ("Récupérer un projet")
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("erreur lors du lancement de l'application Tauri");
}