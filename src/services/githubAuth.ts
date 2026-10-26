// Requêtes HTTP via le plugin natif Tauri, PAS le fetch du navigateur.
// github.com ne renvoie pas d'en-têtes CORS permettant un fetch() classique
// depuis une origine tauri://localhost ou http://localhost:1420 — la requête
// serait bloquée par le navigateur/WebView avant même d'atteindre GitHub.
// Le plugin @tauri-apps/plugin-http fait la requête côté Rust (natif),
// donc il n'est pas soumis aux règles CORS du navigateur.
//
// Installation : `npm run tauri add http`
// Puis autoriser les domaines dans src-tauri/capabilities/default.json :
//   { "identifier": "http:default", "allow": [
//       { "url": "https://github.com/*" } ] }
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { DeviceCodeResponse } from "../types";

/**
 * OAuth Device Flow : l'utilisateur voit "Va sur github.com/login/device
 * et entre le code ABCD-1234", il n'a jamais besoin de créer ou copier
 * un token manuellement. À enregistrer d'abord comme "GitHub App" ou
 * "OAuth App" côté GitHub (scope minimal : "repo").
 */

const CLIENT_ID = "Ov23liDVMdqbQFzWBLBZ"; // OAuth App créée sur github.com/settings/developers
const HTTP_TIMEOUT_MS = 30_000;
const CONNECT_TIMEOUT_MS = 15_000;

function requeteAvecDelai(): { connectTimeout: number; signal: AbortSignal } {
  return {
    connectTimeout: CONNECT_TIMEOUT_MS,
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  };
}

interface AccessTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export async function demarrerConnexion(): Promise<DeviceCodeResponse> {
  const res = await tauriFetch("https://github.com/login/device/code", {
    ...requeteAvecDelai(),
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "GitHub-Simplifie/1.0",
    },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: "repo" }),
  });

  if (!res.ok) {
    throw new Error(
      `GitHub a refusé la demande (HTTP ${res.status}). Vérifie que CLIENT_ID ` +
        `dans githubAuth.ts correspond à une OAuth App existante avec le Device Flow activé.`
    );
  }

  const data: DeviceCodeResponse = await res.json();
  if (!data.device_code || !data.user_code) {
    throw new Error("Réponse GitHub inattendue : device_code ou user_code manquant.");
  }
  // data.user_code -> à afficher gros à l'écran
  // data.verification_uri -> lien cliquable ("Ouvrir GitHub")
  // data.device_code + data.interval -> pour le polling ci-dessous
  return data;
}

export async function attendreValidation(
  deviceCode: string,
  interval: number = 5,
  expiresIn: number = 900 // GitHub renvoie généralement 900s (15 min) de validité
): Promise<string> {
  const dateLimite = Date.now() + expiresIn * 1000;
  let intervalleActuel = interval;

  while (Date.now() < dateLimite) {
    await new Promise((r) => setTimeout(r, intervalleActuel * 1000));
    const res = await tauriFetch("https://github.com/login/oauth/access_token", {
      ...requeteAvecDelai(),
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "GitHub-Simplifie/1.0",
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
    const data: AccessTokenResponse = await res.json();
    if (data.access_token) return data.access_token;
    if (data.error === "slow_down") {
      intervalleActuel += 5; // GitHub demande d'espacer davantage le polling
      continue;
    }
    if (data.error && data.error !== "authorization_pending") {
      throw new Error(data.error_description || data.error);
    }
    // sinon on continue à attendre que l'utilisateur valide sur github.com
  }

  throw new Error("Le code de connexion a expiré, réessaie.");
}
