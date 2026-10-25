import git from "isomorphic-git";
import { dirname, join } from "@tauri-apps/api/path";
import { creerHttpGitHub, tauriGitHttp } from "./tauriGitHttp";
import { estLienSymbolique, tauriFsBridge as fs } from "./tauriFsBridge";
import { isSensitivePath } from "./projectAnalyzer";
import { listerCheminsRelatifs } from "./fileSystemUtils";
import type { ProgressionGit } from "../types";

interface OperationDistante {
  dir: string;
  remoteUrl?: string;
  token: string;
  onProgress?: (evt: ProgressionGit) => void;
}

export interface EtatDepot {
  branch: string;
  remoteUrl: string | null;
  changedFiles: number;
  recentCommits: { oid: string; message: string; timestamp: number }[];
}

/**
 * Retourne les paramètres d'authentification GitHub corrects pour isomorphic-git.
 * GitHub Git HTTP requiert le token dans le champ password (avec username="x-access-token").
 * Sans ça, calculateBasicAuthHeader produit `Basic base64("<token>:")` — invalide → 403.
 * L'en-tête User-Agent est obligatoire : GitHub WAF bloque sans lui avec HTTP 403.
 */
function authGitHub(token: string) {
  const t = token.trim();
  return {
    username: "x-access-token",
    password: t,
    headers: {
      "User-Agent": "GitHub-Simplifie/1.0",
    },
  };
}

const DOSSIERS_GENERES = new Set([
  "node_modules", "dist", "target", "build", ".next", ".cache", "coverage",
  ".venv", "venv", "vendor", ".godot", ".tox", ".mypy_cache", ".ruff_cache", ".pytest_cache",
]);

function estCheminGenere(filepath: string): boolean {
  return filepath.split("/").some((segment) => DOSSIERS_GENERES.has(segment));
}

function filtreFichiersDuProjet(dir: string, filepath: string): boolean {
  return !estCheminGenere(filepath) && !estLienSymbolique(dir, filepath);
}

type StatutFichierGit = Awaited<ReturnType<typeof git.status>>;

async function obtenirStatutsFichiers(
  dir: string,
  onProgress?: (evt: ProgressionGit) => void
): Promise<[string, StatutFichierGit][]> {
  const [tracked, filesOnDisk] = await Promise.all([
    git.listFiles({ fs, dir }),
    listerCheminsRelatifs(dir),
  ]);
  const candidates = [...new Set([...tracked, ...filesOnDisk])]
    .filter((filepath) => filtreFichiersDuProjet(dir, filepath));
  const statuses: [string, StatutFichierGit][] = [];
  const parallelisme = 12;

  for (let index = 0; index < candidates.length; index += parallelisme) {
    const batch = candidates.slice(index, index + parallelisme);
    statuses.push(
      ...(await Promise.all(
        batch.map(async (filepath) => [
          filepath,
          await git.status({ fs, dir, filepath }),
        ] as [string, StatutFichierGit])
      ))
    );
    onProgress?.({
      phase: "scan",
      loaded: Math.min(index + batch.length, candidates.length),
      total: candidates.length,
    });
  }

  return statuses;
}

async function contientCommit(dir: string): Promise<boolean> {
  try {
    await git.resolveRef({ fs, dir, ref: "HEAD" });
    return true;
  } catch (error) {
    if (error instanceof Error && /could not find.*head|unborn|no commits|head.*not found/i.test(error.message)) {
      return false;
    }
    throw error;
  }
}

async function garantirIdentiteGit(
  dir: string,
  identity?: { name: string; email: string }
): Promise<{ name: string; email: string }> {
  const configuredName = await git.getConfig({ fs, dir, path: "user.name" });
  const configuredEmail = await git.getConfig({ fs, dir, path: "user.email" });
  const name = identity?.name.trim() || (typeof configuredName === "string" ? configuredName.trim() : "") || "GitHub Simplifié";
  const email = identity?.email.trim() || (typeof configuredEmail === "string" ? configuredEmail.trim() : "") || "github-simplifie@users.noreply.github.com";

  await Promise.all([
    git.setConfig({ fs, dir, path: "user.name", value: name }),
    git.setConfig({ fs, dir, path: "user.email", value: email }),
  ]);
  return { name, email };
}

export async function initialiserDepot(dir: string): Promise<void> {
  await git.init({ fs, dir, defaultBranch: "main" });
  await garantirIdentiteGit(dir);
}

