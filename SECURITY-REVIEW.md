# Rapport d’analyse de sécurité

**Projet :** Gsimplifié  
**Date :** 26 octobre 2026  
**Type d’analyse :** revue statique ciblée du dépôt local et des éléments visibles dans la capture GitHub fournie  
**Statut :** les deux constats de sévérité élevée identifiés dans cette revue ont été corrigés dans l’arbre de travail et vérifiés par des tests locaux.

## 1. Synthèse

Gsimplifié est une application desktop Tauri 2 avec une interface React/TypeScript et une couche native Rust. Elle utilise le flux OAuth Device Flow pour connecter GitHub, appelle l’API GitHub et délègue les opérations sur les dépôts locaux au binaire Git lancé par Rust.

La revue a identifié deux risques importants :

1. Un nom de fichier contenant un saut de ligne pouvait être incorporé sans validation à une règle `.gitignore`. Une règle injectée pouvait modifier la portée des exclusions automatiques et compromettre la protection des fichiers sensibles pendant le staging.
2. Le workflow de release utilisait une référence de tag mutable pour l’action tierce `Swatinem/rust-cache`, dans un job disposant de permissions d’écriture sur le contenu du dépôt.

Les deux problèmes ont été corrigés : les fichiers protégés sont maintenant exclus du staging au moyen de pathspecs Git littéraux, les retours à la ligne sont refusés lors de la création de règles d’ignore, et l’action de cache est épinglée sur un commit précis.

Cette revue est statique et ciblée. Elle ne constitue pas une certification de sécurité ni un audit exhaustif de l’application exécutée en production.

## 2. Périmètre et méthode

La revue a porté sur les éléments pertinents du dépôt disponibles localement :

- commandes Git natives, traitement des chemins, exclusions et préparation des commits dans `src-tauri/src/git_native.rs` ;
- workflows GitHub Actions `main.yml` et `release.yml` ;
- tests locaux associés aux protections Git ;
- capture de l’onglet GitHub « Security and quality » fournie par l’utilisateur.

L’analyse a suivi les flux pertinents pour les constats : détection d’un fichier protégé, construction des règles d’ignore, retrait éventuel de l’index et staging avec Git; puis exécution des actions tierces dans le workflow de release.

Les tests effectués sont des tests locaux de régression. Aucun exploit n’a été exécuté contre une cible, aucun compte ou dépôt GitHub réel n’a été utilisé et aucun appel à la configuration privée du dépôt n’a été effectué.

## 3. Architecture et flux de confiance utiles à l’analyse

| Composant | Rôle | Données ou opérations sensibles |
|---|---|---|
| Interface React/TypeScript | Présente les parcours et les résultats à l’utilisateur | État de connexion et paramètres des opérations |
| Services frontend | Appellent les API GitHub et les commandes exposées par Tauri | Jeton d’accès GitHub, URL du dépôt et actions distantes |
| Backend Tauri/Rust | Valide et exécute les opérations locales | Chemins de fichiers, index Git, processus Git |
| GitHub API | Héberge les dépôts et reçoit les pushes | Dépôts, métadonnées, contenu publié |
| GitHub Actions | Construit les applications et publie les artefacts | Code source, dépendances, artefacts et jeton de workflow |

Les principales frontières de confiance sont le WebView vers les commandes Tauri, le processus Rust vers le système de fichiers/Git et les workflows CI vers les actions tierces. Cette revue ciblée ne certifie pas l’ensemble des contrôles sur ces frontières.

## 4. Constats

### SEC-01 — Injection d’une règle `.gitignore` via un nom de fichier

**Sévérité initiale :** HIGH  
**Confiance :** 9/10  
**État :** corrigé dans l’arbre de travail  
**Fichier principal :** `src-tauri/src/git_native.rs`

#### Risque observé

Des règles d’exclusion construites à partir de chemins étaient ajoutées à `.gitignore` sans refuser les caractères de fin de ligne. Un nom de fichier contrôlé par le contenu du projet pouvait donc produire plusieurs lignes de règles plutôt qu’une seule. Comme le flux de publication effectue ensuite un staging Git, une règle malveillante pouvait neutraliser une protection attendue et contribuer à l’ajout de fichiers sensibles.

