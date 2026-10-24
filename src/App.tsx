import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { open as openDirectory } from "@tauri-apps/plugin-dialog";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CloudDownload,
  CloudUpload,
  Folder,
  FolderGit2,
  FolderPlus,
  GitBranch,
  GitFork,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Unlink,
  X,
} from "lucide-react";
import { useGitHubAuth } from "./hooks/useGitHubAuth";
import { EcranConnexionGitHub } from "./components/EcranConnexionGitHub";
import { ExplorateurFichiers } from "./components/ExplorateurFichiers";
import { SettingsModal, type AccentColor, type ThemeMode } from "./components/SettingsModal";
import { ZoneDepot } from "./components/ZoneDepot";
import { analyzeProject } from "./services/projectAnalyzer";
import { listerCheminsRelatifs } from "./services/fileSystemUtils";
import {
  associerDepotDistant,
  ajouterEtCommiter,
  ignorerFichierSensible,
  initialiserDepot,
  mettreAJour,
  obtenirEtatDepot,
  obtenirFichiersSensiblesAffectes,
  obtenirFichiersSensiblesSuivis,
  obtenirBrancheCourante,
  obtenirUrlDistante,
  preparerGitignore,
  publier,
  recuperer,
  type EtatDepot,
} from "./services/gitService";
import { creerOuRecupererDepot, verifierPublication } from "./services/githubService";
import type { AnalyseProjet, ProgressionGit } from "./types";
import {
  getInitialLanguage,
  getTranslations,
  saveLanguage,
  translateError,
  type Language,
} from "./i18n";

const appLogo = new URL("../src-tauri/icons/icon.png", import.meta.url).href;

function repoNameFromUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").split("/").pop()?.replace(/\.git$/i, "") ?? "";
}

function isGitHubUrl(url: string): boolean {
  return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?\/?$/i.test(url.trim());
}

interface ProgressionAffichee {
  percent: number;
  label: string;
  complete: boolean;
}

