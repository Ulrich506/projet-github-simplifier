import { useState } from "react";
import { open as ouvrirSelecteurDossier } from "@tauri-apps/plugin-dialog";
import { analyzeProject } from "./services/projectAnalyzer";
import { listerCheminsRelatifs } from "./services/fileSystemUtils";
import {
  ajouterEtCommiter,
  initialiserDepot,
  mettreAJour,
  publier,
  recuperer,
} from "./services/gitService";
import { creerOuRecupererDepot } from "./services/githubService";
import { useGitHubAuth } from "./hooks/useGitHubAuth";
import { EcranConnexionGitHub } from "./components/EcranConnexionGitHub";
import { ZoneDepot } from "./components/ZoneDepot";
import { MenuActions } from "./components/MenuActions";
import { EcranConfirmation } from "./components/EcranConfirmation";
import { EcranProgression } from "./components/EcranProgression";
import { EcranResultat } from "./components/EcranResultat";
import type { AnalyseProjet, ActionChoisie, Etape, ProgressionGit } from "./types";

const ETAPES = {
  CONNEXION: "connexion",
  DEPOT: "depot",
  ANALYSE: "analyse",
  ACTION: "action",
  CONFIRMATION: "confirmation",
  EN_COURS: "en_cours",
  TERMINE: "termine",
} as const satisfies Record<string, Etape>;

function nomProjetDetecte(cheminDossier: string): string {
  const segments = cheminDossier.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] || "mon-projet";
}

