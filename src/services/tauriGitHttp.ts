// Client HTTP pour isomorphic-git qui passe par le plugin natif Tauri
// au lieu de isomorphic-git/http/web (qui utilise le fetch du navigateur,
// donc bloqué par CORS sur les endpoints Git de github.com — GitHub ne
// renvoie pas d'en-têtes CORS sur info/refs, git-upload-pack, etc.).
//
// Implémente l'interface HttpClient attendue par isomorphic-git :
// https://isomorphic-git.org/docs/en/http
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

interface RequeteGit {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: Iterable<Uint8Array> | AsyncIterable<Uint8Array>;
}

async function concatenerCorps(
  body?: Iterable<Uint8Array> | AsyncIterable<Uint8Array>
): Promise<Uint8Array | undefined> {
  if (!body) return undefined;
  const morceaux: Uint8Array[] = [];
  for await (const chunk of body) morceaux.push(chunk);
  const taille = morceaux.reduce((n, c) => n + c.length, 0);
  const resultat = new Uint8Array(taille);
  let offset = 0;
  for (const chunk of morceaux) {
    resultat.set(chunk, offset);
    offset += chunk.length;
  }
  return resultat;
}

async function* itererCorps(buffer: Uint8Array): AsyncIterableIterator<Uint8Array> {
  yield buffer;
}

export const tauriGitHttp = {
  async request({ url, method = "GET", headers = {}, body }: RequeteGit) {
    const corps = await concatenerCorps(body);
    const requeteHeaders: Record<string, string> = {
      ...headers,
    };
    if (!requeteHeaders["User-Agent"] && !requeteHeaders["user-agent"]) {
      requeteHeaders["User-Agent"] = "GitHub-Simplifie/1.0";
    }

    const res = await tauriFetch(url, {
      method,
      headers: requeteHeaders,
      body: corps as BodyInit | undefined,
    });

    const buffer = new Uint8Array(await res.arrayBuffer());
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      url: res.url,
      method,
      headers: responseHeaders,
      body: itererCorps(buffer),
      statusCode: res.status,
      statusMessage: res.statusText,
    };
  },
};

export function creerHttpGitHub(token: string) {
  const accessToken = token.trim();
  if (!accessToken) {
    throw new Error("Connecte-toi à GitHub avant d’effectuer cette opération.");
  }

  // GitHub may return 403 for an unauthenticated private-repository request,
  // before isomorphic-git's onAuth callback can provide credentials.
  const authorization = `Basic ${btoa(`x-access-token:${accessToken}`)}`;

  return {
    request(request: RequeteGit) {
      const parsedUrl = new URL(request.url);
      if (parsedUrl.protocol !== "https:" || parsedUrl.hostname.toLowerCase() !== "github.com") {
        throw new Error("L’authentification Git est limitée aux requêtes HTTPS vers github.com.");
      }

      const headers = { ...request.headers };
      const hasAuthorization = Object.keys(headers).some(
        (name) => name.toLowerCase() === "authorization"
      );
      if (!hasAuthorization) headers.Authorization = authorization;

      return tauriGitHttp.request({ ...request, headers });
    },
  };
}
