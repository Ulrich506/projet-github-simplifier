# Gsimplifié

Application desktop (Tauri + React + TypeScript) pour publier/gérer des
projets GitHub sans connaître Git : connexion → glisser-déposer → choisir
l'action → confirmer.

## Installation

Télécharge l’installeur correspondant à ton système depuis la page
[Releases](https://github.com/Ulrich506/projet-github-simplifier/releases) :

- **Linux** : paquets `.deb`, `.rpm` ou image `.AppImage`.
- **Windows** : installeur `.exe` (NSIS) ou `.msi`.

Les versions ne sont pas signées pour le moment. Windows SmartScreen peut
afficher un avertissement. N’installe que les fichiers provenant des Releases
officielles de ce dépôt.

Sur Ubuntu/Debian, installe un paquet téléchargé avec :

```bash
sudo apt install ./Gsimplifie_0.1.0_amd64.deb
```

Sur Fedora ou une distribution compatible RPM :

```bash
sudo dnf install ./Gsimplifie-0.1.0-1.x86_64.rpm
```

Pour une AppImage, rends le fichier exécutable puis lance-le :

```bash
chmod +x Gsimplifie_0.1.0_amd64.AppImage
./Gsimplifie_0.1.0_amd64.AppImage
```

## Développement

```bash
npm install
npm run tauri dev
```

`npm run tauri dev` démarre déjà Vite sur le port 1420. Ne lance pas
`npm run dev` en parallèle : cela démarre un deuxième serveur et provoque
« Port 1420 is already in use ». Pour l’interface seule dans le navigateur,
utilise `npm run dev` à la place, pas en plus de Tauri.

Le build local de production s’effectue avec :

```bash
npm run tauri build
```

Les préférences (français, anglais, espagnol ou arabe, thème clair/sombre et
palette) se trouvent dans le bouton **Paramètres**. Les thèmes peuvent être
exportés ou importés sous forme de fichiers JSON locaux; aucun catalogue distant
ni contenu de thème exécuté n’est utilisé.

## Publier une version

Vérifie que la version dans `src-tauri/tauri.conf.json` est celle souhaitée,
puis crée et pousse un tag. Le workflow GitHub Actions compile les installeurs
Linux et Windows et les ajoute à une Release en brouillon :

```bash
git tag v0.1.0
git push --tags
```

Les fichiers sont téléchargeables depuis deux endroits :

- Dans **Actions → exécution du workflow → Artifacts**, sous la forme d’un
  artefact téléchargeable distinct par format d’installation (`.deb`,
  `.AppImage`, `.rpm`, `.exe` et `.msi`). Ces téléchargements temporaires sont
  conservés 14 jours.
- Dans **Releases**, les installeurs sont joints à la Release brouillon pour
  distribution durable. Après vérification des fichiers, publie cette Release.

## Structure

```
index.html                    # point d'entrée Vite
src/
  main.tsx                    # montage React
  index.css                   # directives Tailwind
  App.tsx                     # orchestration du flow (connexion → dépôt → action → confirmation → résultat)
  types.ts                    # types partagés
  hooks/
    useGitHubAuth.ts          # état + logique de connexion Device Flow (+ récupère le login)
  components/
    EcranConnexionGitHub.tsx  # écran 1 : code de connexion GitHub
    ZoneDepot.tsx              # écran 2 : glisser-déposer natif (event Tauri onDragDropEvent)
    MenuActions.tsx            # écran 3 : choix de l'action
    EcranConfirmation.tsx      # écran 4 : confirmation + nom du dépôt
    EcranProgression.tsx       # écran 5 : progression Git/GitHub
    EcranResultat.tsx          # écran 6 : résultat final
  services/
    fileSystemUtils.ts        # parcours récursif du VRAI dossier disque (@tauri-apps/plugin-fs)
    tauriFsBridge.ts           # adapte @tauri-apps/plugin-fs au format attendu par isomorphic-git
    projectAnalyzer.ts        # détecte le type de projet + fichiers sensibles (à partir des chemins)
    gitService.ts             # init/commit/push/pull via isomorphic-git, opère directement sur le vrai dossier
    tauriGitHttp.ts           # client HTTP isomorphic-git basé sur le plugin natif Tauri (évite le CORS de github.com)
    githubAuth.ts             # OAuth Device Flow
    githubService.ts          # création/listing de dépôts + login utilisateur via Octokit
tailwind.config.js
postcss.config.js
tsconfig.json
vite.config.ts
src-tauri/
  Cargo.toml                  # tauri-plugin-http, tauri-plugin-fs, tauri-plugin-dialog
  build.rs
  tauri.conf.json
  src/main.rs
  src/lib.rs                  # plugins, comptes sécurisés et autorisations du dossier choisi
  capabilities/default.json   # permissions http (github.com/api.github.com), fs, dialog
  icons/                      # icônes générées pour le logiciel
```

## Flow complet

1. **Connexion** — Device Flow avec un code temporaire. Les comptes sont conservés dans le trousseau sécurisé du système (Keychain, Windows Credential Manager ou Secret Service sous Linux); la déconnexion ferme la session active sans supprimer les comptes mémorisés.
2. **Dépôt** — `ZoneDepot` : glisser-déposer natif Tauri, donne un vrai chemin disque (pas un objet `File` du navigateur)
3. **Analyse** — `projectAnalyzer` détecte le type de projet et les fichiers sensibles à partir des chemins.
4. **Aperçu** — liste des fichiers et lecture seule des fichiers texte du projet sélectionné.
5. **Publication / mise à jour** — création initiale du dépôt ou commit et synchronisation sans écrasement forcé.
6. **Clonage** — dépôt GitHub public sans connexion ou dépôt privé avec un compte autorisé.

Toutes les actions sont câblées et fonctionnelles :
- **Créer & publier** : initialise Git si nécessaire, crée le dépôt distant, commit et push.
- **Mettre à jour** : commit et synchronisation non forcée du projet déjà associé.
- **Cloner** : clone d’abord dans un dossier temporaire, puis le déplace à destination une fois terminé.

## Prochaines étapes concrètes

1. Régénérer `src-tauri/` avec `npm create tauri-app@latest -- --template react-ts` pour une base à jour si besoin — ce scaffold est minimal
2. Créer une OAuth App sur github.com/settings/developers avec le **Device Flow activé** (case à cocher + "Update application"), coller le `client_id` dans `githubAuth.ts`
3. Gérer les conflits de "mise à jour" sans jargon : proposer "garder ma version" / "garder celle en ligne" plutôt que merge/rebase
4. La portée filesystem est accordée dynamiquement au dossier sélectionné par l’utilisateur et à ses descendants; aucun accès global au disque n’est demandé.

## Points de vigilance

- Ne jamais publier automatiquement les fichiers listés dans `sensitiveFiles` sans confirmation explicite
- Toutes les requêtes réseau (auth ET opérations Git) passent par `@tauri-apps/plugin-http`, jamais par le `fetch` du navigateur — GitHub ne renvoie pas d'en-têtes CORS
- Pas de backend distant nécessaire : le Device Flow ne demande pas de `client_secret`, et la couche native Tauri (http + fs + dialog) remplace le rôle qu'un serveur aurait eu
- Le code de vérification expire rapidement; le jeton OAuth autorisé est conservé séparément dans le trousseau système jusqu’à révocation ou déconnexion.
- Les commits locaux ignorent les dossiers de dépendances/compilation (`node_modules`, `target`, `dist`, etc.) et ne suivent pas les liens symboliques.
- `tauriFsBridge.ts` reconstruit les codes d'erreur type `ENOENT` à partir des messages texte de `@tauri-apps/plugin-fs` (qui n'a pas d'objets d'erreur avec `.code` comme Node.js) — isomorphic-git en dépend pour son fonctionnement interne ; c'est un pont pragmatique, pas exhaustif (les liens symboliques par exemple ne sont pas finement gérés)
- `strict: true` est activé dans `tsconfig.json` — garde-le
# projet-github-simplifier