export async function obtenirBrancheCourante(dir: string): Promise<string> {
  return (await git.currentBranch({ fs, dir, fullname: false })) || "main";
}

export async function obtenirUrlDistante(dir: string): Promise<string | null> {
  const url = await git.getConfig({ fs, dir, path: "remote.origin.url" });
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

export async function associerDepotDistant(
  dir: string,
  remoteUrl: string,
  options: { remplacerRemote?: boolean } = {}
): Promise<void> {
  const normalizedUrl = validateGitHubRemote(remoteUrl);
  if (!normalizedUrl) {
    throw new Error("Utilise une URL HTTPS valide de dépôt GitHub.");
  }

  const existing = await obtenirUrlDistante(dir);
  if (existing) {
    if (normalizeRemote(existing) === normalizeRemote(normalizedUrl)) return;
    if (!options.remplacerRemote) {
      throw new Error(
        "Un dépôt distant est déjà associé. Confirme explicitement son remplacement avant de continuer."
      );
    }
    await git.setConfig({ fs, dir, path: "remote.origin.url", value: normalizedUrl });
    return;
  }
  await git.addRemote({ fs, dir, remote: "origin", url: normalizedUrl });
}

function validateGitHubRemote(remoteUrl: string): string | null {
  try {
    const url = new URL(remoteUrl.trim());
    const segments = url.pathname.split("/").filter(Boolean);
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== "github.com" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      segments.length !== 2
    ) {
      return null;
    }
    const [owner, rawRepository] = segments;
    const repository = rawRepository.replace(/\.git$/i, "");
    if (
      !/^[\w.-]+$/.test(owner) ||
      !/^[\w.-]+$/.test(repository) ||
      owner === "." ||
      owner === ".." ||
      repository === "." ||
      repository === ".."
    ) {
      return null;
    }
    return `https://github.com/${owner}/${repository}${/\.git$/i.test(rawRepository) ? ".git" : ""}`;
  } catch {
    return null;
  }
}

export async function obtenirEtatDepot(dir: string): Promise<EtatDepot> {
  const [branch, remoteUrl, hasCommit] = await Promise.all([
    obtenirBrancheCourante(dir),
    obtenirUrlDistante(dir),
    contientCommit(dir),
  ]);
  const [statuses, commits, filesWithoutCommit] = await Promise.all([
    hasCommit ? obtenirStatutsFichiers(dir) : Promise.resolve([]),
    hasCommit ? git.log({ fs, dir, depth: 5 }) : Promise.resolve([]),
    hasCommit ? Promise.resolve([]) : listerCheminsRelatifs(dir),
  ]);

  return {
    branch,
    remoteUrl,
    changedFiles: hasCommit
      ? statuses.filter(([, status]) => !["unmodified", "ignored", "absent"].includes(status)).length
      : filesWithoutCommit.length,
    recentCommits: commits.map(({ oid, commit }) => ({
      oid: oid.slice(0, 7),
      message: commit.message.split("\n", 1)[0],
      timestamp: commit.author.timestamp,
    })),
  };
}

export async function obtenirFichiersSensiblesSuivis(dir: string): Promise<string[]> {
  return (await git.listFiles({ fs, dir })).filter(isSensitivePath);
}

