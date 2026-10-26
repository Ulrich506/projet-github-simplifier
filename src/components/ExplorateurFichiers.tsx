import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UIEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileCode2, FileText, FolderTree } from "lucide-react";
import { translateError, type Language } from "../i18n";

interface Props {
  directory: string;
  files: string[];
  hasMore: boolean;
  totalFileCount: number;
  onLoadMore: () => Promise<void>;
  lang: Language;
}

const HAUTEUR_LIGNE = 32;
const NOMBRE_LIGNES_VISIBLES = 20;

function ExplorateurFichiersView({ directory, files, hasMore, totalFileCount, onLoadMore, lang }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const readRequest = useRef(0);
  const scrollFrame = useRef<number | null>(null);
  const pendingScrollTop = useRef(0);
  const text = lang === "fr" ? {
    title: "Fichiers du dossier",
    selectPrompt: "Sélectionne un fichier pour le consulter (lecture seule).",
    tooLarge: "Aperçu indisponible : le fichier dépasse 512 Ko.",
    binary: "Aperçu indisponible : ce fichier semble binaire.",
    encoding: "Aperçu indisponible : le fichier n’est pas un texte UTF-8.",
    empty: "Aucun fichier à afficher.",
    reading: "Lecture du fichier…",
    choose: "Choisis un fichier dans la liste pour afficher son contenu.",
    loadMore: "Charger les fichiers suivants",
    limitReached: "L’affichage est limité aux 2 000 premiers fichiers pour préserver la mémoire.",
  } : lang === "es" ? {
    title: "Archivos de la carpeta",
    selectPrompt: "Selecciona un archivo para verlo (solo lectura).",
    tooLarge: "Vista previa no disponible: el archivo supera los 512 KB.",
    binary: "Vista previa no disponible: el archivo parece binario.",
    encoding: "Vista previa no disponible: el archivo no es texto UTF-8.",
    empty: "No hay archivos para mostrar.",
    reading: "Leyendo archivo…",
    choose: "Selecciona un archivo de la lista para ver su contenido.",
    loadMore: "Cargar los siguientes archivos",
    limitReached: "La vista se limita a los primeros 2 000 archivos para proteger la memoria.",
  } : {
    title: "Folder files",
    selectPrompt: "Select a file to preview it (read-only).",
    tooLarge: "Preview unavailable: the file is larger than 512 KB.",
    binary: "Preview unavailable: this appears to be a binary file.",
    encoding: "Preview unavailable: the file is not UTF-8 text.",
    empty: "No files to display.",
    reading: "Reading file…",
    choose: "Choose a file from the list to preview its contents.",
    loadMore: "Load next files",
    limitReached: "Only the first 2,000 files are shown to preserve memory.",
  };
  const sortedFiles = useMemo(
    () => [...files].sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })),
    [files]
  );
  const startIndex = Math.min(
    Math.floor(scrollTop / HAUTEUR_LIGNE),
    Math.max(0, sortedFiles.length - NOMBRE_LIGNES_VISIBLES)
  );
  const visibleFiles = sortedFiles.slice(startIndex, startIndex + NOMBRE_LIGNES_VISIBLES + 2);

  useEffect(() => {
    readRequest.current += 1;
    setSelected(null);
    setContent(null);
    setError(null);
    setLoading(false);
    setScrollTop(0);
  }, [directory]);

  useEffect(() => () => {
    if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current);
  }, []);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    pendingScrollTop.current = event.currentTarget.scrollTop;
    if (scrollFrame.current !== null) return;
    scrollFrame.current = window.requestAnimationFrame(() => {
      scrollFrame.current = null;
      setScrollTop(pendingScrollTop.current);
    });
  }, []);

  async function openFile(filepath: string) {
    const requestId = ++readRequest.current;
    setSelected(filepath);
    setContent(null);
    setError(null);
    setLoading(true);
    try {
      const result = await invoke<string>("git_read_file_preview", { dir: directory, filepath });
      if (requestId !== readRequest.current) return;
      setContent(result);
    } catch (cause) {
      if (requestId === readRequest.current) {
        const message = cause instanceof Error ? cause.message : String(cause);
        setError(message.includes("GIT_PREVIEW_TOO_LARGE")
          ? text.tooLarge
          : message.includes("GIT_PREVIEW_BINARY")
            ? text.binary
            : message.includes("GIT_PREVIEW_INVALID_UTF8")
              ? text.encoding
              : translateError(cause, lang));
      }

    } finally {
      if (requestId === readRequest.current) setLoading(false);
    }
  }

  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-slate-800 bg-[#0d0d0d]" aria-label={text.title}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <FolderTree size={16} className="text-orange-300" />
          {text.title}
        </h3>
        <span className="text-xs text-slate-500">
          {text.selectPrompt}
        </span>
      </div>
      <div className="grid min-h-64 md:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.6fr)]">
        <div
          className="max-h-80 overflow-auto border-b border-slate-800 p-2 md:border-b-0 md:border-r"
          onScroll={handleScroll}
        >
          {sortedFiles.length ? (
            <>
              <ul style={{ paddingTop: startIndex * HAUTEUR_LIGNE, paddingBottom: Math.max(0, sortedFiles.length - startIndex - visibleFiles.length) * HAUTEUR_LIGNE }}>
                {visibleFiles.map((filepath) => (
                  <li key={filepath} style={{ height: HAUTEUR_LIGNE }}>
                    <button
                      type="button"
                      onClick={() => void openFile(filepath)}
                      className={`flex h-full w-full min-w-0 items-center gap-2 rounded px-2 text-left font-mono text-xs hover:bg-slate-800 ${selected === filepath ? "bg-orange-950/50 text-orange-200" : "text-slate-300"}`}
                      title={filepath}
                    >
                      <FileCode2 size={14} className="shrink-0 text-slate-500" />
                      <span className="truncate">{filepath}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {hasMore && (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => {
                    setLoadingMore(true);
                    void onLoadMore().finally(() => setLoadingMore(false));
                  }}
                  className="m-2 rounded border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  {loadingMore ? text.reading : text.loadMore}
                </button>
              )}
              {!hasMore && files.length < totalFileCount && (
                <p className="m-2 text-xs text-slate-500">{text.limitReached}</p>
              )}
            </>
          ) : (
            <p className="p-3 text-sm text-slate-500">{text.empty}</p>
          )}
        </div>
        <div className="min-h-64 min-w-0 overflow-auto">
          {selected ? (
            <>
              <div className="sticky top-0 flex items-center gap-2 border-b border-slate-800 bg-[#111111] px-4 py-2 font-mono text-xs text-slate-400">
                <FileText size={14} />
                <span className="truncate">{selected}</span>
              </div>
              {loading ? (
                <p className="p-4 text-sm text-slate-400">{text.reading}</p>
              ) : error ? (
                <p role="status" className="p-4 text-sm text-amber-300">{error}</p>
              ) : (
                <pre className="max-h-[28rem] overflow-auto p-4 text-xs leading-5 text-slate-300"><code>{content}</code></pre>
              )}
            </>
          ) : (
            <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-slate-500">
              <FileText size={22} />
              {text.choose}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export const ExplorateurFichiers = memo(ExplorateurFichiersView);