#### Correction appliquée

- `append_ignore_rules` refuse toute règle contenant `CR` ou `LF`.
- `ignore_rule_for_path` rejette les chemins contenant un saut de ligne et échappe les métacaractères pertinents pour Git ignore.
- Les fichiers protégés détectés lors de la préparation d’un commit ne sont plus convertis en règles `.gitignore` provenant directement des chemins.
- Avant le staging, `git_add_exclusions` vérifie les chemins déjà ignorés et ajoute les autres à `git add` comme pathspecs d’exclusion littéraux. Cela évite d’interpréter le nom de fichier comme un motif Git et évite de passer explicitement une exclusion pour un fichier déjà ignoré.
- Un test de régression vérifie notamment qu’un nom comportant un saut de ligne et une tentative de règle de négation ne permet pas de staged le fichier sensible `.env`; un fichier normal est toujours ajouté.

#### Vérification

- Test `ignore_rules_reject_newlines_and_escape_gitignore_metacharacters` : réussi.
- Test `git_add_excludes_sensitive_paths_literally` : réussi.
- Suite Rust complète : 10 tests réussis.

### SEC-02 — Action tierce de cache référencée par un tag mutable

**Sévérité initiale :** HIGH  
**Confiance :** 8/10  
**État :** corrigé dans l’arbre de travail  
**Fichiers :** `.github/workflows/release.yml`, `.github/workflows/main.yml`

#### Risque observé

Les workflows utilisaient `Swatinem/rust-cache@v2`. Un tag peut être déplacé; la référence ne garantit donc pas à elle seule que les exécutions futures utiliseront le même code. Ce risque est particulièrement important dans le workflow de release, qui dispose de `contents: write` et produit des installateurs.

#### Correction appliquée

Les deux références ont été épinglées sur le commit `d1527c8f67ef9af357290475d4af4b0fab8f12e0`, correspondant à `v2.9.3`. La signature GitHub du tag consultée pendant l’intervention était indiquée comme vérifiée.

#### Recommandation résiduelle

Appliquer une politique cohérente d’épinglage par SHA complet aux autres actions tierces des workflows et mettre ces SHA à jour par revue contrôlée. L’épinglage de `rust-cache` ne prouve pas que toutes les autres actions utilisées dans le dépôt sont immuables.

## 5. Configuration GitHub visible dans la capture

La capture fournie affiche les états suivants. Ils reflètent l’image transmise, pas une vérification en direct des paramètres actuels du dépôt.

| Fonction GitHub | État visible | Analyse et recommandation |
|---|---|---|
| Security policy | Désactivée | Ajouter un `SECURITY.md` si le projet accepte des signalements de vulnérabilités. Préciser un canal privé et les versions prises en charge seulement si le mainteneur peut les définir. |
| Security advisories | Activées | Fonction disponible selon la capture; vérifier périodiquement les avis associés au dépôt. |
| Private vulnerability reporting | Désactivé | L’activer si le dépôt et le compte sont éligibles et si les signalements peuvent être traités. L’éligibilité n’a pas été vérifiée. |
| Dependabot alerts | Désactivées | Les activer pour recevoir les alertes de vulnérabilités de dépendances; examiner les changements avant toute mise à jour. |
| Code scanning alerts | À configurer | Configurer CodeQL ou un outil compatible pour les langages réellement utilisés, puis examiner les alertes. |
| Secret scanning alerts | Activées | Conserver cette protection. Elle ne remplace pas la prévention locale et n’annule pas un secret déjà poussé; tout secret détecté doit être révoqué ou renouvelé. |

Ces réglages sont des contrôles de prévention et de détection du dépôt. Leur état ne constitue pas, à lui seul, une vulnérabilité démontrée dans le code.

## 6. Modèle de menace synthétique