export default function App() {
  const auth = useGitHubAuth();

  const [etape, setEtape] = useState<Etape>(ETAPES.CONNEXION);
  const [cheminDossier, setCheminDossier] = useState<string | null>(null);
  const [analyse, setAnalyse] = useState<AnalyseProjet | null>(null);
  const [actionChoisie, setActionChoisie] = useState<ActionChoisie | null>(null);
  const [nomDepot, setNomDepot] = useState("");
  const [progression, setProgression] = useState<ProgressionGit | null>(null);
  const [urlDepot, setUrlDepot] = useState<string | null>(null);
  const [erreurDepot, setErreurDepot] = useState<string | null>(null);
  const [erreurOperation, setErreurOperation] = useState<string | null>(null);

  // Dès qu'un token est obtenu, on passe à l'écran de dépôt du projet
  if (auth.token && etape === ETAPES.CONNEXION) {
    setEtape(ETAPES.DEPOT);
  }

  async function surDossierSelectionne(chemin: string) {
    setEtape(ETAPES.ANALYSE);
    setErreurDepot(null);
    try {
      const chemins = await listerCheminsRelatifs(chemin);
      if (chemins.length === 0) {
        throw new Error("Aucun fichier détecté dans ce dossier.");
      }
      const resultat = await analyzeProject(chemins);
      setCheminDossier(chemin);
      setAnalyse(resultat);
      setNomDepot(nomProjetDetecte(chemin));
      setEtape(ETAPES.ACTION);
    } catch (err) {
      setErreurDepot(
        err instanceof Error ? err.message : "Erreur pendant l'analyse du dossier"
      );
      setEtape(ETAPES.DEPOT);
    }
  }

  function reinitialiser() {
    setEtape(ETAPES.DEPOT);
    setCheminDossier(null);
    setAnalyse(null);
    setActionChoisie(null);
    setNomDepot("");
    setProgression(null);
    setUrlDepot(null);
    setErreurOperation(null);
  }

  async function surConfirmation() {
    if (!auth.token) return; // ne devrait pas arriver, garde-fou

    setEtape(ETAPES.EN_COURS);
    setErreurOperation(null);
    setProgression(null);

    try {
      if (actionChoisie === "creer" || actionChoisie === "publier") {
        if (!cheminDossier) throw new Error("Aucun dossier sélectionné.");
        const nom = nomDepot.trim();
        if (!nom) throw new Error("Choisis un nom de dépôt avant de continuer.");

        setProgression({ phase: "Création du dépôt sur GitHub…" });
        const depot = await creerOuRecupererDepot(auth.token, { nom, prive: true });

        if (!analyse?.hasExistingGit) {
          setProgression({ phase: "Initialisation du dépôt local…" });
          await initialiserDepot(cheminDossier);
        }

        setProgression({ phase: "Enregistrement des changements…" });
        await ajouterEtCommiter(cheminDossier, "Premier envoi");

        setProgression({ phase: "Envoi vers GitHub…" });
        await publier({
          dir: cheminDossier,
          remoteUrl: depot.clone_url,
          token: auth.token,
          onProgress: setProgression,
        });

        setUrlDepot(depot.html_url);
      } else if (actionChoisie === "maj") {
        if (!cheminDossier) throw new Error("Aucun dossier sélectionné.");
        if (!urlDepot) {
          throw new Error(
            "Aucun dépôt distant connu pour ce projet — utilise d'abord \"Publier\"."
          );
        }

        setProgression({ phase: "Synchronisation avec GitHub…" });
        await mettreAJour({
          dir: cheminDossier,
          remoteUrl: `${urlDepot}.git`,
          token: auth.token,
          onProgress: setProgression,
        });
      } else if (actionChoisie === "recuperer") {
        const nom = nomDepot.trim();
        if (!nom) throw new Error("Indique le nom du dépôt à récupérer.");
        if (!auth.login) {
          throw new Error("Impossible de déterminer ton nom d'utilisateur GitHub.");
        }

        setProgression({ phase: "Choix du dossier de destination…" });
        const destination = await ouvrirSelecteurDossier({ directory: true, multiple: false });
        if (!destination || Array.isArray(destination)) {
          throw new Error("Aucun dossier de destination choisi.");
        }

        setProgression({ phase: "Téléchargement du dépôt…" });
        await recuperer({
          dir: destination,
          remoteUrl: `https://github.com/${auth.login}/${nom}.git`,
          token: auth.token,
          onProgress: setProgression,
        });

        setUrlDepot(`https://github.com/${auth.login}/${nom}`);
      }

      setEtape(ETAPES.TERMINE);
    } catch (err) {
      setErreurOperation(
        err instanceof Error ? err.message : "Erreur pendant l'opération"
      );
      setEtape(ETAPES.CONFIRMATION);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      {etape === ETAPES.CONNEXION && (
        <EcranConnexionGitHub
          codeUtilisateur={auth.codeUtilisateur}
          urlVerification={auth.urlVerification}
          enAttente={auth.enAttente}
          erreur={auth.erreur}
          onConnecter={auth.connecter}
        />
      )}

      {etape === ETAPES.DEPOT && (
        <ZoneDepot onFolderSelected={surDossierSelectionne} erreur={erreurDepot} />
      )}

      {etape === ETAPES.ANALYSE && (
        <p className="text-slate-500 text-lg">Analyse du projet en cours…</p>
      )}

      {etape === ETAPES.ACTION && analyse && (
        <MenuActions
          analyse={analyse}
          onChoisir={(action) => {
            setActionChoisie(action);
            setEtape(ETAPES.CONFIRMATION);
          }}
        />
      )}

      {etape === ETAPES.CONFIRMATION && actionChoisie && (
        <EcranConfirmation
          action={actionChoisie}
          erreur={erreurOperation}
          nomDepot={nomDepot}
          onChangeNomDepot={setNomDepot}
          onConfirmer={surConfirmation}
          onAnnuler={() => setEtape(ETAPES.ACTION)}
        />
      )}

      {etape === ETAPES.EN_COURS && <EcranProgression progression={progression} />}

      {etape === ETAPES.TERMINE && (
        <EcranResultat urlDepot={urlDepot} onRecommencer={reinitialiser} />
      )}
    </div>
  );
}
