import { readDir } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { enregistrerLienSymbolique } from "./tauriFsBridge";

export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

/**
 * Explore récursivement un dossier réel du disque (chemin obtenu via
 * l'event natif Tauri onDragDropEvent) et renvoie les chemins relatifs
 * de tous les fichiers qu'il contient. Contrairement à l'ancienne
 * approche basée sur l'API File du navigateur, on a ici un vrai accès
 * disque : pas besoin de lire le contenu des fichiers pour l'analyse,
 * juste leur emplacement.
 */
export async function listerCheminsRelatifs(cheminAbsolu: string): Promise<string[]> {
  const resultats: string[] = [];
  const dossiersAignorer = new Set([
    ".git",
    ".godot",
    "node_modules",
    "dist",
    "target",
    ".venv",
    "venv",
    "vendor",
    "build",
    ".next",
    ".cache",
    "coverage",
    ".tox",
    ".mypy_cache",
    ".ruff_cache",
    ".pytest_cache",
    ".idea",
    ".vscode",
  ]);
  let entriesTraitees = 0;

  async function explorer(sousChemin: string, prefixeRelatif: string): Promise<void> {
    const entrees = await readDir(sousChemin);
    for (const entree of entrees) {
      const nom = entree.name ?? "";
      if (!nom) continue;
      entriesTraitees += 1;
      if (entriesTraitees % 128 === 0) await yieldToUi();

      const relatifEnfant = prefixeRelatif ? `${prefixeRelatif}/${nom}` : nom;
      if (entree.isSymlink) {
        enregistrerLienSymbolique(await join(sousChemin, nom));
        continue;
      }
      if (entree.isDirectory) {
        if (dossiersAignorer.has(nom)) {
          if (nom === ".git" && prefixeRelatif === "") resultats.push(".git");
          continue;
        }
        await explorer(await join(sousChemin, nom), relatifEnfant);
      } else {
        resultats.push(relatifEnfant);
      }
    }
  }

  await explorer(cheminAbsolu, "");
  return resultats;
}
