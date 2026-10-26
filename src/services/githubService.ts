import { Octokit } from "@octokit/rest";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { DepotGitHub } from "../types";

interface OptionsCreationDepot {
  nom: string;
  prive?: boolean;
  description?: string;
}

function creerClientGitHub(token: string) {
  const accessToken = token.trim();
  if (!accessToken) {
    throw new Error("Connecte-toi à GitHub avant cette opération.");
  }
  return new Octokit({
    auth: accessToken,
    userAgent: "GitHub-Simplifie/1.0",
    request: {
      fetch: (url: string, opts?: RequestInit) => {
        const headers = new Headers(opts?.headers);
        if (!headers.has("User-Agent") && !headers.has("user-agent")) {
          headers.set("User-Agent", "GitHub-Simplifie/1.0");
        }
        return tauriFetch(url, { ...opts, headers });
      },
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "GitHub-Simplifie/1.0",
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
        `GitHub n’a pas créé le dépôt « ${nom} ». Vérifie son nom et qu’un dépôt portant ce nom n’existe pas déjà.`
      );
    }
    throw err;
  }
}

export async function listerDepots(token: string): Promise<DepotGitHub[]> {
  const octokit = creerClientGitHub(token);
  const repositories = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
    sort: "updated",
    per_page: 100,
  });
  return repositories.map((repository) => ({
    nom: repository.name,
    cheminComplet: `${repository.owner?.login ?? ""}/${repository.name}`,
    url: repository.clone_url ?? "",
    prive: repository.private ?? false,
  }));
}
