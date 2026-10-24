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

export const tauriGitHttp = {
  async request({ url, method = "GET", headers = {}, body }: RequeteGit) {
    const corps = await concatenerCorps(body);
    const res = await tauriFetch(url, {
      method,
      headers,
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
      body: [buffer], // isomorphic-git accepte un tableau comme itérable simple
      statusCode: res.status,
      statusMessage: res.statusText,
    };
  },
};
