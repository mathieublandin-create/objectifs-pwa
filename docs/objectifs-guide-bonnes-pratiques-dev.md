---
name: "guide-bonnes-pratiques-dev"
title: "Guide de bonnes pratiques de développement — Application Objectifs"
type: "text/markdown"
---

# Guide de bonnes pratiques de développement — Application « Objectifs »

**Statut** : v1.3 — v1.0 validée par revue quadripartite le 19/10/2026 ; v1.1 (convention d'historisation) validée le même jour ; v1.2 (cycle de développement v2) validée le même jour ; **v1.3 : cycle v3 — boucle d'acceptation métier (recette + itération de correction d'anomalie + re-recette jusqu'à acceptation ou point bloquant remonté), décision client du 20/10/2026, revue quadripartite intégrée (§8)** ; **v1.4 : cycle v4 — l'architecte logiciel valide la conception du RT avant développement (décision client)** ; **v1.5 : historisation quotidienne de toute spécification modifiée (§5.4)** ; **v1.6 : cycle v5 — BDD (scénarios Gherkin par l'analyste) + TDD (red → green → refactor), décision client** ; **v1.7 : cycle v6 — revue de lancement RT↔développeur, revue d'entrée en test (jouabilité de la recette jugée par le responsable fonctionnel), `.feature` rédigée à la readiness par le responsable fonctionnel, équipe développeur extensible en parallèle sur feature branches (décision client du 03/11/2026)** ; **v1.8 : organisation par lots — les évolutions sont traitées par lots à périmètre gelé, avec une phase de test utilisateur (client, conditions réelles) entre chaque lot (décision client du 03/11/2026)** ; **v1.9 : arbitrage client du 03/11/2026 — la livraison reste US par US (cycle v6, merge après tests verts + revue) ; seule la validation humaine est organisée par paliers fonctionnels**
**Émetteur** : Responsable technique
**Référentiels** : DAT v1.0 (`dat-architecture-objectifs`, ADR-01 à ADR-09, roadmap M0→M5) ; cahier des charges US1–US33 (`cahier-des-charges-app-taches`) ; maquette de référence v0.11.0, schéma v9 (`objectifs-app-prototype`).

**Périmètre** : ce guide s'applique à l'ensemble du cycle logiciel du projet « Objectifs » — raffinement des US, conception, développement, tests, revues — sur les deux supports de code que sont la maquette interactive (mono-fichier canvas React) et le livrable final (PWA autoporteuse multi-fichiers, voir ADR-01). Une **matrice d'applicabilité** (§6) précise, règle par règle, ce qui s'applique à chacun des deux supports.

---

## 1. Technologies utilisées

Toute technologie doit être justifiée par un ADR du DAT ou par un critère d'acceptation du cahier des charges. **Toute nouvelle technologie (ou évolution structurelle du livrable) fait l'objet d'un ADR** rédigé avec l'architecte logiciel avant adoption — une simple justification orale ne suffit pas. Le calendrier d'adoption suit la roadmap M0→M5 du DAT. Aucune dépendance n'est ajoutée sans validation du responsable technique.

| Technologie | Rôle | Justification |
| --- | --- | --- |
| TypeScript (mode `strict`) | Langage unique, domaine et UI | Typage du domaine métier (états, priorités, dates ISO) ; erreurs de contrat détectées à la compilation. ADR-04 : le domaine métier est la spécification exécutable, le type en est la façade. |
| React 18 | UI déclarative | Support de la maquette et du livrable ; composants fonctionnels + hooks uniquement. |
| Vite | Outillage livrable | Build statique simple conforme à l'architecture sans back-end (ADR-01). |
| Tailwind CSS | Styles | Conventions de classes déjà établies en maquette (cibles 44 px : `w-11 h-11`) ; continuité visuelle maquette → livrable. |
| Workbox | Service worker PWA | Fonctionnement hors ligne (US18) ; stratégies de cache définies au portage (M1). |
| IndexedDB (port unique) | Persistance livrable | ADR-03 : un seul point d'accès aux données persistées, derrière une interface de port. |
| `localStorage` (maquette uniquement) | Persistance maquette | Toléré en maquette comme dette tracée (voir §6) ; **proscrit dans le livrable**. |
| Vitest + `fake-indexeddb` | Tests unitaires livrable | Tests du domaine pur et du port de stockage. |
| Playwright | Tests bout-en-bout livrable | Parcours critiques (création, cycle d'état, fiche d'édition) sur la PWA rendue. |
| GitHub Actions | Intégration continue | Exécution des tests à chaque push ; verrouillage qualité (§5). |

**Versions** : les versions majeures/mineures des dépendances sont figées dans le `package.json` du livrable au moment du portage (M1) ; toute montée de version passe par la revue du responsable technique.

---

## 2. Normes de développement

