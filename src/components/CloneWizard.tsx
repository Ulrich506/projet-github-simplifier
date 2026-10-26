import { ChevronLeft, ChevronRight, CloudDownload, Folder, RefreshCw, X } from "lucide-react";
import type { Language } from "../i18n";
import type { DepotGitHub } from "../types";

interface Props {
  open: boolean;
  language: Language;
  repositories: DepotGitHub[];
  loading: boolean;
  error: string | null;
  selectedUrl: string;
  parentDirectory: string;
  targetDirectory: string;
  busy: boolean;
  authenticated: boolean;
  onSelectRepository: (url: string) => void;
  onRefresh: () => void;
  onChooseParent: () => void;
  onClone: () => void;
  onConnect: () => void;
  onClose: () => void;
}

export function CloneWizard({
  open,
  language,
  repositories,
  loading,
  error,
  selectedUrl,
  parentDirectory,
  targetDirectory,
  busy,
  authenticated,
  onSelectRepository,
  onRefresh,
  onChooseParent,
  onClone,
  onConnect,
  onClose,
}: Props) {
  if (!open) return null;

  const fr = language === "fr";
  const es = language === "es";
  const text = fr
    ? {
        title: "Cloner un projet",
        description: "Sélectionnez un dépôt GitHub et le dossier où le récupérer.",
        repository: "Dépôt GitHub",
        loading: "Chargement des dépôts…",
        placeholder: "Choisir un dépôt…",
        empty: "Aucun dépôt accessible trouvé sur ce compte.",
        signIn: "Connectez-vous à GitHub pour afficher vos dépôts.",
        destination: "Dossier de destination",
        choose: "Choisir",
        target: "Le dépôt sera cloné dans :",
        back: "Retour",
        clone: "Cloner le dépôt",
        close: "Fermer l’assistant",
        refresh: "Réessayez de vous connecter ou vérifiez les droits de votre compte.",
        connect: "Connecter un compte GitHub",
      }
    : es
      ? {
          title: "Clonar un proyecto",
          description: "Selecciona un repositorio de GitHub y la carpeta de destino.",
          repository: "Repositorio de GitHub",
          loading: "Cargando repositorios…",
          placeholder: "Seleccionar un repositorio…",
          empty: "No se encontraron repositorios accesibles en esta cuenta.",
          signIn: "Conéctate a GitHub para ver tus repositorios.",
          destination: "Carpeta de destino",
          choose: "Elegir",
          target: "El repositorio se clonará en:",
          back: "Volver",
          clone: "Clonar repositorio",
          close: "Cerrar asistente",
          refresh: "Vuelve a conectarte o comprueba los permisos de tu cuenta.",
          connect: "Conectar cuenta de GitHub",
        }
      : {
          title: "Clone a project",
          description: "Choose a GitHub repository and where to clone it.",
          repository: "GitHub repository",
          loading: "Loading repositories…",
          placeholder: "Select a repository…",
          empty: "No accessible repositories were found for this account.",
          signIn: "Sign in to GitHub to see your repositories.",
          destination: "Destination folder",
          choose: "Choose",
          target: "The repository will be cloned to:",
          back: "Back",
          clone: "Clone repository",
          close: "Close assistant",
          refresh: "Reconnect or check your account permissions.",
          connect: "Connect a GitHub account",
        };
  const validRepository = repositories.some((repository) => repository.url === selectedUrl);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="clone-wizard-title" className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#171717] p-5 shadow-2xl sm:p-6">
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 id="clone-wizard-title" className="flex items-center gap-2 text-lg font-semibold">
              <CloudDownload size={19} className="text-orange-400" />{text.title}
            </h2>
            <p className="mt-2 text-sm text-slate-400">{text.description}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={text.close} disabled={busy} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"><X size={18} /></button>
        </header>

        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <label className="block min-w-0 flex-1 text-sm">
              <span className="mb-1 block">{text.repository}</span>
              <select
                value={selectedUrl}
                onChange={(event) => onSelectRepository(event.target.value)}
                disabled={loading || busy}
                className="w-full rounded-md border border-slate-700 bg-[#090909] px-3 py-2"
              >
                <option value="">{loading ? text.loading : text.placeholder}</option>
                {repositories.map((repository) => (
                  <option key={repository.url} value={repository.url}>
                    {repository.cheminComplet} · {repository.prive ? (fr ? "Privé" : es ? "Privado" : "Private") : (fr ? "Public" : es ? "Público" : "Public")}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={onRefresh} disabled={!authenticated || loading || busy} title={text.refresh} aria-label={text.refresh} className="rounded-md border border-slate-700 p-2.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
          {error && (
            <div role="alert" className="rounded-md border border-red-900 bg-red-950/30 p-3 text-sm text-red-200">
              <p>{error}</p>
              {authenticated && (
                <button type="button" onClick={onConnect} className="mt-2 underline underline-offset-2 hover:text-white">
                  {text.connect}
                </button>
              )}
            </div>
          )}
          {!loading && !error && repositories.length === 0 && (
            <p className="rounded-md border border-slate-700 bg-slate-900/50 p-3 text-sm text-slate-300">{text.empty}</p>
          )}
          <div>
            <span className="mb-1 block text-sm">{text.destination}</span>
            <div className="flex gap-2">
              <input readOnly value={parentDirectory} placeholder={text.destination} className="min-w-0 flex-1 rounded-md border border-slate-700 bg-[#090909] px-3 py-2 font-mono text-xs" />
              <button type="button" onClick={onChooseParent} disabled={busy} className="shrink-0 rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50">
                <Folder size={15} className="mr-1 inline" />{text.choose}
              </button>
            </div>
          </div>
          {targetDirectory && (
            <div className="rounded-lg border border-orange-900 bg-orange-950/20 p-3">
              <p className="text-xs text-slate-400">{text.target}</p>
              <p className="mt-1 break-all font-mono text-sm text-emerald-300">{targetDirectory}</p>
            </div>
          )}
          {!authenticated && <p className="text-xs text-slate-500">{text.signIn}</p>}
          {!authenticated && (
            <button type="button" onClick={onConnect} className="rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold hover:bg-orange-500">
              {text.connect}
            </button>
          )}
          {error && <p className="text-xs text-slate-400">{text.refresh}</p>}
        </div>

        <footer className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-800 pt-4">
          <button type="button" onClick={onClose} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50">
            <ChevronLeft size={15} />{text.back}
          </button>
          <button type="button" onClick={onClone} disabled={busy || loading || !authenticated || !validRepository || !parentDirectory} className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold hover:bg-orange-500 disabled:opacity-40">
            <CloudDownload size={15} />{text.clone}<ChevronRight size={15} />
          </button>
        </footer>
      </section>
    </div>
  );
}
