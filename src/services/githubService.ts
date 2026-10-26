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
      fetch: (url: string, opts?: RequestInit) => fetchGitHub(url, opts),
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "GitHub-Simplifie/1.0",
      },
    },
  });
}

async function fetchGitHub(url: string, opts?: RequestInit): Promise<Response> {
  const method = (opts?.method ?? "GET").toUpperCase();
  const retrySafe = method === "GET" || method === "HEAD";
  const maxRetries = retrySafe ? 2 : 0;
  for (let attempt = 0; ; attempt += 1) {
    try {
      const headers = new Headers(opts?.headers);
      if (!headers.has("User-Agent") && !headers.has("user-agent")) {
        headers.set("User-Agent", "GitHub-Simplifie/1.0");
      }
      const response = await tauriFetch(url, {
        ...opts,
        headers,
        signal: opts?.signal ?? AbortSignal.timeout(30_000),
        connectTimeout: 15_000,
      });
      if (attempt >= maxRetries) return response;
      const remaining = response.headers.get("x-ratelimit-remaining");
      const reset = Number(response.headers.get("x-ratelimit-reset"));
      const rateLimited = response.status === 429 || (response.status === 403 && remaining === "0");
      const transient = rateLimited || response.status >= 500;
      if (!transient) return response;
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;
      const retryAfterDate = retryAfterHeader ? Date.parse(retryAfterHeader) : Number.NaN;
      const serverDelayMs = !rateLimited
        ? 0
        : Number.isFinite(retryAfterSeconds)
          ? retryAfterSeconds * 1000
          : Number.isFinite(retryAfterDate)
            ? retryAfterDate - Date.now()
            : Number.isFinite(reset) && reset > 0
              ? reset * 1000 - Date.now()
              : 0;
      if (serverDelayMs > 30_000) return response;
      const backoffMs = Math.min(10_000, 250 * 2 ** attempt + Math.floor(Math.random() * 250));
      await new Promise((resolve) => setTimeout(resolve, Math.max(backoffMs, serverDelayMs)));
    } catch (error) {
      if (!retrySafe || opts?.signal?.aborted || attempt >= maxRetries) throw error;
      const reason = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      if (!/network|fetch|connection|dns|resolve|timeout|timed out|econn|temporarily unavailable/i.test(reason)) {
        throw error;
      }
      const backoffMs = Math.min(10_000, 250 * 2 ** attempt + Math.floor(Math.random() * 250));
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}

function messageErreurGitHub(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const value = error as {
    message?: unknown;
    response?: { data?: { message?: unknown; errors?: unknown } };
  };
  const apiMessage = value.response?.data?.message;
  const apiErrors = value.response?.data?.errors;
  const details = typeof apiErrors === "string"
    ? apiErrors
    : Array.isArray(apiErrors)
      ? apiErrors.map((entry) => {
          if (!entry || typeof entry !== "object") return String(entry);
          const item = entry as Record<string, unknown>;
          return [item.resource, item.field, item.code, item.message].filter(Boolean).join(" ");
        }).join("; ")
      : "";
  return [apiMessage, details, value.message]
    .filter((part): part is string => typeof part === "string" && Boolean(part))
    .join(" — ");
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
    const detail = messageErreurGitHub(err);
    if (status === 422 && /name already exists|repository.*already exists|already[_ -]exists/i.test(detail)) {
      throw new Error(`REPOSITORY_ALREADY_EXISTS: ${detail}`);
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