### 2.1 Langue et vocabulaire
- **Vocabulaire métier en français** dans le code, les états et les commentaires : `terminee`, `planifiee`, `priorite`, `objectif`, `charge`, `restant`… Le vocabulaire du domaine est celui du cahier des charges (analyste métier garant).
- **Vocabulaire figé par énumération** (retour analyste métier, v1.0) — états d'une tâche : `a_planifier`, `planifiee`, `en_cours`, `terminee` ; priorités : `haute`, `moyenne`, `basse` ; charge : 1 point = 1 heure. **Toute évolution de ce vocabulaire passe par l'analyste métier et est consignée au cahier des charges** avant tout changement de code.
- **Commentaires de traçage US** : tout comportement métier est ancré à sa critère par un commentaire `// US32 — …`. Règle déjà appliquée en maquette (~120 commentaires US) ; elle est reconduite telle quelle.
- Les identifiants techniques (noms de variables/fonctions utilitaires) restent lisibles et cohérents ; on ne mélange pas français et anglais dans un même concept (ex. : pas de `getTask` à côté de `tacheParId`).

### 2.2 Dates et données
- **Dates au format ISO `yyyy-mm-dd` partout** (schéma v9, US6) : construction et parsing uniquement via les utilitaires dédiés (`parseISO`, `fmtIso`, `isoLocal`, `isoDuJour`, `isoDuLendemain`). Interdit : `new Date(annee, mois, jour).toString()`, formats locaux, comparaisons de dates sous forme de texte libre.
- Piège connu et proscrit : `new Date().toISOString().slice(0, 10)` produit la date **UTC**, pas la date locale — les dates « du jour » doivent passer par l'horloge injectée + utilitaire local (ADR-08, §3).
- **1 point de charge = 1 heure** (règle métier, unité affichée en clair dans les libellés).
- Aucune valeur calculée n'est stockée si elle peut être recalculée à partir du domaine (US15-c3 : `charge` peut être résumée, `passe`/`restant` sont journalisés, mais jamais deux sources de vérité pour un même concept).

### 2.3 Structure du livrable (portage M1)
Découpage imposé par le DAT (§ architecture cible) :

```
src/
  domain/     # fonctions pures métier, zéro I/O, zéro React
  storage/    # port de persistance + adaptateur IndexedDB (ADR-03)
  google/     # port + adaptateur des services Google (ADR-05/06)
  journal/    # journal d'événements (US22) et migrations de schéma
  clock/      # horloge injectable (ADR-08)
  screens/    # composants React par écran (Taches, Objectifs, Rituel, …)
  app/        # racine, composition, contexte
```

- Un dossier = une responsabilité ; les dépendances vont de `app` → `screens` → `domain`/ports ; jamais l'inverse.
- **La maquette n'est pas soumise à ce découpage** (mono-fichier par nature) — voir la matrice §6.

### 2.4 Dépendances saines
- Toute nouvelle dépendance : justification écrite (ADR ou critère), licence vérifiée, taille raisonnable, maintenue. Une dépendance non validée en revue est refusée.
- Pas de bibliothèque pour ce que 10 lignes de TypeScript strict résolvent (ex. : manipulation de dates se limite aux utilitaires du projet).

### 2.5 Commits et branches (livrable)
- **Conventional commits** : `feat(taches): …`, `fix(fiche): …`, `test(domaine): …`, `docs(cahier): …`, `refactor(journal): …`.
- Branche `main` protégée : merge uniquement après tests verts et revue du responsable technique. Branches courtes `feat/USxx-…` ou `fix/…`, une US par branche.
- Un commit ne mélange pas correction et refactor ; la montée de version applicative (`APP_VERSION`, US18) est un commit dédié et référencé dans la recette.

