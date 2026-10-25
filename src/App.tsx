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
import { CommitHistory } from "./components/CommitHistory";
import { ExplorateurFichiers } from "./components/ExplorateurFichiers";
import { PublicationWizard } from "./components/PublicationWizard";
import { ProgressOverlay } from "./components/ProgressOverlay";
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
import { creerOuRecupererDepot, listerDepots, verifierPublication } from "./services/githubService";
import type { AnalyseProjet, DepotGitHub, ProgressionGit } from "./types";
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
  const [publicationWizardOpen, setPublicationWizardOpen] = useState(false);
  const [publicationMode, setPublicationMode] = useState<"create" | "update">("update");
  const [cloneRepositories, setCloneRepositories] = useState<DepotGitHub[]>([]);
  const [cloneRepositoriesLoading, setCloneRepositoriesLoading] = useState(false);
  const [cloneRepositoriesError, setCloneRepositoriesError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressionAffichee | null>(null);
  const progressFrame = useRef<number | null>(null);
  const pendingProgress = useRef<ProgressionAffichee | null>(null);
  const renderedProgressPercent = useRef(0);
  const refreshTimer = useRef<number | null>(null);
  const refreshRequests = useRef<{ resolve: () => void; reject: (cause: unknown) => void; keepBusy: boolean }[]>([]);
  const refreshDirectory = useRef<string | null>(null);
  const selectionEnCours = useRef(false);

  useEffect(() => () => {
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    refreshRequests.current.splice(0).forEach((request) => request.resolve());
  }, []);

  // Sync commit message default when language changes if untouched
  useEffect(() => {
    setCommitMessage((prev) =>
      prev === "Mise à jour du projet" || prev === "Project update" || prev === "Commit message" || prev === "Message du commit" || prev === "Mensaje del commit"
        ? t.syncStep.commitMsgPlaceholder
        : prev
    );
  }, [lang, t.syncStep.commitMsgPlaceholder]);

  const displayError = useCallback((err: unknown): string => {
    return translateError(err, lang);
  }, [lang]);

  function updateProgress(next: ProgressionAffichee | null) {
    renderedProgressPercent.current = Math.floor(next?.percent ?? 0);
    setProgress(next);
  }

  const changeLanguage = useCallback((next: Language) => {
    saveLanguage(next);
    setLang(next);
  }, []);

  useEffect(() => {
    document.documentElement.dir = "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = accent;
    try {
      localStorage.setItem("gsimplifie-theme", theme);
      localStorage.setItem("gsimplifie-accent", accent);
    } catch {
      setError(t.ui.preferencesSaveError);
    }
  }, [accent, lang, t.ui.preferencesSaveError, theme]);

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

  async function chooseProjectFolder() {
    try {
      const path = await openDirectory({ directory: true, multiple: false });
      if (typeof path === "string") await selectProject(path);
    } catch (cause) {
      setError(displayError(cause));
    }
  }

  const refreshProjectState = useCallback((keepBusy = false): Promise<void> => {
    if (!directory) return Promise.resolve();
    refreshDirectory.current = directory;

    const request = new Promise<void>((resolve, reject) => {
      refreshRequests.current.push({ resolve, reject, keepBusy });
    });
    if (refreshTimer.current !== null) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      refreshTimer.current = null;
      const requests = refreshRequests.current.splice(0);
      const targetDirectory = refreshDirectory.current;
      const shouldShowBusy = requests.some((item) => !item.keepBusy);
      if (!targetDirectory) {
        requests.forEach((item) => item.resolve());
        return;
      }
      if (shouldShowBusy) setBusy(true);
      setError(null);
      void Promise.all([
        obtenirEtatDepot(targetDirectory),
        obtenirFichiersSensiblesSuivis(targetDirectory),
      ])
        .then(([state, sensitive]) => {
          setRepoState(state);
          setTrackedSensitive(sensitive);
          setRemoteInput(state.remoteUrl ?? "");
          requests.forEach((item) => item.resolve());
        })
        .catch((cause: unknown) => {
          setError(displayError(cause));
          requests.forEach((item) => item.reject(cause));
        })
        .finally(() => {
          if (shouldShowBusy) setBusy(false);
        });
    }, 300);
    return request;
  }, [directory, displayError]);

  async function associateRemote() {
    if (!directory) return;
    if (!isGitHubUrl(remoteInput)) {
      setError(t.ui.remoteUrlInvalid);
      return;
    }
    if (repoState?.remoteUrl && repoState.remoteUrl !== remoteInput.trim() && !replaceRemoteConfirmed) {
      setReplaceRemoteConfirmed(true);
      setError(t.ui.replaceRemoteConfirm);
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
      setNotice(t.ui.remoteLinked);
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
          ? t.ui.cannotUntrack(filepath)
          : t.ui.sensitiveExcluded(filepath)
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
      : phase.includes("scan")
        ? [12, 10]
      : phase.includes("add")
        ? [22, 16]
        : phase.includes("commit")
          ? [38, 6]
          : phase.includes("compress")
            ? [15, 20]
            : phase.includes("receiv") || phase.includes("fetch")
              ? [35, 45]
              : phase.includes("resolv")
                ? [82, 13]
                : [10, 75];
    const ratio = evt.total && evt.total > 0 ? Math.min(1, (evt.loaded ?? 0) / evt.total) : 0;
    const estimate = Math.min(95, start + span * ratio);
    pendingProgress.current = {
      percent: Math.max(pendingProgress.current?.percent ?? 0, renderedProgressPercent.current, estimate),
      label,
      complete: false,
    };
    if (progressFrame.current === null) {
      progressFrame.current = window.requestAnimationFrame(() => {
        progressFrame.current = null;
        if (pendingProgress.current) {
          const roundedPercent = Math.floor(pendingProgress.current.percent);
          if (roundedPercent !== renderedProgressPercent.current) {
            renderedProgressPercent.current = roundedPercent;
            setProgress({ ...pendingProgress.current, percent: roundedPercent });
          }
        }
      });
    }
  }

  async function afficherFinOperation(label: string) {
    if (progressFrame.current !== null) {
      window.cancelAnimationFrame(progressFrame.current);
      progressFrame.current = null;
    }
    pendingProgress.current = null;
    updateProgress({ percent: 100, label, complete: true });
    await new Promise((resolve) => window.setTimeout(resolve, 850));
  }

  function effacerProgression() {
    if (progressFrame.current !== null) window.cancelAnimationFrame(progressFrame.current);
    progressFrame.current = null;
    pendingProgress.current = null;
    updateProgress(null);
  }

  async function publishChanges() {
    if (!directory || !auth.token) return;
    let localCommitPendingSync = false;
    setBusy(true);
    setError(null);
    setNotice(null);
    updateProgress({ percent: 0, label: t.operationProgress.publishing, complete: false });
    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      updateProgress({ percent: 5, label: t.operationProgress.publishing, complete: false });
      const currentSensitive = await obtenirFichiersSensiblesAffectes(directory);
      if (currentSensitive.length) {
        throw new Error(t.ui.sensitiveFilesTracked(currentSensitive));
      }
      if (!repoState?.remoteUrl) {
        throw new Error(t.ui.linkRemoteFirst);
      }
      updateProgress({ percent: 8, label: t.operationProgress.publishing, complete: false });
      if (repoState.changedFiles > 0) {
        updateProgress({ percent: 12, label: t.operationProgress.publishing, complete: false });
        await ajouterEtCommiter(directory, commitMessage.trim() || t.syncStep.commitMsgPlaceholder, {
          name: auth.login ?? "GitHub User",
          email: `${auth.login ?? "user"}@users.noreply.github.com`,
        }, (evt) => suivreProgressionGit(evt, t.operationProgress.publishing));
        localCommitPendingSync = true;
      }
      updateProgress({ percent: 45, label: t.operationProgress.publishing, complete: false });
      await mettreAJour({
        dir: directory,
        token: auth.token,
        onProgress: (evt) => suivreProgressionGit(evt, t.operationProgress.publishing),
      });
      localCommitPendingSync = false;
      updateProgress({ percent: 90, label: t.operationProgress.publishing, complete: false });
      await refreshProjectState(true);
      updateProgress({ percent: 98, label: t.operationProgress.publishing, complete: false });
      await afficherFinOperation(t.operationProgress.completed);
      setNotice(t.ui.syncCompleted);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(displayError(
        localCommitPendingSync && /failed to fetch|network error|cannot contact|dns|timeout|connection reset/i.test(message)
          ? new Error("SYNC_OFFLINE_LOCAL_COMMIT_SAVED")
          : cause
      ));
    } finally {
      setBusy(false);
      effacerProgression();
    }
  }

  async function createAndPublish() {
    if (!directory || !auth.token) return;
    if (repoState?.remoteUrl) {
      setError(t.ui.remoteAlreadyLinked);
      return;
    }
    if (!repoName.trim()) {
      setError(t.ui.repositoryNameRequired);
      return;
    }
    setBusy(true);
    setError(null);
    updateProgress({ percent: 0, label: t.operationProgress.publishing, complete: false });
    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      updateProgress({ percent: 5, label: t.operationProgress.publishing, complete: false });
      const secrets = await obtenirFichiersSensiblesAffectes(directory);
      if (secrets.length) {
        throw new Error(t.ui.sensitiveFilesTracked(secrets));
      }
      if (!analysis?.hasExistingGit) await initialiserDepot(directory);
      await preparerGitignore(directory, analysis?.suggestedGitignore ?? "");
      updateProgress({ percent: 18, label: t.operationProgress.publishing, complete: false });
      const remote = await creerOuRecupererDepot(auth.token, {
        nom: repoName.trim(),
        prive: privateRepo,
      });
      updateProgress({ percent: 22, label: t.operationProgress.publishing, complete: false });
      await associerDepotDistant(directory, remote.clone_url);
      updateProgress({ percent: 25, label: t.operationProgress.publishing, complete: false });
      await ajouterEtCommiter(directory, commitMessage.trim() || (lang === "fr" ? "Publication initiale" : lang === "es" ? "Publicación inicial" : "Initial commit"), {
        name: auth.login ?? "GitHub User",
        email: `${auth.login ?? "user"}@users.noreply.github.com`,
      }, (evt) => suivreProgressionGit(evt, t.operationProgress.publishing));
      updateProgress({ percent: 48, label: t.operationProgress.publishing, complete: false });
      await publier({
        dir: directory,
        token: auth.token,
        onProgress: (evt) => suivreProgressionGit(evt, t.operationProgress.publishing),
      });
      updateProgress({ percent: 88, label: t.operationProgress.publishing, complete: false });
      const branch = await obtenirBrancheCourante(directory);
      await verifierPublication(auth.token, remote.owner.login, remote.name, branch);
      updateProgress({ percent: 94, label: t.operationProgress.publishing, complete: false });
      await refreshProjectState(true);
      updateProgress({ percent: 98, label: t.operationProgress.publishing, complete: false });
      await afficherFinOperation(t.operationProgress.completed);
      setNotice(t.ui.publishSuccess(remote.html_url));
    } catch (cause) {
      setError(displayError(cause));
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
      setError(t.ui.cloneInputRequired);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    updateProgress({ percent: 0, label: t.operationProgress.cloning, complete: false });
    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      updateProgress({ percent: 4, label: t.operationProgress.cloning, complete: false });
      const target = await join(cloneParent, cloneName);
      updateProgress({ percent: 8, label: t.operationProgress.cloning, complete: false });
      await recuperer({
        dir: target,
        remoteUrl: cloneUrl.trim(),
        token: auth.token ?? "",
        onProgress: (evt) => suivreProgressionGit(evt, t.operationProgress.cloning),
      });
      updateProgress({ percent: 90, label: t.operationProgress.cloning, complete: false });
      await selectProject(target, true);
      updateProgress({ percent: 98, label: t.operationProgress.cloning, complete: false });
      setNotice(t.ui.cloneSuccess(target));
      setStep(1);
      await afficherFinOperation(t.operationProgress.completed);
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setBusy(false);
      effacerProgression();
    }
  }

  const stepsList = useMemo(() => [
    { id: 1, label: t.steps.project, icon: FolderGit2 },
    { id: 2, label: t.steps.sensitive, icon: ShieldAlert },
    { id: 3, label: t.steps.sync, icon: RefreshCw },
  ], [t]);

  const activeStep = step === 4 ? 4 : step;

  const chargerDepotsGitHub = useCallback(async () => {
    if (!auth.token) {
      setCloneRepositories([]);
      setCloneRepositoriesError(null);
      return;
    }
    setCloneRepositoriesLoading(true);
    setCloneRepositoriesError(null);
    try {
      setCloneRepositories(await listerDepots(auth.token));
    } catch (cause) {
      setCloneRepositoriesError(displayError(cause));
    } finally {
      setCloneRepositoriesLoading(false);
    }
  }, [auth.token, displayError]);

  useEffect(() => {
    if (step === 4) void chargerDepotsGitHub();
  }, [chargerDepotsGitHub, step]);

  function ouvrirAssistantPublication(mode: "create" | "update") {
    setPublicationMode(mode);
    setPublicationWizardOpen(true);
    setError(null);
  }

  function terminerAssistantPublication() {
    setPublicationWizardOpen(false);
    if (publicationMode === "create") void createAndPublish();
    else void publishChanges();
  }

  return (
    <div className="app-shell min-h-screen bg-[#090909] text-slate-100">
      <header className="border-b border-slate-800 bg-[#111111]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={appLogo} alt="" className="h-9 w-9 rounded-xl object-contain" />
            <div className="min-w-0">
              <p className="font-semibold text-white">{t.app.title}</p>
              <p className="hidden text-xs text-slate-400 sm:block">{t.app.subtitle}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#171717] px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-orange-500 hover:text-white"
              title={t.ui.settings}
            >
              <Settings size={14} className="text-orange-400" />
              <span className="hidden sm:inline">{t.ui.settings}</span>
            </button>

            {auth.token ? (
              <>
                <span className="max-w-28 truncate rounded-full border border-emerald-800 bg-emerald-950/50 px-2 py-1 text-xs text-emerald-300 sm:max-w-none sm:px-3 sm:text-sm">
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
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-3 lg:grid-cols-[1fr_auto]">
          <section aria-label={lang === "fr" ? "Gestion et suivi" : lang === "es" ? "Gestión y seguimiento" : "Management and tracking"}>
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {lang === "fr" ? "Gestion & suivi" : lang === "es" ? "Gestión y seguimiento" : "Management & tracking"}
            </p>
            <div className="flex gap-1 overflow-x-auto">
              {stepsList.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setStep(id);
                    setError(null);
                  }}
                  className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                    activeStep === id
                      ? "bg-orange-950/50 text-white ring-1 ring-orange-700"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
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
            </div>
          </section>
          <section aria-label={lang === "fr" ? "Actions Git" : lang === "es" ? "Acciones de Git" : "Git actions"}>
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {lang === "fr" ? "Actions Git" : lang === "es" ? "Acciones Git" : "Git actions"}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => ouvrirAssistantPublication(repoState?.remoteUrl ? "update" : "create")}
                disabled={!directory || busy}
                className="inline-flex shrink-0 items-center gap-2 rounded-md border border-emerald-800 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-950/50 disabled:opacity-40"
              >
                <CloudUpload size={15} />
                {lang === "fr" ? "Publier" : lang === "es" ? "Publicar" : "Publish"}
              </button>
              <button
                type="button"
                onClick={() => { setStep(4); setError(null); }}
                className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm ${activeStep === 4 ? "bg-orange-950/50 text-white ring-1 ring-orange-700" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"}`}
              >
                <GitFork size={15} />
                {t.steps.clone}
              </button>
            </div>
          </section>
        </div>
      </nav>

      <main className="mx-auto min-h-[calc(100vh-119px)] max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-5">
          <div className="flex w-full flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
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
        </div>

        {auth.token && auth.erreur && (
          <div role="alert" className="fixed right-4 top-20 z-50 flex w-[min(34rem,calc(100vw-2rem))] items-start justify-between gap-3 rounded-lg border border-amber-900 bg-amber-950/95 p-3 text-sm text-amber-100 shadow-xl">
            <span>{translateError(auth.erreur, lang)}</span>
            <button type="button" onClick={auth.effacerErreur} aria-label={t.common.close} className="shrink-0 text-amber-200 hover:text-white"><X size={17} /></button>
          </div>
        )}
        {error && (
          <div role="alert" className="fixed right-4 top-20 z-50 flex w-[min(34rem,calc(100vw-2rem))] items-start justify-between gap-3 rounded-lg border border-red-900 bg-red-950/95 p-3 text-sm text-red-200 shadow-xl">
            <div className="flex min-w-0 items-start gap-2">
              <AlertTriangle size={17} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p>{error}</p>
                {directory && /no longer accessible|n’est plus disponible|ya no se puede acceder/i.test(error) && (
                  <button type="button" onClick={() => void chooseProjectFolder()} className="mt-1 underline underline-offset-2 hover:text-white">
                    {t.ui.reauthorizeFolder}
                  </button>
                )}
                {auth.token && /could not authenticate|connexion à github impossible|no se pudo iniciar sesión/i.test(error) && (
                  <button type="button" onClick={() => { setError(null); setShowDisconnectConfirm(true); }} className="mt-1 block underline underline-offset-2 hover:text-white">
                    {t.ui.reconnectAccount}
                  </button>
                )}
              </div>
            </div>
            <button type="button" onClick={() => setError(null)} aria-label={t.common.close} className="shrink-0 text-red-200 hover:text-white"><X size={17} /></button>
          </div>
        )}
        {notice && (
          <div role="status" className="fixed right-4 top-20 z-50 flex w-[min(34rem,calc(100vw-2rem))] items-start justify-between gap-3 rounded-lg border border-emerald-900 bg-emerald-950/95 p-3 text-sm text-emerald-200 shadow-xl">
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
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Folder size={22} className="text-slate-300" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-400">{t.projectStep.selectedFolder} · {t.projectStep.localPathLabel}</p>
                      <p className="break-all font-mono text-sm">{directory}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <span className="text-sm text-slate-400">
                      {analysis.type} · {analysis.fileCount} {t.projectStep.filesCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => void chooseProjectFolder()}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#171717] px-3 py-2 text-sm text-slate-200 hover:border-orange-500 hover:text-white disabled:opacity-50"
                    >
                      <FolderPlus size={15} />
                      {t.ui.chooseAnotherFolder}
                    </button>
                  </div>
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
            {!directory || !analysis ? (
              <ZoneDepot
                action={null}
                erreur={null}
                disabled={busy}
                onFolderSelected={selectProject}
                onError={setError}
                lang={lang}
              />
            ) : null}
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
                <button type="button" onClick={() => ouvrirAssistantPublication("create")} disabled={busy || !auth.token} className="rounded-md bg-emerald-700 px-4 py-2 font-semibold hover:bg-emerald-600 disabled:opacity-40">
                  <CloudUpload size={15} className="mr-1 inline" />{t.syncStep.createAndPublishBtn}
                </button>
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
                {repoState.conflictFiles.length > 0 && (
                  <div role="alert" className="rounded-xl border border-amber-800 bg-amber-950/30 p-4">
                    <p className="font-semibold text-amber-200">
                      {lang === "fr" ? "Conflits Git à résoudre" : lang === "es" ? "Conflictos de Git por resolver" : "Git conflicts need attention"}
                    </p>
                    <p className="mt-1 text-sm text-amber-100/80">
                      {lang === "fr"
                        ? "Aucune version locale ou distante n’a été choisie automatiquement. Résolvez ces fichiers dans votre éditeur, puis resélectionnez le dossier dans la vue Projet."
                        : lang === "es"
                          ? "No se eligió automáticamente ninguna versión local o remota. Resuelve estos archivos en tu editor y vuelve a seleccionar la carpeta en la vista Proyecto."
                          : "No local or remote version was chosen automatically. Resolve these files in your editor, then select the folder again in the Project view."}
                    </p>
                    <ul className="mt-3 max-h-32 space-y-1 overflow-auto font-mono text-xs text-amber-100">
                      {repoState.conflictFiles.map((filepath) => <li key={filepath} className="break-all">{filepath}</li>)}
                    </ul>
                  </div>
                )}
                <div className="rounded-xl border border-slate-800 bg-[#171717] p-5">
                  <h2 className="font-semibold">{t.syncStep.actionsTitle}</h2>
                  <p className="mt-1 text-xs text-slate-400">{t.syncStep.actionsDesc}</p>
                  <button type="button" onClick={() => ouvrirAssistantPublication("update")} disabled={busy || !auth.token} className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40">
                    <CloudUpload size={15} className="mr-1 inline" />{t.syncStep.publishBtn}
                  </button>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#171717] p-5">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">{t.syncStep.recentHistoryTitle}</h2>
                  {repoState.recentCommits.some((commit) => !hiddenCommits.includes(commit.oid)) ? (
                    <CommitHistory
                      commits={repoState.recentCommits}
                      hiddenCommits={hiddenCommits}
                      language={lang}
                      unnamedLabel={t.syncStep.unnamedCommit}
                      hideLabel={t.dialogs.hideCommit}
                      onHide={(oid) => setHiddenCommits((current) => [...current, oid])}
                    />
                  ) : <p className="text-sm text-slate-400">{t.syncStep.noCommits}</p>}
                  <p className="mt-3 text-xs text-slate-500">{t.ui.hiddenCommitNotice}</p>
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
            <div className="mb-4 flex items-end gap-2">
              <label htmlFor="clone-repository" className="min-w-0 flex-1 text-sm">
                <span className="mb-1 block">{lang === "fr" ? "Dépôts du compte GitHub" : lang === "es" ? "Repositorios de la cuenta de GitHub" : "Repositories from your GitHub account"}</span>
                <select
                  id="clone-repository"
                  value={cloneRepositories.some((repository) => repository.url === cloneUrl) ? cloneUrl : ""}
                  onChange={(event) => setCloneUrl(event.target.value)}
                  disabled={!auth.token || cloneRepositoriesLoading}
                  className="w-full rounded-md border border-slate-700 bg-[#090909] px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value="">
                    {cloneRepositoriesLoading
                      ? (lang === "fr" ? "Chargement des dépôts…" : lang === "es" ? "Cargando repositorios…" : "Loading repositories…")
                      : lang === "fr" ? "Sélectionner un dépôt…" : lang === "es" ? "Seleccionar un repositorio…" : "Select a repository…"}
                  </option>
                  {cloneRepositories.map((repository) => (
                    <option key={repository.url} value={repository.url}>
                      {repository.cheminComplet} · {repository.prive ? t.syncStep.privateRepoCheckbox : t.syncStep.publicRepoLabel}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void chargerDepotsGitHub()}
                disabled={!auth.token || cloneRepositoriesLoading}
                className="shrink-0 rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-40"
              >
                {lang === "fr" ? "Actualiser" : lang === "es" ? "Actualizar" : "Refresh"}
              </button>
            </div>
            {cloneRepositoriesError && (
              <p role="alert" className="mb-4 rounded-md border border-red-900 bg-red-950/30 p-3 text-sm text-red-200">{cloneRepositoriesError}</p>
            )}
            {auth.token && !cloneRepositoriesLoading && !cloneRepositoriesError && cloneRepositories.length === 0 && (
              <p className="mb-4 rounded-md border border-slate-700 bg-slate-900/50 p-3 text-sm text-slate-300">
                {lang === "fr" ? "Aucun dépôt accessible n’a été trouvé sur ce compte GitHub."
                  : lang === "es" ? "No se encontraron repositorios accesibles en esta cuenta de GitHub."
                    : "No accessible repositories were found for this GitHub account."}
              </p>
            )}
            {!auth.token && (
              <p className="mb-4 rounded-md border border-amber-900 bg-amber-950/20 p-3 text-sm text-amber-200">
                {lang === "fr"
                  ? "Connecte-toi à GitHub pour afficher tes dépôts privés et ceux de ton compte. Tu peux aussi entrer l’URL d’un dépôt public."
                  : lang === "es"
                    ? "Conéctate a GitHub para ver tus repositorios privados y los de tu cuenta. También puedes introducir la URL de un repositorio público."
                    : "Sign in to GitHub to see your private and account repositories. You can also enter a public repository URL."}
              </p>
            )}
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
              <button type="button" onClick={() => void cloneRepository()} disabled={busy || !auth.token || !cloneRepositories.some((repository) => repository.url === cloneUrl)} className="rounded-md bg-orange-600 px-4 py-2.5 text-sm font-semibold hover:bg-orange-500 disabled:opacity-40">
                <CloudDownload size={15} className="mr-2 inline" />{t.cloneStep.cloneBtn}
              </button>
            </div>
          </section>
        )}

        {busy && progress && <ProgressOverlay progress={progress} completedLabel={t.operationProgress.completed} />}
        {busy && !progress && <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4" role="status" aria-live="polite"><LoaderCircle className="animate-spin text-orange-400" size={36} /></div>}
      </main>

        <PublicationWizard
          open={publicationWizardOpen}
          language={lang}
          mode={publicationMode}
          directory={directory ?? ""}
          remoteUrl={repoState?.remoteUrl ?? null}
          branch={repoState?.branch ?? "main"}
          changedFiles={repoState?.changedFiles ?? projectFiles.length}
          sensitiveFiles={[...new Set([...(analysis?.sensitiveFiles ?? []), ...trackedSensitive])]}
          repoName={repoName}
          privateRepo={privateRepo}
          commitMessage={commitMessage}
          busy={busy}
          onRepoNameChange={setRepoName}
          onPrivateRepoChange={setPrivateRepo}
          onCommitMessageChange={setCommitMessage}
          onClose={() => setPublicationWizardOpen(false)}
          onFinish={terminerAssistantPublication}
        />

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
              <h2 id="accounts-title" className="text-lg font-semibold">{t.ui.accountsTitle}</h2>
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
                  <button type="button" onClick={() => void auth.oublierCompte(login)} aria-label={t.ui.forgetAccount(login)} className="rounded p-2 text-slate-500 hover:bg-red-950 hover:text-red-300"><X size={15} /></button>
                </div>
              ))}
            </div>
            {auth.erreur && <p role="alert" className="mt-3 text-sm text-red-300">{translateError(auth.erreur, lang)}</p>}
            <button type="button" onClick={() => { setAccountPickerOpen(false); auth.connecter(); }} disabled={auth.enAttente} className="mt-4 w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold hover:bg-orange-500 disabled:opacity-50">
              {t.ui.addAccount}
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
