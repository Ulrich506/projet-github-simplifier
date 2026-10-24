import {
  readFile as tauriReadFile,
  writeFile as tauriWriteFile,
  mkdir as tauriMkdir,
  readDir as tauriReadDir,
  remove as tauriRemove,
  rename as tauriRename,
  stat as tauriStat,
  lstat as tauriLstat,
} from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";

interface ErreurFS extends Error {
  code?: string;
}

// @tauri-apps/plugin-fs rejette avec de simples messages texte, pas des
// objets d'erreur avec .code comme Node.js. Or isomorphic-git s'appuie
// beaucoup sur err.code === "ENOENT" pour son fonctionnement interne
// (savoir si un fichier/dossier existe déjà, par exemple). On reconstruit
// ce code à partir du message pour rester compatible.
function erreurFS(err: unknown, chemin: string): ErreurFS {
  const message = err instanceof Error ? err.message : String(err);
  const e = new Error(message) as ErreurFS;
  if (/no such file|not found|cannot find|os error 2/i.test(message)) {
    e.code = "ENOENT";
  }
  e.message = `${message} (${chemin})`;
  return e;
}

interface InfoFichierTauri {
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  mtime: Date | null;
}

const liensSymboliquesConnus = new Set<string>();

function normaliserChemin(chemin: string): string {
  return chemin.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function estLienSymbolique(dir: string, filepath: string): boolean {
  return liensSymboliquesConnus.has(normaliserChemin(`${dir}/${filepath}`));
}

export function enregistrerLienSymbolique(chemin: string): void {
  liensSymboliquesConnus.add(normaliserChemin(chemin));
}

function versStatNode(info: InfoFichierTauri) {
  const taille = Number.isFinite(info.size) ? info.size : 0;
  const dateModification = info.mtime instanceof Date ? info.mtime.getTime() : 0;
  return {
    isFile: () => info.isFile,
    isDirectory: () => info.isDirectory,
    isSymbolicLink: () => info.isSymlink,
    size: taille,
    mtimeMs: dateModification,
    ctimeMs: dateModification,
    mode: info.isDirectory ? 0o040000 : 0o100644,
    uid: 0,
    gid: 0,
    dev: 0,
    ino: 0,
  };
}

/**
 * Adapte l'API @tauri-apps/plugin-fs (accès au vrai disque, via le
 * plugin natif Rust) au format attendu par isomorphic-git (proche de
 * fs.promises de Node). Remplace lightning-fs : plus besoin de copier
 * les fichiers dans un FS virtuel en mémoire — git lit/écrit directement
 * dans le vrai dossier que l'utilisateur a déposé.
 */
export const tauriFsBridge = {
  promises: {
    async readFile(chemin: string, options?: { encoding?: string }) {
      try {
        const donnees = await tauriReadFile(chemin);
        if (options?.encoding === "utf8") {
          return new TextDecoder().decode(donnees);
        }
        return donnees;
      } catch (err) {
        throw erreurFS(err, chemin);
      }
    },

    async writeFile(chemin: string, donnees: Uint8Array | string) {
      try {
        const octets =
          typeof donnees === "string" ? new TextEncoder().encode(donnees) : donnees;
        await tauriWriteFile(chemin, octets);
      } catch (err) {
        throw erreurFS(err, chemin);
      }
    },

    async unlink(chemin: string) {
      try {
        await tauriRemove(chemin);
      } catch (err) {
        throw erreurFS(err, chemin);
      }
    },

    async readdir(chemin: string) {
      try {
        const entrees = await tauriReadDir(chemin);
        const noms: string[] = [];
        for (const entree of entrees) {
          if (!entree.name) continue;
          if (entree.isSymlink) {
            enregistrerLienSymbolique(await join(chemin, entree.name));
            continue;
          }
          noms.push(entree.name);
        }
        return noms;
      } catch (err) {
        throw erreurFS(err, chemin);
      }
    },

    async mkdir(chemin: string) {
      try {
        await tauriMkdir(chemin, { recursive: true });
      } catch (err) {
        const e = erreurFS(err, chemin);
        if (/exists/i.test(e.message)) return; // déjà présent, rien à faire
        throw e;
      }
    },

    async rmdir(chemin: string) {
      try {
        await tauriRemove(chemin, { recursive: true });
      } catch (err) {
        throw erreurFS(err, chemin);
      }
    },

    async stat(chemin: string) {
      try {
        return versStatNode(await tauriStat(chemin));
      } catch (err) {
        throw erreurFS(err, chemin);
      }
    },

    async lstat(chemin: string) {
      if (liensSymboliquesConnus.has(normaliserChemin(chemin))) {
        return versStatNode({
          isFile: false,
          isDirectory: false,
          isSymlink: true,
          size: 0,
          mtime: null,
        });
      }
      try {
        return versStatNode(await tauriLstat(chemin));
      } catch (err) {
        throw erreurFS(err, chemin);
      }
    },

    async readlink(chemin: string) {
      const e = new Error(`Les liens symboliques ne sont pas pris en charge : ${chemin}`) as ErreurFS;
      e.code = "ENOSYS";
      throw e;
    },

    async symlink(_cible: string, chemin: string) {
      const e = new Error(`Les liens symboliques ne sont pas pris en charge : ${chemin}`) as ErreurFS;
      e.code = "ENOSYS";
      throw e;
    },

    async rename(ancienChemin: string, nouveauChemin: string) {
      try {
        await tauriRename(ancienChemin, nouveauChemin);
      } catch (err) {
        throw erreurFS(err, ancienChemin);
      }
    },
  },
};
