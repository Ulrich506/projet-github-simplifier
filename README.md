# Gsimplifié

Application desktop (Tauri + React + TypeScript) pour publier, synchroniser et
cloner des projets GitHub sans connaître Git. Les opérations Git sont exécutées
par le Git natif via Rust/Tauri; le frontend ne charge pas l’arborescence
complète ni les contenus de fichiers pour préparer les commits.

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
  App.tsx                     # orchestration des assistants guidés et du projet actif
  types.ts                    # types partagés
  hooks/
    useGitHubAuth.ts          # état + logique de connexion Device Flow (+ récupère le login)
  components/
    EcranConnexionGitHub.tsx  # écran 1 : code de connexion GitHub
    ZoneDepot.tsx              # écran 2 : glisser-déposer natif (event Tauri onDragDropEvent)
    PublicationWizard.tsx     # assistant commit / publication / mise à jour
    CloneWizard.tsx           # assistant de clonage
    ExplorateurFichiers.tsx   # liste virtualisée et aperçu texte borné
    ProgressOverlay.tsx       # progression et annulation des processus Git
  services/
    projectAnalyzer.ts        # scan natif paginé des chemins et métadonnées
    gitService.ts             # appels aux commandes Rust/Tauri et suivi de progression
    githubAuth.ts             # OAuth Device Flow
    githubService.ts          # création/listing de dépôts + login utilisateur via Octokit
src-tauri/src/git_native.rs   # scan borné, statut Git, commit/push/pull/clone et annulation
tailwind.config.js
postcss.config.js
tsconfig.json
vite.config.ts
src-tauri/
  Cargo.toml                  # Tauri, HTTP, dialogue et trousseau système
  build.rs
  tauri.conf.json
  src/main.rs
  src/lib.rs                  # plugins et comptes sécurisés
  capabilities/default.json   # permissions HTTP GitHub, dialog et ouverture de liens
  icons/                      # icônes générées pour le logiciel
```

## Flow complet

1. **Connexion** — Device Flow avec un code temporaire. Les comptes sont conservés dans le trousseau sécurisé du système (Keychain, Windows Credential Manager ou Secret Service sous Linux); la déconnexion ferme la session active sans supprimer les comptes mémorisés.
2. **Dépôt** — `ZoneDepot` : glisser-déposer natif Tauri, donne un vrai chemin disque (pas un objet `File` du navigateur)
3. **Analyse** — une détection Rust rapide identifie d’abord le type et la racine Git sans parcourir l’arborescence. Le projet s’affiche ensuite pendant que le scan structurel annulable s’exécute hors du thread UI; sa progression indique le nombre réel de fichiers examinés, sans total estimé. Le parcours Rust n’accumule jamais l’arborescence complète : un cache temporaire de 30 secondes retient au plus 2 000 chemins (500 par page), et le frontend conserve la même limite.
4. **Aperçu** — une commande Rust autorise au plus 512 Kio de texte UTF-8 et refuse les binaires et les chemins qui sortent du projet.
5. **Publication / mise à jour** — les commandes système Git gèrent statut, staging, commit et synchronisation; une seule opération Git longue tourne à la fois, avec délai maximal et annulation. L’indicateur de progression reste non bloquant et n’affiche pas de pourcentage estimé comme s’il était réel.
6. **Clonage** — le clone est réalisé dans un dossier temporaire puis renommé vers la destination uniquement après succès.

Les erreurs de publication, synchronisation et clonage affichent un diagnostic local avec identifiant, étape, catégorie, durée et détail technique assaini. Les opérations REST GitHub ont un délai maximal par requête; seuls les GET/HEAD transitoirement échoués sont retentés au plus deux fois. Les créations de dépôts (POST) ne sont jamais retentées automatiquement. Une répétition manuelle n’est proposée que pour des étapes idempotentes ou nettoyées après échec.

Les parcours principaux sont câblés :
- **Créer & publier** : initialise Git si nécessaire, crée le dépôt distant, commit et push.
- **Mettre à jour** : commit et synchronisation non forcée du projet déjà associé.
- **Cloner** : clone d’abord dans un dossier temporaire, puis le déplace à destination une fois terminé.

## Prochaines étapes concrètes

1. Créer une OAuth App sur github.com/settings/developers avec le **Device Flow activé** (case à cocher + "Update application"), puis configurer le `client_id` dans `githubAuth.ts`.
2. Tester les opérations sur des dépôts réels volumineux, des dépôts privés, des annulations et des échecs réseau sur Windows, macOS et Linux.
3. Pour les fichiers déjà présents dans des commits antérieurs, une exclusion du nouveau commit ne réécrit pas l’historique Git; leur retrait historique nécessite une opération distincte (par exemple Git LFS ou une réécriture explicitement confirmée).

## Points de vigilance

- Les fichiers sensibles détectés sont automatiquement exclus du commit et ajoutés au `.gitignore`; cette détection par chemins n’est pas une garantie de détection exhaustive des secrets.
- L’API GitHub passe par le plugin HTTP Tauri; les opérations Git utilisent le binaire Git installé sur le système et injectent le token sans l’ajouter à l’URL du remote.
- Pas de backend distant nécessaire : le Device Flow ne demande pas de `client_secret`.
- Le code de vérification expire rapidement; le jeton OAuth autorisé est conservé séparément dans le trousseau système jusqu’à révocation ou déconnexion.
- Les commits ignorent les répertoires générés connus, ne suivent pas les liens symboliques, avertissent au-delà de 50 Mio et excluent automatiquement les fichiers d’au moins 100 Mio de l’index courant.
- L’utilisation du Git natif nécessite que Git soit installé et disponible dans le `PATH`.
- Les opérations REST GitHub vérifient les statuts HTTP; les erreurs 401/403/404/422 et les limites de débit sont classées à partir des réponses reçues. Les détails de diagnostic masquent les jetons usuels et les chemins personnels courants.
- `strict: true` est activé dans `tsconfig.json` — garde-le
# projet-github-simplifier
