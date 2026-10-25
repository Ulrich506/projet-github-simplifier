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
  onRepoNameChange: (name: string) => void;
  onPrivateRepoChange: (isPrivate: boolean) => void;
  onCommitMessageChange: (message: string) => void;
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
  onRepoNameChange,
  onPrivateRepoChange,
  onCommitMessageChange,
  onClose,
  onFinish,
}: Props) {
  const [step, setStep] = useState(1);
  const fr = language === "fr";
  const es = language === "es";
  const labels = fr ? {
    title: "Assistant de publication",
    steps: ["Vérifier le projet", "Préparer le commit", "Confirmer"],
    close: "Fermer",
    target: mode === "create" ? "Nouveau dépôt GitHub" : "Dépôt distant",
    folder: "Dossier local",
    branch: "Branche",
    changes: "Fichiers modifiés détectés",
    sensitive: "Fichiers sensibles à corriger avant publication",
    noSensitive: "Aucun fichier sensible détecté par l’analyse.",
    repoName: "Nom du nouveau dépôt",
    private: "Privé",
    public: "Public",
    commitMessage: "Message du commit",
    messagePlaceholder: "Décris les changements publiés",
    review: "Vérifie ces informations avant d’envoyer tes changements sur GitHub.",
    confirm: "La publication crée un commit local si nécessaire, puis envoie les changements sans forcer l’historique distant.",
    back: "Précédent",
    next: "Suivant",
    finish: "Terminer et publier",
    busy: "Publication en cours…",
  } : es ? {
    title: "Asistente de publicación",
    steps: ["Revisar proyecto", "Preparar commit", "Confirmar"],
    close: "Cerrar",
    target: mode === "create" ? "Nuevo repositorio de GitHub" : "Repositorio remoto",
    folder: "Carpeta local",
    branch: "Rama",
    changes: "Archivos modificados detectados",
    sensitive: "Archivos sensibles que debes revisar antes de publicar",
    noSensitive: "El análisis no detectó archivos sensibles.",
    repoName: "Nombre del nuevo repositorio",
    private: "Privado",
    public: "Público",
    commitMessage: "Mensaje del commit",
    messagePlaceholder: "Describe los cambios publicados",
    review: "Revisa esta información antes de enviar los cambios a GitHub.",
    confirm: "La publicación crea un commit local si es necesario y envía los cambios sin forzar el historial remoto.",
    back: "Anterior",
    next: "Siguiente",
    finish: "Terminar y publicar",
    busy: "Publicando…",
  } : {
    title: "Publish assistant",
    steps: ["Review project", "Prepare commit", "Confirm"],
    close: "Close",
    target: mode === "create" ? "New GitHub repository" : "Remote repository",
    folder: "Local folder",
    branch: "Branch",
    changes: "Changed files detected",
    sensitive: "Sensitive files to review before publishing",
    noSensitive: "The analysis did not detect sensitive files.",
    repoName: "New repository name",
    private: "Private",
    public: "Public",
    commitMessage: "Commit message",
    messagePlaceholder: "Describe the published changes",
    review: "Review these details before sending your changes to GitHub.",
    confirm: "Publishing creates a local commit if needed, then sends changes without forcing remote history.",
    back: "Back",
    next: "Next",
    finish: "Finish and publish",
    busy: "Publishing…",
  };

  useEffect(() => {
    if (open) setStep(1);
  }, [open]);

  if (!open) return null;

  const canContinue = step !== 1 || mode !== "create" || repoName.trim().length > 0;
  const cannotPublish = busy || sensitiveFiles.length > 0 || (mode === "create" && !repoName.trim());

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-wizard-title"
        className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#171717] p-5 shadow-2xl sm:p-6"
      >
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 id="publish-wizard-title" className="flex items-center gap-2 text-lg font-semibold">
              <CloudUpload size={19} className="text-emerald-400" />
              {labels.title}
            </h2>
            <ol className="mt-4 flex flex-wrap gap-2" aria-label={labels.title}>
              {labels.steps.map((label, index) => (
                <li
                  key={label}
                  aria-current={step === index + 1 ? "step" : undefined}
                  className={`rounded-full px-3 py-1 text-xs ${step === index + 1 ? "bg-orange-600 text-white" : step > index + 1 ? "bg-emerald-950 text-emerald-300" : "bg-slate-800 text-slate-400"}`}
                >
                  {step > index + 1 && <Check size={12} className="mr-1 inline" />}
                  {index + 1}. {label}
                </li>
              ))}
            </ol>
          </div>
          <button type="button" onClick={onClose} aria-label={labels.close} disabled={busy} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50">
            <X size={18} />
          </button>
        </header>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">{labels.review}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-800 bg-[#0d0d0d] p-3">
                <p className="text-xs text-slate-500">{labels.folder}</p>
                <p className="mt-1 break-all font-mono text-xs text-slate-200">{directory}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0d0d0d] p-3">
                <p className="text-xs text-slate-500">{labels.target}</p>
                <p className="mt-1 break-all font-mono text-xs text-slate-200">{mode === "create" ? repoName || "—" : remoteUrl || "—"}</p>
                {mode === "update" && <p className="mt-2 text-xs text-slate-400">{labels.branch}: {branch}</p>}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#0d0d0d] p-3 text-sm">
              <span className="text-slate-400">{labels.changes}: </span>
              <strong>{changedFiles}</strong>
            </div>
            {mode === "create" && (
              <div className="space-y-3">
                <label className="block text-sm">
                  <span className="mb-1 block">{labels.repoName}</span>
                  <input value={repoName} onChange={(event) => onRepoNameChange(event.target.value)} className="w-full rounded-md border border-slate-700 bg-[#090909] px-3 py-2" autoFocus />
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => onPrivateRepoChange(true)} aria-pressed={privateRepo} className={`rounded-md border px-3 py-2 text-sm ${privateRepo ? "border-orange-500 bg-orange-950/40" : "border-slate-700"}`}>{labels.private}</button>
                  <button type="button" onClick={() => onPrivateRepoChange(false)} aria-pressed={!privateRepo} className={`rounded-md border px-3 py-2 text-sm ${!privateRepo ? "border-orange-500 bg-orange-950/40" : "border-slate-700"}`}>{labels.public}</button>
                </div>
              </div>
            )}
            {sensitiveFiles.length ? (
              <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-3">
                <p className="text-sm font-semibold text-amber-200">{labels.sensitive}</p>
                <ul className="mt-2 max-h-28 space-y-1 overflow-auto text-xs text-amber-100">
                  {sensitiveFiles.map((filepath) => <li key={filepath} className="break-all font-mono">{filepath}</li>)}
                </ul>
              </div>
            ) : <p className="text-sm text-emerald-300">{labels.noSensitive}</p>}
          </div>
        )}

        {step === 2 && (
          <label className="block space-y-2 text-sm">
            <span>{labels.commitMessage}</span>
            <input
              value={commitMessage}
              onChange={(event) => onCommitMessageChange(event.target.value)}
              placeholder={labels.messagePlaceholder}
              className="w-full rounded-md border border-slate-700 bg-[#090909] px-3 py-2"
              autoFocus
            />
          </label>
        )}

        {step === 3 && (
          <div className="space-y-3 rounded-lg border border-emerald-900 bg-emerald-950/20 p-4">
            <p className="font-medium text-emerald-200">{labels.review}</p>
            <p className="text-sm text-slate-300">{labels.confirm}</p>
            <p className="text-sm text-slate-400">{labels.commitMessage}: <strong className="text-slate-200">{commitMessage.trim() || "—"}</strong></p>
            <p className="text-sm text-slate-400">{labels.changes}: <strong className="text-slate-200">{changedFiles}</strong></p>
            {sensitiveFiles.length > 0 && <p role="alert" className="text-sm text-amber-300">{labels.sensitive}</p>}
          </div>
        )}

        <footer className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-800 pt-4">
          <button type="button" onClick={() => step === 1 ? onClose() : setStep((current) => current - 1)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50">
            <ChevronLeft size={15} />{labels.back}
          </button>
          {step < 3 ? (
            <button type="button" onClick={() => setStep((current) => current + 1)} disabled={!canContinue || (step === 2 && !commitMessage.trim())} className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold hover:bg-orange-500 disabled:opacity-40">
              {labels.next}<ChevronRight size={15} />
            </button>
          ) : (
            <button type="button" onClick={onFinish} disabled={cannotPublish} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40">
              <Check size={16} />{busy ? labels.busy : labels.finish}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
