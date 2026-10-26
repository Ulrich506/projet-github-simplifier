
export type Language = "fr" | "en" | "es";

export interface Translations {
  app: {
    title: string;
    subtitle: string;
    connectedAs: string;
    connectGitHub: string;
    connecting: string;
    disconnect: string;
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
    localPathLabel: string;
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
    statClean: string;
    statLocalState: string;
    statLocalChanges: string;
    actionsTitle: string;
    actionsDesc: string;
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
  dialogs: {
    disconnectTitle: string;
    disconnectDescription: string;
    confirmDisconnect: string;
    cancel: string;
    hideCommit: string;
  };
  operationProgress: {
    publishing: string;
    cloning: string;
    completed: string;
  };
  ui: {
    settings: string;
    reconnectAccount: string;
    chooseAnotherFolder: string;
    reauthorizeFolder: string;
    repositoryVisibility: string;
    accountsTitle: string;
    hiddenCommitNotice: string;
    forgetAccount: (login: string) => string;
    addAccount: string;
    preferencesSaveError: string;
    remoteUrlInvalid: string;
    replaceRemoteConfirm: string;
    remoteLinked: string;
    cannotUntrack: (filepath: string) => string;
    sensitiveExcluded: (filepath: string) => string;
    sensitiveFilesTracked: (files: string[]) => string;
    linkRemoteFirst: string;
    remoteAlreadyLinked: string;
    repositoryNameRequired: string;
    syncCompleted: string;
    publishSuccess: (url: string) => string;
    cloneInputRequired: string;
    cloneSuccess: (path: string) => string;
  };
}

export const translations: Record<"fr" | "en", Translations> = {
  fr: {
    app: {
      title: "Gsimplifié",
      subtitle: "Synchronisation de projets, sans ligne de commande",
      connectedAs: "connecté",
      connectGitHub: "Connecter GitHub",
      connecting: "Connexion…",
      disconnect: "Se déconnecter",
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
      localPathLabel: "Chemin local",
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
      warningTitle: "Protection automatique des fichiers sensibles",
      warningDesc: "Les fichiers sensibles sont automatiquement exclus et retirés du suivi Git avant la publication. Leur contenu reste localement sur votre machine.",
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
      statClean: "Propre",
      statLocalState: "État local",
      statLocalChanges: "Modifications locales",
      actionsTitle: "Mettre à jour le projet sur GitHub",
      actionsDesc: "Les changements locaux sont enregistrés puis envoyés sans réécrire l’historique distant.",
      commitMsgPlaceholder: "Message du commit",
      publishBtn: "Mettre à jour le projet",
      recentHistoryTitle: "Historique récent",
      noCommits: "Aucun commit dans ce dépôt pour le moment.",
      unnamedCommit: "Commit sans message",
    },
    cloneStep: {
      title: "Assistant de clonage sécurisé",
      desc: "Les dépôts publics peuvent être clonés sans connexion. Connecte-toi pour les dépôts privés.",
      badge: "GitHub HTTPS",
      urlLabel: "URL du dépôt GitHub distant",
      urlPlaceholder: "https://github.com/organisation/nom-du-projet.git",
      parentLabel: "Dossier parent cible",
      parentPlaceholder: "Choisir un dossier parent…",
      browseBtn: "Parcourir",
      subfolderLabel: "Sous-dossier qui sera créé",
      selectPrompt: "Sélectionne une URL et un dossier parent",
      warningNotice: "Le clonage s’arrête si le dossier cible existe déjà. Aucun fichier existant n’est modifié.",
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
    dialogs: {
      disconnectTitle: "Se déconnecter de GitHub ?",
      disconnectDescription: "La session active sera fermée. Le compte restera enregistré dans le trousseau sécurisé pour te reconnecter plus facilement ; utilise « X » dans la liste pour l’oublier.",
      confirmDisconnect: "Se déconnecter",
      cancel: "Annuler",
      hideCommit: "Masquer ce commit dans la liste",
    },
    operationProgress: {
      publishing: "Publication sécurisée vers GitHub…",
      cloning: "Clonage du dépôt depuis GitHub…",
      completed: "Terminé",
    },
    ui: {
      settings: "Paramètres",
      reconnectAccount: "Reconnecter le compte",
      chooseAnotherFolder: "Choisir un autre dossier",
      reauthorizeFolder: "Réautoriser le dossier",
      repositoryVisibility: "Visibilité du dépôt",
      accountsTitle: "Comptes GitHub enregistrés",
      hiddenCommitNotice: "Masquer un élément ne supprime pas le commit Git.",
      forgetAccount: (login) => `Oublier ${login}`,
      addAccount: "Ajouter / connecter un autre compte",
      preferencesSaveError: "Les préférences ne peuvent pas être enregistrées sur cet appareil.",
      remoteUrlInvalid: "Entre une URL HTTPS GitHub valide, par exemple https://github.com/compte/projet.git.",
      replaceRemoteConfirm: "Cette action remplacera l’URL du dépôt distant actuel. Clique à nouveau pour confirmer.",
      remoteLinked: "Le dépôt distant est associé à ce dossier.",
      cannotUntrack: (filepath) => `Impossible de retirer ${filepath} de l’index Git.`,
      sensitiveExcluded: (filepath) => `${filepath} est exclu des prochains commits. Son historique Git existant n’est pas effacé.`,
      sensitiveFilesTracked: (files) => `Publication bloquée : ces fichiers sensibles sont encore suivis par Git : ${files.join(", ")}.`,
      linkRemoteFirst: "Associe d’abord un dépôt GitHub à ce projet.",
      remoteAlreadyLinked: "Un dépôt distant est déjà associé. Utilise le bouton « Mettre à jour le projet » ou confirme son remplacement dans l’étape Projet.",
      repositoryNameRequired: "Indique un nom de dépôt.",
      syncCompleted: "Synchronisation terminée sans forcer l’historique distant.",
      publishSuccess: (url) => `Dépôt publié avec succès : ${url}`,
      cloneInputRequired: "Renseigne une URL GitHub valide et choisis un dossier parent.",
      cloneSuccess: (path) => `Dépôt cloné dans ${path}`,
    },
  },
  en: {
    app: {
      title: "Gsimplifie",
      subtitle: "Project synchronization without the command line",
      connectedAs: "connected",
      connectGitHub: "Connect GitHub",
      connecting: "Connecting…",
      disconnect: "Sign out",
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
      localPathLabel: "Local path",
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
      warningTitle: "Automatic protection for sensitive files",
      warningDesc: "Sensitive files are automatically excluded and removed from Git tracking before publishing. Their content stays on your local machine.",
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
      statClean: "Clean",
      statLocalState: "Local state",
      statLocalChanges: "Local modifications",
      actionsTitle: "Update the project on GitHub",
      actionsDesc: "Local changes are committed and pushed without rewriting remote history.",
      commitMsgPlaceholder: "Commit message",
      publishBtn: "Update project",
      recentHistoryTitle: "Recent History",
      noCommits: "No commits in this repository yet.",
      unnamedCommit: "Commit without message",
    },
    cloneStep: {
      title: "Safe Clone Assistant",
      desc: "Public repositories can be cloned without signing in. Sign in to access private repositories.",
      badge: "GitHub HTTPS",
      urlLabel: "Remote GitHub Repository URL",
      urlPlaceholder: "https://github.com/organization/project-name.git",
      parentLabel: "Target Parent Folder",
      parentPlaceholder: "Select a parent folder…",
      browseBtn: "Browse",
      subfolderLabel: "Subfolder to be created",
      selectPrompt: "Select a valid URL and parent folder",
      warningNotice: "Cloning stops if the target directory already exists. Existing files are never modified.",
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
    dialogs: {
      disconnectTitle: "Sign out of GitHub?",
      disconnectDescription: "The active session will be closed. The account remains in the secure keychain for quick sign-in; use “X” in the account list to forget it.",
      confirmDisconnect: "Sign out",
      cancel: "Cancel",
      hideCommit: "Hide this commit from the list",
    },
    operationProgress: {
      publishing: "Safely publishing to GitHub…",
      cloning: "Cloning repository from GitHub…",
      completed: "Completed",
    },
    ui: {
      settings: "Settings",
      reconnectAccount: "Reconnect account",
      chooseAnotherFolder: "Choose another folder",
      reauthorizeFolder: "Re-authorize folder",
      repositoryVisibility: "Repository visibility",
      accountsTitle: "Saved GitHub accounts",
      hiddenCommitNotice: "Hiding an item does not delete the Git commit.",
      forgetAccount: (login) => `Forget ${login}`,
      addAccount: "Add / sign in to another account",
      preferencesSaveError: "Preferences could not be saved on this device.",
      remoteUrlInvalid: "Enter a valid GitHub HTTPS URL, for example https://github.com/account/project.git.",
      replaceRemoteConfirm: "This will replace the current remote URL. Click again to confirm.",
      remoteLinked: "The remote repository is linked to this folder.",
      cannotUntrack: (filepath) => `Could not remove ${filepath} from the Git index.`,
      sensitiveExcluded: (filepath) => `${filepath} is excluded from future commits. Its existing Git history is unchanged.`,
      sensitiveFilesTracked: (files) => `Publishing blocked: these sensitive files are still tracked by Git: ${files.join(", ")}.`,
      linkRemoteFirst: "Link a GitHub repository to this project first.",
      remoteAlreadyLinked: "A remote repository is already linked. Use “Update project” or confirm its replacement in the Project step.",
      repositoryNameRequired: "Enter a repository name.",
      syncCompleted: "Sync completed without forcing remote history.",
      publishSuccess: (url) => `Repository published successfully: ${url}`,
      cloneInputRequired: "Enter a valid GitHub URL and choose a parent folder.",
      cloneSuccess: (path) => `Repository cloned into ${path}`,
    },
  },
};

export function getTranslations(lang: Language): Translations {
  if (lang === "fr") return translations.fr;
  const english = translations.en;
  if (lang === "en") return english;
  if (lang === "es") {
    return {
      ...english,
      app: { ...english.app, title: "Gsimplifie", subtitle: "Sincroniza proyectos sin usar la terminal", connectedAs: "conectado", connectGitHub: "Conectar GitHub", connecting: "Conectando…", disconnect: "Cerrar sesión", language: "Idioma", noProject: "Ningún proyecto seleccionado" },
      steps: { project: "Proyecto", sensitive: "Archivos sensibles", sync: "Sincronización", clone: "Clonar repositorio" },
      headers: { ...english.headers, step1Title: "Seleccionar proyecto", step1Desc: "Elige una carpeta local para analizar o sincronizar.", step2Title: "Revisión de seguridad", step2Desc: "Revisa los archivos sensibles antes de publicarlos.", step3Title: "Sincronizar proyecto", step3Desc: "Actualiza el repositorio sin sobrescribir su historial.", step4Title: "Clonar repositorio", step4Desc: "Clona en una carpeta nueva sin sobrescribir archivos.", badgeLinked: "Repositorio vinculado", badgeGit: "Git detectado", badgeFolder: "Carpeta seleccionada" },
      zoneDepot: { ...english.zoneDepot, titleDefault: "Arrastra aquí una carpeta de proyecto", titleUpdate: "Suelta aquí el proyecto que quieres actualizar", subtitle: "Las dependencias y carpetas de compilación se omiten automáticamente.", browseBtn: "Elegir carpeta", dialogError: "No se pudo abrir el selector de carpetas." },
      projectStep: { ...english.projectStep, selectedFolder: "Carpeta seleccionada", localPathLabel: "Ruta local", filesCount: "archivos", remoteUrlLabel: "URL del repositorio GitHub", remoteUrlPlaceholder: "https://github.com/cuenta/proyecto.git", saveRemoteBtn: "Guardar URL", updateRemoteBtn: "Actualizar URL", folderAccess: "Acceso a la carpeta", folderAccessGranted: "Acceso concedido", folderAccessDesc: "El acceso se limita a la carpeta elegida.", gitRootTitle: "Estado de Git:", gitRootPresent: "Hay un repositorio Git en la carpeta.", gitRootAbsent: "Git se inicializará al publicar por primera vez.", continueBtn: "Revisar archivos y seguridad" },
      sensitiveStep: { ...english.sensitiveStep, noProjectSelected: "Selecciona una carpeta en Proyecto.", warningTitle: "Protección automática de archivos sensibles", warningDesc: "Los archivos sensibles se excluyen automáticamente antes de publicar y se eliminan del seguimiento de Git. Su contenido se queda en tu equipo.", colFile: "Archivo detectado", colAction: "Estado y acción", noSensitiveDetected: "No se detectaron nombres sensibles conocidos.", trackedDanger: "Git ya sigue este archivo; ignorarlo no elimina su historial.", untrackedWarn: "Archivo sospechoso; se añadirá a .gitignore.", untrackBtn: "Dejar de seguir e ignorar", ignoreBtn: "Añadir a .gitignore", backBtn: "← Volver", continueBtn: "Continuar" },
      syncStep: { ...english.syncStep, noProjectSelected: "Selecciona una carpeta en Proyecto.", firstPublishTitle: "Publicar este proyecto por primera vez", firstPublishDesc: "Se creará un repositorio privado de forma predeterminada.", repoNamePlaceholder: "nombre-del-repositorio", privateRepoCheckbox: "Privado", publicRepoLabel: "Público", createAndPublishBtn: "Crear y publicar", branchLabel: "Rama:", statClean: "Sin cambios", statLocalState: "Estado local", statLocalChanges: "Cambios locales", actionsTitle: "Actualizar proyecto en GitHub", actionsDesc: "Los cambios locales se guardan y envían sin reescribir el historial remoto.", commitMsgPlaceholder: "Mensaje del commit", publishBtn: "Actualizar proyecto", recentHistoryTitle: "Historial reciente", noCommits: "Todavía no hay commits.", unnamedCommit: "Commit sin mensaje" },
      cloneStep: { ...english.cloneStep, title: "Clonar repositorio", desc: "Los repositorios públicos se pueden clonar sin iniciar sesión. Inicia sesión para repositorios privados.", badge: "GitHub HTTPS", urlLabel: "URL del repositorio GitHub", urlPlaceholder: "https://github.com/organizacion/proyecto.git", parentLabel: "Carpeta de destino", parentPlaceholder: "Elegir carpeta de destino…", browseBtn: "Examinar", subfolderLabel: "Carpeta que se creará", selectPrompt: "Selecciona una URL y una carpeta", warningNotice: "El clonado se detiene si la carpeta de destino ya existe.", cancelBtn: "Cancelar", cloneBtn: "Clonar proyecto" },
      common: { ...english.common, loading: "Cargando…", analyzingFolder: "Analizando carpeta…", inProgress: "Operación en curso…", close: "Cerrar", dismiss: "Ocultar" },
      dialogs: { ...english.dialogs, disconnectTitle: "¿Cerrar sesión de GitHub?", disconnectDescription: "Se cerrará la sesión activa. La cuenta se conservará para volver a conectarte rápidamente.", confirmDisconnect: "Cerrar sesión", cancel: "Cancelar", hideCommit: "Ocultar este commit" },
      operationProgress: { publishing: "Publicando en GitHub…", cloning: "Clonando desde GitHub…", completed: "Completado" },
      authModal: {
        title: "Iniciar sesión en GitHub",
        subtitle: "No necesitas una contraseña ni copiar un token.",
        prepareBtn: "Preparando…",
        startBtn: "Conectar con GitHub",
        enterCodePrompt: "Introduce este código en GitHub:",
        openGitHubBtn: "Abrir GitHub",
        githubOpenedBtn: "GitHub abierto",
        expiresIn: (minutes, seconds) => `El código caduca en ${minutes}:${seconds}.`,
        expiredMsg: "El código ha caducado. Inicia sesión de nuevo para obtener otro.",
        waitingBrowser: "Esperando la confirmación en el navegador…",
        noVerificationUrl: "GitHub no proporcionó una URL de verificación.",
        retryBtn: "Reintentar conexión",
        browserError: "No se pudo abrir el navegador del sistema.",
      },
      ui: {
        settings: "Ajustes",
        reconnectAccount: "Volver a conectar la cuenta",
        chooseAnotherFolder: "Elegir otra carpeta",
        reauthorizeFolder: "Volver a autorizar la carpeta",
        repositoryVisibility: "Visibilidad del repositorio",
        accountsTitle: "Cuentas de GitHub guardadas",
        hiddenCommitNotice: "Ocultar un elemento no elimina el commit de Git.",
        forgetAccount: (login) => `Olvidar ${login}`,
        addAccount: "Añadir o conectar otra cuenta",
        preferencesSaveError: "No se pudieron guardar las preferencias en este dispositivo.",
        remoteUrlInvalid: "Introduce una URL HTTPS válida de GitHub, por ejemplo: https://github.com/cuenta/proyecto.git.",
        replaceRemoteConfirm: "Esta acción reemplazará la URL remota actual. Haz clic de nuevo para confirmar.",
        remoteLinked: "El repositorio remoto está vinculado a esta carpeta.",
        cannotUntrack: (filepath) => `No se pudo dejar de seguir ${filepath} en Git.`,
        sensitiveExcluded: (filepath) => `${filepath} se excluirá de los próximos commits. No se elimina su historial de Git.`,
        sensitiveFilesTracked: (files) => `Publicación bloqueada: Git todavía sigue estos archivos sensibles: ${files.join(", ")}.`,
        linkRemoteFirst: "Vincula primero un repositorio de GitHub a este proyecto.",
        remoteAlreadyLinked: "Ya hay un repositorio remoto vinculado. Usa «Actualizar proyecto» o confirma su reemplazo en la pestaña Proyecto.",
        repositoryNameRequired: "Escribe un nombre para el repositorio.",
        syncCompleted: "Sincronización completada sin forzar el historial remoto.",
        publishSuccess: (url) => `Repositorio publicado correctamente: ${url}`,
        cloneInputRequired: "Introduce una URL válida de GitHub y selecciona una carpeta contenedora.",
        cloneSuccess: (path) => `Repositorio clonado en ${path}`,
      },
    };
  }
  return english;
}

function extractErrorMessage(error: unknown): string {
  const messages: string[] = [];
  const visited = new Set<object>();

  function visit(value: unknown, depth: number): void {
    if (depth > 4 || value == null) return;
    if (typeof value === "string") {
      if (value.trim()) messages.push(value.trim());
      return;
    }
    if (typeof value !== "object" || visited.has(value)) return;
    visited.add(value);

    const record = value as Record<string, unknown>;
    for (const key of ["message", "code", "status", "stderr", "error", "cause"]) {
      visit(record[key], depth + 1);
    }

    const response = record.response;
    if (response && typeof response === "object") {
      const responseRecord = response as Record<string, unknown>;
      visit(responseRecord.status, depth + 1);
      visit(responseRecord.data, depth + 1);
    }
  }

  visit(error, 0);
  return [...new Set(messages)].join(" ");
}

/**
 * Translates any raw error (Git, Tauri, network, or application) into a user-friendly string
 * in the chosen language.
 */
export function translateError(error: unknown, lang: Language): string {
  const french = lang === "fr";
  const spanish = lang === "es";
  const message = extractErrorMessage(error);

  if (/GIT_HTTP_BODY_TOO_LARGE/i.test(message)) {
    return french
      ? "L’envoi Git est trop volumineux pour la mémoire sûre du client HTTP de l’application. Les dossiers et fichiers volumineux sont ignorés ; réduisez les changements envoyés ou découpez-les en plusieurs commits."
      : spanish
        ? "El envío de Git es demasiado grande para la memoria segura del cliente HTTP. Se excluyen las carpetas y archivos grandes; reduce los cambios o divídelos en varios commits."
        : "The Git upload is too large for the HTTP client’s safe memory limit. Large folders and files are excluded; reduce the changes or split them into smaller commits.";
  }

  if (message === "SYNC_OFFLINE_LOCAL_COMMIT_SAVED") {
    return french
      ? "Pas de connexion réseau : votre commit est enregistré dans le dépôt local. Reconnectez-vous à Internet puis relancez la synchronisation."
      : spanish
        ? "Sin conexión de red: el commit está guardado en el repositorio local. Vuelve a conectarte y reanuda la sincronización."
        : "You are offline: your commit is saved in the local repository. Reconnect and retry synchronization.";
  }
  if (message.startsWith("GITHUB_FILE_TOO_LARGE:")) {
    const files = message.slice("GITHUB_FILE_TOO_LARGE:".length).split("|").filter(Boolean);
    const names = files.join(", ");
    return french
      ? `Publication bloquée : ces fichiers dépassent la limite GitHub de 100 Mio : ${names}. Retirez-les du commit ou utilisez Git LFS, puis réessayez.`
      : spanish
        ? `Publicación bloqueada: estos archivos superan el límite de GitHub de 100 MiB: ${names}. Retíralos del commit o usa Git LFS y vuelve a intentarlo.`
        : `Publishing blocked: these files exceed GitHub's 100 MiB limit: ${names}. Remove them from the commit or use Git LFS, then retry.`;
  }

  if (/multiple references|multiple ref|refspec|ambiguous ref/i.test(message)) {
    return french
      ? "La branche distante est ambiguë. Vérifiez son nom et réessayez ; aucune réécriture de l’historique ne sera effectuée."
      : spanish
        ? "La rama remota es ambigua. Comprueba su nombre y vuelve a intentarlo; no se reescribirá el historial."
        : "The remote branch is ambiguous. Check its name and retry; remote history will not be rewritten.";
  }
  if (/forbidden path|allow-lstat|permission denied|access is denied|eacces|os error 3|winerror\s*3|no such file or directory|cannot access|impossible.{0,50}(?:dossier|autoriser|accès)/i.test(message)) {
    return french
      ? "L’accès au dossier du projet n’est plus disponible. Autorisez-le à nouveau en le sélectionnant avec le sélecteur de dossiers."
      : spanish
        ? "Ya no se puede acceder a la carpeta del proyecto. Vuelve a autorizarla seleccionándola con el selector de carpetas."
        : "The project folder is no longer accessible. Re-authorize it by selecting it with the folder picker.";
  }
  if (/repository not found|not found|introuvable|\b404\b/i.test(message)) {
    return french
      ? "Dépôt GitHub introuvable ou inaccessible. Vérifiez l’URL et les droits de votre compte, puis réessayez."
      : spanish
        ? "No se encuentra el repositorio de GitHub o no tienes acceso. Comprueba la URL y los permisos de tu cuenta."
        : "GitHub repository not found or inaccessible. Check the URL and your account permissions, then try again.";
  }
  if (/bad credentials|\b401\b|unauthorized|authentication failed|could not authenticate/i.test(message)) {
    return french
      ? "Connexion à GitHub impossible. Vérifiez votre session dans l’application, puis reconnectez-vous si nécessaire."
      : spanish
        ? "No se pudo iniciar sesión en GitHub. Comprueba la sesión de la aplicación y vuelve a conectarte si es necesario."
        : "Could not authenticate with GitHub. Check your app session and sign in again if needed.";
  }
  if (/failed to fetch|network error|cannot contact|dns|timeout|connection reset|network request failed|connection refused|offline/i.test(message)) {
    return french
      ? "Impossible de contacter GitHub. Vérifiez votre connexion Internet et réessayez."
      : spanish
        ? "No se pudo conectar con GitHub. Comprueba tu conexión a Internet e inténtalo de nuevo."
        : "Could not reach GitHub. Check your internet connection and try again.";
  }
  if (/EMPTY_REMOTE|ref\.length|null is not an object|could not find.*head|unborn|no commits/i.test(message)) {
    return french
      ? "Le dépôt distant est vide ou ne possède pas encore de commit. Publiez d’abord le projet ou vérifiez la branche."
      : spanish
        ? "El repositorio remoto está vacío o aún no tiene commits. Publica primero el proyecto o comprueba la rama."
        : "The remote repository is empty or has no commits yet. Publish the project first or check the branch.";
  }
  if (/fichiers sensibles|sensitive files|archivos sensibles/i.test(message)) {
    return french
      ? "La publication est bloquée : vérifiez les fichiers sensibles signalés et retirez-les du suivi Git avant de réessayer."
      : spanish
        ? "La publicación está bloqueada: revisa los archivos sensibles señalados y quítalos del seguimiento de Git antes de volver a intentarlo."
        : "Publishing is blocked: review the flagged sensitive files and remove them from Git tracking before retrying.";
  }
  if (/modifications locales ne sont pas enregistrées|uncommitted local changes/i.test(message)) {
    return french
      ? "Des modifications locales ne sont pas enregistrées. Publiez ou validez vos changements avant de récupérer les mises à jour."
      : spanish
        ? "Hay cambios locales sin guardar. Publícalos o confírmalos antes de descargar actualizaciones."
        : "You have uncommitted local changes. Commit or publish them before pulling updates.";
  }
  if (/fastforward|merge conflict|divergent/i.test(message)) {
    return french
      ? "La mise à jour rapide est impossible car les historiques divergent. Vérifiez les changements sur GitHub avant de réessayer."
      : spanish
        ? "No se puede actualizar en avance rápido porque los historiales divergen. Revisa los cambios de GitHub antes de volver a intentarlo."
        : "A fast-forward update is not possible because the histories have diverged. Review the GitHub changes before retrying.";
  }
  if (/conflict|unmerged|needs merge|merge failed/i.test(message)) {
    return french
      ? "Des fichiers sont en conflit. Aucun choix local ou distant n’a été appliqué automatiquement : examinez les fichiers concernés, résolvez-les, puis relancez la synchronisation."
      : spanish
        ? "Hay archivos en conflicto. No se aplicó automáticamente ninguna versión local o remota: revisa y resuelve los archivos antes de sincronizar de nuevo."
        : "Some files are in conflict. No local or remote version was chosen automatically; review and resolve the files before retrying synchronization.";
  }
  if (/message du commit ne peut pas être vide|commit message cannot be empty/i.test(message)) {
    return french ? "Le message du commit ne peut pas être vide."
      : spanish ? "El mensaje del commit no puede estar vacío."
        : "The commit message cannot be empty.";
  }

  if (!message) {
    return french
      ? "Une erreur inattendue est survenue. Réessayez. Si le problème persiste, vérifiez l’accès au projet et à GitHub."
      : spanish
        ? "Se produjo un error inesperado. Vuelve a intentarlo y comprueba el acceso al proyecto y a GitHub."
        : "An unexpected error occurred. Retry and check access to the project and GitHub.";
  }

  const rawMessage = message;
  if (lang === "es") {
    const spanish = lang === "es";
    if (/GIT_OPERATION_CANCELLED/i.test(rawMessage)) {
      return "Operación Git cancelada. No se eliminaron los archivos del proyecto.";
    }
    if (/GIT_OPERATION_TIMEOUT/i.test(rawMessage)) {
      return "La operación Git superó el límite de 15 minutos. Comprueba la conexión y el estado del repositorio e inténtalo de nuevo.";
    }
    if (/GIT_OPERATION_BUSY/i.test(rawMessage)) {
      return "Ya hay una operación Git en curso. Espera a que termine antes de iniciar otra.";
    }
    if (/GIT_TOO_MANY_(?:SENSITIVE|LARGE)_FILES/i.test(rawMessage)) {
      return "Hay demasiados archivos para excluir en una sola operación. Divide el proyecto o añade reglas a .gitignore e inténtalo de nuevo.";
    }
    if (/GIT_PREVIEW_TOO_LARGE/i.test(rawMessage)) {
      return "Vista previa no disponible: el archivo supera los 512 KB.";
    }
    if (/GIT_PREVIEW_BINARY/i.test(rawMessage)) {
      return "Vista previa no disponible: el archivo parece binario.";
    }
    if (/GIT_PREVIEW_INVALID_UTF8/i.test(rawMessage)) {
      return "Vista previa no disponible: el archivo no es texto UTF-8.";
    }
    if (/forbidden path|allow-lstat/i.test(rawMessage)) {
      return spanish
        ? "No se permite acceder a esta carpeta. Selecciónala con el selector de carpetas de la aplicación."
        : "لا يُسمح بالوصول إلى هذا المجلد. اختره باستخدام أداة اختيار المجلدات في التطبيق.";
    }
    if (/destination folder already exists|dossier de destination existe déjà/i.test(rawMessage)) {
      return spanish ? "La carpeta de destino ya existe. Elige otro nombre o ubicación." : "مجلد الوجهة موجود بالفعل. اختر اسمًا أو موقعًا آخر.";
    }
    if (/sensitive files|fichiers sensibles/i.test(rawMessage)) {
      return spanish ? "La publicación se bloqueó porque se detectaron archivos potencialmente sensibles." : "تم إيقاف النشر بسبب اكتشاف ملفات قد تحتوي على معلومات حساسة.";
    }
    if (/failed to fetch|network error|timeout|dns/i.test(rawMessage)) {
      return spanish ? "No se pudo conectar con GitHub. Comprueba tu conexión a Internet." : "تعذر الاتصال بـ GitHub. تحقق من اتصالك بالإنترنت.";
    }
    if (/403|forbidden|acceso denegado/i.test(rawMessage)) {
      return spanish ? "GitHub rechazó el acceso. Comprueba los permisos de escritura y la protección de la rama." : "رفض GitHub الوصول. تحقق من صلاحيات الكتابة وحماية الفرع.";
    }
    if (/401|unauthorized|bad credentials/i.test(rawMessage)) {
      return spanish ? "La sesión de GitHub ha caducado o no es válida. Vuelve a iniciar sesión." : "انتهت صلاحية جلسة GitHub أو أصبحت غير صالحة. سجّل الدخول مجددًا.";
    }
    if (/connecte-toi à github|please connect to github/i.test(rawMessage)) {
      return spanish ? "Conéctate a GitHub antes de realizar esta operación." : "سجّل الدخول إلى GitHub قبل تنفيذ هذه العملية.";
    }
    if (/associe d’abord un dépôt|please link a github repository/i.test(rawMessage)) {
      return spanish ? "Vincula primero un repositorio de GitHub a este proyecto." : "اربط مستودع GitHub بهذا المشروع أولًا.";
    }
    if (/url.*github.*valide|valid github https url/i.test(rawMessage)) {
      return spanish ? "Introduce una URL HTTPS válida de GitHub." : "أدخل عنوان HTTPS صالحًا لمستودع GitHub.";
    }
    if (/no name was provided for author|aucun nom d’auteur/i.test(rawMessage)) {
      return spanish ? "No se pudo determinar el autor del commit. Revisa la identidad de Git." : "تعذر تحديد مؤلف عملية الالتزام. تحقق من هوية Git.";
    }
    if (/ref\.length|null is not an object|could not find.*head|unborn/i.test(rawMessage)) {
      return spanish ? "El repositorio todavía no tiene commits. Publica primero el proyecto o comprueba la rama." : "لا يحتوي المستودع على عمليات التزام بعد. انشر المشروع أولًا أو تحقق من الفرع.";
    }
    if (/does not exist|not found|introuvable/i.test(rawMessage)) {
      return spanish ? "No se encontró el archivo o repositorio. Comprueba la ruta y la URL." : "تعذر العثور على الملف أو المستودع. تحقق من المسار والعنوان.";
    }
    return "Se produjo un error al realizar la operación. Vuelve a intentarlo y comprueba los permisos del proyecto y de GitHub.";
  }

  // Empty remote or repository without a first commit.
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
      ? "L’accès à ce dossier n’est pas autorisé. Rouvre-le avec le sélecteur de dossier de l’application pour accorder l’accès uniquement à ce projet."
      : "Access to this folder is not authorized. Select it again with the app’s folder picker to grant access only to this project.";
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

  // 11. Clone destination already exists
  if (/dossier de destination (?:n’est pas vide|existe déjà)/i.test(rawMessage)) {
    return lang === "fr"
      ? "Le dossier de destination existe déjà. Choisissez un nouveau nom ou un autre dossier parent."
      : "The destination folder already exists. Choose a new name or a different parent folder.";
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

  // 14b. GitHub rejected the authenticated native Git request.
  if (/403|forbidden/i.test(rawMessage)) {
    return lang === "fr"
      ? "Accès refusé par GitHub. Vérifiez vos droits d’écriture sur ce dépôt et les règles de protection de la branche."
      : "GitHub denied access. Check your write permission for this repository and the branch protection rules.";
  }

  // 14c. User canceled / aborted auth flow
  if (
    !/GIT_OPERATION_CANCELLED/i.test(rawMessage) &&
    /usercanceled|the operation was canceled|cancelled|canceled/i.test(rawMessage)
  ) {
    return lang === "fr"
      ? "La connexion GitHub a été annulée ou interrompue. Reprenez l’authentification et confirmez l’ouverture dans votre navigateur."
      : "The GitHub sign-in flow was canceled or interrupted. Retry the authentication and confirm the browser flow before continuing.";
  }

  if (/GIT_OPERATION_CANCELLED/i.test(rawMessage)) {
    return lang === "fr"
      ? "Opération Git annulée. Les fichiers du projet n’ont pas été supprimés."
      : "Git operation canceled. Project files were not deleted.";
  }

  if (/GIT_OPERATION_TIMEOUT/i.test(rawMessage)) {
    return lang === "fr"
      ? "L’opération Git a dépassé le délai maximal de 15 minutes. Vérifiez la connexion et l’état du dépôt, puis réessayez."
      : "The Git operation exceeded the 15-minute limit. Check your connection and repository state, then retry.";
  }

  if (/GIT_OPERATION_BUSY/i.test(rawMessage)) {
    return lang === "fr"
      ? "Une opération Git est déjà en cours. Attendez sa fin avant d’en lancer une autre."
      : "A Git operation is already running. Wait for it to finish before starting another.";
  }

  if (/GIT_TOO_MANY_(?:SENSITIVE|LARGE)_FILES/i.test(rawMessage)) {
    return lang === "fr"
      ? "Trop de fichiers à exclure en une seule opération. Séparez le projet ou ajoutez des exclusions au .gitignore, puis réessayez."
      : "Too many files to exclude in one operation. Split the project or add .gitignore rules, then retry.";
  }

  if (/GIT_PREVIEW_TOO_LARGE/i.test(rawMessage)) {
    return lang === "fr"
      ? "Aperçu indisponible : le fichier dépasse 512 Ko."
      : "Preview unavailable: the file is larger than 512 KB.";
  }

  if (/GIT_PREVIEW_BINARY/i.test(rawMessage)) {
    return lang === "fr"
      ? "Aperçu indisponible : ce fichier semble binaire."
      : "Preview unavailable: this appears to be a binary file.";
  }

  if (/GIT_PREVIEW_INVALID_UTF8/i.test(rawMessage)) {
    return lang === "fr"
      ? "Aperçu indisponible : le fichier n’est pas un texte UTF-8."
      : "Preview unavailable: the file is not UTF-8 text.";
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

  return french
    ? "L’opération n’a pas abouti. Réessayez. Si le problème persiste, vérifiez l’accès au projet et à GitHub."
    : "The operation could not be completed. Retry and check access to the project and GitHub.";
}

const STORAGE_KEY = "github_simplifie_lang";

export function getInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "fr" || saved === "en" || saved === "es") return saved;
    const browserLang = navigator.language?.toLowerCase() ?? "";
    return browserLang.startsWith("en") ? "en" : browserLang.startsWith("es") ? "es" : "fr";
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
