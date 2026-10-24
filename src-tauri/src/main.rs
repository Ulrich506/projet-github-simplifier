// On empêche la console Windows de s'ouvrir en plus de la fenêtre de l'app
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    github_simplifie_lib::run();
}
