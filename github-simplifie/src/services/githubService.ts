import { Octokit } from "@octokit/rest";
import type { DepotGitHub } from "../types";

interface OptionsCreationDepot {
  nom: string;
  prive?: boolean;
  description?: string;
}

export async function obtenirUtilisateurConnecte(token: string): Promise<string> {
  const octokit = new Octokit({ auth: token });
  const { data } = await octokit.users.getAuthenticated();
  return data.login;
}

/**
 * Crée le dépôt s'il n'existe pas encore. S'il existe déjà (l'utilisateur
 * reclique "Créer"/"Publier" sur un projet déjà publié une première fois),
 * on récupère simplement ses infos au lieu d'échouer avec une erreur 422.
 */
export async function creerOuRecupererDepot(
  token: string,
  { nom, prive = true, description = "" }: OptionsCreationDepot
) {
  const octokit = new Octokit({ auth: token });
  try {
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name: nom,
      private: prive,
      description,
      auto_init: false,
    });
    return data; // data.clone_url utile pour gitService.publier
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 422) {
      const login = await obtenirUtilisateurConnecte(token);
      const { data } = await octokit.repos.get({ owner: login, repo: nom });
      return data;
    }
    throw err;
  }
}

export async function listerDepots(token: string): Promise<DepotGitHub[]> {
  const octokit = new Octokit({ auth: token });
  const { data } = await octokit.repos.listForAuthenticatedUser({ sort: "updated" });
  return data.map((r) => ({ nom: r.name, url: r.clone_url ?? "", prive: r.private ?? false }));
}
