
export type Language = "fr" | "en";

export interface Translations {
  app: {
    title: string;
    subtitle: string;
    connectedAs: string;
    connectGitHub: string;
    connecting: string;
    disconnect: string;
    footerTech: string;
    language: string;
    noProject: string;
  };
  steps: {
    project: string;
    sensitive: string;
    sync: string;
    clone: string;
  };
  headers: {
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    step2Desc: string;
    step3Title: string;
    step3Desc: string;
    step4Title: string;
    step4Desc: string;
    badgeLinked: string;
    badgeGit: string;
    badgeFolder: string;
  };
  zoneDepot: {
    titleDefault: string;
    titleUpdate: string;
    subtitle: string;
    browseBtn: string;
    dialogError: string;
  };
  projectStep: {
    selectedFolder: string;
    filesCount: string;
    remoteUrlLabel: string;
    remoteUrlPlaceholder: string;
    saveRemoteBtn: string;
    updateRemoteBtn: string;
    folderAccess: string;
    folderAccessGranted: string;
    folderAccessDesc: string;
    gitRootTitle: string;
    gitRootPresent: string;
    gitRootAbsent: string;
    continueBtn: string;
  };
  sensitiveStep: {
    noProjectSelected: string;
    warningTitle: string;
    warningDesc: string;
    colFile: string;
    colAction: string;
    noSensitiveDetected: string;
    trackedDanger: string;
    untrackedWarn: string;
    untrackBtn: string;
    ignoreBtn: string;
    backBtn: string;
    continueBtn: string;
  };
  syncStep: {
    noProjectSelected: string;
    firstPublishTitle: string;
    firstPublishDesc: string;
    repoNamePlaceholder: string;
    privateRepoCheckbox: string;
    publicRepoLabel: string;
    createAndPublishBtn: string;
    branchLabel: string;
    refreshBtn: string;
    statAhead: string;
    statAheadDesc: string;
    statBehind: string;
    statBehindDesc: string;
    statClean: string;
    statDirty: string;
    statLocalState: string;
    statLocalChanges: string;
    divergenceTruncated: string;
    actionsTitle: string;
    actionsDesc: string;
    compareBtn: string;
    updateCardTitle: string;
    updateCardDesc: string;
    updateBtn: string;
    publishCardTitle: string;
    publishCardDesc: string;
    commitMsgPlaceholder: string;
    publishBtn: string;
    recentHistoryTitle: string;
    noCommits: string;
    unnamedCommit: string;
  };
  cloneStep: {
    title: string;
    desc: string;
    badge: string;
    urlLabel: string;
    urlPlaceholder: string;
    parentLabel: string;
    parentPlaceholder: string;
    browseBtn: string;
    subfolderLabel: string;
    selectPrompt: string;
    warningNotice: string;
    cancelBtn: string;
    cloneBtn: string;
  };
  authModal: {
    title: string;
    subtitle: string;
    prepareBtn: string;
    startBtn: string;
    enterCodePrompt: string;
    openGitHubBtn: string;
    githubOpenedBtn: string;
    expiresIn: (minutes: number, seconds: string) => string;
    expiredMsg: string;
    waitingBrowser: string;
    noVerificationUrl: string;
    retryBtn: string;
    browserError: string;
  };
  common: {
    loading: string;
    analyzingFolder: string;
    inProgress: string;
    close: string;
    dismiss: string;
  };
}

