import type { AnalyseProjet, TypeProjet } from "../types";
import { yieldToUi } from "./fileSystemUtils";

/**
 * Analyse un dossier réel déposé par l'utilisateur pour :
 * - détecter le type de projet (Node, Python, Java, statique...)
 * - proposer un .gitignore adapté
 * - repérer les fichiers sensibles à ne PAS publier (clés, .env, secrets)
 * - vérifier si un dépôt git existe déjà dans le dossier
 *
 * Fonctionne uniquement sur les CHEMINS relatifs (pas le contenu) :
 * avec un accès disque réel, on n'a plus besoin de lire chaque fichier
 * juste pour savoir de quel type de projet il s'agit.
 */

interface Signature {
  type: TypeProjet;
  files: string[];
  gitignore: string;
}

const PROJECT_SIGNATURES: Signature[] = [
  { type: "node", files: ["package.json"], gitignore: "node_modules/\ndist/\n.env\n*.log" },
  { type: "python", files: ["requirements.txt", "pyproject.toml"], gitignore: "__pycache__/\n*.pyc\n.venv/\n.env" },
  { type: "java-maven", files: ["pom.xml"], gitignore: "target/\n*.class" },
  { type: "java-gradle", files: ["build.gradle", "build.gradle.kts"], gitignore: "build/\n.gradle/" },
  { type: "rust", files: ["Cargo.toml"], gitignore: "target/\nCargo.lock" },
  { type: "static", files: ["index.html"], gitignore: "" },
];

const SENSITIVE_PATTERNS: RegExp[] = [
  /^\.env(\..*)?$/i,
  /^\.?(?:npmrc|pypirc|netrc)$/i,
  /(?:^|[._-])secrets?(?:[._-]|$)/i,
  /(?:^|[._-])credentials?(?:[._-]|$)/i,
  /\.(?:pem|key|p12|pfx|keystore|jks|cer|crt)$/i,
  /(?:^|[._-])id_(?:rsa|ed25519|ecdsa)(?:[._-]|$)/i,
  /(?:^|[._-])(?:token|access_token|private_key)(?:[._-]|$)/i,
];

export function isSensitivePath(filepath: string): boolean {
  const normalized = filepath.replace(/\\/g, "/");
  const basename = normalized.split("/").pop() ?? normalized;
  if (/^\.env\.(?:example|sample|template)$/i.test(basename)) return false;
  return (
    normalized.split("/").some((segment) => segment === ".ssh" || segment === ".aws") ||
    SENSITIVE_PATTERNS.some((pattern) => pattern.test(basename))
  );
}

export async function analyzeProject(chemins: string[]): Promise<AnalyseProjet> {
  const hasExistingGit = chemins.includes(".git");
  const nomsFichiers = new Set<string>();
  const sensitiveFiles: string[] = [];
  let fileCount = 0;
  for (let index = 0; index < chemins.length; index += 1) {
    const chemin = chemins[index];
    nomsFichiers.add(chemin.split("/").pop() ?? chemin);
    if (chemin !== ".git") fileCount += 1;
    if (isSensitivePath(chemin)) sensitiveFiles.push(chemin);
    if ((index + 1) % 512 === 0) await yieldToUi();
  }
  const detected = PROJECT_SIGNATURES.find((signature) =>
    signature.files.some((filename) => nomsFichiers.has(filename))
  );

  return {
    type: detected?.type ?? "inconnu",
    suggestedGitignore: detected?.gitignore ?? "",
    hasExistingGit,
    sensitiveFiles,
    fileCount,
  };
}
