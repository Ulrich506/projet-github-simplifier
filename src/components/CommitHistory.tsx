import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Language } from "../i18n";

interface Commit {
  oid: string;
  message: string;
  timestamp: number;
}

interface Props {
  commits: Commit[];
  hiddenCommits: string[];
  language: Language;
  unnamedLabel: string;
  hideLabel: string;
  onHide: (oid: string) => void;
}

const ROW_HEIGHT = 48;
const VIEWPORT_HEIGHT = 288;
const OVERSCAN = 3;

export function CommitHistory({
  commits,
  hiddenCommits,
  language,
  unnamedLabel,
  hideLabel,
  onHide,
}: Props) {
  const [scrollTop, setScrollTop] = useState(0);
  const visibleCommits = useMemo(
    () => commits.filter((commit) => !hiddenCommits.includes(commit.oid)),
    [commits, hiddenCommits]
  );
  const firstVisible = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endVisible = Math.min(
    visibleCommits.length,
    Math.ceil((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT) + OVERSCAN
  );
  const renderedCommits = visibleCommits.slice(firstVisible, endVisible);

  return (
    <div
      className="overflow-auto"
      style={{ maxHeight: VIEWPORT_HEIGHT }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      role="region"
      aria-label={language === "fr" ? "Historique récent" : language === "es" ? "Historial reciente" : "Recent history"}
    >
      {visibleCommits.length ? (
        <ul style={{ height: visibleCommits.length * ROW_HEIGHT, position: "relative" }}>
          {renderedCommits.map((commit, index) => {
            const absoluteIndex = firstVisible + index;
            return (
              <li
                key={commit.oid}
                className="absolute inset-x-0 flex min-w-0 items-center gap-3 text-sm"
                style={{ height: ROW_HEIGHT, top: absoluteIndex * ROW_HEIGHT }}
              >
                <code className="shrink-0 rounded border border-orange-900 bg-orange-950/40 px-2 py-0.5 text-xs text-orange-200">{commit.oid}</code>
                <span className="min-w-0 flex-1 truncate">{commit.message || unnamedLabel}</span>
                <time className="hidden shrink-0 text-xs text-slate-500 sm:block">
                  {new Date(commit.timestamp * 1000).toLocaleString(
                    language === "fr" ? "fr-FR" : language === "es" ? "es-ES" : "en-US"
                  )}
                </time>
                <button
                  type="button"
                  onClick={() => onHide(commit.oid)}
                  className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-white"
                  aria-label={hideLabel}
                  title={hideLabel}
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
