# GitHub Simplifié

Application desktop (Tauri + React + TypeScript) pour publier/gérer des
projets GitHub sans connaître Git : connexion → glisser-déposer → choisir
l'action → confirmer.

## Lancer l’application

```bash
npm install
npm run tauri dev
```

`npm run tauri dev` démarre déjà Vite sur le port 1420. Ne lance pas
`npm run dev` en parallèle : cela démarre un deuxième serveur et provoque
« Port 1420 is already in use ». Pour l’interface seule dans le navigateur,
utilise `npm run dev` à la place, pas en plus de Tauri.

Si un ancien serveur bloque le port, arrête son terminal avec `Ctrl+C`, puis
relance une seule fois `npm run tauri dev`.

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
  src/lib.rs                  # enregistrement des 3 plugins
  capabilities/default.json   # permissions http (github.com/api.github.com), fs ($HOME/**), dialog
  icons/                      # icônes générées (32x32, 128x128, 128x128@2x, icon.ico, icon.icns)
```

## Flow complet

1. **Connexion** — Device Flow avec un code temporaire. Après validation, la session est conservée dans le trousseau sécurisé du système (Keychain, Windows Credential Manager ou Secret Service sous Linux) et revalidée au prochain lancement.
2. **Dépôt** — `ZoneDepot` : glisser-déposer natif Tauri, donne un vrai chemin disque (pas un objet `File` du navigateur)
3. **Analyse** — `projectAnalyzer` détecte le type de projet et les fichiers sensibles à partir des chemins
4. **Action** — `MenuActions` : créer / publier / mettre à jour / récupérer
5. **Confirmation** — `EcranConfirmation`, avec le nom du dépôt (pré-rempli avec le nom du dossier)
6. **Exécution** — `EcranProgression`, branché sur `gitService` + `githubService`, git opère directement sur le vrai dossier via `tauriFsBridge`
7. **Résultat** — `EcranResultat`, lien vers le dépôt

Toutes les actions sont câblées et fonctionnelles :
- **creer / publier** : crée le dépôt sur GitHub (ou le récupère s'il existe déjà), initialise Git si besoin, commit et push — directement dans le dossier déposé
- **maj** : pull + commit + push sur le dépôt déjà connu de la session
- **recuperer** : ouvre un sélecteur de dossier de destination puis clone le dépôt choisi

## Prochaines étapes concrètes

1. Régénérer `src-tauri/` avec `npm create tauri-app@latest -- --template react-ts` pour une base à jour si besoin — ce scaffold est minimal
2. Créer une OAuth App sur github.com/settings/developers avec le **Device Flow activé** (case à cocher + "Update application"), coller le `client_id` dans `githubAuth.ts`
3. Gérer les conflits de "mise à jour" sans jargon : proposer "garder ma version" / "garder celle en ligne" plutôt que merge/rebase
4. La portée `fs:default` dans `capabilities/default.json` est limitée à `$HOME/**` — un dossier déposé depuis un disque externe ou un point de montage hors du home échouera. Élargir la portée (ou utiliser `scope` dynamique via le plugin dialog) si besoin

## Points de vigilance

- Ne jamais publier automatiquement les fichiers listés dans `sensitiveFiles` sans confirmation explicite
- Toutes les requêtes réseau (auth ET opérations Git) passent par `@tauri-apps/plugin-http`, jamais par le `fetch` du navigateur — GitHub ne renvoie pas d'en-têtes CORS
- Pas de backend distant nécessaire : le Device Flow ne demande pas de `client_secret`, et la couche native Tauri (http + fs + dialog) remplace le rôle qu'un serveur aurait eu
- Le code de vérification expire rapidement; le jeton OAuth autorisé est conservé séparément dans le trousseau système jusqu’à révocation ou déconnexion.
- Les commits locaux ignorent les dossiers de dépendances/compilation (`node_modules`, `target`, `dist`, etc.) et ne suivent pas les liens symboliques.
- `tauriFsBridge.ts` reconstruit les codes d'erreur type `ENOENT` à partir des messages texte de `@tauri-apps/plugin-fs` (qui n'a pas d'objets d'erreur avec `.code` comme Node.js) — isomorphic-git en dépend pour son fonctionnement interne ; c'est un pont pragmatique, pas exhaustif (les liens symboliques par exemple ne sont pas finement gérés)
- `strict: true` est activé dans `tsconfig.json` — garde-le