export default function App() {
  const [lang, setLang] = useState<Language>(getInitialLanguage);
  const t = getTranslations(lang);

  const auth = useGitHubAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try { return localStorage.getItem("gsimplifie-theme") === "light" ? "light" : "dark"; } catch { return "dark"; }
  });
  const [accent, setAccent] = useState<AccentColor>(() => {
    try {
      const value = localStorage.getItem("gsimplifie-accent");
      return value === "blue" || value === "violet" || value === "green" ? value : "orange";
    } catch { return "orange"; }
  });
  const [step, setStep] = useState(1);
  const [directory, setDirectory] = useState<string | null>(null);
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<AnalyseProjet | null>(null);
  const [repoState, setRepoState] = useState<EtatDepot | null>(null);
  const [trackedSensitive, setTrackedSensitive] = useState<string[]>([]);
  const [remoteInput, setRemoteInput] = useState("");
  const [replaceRemoteConfirmed, setReplaceRemoteConfirmed] = useState(false);
  const [repoName, setRepoName] = useState("");
  const [privateRepo, setPrivateRepo] = useState(true);
  const [commitMessage, setCommitMessage] = useState(t.syncStep.commitMsgPlaceholder);
  const [hiddenCommits, setHiddenCommits] = useState<string[]>([]);
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneParent, setCloneParent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [securityNoteVisible, setSecurityNoteVisible] = useState(true);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [progress, setProgress] = useState<ProgressionAffichee | null>(null);
  const progressFrame = useRef<number | null>(null);
  const pendingProgress = useRef<ProgressionAffichee | null>(null);
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

  const changeLanguage = useCallback((next: Language) => {
    saveLanguage(next);
    setLang(next);
  }, []);

  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = accent;
    try {
      localStorage.setItem("gsimplifie-theme", theme);
      localStorage.setItem("gsimplifie-accent", accent);
    } catch {
      setError(lang === "fr" ? "Les préférences ne peuvent pas être enregistrées sur cet appareil." : "Preferences could not be saved on this device.");
    }
  }, [accent, lang, theme]);

  const cloneName = useMemo(() => repoNameFromUrl(cloneUrl), [cloneUrl]);
  const cloneTarget = useMemo(
    () => (cloneParent && cloneName
      ? `${cloneParent.replace(/[\\/]+$/, "")}${cloneParent.includes("\\") ? "\\" : "/"}${cloneName}`
      : ""),
    [cloneParent, cloneName]
  );

  useEffect(() => {
    if (directory) setRepoName(directory.split(/[/\\]/).filter(Boolean).at(-1) ?? "");
  }, [directory]);

  const selectProject = useCallback(async (path: string, keepBusy = false) => {
    if (selectionEnCours.current || (busy && !keepBusy)) return;
    selectionEnCours.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await invoke("autoriser_dossier_projet", { chemin: path });
      const paths = await listerCheminsRelatifs(path);
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
      setProjectFiles(paths.filter((filepath) => filepath !== ".git"));
      setAnalysis(result);
      setRepoState(gitState);
      setTrackedSensitive(tracked);
      setRemoteInput(remoteUrl ?? "");
      setReplaceRemoteConfirmed(false);
      setHiddenCommits([]);
      setStep(1);
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      selectionEnCours.current = false;
      if (!keepBusy) setBusy(false);
    }
  }, [busy, displayError, lang]);

  async function refreshProjectState(keepBusy = false) {
    if (!directory) return;
    if (!keepBusy) setBusy(true);
    setError(null);
    try {
      const [state, sensitive] = await Promise.all([
        obtenirEtatDepot(directory),
        obtenirFichiersSensiblesSuivis(directory),
      ]);
      setRepoState(state);
      setTrackedSensitive(sensitive);
      setRemoteInput(state.remoteUrl ?? "");
    } catch (cause) {
      setError(displayError(cause));
      throw cause;
    } finally {
      if (!keepBusy) setBusy(false);
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
      await refreshProjectState(true);
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
      setProjectFiles(paths.filter((filepath) => filepath !== ".git"));
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

  function suivreProgressionGit(evt: ProgressionGit, label: string) {
    const phase = evt.phase.toLowerCase();
    const [start, span] = phase.includes("count")
      ? [5, 10]
      : phase.includes("compress")
        ? [15, 20]
        : phase.includes("receiv") || phase.includes("fetch")
          ? [35, 45]
          : phase.includes("resolv")
            ? [82, 13]
            : [10, 75];
    const ratio = evt.total && evt.total > 0 ? Math.min(1, (evt.loaded ?? 0) / evt.total) : 0;
    const estimate = Math.min(95, Math.round(start + span * ratio));
    pendingProgress.current = {
      percent: Math.max(pendingProgress.current?.percent ?? progress?.percent ?? 0, estimate),
      label,
      complete: false,
    };
    if (progressFrame.current === null) {
      progressFrame.current = window.requestAnimationFrame(() => {
        progressFrame.current = null;
        if (pendingProgress.current) setProgress(pendingProgress.current);
      });
    }
  }

  async function afficherFinOperation(label: string) {
    if (progressFrame.current !== null) {
      window.cancelAnimationFrame(progressFrame.current);
      progressFrame.current = null;
    }
    pendingProgress.current = null;
    setProgress({ percent: 100, label, complete: true });
    await new Promise((resolve) => window.setTimeout(resolve, 850));
  }

  function effacerProgression() {
    if (progressFrame.current !== null) window.cancelAnimationFrame(progressFrame.current);
    progressFrame.current = null;
    pendingProgress.current = null;
    setProgress(null);
  }

  async function publishChanges() {
    if (!directory || !auth.token) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setProgress({ percent: 0, label: t.operationProgress.publishing, complete: false });
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
        setProgress({ percent: 12, label: t.operationProgress.publishing, complete: false });
        await ajouterEtCommiter(directory, commitMessage.trim() || (lang === "fr" ? "Mise à jour du projet" : "Project update"), {
          name: auth.login ?? "GitHub User",
          email: `${auth.login ?? "user"}@users.noreply.github.com`,
        });
      }
      await mettreAJour({
        dir: directory,
        token: auth.token,
        onProgress: (evt) => suivreProgressionGit(evt, t.operationProgress.publishing),
      });
      await refreshProjectState(true);
      await afficherFinOperation(t.operationProgress.completed);
      setNotice(
        lang === "fr"
          ? "Synchronisation terminée sans forcer l’historique distant."
          : "Sync completed without forcing remote history."
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(
        /(?:http(?: error)?[: ]+)?404\b|not found/i.test(message)
          ? lang === "fr"
            ? "Dépôt GitHub introuvable ou inaccessible. Vérifie l’URL et les droits de ton compte, puis réessaie."
            : "GitHub repository not found or inaccessible. Check the URL and your account access, then try again."
          : displayError(cause)
      );
    } finally {
      setBusy(false);
      effacerProgression();
    }
  }

  async function createAndPublish() {
    if (!directory || !auth.token) return;
    if (repoState?.remoteUrl) {
      setError(
        lang === "fr"
          ? "Un dépôt distant est déjà associé. Utilise le bouton « Mettre à jour le projet » ou confirme son remplacement dans l’étape Projet."
          : "A remote repository is already linked. Use 'Update project' or replace it in the Project step."
      );
      return;
    }
    if (!repoName.trim()) {
      setError(lang === "fr" ? "Indique un nom de dépôt." : "Please provide a repository name.");
      return;
    }
    setBusy(true);
    setError(null);
    setProgress({ percent: 0, label: t.operationProgress.publishing, complete: false });
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
      setProgress({ percent: 12, label: t.operationProgress.publishing, complete: false });
      await ajouterEtCommiter(directory, lang === "fr" ? "Publication initiale" : "Initial commit", {
        name: auth.login ?? "GitHub User",
        email: `${auth.login ?? "user"}@users.noreply.github.com`,
      });
      await publier({
        dir: directory,
        token: auth.token,
        onProgress: (evt) => suivreProgressionGit(evt, t.operationProgress.publishing),
      });
      const branch = await obtenirBrancheCourante(directory);
      await verifierPublication(auth.token, remote.owner.login, remote.name, branch);
      await refreshProjectState(true);
      await afficherFinOperation(t.operationProgress.completed);
      setNotice(
        lang === "fr"
          ? `Dépôt publié avec succès : ${remote.html_url}`
          : `Repository published successfully: ${remote.html_url}`
      );
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(
        /(?:http(?: error)?[: ]+)?404\b|not found/i.test(message)
          ? lang === "fr"
            ? "Dépôt GitHub introuvable ou inaccessible. Vérifie l’URL et les droits de ton compte, puis réessaie."
            : "GitHub repository not found or inaccessible. Check the URL and your account access, then try again."
          : displayError(cause)
      );
    } finally {
      setBusy(false);
      effacerProgression();
    }
  }

  async function chooseCloneParent() {
    try {
      const selected = await openDirectory({ directory: true, multiple: false });
      if (typeof selected === "string") {
        await invoke("autoriser_dossier_projet", { chemin: selected });
        setCloneParent(selected);
      }
    } catch (cause) {
      setError(displayError(cause));
    }
  }

  async function cloneRepository() {
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
    setProgress({ percent: 0, label: t.operationProgress.cloning, complete: false });
    try {
      const target = await join(cloneParent, cloneName);
      await recuperer({
        dir: target,
        remoteUrl: cloneUrl.trim(),
        token: auth.token ?? "",
        onProgress: (evt) => suivreProgressionGit(evt, t.operationProgress.cloning),
      });
      await selectProject(target, true);
      setNotice(lang === "fr" ? `Dépôt cloné dans ${target}` : `Repository cloned into ${target}`);
      setStep(1);
      await afficherFinOperation(t.operationProgress.completed);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(
        /(?:http(?: error)?[: ]+)?404\b|not found/i.test(message)
          ? lang === "fr"
            ? "Dépôt GitHub introuvable ou inaccessible. Vérifie l’URL; pour un dépôt privé, connecte-toi au compte autorisé."
            : "GitHub repository not found or inaccessible. Check the URL; for a private repository, sign in to an authorized account."
          : displayError(cause)
      );
    } finally {
      setBusy(false);
      effacerProgression();
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
    <div className="app-shell min-h-screen bg-[#090909] text-slate-100">
      <header className="border-b border-slate-800 bg-[#111111]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <img src={appLogo} alt="" className="h-9 w-9 rounded-xl object-contain" />
            <div>
              <p className="font-semibold text-white">{t.app.title}</p>
              <p className="text-xs text-slate-400">{t.app.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#171717] px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-orange-500 hover:text-white"
              title={lang === "fr" ? "Paramètres" : lang === "es" ? "Ajustes" : lang === "ar" ? "الإعدادات" : "Settings"}
            >
              <Settings size={14} className="text-orange-400" />
              <span>{lang === "fr" ? "Paramètres" : lang === "es" ? "Ajustes" : lang === "ar" ? "الإعدادات" : "Settings"}</span>
            </button>

            {auth.token ? (
              <>
                <span className="rounded-full border border-emerald-800 bg-emerald-950/50 px-3 py-1 text-sm text-emerald-300">
                  ● @{auth.login ?? t.app.connectedAs}
                </span>
                <button
                  type="button"
                  onClick={() => setShowDisconnectConfirm(true)}
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
                onClick={() => {
                  if (auth.comptes.length) setAccountPickerOpen(true);
                  else auth.connecter();
                }}
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
            {busy && <Loading label={t.common.analyzingFolder} />}
            {directory && analysis && (
              <div className="rounded-xl border border-slate-800 bg-[#171717] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <Folder size={22} className="text-slate-300" />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-400">{t.projectStep.selectedFolder} · {t.projectStep.localPathLabel}</p>
                      <p className="break-all font-mono text-sm">{directory}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm text-slate-400">
                    {analysis.type} · {analysis.fileCount} {t.projectStep.filesCount}
                  </span>
                </div>
                <ExplorateurFichiers directory={directory} files={projectFiles} lang={lang} />
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
            {directory && analysis ? (
              <button
                type="button"
                onClick={() => {
                  void openDirectory({ directory: true, multiple: false })
                    .then((path) => {
                      if (typeof path === "string") return selectProject(path);
                    })
                    .catch((cause: unknown) => setError(displayError(cause)));
                }}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                <FolderPlus size={15} />
                {lang === "fr" ? "Choisir un autre dossier" : "Choose another folder"}
              </button>
            ) : (
              <ZoneDepot
                action={null}
                erreur={null}
                disabled={busy}
                onFolderSelected={selectProject}
                onError={setError}
                lang={lang}
              />
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
            {!directory || !analysis ? (
              <div className="rounded-xl border border-dashed border-slate-700 bg-[#171717] p-6 text-center text-sm text-slate-300">
                {t.syncStep.noProjectSelected}
              </div>
            ) : !repoState?.remoteUrl ? (
              <div className="rounded-xl border border-slate-800 bg-[#171717] p-5">
                <h2 className="mb-2 font-semibold">{t.syncStep.firstPublishTitle}</h2>
                <p className="mb-4 text-sm text-slate-400">{t.syncStep.firstPublishDesc}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    value={repoName}
                    onChange={(event) => setRepoName(event.target.value)}
                    placeholder={t.syncStep.repoNamePlaceholder}
                    className="min-w-0 flex-1 rounded-md border border-slate-700 bg-[#090909] px-3 py-2 text-sm sm:max-w-xs"
                  />
                  <div className="flex overflow-hidden rounded-md border border-slate-700 text-sm" role="group" aria-label={lang === "fr" ? "Visibilité du dépôt" : "Repository visibility"}>
                    <button
                      type="button"
                      onClick={() => setPrivateRepo(true)}
                      className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${privateRepo ? "bg-orange-600 font-semibold text-white" : "bg-[#090909] text-slate-400 hover:text-slate-200"}`}
                      aria-pressed={privateRepo}
                    >
                      🔒 {t.syncStep.privateRepoCheckbox}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrivateRepo(false)}
                      className={`flex items-center gap-1.5 border-l border-slate-700 px-3 py-2 transition-colors ${!privateRepo ? "bg-emerald-700 font-semibold text-white" : "bg-[#090909] text-slate-400 hover:text-slate-200"}`}
                      aria-pressed={!privateRepo}
                    >
                      🌐 {t.syncStep.publicRepoLabel}
                    </button>
                  </div>
                  <button type="button" onClick={() => void createAndPublish()} disabled={busy || !auth.token} className="rounded-md bg-emerald-700 px-4 py-2 font-semibold hover:bg-emerald-600 disabled:opacity-40">
                    <CloudUpload size={15} className="mr-1 inline" />{t.syncStep.createAndPublishBtn}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-700 bg-[#171717] px-3 py-3 text-sm">
                    <GitBranch size={16} className="shrink-0 text-orange-300" />
                    <span>{t.syncStep.branchLabel}</span>
                    <strong className="truncate">{repoState.branch}</strong>
                  </div>
                  <StatCard
                    icon={<Check />}
                    title={repoState.changedFiles ? `${repoState.changedFiles} ${t.projectStep.filesCount}` : t.syncStep.statClean}
                    detail={repoState.changedFiles ? t.syncStep.statLocalChanges : t.syncStep.statLocalState}
                    color={repoState.changedFiles ? "amber" : "emerald"}
                  />
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#171717] p-5">
                  <h2 className="font-semibold">{t.syncStep.actionsTitle}</h2>
                  <p className="mt-1 text-xs text-slate-400">{t.syncStep.actionsDesc}</p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      value={commitMessage}
                      onChange={(event) => setCommitMessage(event.target.value)}
                      aria-label={t.syncStep.commitMsgPlaceholder}
                      placeholder={t.syncStep.commitMsgPlaceholder}
                      className="min-w-0 flex-1 rounded-md border border-slate-700 bg-[#090909] px-3 py-2 text-sm"
                    />
                    <button type="button" onClick={() => void publishChanges()} disabled={busy || !auth.token} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40">
                      <CloudUpload size={15} className="mr-1 inline" />{t.syncStep.publishBtn}
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#171717] p-5">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">{t.syncStep.recentHistoryTitle}</h2>
                  {repoState.recentCommits.some((commit) => !hiddenCommits.includes(commit.oid)) ? (
                    <ul className="space-y-3">
                      {repoState.recentCommits.filter((commit) => !hiddenCommits.includes(commit.oid)).map((commit) => (
                        <li key={commit.oid} className="flex min-w-0 items-start gap-3 text-sm">
                          <code className="shrink-0 rounded border border-orange-900 bg-orange-950/40 px-2 py-0.5 text-xs text-orange-200">{commit.oid}</code>
                          <span className="min-w-0 flex-1 truncate">{commit.message || t.syncStep.unnamedCommit}</span>
                          <time className="hidden shrink-0 text-xs text-slate-500 sm:block">{new Date(commit.timestamp * 1000).toLocaleString(lang === "fr" ? "fr-FR" : "en-US")}</time>
                          <button
                            type="button"
                            onClick={() => setHiddenCommits((current) => [...current, commit.oid])}
                            className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-white"
                            aria-label={t.dialogs.hideCommit}
                            title={t.dialogs.hideCommit}
                          >
                            <X size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-slate-400">{t.syncStep.noCommits}</p>}
                  <p className="mt-3 text-xs text-slate-500">{lang === "fr" ? "Masquer un élément ne supprime pas le commit Git." : "Hiding an item does not delete the Git commit."}</p>
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
              <button type="button" onClick={() => void cloneRepository()} disabled={busy} className="rounded-md bg-orange-600 px-4 py-2.5 text-sm font-semibold hover:bg-orange-500 disabled:opacity-40">
                <CloudDownload size={15} className="mr-2 inline" />{t.cloneStep.cloneBtn}
              </button>
            </div>
          </section>
        )}

        {busy && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4" role="status" aria-live="polite">
            {progress ? (
              <div className="w-full max-w-md rounded-xl border border-slate-700 bg-[#171717] p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <p className="min-w-0 truncate text-sm font-medium text-slate-100">{progress.label}</p>
                  <span className="shrink-0 font-mono text-sm text-slate-300">{progress.percent}%</span>
                </div>
                <div
                  className="relative h-3 overflow-hidden rounded-full bg-slate-800"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress.percent}
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${progress.complete ? "bg-emerald-500" : "bg-orange-500"}`}
                    style={{ width: `${progress.percent}%` }}
                  />
                  {progress.complete && (
                    <span className="check-sweep absolute top-1/2 flex -translate-y-1/2 items-center text-emerald-200">
                      <Check size={15} strokeWidth={3} />
                    </span>
                  )}
                </div>
                {progress.complete && <p className="mt-3 text-right text-sm font-medium text-emerald-300">{t.operationProgress.completed}</p>}
              </div>
            ) : (
              <LoaderCircle className="animate-spin text-orange-400" size={36} />
            )}
          </div>
        )}
      </main>

        <SettingsModal
          open={settingsOpen}
          language={lang}
          theme={theme}
          accent={accent}
          onClose={() => setSettingsOpen(false)}
          onLanguageChange={changeLanguage}
          onThemeChange={setTheme}
          onAccentChange={setAccent}
        />

        {showDisconnectConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="disconnect-title" className="w-full max-w-md rounded-xl border border-slate-700 bg-[#171717] p-6 shadow-2xl">
            <h2 id="disconnect-title" className="text-lg font-semibold">{t.dialogs.disconnectTitle}</h2>
            <p className="mt-2 text-sm text-slate-400">{t.dialogs.disconnectDescription}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setShowDisconnectConfirm(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
                {t.dialogs.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDisconnectConfirm(false);
                  void auth.deconnecter().then(() => setAccountPickerOpen(auth.comptes.length > 0));
                }}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                {t.dialogs.confirmDisconnect}
              </button>
            </div>
          </section>
        </div>
      )}

      {accountPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="accounts-title" className="w-full max-w-md rounded-xl border border-slate-700 bg-[#171717] p-5 shadow-2xl">
            <header className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 id="accounts-title" className="text-lg font-semibold">{lang === "fr" ? "Comptes GitHub enregistrés" : lang === "es" ? "Cuentas GitHub guardadas" : lang === "ar" ? "حسابات GitHub المحفوظة" : "Saved GitHub accounts"}</h2>
              <button type="button" onClick={() => setAccountPickerOpen(false)} aria-label={t.common.close} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18} /></button>
            </header>
            <div className="space-y-2">
              {auth.comptes.map((login) => (
                <div key={login} className="flex items-center gap-2 rounded-lg border border-slate-800 p-2">
                  <button
                    type="button"
                    onClick={() => void auth.connecterAvecCompte(login).then((connected) => { if (connected) setAccountPickerOpen(false); })}
                    className="min-w-0 flex-1 truncate rounded px-2 py-2 text-left text-sm hover:bg-slate-800"
                  >
                    @{login}
                  </button>
                  <button type="button" onClick={() => void auth.oublierCompte(login)} aria-label={lang === "fr" ? `Oublier ${login}` : `Forget ${login}`} className="rounded p-2 text-slate-500 hover:bg-red-950 hover:text-red-300"><X size={15} /></button>
                </div>
              ))}
            </div>
            {auth.erreur && <p role="alert" className="mt-3 text-sm text-red-300">{translateError(auth.erreur, lang)}</p>}
            <button type="button" onClick={() => { setAccountPickerOpen(false); auth.connecter(); }} disabled={auth.enAttente} className="mt-4 w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold hover:bg-orange-500 disabled:opacity-50">
              {lang === "fr" ? "Ajouter / connecter un autre compte" : lang === "es" ? "Añadir / conectar otra cuenta" : lang === "ar" ? "إضافة حساب آخر أو تسجيل الدخول" : "Add / sign in to another account"}
            </button>
          </section>
        </div>
      )}
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
