# Rapport d’analyse — GitHub Simplifié

**Date de l’analyse :** 23 octobre 2026  
**Périmètre :** sources React/TypeScript, services Git/GitHub, configuration Tauri et documentation présentes à la racine du projet.

> **Mise à jour technique :** les sections d’analyse initiale ci-dessous décrivent l’architecture avant la migration vers Git natif. Le backend a depuis été déplacé vers Rust/Tauri pour éviter les lectures complètes en mémoire; les recommandations historiques sont à relire avec la section « État après migration native » en fin de document.

## 1. Synthèse

GitHub Simplifié est une application desktop construite avec Tauri 2, React et TypeScript. Elle vise à publier, mettre à jour et récupérer des dépôts GitHub sans exposer la ligne de commande à l’utilisateur. La séparation entre interface, services Git/GitHub et ponts natifs de fichiers/réseau est déjà bien amorcée.

**État après migration :** le frontend TypeScript et le backend Rust compilent; six tests unitaires Rust couvrent l’encodage d’authentification, le parsing de chemins Git, les exclusions générées, la détection de noms sensibles, le rejet des identifiants dans l’URL du remote et le découpage des pages d’analyse. Ces vérifications ne remplacent pas un essai Tauri réel avec un dépôt GitHub volumineux.

**Conclusion :** les opérations Git passent maintenant par le binaire Git natif lancé depuis Rust. Les parcours réels avec un compte GitHub, les limites de taille, l’annulation, et les systèmes Windows/macOS/Linux restent à éprouver en exécution.

## 2. Architecture et fonctions présentes

- **Interface et parcours :** connexion, choix d’un dossier, analyse, sélection d’action, confirmation, progression et résultat sont répartis entre `src/App.tsx` et `src/components/`.
- **Connexion GitHub :** le Device Flow est implémenté dans `src/services/githubAuth.ts`; l’état de connexion est géré par `src/hooks/useGitHubAuth.ts`.
- **Appels à l’API GitHub :** création, recherche d’un dépôt existant et récupération des dépôts sont dans `src/services/githubService.ts`.
- **Opérations Git :** `src/services/gitService.ts` appelle les commandes natives de `src-tauri/src/git_native.rs`; aucun moteur Git JavaScript ne charge l’arborescence ou les contenus pour préparer un commit.
- **Analyse et aperçu :** l’analyse parcourt les répertoires de façon incrémentale et pagine les chemins; l’aperçu natif est limité à 512 Kio et vérifie que le chemin canonique reste dans le dossier du projet.
- **Protection contre les gros dépôts :** les listes de chemins sont bornées, les dossiers générés sont exclus, les fichiers d’au moins 100 Mio sont exclus du nouvel index et ceux de 50 Mio ou plus sont signalés.
- **Permissions :** les capacités Tauri ne déclarent plus d’accès général au système de fichiers; les opérations locales sont exécutées par les commandes natives validant le dossier fourni.

## 3. Ce qui fonctionne ou est correctement établi

1. **Build frontend réussi.** `npm run build` exécute `tsc` puis Vite et termine avec succès. Le mode TypeScript strict est activé.
2. **Vérification Rust réussie.** `cargo check --manifest-path src-tauri/Cargo.toml` termine avec succès.
3. **Tests Rust réussis.** `cargo test --manifest-path src-tauri/Cargo.toml` exécute quatre tests unitaires.
4. **Parcours nominal de publication présent dans le code.** L’application sait demander un dépôt GitHub, initialiser Git si nécessaire, préparer un `.gitignore`, committer, pousser puis vérifier la branche distante.
5. **Contrôle de cohérence après publication.** Le code vérifie que la branche distante contient bien un commit avant d’afficher le résultat.
6. **Git natif délégué à Rust.** Le statut est lu en flux et les résultats sont limités à 500 entrées par appel; les listes de fichiers conservées dans le frontend sont plafonnées.
7. **Signaux utiles à l’utilisateur.** L’interface prévoit des écrans d’erreur, des messages de progression, un avertissement sur certains noms de fichiers sensibles et une confirmation du dépôt privé.
8. **Configuration TypeScript stricte.** `strict`, `noUnusedLocals` et `noUnusedParameters` réduisent le risque d’erreurs statiques.

