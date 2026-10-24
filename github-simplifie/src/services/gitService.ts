import git from "isomorphic-git";
import { tauriGitHttp as http } from "./tauriGitHttp";
import { tauriFsBridge as fs } from "./tauriFsBridge";
import type { ProgressionGit } from "../types";

interface OperationDistante {
  dir: string;
  remoteUrl: string;
  token: string;
  onProgress?: (evt: ProgressionGit) => void;
}

/**
 * Chaque fonction correspond à une action que l'utilisateur choisit
 * dans l'écran "que voulez-vous faire ?". Aucune commande n'est
 * exposée : l'utilisateur ne voit que des boutons et une progression.
 *
 * `dir` est désormais un vrai chemin disque (fourni par l'event natif
 * Tauri onDragDropEvent, ou choisi via le sélecteur de dossier pour
 * "récupérer") — plus un dossier virtuel en mémoire.
 */

export async function initialiserDepot(dir: string): Promise<void> {
  await git.init({ fs, dir, defaultBranch: "main" });
}

/**
 * Équivalent de `git add -A` : isomorphic-git n'accepte pas filepath: "."
 * comme raccourci pour "tout le dossier" (contrairement au CLI git).
 * On doit lister l'état de chaque fichier via statusMatrix et
 * ajouter/retirer individuellement selon qu'il est présent ou supprimé.
 */
async function ajouterTousLesFichiers(dir: string): Promise<void> {
  const matrix = await git.statusMatrix({ fs, dir });
  await Promise.all(
    matrix.map(([filepath, , workdirStatus]) => {
      return workdirStatus === 0
        ? git.remove({ fs, dir, filepath })
        : git.add({ fs, dir, filepath });
    })
  );
}

export async function ajouterEtCommiter(
  dir: string,
  message: string = "Premier envoi"
): Promise<void> {
  await ajouterTousLesFichiers(dir);
  await git.commit({
    fs,
    dir,
    message,
    author: { name: "Utilisateur", email: "utilisateur@local" },
  });
}

export async function publier({
  dir,
  remoteUrl,
  token,
  onProgress,
}: OperationDistante): Promise<void> {
  await git
    .addRemote({ fs, dir, remote: "origin", url: remoteUrl, force: true })
    .catch(() => {});
  await git.push({
    fs,
    http,
    dir,
    remote: "origin",
    ref: "main",
    onAuth: () => ({ username: token }),
    onProgress: (evt) => onProgress?.(evt as ProgressionGit),
  });
}

export async function mettreAJour({
  dir,
  remoteUrl,
  token,
  onProgress,
}: OperationDistante): Promise<void> {
  await git.pull({
    fs,
    http,
    dir,
    ref: "main",
    singleBranch: true,
    author: { name: "Utilisateur", email: "utilisateur@local" },
    onAuth: () => ({ username: token }),
    onProgress: (evt) => onProgress?.(evt as ProgressionGit),
  });
  await ajouterEtCommiter(dir, "Mise à jour");
  await publier({ dir, remoteUrl, token, onProgress });
}

export async function recuperer({
  dir,
  remoteUrl,
  token,
  onProgress,
}: OperationDistante): Promise<void> {
  await git.clone({
    fs,
    http,
    dir,
    url: remoteUrl,
    onAuth: () => ({ username: token }),
    onProgress: (evt) => onProgress?.(evt as ProgressionGit),
  });
}