export const translations: Record<Language, Translations> = {
  fr: {
    app: {
      title: "GitHub Simplifié",
      subtitle: "Synchronisation de projets, sans ligne de commande",
      connectedAs: "connecté",
      connectGitHub: "Connecter GitHub",
      connecting: "Connexion…",
      disconnect: "Se déconnecter",
      footerTech: "Tauri · GitHub HTTPS · multi-plateforme",
      language: "Langue",
      noProject: "Aucun projet sélectionné",
    },
    steps: {
      project: "Projet",
      sensitive: "Fichiers sensibles",
      sync: "Tableau de bord Sync",
      clone: "Cloner un dépôt",
    },
    headers: {
      step1Title: "Choisir un projet",
      step1Desc: "Choisissez le dossier local à analyser ou à synchroniser.",
      step2Title: "Contrôle de sécurité & fichiers sensibles",
      step2Desc: "Examinez les fichiers suspects avant de les inclure dans un commit.",
      step3Title: "Tableau de bord de synchronisation",
      step3Desc: "Vérifiez les changements puis synchronisez sans écraser l’historique distant.",
      step4Title: "Récupérer un dépôt (cloner)",
      step4Desc: "Le dépôt est cloné dans un nouveau sous-dossier, sans écraser vos fichiers.",
      badgeLinked: "Dépôt lié",
      badgeGit: "Git détecté",
      badgeFolder: "Dossier sélectionné",
    },
    zoneDepot: {
      titleDefault: "Glisse-dépose un dossier de projet ici",
      titleUpdate: "Dépose le projet à mettre à jour",
      subtitle: "Les dépendances et dossiers de compilation sont ignorés automatiquement.",
      browseBtn: "Parcourir un dossier",
      dialogError: "Impossible d’ouvrir le sélecteur de dossier.",
    },
    projectStep: {
      selectedFolder: "Dossier sélectionné",
      filesCount: "fichiers",
      remoteUrlLabel: "Adresse du dépôt GitHub",
      remoteUrlPlaceholder: "https://github.com/compte/projet.git",
      saveRemoteBtn: "Enregistrer l’adresse",
      updateRemoteBtn: "Mettre à jour l’adresse",
      folderAccess: "Accès au dossier",
      folderAccessGranted: "Accès accordé via sélection native",
      folderAccessDesc: "L’accès est limité au dossier choisi. Le sélecteur natif fonctionne également hors du dossier personnel.",
      gitRootTitle: "Contrôle de racine Git :",
      gitRootPresent: "un dépôt Git est présent à la racine du dossier sélectionné.",
      gitRootAbsent: "aucun dépôt Git à la racine; il sera initialisé automatiquement lors de la publication.",
      continueBtn: "Examiner les fichiers & sécurité",
    },
    sensitiveStep: {
      noProjectSelected: "Choisis un dossier dans l’onglet « Projet » pour afficher les fichiers à contrôler.",
      warningTitle: "Vérifie les fichiers avant publication",
      warningDesc: "Le contrôle signale les noms de fichiers sensibles les plus courants (.env, clés privées, tokens). Relis la liste avant de publier.",
      colFile: "Fichier détecté",
      colAction: "État Git & action",
      noSensitiveDetected: "Aucun nom de fichier sensible connu détecté. Vérifie quand même manuellement tes fichiers avant la publication.",
      trackedDanger: "Danger : déjà suivi par Git. L’exclusion ne supprimera pas son historique.",
      untrackedWarn: "Fichier local suspect; son nom sera ajouté au .gitignore.",
      untrackBtn: "Retirer du suivi & ignorer",
      ignoreBtn: "Ajouter au .gitignore",
      backBtn: "← Retour",
      continueBtn: "Continuer vers le tableau de bord",
    },
    syncStep: {
      noProjectSelected: "Sélectionne un dossier dans l’onglet « Projet » pour ouvrir son tableau de bord.",
      firstPublishTitle: "Publier ce projet pour la première fois",
      firstPublishDesc: "Un dépôt privé sera créé par défaut sur GitHub. Les fichiers sensibles encore suivis bloquent la publication.",
      repoNamePlaceholder: "nom-du-depot",
      privateRepoCheckbox: "Privé",
      publicRepoLabel: "Public",
      createAndPublishBtn: "Créer & publier",
      branchLabel: "Branche :",
      refreshBtn: "Actualiser",
      statAhead: "Commits locaux en avance",
      statAheadDesc: "Prêts à être publiés",
      statBehind: "Commits distants en avance",
      statBehindDesc: "Disponibles sur GitHub",
      statClean: "Propre",
      statDirty: "fichier(s) modifié(s)",
      statLocalState: "État local",
      statLocalChanges: "Modifications locales",
      divergenceTruncated: "La divergence dépasse la limite de comparaison; les valeurs affichées sont des minimums.",
      actionsTitle: "Actions de synchronisation sécurisées",
      actionsDesc: "La récupération distante est en fast-forward seulement; aucune réécriture forcée n’est utilisée.",
      compareBtn: "Comparer l’état local avec GitHub",
      updateCardTitle: "Mettre à jour depuis GitHub",
      updateCardDesc: "Télécharge les commits déjà présents sur GitHub. Nécessite un dossier local sans changements; aucun fichier local n’est envoyé.",
      updateBtn: "Récupérer les mises à jour GitHub",
      publishCardTitle: "Publier / synchroniser",
      publishCardDesc: "Les changements locaux sont commités avec le message ci-dessous, puis envoyés sans écraser l’historique distant.",
      commitMsgPlaceholder: "Message du commit",
      publishBtn: "Publier mes modifications",
      recentHistoryTitle: "Historique récent",
      noCommits: "Aucun commit dans ce dépôt pour le moment.",
      unnamedCommit: "Commit sans message",
    },
    cloneStep: {
      title: "Assistant de clonage sécurisé",
      desc: "Le dépôt est créé dans un nouveau dossier enfant. Aucun fichier existant n’est remplacé.",
      badge: "GitHub HTTPS",
      urlLabel: "URL du dépôt GitHub distant",
      urlPlaceholder: "https://github.com/organisation/nom-du-projet.git",
      parentLabel: "Dossier parent cible",
      parentPlaceholder: "Choisir un dossier parent…",
      browseBtn: "Parcourir",
      subfolderLabel: "Sous-dossier qui sera créé",
      selectPrompt: "Sélectionne une URL et un dossier parent",
      warningNotice: "Si le dossier cible existe déjà et contient des fichiers, le clonage s’arrête sans les modifier.",
      cancelBtn: "Annuler",
      cloneBtn: "Cloner le projet",
    },
    authModal: {
      title: "Connexion à GitHub",
      subtitle: "Pas besoin de mot de passe ni de jeton à copier.",
      prepareBtn: "Préparation…",
      startBtn: "Se connecter avec GitHub",
      enterCodePrompt: "Saisis ce code sur GitHub :",
      openGitHubBtn: "Ouvrir GitHub",
      githubOpenedBtn: "GitHub ouvert",
      expiresIn: (min, sec) => `Ce code expire dans ${min}:${sec}.`,
      expiredMsg: "Ce code a expiré. Relance la connexion pour en obtenir un nouveau.",
      waitingBrowser: "En attente de validation depuis ton navigateur…",
      noVerificationUrl: "GitHub n’a pas fourni d’adresse de vérification.",
      retryBtn: "Réessayer la connexion",
      browserError: "Impossible d’ouvrir le navigateur.",
    },
    common: {
      loading: "Chargement…",
      analyzingFolder: "Analyse du dossier…",
      inProgress: "Opération en cours…",
      close: "Fermer",
      dismiss: "Masquer",
    },
  },
  en: {
    app: {
      title: "GitHub Simplified",
      subtitle: "Project synchronization without the command line",
      connectedAs: "connected",
      connectGitHub: "Connect GitHub",
      connecting: "Connecting…",
      disconnect: "Sign out",
      footerTech: "Tauri · GitHub HTTPS · Cross-platform",
      language: "Language",
      noProject: "No project selected",
    },
    steps: {
      project: "Project",
      sensitive: "Sensitive Files",
      sync: "Sync Dashboard",
      clone: "Clone Repository",
    },
    headers: {
      step1Title: "Select a Project",
      step1Desc: "Choose the local directory to analyze or synchronize.",
      step2Title: "Security Check & Sensitive Files",
      step2Desc: "Review sensitive files before including them in a commit.",
      step3Title: "Synchronization Dashboard",
      step3Desc: "Review local changes and synchronize without overwriting remote history.",
      step4Title: "Clone a Repository",
      step4Desc: "Clone into a clean subfolder without overwriting existing files.",
      badgeLinked: "Linked Repository",
      badgeGit: "Git Detected",
      badgeFolder: "Folder Selected",
    },
    zoneDepot: {
      titleDefault: "Drag and drop a project folder here",
      titleUpdate: "Drop the project to update here",
      subtitle: "Dependencies and build outputs are automatically ignored.",
      browseBtn: "Browse Folder",
      dialogError: "Could not open folder picker dialog.",
    },
    projectStep: {
      selectedFolder: "Selected Folder",
      filesCount: "files",
      remoteUrlLabel: "GitHub Repository URL",
      remoteUrlPlaceholder: "https://github.com/account/project.git",
      saveRemoteBtn: "Save Remote URL",
      updateRemoteBtn: "Update Remote URL",
      folderAccess: "Folder Access",
      folderAccessGranted: "Access granted via native dialog",
      folderAccessDesc: "Access is scoped to the chosen folder. Native picker works outside user home as well.",
      gitRootTitle: "Git Root Status:",
      gitRootPresent: "Git repository detected at root of selected folder.",
      gitRootAbsent: "No Git repo at root; it will be initialized automatically upon publishing.",
      continueBtn: "Review Files & Security",
    },
    sensitiveStep: {
      noProjectSelected: "Select a folder in the 'Project' tab to display files to inspect.",
      warningTitle: "Check files before publishing",
      warningDesc: "This check flags the most common sensitive file patterns (.env, private keys, tokens). Please verify carefully before publishing.",
      colFile: "Detected File",
      colAction: "Git State & Action",
      noSensitiveDetected: "No common sensitive files detected. Still, please review your files manually before publishing.",
      trackedDanger: "Danger: already tracked by Git. Ignoring will not erase it from commit history.",
      untrackedWarn: "Local sensitive file; its name will be added to .gitignore.",
      untrackBtn: "Untrack & Ignore",
      ignoreBtn: "Add to .gitignore",
      backBtn: "← Back",
      continueBtn: "Proceed to Dashboard",
    },
    syncStep: {
      noProjectSelected: "Select a folder in the 'Project' tab to open its synchronization dashboard.",
      firstPublishTitle: "Publish this project for the first time",
      firstPublishDesc: "A private repository will be created on GitHub by default. Any tracked sensitive files will block publishing.",
      repoNamePlaceholder: "repository-name",
      privateRepoCheckbox: "Private",
      publicRepoLabel: "Public",
      createAndPublishBtn: "Create & Publish",
      branchLabel: "Branch:",
      refreshBtn: "Refresh",
      statAhead: "Local commits ahead",
      statAheadDesc: "Ready to push",
      statBehind: "Remote commits ahead",
      statBehindDesc: "Available on GitHub",
      statClean: "Clean",
      statDirty: "modified file(s)",
      statLocalState: "Local state",
      statLocalChanges: "Local modifications",
      divergenceTruncated: "Divergence exceeds comparison limit; displayed values are minimums.",
      actionsTitle: "Safe Synchronization Actions",
      actionsDesc: "Remote pulling uses fast-forward only; no destructive history rewrite is used.",
      compareBtn: "Compare with GitHub",
      updateCardTitle: "Update from GitHub",
      updateCardDesc: "Download commits available on GitHub. Requires a clean working tree; no local files will be pushed.",
      updateBtn: "Pull GitHub Updates",
      publishCardTitle: "Publish / Sync",
      publishCardDesc: "Local changes are committed with the message below and pushed without force-pushing.",
      commitMsgPlaceholder: "Commit message",
      publishBtn: "Publish My Changes",
      recentHistoryTitle: "Recent History",
      noCommits: "No commits in this repository yet.",
      unnamedCommit: "Commit without message",
    },
    cloneStep: {
      title: "Safe Clone Assistant",
      desc: "The repository will be cloned into a new child folder. No existing files will be overwritten.",
      badge: "GitHub HTTPS",
      urlLabel: "Remote GitHub Repository URL",
      urlPlaceholder: "https://github.com/organization/project-name.git",
      parentLabel: "Target Parent Folder",
      parentPlaceholder: "Select a parent folder…",
      browseBtn: "Browse",
      subfolderLabel: "Subfolder to be created",
      selectPrompt: "Select a valid URL and parent folder",
      warningNotice: "If target directory already exists and contains files, cloning aborts without modifying them.",
      cancelBtn: "Cancel",
      cloneBtn: "Clone Project",
    },
    authModal: {
      title: "Sign in to GitHub",
      subtitle: "No password or manual token copying required.",
      prepareBtn: "Preparing…",
      startBtn: "Sign in with GitHub",
      enterCodePrompt: "Enter this code on GitHub:",
      openGitHubBtn: "Open GitHub",
      githubOpenedBtn: "GitHub Opened",
      expiresIn: (min, sec) => `This code expires in ${min}:${sec}.`,
      expiredMsg: "This code has expired. Restart sign-in to get a new code.",
      waitingBrowser: "Waiting for verification in your browser…",
      noVerificationUrl: "GitHub did not provide a verification URL.",
      retryBtn: "Retry sign-in",
      browserError: "Could not open system browser.",
    },
    common: {
      loading: "Loading…",
      analyzingFolder: "Analyzing directory…",
      inProgress: "Operation in progress…",
      close: "Close",
      dismiss: "Dismiss",
    },
  },
};

