import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ProgressionGit } from "../types";

export interface CommitPreparation {
  excludedLargeFiles: string[];
  warningLargeFiles: string[];
  excludedSensitiveFiles: string[];
  excludedGeneratedFolders: string[];
}

interface GitStatusResponse {
  branch: string;
  remoteUrl: string | null;
  changedFiles: number;
  conflictFiles: string[];
  recentCommits: EtatDepot["recentCommits"];
  files: { path: string; status: string }[];
  offset: number;
  hasMore: boolean;
}

interface ProgressEvent {
  operationId: string;
  phase: string;
  loaded?: number;
  total?: number;
}

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
  conflictFiles: string[];
  recentCommits: { oid: string; message: string; timestamp: number }[];
}

const activeOperations = new Set<string>();

function createOperationId(): string {
  return crypto.randomUUID();
}

async function runWithProgress<T>(
  command: string,
  args: Record<string, unknown>,
  onProgress?: (evt: ProgressionGit) => void
): Promise<T> {
  const operationId = createOperationId();
  activeOperations.add(operationId);
  const unlisten = onProgress
    ? await listen<ProgressEvent>("git-operation-progress", (event) => {
        if (event.payload.operationId !== operationId) return;
        onProgress({
          phase: event.payload.phase,
          loaded: event.payload.loaded,
          total: event.payload.total,
        });
      })
    : undefined;
  try {
    return await invoke<T>(command, { ...args, operationId });
  } finally {
    activeOperations.delete(operationId);
    unlisten?.();
  }
}

export async function initialiserDepot(dir: string): Promise<void> {
  await invoke("git_init", { dir });
}

export async function obtenirUrlDistante(dir: string): Promise<string | null> {
  const state = await invoke<GitStatusResponse>("git_status_project", {
    dir,
    offset: 0,
    limit: 1,
  });
  return state.remoteUrl;
}

export async function obtenirBrancheCourante(dir: string): Promise<string> {
  const state = await invoke<GitStatusResponse>("git_status_project", {
    dir,
    offset: 0,
    limit: 1,
  });
  return state.branch;
}

export async function associerDepotDistant(
  dir: string,
  remoteUrl: string,
  options: { remplacerRemote?: boolean } = {}
): Promise<void> {
  await invoke("git_set_remote", {
    dir,
    url: remoteUrl,
    replace: Boolean(options.remplacerRemote),
  });
}

export async function obtenirEtatDepot(dir: string): Promise<EtatDepot> {
  const state = await invoke<GitStatusResponse>("git_status_project", {
    dir,
    offset: 0,
    limit: 500,
  });
  return {
    branch: state.branch,
    remoteUrl: state.remoteUrl,
    changedFiles: state.changedFiles,
    conflictFiles: state.conflictFiles,
    recentCommits: state.recentCommits,
  };
}

export async function obtenirFichiersSensiblesSuivis(dir: string): Promise<string[]> {
  return invoke<string[]>("git_list_sensitive_tracked", { dir });
}

export async function ignorerFichierSensible(dir: string, filepath: string): Promise<void> {
  await invoke("git_set_ignore", { dir, filepath });
}

export async function preparerGitignore(dir: string, ignoreSuggere: string): Promise<void> {
  await invoke("git_prepare_ignore", { dir, suggested: ignoreSuggere });
}

export async function ajouterEtCommiter(
  dir: string,
  message = "Mise à jour du projet",
  author?: { name: string; email: string },
  onProgress?: (evt: ProgressionGit) => void
): Promise<CommitPreparation> {
  return runWithProgress<CommitPreparation>(
    "git_commit_project",
    {
      dir,
      message,
      name: author?.name ?? "GitHub Simplifié",
      email: author?.email ?? "github-simplifie@users.noreply.github.com",
    },
    onProgress
  );
}

export async function publier({
  dir,
  token,
  onProgress,
}: OperationDistante): Promise<void> {
  await runWithProgress<void>(
    "git_push_project",
    { dir, token },
    onProgress
  );
}

export async function mettreAJour({
  dir,
  token,
  onProgress,
}: OperationDistante): Promise<void> {
  await runWithProgress<void>(
    "git_sync_project",
    { dir, token },
    onProgress
  );
}

export async function recuperer({
  dir,
  remoteUrl,
  token,
  onProgress,
}: OperationDistante): Promise<void> {
  if (!remoteUrl) throw new Error("L’URL du dépôt à cloner est manquante.");
  await runWithProgress<void>(
    "git_clone_project",
    { url: remoteUrl, destination: dir, token },
    onProgress
  );
}

export async function annulerOperationGit(operationId: string): Promise<void> {
  await invoke("git_cancel_operation", { operationId });
}

export async function annulerOperationsGit(): Promise<void> {
  await Promise.all([...activeOperations].map((operationId) => annulerOperationGit(operationId)));
}
