import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { join } from "@tauri-apps/api/path";
import { open as openDirectory } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CloudDownload,
  CloudUpload,
  ExternalLink,
  Folder,
  FolderGit2,
  GitBranch,
  GitFork,
  Languages,
  LoaderCircle,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Unlink,
  X,
} from "lucide-react";
import { useGitHubAuth } from "./hooks/useGitHubAuth";
import { EcranConnexionGitHub } from "./components/EcranConnexionGitHub";
import { ZoneDepot } from "./components/ZoneDepot";
import { analyzeProject } from "./services/projectAnalyzer";
import { listerCheminsRelatifs } from "./services/fileSystemUtils";
import {
  associerDepotDistant,
  ajouterEtCommiter,
  ignorerFichierSensible,
  initialiserDepot,
  mettreAJour,
  obtenirDivergenceDepot,
  obtenirEtatDepot,
  obtenirFichiersSensiblesAffectes,
  obtenirFichiersSensiblesSuivis,
  obtenirBrancheCourante,
  obtenirUrlDistante,
  preparerGitignore,
  publier,
  recupererMisesAJour,
  recuperer,
  type DivergenceDepot,
  type EtatDepot,
} from "./services/gitService";
import { creerOuRecupererDepot, verifierPublication } from "./services/githubService";
import type { AnalyseProjet } from "./types";
import {
  getInitialLanguage,
  saveLanguage,
  translations,
  translateError,
  type Language,
} from "./i18n";

function repoNameFromUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").split("/").pop()?.replace(/\.git$/i, "") ?? "";
}

function isGitHubUrl(url: string): boolean {
  return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?\/?$/i.test(url.trim());
}

