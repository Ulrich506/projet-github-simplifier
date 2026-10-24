import { Octokit } from "@octokit/rest";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { DepotGitHub } from "../types";

interface OptionsCreationDepot {
  nom: string;
  prive?: boolean;
  description?: string;
}

function creerClientGitHub(token: string) {
  return new Octokit({
    auth: token,
    request: {
      fetch: tauriFetch,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  });
}

export async function obtenirUtilisateurConnecte(token: string): Promise<string> {
  const octokit = creerClientGitHub(token);
  const { data } = await octokit.users.getAuthenticated();
  return data.login;
}

export async function verifierPublication(
  token: string,
  proprietaire: string,
  nomDepot: string,
  branche: string
): Promise<void> {
  const octokit = creerClientGitHub(token);
  const { data } = await octokit.repos.getBranch({
    owner: proprietaire,
    repo: nomDepot,
    branch: branche,
  });
  if (!data.commit?.sha) {
    throw new Error("GitHub n'a pas confirmé le commit envoyé.");
  }
}

/** Crée un nouveau dépôt. Un dépôt existant doit être associé explicitement. */
export async function creerOuRecupererDepot(
  token: string,
  { nom, prive = true, description = "" }: OptionsCreationDepot
) {
  const octokit = creerClientGitHub(token);

  const login = await obtenirUtilisateurConnecte(token);
  try {
    await octokit.repos.get({ owner: login, repo: nom });
    throw new Error(
      `Le dépôt « ${nom} » existe déjà. Associe-le explicitement à l’étape « Sélection & association » au lieu de créer un dépôt.`
    );
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status !== 404) throw err;
  }

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
      throw new Error(
        `GitHub n’a pas créé le dépôt « ${nom} ». Vérifie son nom et qu’il n’existe pas déjà sous un autre propriétaire.`
      );
    }
    throw err;
  }
}

export async function listerDepots(token: string): Promise<DepotGitHub[]> {
  const octokit = creerClientGitHub(token);
  const { data } = await octokit.repos.listForAuthenticatedUser({ sort: "updated" });
  return data.map((r) => ({ nom: r.name, url: r.clone_url ?? "", prive: r.private ?? false }));
}
