import git from "isomorphic-git";
import { join } from "@tauri-apps/api/path";
import { tauriGitHttp as http } from "./tauriGitHttp";
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

export interface DivergenceDepot {
  ahead: number;
  behind: number;
  truncated: boolean;
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

async function obtenirStatutsFichiers(dir: string): Promise<[string, StatutFichierGit][]> {
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

export async function initialiserDepot(dir: string): Promise<void> {
  await git.init({ fs, dir, defaultBranch: "main" });
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

export async function obtenirDivergenceDepot(dir: string, token: string): Promise<DivergenceDepot> {
  if (!token.trim()) throw new Error("Connecte-toi à GitHub pour vérifier la synchronisation.");
  const branch = await obtenirBrancheCourante(dir);
  const remoteUrl = await obtenirUrlDistante(dir);
  if (!remoteUrl || !validateGitHubRemote(remoteUrl)) {
    throw new Error("Associe un dépôt distant HTTPS GitHub valide avant de vérifier la synchronisation.");
  }

  await git.fetch({
    fs,
    http,
    dir,
    remote: "origin",
    ref: branch,
    singleBranch: true,
    onAuth: () => ({ username: token }),
  });

  const remoteRef = `refs/remotes/origin/${branch}`;
  const [localOid, remoteOid] = await Promise.all([
    git.resolveRef({ fs, dir, ref: `refs/heads/${branch}` }),
    git.resolveRef({ fs, dir, ref: remoteRef }),
  ]);
  if (localOid === remoteOid) return { ahead: 0, behind: 0, truncated: false };

  const mergeBases = await git.findMergeBase({ fs, dir, oids: [localOid, remoteOid] });
  const mergeBase = mergeBases[0];
  if (typeof mergeBase !== "string" || !mergeBase) {
    return { ahead: 0, behind: 0, truncated: false };
  }

  const [localHistory, remoteHistory] = await Promise.all([
    git.log({ fs, dir, ref: localOid, depth: 1000 }),
    git.log({ fs, dir, ref: remoteOid, depth: 1000 }),
  ]);
  const localBaseIndex = localHistory.findIndex(({ oid }) => oid === mergeBase);
  const remoteBaseIndex = remoteHistory.findIndex(({ oid }) => oid === mergeBase);
  return {
    ahead: localBaseIndex < 0 ? localHistory.length : localBaseIndex,
    behind: remoteBaseIndex < 0 ? remoteHistory.length : remoteBaseIndex,
    truncated: localBaseIndex < 0 || remoteBaseIndex < 0,
  };
}

export async function obtenirFichiersSensiblesSuivis(dir: string): Promise<string[]> {
  return (await git.listFiles({ fs, dir })).filter(isSensitivePath);
}

export async function obtenirFichiersSensiblesAffectes(dir: string): Promise<string[]> {
  const [tracked, filesOnDisk] = await Promise.all([
    git.listFiles({ fs, dir }),
    listerCheminsRelatifs(dir),
  ]);
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

async function ajouterTousLesFichiers(dir: string): Promise<void> {
  await verifierAucunFichierSensible(dir);
  if (!(await contientCommit(dir))) {
    const files = await listerCheminsRelatifs(dir);
    for (const filepath of files) {
      if (isSensitivePath(filepath) || estCheminGenere(filepath)) continue;
      await git.add({ fs, dir, filepath });
    }
    return;
  }
  const statuses = await obtenirStatutsFichiers(dir);
  for (const [filepath, status] of statuses) {
    if (status === "*deleted" || status === "deleted") {
      await git.remove({ fs, dir, filepath });
    } else if (status !== "ignored" && status !== "absent") {
      await git.add({ fs, dir, filepath });
    }
  }
}

export async function ajouterEtCommiter(
  dir: string,
  message = "Mise à jour du projet",
  author?: { name: string; email: string }
): Promise<void> {
  if (!message.trim()) {
    throw new Error("Le message du commit ne peut pas être vide.");
  }
  await preparerGitignore(dir, "");
  await verifierAucunFichierSensible(dir);
  await ajouterTousLesFichiers(dir);
  await verifierAucunFichierSensible(dir);
  await git.commit({
    fs,
    dir,
    message,
    author: author ?? { name: "GitHub Simplifié", email: "github-simplifie@users.noreply.github.com" },
  });
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

  await git.push({
    fs,
    http,
    dir,
    remote: "origin",
    ref: await obtenirBrancheCourante(dir),
    onAuth: () => ({ username: token }),
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
  await recupererMisesAJour({ dir, token, onProgress });
  await publier({ dir, token, onProgress });
}

export async function recupererMisesAJour({
  dir,
  token,
  onProgress,
}: OperationDistante): Promise<void> {
  if (!token.trim()) throw new Error("Connecte-toi à GitHub avant de synchroniser.");
  const branch = await obtenirBrancheCourante(dir);
  const remoteUrl = await obtenirUrlDistante(dir);
  if (!remoteUrl || !validateGitHubRemote(remoteUrl)) {
    throw new Error("Associe un dépôt distant HTTPS GitHub valide avant de synchroniser.");
  }
  await verifierAucunFichierSensible(dir);
  const statuses = await obtenirStatutsFichiers(dir);
  const changed = statuses.filter(([, status]) =>
    !["unmodified", "ignored", "absent"].includes(status)
  );
  if (changed.length > 0) {
    throw new Error("Des modifications locales ne sont pas enregistrées. Enregistre-les avant la synchronisation.");
  }

  await git.pull({
    fs,
    http,
    dir,
    ref: branch,
    remote: "origin",
    singleBranch: true,
    fastForwardOnly: true,
    onAuth: () => ({ username: token }),
    onProgress: (evt) => onProgress?.(evt as ProgressionGit),
  });
}

export async function recuperer({
  dir,
  remoteUrl,
  token,
  onProgress,
}: OperationDistante): Promise<void> {
  if (!token.trim()) throw new Error("Connecte-toi à GitHub avant de cloner.");
  if (!validateGitHubRemote(remoteUrl ?? "")) {
    throw new Error("L’URL du dépôt à cloner doit être une URL HTTPS GitHub valide.");
  }
  await fs.promises.mkdir(dir);
  const entries = await fs.promises.readdir(dir);
  if (entries.length > 0) {
    throw new Error("Le dossier de destination n’est pas vide. Choisis un nouveau sous-dossier.");
  }
  await git.clone({
    fs,
    http,
    dir,
    url: remoteUrl ?? "",
    onAuth: () => ({ username: token }),
    onProgress: (evt) => onProgress?.(evt as ProgressionGit),
  });
}
