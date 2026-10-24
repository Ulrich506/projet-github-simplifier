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

function versStatNode(info: InfoFichierTauri) {
  return {
    isFile: () => info.isFile,
    isDirectory: () => info.isDirectory,
    isSymbolicLink: () => info.isSymlink,
    size: info.size,
    mtimeMs: info.mtime ? info.mtime.getTime() : 0,
    ctimeMs: info.mtime ? info.mtime.getTime() : 0,
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
        return entrees.map((e) => e.name ?? "");
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
      try {
        return versStatNode(await tauriLstat(chemin));
      } catch (err) {
        throw erreurFS(err, chemin);
      }
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
