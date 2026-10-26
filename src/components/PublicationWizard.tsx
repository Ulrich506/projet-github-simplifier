import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, CloudUpload, X } from "lucide-react";
import type { Language } from "../i18n";

interface Props {
  open: boolean;
  language: Language;
  mode: "create" | "update";
  directory: string;
  remoteUrl: string | null;
  branch: string;
  changedFiles: number;
  sensitiveFiles: string[];
  repoName: string;
  privateRepo: boolean;
  commitMessage: string;
  busy: boolean;
  authenticated: boolean;
  onRepoNameChange: (name: string) => void;
  onPrivateRepoChange: (isPrivate: boolean) => void;
  onCommitMessageChange: (message: string) => void;
  onChooseProject: () => void;
  onConnect: () => void;
  onClose: () => void;
  onFinish: () => void;
}

export function PublicationWizard({
  open,
  language,
  mode,
  directory,
  remoteUrl,
  branch,
  changedFiles,
  sensitiveFiles,
  repoName,
  privateRepo,
  commitMessage,
  busy,
  authenticated,
  onRepoNameChange,
  onPrivateRepoChange,
  onCommitMessageChange,
  onChooseProject,
  onConnect,
  onClose,
  onFinish,
}: Props) {
  const [step, setStep] = useState(1);
  const fr = language === "fr";
  const es = language === "es";
  const labels = fr
    ? {
        title: "Publier le projet",
        steps: ["Projet", "Fichiers sensibles", "Commit", "Confirmer"],
        close: "Fermer",
        folder: "Dossier local",
        chooseFolder: "Choisir un dossier",
        target: mode === "create" ? "Nouveau dépôt GitHub" : "Dépôt distant",
        branch: "Branche",
        changes: "Fichiers modifiés détectés",
        repoName: "Nom du nouveau dépôt",
        private: "Privé",
        public: "Public",
        protection: "Protection automatique",
        protectionInfo: "Les fichiers reconnus comme sensibles seront exclus et retirés du suivi Git avant le commit. Leur contenu reste sur votre ordinateur.",
        noSensitive: "Aucun nom de fichier sensible détecté.",
        commit: "Message du commit",
        commitPlaceholder: "Décrivez les changements publiés",
        review: "Vérifiez les informations avant de publier.",
        confirm: "Un commit local sera créé si nécessaire, puis envoyé sur GitHub sans forcer l’historique distant.",
        back: "Précédent",
        next: "Suivant",
        finish: "Terminer et publier",
        busy: "Publication en cours…",
        connect: "Connecter un compte GitHub",
      }
    : es
      ? {
          title: "Publicar proyecto",
          steps: ["Proyecto", "Archivos sensibles", "Commit", "Confirmar"],
          close: "Cerrar",
          folder: "Carpeta local",
          chooseFolder: "Elegir carpeta",
          target: mode === "create" ? "Nuevo repositorio de GitHub" : "Repositorio remoto",
          branch: "Rama",
          changes: "Archivos modificados",
          repoName: "Nombre del nuevo repositorio",
          private: "Privado",
          public: "Público",
          protection: "Protección automática",
          protectionInfo: "Los archivos identificados como sensibles se excluirán y dejarán de seguirse en Git antes del commit. Su contenido permanece en tu equipo.",
          noSensitive: "No se detectaron nombres de archivos sensibles.",
          commit: "Mensaje del commit",
          commitPlaceholder: "Describe los cambios publicados",
          review: "Revisa la información antes de publicar.",
          confirm: "Se creará un commit local si es necesario y se enviará a GitHub sin forzar el historial remoto.",
          back: "Anterior",
          next: "Siguiente",
          finish: "Terminar y publicar",
          busy: "Publicando…",
          connect: "Conectar cuenta de GitHub",
        }
      : {
          title: "Publish project",
          steps: ["Project", "Sensitive files", "Commit", "Confirm"],
          close: "Close",
          folder: "Local folder",
          chooseFolder: "Choose a folder",
          target: mode === "create" ? "New GitHub repository" : "Remote repository",
          branch: "Branch",
          changes: "Changed files detected",
          repoName: "New repository name",
          private: "Private",
          public: "Public",
          protection: "Automatic protection",
          protectionInfo: "Files recognized as sensitive will be excluded and removed from Git tracking before the commit. Their contents remain on your computer.",
          noSensitive: "No sensitive file names detected.",
          commit: "Commit message",
          commitPlaceholder: "Describe the published changes",
          review: "Review the details before publishing.",
          confirm: "A local commit will be created if needed, then sent to GitHub without forcing remote history.",
          back: "Back",
          next: "Next",
          finish: "Finish and publish",
          busy: "Publishing…",
          connect: "Connect a GitHub account",
        };

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);
  if (!open) return null;

  const canContinue = step !== 1 || (directory.length > 0 && (mode !== "create" || repoName.trim().length > 0));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="publish-wizard-title" className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#171717] p-5 shadow-2xl sm:p-6">
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 id="publish-wizard-title" className="flex items-center gap-2 text-lg font-semibold">
              <CloudUpload size={19} className="text-emerald-400" />{labels.title}
            </h2>
            <ol className="mt-4 flex flex-wrap gap-2" aria-label={labels.title}>
              {labels.steps.map((label, index) => (
                <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={`rounded-full px-3 py-1 text-xs ${step === index + 1 ? "bg-orange-600 text-white" : step > index + 1 ? "bg-emerald-950 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                  {step > index + 1 && <Check size={12} className="mr-1 inline" />}{index + 1}. {label}
                </li>
              ))}
            </ol>
          </div>
          <button type="button" onClick={onClose} aria-label={labels.close} disabled={busy} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"><X size={18} /></button>
        </header>

        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-800 bg-[#0d0d0d] p-3">
              <p className="text-xs text-slate-500">{labels.folder}</p>
              {directory ? <p className="mt-1 break-all font-mono text-xs text-slate-200">{directory}</p> : (
                <button type="button" onClick={onChooseProject} disabled={busy} className="mt-2 rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold hover:bg-orange-500 disabled:opacity-50">{labels.chooseFolder}</button>
              )}
            </div>
            {mode === "create" && (
              <>
                <label className="block text-sm">
                  <span className="mb-1 block">{labels.repoName}</span>
                  <input value={repoName} onChange={(event) => onRepoNameChange(event.target.value)} className="w-full rounded-md border border-slate-700 bg-[#090909] px-3 py-2" />
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => onPrivateRepoChange(true)} aria-pressed={privateRepo} className={`rounded-md border px-3 py-2 text-sm ${privateRepo ? "border-orange-500 bg-orange-950/40" : "border-slate-700"}`}>{labels.private}</button>
                  <button type="button" onClick={() => onPrivateRepoChange(false)} aria-pressed={!privateRepo} className={`rounded-md border px-3 py-2 text-sm ${!privateRepo ? "border-orange-500 bg-orange-950/40" : "border-slate-700"}`}>{labels.public}</button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-900 bg-emerald-950/20 p-4">
              <p className="font-medium text-emerald-200">{labels.protection}</p>
              <p className="mt-1 text-sm text-slate-300">{labels.protectionInfo}</p>
            </div>
            {sensitiveFiles.length ? (
              <ul className="max-h-40 space-y-1 overflow-auto rounded-lg border border-slate-800 bg-[#0d0d0d] p-3 font-mono text-xs text-slate-300">
                {sensitiveFiles.map((filepath) => <li key={filepath} className="break-all">{filepath}</li>)}
              </ul>
            ) : <p className="text-sm text-slate-400">{labels.noSensitive}</p>}
          </div>
        )}

        {step === 3 && (
          <label className="block space-y-2 text-sm">
            <span>{labels.commit}</span>
            <input value={commitMessage} onChange={(event) => onCommitMessageChange(event.target.value)} placeholder={labels.commitPlaceholder} className="w-full rounded-md border border-slate-700 bg-[#090909] px-3 py-2" autoFocus />
          </label>
        )}

        {step === 4 && (
          <div className="space-y-3 rounded-lg border border-emerald-900 bg-emerald-950/20 p-4">
            <p className="font-medium text-emerald-200">{labels.review}</p>
            <p className="text-sm text-slate-300">{labels.confirm}</p>
            <p className="break-all text-sm text-slate-400">{labels.folder}: <strong className="text-slate-200">{directory}</strong></p>
            <p className="break-all text-sm text-slate-400">{labels.target}: <strong className="text-slate-200">{mode === "create" ? repoName : remoteUrl || "—"}</strong></p>
            {mode === "update" && <p className="text-sm text-slate-400">{labels.branch}: <strong className="text-slate-200">{branch}</strong></p>}
            <p className="text-sm text-slate-400">{labels.commit}: <strong className="text-slate-200">{commitMessage.trim() || "—"}</strong></p>
            <p className="text-sm text-slate-400">{labels.changes}: <strong className="text-slate-200">{changedFiles}</strong></p>
            {!authenticated && (
              <button type="button" onClick={onConnect} className="rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold hover:bg-orange-500">
                {labels.connect}
              </button>
            )}
          </div>
        )}

        <footer className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-800 pt-4">
          <button type="button" onClick={() => step === 1 ? onClose() : setStep((current) => current - 1)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50">
            <ChevronLeft size={15} />{labels.back}
          </button>
          {step < 4 ? (
            <button type="button" onClick={() => setStep((current) => current + 1)} disabled={!canContinue || (step === 3 && !commitMessage.trim())} className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold hover:bg-orange-500 disabled:opacity-40">
              {labels.next}<ChevronRight size={15} />
            </button>
          ) : (
            <button type="button" onClick={onFinish} disabled={busy || !authenticated} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40">
              <Check size={16} />{busy ? labels.busy : labels.finish}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
