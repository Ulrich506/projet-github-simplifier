import type { AnalyseProjet, TypeProjet } from "../types";

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
  /secrets?\.(json|ya?ml)$/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /credentials/i,
];

export async function analyzeProject(chemins: string[]): Promise<AnalyseProjet> {
  const hasExistingGit = chemins.some(
    (p) => p.includes(".git/") || p.split("/").includes(".git")
  );

  const detected = PROJECT_SIGNATURES.find((sig) =>
    sig.files.some((needle) => chemins.some((p) => p.endsWith(needle)))
  );

  const sensitiveFiles = chemins.filter((p) => {
    const nomFichier = p.split("/").pop() ?? p;
    return SENSITIVE_PATTERNS.some((pattern) => pattern.test(nomFichier));
  });

  return {
    type: detected?.type ?? "inconnu",
    suggestedGitignore: detected?.gitignore ?? "",
    hasExistingGit,
    sensitiveFiles,
    fileCount: chemins.length,
  };
}