### 2.6 Accessibilité et ergonomie (retour UX/UI, v1.0)
- **Cibles tactiles ≥ 44 px** pour toute action (classe `w-11 h-11` en pratique ; dérogations intermédiaires tolérées uniquement si consignées au cahier — ex. rituel v0.11.0, hors périmètre US32).
- **`aria-label` obligatoire** sur tout bouton à icône seule (✏️, ✕, état…) — l'icône n'est jamais le seul libellé.
- **Contrastes AA** (WCAG 2.1) pour le texte et les indicateurs d'état ; l'état courant d'un groupe de boutons est signalé visuellement (ex. ●) **et** par attribut d'accessibilité.
- **Focus visible** ; dans les overlays (ex. fiche d'édition), **piège de focus** et retour du focus à l'élément d'appel à la fermeture — le piège de focus de la fiche est un constat connu, tracé en revue d'implémentation (§7).
- **Récupération d'erreur** : tout refus affiche la règle violée (US28) ; aucune perte de saisie sans confirmation (suppression logique avec confirmation).

---

## 3. Design patterns

### 3.1 Patterns à utiliser

| Pattern | Application dans le projet | Référence |
| --- | --- | --- |
| **Domaine pur** — fonctions sans I/O, sans effet de bord | Tout le métier (transitions d'état, charge, SMART, tri) est une fonction pure prenant ses entrées en paramètres (`now` inclus) | ADR-04, ADR-08 |
| **Port / adaptateur** | Persistance (port unique `Storage` + adaptateur IndexedDB), services Google, notifications (3 paliers) | ADR-03, ADR-05, ADR-06, ADR-07 |
| **Injection d'horloge** | Toute fonction dépendant du temps reçoit `now` en paramètre (valeur par défaut admise en maquette uniquement) | ADR-08 |
| **Point de passage unique** | Toute mutation d'état passe par `majData`, qui trace par diff (`evenementsDeDiff`) vers le journal US22 | US22, US15 |
| **Refus avec règle affichée** | Aucun refus muet : chaque garde retourne une raison (`{ ok, raison }`) affichée à l'utilisateur (US28) | US28 |
| **Panneaux inline** | Les actions secondaires s'ouvrent en sous-panneau dans le contexte (saisie, clôture, ré-ouverture, suppression avec confirmation) | US32 |
| **Suppression logique** | Jamais de suppression physique de données métier ; champ de désactivation + confirmation explicite | US4-c6 |
| **Migrations nommées** | Une migration = un nom, idempotente, atomique, suivie d'une vérification d'intégrité ; version schéma distincte de la version app | US18, schéma v1→v9 |

### 3.2 Patterns et anti-patterns à proscrire

- **Valeurs calculées dupliquées** : interdit de stocker ce qui se recalcule (US15-c3).
- **`Date.now()` / `Math.random()` dans le domaine** : sources d'impureté ; ils sont injectés en paramètre (maquette : tolérance tracée par ADR-08, dette à rembourser au portage).
- **`localStorage` en dehors d'un port** : dans le livrable, toute persistance passe par le port unique (ADR-03). En maquette, accès directs tolérés mais répertoriés comme dette (§6).
- **État global dispersé** : l'état applicatif vit à la racine (`App`) et descend via props ; pas de store ad hoc, pas d'état dupliqué entre écrans.
- **Composants à responsabilité multiple** : un composant = un écran ou un panneau ; s'il dépasse ~250 lignes en maquette (~150 en livrable), il doit être scindé (nouveau composant, pas de refactor sauvage).
- **Nombres magiques** : toute valeur de règle métier (rotation 30 lots, 3 suggestions, 6 prérequis, 44 px) est une constante nommée avec commentaire de traçage.
- **Actions muettes** : toute action réussie ou refusée est tracée et/ou affichée (US22/US28).

---

## 4. Bonnes pratiques de maintenabilité

### 4.1 Testabilité — « le harnais d'abord »
- Le domaine pur est testé par des **tests miroir** : copies **exactes** des fonctions pures, exécutées dans le harnais d'exécution avec `now` fixé (reproductibilité).
- Règle de diagnostic établie : **un échec de test miroir est d'abord un défaut de harnais** (copie non exacte, données de test irréalistes), et seulement ensuite un défaut de code. Le rapport de tests consigne le diagnostic retenu.
- Au portage, les tests importent directement le domaine (`Vitest`) ; les copies disparaissent, la spécification reste (ADR-04).
- Couverture attendue du domaine : 100 % des fonctions pures, y compris les gardes de refus (chaque `raison` est testée).
- Les handlers UI sont répliqués dans le harnais lorsqu'ils portent de la logique ; les tests bout-en-bout (Playwright) couvrent les parcours critiques du livrable.

### 4.1-bis Développement piloté par les tests — BDD/TDD (v1.6)
- **BDD (spécification exécutable)** : chaque US est accompagnée d'un **fichier `.feature` (Gherkin, en français)** rédigé par l'**analyste métier** à partir des critères d'acceptation — un scénario par critère, plus les scénarios de limite. La `.feature` est un livrable de l'analyste (proposition de modification par le dev : interdite ; signalement au RT : obligatoire). Elle est archivée avec le cahier.
- **Exécution** : les `.feature` sont exécutées par le **runner BDD zéro dépendance du livrable** (ADR-14) ; les **step definitions sont écrites par le développeur**. La suite BDD de toutes les US livrées = **suite de non-régression fonctionnelle**, rejouée à chaque livraison.
- **TDD (red → green → refactor)** : le développeur écrit **d'abord** les steps et tests unitaires (**rouge**), puis le comportement minimal (**vert**), puis refactorise sans casser le vert. Une livraison dont le code a précédé les tests est non conforme (relecture RT).
- **Définition of ready (TDD)** : une US n'est déclarée **ready** par le développeur que si la suite BDD de son périmètre **et** la non-régression des US antérieures sont **vertes** — c'est la précondition de la revue de fin de développement et de la recette métier.
- Le vocabulaire des steps reprend **exclusivement** les énumérations figées du métier (§2.1) ; un scénario ne teste qu'un comportement observable par l'utilisateur, jamais un détail d'implémentation.

### 4.2 Documentation vivante
- **Cahier des charges** : source de vérité métier (US, recettes consignées à chaque itération). **DAT** : source de vérité architecture (ADR). **Ce guide** : source de vérité normes et qualité. La maquette : référence visuelle et comportementale.
- Toute interprétation ou arbitrage entre critères est consigné au cahier avec sa justification.

### 4.3 Complexité maîtrisée
- Fonctions pures courtes et nommées en français ; un niveau d'imbrication raisonnable (privilégier gardes précoces) ; pas de conditionnalités à trois niveaux non commentées.
- Les commentaires expliquent le **pourquoi** métier (avec référence US), jamais le **comment** trivialement.

### 4.4 Dette technique
- Toute dette est **tracée** : origine, justification, point de remboursement. La dette connue en cours : horloge/aléatoire en dur et `localStorage` hors port en maquette — justifiée par ADR-08, **remboursée au portage M1**.
- Une dette non justifiée en revue est un constat **bloquant**. Une dette justifiée mais sans point de remboursement planifié est **non bloquante** jusqu'à l'échéance, puis devient bloquante.

### 4.5 Observabilité
- Journal d'événements US22 : chaque mutation passe par le point unique et produit un événement tracé (type, message, contexte, erreur éventuelle).
- En maquette, le journal est consultable in-app (écran Journal) ; au livrable, le même contrat est conservé via le port de persistance.

### 4.6 Sécurité
- Validation de toutes les entrées utilisateur (titres non vides, charges > 0, dates ISO valides — gardes déjà effectives) ; échapper par construction (React) ; aucune donnée ne quitte l'appareil sans action explicite de l'utilisateur (architecture sans back-end, ADR-01) ; secrets éventuels (clés d'API Google) uniquement dans la configuration du service, jamais dans le code source.

---

## 5. Gouvernance

### 5.1 Cycle et points de contrôle du responsable technique — cycle de développement v6 (v5 + revue de lancement, revue d'entrée en test, `.feature` à la readiness, équipe extensible, décision client du 03/11/2026)
1. **Raffinement des US** : challenge des critères, impacts techniques, risques (analyste métier + UX/UI).
2. **Contrôle d'explicité et readiness** : l'US raffinée doit être **complètement explicite** (critères non ambigus, aucune zone d'ombre fonctionnelle, interprétations consignées) et satisfaire la readiness (claire, testable, estimable, conforme au DAT et au guide). **Dès que l'US est déclarée prête à démarrer le développement, le responsable fonctionnel (analyste métier) écrit les tests Gherkin : la `.feature`** (un scénario par critère d'acceptation + scénarios de limite, un fichier `.feature` par US — spécification exécutable, §4.1-bis). **Le RT vérifie en outre que les scénarios couvrent tous les critères, sont non ambigus et exécutables** (aucun step irréalisable). Sinon : blocage argumenté + voie de résolution. Le RT **valide formellement** le passage en conception.
3. **Conception par le RT** : conception de l'évolution (découpage, modèle de données/contrats si requis, impacts, design patterns du §3) **et plan de tests unitaires macro** (cas à couvrir, attendus, priorités). **Validation de la conception par l'architecte logiciel** : conformité au DAT et aux ADR, cohérence structurelle, tout écart ou évolution structurelle passe par ADR ; verdict **Conformité / Conformité avec réserves / Non conforme (blocage motivé + voie de résolution)**. Le **développeur relit ensuite la conception avant de coder** ; les écarts sont arbitrés par le RT avant développement.
4. **Revue de lancement RT ↔ développeur (avant codage)** : le RT et le développeur passent en revue la conception validée pour **lever toute ambiguïté résiduelle** et **aligner les attendus de chaque participant** (livrables, critères de sortie, normes applicables, plan de tests). Les points ouverts restants deviennent des interprétations consignées (Ix), arbitrées uniquement par l'humain. **Aucun codage avant la clôture de la revue de lancement.**
5. **Développement TDD (red → green → refactor) sur une feature branch dédiée** : le développeur écrit **d'abord** les step definitions de la `.feature` et les tests unitaires du plan macro (rouge), puis implémente le comportement minimal jusqu'au vert, puis refactorise ; la non-régression fonctionnelle (suites `.feature` des US antérieures) est rejouée à chaque livraison. **Chaque développeur développe dans sa propre branche `feat/USxx-…`** (branche `main` protégée : merge uniquement après tests verts et revue). Suivi de la **relecture de code par le RT avant les tests finaux** : conformité aux normes **et à la conception validée**, couverture des critères d'acceptation et du plan de tests macro, **TDD respecté (les tests ont précédé le code)**, pas de dette non justifiée, sécurité. Constats **bloquant / non bloquant**, localisés et actionnables.
6. **Relecture du code par le développeur, puis revue d'entrée en test** : le développeur relit son propre code, puis **présente ce qu'il a fait** (choix, couverture, écarts) ; le **responsable fonctionnel (analyste métier) juge alors que la recette est jouable** (scénarios exécutables, parcours rejouables bout-en-bout) — précondition à l'exécution des tests finaux et à la revue de fin de développement.
7. **Tests exécutés par le développeur** : mise en œuvre du plan de tests macro et de la suite BDD, boucle de correction jusqu'au vert, rapport de tests (échecs de harnais distingués des défauts de code). **Une US est déclarée « ready » uniquement si la suite BDD de son périmètre et la non-régression des US antérieures sont vertes.**
8. **Revue de fin de développement** : validation globale avant recette métier — vérifie le statut **ready** (suites vertes, rapport complet).
9. **Recette métier par l'analyste** (préconditions : rapport de tests sans échec bloquant, **suite BDD verte**) : s'appuie sur les scénarios Gherkin de l'US, rejoue les parcours bout-en-bout et les tests des limites ; verdict **Validée / Validée avec réserves / Rejetée** consigné au cahier.
10. **Itération de correction d'anomalie** (si anomalies bloquantes ou majeures) : l'analyste retourne les points **formulés en critères testables** (nouveaux scénarios `.feature` si besoin) ; le développeur corrige sur sa branche ; le RT relit le code ; le développeur rejoue les tests et les critères rejetés ; revue de fin de développement.
11. **Re-recette métier** : la boucle 10→11 se répète jusqu'à **acceptation** (Validée, ou Validée avec réserves — les mineures sont listées pour correction ultérieure) **ou point bloquant remonté** : l'analyste consigne le blocage, le CPM l'escalade au client avec options argumentées, l'US est suspendue jusqu'à arbitrage. Une US n'est close qu'à l'acceptation métier ou à l'arbitrage explicite du client.

**Équipe extensible (v6)** : plusieurs développeurs peuvent être **instanciés en parallèle** lorsque le besoin existe, après **vérification préalable du risque de modification des mêmes fichiers** (analyse d'impact fichiers avant lancement ; en cas de chevauchement, séquencer les US ou découper le périmètre). Chaque développeur travaille dans **sa propre branche `feat/USxx-…`** ; les merges sur `main` restent soumis à tests verts + revue.

**Livraison par US, validation humaine par paliers fonctionnels (v1.9, arbitrage client du 03/11/2026 ; v1.8 prévoyait des lots de livraison — amendé)** : **chaque US est livrée individuellement** (cycle v6 complet : revue de lancement → TDD sur branche `feat/USxx-…` dédiée → revue d'entrée en test → tests verts → revue de fin → recette métier par l'analyste → merge sur `main` après tests verts + revue) ; la non-régression BDD est rejouée à chaque livraison. **La validation humaine est organisée par paliers fonctionnels** : lorsqu'un palier fonctionnel est livré (plusieurs US livrées couvrant un même périmètre fonctionnel), une **phase de test utilisateur en conditions réelles avec le client (Mathieu)** est organisée — timeboxée et planifiée comme jalon par le CPM. Cette phase ne remplace pas la recette métier par US (analyste, verdicts exclusifs) et ne bloque pas les livraisons US suivantes : elle valide le palier fonctionnel en conditions réelles, comme les réserves r1–r3 du M0. Risques consignés et surveillés : disponibilité du testeur unique (mitigé par la planification en jalon), dépassement calendaire des phases de test (mitigé par le timebox) ; le risque de détection tardive inter-lots du v1.8 est levé par le maintien de la livraison et de la non-régression BDD au niveau US.

### 5.2 Itérations du guide
- À chaque itération du guide, la version mise à jour est **soumise à validation quadripartite** : agent UX/UI, architecte logiciel, développeur, analyste métier. Les retours sont intégrés avant publication.
- Le **développeur est informé systématiquement** de chaque changement publié, avec les implications concrètes sur le code en cours et à venir.
- Les versions du guide sont tracées en historique (§8) avec la raison de chaque évolution.

### 5.3 Verrous qualité (intégration continue, livrable)
- TypeScript strict sans erreur ; tests unitaires et bout-en-bout verts ; pas de warning de lint non traité. Toute entorse temporaire est tracée en dette (§4.4).

### 5.4 Historisation des livrables (v1.1 ; périodicité renforcée en v1.4)
- **Périodicité (v1.4)** : en plus de l'archivage à chaque livraison soldée, **toute spécification modifiée dans la journée est archivée le jour même** (en fin de session) — un snapshot quotidien par livrable modifié, quel que soit le moment du cycle (raffinement, conception, arbitrage, incident). Si plusieurs modifications touchent le même livrable le même jour, un seul snapshot est créé en fin de session (pas d'archivage intermédiaire).
- À chaque livraison soldée (fin d'itération, publication ou évolution d'un document de référence), les livrables du projet — **cahier des charges, DAT, guide de bonnes pratiques, maquette/code** — sont archivés dans la bibliothèque Le Chat dédiée « Objectifs — Historique des livrables » (indexée pour la recherche sémantique).
- Chaque archivage **crée un nouveau document, sans écraser** les précédents : le nom porte le livrable, sa version et la date (ex. `Guide de bonnes pratiques dev Objectifs — v1.1 — 2026-10-19.md`). L'historique des versions est donc consultable et interrogeable à tout moment.
- L'archivage est effectué par le responsable de la livraison ; le responsable technique en vérifie la présence lors de la revue de fin de développement. **Une livraison n'est close que lorsque ses livrables sont archivés.**
- La convention s'applique dès le 19/10/2026 (v1.1 du guide) ; les versions antérieures sont archivées a posteriori à leur date de livraison effective.
- **Guide utilisateur (décision client du 20/10/2026)** : le projet maintient un **guide utilisateur** (`guide-utilisateur-objectifs`) couvrant au minimum l'**installation** et la **mise à jour**. Règle de maintenance : il est **mis à jour à chaque livraison modifiant l'expérience utilisateur** (nouvel écran, nouveau comportement visible, changement d'installation ou de mise à jour), par le responsable de la livraison, avant la clôture de celle-ci ; il figure dans les livrables historisés de §5.4. La revue de fin de développement vérifie sa mise à jour.

---

## 6. Matrice d'applicabilité — maquette vs livrable

La maquette est un **mono-fichier canvas React** avec des contraintes de runtime propres (un seul `export default`, pas de modules). Les règles s'appliquent donc différemment :

| Règle | Maquette (canvas mono-fichier) | Livrable (PWA multi-fichiers) |
| --- | --- | --- |
| Découpage en dossiers (§2.3) | Non applicable — un seul fichier, composants bornés à ~250 lignes | Applicable intégralement |
| Modules ES / imports | Non applicable — runtime canvas mono-fichier | Applicable (`import` explicites, pas de dépendances implicites) |
| Outillage build (Vite, lint, CI) | Non applicable — rendu direct par le runtime canvas | Applicable — Vite + GitHub Actions en verrou qualité |
| Domaine pur sans I/O (§3.1) | Applicable — fonctions pures au-dessus des composants | Applicable — dossier `domain/` |
| Injection d'horloge (ADR-08) | Tolérance tracée : `now` en valeur par défaut, `Date.now()` admis dans les handlers (dette M1) | Applicable strictement — aucune horloge en dur |
| `localStorage` | Tolérance tracée (dette M1) : accès directs répertoriés en revue | Proscrit — uniquement via le port IndexedDB (ADR-03) |
| Tests miroir par copies exactes | Applicable (seul mode disponible) | Remplacés par tests directs Vitest |
| Cibles 44 px, aria-labels, contrastes (US31/AA) | Applicable | Applicable |
| Conventional commits / branches | Non applicable (pas de dépôt) | Applicable |
| Constantes nommées, pas de nombres magiques | Applicable | Applicable |
| Point unique `majData` + traçage US22 | Applicable | Applicable |
| Un seul `export default` | Contrainte du runtime canvas — respectée | Non applicable |
| Migrations de schéma nommées/idempotentes | Applicable (v1→v9 déjà en place) | Applicable |

**Principe directeur** : la maquette est la référence comportementale et visuelle ; ses écarts au livrable cible sont autorisés **uniquement** s'ils sont listés dans cette matrice ou tracés en dette avec point de remboursement.

---

## 7. Registre des revues d'implémentation

Les revues de code du responsable technique sont consignées ici : cible, date, constats localisés (bloquant / non bloquant), verdict.

### Revue n° 1 — Maquette v0.11.0 (schéma v9) — 19/10/2026

**Cible** : maquette de référence mono-fichier, v0.11.0 (itération 9 soldée, US27/US32 livrées), relue intégralement au regard du guide v1.0. **Constats bloquants : aucun.** Écarts non bloquants :

| # | Constat localisé | Règle du guide | Statut / action |
| --- | --- | --- | --- |
| 1 | Horloge et aléatoire en dur dans le domaine : `Date.now()`/`Math.random()` dans `saisieTemps`, `createTask`, création d'objectif, `faitDuJour` (sélection du fait du jour) | §3.2, ADR-08 | Toléré en maquette (matrice §6) ; dette tracée, remboursement au portage M1 par injection d'horloge/générateur |
| 2 | `localStorage` hors port : journal quotidien, faits, préférences du rituel, persistance et restauration d'espaces à la racine (6 points d'accès) | §3.2, ADR-03 | Toléré en maquette (matrice §6) ; remplacé par le port IndexedDB unique au portage M1 |
| 3 | Dates « du jour » calculées en UTC via `toISOString().slice(0, 10)` (migrations, clôture de tâche, saisie de temps, fait du jour) au lieu de l'heure locale : écart possible autour de minuit (00h00–1h/2h) | §2.2 | **À ajouter explicitement à la dette ADR-08** ; correction au portage via horloge injectée + `isoDuJour` ; aucune correction rétroactive demandée en maquette |
| 4 | Overlay `FicheTache` : `role="dialog"` et `aria-label` présents, mais **piège de focus et restauration du focus absents** | §2.6 | Observation déjà consignée en itération 9 ; à traiter avec US31/AA (itération 10 ou portage) |
| 5 | Constantes magiques résiduelles : suggestions `.slice(0, 3)`, prérequis de dépendances `.slice(0, 6)` | §3.2 | À nommer en constantes lors d'une prochaine itération ; bon exemple à suivre : `JOURNAL_MAX_LOTS = 30` correctement nommé et commenté |
| 6 | Dérogation 44 px sur les boutons ✏️ du rituel (`w-9 h-9`, programme du matin et suggestions du soir) | §2.6 | Dérogation consignée en recette itération 9 (rituel hors périmètre US32) ; à lever avec US31 |

**Constats positifs crédités** : domaine métier pur, sans React ni I/O, testé par tests miroir (54/54 à l'itération 9) ; migrations de schéma nommées, idempotentes, atomiques avec vérification d'intégrité (v1→v9) ; point de passage unique `majData` avec traçage par diff `evenementsDeDiff` (US22) ; gardes US28 systématiques avec règle affichée ; suppression logique avec confirmation (US4-c6) ; ~120 commentaires de traçage US ; aria-labels sur les boutons icônes ; versionnage applicatif semver distinct du schéma (US18) ; composants dans les bornes du guide (GoalDetail ≈ 244 l., Taches ≈ 219 l., FicheTache ≈ 231 l., Rituel ≈ 162 l.).

**Verdict** : **conforme au guide v1.0, avec écarts tolérés par la matrice d'applicabilité (§6) et tracés en dette au portage M1**. La maquette reste la référence comportementale et visuelle pour le livrable. Le constat n° 3 (dates UTC) est ajouté au registre de dette à rembourser avec l'ADR-08.

---

## 8. Historique des versions du guide

| Version | Date | Raison de l'évolution |
| --- | --- | --- |
| v0.1 | 19/10/2026 | Initialisation du guide par le responsable technique : technologies (ancrées ADR), normes, patterns, maintenabilité, gouvernance, matrice d'applicabilité maquette/livrable. Soumis à revue quadripartite avant passage en v1.0. |
| v1.0 | 19/10/2026 | Revue quadripartite intégrée : **UX/UI** → nouvelle section accessibilité/ergonomie (§2.6 : 44 px, aria-labels, AA, piège de focus) ; **architecte** → toute technologie/évolution structurelle passe par un ADR, renvoi roadmap M0→M5 ; **développeur** → matrice §6 complétée (modules ES, outillage build/CI) ; **analyste métier** → vocabulaire métier figé par énumération, évolution réservée à l'analyste et consignée au cahier (§2.1). Publication et information du développeur. |
| v1.1 | 19/10/2026 | Convention d'historisation des livrables (§5.4) : archivage systématique de chaque livraison (cahier, DAT, guide, maquette/code) dans la bibliothèque Le Chat « Objectifs — Historique des livrables », en documents versionnés et datés, sans écrasement. Ajout processuel validé par les quatre rôles (aucun impact technique). Information du développeur. |
| v1.2 | 19/10/2026 | **Cycle de développement v2 (décision client)** : le RT contrôle l'explicité complète de l'US raffinée, valide formellement la readiness **pour la conception**, puis **réalise lui-même la conception** de l'évolution — y compris le **plan de tests unitaires macro** ; le **développeur relit la conception avant de coder**, développe selon la conception, puis **exécute les tests** après la **relecture de code du RT**. Revue quadripartite intégrée : **développeur** → la relecture amont de la conception donne une vue d'ensemble avant codage et évite les écarts d'interprétation (première application : itération 10, US31) ; **analyste métier** → le raffinement amont reste inchangé, le contrôle d'explicité consolide les interprétations consignées au cahier ; **architecte** → la conception RT s'adosse explicitement au DAT et aux ADR, tout écart structurel passe par ADR ; **UX/UI** → sans impact direct, l'US31 suivra le même cycle. Publication et information du développeur. |
| v1.3 | 20/10/2026 | **Cycle de développement v3 (décision client)** : le cycle v2 est complété par la **boucle d'acceptation métier** — après la revue de fin de développement, **recette métier par l'analyste** (critères d'acceptation + scénarios bout-en-bout + tests des limites ; verdict Validée / Validée avec réserves / Rejetée) ; **si rejet (bloquant/majeur) : itération de correction d'anomalie** (analyste retourne les points en critères testables → dev corrige → RT relit le code → dev rejoue les tests et les critères rejetés → revue de fin de dev) puis **re-recette** ; la boucle se répète **jusqu'à acceptation métier ou point bloquant remonté** (consigné par l'analyste, escaladé par le CPM au client, US suspendue jusqu'à arbitrage). Revue quadripartite intégrée : **analyste métier** → garant de la boucle d'acceptation, seul émetteur des verdicts, condition de fermeture d'une US désormais explicite ; **développeur** → les retours de recette arrivent formulés en critères testables, la re-recette rejoue les critères rejetés (charge maîtrisée) ; **RT** → la relecture de code s'applique à chaque itération de correction, pas seulement à la première passe ; **UX/UI** → les anomalies d'accessibilité/ergonomie remontées en recette suivent la même boucle. Première application : recette R1–R8 de l'itération 10. Publication et information du développeur. |
| v1.4 | 20/10/2026 | **Cycle de développement v4 (décision client)** : à l'étape 3, la **conception produite par le RT** est **validée par l'architecte logiciel avant développement** — conformité au DAT et aux ADR, cohérence structurelle, tout écart structurel passe par ADR ; verdict Conformité / Conformité avec réserves / Non conforme (blocage motivé + voie de résolution). La relecture par le développeur est inchangée et suit la validation architecte. Revue quadripartite intégrée : **architecte** → contrôle amont de la conformité au DAT au moment où les décisions structurelles se prennent (et non a posteriori en revue de code) ; **RT** → sa conception est challengeée avant codage, ce qui réduit les rebonds en développement ; **développeur** → code contre une conception doublement validée (architecte + RT), interprétations non ambiguës ; **analyste métier** → sans impact sur la boucle d'acceptation, qui est inchangée. Première application : itération M0. Publication et information du développeur. |
| v1.5 | 20/10/2026 | **Périodicité d'historisation renforcée (§5.4, décision client)** : toute spécification modifiée dans la journée est archivée **le jour même, en fin de session** (snapshot quotidien par livrable modifié, un seul snapshot par livrable et par jour même en cas de modifications multiples) ; l'archivage à chaque livraison soldée reste en vigueur. Objectif : un historique journalier fin de toutes les spécifications, consultable et interrogeable à tout moment. Application immédiate dès le 20/10. |
| v1.6 | 20/10/2026 | **Cycle de développement v5 — BDD/TDD (décision client)** : l'**analyste métier rédige les scénarios Gherkin** (`.feature`, un par US, un scénario par critère + limites) — spécification exécutable, livrable de l'analyste ; le RT contrôle leur couverture et leur exécutabilité en même temps que la readiness (étape 2) ; le **développeur adopte le TDD** (red → green → refactor) : steps et tests unitaires d'abord, comportement minimal ensuite, refactorisation ; la **suite BDD de toutes les US livrées devient la non-régression fonctionnelle**, rejouée à chaque livraison ; **une US n'est « ready » que suites BDD et non-régression vertes** (précondition des revues de fin de dev et de la recette métier). Runner Gherkin **zéro dépendance** (ADR-14). Revue quadripartite intégrée : **analyste métier** → ses critères deviennent exécutables, la recette s'appuie sur ses scénarios ; **développeur** → les étapes « conception → tests → code » s'enchaînent sans interprétation, la non-régression est mécanique ; **RT** → la vérification ready est objective (suites vertes), la relecture contrôle le respect du TDD ; **architecte** → runner zéro dépendance conforme ADR-13, rétro-conversion progressive des US antérieures (jamais en bloc). Première application : `.feature` US34, jalons M1+. Publication et information du développeur. |
| v1.7 | 03/11/2026 | **Cycle de développement v6 (décision client)** : (1) **revue de lancement RT↔développeur** entre conception validée et codage — lève les ambiguïtés résiduelles et aligne les attendus de chaque participant, aucun codage avant clôture ; (2) **revue d'entrée en test** — après relecture de son code, le développeur présente son travail et le **responsable fonctionnel (analyste métier) juge la recette jouable** avant tests finaux et revue de fin ; (3) la **`.feature` (tests Gherkin) est rédigée par le responsable fonctionnel dès que l'US est prête à démarrer le développement** (étape 2, readiness), le RT en contrôle la couverture et l'exécutabilité ; (4) **équipe développeur extensible** — plusieurs développeurs instanciables **en parallèle** après vérification préalable du risque de modification des mêmes fichiers, chacun dans **sa propre branche `feat/USxx-…`**. Revue quadripartite intégrée : **développeur** → deux points de revue explicites avant codage et avant tests, attentes partagées, branches dédiées = pas de conflit de code ; **analyste métier** → écrit les tests à la readiness, juge la jouabilité de la recette en revue d'entrée en test ; **RT** → anime la revue de lancement, contrôle toujours couverture/exécutabilité des `.feature` ; **architecte** → sans impact (pas d'écart structurel). Première application : M1. Publication et information des développeurs. |
| v1.8 | 03/11/2026 | **Organisation par lots (décision client)** : les évolutions sont traitées par **lots à périmètre gelé** (2–4 US, périmètre figé au lancement), suivis chacun d'une **phase de test utilisateur en conditions réelles avec le client**, timeboxée et planifiée comme jalon. Chaque US du lot garde le cycle v6 complet et la recette métier par US ; la phase de test utilisateur est un niveau de validation supplémentaire au niveau lot (guichet humain groupé, cohérent avec la gouvernance v3). Risques consignés : délai de détection inter-lots (mitigé par la non-régression BDD à chaque livraison), gonflement du lot (mitigé par le gel), disponibilité du testeur (mitigé par la planification), calendrier (mitigé par le timebox). Revue quadripartite intégrée : **analyste** → la recette métier par US reste le niveau de verdict, le test utilisateur valide le lot en conditions réelles ; **développeur** → livraisons intra-lot fréquentes, lots courts = branches courtes maintenues ; **RT** → le CPM intègre les phases de test utilisateur au planning comme jalons ; **CPM** → timebox et visibilité des phases de test utilisateur. Première application : lots du M1. |
| v1.9 | 03/11/2026 | **Arbitrage client (Mathieu) sur le v1.8** : la livraison d'évolutions reste **US par US** (cycle v6, merge après tests verts + revue, non-régression BDD à chaque livraison) ; seule la **validation humaine est organisée par paliers fonctionnels** (phase de test utilisateur en conditions réelles avec le client lorsqu'un palier fonctionnel est livré, timeboxée, planifiée comme jalon par le CPM). Conséquence : le risque de détection tardive inter-lots consigné en v1.8 est levé ; il reste la disponibilité du testeur unique et le coût calendaire des phases de test (mitigés par planification + timebox). Revue quadripartite intégrée : **analyste** → recette métier toujours par US, le palier fonctionnel est un niveau de validation utilisateur supplémentaire ; **développeur** → rythme de livraison inchangé, branches courtes maintenues ; **RT/CPM** → les paliers fonctionnels et leurs phases de test figurent au planning. Première application : M1. |