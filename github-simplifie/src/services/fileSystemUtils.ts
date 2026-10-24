import { readDir } from "@tauri-apps/plugin-fs";

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
  ]);

  async function explorer(sousChemin: string, prefixeRelatif: string): Promise<void> {
    const entrees = await readDir(sousChemin);
    for (const entree of entrees) {
      const nom = entree.name ?? "";
      if (!nom) continue;

      const cheminEnfant = `${sousChemin}/${nom}`;
      const relatifEnfant = prefixeRelatif ? `${prefixeRelatif}/${nom}` : nom;
      if (entree.isDirectory) {
        if (dossiersAignorer.has(nom)) {
          if (nom === ".git") resultats.push(".git");
          continue;
        }
        await explorer(cheminEnfant, relatifEnfant);
      } else {
        resultats.push(relatifEnfant);
      }
    }
  }

  await explorer(cheminAbsolu, "");
  return resultats;
}
