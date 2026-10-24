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

const ETAPES = [
  { id: 1, label: "Projet", icon: FolderGit2 },
  { id: 2, label: "Fichiers sensibles", icon: ShieldAlert },
  { id: 3, label: "Tableau de bord Sync", icon: RefreshCw },
  { id: 4, label: "Cloner un dépôt", icon: GitFork },
] as const;

function repoNameFromUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").split("/").pop()?.replace(/\.git$/i, "") ?? "";
}

function isGitHubUrl(url: string): boolean {
  return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?\/?$/i.test(url.trim());
}

function displayError(error: unknown): string {
  if (!(error instanceof Error)) return "Une erreur inattendue est survenue.";
  if (/could not find head/i.test(error.message)) {
    return "Ce dépôt ne contient encore aucun commit. Publie d’abord le projet ou vérifie la branche configurée sur GitHub.";
  }
  return error.message;
}

export default function App() {
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
  const [commitMessage, setCommitMessage] = useState("Mise à jour du projet");
  const [divergence, setDivergence] = useState<DivergenceDepot | null>(null);
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneParent, setCloneParent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [securityNoteVisible, setSecurityNoteVisible] = useState(true);
  const selectionEnCours = useRef(false);

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
      if (paths.length === 0) throw new Error("Aucun fichier n’a été trouvé dans ce dossier.");
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
  }, [busy]);

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
      setError("Entre une URL HTTPS GitHub valide, par exemple https://github.com/compte/projet.git.");
      return;
    }
    if (repoState?.remoteUrl && repoState.remoteUrl !== remoteInput.trim() && !replaceRemoteConfirmed) {
      setReplaceRemoteConfirmed(true);
      setError("Cette action remplacera l’URL du dépôt distant actuel. Clique à nouveau pour confirmer.");
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
      setNotice("Le dépôt distant est associé à ce dossier.");
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
          ? `Impossible de retirer ${filepath} de l’index Git.`
          : `${filepath} est exclu des prochains commits. Son historique Git existant n’est pas effacé.`
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
      setNotice("Les commits disponibles sur GitHub ont été récupérés. Aucun changement local n’a été publié.");
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
          `Publication bloquée : ces fichiers sensibles sont encore suivis par Git : ${currentSensitive.join(", ")}.`
        );
      }
      if (!repoState?.remoteUrl) {
        throw new Error("Associe d’abord un dépôt GitHub à ce projet.");
      }
      if (repoState.changedFiles > 0) {
        await ajouterEtCommiter(directory, commitMessage.trim() || "Mise à jour du projet", {
          name: auth.login ?? "Utilisateur GitHub",
          email: `${auth.login ?? "utilisateur"}@users.noreply.github.com`,
        });
      }
      await mettreAJour({ dir: directory, token: auth.token });
      await refreshProjectState();
      setNotice("Synchronisation terminée sans forcer l’historique distant.");
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function createAndPublish() {
    if (!directory || !auth.token) return;
    if (repoState?.remoteUrl) {
      setError("Un dépôt distant est déjà associé. Utilise « Publier le projet » ou confirme son remplacement dans l’étape d’association.");
      return;
    }
    if (!repoName.trim()) {
      setError("Indique un nom de dépôt.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const secrets = await obtenirFichiersSensiblesAffectes(directory);
      if (secrets.length) {
        throw new Error(`Publication bloquée : fichiers sensibles encore suivis : ${secrets.join(", ")}.`);
      }
      if (!analysis?.hasExistingGit) await initialiserDepot(directory);
      await preparerGitignore(directory, analysis?.suggestedGitignore ?? "");
      const remote = await creerOuRecupererDepot(auth.token, {
        nom: repoName.trim(),
        prive: privateRepo,
      });
      await associerDepotDistant(directory, remote.clone_url);
      await ajouterEtCommiter(directory, "Publication initiale", {
        name: auth.login ?? "Utilisateur GitHub",
        email: `${auth.login ?? "utilisateur"}@users.noreply.github.com`,
      });
      await publier({ dir: directory, token: auth.token });
      const branch = await obtenirBrancheCourante(directory);
      await verifierPublication(auth.token, remote.owner.login, remote.name, branch);
      await refreshProjectState();
      setNotice(`Dépôt publié avec succès : ${remote.html_url}`);
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
      setError("Connecte-toi à GitHub pour cloner un dépôt privé ou public.");
      return;
    }
    if (!isGitHubUrl(cloneUrl) || !cloneName || !cloneParent) {
      setError("Renseigne une URL GitHub valide et choisis un dossier parent.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const target = await join(cloneParent, cloneName);
      await recuperer({ dir: target, remoteUrl: cloneUrl.trim(), token: auth.token });
      setNotice(`Dépôt cloné dans ${target}`);
      await selectProject(target);
      setStep(1);
    } catch (cause) {
      setError(displayError(cause));
    } finally {
      setBusy(false);
    }
  }

  const activeStep = step === 4 ? 4 : step;

  return (
    <div className="min-h-screen bg-[#090909] text-slate-100">
      <header className="border-b border-slate-800 bg-[#111111]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600 font-bold">GS</span>
            <div>
              <p className="font-semibold">GitHub Simplifié</p>
              <p className="text-xs text-slate-400">Synchronisation de projets, sans ligne de commande</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {auth.token ? (
              <>
                <span className="rounded-full border border-emerald-800 bg-emerald-950/50 px-3 py-1 text-sm text-emerald-300">
                  ● @{auth.login ?? "connecté"}
                </span>
                <button
                  type="button"
                  onClick={auth.deconnecter}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                  aria-label="Se déconnecter"
                  title="Se déconnecter"
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={auth.connecter}
                disabled={auth.enAttente}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold hover:bg-orange-500 disabled:opacity-50"
              >
                {auth.enAttente ? "Connexion…" : "Connecter GitHub"}
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
            />
          </div>
        </div>
      )}

      <nav className="border-b border-slate-800 bg-[#111111]">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {ETAPES.map(({ id, label, icon: Icon }) => (
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
            {directory ?? "Aucun projet sélectionné"}
          </div>
        </div>
      </nav>

      <main className="mx-auto min-h-[calc(100vh-119px)] max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-5">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-semibold">
              {activeStep === 1 && <><FolderGit2 className="text-orange-400" />Choisir un projet</>}
              {activeStep === 2 && <><ShieldAlert className="text-amber-400" />Contrôle de sécurité & fichiers sensibles</>}
              {activeStep === 3 && <><RefreshCw className="text-emerald-400" />Tableau de bord de synchronisation</>}
              {activeStep === 4 && <><GitFork className="text-orange-400" />Récupérer un dépôt (cloner)</>}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {activeStep === 1 && "Choisissez le dossier local à analyser ou à synchroniser."}
              {activeStep === 2 && "Examinez les fichiers suspects avant de les inclure dans un commit."}
              {activeStep === 3 && "Vérifiez les changements puis synchronisez sans écraser l’historique distant."}
              {activeStep === 4 && "Le dépôt est cloné dans un nouveau sous-dossier, sans écraser vos fichiers."}
            </p>
          </div>
          {directory && activeStep < 4 && (
            <span className="rounded-md border border-emerald-800 bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-300">
              {repoState?.remoteUrl ? "Dépôt lié" : analysis?.hasExistingGit ? "Git détecté" : "Dossier sélectionné"}
            </span>
          )}
        </div>

        {auth.token && auth.erreur && (
          <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-amber-900 bg-amber-950/40 p-3 text-sm text-amber-100">
            <span>{auth.erreur}</span>
            <button type="button" onClick={auth.effacerErreur} aria-label="Fermer le message" className="shrink-0 text-amber-200 hover:text-white"><X size={17} /></button>
          </div>
        )}
        {error && (
          <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
            <span className="flex items-start gap-2"><AlertTriangle size={17} className="mt-0.5 shrink-0" />{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Fermer le message" className="shrink-0 text-red-200 hover:text-white"><X size={17} /></button>
          </div>
        )}
        {notice && (
          <div role="status" className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-200">
            <span className="flex items-start gap-2"><Check size={17} className="mt-0.5 shrink-0" />{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Fermer le message" className="shrink-0 text-emerald-200 hover:text-white"><X size={17} /></button>
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
            />
            {busy && <Loading label="Analyse du dossier…" />}
            {directory && analysis && (
              <div className="rounded-xl border border-slate-800 bg-[#171717] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <Folder size={22} className="text-slate-300" />
                    <div>
                      <p className="text-xs text-slate-400">Dossier sélectionné</p>
                      <p className="break-all font-mono text-sm">{directory}</p>
                    </div>
                  </div>
                  <span className="text-sm text-slate-400">
                    {analysis.type} · {analysis.fileCount} fichiers
                  </span>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-800 bg-[#0d0d0d] p-4">
                    <label htmlFor="remote-url" className="mb-2 block text-sm font-medium">
                      Adresse du dépôt GitHub
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="remote-url"
                        value={remoteInput}
                        onChange={(event) => {
                          setRemoteInput(event.target.value);
                          setReplaceRemoteConfirmed(false);
                        }}
                        placeholder="https://github.com/compte/projet.git"
                        className="min-w-0 flex-1 rounded-md border border-slate-700 bg-[#090909] px-3 py-2 font-mono text-xs outline-none focus:border-orange-500"
                      />
                      <button
                        type="button"
                        onClick={() => void associateRemote()}
                        disabled={busy || !auth.token}
                        className="rounded-md bg-orange-600 px-3 py-2 text-xs font-semibold hover:bg-orange-500 disabled:opacity-40"
                      >
                        {repoState?.remoteUrl ? "Mettre à jour l’adresse" : "Enregistrer l’adresse"}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-[#0d0d0d] p-4">
                    <p className="mb-2 text-sm font-medium">Accès au dossier</p>
                    <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 text-slate-300"><ShieldCheck size={16} className="text-emerald-400" />Accès accordé via sélection native</span>
                      <span className="text-emerald-400">OK</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">L’accès est limité au dossier choisi. Le sélecteur natif fonctionne également hors du dossier personnel.</p>
                  </div>
                </div>
                <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-300">
                  <span className="font-semibold text-orange-300">Contrôle de racine Git :</span>{" "}
                  {analysis.hasExistingGit
                    ? "un dépôt Git est présent à la racine du dossier sélectionné."
                    : "aucun dépôt Git à la racine; il sera initialisé uniquement lors d’une action de publication."}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setStep(2); setError(null); setNotice(null); }}
                    className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold hover:bg-orange-500"
                  >
                    Examiner les fichiers & sécurité <ChevronRight size={16} />
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
                Choisis un dossier dans l’onglet « Projet » pour afficher les fichiers à contrôler.
              </div>
            ) : (
              <>
                {securityNoteVisible && (
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-800 bg-amber-950/30 p-4 text-amber-200">
                    <div className="flex gap-3">
                      <AlertTriangle size={19} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold">Vérifie les fichiers avant publication</p>
                        <p className="mt-1 text-sm text-amber-200/80">Le contrôle signale les noms de fichiers sensibles les plus courants; relis la liste avant de publier.</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setSecurityNoteVisible(false)} aria-label="Masquer ce conseil" className="shrink-0 text-amber-200 hover:text-white"><X size={17} /></button>
                  </div>
                )}
                <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#171717]">
                  <div className="grid grid-cols-[1fr_auto] bg-slate-800/60 px-4 py-3 text-xs font-medium text-slate-300">
                    <span>Fichier détecté</span><span>État Git & action</span>
                  </div>
                  {analysis.sensitiveFiles.length === 0 ? (
                    <div className="flex items-center gap-3 p-6 text-sm text-emerald-300">
                      <ShieldCheck size={20} />Aucun nom de fichier sensible connu détecté. Vérifie quand même manuellement les fichiers avant la publication.
                    </div>
                  ) : analysis.sensitiveFiles.map((filepath) => {
                    const tracked = trackedSensitive.includes(filepath);
                    return (
                      <div key={filepath} className="grid grid-cols-1 items-start gap-3 border-t border-slate-800 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
                        <div>
                          <p className="font-mono text-sm">{filepath}</p>
                          <p className={`mt-1 text-xs ${tracked ? "text-red-300" : "text-amber-300"}`}>
                            {tracked ? "Danger : déjà suivi par Git. L’exclusion ne supprimera pas son historique." : "Fichier local suspect; son nom sera ajouté au .gitignore."}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void reviewSensitiveFile(filepath)}
                          className={`rounded-md px-3 py-2 text-xs font-semibold disabled:opacity-50 ${tracked ? "bg-red-700 hover:bg-red-600" : "bg-amber-700 hover:bg-amber-600"}`}
                        >
                          {tracked ? <><Unlink size={13} className="mr-1 inline" />Retirer du suivi & ignorer</> : "Ajouter au .gitignore"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between">
                  <button type="button" onClick={() => setStep(1)} className="rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">← Retour</button>
                  <button type="button" onClick={() => setStep(3)} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold hover:bg-orange-500">
                    Continuer vers le tableau de bord <ChevronRight size={16} />
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
                  Sélectionne un dossier dans l’onglet « Projet » pour ouvrir son tableau de bord.
                </div>
                {directory && analysis && (
                  <div className="rounded-xl border border-slate-800 bg-[#171717] p-5">
                    <h2 className="mb-2 font-semibold">Publier ce projet pour la première fois</h2>
                    <p className="mb-4 text-sm text-slate-400">Un dépôt privé sera créé par défaut. Les fichiers sensibles encore suivis bloquent la publication.</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <input value={repoName} onChange={(event) => setRepoName(event.target.value)} placeholder="nom-du-depot" className="rounded-md border border-slate-700 bg-[#090909] px-3 py-2 text-sm" />
                      <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={privateRepo} onChange={(event) => setPrivateRepo(event.target.checked)} />Dépôt privé</label>
                      <button type="button" onClick={() => void createAndPublish()} disabled={busy || !auth.token} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40">
                        <CloudUpload size={15} className="mr-1 inline" />Créer & publier
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#171717] px-3 py-2 text-sm">
                    <GitBranch size={16} className="text-orange-300" />Branche : <strong>{repoState.branch}</strong>
                  </div>
                  <button type="button" onClick={() => void refreshProjectState()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50">
                    <RefreshCw size={15} />Actualiser
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard icon={<CloudUpload />} title={String(divergence?.ahead ?? "—")} detail="Commits locaux en avance" color="orange" />
                  <StatCard icon={<CloudDownload />} title={String(divergence?.behind ?? "—")} detail="Commits distants en avance" color="amber" />
                  <StatCard icon={<Check />} title={repoState.changedFiles ? `${repoState.changedFiles} fichier(s)` : "Propre"} detail={repoState.changedFiles ? "Modifications locales" : "État local"} color={repoState.changedFiles ? "amber" : "emerald"} />
                </div>
                {divergence?.truncated && <p className="text-xs text-amber-300">La divergence dépasse la limite de comparaison; les valeurs affichées sont des minimums.</p>}
                <div className="rounded-xl border border-slate-800 bg-[#171717] p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <h2 className="font-semibold">Actions de synchronisation sécurisées</h2>
                      <p className="mt-1 text-xs text-slate-400">La récupération distante est en fast-forward seulement; aucune réécriture forcée n’est utilisée.</p>
                    </div>
                    <button type="button" onClick={() => void refreshRemoteStatus()} disabled={busy || !auth.token || !repoState.remoteUrl} className="rounded-md border border-slate-700 px-3 py-2 text-xs hover:bg-slate-800 disabled:opacity-40">
                      Comparer l’état local avec GitHub
                    </button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-slate-800 bg-[#0d0d0d] p-4">
                      <h3 className="font-medium"><CloudDownload size={16} className="mr-2 inline text-orange-300" />Mettre à jour</h3>
                      <p className="my-3 text-xs text-slate-400">Télécharge les commits déjà présents sur GitHub. Nécessite un dossier local sans changements; aucun fichier local n’est envoyé.</p>
                      <button type="button" onClick={() => void downloadGitHubChanges()} disabled={busy || !auth.token || !repoState.remoteUrl} className="w-full rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold hover:bg-orange-500 disabled:opacity-40">
                        Récupérer les mises à jour GitHub
                      </button>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-[#0d0d0d] p-4">
                      <h3 className="font-medium"><CloudUpload size={16} className="mr-2 inline text-emerald-300" />Publier / synchroniser</h3>
                      <p className="my-3 text-xs text-slate-400">Les changements locaux sont commités avec le message ci-dessous, puis synchronisés sans force push.</p>
                      <input value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} aria-label="Message du commit" className="mb-2 w-full rounded-md border border-slate-700 bg-[#090909] px-3 py-2 text-xs" />
                      <button type="button" onClick={() => void publishChanges()} disabled={busy || !auth.token || !repoState.remoteUrl} className="w-full rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40">
                        Publier mes modifications
                      </button>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-[#171717] p-5">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Historique récent</h2>
                  {repoState.recentCommits.length ? (
                    <ul className="space-y-3">
                      {repoState.recentCommits.map((commit) => (
                        <li key={commit.oid} className="flex items-start gap-3 text-sm">
                          <code className="rounded border border-orange-900 bg-orange-950/40 px-2 py-0.5 text-xs text-orange-200">{commit.oid}</code>
                          <span className="min-w-0 flex-1 truncate">{commit.message || "Commit sans message"}</span>
                          <time className="shrink-0 text-xs text-slate-500">{new Date(commit.timestamp * 1000).toLocaleString()}</time>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm text-slate-400">Aucun commit dans ce dépôt pour le moment.</p>}
                </div>
              </>
            )}
          </section>
        )}

        {activeStep === 4 && (
          <section className="mx-auto max-w-3xl rounded-xl border border-slate-800 bg-[#171717] p-5">
            <div className="mb-5 flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="font-semibold">Assistant de clonage sécurisé</h2>
                <p className="mt-1 text-sm text-slate-400">Le dépôt est créé dans un nouveau dossier enfant. Aucun fichier existant n’est remplacé.</p>
              </div>
              <span className="rounded-md border border-orange-900 bg-orange-950/30 px-2 py-1 text-xs text-orange-300">GitHub HTTPS</span>
            </div>
            <label htmlFor="clone-url" className="mb-1 block text-sm">URL du dépôt GitHub distant</label>
            <input id="clone-url" value={cloneUrl} onChange={(event) => setCloneUrl(event.target.value)} placeholder="https://github.com/organisation/nom-du-projet.git" className="mb-4 w-full rounded-md border border-slate-700 bg-[#090909] px-3 py-2 font-mono text-xs outline-none focus:border-orange-500" />
            <label className="mb-1 block text-sm">Dossier parent cible</label>
            <div className="mb-4 flex gap-2">
              <input value={cloneParent} readOnly placeholder="Choisir un dossier parent…" className="min-w-0 flex-1 rounded-md border border-slate-700 bg-[#090909] px-3 py-2 font-mono text-xs" />
              <button type="button" onClick={() => void chooseCloneParent()} className="rounded-md bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"><Folder size={15} className="mr-1 inline" />Parcourir</button>
            </div>
            <div className="rounded-lg border border-orange-900 bg-orange-950/20 p-4">
              <p className="mb-2 text-sm font-medium"><FolderGit2 size={15} className="mr-2 inline text-orange-300" />Sous-dossier qui sera créé</p>
              <code className="block break-all rounded bg-[#090909] px-3 py-2 text-xs text-emerald-300">{cloneTarget || "Sélectionne une URL et un dossier parent"}</code>
              <p className="mt-2 text-xs text-slate-400">Si le dossier cible existe déjà et contient des fichiers, le clonage s’arrête sans les modifier.</p>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button type="button" onClick={() => setStep(1)} className="rounded-md bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700">Annuler</button>
              <button type="button" onClick={() => void cloneRepository()} disabled={busy || !auth.token} className="rounded-md bg-orange-600 px-4 py-2.5 text-sm font-semibold hover:bg-orange-500 disabled:opacity-40">
                <CloudDownload size={15} className="mr-2 inline" />Cloner le projet
              </button>
            </div>
          </section>
        )}

        {busy && <Loading label="Opération en cours…" />}
        {busy && (
          <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center bg-black/20">
            <LoaderCircle className="animate-spin text-orange-400" size={36} />
          </div>
        )}
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-[#111111] px-4 py-2 text-xs text-slate-500 sm:px-6">
        <span><span className="mr-2 text-emerald-400">●</span>Tauri · GitHub HTTPS · multi-plateforme</span>
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