| Menace | Actif et point d’entrée | Impact plausible | Contrôle observé / suite |
|---|---|---|---|
| Manipulation d’un nom de fichier dans un projet préparé à la publication | Entrée : arborescence locale; actif : `.gitignore` et index Git | Contournement d’exclusions et publication accidentelle d’un fichier sensible | Validation des retours à la ligne et exclusions Git littérales ajoutées; tests de régression présents |
| Compromission d’une action tierce dans une release | Entrée : référence d’action dans le workflow; actif : artefacts de release | Altération d’un build ou d’un installateur | `rust-cache` épinglé par SHA; étendre l’épinglage aux autres actions et limiter les permissions |
| Dépendance vulnérable ou compromise | Entrée : npm/Cargo et actions CI; actifs : application et chaîne de build | Exécution de code ou altération des artefacts | Audit complet des avis de dépendances et de provenance non réalisé dans cette intervention |
| Vol ou exposition de jeton GitHub | Entrée : OAuth, stockage local et appels API; actif : compte et dépôts | Accès ou écriture non autorisés selon les permissions du jeton | Pas de test avec compte réel; l’architecture de gestion des jetons mérite une revue dédiée |
| Signalement d’une vulnérabilité sans canal privé disponible | Entrée : dépôt GitHub; actif : détails d’une vulnérabilité non publiée | Divulgation publique prématurée ou absence de signalement | La capture indique que la politique et le signalement privé sont désactivés; configuration à décider par le propriétaire |

## 7. Résultats des vérifications

