import { invoke } from "@tauri-apps/api/core";
import type { AnalyseProjet, TypeProjet } from "../types";

export interface ProjectScanPage {
  analysis: AnalyseProjet;
  files: string[];
  hasMore: boolean;
}

export async function scannerProjet(
  dir: string,
  offset = 0,
  limit = 500
): Promise<ProjectScanPage> {
  const response = await invoke<{
    analysis: {
      type: TypeProjet;
      suggestedGitignore: string;
      hasExistingGit: boolean;
      sensitiveFiles: string[];
      fileCount: number;
    };
    files: string[];
    hasMore: boolean;
  }>("git_scan_project", { dir, offset, limit });
  return {
    analysis: {
      type: response.analysis.type,
      suggestedGitignore: response.analysis.suggestedGitignore,
      hasExistingGit: response.analysis.hasExistingGit,
      sensitiveFiles: response.analysis.sensitiveFiles,
      fileCount: response.analysis.fileCount,
    },
    files: response.files,
    hasMore: response.hasMore,
  };
}