/**
 * Translates any raw error (Git, Tauri, network, or application) into a user-friendly string
 * in the chosen language.
 */
export function translateError(error: unknown, lang: Language): string {
  if (!error) {
    return lang === "fr" ? "Une erreur inattendue est survenue." : "An unexpected error occurred.";
  }

  const rawMessage = error instanceof Error ? error.message : String(error);

  // 1. Empty remote / null ref.length error (isomorphic-git bug on empty repos)
  if (
    rawMessage === "EMPTY_REMOTE" ||
    /ref\.length|null is not an object \(evaluating 'ref\.length'\)|cannot read properties of null \(reading 'length'\)/i.test(rawMessage)
  ) {
    return lang === "fr"
      ? "Le dépôt distant sur GitHub est vide ou ne possède pas encore de branche. Publiez d’abord votre projet avec le bouton « Publier mes modifications »."
      : "The remote repository on GitHub is empty or has no commits yet. Publish your project first using the 'Publish My Changes' button.";
  }

  // 2. Head not found / unborn repo
  if (/could not find (?:head|ref)|unborn|no commits/i.test(rawMessage)) {
    return lang === "fr"
      ? "Ce dépôt ne contient encore aucun commit. Publiez d’abord le projet ou vérifiez la branche configurée sur GitHub."
      : "This repository has no commits yet. Publish the project first or check the configured branch on GitHub.";
  }

  // 3. No author name provided
  if (/no name was provided for author/i.test(rawMessage)) {
    return lang === "fr"
      ? "Aucun nom d’auteur n’a été configuré pour Git. Connectez-vous à GitHub pour utiliser votre identifiant."
      : "No Git author name configured. Please connect to GitHub to use your identity.";
  }

  // 4. Tauri allow-lstat / forbidden path
  if (/allow-lstat|forbidden path/i.test(rawMessage)) {
    return lang === "fr"
      ? "Accès restreint par les permissions système. Les liens symboliques et dossiers de build sont automatiquement contournés."
      : "System permission restricted. Symbolic links and build folders are automatically bypassed.";
  }

  // 5. Port 1420 already in use
  if (/port 1420 is already in use/i.test(rawMessage)) {
    return lang === "fr"
      ? "Le port 1420 est déjà utilisé par un autre processus. Fermez les serveurs existants avant de relancer."
      : "Port 1420 is already in use. Please terminate existing dev processes before restarting.";
  }

  // 6. Already associated remote
  if (/remplacerRemote|Un dépôt distant est déjà associé/i.test(rawMessage)) {
    return lang === "fr"
      ? "Un dépôt distant est déjà associé à ce projet. Cliquez à nouveau pour confirmer son remplacement."
      : "A remote repository is already linked. Click again to confirm replacing it.";
  }

  // 7. Invalid GitHub URL
  if (/Entre une URL HTTPS GitHub valide|URL HTTPS valide/i.test(rawMessage)) {
    return lang === "fr"
      ? "Entrez une URL HTTPS GitHub valide, par exemple : https://github.com/compte/projet.git."
      : "Enter a valid GitHub HTTPS URL, e.g.: https://github.com/account/project.git.";
  }

  // 8. Sensitive files tracked
  if (/Publication bloquée.*fichiers.*sensibles/i.test(rawMessage)) {
    return lang === "fr"
      ? rawMessage
      : rawMessage
          .replace("Publication bloquée :", "Publishing blocked:")
          .replace("fichiers sensibles", "sensitive files")
          .replace("Retire-les de l’index", "Remove them from tracking");
  }

  // 9. Empty commit message
  if (/message du commit ne peut pas être vide/i.test(rawMessage)) {
    return lang === "fr"
      ? "Le message du commit ne peut pas être vide."
      : "Commit message cannot be empty.";
  }

  // 10. Needs GitHub connection
  if (/Connecte-toi à GitHub/i.test(rawMessage)) {
    return lang === "fr"
      ? "Connectez-vous à GitHub avant d’effectuer cette opération."
      : "Please connect to GitHub before performing this action.";
  }

  // 11. Destination not empty
  if (/dossier de destination n’est pas vide/i.test(rawMessage)) {
    return lang === "fr"
      ? "Le dossier de destination n’est pas vide. Choisissez un dossier vide pour cloner."
      : "Destination folder is not empty. Please choose an empty directory to clone into.";
  }

  // 12. Uncommitted local changes
  if (/modifications locales ne sont pas enregistrées/i.test(rawMessage)) {
    return lang === "fr"
      ? "Des modifications locales ne sont pas enregistrées. Publiez ou validez vos changements avant de mettre à jour."
      : "You have uncommitted local changes. Publish or save them before pulling updates.";
  }

  // 13. Repo already exists
  if (/existe déjà/i.test(rawMessage)) {
    return lang === "fr"
      ? rawMessage
      : rawMessage.replace("existe déjà", "already exists on GitHub");
  }

  // 14b. HTTP 403 Forbidden (isomorphic-git HttpError wrapping GitHub's 403)
  // Causes : User-Agent absent (WAF), mauvais format auth, branche protégée,
  //          ou droits d'écriture insuffisants sur le dépôt.
  if (/403|forbidden/i.test(rawMessage)) {
    const details = (error as { data?: { response?: string } })?.data?.response;
    const extra = details && details.trim() && !details.includes("<html")
      ? ` — ${details.slice(0, 200).trim()}`
      : "";
    return lang === "fr"
      ? `Accès refusé par GitHub (HTTP 403 Forbidden)${extra}. Vérifiez que vous avez bien les droits d'écriture sur ce dépôt, que la branche n'est pas protégée, ou déconnectez puis reconnectez votre compte GitHub.`
      : `Access denied by GitHub (HTTP 403 Forbidden)${extra}. Verify you have write access to this repository, that the branch is not protected, or sign out and reconnect your GitHub account.`;
  }

  // 14. Network / offline error
  if (/failed to fetch|network error|cannot contact|dns|timeout/i.test(rawMessage)) {
    return lang === "fr"
      ? "Impossible de contacter GitHub. Vérifiez votre connexion Internet."
      : "Could not reach GitHub. Please check your network connection.";
  }

  // 15. Auth expired / 401
  if (/bad credentials|401|unauthorized/i.test(rawMessage)) {
    return lang === "fr"
      ? "Session GitHub expirée ou invalide. Déconnectez-vous puis reconnectez-vous."
      : "GitHub session expired or invalid. Please sign out and reconnect.";
  }

  // 16. Fast-forward conflict
  if (/fastforward|merge conflict|divergent/i.test(rawMessage)) {
    return lang === "fr"
      ? "Impossible de mettre à jour en avance rapide : des modifications distantes entrent en conflit avec vos fichiers locaux."
      : "Cannot fast-forward: remote changes conflict with your local modifications.";
  }

  // Fallback to original
  return rawMessage;
}

const STORAGE_KEY = "github_simplifie_lang";

export function getInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "fr" || saved === "en") return saved;
    const browserLang = navigator.language?.toLowerCase() ?? "";
    return browserLang.startsWith("en") ? "en" : "fr";
  } catch {
    return "fr";
  }
}

export function saveLanguage(lang: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Ignore localStorage errors
  }
}