export default function App() {
  const [lang, setLang] = useState<Language>(getInitialLanguage);
  const t = translations[lang];

  const auth = useGitHubAuth();
  const [step, setStep] = useState(1);
  const [directory, setDirectory] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyseProjet | null>(null);
  const [repoState, setRepoState] = useState<EtatDepot | null>(null);
  const [trackedSensitive, setTrackedSensitive] = useState<string[]>([]);
  const [remoteInput, setRemoteInput] = useState("");
  const [replaceRemoteConfirmed, setReplaceRemoteConfirmed] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [privateRepo, setPrivateRepo] = useState(true);
  const [commitMessage, setCommitMessage] = useState(t.syncStep.commitMsgPlaceholder);
  const [divergence, setDivergence] = useState<DivergenceDepot | null>(null);
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneParent, setCloneParent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [securityNoteVisible, setSecurityNoteVisible] = useState(true);
  const selectionEnCours = useRef(false);

  // Sync commit message default when language changes if untouched
  useEffect(() => {
    setCommitMessage((prev) =>
      prev === "Mise à jour du projet" || prev === "Project update" || prev === "Commit message" || prev === "Message du commit"
        ? t.syncStep.commitMsgPlaceholder
        : prev
    );
  }, [lang, t.syncStep.commitMsgPlaceholder]);

  const displayError = useCallback((err: unknown): string => {
    return translateError(err, lang);
  }, [lang]);

  const toggleLanguage = useCallback(() => {
    setLang((prev) => {
      const next = prev === "fr" ? "en" : "fr";
      saveLanguage(next);
      return next;
    });
  }, []);

  const cloneName = useMemo(() => repoNameFromUrl(cloneUrl), [cloneUrl]);
  const cloneTarget = useMemo(
    () => (cloneParent && cloneName ? `${cloneParent.replace(/[\\/]+$/, "")}/${cloneName}` : ""),
    [cloneParent, cloneName]
  );

  useEffect(() => {
    if (directory) setRepoName(directory.split(/[/\\]/).filter(Boolean).at(-1) ?? "");
  }, [directory]);

  const selectProject = useCallback(async (path: string) => {
    if (selectionEnCours.current || busy) return;
    selectionEnCours.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    setDivergence(null);
    try {
      const paths = await listerCheminsRelatifs(path);
      if (paths.length === 0) {
        throw new Error(lang === "fr" ? "Aucun fichier n’a été trouvé dans ce dossier." : "No files were found in this directory.");
      }
      const result = await analyzeProject(paths);
      const rootIsGit = result.hasExistingGit;
      let remoteUrl: string | null = null;
      let gitState: EtatDepot | null = null;
      let tracked: string[] = [];
      if (rootIsGit) {
        [remoteUrl, gitState, tracked] = await Promise.all([
          obtenirUrlDistante(path),
          obtenirEtatDepot(path),
          obtenirFichiersSensiblesSuivis(path),
        ]);
      }
      setDirectory(path);
      setAnalysis(result);
      setRepoState(gitState);
      setTrackedSensitive(tracked);
      setRemoteInput(remoteUrl ?? "");
      setReplaceRemoteConfirmed(false);
      setStep(1);
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      selectionEnCours.current = false;
      setBusy(false);
    }
  }, [busy, displayError, lang]);

  async function refreshProjectState() {
    if (!directory) return;
    setBusy(true);
    setError(null);
    try {
      const [state, sensitive] = await Promise.all([
        obtenirEtatDepot(directory),
        obtenirFichiersSensiblesSuivis(directory),
      ]);
      setRepoState(state);
      setTrackedSensitive(sensitive);
      setRemoteInput(state.remoteUrl ?? "");
      setDivergence(null);
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function associateRemote() {
    if (!directory) return;
    if (!isGitHubUrl(remoteInput)) {
      setError(
        lang === "fr"
          ? "Entre une URL HTTPS GitHub valide, par exemple https://github.com/compte/projet.git."
          : "Enter a valid GitHub HTTPS URL, for example https://github.com/account/project.git."
      );
      return;
    }
    if (repoState?.remoteUrl && repoState.remoteUrl !== remoteInput.trim() && !replaceRemoteConfirmed) {
      setReplaceRemoteConfirmed(true);
      setError(
        lang === "fr"
          ? "Cette action remplacera l’URL du dépôt distant actuel. Clique à nouveau pour confirmer."
          : "This action will replace the current remote repository URL. Click again to confirm."
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!analysis?.hasExistingGit) {
        await initialiserDepot(directory);
      }
      await associerDepotDistant(directory, remoteInput, {
        remplacerRemote: Boolean(repoState?.remoteUrl),
      });
      await refreshProjectState();
      setNotice(
        lang === "fr"
          ? "Le dépôt distant est associé à ce dossier."
          : "Remote repository successfully linked to this folder."
      );
      setReplaceRemoteConfirmed(false);
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function reviewSensitiveFile(filepath: string) {
    if (!directory) return;
    setBusy(true);
    setError(null);
    try {
      await ignorerFichierSensible(directory, filepath);
      const [paths, state, tracked] = await Promise.all([
        listerCheminsRelatifs(directory),
        obtenirEtatDepot(directory),
        obtenirFichiersSensiblesSuivis(directory),
      ]);
      setAnalysis(await analyzeProject(paths));
      setRepoState(state);
      setTrackedSensitive(tracked);
      setNotice(
        tracked.includes(filepath)
          ? (lang === "fr" ? `Impossible de retirer ${filepath} de l’index Git.` : `Could not remove ${filepath} from Git index.`)
          : (lang === "fr"
              ? `${filepath} est exclu des prochains commits. Son historique Git existant n’est pas effacé.`
              : `${filepath} is excluded from future commits. Existing Git history remains intact.`)
      );
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function refreshRemoteStatus() {
    if (!directory || !auth.token) return;
    setBusy(true);
    setError(null);
    try {
      setDivergence(await obtenirDivergenceDepot(directory, auth.token));
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function downloadGitHubChanges() {
    if (!directory || !auth.token || !repoState?.remoteUrl) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await recupererMisesAJour({ dir: directory, token: auth.token });
      const [state, sensitive] = await Promise.all([
        obtenirEtatDepot(directory),
        obtenirFichiersSensiblesSuivis(directory),
      ]);
      setRepoState(state);
      setTrackedSensitive(sensitive);
      setRemoteInput(state.remoteUrl ?? "");
      setDivergence(null);
      setNotice(
        lang === "fr"
          ? "Les commits disponibles sur GitHub ont été récupérés. Aucun changement local n’a été publié."
          : "Available commits from GitHub downloaded. No local changes were pushed."
      );
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function publishChanges() {
    if (!directory || !auth.token) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const currentSensitive = await obtenirFichiersSensiblesAffectes(directory);
      if (currentSensitive.length) {
        throw new Error(
          lang === "fr"
            ? `Publication bloquée : ces fichiers sensibles sont encore suivis par Git : ${currentSensitive.join(", ")}.`
            : `Publishing blocked: these sensitive files are still tracked by Git: ${currentSensitive.join(", ")}.`
        );
      }
      if (!repoState?.remoteUrl) {
        throw new Error(
          lang === "fr"
            ? "Associe d’abord un dépôt GitHub à ce projet."
            : "Please link a GitHub repository to this project first."
        );
      }
      if (repoState.changedFiles > 0) {
        await ajouterEtCommiter(directory, commitMessage.trim() || (lang === "fr" ? "Mise à jour du projet" : "Project update"), {
          name: auth.login ?? "GitHub User",
          email: `${auth.login ?? "user"}@users.noreply.github.com`,
        });
      }
      await mettreAJour({ dir: directory, token: auth.token });
      await refreshProjectState();
      setNotice(
        lang === "fr"
          ? "Synchronisation terminée sans forcer l’historique distant."
          : "Sync completed without forcing remote history."
      );
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function createAndPublish() {
    if (!directory || !auth.token) return;
    if (repoState?.remoteUrl) {
      setError(
        lang === "fr"
          ? "Un dépôt distant est déjà associé. Utilise « Publier mes modifications » ou confirme son remplacement dans l’étape d’association."
          : "A remote repository is already linked. Use 'Publish My Changes' or replace it in Step 1."
      );
      return;
    }
    if (!repoName.trim()) {
      setError(lang === "fr" ? "Indique un nom de dépôt." : "Please provide a repository name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const secrets = await obtenirFichiersSensiblesAffectes(directory);
      if (secrets.length) {
        throw new Error(
          lang === "fr"
            ? `Publication bloquée : fichiers sensibles encore suivis : ${secrets.join(", ")}.`
            : `Publishing blocked: sensitive files still tracked: ${secrets.join(", ")}.`
        );
      }
      if (!analysis?.hasExistingGit) await initialiserDepot(directory);
      await preparerGitignore(directory, analysis?.suggestedGitignore ?? "");
      const remote = await creerOuRecupererDepot(auth.token, {
        nom: repoName.trim(),
        prive: privateRepo,
      });
      await associerDepotDistant(directory, remote.clone_url);
      await ajouterEtCommiter(directory, lang === "fr" ? "Publication initiale" : "Initial commit", {
        name: auth.login ?? "GitHub User",
        email: `${auth.login ?? "user"}@users.noreply.github.com`,
      });
      await publier({ dir: directory, token: auth.token });
      const branch = await obtenirBrancheCourante(directory);
      await verifierPublication(auth.token, remote.owner.login, remote.name, branch);
      await refreshProjectState();
      setNotice(
        lang === "fr"
          ? `Dépôt publié avec succès : ${remote.html_url}`
          : `Repository published successfully: ${remote.html_url}`
      );
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function chooseCloneParent() {
    try {
      const selected = await openDirectory({ directory: true, multiple: false });
      if (typeof selected === "string") setCloneParent(selected);
    } catch (cause) {
      setError(displayError(cause));
    }
  }

  async function cloneRepository() {
    if (!auth.token) {
      setError(
        lang === "fr"
          ? "Connecte-toi à GitHub pour cloner un dépôt privé ou public."
          : "Sign in to GitHub to clone private or public repositories."
      );
      return;
    }
    if (!isGitHubUrl(cloneUrl) || !cloneName || !cloneParent) {
      setError(
        lang === "fr"
          ? "Renseigne une URL GitHub valide et choisis un dossier parent."
          : "Please provide a valid GitHub URL and select a parent folder."
      );
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const target = await join(cloneParent, cloneName);
      await recuperer({ dir: target, remoteUrl: cloneUrl.trim(), token: auth.token });
      setNotice(lang === "fr" ? `Dépôt cloné dans ${target}` : `Repository cloned into ${target}`);
      await selectProject(target);
      setStep(1);
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setBusy(false);
    }
  }

  const stepsList = useMemo(() => [
    { id: 1, label: t.steps.project, icon: FolderGit2 },
    { id: 2, label: t.steps.sensitive, icon: ShieldAlert },
    { id: 3, label: t.steps.sync, icon: RefreshCw },
    { id: 4, label: t.steps.clone, icon: GitFork },
  ], [t]);

  const activeStep = step === 4 ? 4 : step;

  return (
    <div className="min-h-screen bg-[#090909] text-slate-100">
      <header className="border-b border-slate-800 bg-[#111111]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600 font-bold text-white shadow-sm shadow-orange-600/30">GS</span>
            <div>
              <p className="font-semibold text-white">{t.app.title}</p>
              <p className="text-xs text-slate-400">{t.app.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#171717] px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-orange-500 hover:text-white"
              title={lang === "fr" ? "Switch to English" : "Passer en Français"}
            >
              <Languages size={14} className="text-orange-400" />
              <span>{lang === "fr" ? "🇬🇧 EN" : "🇫🇷 FR"}</span>
            </button>

            {auth.token ? (
              <>
                <span className="rounded-full border border-emerald-800 bg-emerald-950/50 px-3 py-1 text-sm text-emerald-300">
                  ● @{auth.login ?? t.app.connectedAs}
                </span>
                <button
                  type="button"
                  onClick={auth.deconnecter}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                  aria-label={t.app.disconnect}
                  title={t.app.disconnect}
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={auth.connecter}
                disabled={auth.enAttente}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
              >
                {auth.enAttente ? t.app.connecting : t.app.connectGitHub}
              </button>
            )}
          </div>
        </div>
      </header>

      {!auth.token && (auth.codeUtilisateur || auth.erreur) && (
        <div className="border-b border-slate-800 bg-[#111111] px-6 py-4">
          <div className="mx-auto max-w-2xl">
            <EcranConnexionGitHub
              codeUtilisateur={auth.codeUtilisateur}
              urlVerification={auth.urlVerification}
              codeExpireA={auth.codeExpireA}
              enAttente={auth.enAttente}
              erreur={auth.erreur}
              onConnecter={auth.connecter}
              lang={lang}
            />
          </div>
        </div>
      )}

      <nav className="border-b border-slate-800 bg-[#111111]">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {stepsList.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setStep(id);
                setError(null);
              }}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm transition ${
                activeStep === id
                  ? "border-orange-500 bg-orange-950/40 text-white"
                  : "border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <Icon size={16} />
              <span>{id}. {label}</span>
              {id === 1 && directory && <Check size={14} className="text-emerald-400" />}
              {id === 2 && analysis?.sensitiveFiles.length ? (
                <span className="rounded-full bg-amber-500/20 px-1.5 text-xs text-amber-300">
                  {analysis.sensitiveFiles.length}
                </span>
              ) : null}
            </button>
          ))}
          <div className="ml-auto hidden max-w-48 items-center truncate border-l border-slate-800 px-4 text-xs text-slate-400 lg:flex">
            {directory ?? t.app.noProject}
          </div>
        </div>
      </nav>

      <main className="mx-auto min-h-[calc(100vh-119px)] max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-5">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-semibold">
              {activeStep === 1 && <><FolderGit2 className="text-orange-400" />{t.headers.step1Title}</>}
              {activeStep === 2 && <><ShieldAlert className="text-amber-400" />{t.headers.step2Title}</>}
              {activeStep === 3 && <><RefreshCw className="text-emerald-400" />{t.headers.step3Title}</>}
              {activeStep === 4 && <><GitFork className="text-orange-400" />{t.headers.step4Title}</>}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {activeStep === 1 && t.headers.step1Desc}
              {activeStep === 2 && t.headers.step2Desc}
              {activeStep === 3 && t.headers.step3Desc}
              {activeStep === 4 && t.headers.step4Desc}
            </p>
          </div>
          {directory && activeStep < 4 && (
            <span className="rounded-md border border-emerald-800 bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-300">
              {repoState?.remoteUrl ? t.headers.badgeLinked : analysis?.hasExistingGit ? t.headers.badgeGit : t.headers.badgeFolder}
            </span>
          )}
        </div>

        {auth.token && auth.erreur && (
          <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-amber-900 bg-amber-950/40 p-3 text-sm text-amber-100">
            <span>{translateError(auth.erreur, lang)}</span>
            <button type="button" onClick={auth.effacerErreur} aria-label={t.common.close} className="shrink-0 text-amber-200 hover:text-white"><X size={17} /></button>
          </div>
        )}
        {error && (
          <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
            <span className="flex items-start gap-2"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{displayError(error)}</span>
            <button type="button" onClick={() => setError(null)} aria-label={t.common.close} className="shrink-0 text-red-200 hover:text-white"><X size={17} /></button>
          </div>
        )}
        {notice && (
          <div role="status" className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-200">
            <span className="flex items-start gap-2"><Check size={17} className="mt-0.5 shrink-0" />{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label={t.common.close} className="shrink-0 text-emerald-200 hover:text-white"><X size={17} /></button>
          </div>
        )}

        {activeStep === 1 && (
          <section className="space-y-5">
            <ZoneDepot
              action={null}
              erreur={null}
              disabled={busy}
              onFolderSelected={selectProject}
              onError={setError}
              lang={lang}
            />
            {busy && <Loading label={t.common.analyzingFolder} />}
            {directory && analysis && (
              <div className="rounded-xl border border-slate-800 bg-[#171717] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <Folder size={22} className="text-slate-300" />
                    <div>
                      <p className="text-xs text-slate-400">{t.projectStep.selectedFolder}</p>
                      <p className="break-all font-mono text-sm">{directory}</p>
                    </div>
                  </div>
                  <span className="text-sm text-slate-400">
                    {analysis.type} · {analysis.fileCount} {t.projectStep.filesCount}
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-800 bg-[#0d0d0d] p-4">
                    <label htmlFor="remote-url" className="mb-2 block text-sm font-medium">
                      {t.projectStep.remoteUrlLabel}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="remote-url"
                        value={remoteInput}
                        onChange={(event) => {
                          setRemoteInput(event.target.value);
                          setReplaceRemoteConfirmed(false);
                        }}
                        placeholder={t.projectStep.remoteUrlPlaceholder}
                        className="min-w-0 flex-1 rounded-md border border-slate-700 bg-[#090909] px-3 py-2 font-mono text-xs outline-none focus:border-orange-500"
                      />
                      <button
                        type="button"
                        onClick={() => void associateRemote()}
                        disabled={busy || !auth.token}
                        className="rounded-md bg-orange-600 px-3 py-2 text-xs font-semibold hover:bg-orange-500 disabled:opacity-40"
                      >
                        {repoState?.remoteUrl ? t.projectStep.updateRemoteBtn : t.projectStep.saveRemoteBtn}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-[#0d0d0d] p-4">
                    <p className="mb-2 text-sm font-medium">{t.projectStep.folderAccess}</p>
                    <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 text-slate-300"><ShieldCheck size={16} className="text-emerald-400" />{t.projectStep.folderAccessGranted}</span>
                      <span className="text-emerald-400 font-medium">OK</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{t.projectStep.folderAccessDesc}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-300">
                  <span className="font-semibold text-orange-300">{t.projectStep.gitRootTitle}</span>{" "}
                  {analysis.hasExistingGit
                    ? t.projectStep.gitRootPresent
                    : t.projectStep.gitRootAbsent}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setStep(2); setError(null); setNotice(null); }}
                    className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold hover:bg-orange-500"
                  >
                    {t.projectStep.continueBtn} <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {activeStep === 2 && (
          <section className="space-y-5">
            {!directory || !analysis ? (
              <div className="rounded-xl border border-dashed border-slate-700 bg-[#171717] p-6 text-center text-sm text-slate-300">
                {t.sensitiveStep.noProjectSelected}
              </div>
            ) : (
              <>
                {securityNoteVisible && (
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-800 bg-amber-950/30 p-4 text-amber-200">
                    <div className="flex gap-3">
                      <AlertTriangle size={19} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold">{t.sensitiveStep.warningTitle}</p>
                        <p className="mt-1 text-sm text-amber-200/80">{t.sensitiveStep.warningDesc}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setSecurityNoteVisible(false)} aria-label={t.common.dismiss} className="shrink-0 text-amber-200 hover:text-white"><X size={17} /></button>
                  </div>
                )}
                <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#171717]">
                  <div className="grid grid-cols-[1fr_auto] bg-slate-800/60 px-4 py-3 text-xs font-medium text-slate-300">
                    <span>{t.sensitiveStep.colFile}</span><span>{t.sensitiveStep.colAction}</span>
                  </div>
                  {analysis.sensitiveFiles.length === 0 ? (
                    <div className="flex items-center gap-3 p-6 text-sm text-emerald-300">
                      <ShieldCheck size={20} />{t.sensitiveStep.noSensitiveDetected}
                    </div>
                  ) : analysis.sensitiveFiles.map((filepath) => {
                    const tracked = trackedSensitive.includes(filepath);
                    return (
                      <div key={filepath} className="grid grid-cols-1 items-start gap-3 border-t border-slate-800 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
                        <div>
                          <p className="font-mono text-sm">{filepath}</p>
                          <p className={`mt-1 text-xs ${tracked ? "text-red-300" : "text-amber-300"}`}>
                            {tracked ? t.sensitiveStep.trackedDanger : t.sensitiveStep.untrackedWarn}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void reviewSensitiveFile(filepath)}
                          className={`rounded-md px-3 py-2 text-xs font-semibold disabled:opacity-50 ${tracked ? "bg-red-700 hover:bg-red-600" : "bg-amber-700 hover:bg-amber-600"}`}
                        >
                          {tracked ? <><Unlink size={13} className="mr-1 inline" />{t.sensitiveStep.untrackBtn}</> : t.sensitiveStep.ignoreBtn}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between">
                  <button type="button" onClick={() => setStep(1)} className="rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">{t.sensitiveStep.backBtn}</button>
                  <button type="button" onClick={() => setStep(3)} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold hover:bg-orange-500">
                    {t.sensitiveStep.continueBtn} <ChevronRight size={16} />
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {activeStep === 3 && (
          <section className="space-y-5">
            {!directory || !repoState ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-dashed border-slate-700 bg-[#171717] p-6 text-center text-sm text-slate-300">
                  {t.syncStep.noProjectSelected}
                </div>
                {directory && analysis && (
                  <div className="rounded-xl border border-slate-800 bg-[#171717] p-5">
                    <h2 className="mb-2 font-semibold">{t.syncStep.firstPublishTitle}</h2>
                    <p className="mb-4 text-sm text-slate-400">{t.syncStep.firstPublishDesc}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <input value={repoName} onChange={(event) => setRepoName(event.target.value)} placeholder={t.syncStep.repoNamePlaceholder} className="rounded-md border border-slate-700 bg-[#090909] px-3 py-2 text-sm" />
                      {/* Sélecteur Privé / Public */}
                      <div className="flex rounded-md border border-slate-700 text-sm overflow-hidden" role="group" aria-label={lang === "fr" ? "Visibilité du dépôt" : "Repository visibility"}>
                        <button
                          type="button"
                          id="visibility-private"
                          onClick={() => setPrivateRepo(true)}
                          className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${privateRepo ? "bg-orange-600 text-white font-semibold" : "bg-[#090909] text-slate-400 hover:text-slate-200"}`}
                          aria-pressed={privateRepo}
                        >
                          🔒 {t.syncStep.privateRepoCheckbox}
                        </button>
                        <button
                          type="button"
                          id="visibility-public"
                          onClick={() => setPrivateRepo(false)}
                          className={`flex items-center gap-1.5 px-3 py-2 border-l border-slate-700 transition-colors ${!privateRepo ? "bg-emerald-700 text-white font-semibold" : "bg-[#090909] text-slate-400 hover:text-slate-200"}`}
                          aria-pressed={!privateRepo}
                        >
                          🌐 {t.syncStep.publicRepoLabel}
                        </button>
                      </div>
                      <button type="button" onClick={() => void createAndPublish()} disabled={busy || !auth.token} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40">
                        <CloudUpload size={15} className="mr-1 inline" />{t.syncStep.createAndPublishBtn}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#171717] px-3 py-2 text-sm">
                    <GitBranch size={16} className="text-orange-300" />{t.syncStep.branchLabel} <strong>{repoState.branch}</strong>
                  </div>
                  <button type="button" onClick={() => void refreshProjectState()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50">
                    <RefreshCw size={15} />{t.syncStep.refreshBtn}
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard icon={<CloudUpload />} title={String(divergence?.ahead ?? "—")} detail={t.syncStep.statAhead} color="orange" />
                  <StatCard icon={<CloudDownload />} title={String(divergence?.behind ?? "—")} detail={t.syncStep.statBehind} color="amber" />
                  <StatCard icon={<Check />} title={repoState.changedFiles ? `${repoState.changedFiles} ${t.projectStep.filesCount}` : t.syncStep.statClean} detail={repoState.changedFiles ? t.syncStep.statLocalChanges : t.syncStep.statLocalState} color={repoState.changedFiles ? "amber" : "emerald"} />
                </div>
                {divergence?.truncated && <p className="text-xs text-amber-300">{t.syncStep.divergenceTruncated}</p>}
                <div className="rounded-xl border border-slate-800 bg-[#171717] p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <h2 className="font-semibold">{t.syncStep.actionsTitle}</h2>
                      <p className="mt-1 text-xs text-slate-400">{t.syncStep.actionsDesc}</p>
                    </div>
                    <button type="button" onClick={() => void refreshRemoteStatus()} disabled={busy || !auth.token || !repoState.remoteUrl} className="rounded-md border border-slate-700 px-3 py-2 text-xs hover:bg-slate-800 disabled:opacity-40">
                      {t.syncStep.compareBtn}
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-800 bg-[#0d0d0d] p-4">
                      <h3 className="font-medium"><CloudDownload size={16} className="mr-2 inline text-orange-300" />{t.syncStep.updateCardTitle}</h3>
                      <p className="my-3 text-xs text-slate-400">{t.syncStep.updateCardDesc}</p>
                      <button type="button" onClick={() => void downloadGitHubChanges()} disabled={busy || !auth.token || !repoState.remoteUrl} className="w-full rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold hover:bg-orange-500 disabled:opacity-40">
                        {t.syncStep.updateBtn}
                      </button>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-[#0d0d0d] p-4">
                      <h3 className="font-medium"><CloudUpload size={16} className="mr-2 inline text-emerald-300" />{t.syncStep.publishCardTitle}</h3>
                      <p className="my-3 text-xs text-slate-400">{t.syncStep.publishCardDesc}</p>
                      <input value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} aria-label={t.syncStep.commitMsgPlaceholder} placeholder={t.syncStep.commitMsgPlaceholder} className="mb-2 w-full rounded-md border border-slate-700 bg-[#090909] px-3 py-2 text-xs" />
                      <button type="button" onClick={() => void publishChanges()} disabled={busy || !auth.token || !repoState.remoteUrl} className="w-full rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40">
                        {t.syncStep.publishBtn}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#171717] p-5">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">{t.syncStep.recentHistoryTitle}</h2>
                  {repoState.recentCommits.length ? (
                    <ul className="space-y-3">
                      {repoState.recentCommits.map((commit) => (
                        <li key={commit.oid} className="flex items-start gap-3 text-sm">
                          <code className="rounded border border-orange-900 bg-orange-950/40 px-2 py-0.5 text-xs text-orange-200">{commit.oid}</code>
                          <span className="min-w-0 flex-1 truncate">{commit.message || t.syncStep.unnamedCommit}</span>
                          <time className="shrink-0 text-xs text-slate-500">{new Date(commit.timestamp * 1000).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}</time>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-slate-400">{t.syncStep.noCommits}</p>}
                </div>
              </>
            )}
          </section>
        )}

        {activeStep === 4 && (
          <section className="mx-auto max-w-3xl rounded-xl border border-slate-800 bg-[#171717] p-5">
            <div className="mb-5 flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="font-semibold">{t.cloneStep.title}</h2>
                <p className="mt-1 text-sm text-slate-400">{t.cloneStep.desc}</p>
              </div>
              <span className="rounded-md border border-orange-900 bg-orange-950/30 px-2 py-1 text-xs text-orange-300">{t.cloneStep.badge}</span>
            </div>
            <label htmlFor="clone-url" className="mb-1 block text-sm">{t.cloneStep.urlLabel}</label>
            <input id="clone-url" value={cloneUrl} onChange={(event) => setCloneUrl(event.target.value)} placeholder={t.cloneStep.urlPlaceholder} className="mb-4 w-full rounded-md border border-slate-700 bg-[#090909] px-3 py-2 font-mono text-xs outline-none focus:border-orange-500" />
            <label className="mb-1 block text-sm">{t.cloneStep.parentLabel}</label>
            <div className="mb-4 flex gap-2">
              <input value={cloneParent} readOnly placeholder={t.cloneStep.parentPlaceholder} className="min-w-0 flex-1 rounded-md border border-slate-700 bg-[#090909] px-3 py-2 font-mono text-xs" />
              <button type="button" onClick={() => void chooseCloneParent()} className="rounded-md bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"><Folder size={15} className="mr-1 inline" />{t.cloneStep.browseBtn}</button>
            </div>
            <div className="rounded-lg border border-orange-900 bg-orange-950/20 p-4">
              <p className="mb-2 text-sm font-medium"><FolderGit2 size={15} className="mr-2 inline text-orange-300" />{t.cloneStep.subfolderLabel}</p>
              <code className="block break-all rounded bg-[#090909] px-3 py-2 text-xs text-emerald-300">{cloneTarget || t.cloneStep.selectPrompt}</code>
              <p className="mt-2 text-xs text-slate-400">{t.cloneStep.warningNotice}</p>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button type="button" onClick={() => setStep(1)} className="rounded-md bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700">{t.cloneStep.cancelBtn}</button>
              <button type="button" onClick={() => void cloneRepository()} disabled={busy || !auth.token} className="rounded-md bg-orange-600 px-4 py-2.5 text-sm font-semibold hover:bg-orange-500 disabled:opacity-40">
                <CloudDownload size={15} className="mr-2 inline" />{t.cloneStep.cloneBtn}
              </button>
            </div>
          </section>
        )}

        {busy && (
          <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center bg-black/20">
            <LoaderCircle className="animate-spin text-orange-400" size={36} />
          </div>
        )}
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-[#111111] px-4 py-2 text-xs text-slate-500 sm:px-6">
        <span><span className="mr-2 text-emerald-400">●</span>{t.app.footerTech}</span>
        <a className="inline-flex items-center gap-1 hover:text-slate-300" href="https://github.com" target="_blank" rel="noreferrer">GitHub <ExternalLink size={11} /></a>
      </footer>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return <p className="mt-3 flex items-center gap-2 text-sm text-slate-400"><LoaderCircle size={15} className="animate-spin" />{label}</p>;
}

function StatCard({
  icon,
  title,
  detail,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  color: "orange" | "amber" | "emerald";
}) {
  const style = {
    orange: "bg-orange-950/50 text-orange-300",
    amber: "bg-amber-950/50 text-amber-300",
    emerald: "bg-emerald-950/50 text-emerald-300",
  }[color];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#171717] p-4">
      <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${style}`}>{icon}</span>
      <div><p className="text-xl font-semibold">{title}</p><p className="text-xs text-slate-400">{detail}</p></div>
    </div>
  );
}