export async function obtenirFichiersSensiblesAffectes(dir: string): Promise<string[]> {
  const filesOnDisk = await listerCheminsRelatifs(dir);
  let hasGitMetadata = true;
  try {
    await fs.promises.stat(await join(dir, ".git"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      hasGitMetadata = false;
    } else {
      throw error;
    }
  }
  const tracked = hasGitMetadata ? await git.listFiles({ fs, dir }) : [];
  return [...new Set([...tracked, ...filesOnDisk].filter(isSensitivePath))];
}

async function verifierAucunFichierSensible(dir: string): Promise<void> {
  const files = await obtenirFichiersSensiblesAffectes(dir);
  if (files.length > 0) {
    throw new Error(
      `Opération bloquée : des fichiers potentiellement sensibles sont suivis, modifiés ou prêts à être ajoutés : ${files.join(", ")}. Retire-les de l’index et vérifie leur historique avant de publier.`
    );
  }
}

export async function ignorerFichierSensible(dir: string, filepath: string): Promise<void> {
  const segments = filepath.replace(/\\/g, "/").split("/");
  if (
    !filepath ||
    filepath.startsWith("/") ||
    /^[a-z]:/i.test(filepath) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Chemin de fichier invalide.");
  }
  const lines = new Set([
    ...await lireGitignore(dir),
    `/${filepath.replace(/\\/g, "/")}`,
  ]);
  await fs.promises.writeFile(await join(dir, ".gitignore"), `${[...lines].join("\n")}\n`);

  if (!(await contientCommit(dir))) {
    if ((await git.listFiles({ fs, dir })).includes(filepath)) {
      await git.remove({ fs, dir, filepath });
    }
    return;
  }
  const status = await git.status({ fs, dir, filepath });
  if (!["absent", "ignored", "unmodified", "*deleted", "deleted"].includes(status)) {
    await git.remove({ fs, dir, filepath });
  }
}

async function lireGitignore(dir: string): Promise<string[]> {
  try {
    const contents = await fs.promises.readFile(await join(dir, ".gitignore"), { encoding: "utf8" });
    return String(contents).split(/\r?\n/).filter(Boolean);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function ajouterTousLesFichiers(
  dir: string,
  onProgress?: (evt: ProgressionGit) => void
): Promise<void> {
  await verifierAucunFichierSensible(dir);
  if (!(await contientCommit(dir))) {
    const files = await listerCheminsRelatifs(dir);
    for (let index = 0; index < files.length; index += 1) {
      const filepath = files[index];
      if (!isSensitivePath(filepath) && !estCheminGenere(filepath)) {
        await git.add({ fs, dir, filepath });
      }
      onProgress?.({ phase: "add", loaded: index + 1, total: files.length });
    }
    return;
  }
  const statuses = await obtenirStatutsFichiers(dir, onProgress);
  for (let index = 0; index < statuses.length; index += 1) {
    const [filepath, status] = statuses[index];
    if (status === "*deleted" || status === "deleted") {
      await git.remove({ fs, dir, filepath });
    } else if (status !== "ignored" && status !== "absent") {
      await git.add({ fs, dir, filepath });
    }
    onProgress?.({ phase: "add", loaded: index + 1, total: statuses.length });
  }
}

export async function ajouterEtCommiter(
  dir: string,
  message = "Mise à jour du projet",
  author?: { name: string; email: string },
  onProgress?: (evt: ProgressionGit) => void
): Promise<void> {
  if (!message.trim()) {
    throw new Error("Le message du commit ne peut pas être vide.");
  }
  const identity = await garantirIdentiteGit(dir, author);
  await preparerGitignore(dir, "");
  await verifierAucunFichierSensible(dir);
  await ajouterTousLesFichiers(dir, onProgress);
  await verifierAucunFichierSensible(dir);
  onProgress?.({ phase: "commit", loaded: 0, total: 1 });
  await git.commit({
    fs,
    dir,
    message,
    author: identity,
    committer: identity,
  });
  onProgress?.({ phase: "commit", loaded: 1, total: 1 });
}

export async function preparerGitignore(
  dir: string,
  ignoreSuggere: string
): Promise<void> {
  const lines = new Set([
    ...await lireGitignore(dir),
    "node_modules/",
    "dist/",
    "target/",
    "build/",
    ".next/",
    ".cache/",
    "coverage/",
    ".venv/",
    "venv/",
    ".godot/",
    ".env",
    ".env.*",
    "!.env.example",
    "!.env.sample",
    ".DS_Store",
    "*.log",
    ...ignoreSuggere.split(/\r?\n/).filter(Boolean),
  ]);
  await fs.promises.writeFile(await join(dir, ".gitignore"), `${[...lines].join("\n")}\n`);
}

export async function publier({
  dir,
  remoteUrl,
  token,
  onProgress,
}: OperationDistante): Promise<void> {
  if (!token.trim()) throw new Error("Connecte-toi à GitHub avant de publier.");
  const http = creerHttpGitHub(token);
  await verifierAucunFichierSensible(dir);
  const configuredRemote = await obtenirUrlDistante(dir);
  if (!configuredRemote) {
    throw new Error("Aucun dépôt distant n’est associé à ce projet.");
  }
  if (!validateGitHubRemote(configuredRemote)) {
    throw new Error("Le dépôt distant configuré n’est pas une URL HTTPS GitHub valide.");
  }
  if (remoteUrl && normalizeRemote(remoteUrl) !== normalizeRemote(configuredRemote)) {
    throw new Error("Le dépôt distant associé a changé. Vérifie l’association avant de publier.");
  }

  const branch = await obtenirBrancheCourante(dir);
  await git.push({
    fs,
    http,
    dir,
    remote: "origin",
    ref: `refs/heads/${branch}`,
    remoteRef: `refs/heads/${branch}`,
    onAuth: () => authGitHub(token),
    headers: { "User-Agent": "GitHub-Simplifie/1.0" },
    onProgress: (evt) => onProgress?.(evt as ProgressionGit),
  });
}

function normalizeRemote(url: string): string {
  return url.replace(/\.git\/?$/i, "").replace(/\/+$/, "").toLowerCase();
}

export async function mettreAJour({
  dir,
  token,
  onProgress,
}: OperationDistante): Promise<void> {
  try {
    await recupererMisesAJour({ dir, token, onProgress });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "EMPTY_REMOTE" || /ref\.length|null is not an object|cannot read properties of null/i.test(msg)) {
      // Le dépôt distant est neuf ou vide : rien à récupérer, on publie directement les fichiers locaux
    } else {
      throw error;
    }
  }
  await publier({ dir, token, onProgress });
}

export async function recupererMisesAJour({
  dir,
  token,
  onProgress,
}: OperationDistante): Promise<void> {
  if (!token.trim()) throw new Error("Connecte-toi à GitHub avant de synchroniser.");
  const http = creerHttpGitHub(token);
  const branch = await obtenirBrancheCourante(dir);
  const remoteUrl = await obtenirUrlDistante(dir);
  if (!remoteUrl || !validateGitHubRemote(remoteUrl)) {
    throw new Error("Associe un dépôt distant HTTPS GitHub valide avant de synchroniser.");
  }
  const identity = await garantirIdentiteGit(dir);
  await verifierAucunFichierSensible(dir);
  const statuses = await obtenirStatutsFichiers(dir);
  const changed = statuses.filter(([, status]) =>
    !["unmodified", "ignored", "absent"].includes(status)
  );
  if (changed.length > 0) {
    throw new Error("Des modifications locales ne sont pas enregistrées. Enregistre-les avant la synchronisation.");
  }

  // Vérifier si le serveur distant possède des commits/références
  const serverRefs = await git.listServerRefs({
    http,
    url: remoteUrl,
    onAuth: () => authGitHub(token),
    headers: { "User-Agent": "GitHub-Simplifie/1.0" },
  });

  if (serverRefs.length === 0) {
    throw new Error("EMPTY_REMOTE");
  }

  try {
    await git.pull({
      fs,
      http,
      dir,
      ref: branch,
      remoteRef: `refs/heads/${branch}`,
      remote: "origin",
      singleBranch: true,
      fastForwardOnly: true,
      author: identity,
      committer: identity,
      onAuth: () => authGitHub(token),
      headers: { "User-Agent": "GitHub-Simplifie/1.0" },
      onProgress: (evt) => onProgress?.(evt as ProgressionGit),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/ref\.length|null is not an object|cannot read properties of null/i.test(msg)) {
      throw new Error("EMPTY_REMOTE");
    }
    throw err;
  }
}

export async function recuperer({
  dir,
  remoteUrl,
  token,
  onProgress,
}: OperationDistante): Promise<void> {
  const accessToken = token.trim();
  const http = accessToken ? creerHttpGitHub(accessToken) : tauriGitHttp;
  const normalizedRemoteUrl = validateGitHubRemote(remoteUrl ?? "");
  if (!normalizedRemoteUrl) {
    throw new Error("L’URL du dépôt à cloner doit être une URL HTTPS GitHub valide.");
  }
  try {
    await fs.promises.stat(dir);
    throw new Error("Le dossier de destination existe déjà. Choisis un nouveau nom ou dossier parent.");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  const stagingDir = await join(await dirname(dir), `.gsimplifie-clone-${crypto.randomUUID()}`);
  await fs.promises.mkdir(stagingDir);
  try {
    await git.clone({
      fs,
      http,
      dir: stagingDir,
      url: normalizedRemoteUrl,
      ...(accessToken ? { onAuth: () => authGitHub(accessToken) } : {}),
      headers: { "User-Agent": "GitHub-Simplifie/1.0" },
      onProgress: (evt) => onProgress?.(evt as ProgressionGit),
    });
    await fs.promises.rename(stagingDir, dir);
  } catch (error) {
    try {
      await fs.promises.rmdir(stagingDir);
    } catch (cleanupError) {
      const message = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}. Le nettoyage du dossier temporaire a également échoué : ${message}`
      );
    }
    throw error;
  }
}
