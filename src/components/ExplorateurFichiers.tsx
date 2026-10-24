import { useEffect, useMemo, useRef, useState } from "react";
import { FileCode2, FileText, FolderTree } from "lucide-react";
import { join } from "@tauri-apps/api/path";
import { tauriFsBridge } from "../services/tauriFsBridge";
import { translateError, type Language } from "../i18n";

interface Props {
  directory: string;
  files: string[];
  lang: Language;
}

const TAILLE_MAX_APERCU = 512 * 1024;

export function ExplorateurFichiers({ directory, files, lang }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const readRequest = useRef(0);
  const french = lang === "fr";
  const sortedFiles = useMemo(
    () => [...files].sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" })),
    [files]
  );

  useEffect(() => {
    readRequest.current += 1;
    setSelected(null);
    setContent(null);
    setError(null);
    setLoading(false);
  }, [directory]);

  async function openFile(filepath: string) {
    const requestId = ++readRequest.current;
    setSelected(filepath);
    setContent(null);
    setError(null);
    setLoading(true);
    try {
      const fullPath = await join(directory, ...filepath.split("/"));
      const metadata = await tauriFsBridge.promises.stat(fullPath);
      if (requestId !== readRequest.current) return;
      if (metadata.size > TAILLE_MAX_APERCU) {
        setError(french ? "Aperçu indisponible : le fichier dépasse 512 Ko." : "Preview unavailable: the file is larger than 512 KB.");
        return;
      }
      const result = await tauriFsBridge.promises.readFile(fullPath);
      const bytes = typeof result === "string" ? new TextEncoder().encode(result) : new Uint8Array(result);
      if (requestId !== readRequest.current) return;
      if (bytes.length > TAILLE_MAX_APERCU) {
        setError(french ? "Aperçu indisponible : le fichier dépasse 512 Ko." : "Preview unavailable: the file is larger than 512 KB.");
        return;
      }
      if (bytes.some((byte) => byte === 0)) {
        setError(french ? "Aperçu indisponible : ce fichier semble binaire." : "Preview unavailable: this appears to be a binary file.");
        return;
      }
      try {
        setContent(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      } catch {
        setError(french ? "Aperçu indisponible : le fichier n’est pas un texte UTF-8." : "Preview unavailable: the file is not UTF-8 text.");
      }
    } catch (cause) {
      if (requestId === readRequest.current) setError(translateError(cause, lang));
    } finally {
      if (requestId === readRequest.current) setLoading(false);
    }
  }

  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-slate-800 bg-[#0d0d0d]" aria-label={french ? "Fichiers du projet" : "Project files"}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <FolderTree size={16} className="text-orange-300" />
          {french ? "Fichiers du dossier" : "Folder files"}
        </h3>
        <span className="text-xs text-slate-500">
          {french ? "Sélectionne un fichier pour le consulter (lecture seule)." : "Select a file to preview it (read-only)."}
        </span>
      </div>
      <div className="grid min-h-64 md:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.6fr)]">
        <div className="max-h-80 overflow-auto border-b border-slate-800 p-2 md:border-b-0 md:border-r">
          {sortedFiles.length ? (
            <ul className="space-y-0.5">
              {sortedFiles.map((filepath) => (
                <li key={filepath}>
                  <button
                    type="button"
                    onClick={() => void openFile(filepath)}
                    className={`flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-xs hover:bg-slate-800 ${selected === filepath ? "bg-orange-950/50 text-orange-200" : "text-slate-300"}`}
                    title={filepath}
                  >
                    <FileCode2 size={14} className="shrink-0 text-slate-500" />
                    <span className="truncate">{filepath}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-3 text-sm text-slate-500">{french ? "Aucun fichier à afficher." : "No files to display."}</p>
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
                <p className="p-4 text-sm text-slate-400">{french ? "Lecture du fichier…" : "Reading file…"}</p>
              ) : error ? (
                <p role="status" className="p-4 text-sm text-amber-300">{error}</p>
              ) : (
                <pre className="max-h-[28rem] overflow-auto p-4 text-xs leading-5 text-slate-300"><code>{content}</code></pre>
              )}
            </>
          ) : (
            <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-slate-500">
              <FileText size={22} />
              {french ? "Choisis un fichier dans la liste pour afficher son contenu." : "Choose a file from the list to preview its contents."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