## 4. Problèmes et corrections recommandées

### Priorité haute — à corriger avant de considérer les actions comme fiables

#### 4.1. L’action « Mettre à jour » n’identifie pas correctement le dépôt distant

La mise à jour dépend exclusivement de l’état React `urlDepot`. Cet état n’est pas récupéré depuis le dépôt Git local, depuis GitHub, ni depuis un stockage persistant. Après redémarrage ou réinitialisation, l’application ne connaît donc plus l’URL distante et affiche une erreur. En outre, les actions latérales peuvent conserver l’URL d’une opération précédente alors que le dossier sélectionné a changé : la mise à jour risque alors de viser le dépôt d’un autre projet.

**Correction :** associer le dépôt distant au chemin du projet, le lire depuis `git remote` lorsque le dossier possède déjà un dépôt Git et vérifier l’identité du dépôt avant tout push. Ne jamais réutiliser une URL en mémoire sans confirmation qu’elle correspond au dossier courant.

#### 4.2. La promesse « les fichiers sensibles ne seront pas publiés » n’est pas garantie

L’analyse repose sur une petite liste de noms et expressions régulières. Des secrets portant d’autres noms ou contenus dans des fichiers ordinaires ne seront pas détectés. De plus, ajouter un fichier déjà suivi par Git au `.gitignore` ne le retire pas de l’index : il peut donc rester inclus dans le commit et le push. Le message affiché est plus catégorique que la protection réellement fournie.

**Correction :** ne pas présenter cette détection comme une garantie. Pour les fichiers détectés, vérifier s’ils sont déjà suivis et bloquer la publication ou demander une confirmation explicite avant de continuer. Ajouter des règles d’exclusion configurables et des tests couvrant les fichiers suivis, non suivis et les motifs de secrets. Ne jamais prétendre détecter tous les secrets par le seul nom de fichier.

#### 4.3. Échec de configuration du remote masqué

`publier` ignore toute erreur provenant de `git.addRemote`. Le push peut ensuite continuer avec un remote absent ou incorrect, et l’erreur initiale est perdue.

**Correction :** conserver le remote existant lorsqu’il correspond à la destination, le mettre à jour explicitement lorsque c’est voulu, et laisser remonter toute autre erreur avec un message utile. Éviter les `catch` vides.

#### 4.4. La synchronisation ne définit pas de stratégie sûre pour les modifications locales et les conflits

`mettreAJour` fait un pull avant de créer le commit local. Des modifications non commitées peuvent empêcher le pull; des divergences de branches ou des conflits peuvent également faire échouer l’action. Le README évoque une future résolution simplifiée, ce qui confirme que ce parcours n’est pas complet.

**Correction :** détecter et expliquer l’état local avant l’opération; définir explicitement une séquence sûre de commit/pull/push et un comportement en cas de divergence. Ne pas écraser automatiquement des changements locaux ou distants.

### Priorité moyenne — parcours incomplets ou fragiles

#### 4.5. La récupération clone dans un dossier choisi existant

Le sélecteur demande à l’utilisateur de choisir un dossier, puis `git.clone` l’utilise directement comme répertoire cible. Si ce répertoire contient déjà des fichiers, le clone peut échouer; le code ne crée pas de sous-dossier portant le nom du dépôt et ne vérifie pas au préalable que la destination est vide.

**Correction :** demander un emplacement parent puis créer un sous-dossier au nom du dépôt, ou vérifier que la cible est vide et expliquer clairement le refus avant le clone.

#### 4.6. La sélection d’un projet hors du répertoire personnel peut échouer

Les permissions FS de Tauri sont limitées aux chemins `$HOME/**`. Un dossier déposé depuis un disque externe ou un emplacement hors du répertoire personnel peut être refusé, même si l’utilisateur l’a explicitement sélectionné.

**Correction :** utiliser des permissions/scopes de fichiers accordés dynamiquement à partir du sélecteur ou de la sélection native, et tester aussi les volumes externes. Éviter d’élargir aveuglément l’accès global au système de fichiers.

#### 4.7. « Annuler » peut mener à un écran vide pour l’action de récupération

La récupération depuis la barre latérale efface l’analyse du dossier et ouvre directement la confirmation. Le bouton d’annulation renvoie à l’étape « action », mais cet écran n’est rendu que si une analyse existe. L’utilisateur peut donc se retrouver sans contenu dans la zone principale.