- `cargo test --manifest-path src-tauri/Cargo.toml` : **10 tests réussis**.
- `git diff --check` : réussi.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` : non exécuté, car le composant `cargo fmt`/`rustfmt` n’est pas installé dans l’environnement.
- Aucun scan d’avis de dépendances n’a été exécuté.
- Aucun test de bout en bout avec GitHub, compte OAuth ou dépôt distant n’a été réalisé.
- Les workflows n’ont pas été exécutés dans GitHub Actions dans le cadre de cette revue.

## 8. Limites et prochaines étapes recommandées

1. Installer `rustfmt` dans l’environnement de développement/CI et faire respecter `cargo fmt --check`.
2. Épingler les autres actions tierces des workflows sur des SHA vérifiés et réexaminer les permissions `GITHUB_TOKEN` de chaque job.
3. Activer les alertes Dependabot et configurer l’analyse de code après vérification de l’éligibilité et des besoins du dépôt.
4. Ajouter un `SECURITY.md` avec des consignes réalistes de signalement privé; activer le signalement privé si la fonctionnalité est disponible et maintenable.
5. Exécuter les tests de publication sur un dépôt temporaire sans données sensibles, en contrôlant l’index Git avant le commit et le contenu distant après le push.
6. Effectuer séparément une revue approfondie de l’authentification OAuth, de la conservation/transmission des jetons et des permissions Tauri.
7. Lancer les audits de dépendances disponibles (`npm audit` et les outils Cargo appropriés) dans un environnement où les sources de vulnérabilités sont à jour, puis examiner les résultats avant toute mise à niveau.

## 9. Conclusion

Les deux constats de sévérité élevée identifiés par cette revue ciblée ont reçu des corrections et des tests de régression. Les résultats réduisent les risques observés, mais ne démontrent pas l’absence de vulnérabilités dans le reste du projet. Les paramètres GitHub de la capture, l’authentification réelle, les dépendances et les workflows exécutés nécessitent des vérifications complémentaires.

## 10. Mise à jour de la revue et durcissement — 26 octobre 2026

Cette section complète les résultats précédents et décrit les changements réalisés après une nouvelle vérification du dépôt et de son arbre de travail. Les constats historiques ci-dessus restent datés de leur première analyse.

### SEC-01 — staging et fichiers déjà suivis

Le code Rust a été réexaminé et renforcé :

- Les règles et chemins utilisés pour générer une règle `.gitignore` refusent CR/LF; les métacaractères sont échappés et testés avec Git réel.
- Les chemins contenant un octet non UTF-8 sont refusés avant le staging afin d’éviter qu’une conversion avec perte fasse correspondre une exclusion au mauvais nom de fichier. Sur Unix, les antislashs littéraux des noms sont préservés et testés.
- Les fichiers protégés non ignorés sont exclus avec des pathspecs `:(exclude,literal)`, après vérification NUL-délimitée des règles d’ignore présentes.
- Si des fichiers sensibles, des fichiers dépassant 100 Mio ou des dossiers générés sont déjà suivis, le commit s’arrête et signale les chemins. Il ne les retire plus silencieusement de l’index et ne modifie pas `.gitignore` avant ce refus. L’utilisateur doit décider explicitement comment les désuivre.
- Les tests vérifient le staging d’un fichier ordinaire, l’exclusion de fichiers sensibles et de noms comportant des caractères spéciaux, le respect des règles utilisateur, ainsi que l’absence de changement d’index et d’arbre de travail lors du refus d’un fichier sensible déjà suivi.

Résultat local : **13 tests Rust réussis**, dont ces tests de staging dans des dépôts temporaires isolés. Aucun test distant ni push n’a été effectué.

### SEC-02 — références d’actions et permissions des workflows

Les références suivantes ont été épinglées sur des commits complets récupérés depuis les dépôts officiels GitHub et associés aux versions indiquées :

| Action | SHA épinglé | Vérification de référence |
|---|---|---|
| `actions/checkout` | `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09` | Référence officielle `v5` (branche de version), commit signé |
| `actions/setup-node` | `a0853c24544627f65ddf259abe73b1d18a591444` | Référence officielle `v5`, commit signé |
| `dtolnay/rust-toolchain` | `b725eda525362e7cf34af9a7243cac1e3f01a7ec` | Référence `stable` consultée le 16 octobre 2026, commit signé |
| `Swatinem/rust-cache` | `d1527c8f67ef9af357290475d4af4b0fab8f12e0` | Tag officiel `v2` vers `v2.9.3`, tag signé |
| `tauri-apps/tauri-action` | `84b9d35b5fc46c1e45415bdb6144030364f7ebc5` | Tag officiel `v0`; objet de tag non signé, commit cible signé |
| `actions/upload-artifact` | `330a01c490aca151604b8cf639adc76d48f6c5d4` | Référence officielle `v5`, commit signé |
| `github/codeql-action` | `4bfa242aa49c5f7c6770b98670d354a7dfac05f8` | Tag `v3.39.1` vers ce commit; tag non signé, commit signé |

La référence `tauri-apps/tauri-action` est immuable et sa cible est signée, mais le tag officiel `v0` lui-même est signalé comme non signé par GitHub. Son SHA reste épinglé; maintenir une veille de cette action reste recommandé.

Le workflow `main.yml` est maintenant une CI sans secrets avec `contents: read`; il exécute l’audit npm, les tests frontend, le build frontend, le formatage Rust et les tests Rust. Le workflow `release.yml` est l’unique workflow de release sur tag; ses permissions globales sont en lecture seule et `contents: write` est limité à son job de release, nécessaire à `tauri-action`. Le build macOS de la release a été conservé.

Les fichiers YAML des workflows et de Dependabot ont été analysés localement par PyYAML. `actionlint` n’est pas installé; GitHub Actions n’a pas exécuté ces workflows dans le cadre de cette intervention.

### Dépendances

`npm audit` avait détecté trois avis dans `postcss-selector-parser`, `source-map-js` et Vite. `npm audit fix` a mis à jour uniquement le fichier verrouillé dans les plages déjà autorisées par `package.json` :

- `postcss-selector-parser` : 6.1.4 → 6.1.5 ;
- `source-map-js` : 1.2.1 → 1.2.2 ;
- Vite : 6.4.3 → 6.4.5.

Après mise à jour, `npm audit --audit-level=low` ne signale **aucune vulnérabilité**. Le build frontend et les tests diagnostics passent.

Une configuration Dependabot hebdomadaire a été ajoutée pour npm, Cargo et GitHub Actions. Elle ne remplace pas l’activation des alertes Dependabot dans les paramètres distants du dépôt.

L’audit Rust `cargo-audit` a chargé 1 378 avis RustSec et analysé 557 dépendances du lockfile. Il a initialement détecté neuf advisories corrigibles dans `quinn-proto`, `rustls`, `rustls-webpki` et `webpki-roots`; ceux-ci ont été mis à jour dans les versions correctives compatibles. Le scan a aussi signalé Tokio 1.53.1 comme unsound et `chacha20` 0.10.1 comme yanked; ces versions ont également été mises à jour vers Tokio 1.53.3 et `chacha20` 0.10.2.

| Dépendance | Avant | Après | Motif |
|---|---:|---:|---|
| `quinn-proto` | 0.11.17 | 0.11.18 | Trois advisories HIGH |
| `rustls` | 0.23.43 | 0.23.46 | Advisories TLS; minimum correctif confirmé |
| `rustls-webpki` | 0.103.15 | 0.103.16 | Advisory de validation de certificat |
| `webpki-roots` | 1.0.9 | 1.0.10 | Advisory concernant les certificats racines |
| `tokio` | 1.53.1 | 1.53.3 | Correctif de l’avis I/O safety RUSTSEC-2026-0386 |
| `chacha20` | 0.10.1 | 0.10.2 | Remplacement de la version yanked par le patch courant |

Après ces mises à jour, `cargo audit --file src-tauri/Cargo.lock` ne trouve **aucune vulnérabilité**. Le JSON de l’audit contient encore dix avertissements, et non des CVE confirmées : neuf crates déclarées non maintenues (`proc-macro-error`, les cinq crates `unic-*` citées par RustSec et trois crates `zbus_names`/`zvariant*`), ainsi qu’un avis d’unsoundness sur `glib` 0.18.5. `glib` est tiré par le stack GTK/WebKit/Tauri et l’avis n’indique pas de version corrigée; une remédiation demanderait une mise à niveau coordonnée du stack natif. Ces avertissements restent ouverts et doivent être suivis, sans prétendre qu’ils sont corrigés.

### Code scanning et politique de signalement

- `.github/workflows/codeql.yml` ajoute l’analyse CodeQL TypeScript sur les pull requests, les pushes sur `main` et un calendrier hebdomadaire. Le job ne reçoit que `contents: read` et `security-events: write`; il ne reçoit aucun secret applicatif.
- `SECURITY.md` décrit un canal privé GitHub et demande de ne pas publier les détails d’une vulnérabilité dans une issue publique.
- Une consultation des métadonnées publiques confirme que le dépôt est public, mais l’état actuel de **Private vulnerability reporting**, de Dependabot Alerts, de Secret Scanning et de Code Scanning n’a pas été lu dans les paramètres privés. La capture antérieure montrait le signalement privé désactivé et le Code Scanning non configuré. Le propriétaire doit activer le signalement privé et vérifier les alertes dans GitHub; la création du workflow n’équivaut pas à son activation distante.
- Le workflow CodeQL n’a pas encore été exécuté sur GitHub. Il cible le frontend TypeScript; aucune analyse CodeQL Rust n’est revendiquée.

### Tauri et OAuth — limites de revue

La vérification locale confirme que le jeton OAuth est enregistré via le trousseau système, mais qu’il est également renvoyé au frontend et conservé dans l’état React pendant la session. Les opérations API et Git actuelles en ont besoin; cette intervention ne migre pas l’ensemble de ces flux vers une architecture native. Cette exposition en mémoire reste un risque à traiter dans une refonte dédiée, notamment face à une compromission du WebView.

Les permissions Tauri et la CSP locales ont été inspectées sans constat exploitable identifié dans ce périmètre. Cette lecture statique ne remplace pas un audit de chaque commande et de chaque plateforme, ni un test réel des trousseaux Windows, macOS et Linux.

### Commandes et état actuel des validations

- `npm audit --audit-level=low` : réussi, zéro vulnérabilité signalée.
- `npm run test:diagnostics && npm run build` : réussi, 4 tests frontend et build TypeScript/Vite.
- `cargo test --locked --manifest-path src-tauri/Cargo.toml` : réussi, 13 tests Rust.
- `cargo audit --file src-tauri/Cargo.lock` : réussi après mises à jour; 0 vulnérabilité dans 557 dépendances, 10 avertissements de maintenance/unsoundness restant.
- `git diff --check` : réussi avant les derniers ajouts au rapport.
- Validation YAML PyYAML : réussie pour les trois workflows et `dependabot.yml`.
- `actionlint` : indisponible dans l’environnement; les expressions GitHub n’ont donc pas été contrôlées par cet outil.
- `cargo fmt`/`rustfmt` : indisponible localement. La CI ajoutée installe le composant Rust `rustfmt` et exécutera `cargo fmt --check` à son exécution.
- Aucun scan GitHub distant ni test de publication réel n’a été exécuté.

### Statut synthétique

| Élément | Statut |
|---|---|
| SEC-01 — chemins et staging | **CORRIGÉ ET TESTÉ** localement; pas de test push distant |
| SEC-02 — actions tierces | **CORRIGÉ, VALIDATION INCOMPLÈTE**; commits épinglés vérifiés, workflows pas encore exécutés dans GitHub |
| Dépendances frontend | **CORRIGÉ ET TESTÉ**; npm audit propre |
| Dépendances Rust | **CORRIGÉ ET TESTÉ** pour les vulnérabilités signalées; 10 avertissements résiduels à suivre |
| Least privilege des workflows | **CORRIGÉ, VALIDATION INCOMPLÈTE**; YAML parsé, pas de run GitHub |
| Dependabot config | **CORRIGÉ, ACTION MANUELLE REQUISE** pour activer les alertes dans les paramètres GitHub |
| CodeQL | **CONFIGURATION AJOUTÉE, VALIDATION INCOMPLÈTE**; lancement et éligibilité à confirmer dans GitHub |
| `SECURITY.md` | **AJOUTÉ, ACTION MANUELLE REQUISE** pour activer et tester le signalement privé |
| OAuth/Tauri runtime | **NON CORRIGÉ** dans cette intervention; jeton toujours accessible au frontend pendant la session |

## 11. Fiabilité de l’initialisation et du clonage Git multiplateformes

La revue du parcours Git a identifié deux sources plausibles des erreurs rapportées (« not in a git directory » et chemin de destination Windows `\\?\...`). Le diagnostic Windows ne pouvait pas être reproduit dans l’environnement Linux; le préfixe de chemin signalait une cause possible, pas une preuve suffisante à lui seul.

Corrections apportées :

- `git init` est maintenant idempotent : l’état du dépôt est demandé à Git, un dépôt valide préexistant conserve son historique et sa configuration, et des métadonnées `.git` invalides sont signalées sans être écrasées.
- La détection de dépôt repose sur le résultat de `git rev-parse` plutôt que sur la seule présence de `.git`. La détection des échecs `rev-parse` repose sur le code de sortie Git, pas sur le texte localisé du message d’erreur.
- Le parcours de publication demande toujours au backend d’initialiser ou de réutiliser le dépôt; la décision ne dépend donc pas d’un état frontend potentiellement périmé.
- Le clonage passe à Git un nom de destination relatif au dossier parent, crée et vérifie la cible avant de déclarer le succès et ne nettoie, après échec, que le dossier créé pour cette opération.
- À la frontière des processus Git sous Windows, les chemins étendus courts sont normalisés et les chemins longs gardent leur préfixe étendu.
- Les erreurs natives Git incluent la commande logique, le système d’exploitation et le dossier de travail pour faciliter le diagnostic; aucune URL distante ou valeur de jeton n’est ajoutée par ces champs.
- La CI ajoute des tests Rust ciblés sur Ubuntu, Windows et macOS. L’exécution Windows/macOS reste à confirmer dans GitHub Actions.

Tests de régression ajoutés pour l’initialisation répétée, la préservation d’un historique et d’une identité locale, les métadonnées invalides, les destinations de clonage préexistantes, le nettoyage après échec et les chemins contenant espaces/Unicode. Les tests Windows du préfixe étendu ne s’exécutent que sur Windows; le test local Linux ne valide donc pas le comportement de Git for Windows.

Validation de cette mise à jour : `cargo test --locked --manifest-path src-tauri/Cargo.toml` passe avec **17 tests Rust**; `npm run test:diagnostics` passe avec **5 tests**; `npm run build` et `git diff --check` passent. Le formatage n’a pas pu être contrôlé localement (`cargo fmt`/`rustfmt` absent). La matrice Windows/macOS/Linux est configurée, mais ses résultats ne seront connus qu’après son exécution dans GitHub Actions.
