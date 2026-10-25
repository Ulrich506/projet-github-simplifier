export type TypeProjet =
  | "node"
  | "python"
  | "java-maven"
  | "java-gradle"
  | "rust"
  | "static"
  | "inconnu";

export interface AnalyseProjet {
  type: TypeProjet;
  suggestedGitignore: string;
  hasExistingGit: boolean;
  sensitiveFiles: string[];
  fileCount: number;
}

export type ActionChoisie = "creer" | "publier" | "maj" | "recuperer";

export type Etape =
  | "connexion"
  | "depot"
  | "analyse"
  | "action"
  | "confirmation"
  | "en_cours"
  | "termine";

export interface EtatConnexion {
  token: string | null;
  login: string | null;
  codeUtilisateur: string | null;
  urlVerification: string | null;
  codeExpireA: number | null;
  enAttente: boolean;
  erreur: string | null;
}

export interface DepotGitHub {
  nom: string;
  cheminComplet: string;
  url: string;
  prive: boolean;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface ProgressionGit {
  phase: string;
  loaded?: number;
  total?: number;
}
