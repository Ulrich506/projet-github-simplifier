import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { AnalyseProjet, ProgressionGit, TypeProjet } from "../types";

export interface ProjectScanPage {
  analysis: AnalyseProjet;
  files: string[];
  hasMore: boolean;
}

interface AnalyseProjetNative {
  type: TypeProjet;
  suggestedGitignore: string;
  hasExistingGit: boolean;
  sensitiveFiles: string[];
  fileCount: number;
}

interface ProjectProgressEvent {
  operationId: string;
  phase: string;
  loaded: number | null;
  total: number | null;
}

function mapAnalysis(analysis: AnalyseProjetNative): AnalyseProjet {
  return {
    type: analysis.type,
    suggestedGitignore: analysis.suggestedGitignore,
    hasExistingGit: analysis.hasExistingGit,
    sensitiveFiles: analysis.sensitiveFiles,
    fileCount: analysis.fileCount,
  };
}

export function creerIdAnalyseProjet(): string {
  return globalThis.crypto?.randomUUID?.() ?? `project-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function detecterProjetRapidement(dir: string): Promise<AnalyseProjet> {
  const analysis = await invoke<AnalyseProjetNative>("git_detect_project", { dir });
  return mapAnalysis(analysis);
}

export async function scannerProjet(
  dir: string,
  offset = 0,
  limit = 500,
  options: {
    operationId?: string;
    onProgress?: (progress: ProgressionGit) => void;
  } = {}
): Promise<ProjectScanPage> {
  const operationId = options.operationId ?? creerIdAnalyseProjet();
  const unlisten = options.onProgress
    ? await listen<ProjectProgressEvent>("git-operation-progress", (event) => {
        const progress = event.payload;
        if (progress.operationId !== operationId) return;
        options.onProgress?.({
          phase: progress.phase,
          loaded: progress.loaded ?? 0,
          total: progress.total ?? undefined,
        });
      })
    : undefined;

  try {
    const response = await invoke<{
      analysis: AnalyseProjetNative;
      files: string[];
      hasMore: boolean;
    }>("git_scan_project", { dir, offset, limit, operationId });
    return {
      analysis: mapAnalysis(response.analysis),
      files: response.files,
      hasMore: response.hasMore,
    };
  } finally {
    unlisten?.();
  }
}