**Correction :** choisir une destination de retour cohérente selon l’origine de l’action (menu ou sélection de dossier), ou renvoyer vers l’écran de dépôt/menu lorsque l’analyse est absente.

#### 4.8. Un dépôt Git imbriqué peut être pris pour le dépôt racine

Le parcours ajoute le marqueur `.git` dès qu’il rencontre un dossier portant ce nom, même s’il se trouve dans un sous-dossier. `analyzeProject` considère ensuite ce marqueur comme la preuve que le dossier sélectionné lui-même est un dépôt Git. Un projet contenant un sous-projet Git peut ainsi être détecté à tort.

**Correction :** distinguer le chemin exact `.git` à la racine des répertoires `.git` imbriqués, ou tester directement le dépôt à la racine du dossier choisi.

#### 4.9. L’analyse parcourt potentiellement trop de contenu

Seuls `.git`, `.godot`, `node_modules`, `dist` et `target` sont ignorés. Des répertoires volumineux comme `.venv`, `vendor`, `build` ou `.cache` peuvent encore être parcourus, ce qui peut ralentir l’analyse et augmenter la charge mémoire.

**Correction :** élargir les exclusions adaptées aux types de projets détectés, prévoir des limites de profondeur/nombre de fichiers et afficher une erreur claire si une limite est atteinte.

### Priorité basse — qualité, documentation et maintenabilité

#### 4.10. Les erreurs d’identification du compte sont silencieusement converties en `null`

Après obtention du token, une erreur de `obtenirUtilisateurConnecte` est ignorée. L’interface paraît alors connectée sans login, et certaines fonctions échouent plus tard avec un message moins précis.

**Correction :** conserver le token uniquement si l’échec est réellement récupérable et montrer un état d’erreur explicite; sinon faire échouer la connexion avec le contexte correspondant.

#### 4.11. Les appels Octokit ne suivent pas le même transport que le reste

Le service Octokit utilise son transport par défaut, alors que l’authentification et le transport Git passent explicitement par le plugin HTTP natif. Le README indique que toutes les requêtes passent par le plugin natif, ce qui n’est donc pas exact pour les appels Octokit. Le build ne permet pas de vérifier si ces requêtes fonctionnent dans les WebView cibles.

**Correction :** vérifier ce flux en exécution sur les plateformes visées; si nécessaire, configurer Octokit pour utiliser le transport HTTP natif. Sinon, corriger la documentation pour décrire exactement les transports utilisés.

#### 4.12. Couverture de tests absente

`cargo test` n’exécute aucun test et `package.json` ne définit pas de script de test frontend. Les opérations ayant le plus de conséquences — sélection/association du dépôt, filtrage des fichiers, clone, pull/push et erreurs réseau — ne sont donc pas couvertes par une suite automatisée.

**Correction :** ajouter d’abord des tests unitaires aux fonctions d’analyse de projet et aux transitions d’état; ensuite des tests d’intégration avec système de fichiers temporaire et transports GitHub simulés.

#### 4.13. Le bundle JavaScript dépasse le seuil d’avertissement Vite

Le build produit un chunk JavaScript minifié d’environ 563 kB et Vite signale un chunk supérieur à 500 kB. Ce n’est pas un échec de compilation, mais cela peut affecter le chargement.

**Correction :** mesurer la contribution des dépendances puis envisager du découpage dynamique ou des chunks séparés si l’application devient lente. Ne pas masquer l’avertissement sans mesure.

#### 4.14. Plusieurs copies du projet sont présentes

La racine contient les sources actives, tandis qu’un dossier `github-simplifie/` contient une autre copie partielle du projet et un fichier ZIP est également présent. Cela peut rendre incertain le bon répertoire à modifier ou à distribuer.

**Correction :** clarifier quelle copie est la référence, puis documenter ou retirer les copies devenues inutiles dans une opération séparée, après vérification qu’elles ne sont pas nécessaires.

## 5. Résultats des vérifications

