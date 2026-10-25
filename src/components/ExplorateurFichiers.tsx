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
const HAUTEUR_LIGNE = 32;
const NOMBRE_LIGNES_VISIBLES = 20;

export function ExplorateurFichiers({ directory, files, lang }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const readRequest = useRef(0);
  const text = lang === "fr" ? {
    title: "Fichiers du dossier",
    selectPrompt: "Sélectionne un fichier pour le consulter (lecture seule).",
    tooLarge: "Aperçu indisponible : le fichier dépasse 512 Ko.",
    binary: "Aperçu indisponible : ce fichier semble binaire.",
    encoding: "Aperçu indisponible : le fichier n’est pas un texte UTF-8.",
    empty: "Aucun fichier à afficher.",
    reading: "Lecture du fichier…",
    choose: "Choisis un fichier dans la liste pour afficher son contenu.",
  } : lang === "es" ? {
    title: "Archivos de la carpeta",
    selectPrompt: "Selecciona un archivo para verlo (solo lectura).",
    tooLarge: "Vista previa no disponible: el archivo supera los 512 KB.",
    binary: "Vista previa no disponible: el archivo parece binario.",
    encoding: "Vista previa no disponible: el archivo no es texto UTF-8.",
    empty: "No hay archivos para mostrar.",
    reading: "Leyendo archivo…",
    choose: "Selecciona un archivo de la lista para ver su contenido.",
  } : {
    title: "Folder files",
    selectPrompt: "Select a file to preview it (read-only).",
    tooLarge: "Preview unavailable: the file is larger than 512 KB.",
    binary: "Preview unavailable: this appears to be a binary file.",
    encoding: "Preview unavailable: the file is not UTF-8 text.",
    empty: "No files to display.",
    reading: "Reading file…",
    choose: "Choose a file from the list to preview its contents.",
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
        setError(text.tooLarge);
        return;
      }
      const result = await tauriFsBridge.promises.readFile(fullPath);
      const bytes = typeof result === "string" ? new TextEncoder().encode(result) : new Uint8Array(result);
      if (requestId !== readRequest.current) return;
      if (bytes.length > TAILLE_MAX_APERCU) {
        setError(text.tooLarge);
        return;
      }
      if (bytes.some((byte) => byte === 0)) {
        setError(text.binary);
        return;
      }
      try {
        setContent(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      } catch {
        setError(text.encoding);
      }
    } catch (cause) {
      if (requestId === readRequest.current) setError(translateError(cause, lang));
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
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          {sortedFiles.length ? (
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