| Vérification | Résultat | Interprétation |
|---|---|---|
| `npm run build` | Réussie | TypeScript et Vite compilent; bundle JS actuel d’environ 414 kB minifié. |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Réussie | Le code Rust/Tauri compile dans l’environnement vérifié. |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Réussie, 6 tests | Tests unitaires ciblés; les flux Tauri/GitHub réels ne sont pas couverts. |
| Tests frontend | Non disponibles | Aucun script `test` déclaré dans `package.json`. |
| Exécution réelle avec GitHub et sélection de fichiers | Non réalisée | Nécessite une validation manuelle ou des tests d’intégration avec environnement Tauri et compte GitHub. |

## 6. Ordre conseillé pour les corrections

1. Corriger l’association **dossier local ↔ dépôt distant**, puis valider qu’une mise à jour ne peut pas viser un autre dépôt.
2. Renforcer les contrôles de publication des fichiers sensibles et ajuster le texte de l’avertissement.
3. Rendre explicites les erreurs de configuration du remote et traiter l’état local/conflits avant pull/push.
4. Définir un parcours de récupération qui crée ou valide une destination de clone.
5. Corriger le retour « Annuler », la détection Git imbriquée et l’accès aux dossiers hors `$HOME`.
6. Ajouter des tests automatiques ciblés avant d’étendre le périmètre.
7. Mesurer l’impact du bundle et clarifier la copie de projet de référence.

## 7. Limites de ce rapport

Cette analyse est statique, complétée par des builds et les tests présents. Elle ne certifie pas le comportement de l’application sur Windows/macOS/Linux, la validité de la configuration OAuth côté GitHub, ni le comportement exact du plugin FS sur tous les systèmes de fichiers. Les points concernant clone, CORS/transport API et conflits Git doivent être confirmés par des tests d’intégration sur les plateformes réellement distribuées.

## 8. État après migration native mémoire

- Les traitements Git (statut, staging, commit, synchronisation et clone) sont exécutés par le binaire Git via `std::process::Command`, sans isomorphic-git.
- Le scan de fichiers et le statut Git sont traités en flux; les réponses sont plafonnées à 500 entrées. Le frontend conserve au plus 2 000 chemins et virtualise la liste.
- Une seule liste de chemins de 2 000 entrées est conservée dans le cache Rust; les pages suivantes ne relancent pas un parcours complet du dossier.
- L’overlay de progression est non modal et son état est isolé dans un store externe : les mises à jour de progression ne rerendent plus l’application entière. La progression est indéterminée tant qu’aucun pourcentage fiable n’est disponible.
- Les événements de scroll sont regroupés par frame; les composants de liste sont mémorisés. Les listes rendent au plus 22 lignes de fichiers et environ 12 commits simultanément.
- Les opérations Git natives longues sont limitées à une opération active pour éviter les pics de concurrence. Les animations de chargement n’utilisent plus de boucle JavaScript permanente et respectent `prefers-reduced-motion`.
- Les dossiers générés connus sont ignorés par défaut. Les fichiers sensibles et ceux d’au moins 100 Mio sont automatiquement exclus de l’index courant et inscrits au `.gitignore`; les fichiers de 50 à 100 Mio sont signalés.
- Les opérations Git possèdent un délai maximal de 15 minutes et peuvent être annulées depuis l’interface. Le clone utilise un dossier temporaire puis finalise par renommage.
- L’aperçu est plafonné à 512 Kio et refuse les fichiers binaires, UTF-8 invalide et chemins hors du dossier sélectionné. Les permissions générales du plugin FS ont été retirées.
- Une exclusion du commit courant ne supprime pas les blobs d’un historique déjà existant. Si un fichier trop volumineux a déjà été commité, un push peut encore être refusé par GitHub; la réécriture historique ou Git LFS exige une action distincte et confirmée.
- Les validations effectuées sont `npm run build`, `cargo check --manifest-path src-tauri/Cargo.toml`, `cargo test --manifest-path src-tauri/Cargo.toml` et `git diff --check`. Aucun test de push réel ni mesure RAM sur un dépôt de plusieurs Gio n’a encore été mené; une limite absolue de RAM n’est donc pas garantie.
- La compilation confirme des bornes statiques (500 chemins par page, cache maximal de 2 000 chemins et DOM limité aux lignes visibles), mais aucun profil React, FPS, temps d’interaction, CPU ou RAM n’a été mesuré dans une WebView Tauri pendant cette tâche.
