# REPRISE — Mission de reprise du projet « Objectifs » (pour l'agent Vibe Code)

Tu reprends le projet **« Objectifs »**, une application **personnelle** de gestion d'objectifs et de tâches (PWA offline-first, français, écosystème Google). Le client, décideur unique, est **Mathieu Blandin** (Bretagne, usage strictement personnel, professionnel de l'IT). Ce document te donne **tout l'état du projet** pour le poursuivre sans perte. Lis-le en entier avant d'agir, puis exécute la phase d'initialisation ci-dessous. Les documents de référence complets sont dans `docs/` (ce dossier).

## 1. État des lieux (au 20/10/2026)

- **Produit** : suivi d'objectifs SMART, tâches planifiées par time-blocking, charge en points (1 pt = 1 h), rituels matin/soir, journal d'activité, export/import complet. Vocabulaire métier **en français et figé** : états `a_planifier`, `planifiee`, `en_cours`, `terminee` ; priorités `haute`, `moyenne`, `basse`.
- **Deux livrables** :
  1. **La maquette** (canvas React mono-fichier, v0.12.0, schéma v9) — US1 à US33 recettées et validées (33 US, ~190 checks, 10 itérations, 54/54 tests domaine verts). Elle est la **spécification exécutable** et la référence visuelle/comportementale. Fichier : `docs/objectifs-maquette-v0.12.0.jsx`.
  2. **Le livrable PWA `objectifs-pwa`** (multi-fichiers, zéro dépendance) — socle **M0 / US34** livré le 20/10/2026 en **v0.13.0-m0**, recette métier : **« Validée avec réserves »** (9/9 critères conformes ; les réserves sont les vérifications en conditions réelles de l'action A-014). **Les sources recettées sont déjà présentes à la racine du dépôt — ne les réécris pas, vérifie-les (§2).**
- **Feuille de route** (planning replanifié du 19/10, jalons en jours ouvrés) :
  - **M0 — Socle PWA** : **terminé, livré en avance** (20/10 pour un jalon 27/10–02/11).
  - **M1 — Portage** (03/11 → 13/11) : transplanter le domaine pur et les écrans de la maquette vers le livrable (React 18 + TypeScript + Vite, IndexedDB), tests verts, round-trip export/import, dette de la revue n°1 remboursée.
  - **M2 — Google réel** (16/11 → 24/11) : OAuth Google « en production » (ADR-12), Drive `appDataFolder` (ADR-10), Calendar réel.
  - **M3 — Notifications** (25/11 → 01/12) : rappels Google Calendar natifs pour les rituels (ADR-11).
- **Décisions client actées** : D-1 (persistance distante = Google Drive `appDataFolder`, pas de serveur) ; D-2 (notifications = rappels Google Calendar, TWA écartée, PWA confirmée, portabilité PC exigée).

## 2. Phase d'initialisation (à exécuter maintenant, dans cet ordre)

1. **Vérifie l'arborescence** (§Annexe) : 14 fichiers sources recettés v0.13.0-m0 + `docs/` (7 documents de référence + ce fichier) + `README.md`. Puis vérifie : `node build.js` (11 fichiers dans `dist/`), `node --test tests/domain.test.js tests/livraison.test.js`, `node tests/bdd/runner.js` — tout doit être vert (attendu : tests 0 échec, BDD 5/5). **Interdiction d'utiliser `npm install` ou d'ajouter une quelconque dépendance** (ADR-13/14 : zéro dépendance, build rejouable bit à bit). **Ne modifie aucun fichier recetté avant ces vérifications** ; ensuite, toute modification passe par le cycle v6 (§6).
2. **Initialise le dépôt distant** : `https://github.com/mathieublandin-create/objectifs-pwa.git` (existe, vide — compte de Mathieu). Crée `.gitignore` :
   ```
   dist/
   node_modules/
   ```
   puis `git init -b main`, `git add .`, commit initial `chore: reprise du projet Objectifs — socle M0 v0.13.0-m0 + docs de référence`, `git remote add origin`, `git push -u origin main`, et pose le tag `v0.13.0-m0` (poussé). Si l'authentification bloque, demande à Mathieu un PAT ou `gh auth login`.
3. **Mise en ligne — action A-014** : crée le workflow `.github/workflows/deploy.yml` (le web-upload GitHub ne permet pas de fichiers cachés, c'est à toi de le committer) :
   ```yaml
   name: Deploy Pages
   on:
     push:
       branches: [main]
     workflow_dispatch:
   permissions:
     contents: read
     pages: write
     id-token: write
   concurrency:
     group: pages
     cancel-in-progress: true
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
         - run: node build.js
         - uses: actions/upload-pages-artifact@v3
           with:
             path: dist
     deploy:
       needs: build
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deployment.outputs.page_url }}
       steps:
         - id: deployment
           uses: actions/deploy-pages@v4
   ```
   Commit (`ci: déploiement GitHub Pages — build zéro dépendance`) et pousse. Puis **demande à Mathieu d'activer Pages** : dépôt → Settings → Pages → Source **« GitHub Actions »** → Save. URL attendue : `https://mathieublandin-create.github.io/objectifs-pwa/` (2–3 min, suivre l'onglet Actions). Vérifie que l'URL répond.
   - Choix consigné (I1) : la voie CI (workflow) est retenue par défaut — cohérente avec le DAT ; l'alternative « statique racine » reste possible si Mathieu préfère, mais exigerait `dist/` committé à la racine.
4. **Recette des réserves r1–r3 (US34)** — fais-les vérifier par Mathieu : invite d'installation Chrome/Edge desktop **et** Chrome Android, chargement hors ligne, persistance fermeture/réouverture avec import de son export « A-001 » (menu ☁️ → Importer). Consigne le verdict (avec lui) dans `docs/objectifs-pilotage-projet.md` (action A-014) et mets à jour le guide utilisateur avec l'URL réelle.
5. **Rapporte** : arborescence vérifiée, résultats build/tests, statut git/URL Pages, points en attente de Mathieu. Puis propose le lancement du M1 (§7).

## 3. Actions ouvertes (registre de pilotage — tenir à jour dans `docs/objectifs-pilotage-projet.md`)

| ID | Action | Responsable | Échéance |
| --- | --- | --- | --- |
| A-014 | Réserves de recette M0 : mise en ligne + vérifications navigateur réel r1–r3 | Mathieu | 02/11/2026 |
| A-015 | Rédiger les `.feature` Gherkin du périmètre MVP (US3–US14) pour la non-régression du portage M1 | analyste métier | 13/11/2026 |
| A-006 | Rembourser la dette de la revue n°1 au portage M1 : horloge injectée, aléatoire hors domaine, dates locales (UTC vs local), `localStorage` uniquement via le port | développeur | 26/11/2026 |
| A-010 | Publier l'écran de consentement OAuth Google « En production » au M2 (sinon jetons expirant tous les 7 jours) | développeur | M2 |
| A-005/A-008 | Historiser chaque livraison ; vérifier l'archivage en revue de fin de dev | tous / RT | continu |

Actions soldées à connaître : A-000 à A-004, A-009, A-011 (phasage V2 maintenu), A-012 (annulée : garanties persistance recettées sur le livrable PWA), A-013 (protocole export/import à chaque session — caduc une fois la persistance IndexedDB du M1 en place), A-016 (migration vers Vibe Code — ce document en est le livrable).

## 4. Architecture — les 14 ADR (décisions non négociables, tout écart = nouvel ADR)

1. **ADR-01** : architecture **sans back-end applicatif** — statique pur, hébergement statique HTTPS ; les données ne quittent jamais l'appareil (hors API Google de l'utilisateur). Amendé par D-1 : la persistance distante passe par Google Drive, **toujours sans serveur**.
2. **ADR-02** : **PWA installable Android + PC** (décision client), service worker ; TWA écartée.
3. **ADR-03** : **IndexedDB derrière un port de stockage unique** — le reste du code ignore le support (contrat de référentiel : espaces cloisonnés, migrations, intégrité).
4. **ADR-04** : **le domaine pur de la maquette est la spécification exécutable du livrable** — transplanter à l'identique les fonctions pures et leurs tests ; toute évolution métier est spécifiée d'abord sur le couple cahier + maquette, puis transplantée.
5. **ADR-05** : portage M1 en **React 18 + TypeScript strict + Vite** (continuité maquette ; pas de SSR).
6. **ADR-06** : **pas de gestionnaire d'état global** — point de passage unique `majData`, dérivation (jamais de duplication, US15-c3).
7. **ADR-07** : notifications locales paliers 1-2 (premier plan + rattrapage à l'ouverture). **Amendé par D-2/ADR-11** : palier 3 = rappels Google Calendar.
8. **ADR-08** : **horloge injectée** (`clock`), aléa injecté, **effets de bord déportés derrière les ports** `storage`/`journal` — le domaine est entièrement déterministe sous test.
9. **ADR-09** : pas d'i18n (français seul), pas de librairie CSS additionnelle.
10. **ADR-10** : persistance distante **optionnelle** via Google Drive `appDataFolder` (format d'export US23), synchronisation polling `modifiedTime` ; la couche distante est un **adaptateur optionnel derrière le port de stockage**, jamais une source de vérité obligatoire (offline d'abord).
11. **ADR-11** : **rappels Google Calendar** comme canal des notifications des rituels (événements récurrents) ; Calendar est un canal, jamais un stockage du domaine. Mise en œuvre M3.
12. **ADR-12** : OAuth Google **« en production » dès M2** (jetons sinon expirant tous les 7 jours) ; jetons derrière le port `storage`, jamais dans le code source.
13. **ADR-13** : **build Node zéro dépendance au M0** — rejouable bit à bit, icônes générées par encodeur pur (aucun asset binaire), SW ~40 lignes (Workbox superflu). Réévaluation Vite/Workbox possible au M1/M2 par ADR d'amendement.
14. **ADR-14** : **suite BDD Gherkin zéro dépendance** — mini-runner natif (parseur `Fonctionnalité/Scénario/Étant donné/Quand/Alors/Et`, step definitions par regex, contexte par scénario). Les `.feature` sont rédigées par l'analyste, les steps par le développeur ; la suite de toutes les `.feature` = non-régression fonctionnelle.

## 5. Normes de développement (guide v1.6 — complet dans `docs/objectifs-guide-bonnes-pratiques-dev.md`)

- **Langue** : vocabulaire métier français dans le code et les commentaires (`terminee`, `priorite`…), figé par énumération (§1) ; commentaires de traçage `// US32 — …` ancrant chaque comportement à son critère.
- **Dates** : ISO `yyyy-mm-dd` partout, uniquement via les utilitaires dédiés (`parseISO`, `fmtIso`, `isoLocal`, `isoDuJour`, `isoDuLendemain`). Interdit : `new Date(a, m, j).toString()`, `new Date().toISOString().slice(0, 10)` (donne l'UTC, pas la date locale — passer par l'horloge injectée).
- **Structure cible du portage M1** (DAT `docs/objectifs-dat-architecture.md`) : `src/domain` (pures, zéro I/O, zéro React) · `src/storage` (port + adaptateur IndexedDB) · `src/google` (port + adaptateurs) · `src/journal` (US22 + migrations) · `src/clock` · `src/screens` (composants par écran) · `src/app` (racine, composition). Les dépendances vont de `app` → `screens` → `domain`/ports, jamais l'inverse.
- **Dépendances** : toute dépendance = justification écrite (ADR ou critère), licence vérifiée, taille raisonnable ; pas de librairie pour ce que 10 lignes de TS strict résolvent.
- **Commits** : conventional commits (`feat(taches): …`, `fix(fiche): …`, `test(domaine): …`) ; branche `main` protégée — merge seulement après tests verts et revue ; branches courtes `feat/USxx-…` ; un commit ne mélange pas correction et refactor ; la montée de `APP_VERSION` est un commit dédié.
- **Accessibilité (AA)** : cibles tactiles ≥ 44 px ; `aria-label` sur tout bouton à icône seule ; contrastes AA ; focus visible + piège de focus dans les overlays ; tout refus affiche la règle violée (US28) ; aucune perte de saisie sans confirmation.
- **Patterns imposés** : domaine pur · port/adaptateur · horloge injectée · point de passage unique (`majData` trace par diff vers le journal US22) · refus avec raison affichée · panneaux inline · **suppression logique** (jamais de suppression physique) · migrations nommées, idempotentes, atomiques, version schéma distincte de la version app.
- **Anti-patterns** : valeurs calculées dupliquées · `Date.now()`/`Math.random()` dans le domaine · `localStorage` hors port · état global dispersé · composant > ~150 lignes (livrable) · nombres magiques (constantes nommées + commentaire US) · actions muettes.
- **Tests** : couverture 100 % des fonctions pures y compris chaque `raison` de refus ; diagnostic : un échec de test est d'abord un défaut de harnais, ensuite seulement un défaut de code.

## 6. Processus — cycle de développement v5 et ferme agentique

Le projet est piloté par une **ferme agentique multi-rôles** que tu dois **rejouer comme des rôles successifs** (persona par persona, ou sous-agents) pour toute évolution. L'humain (Mathieu) reste décideur final.

**Les rôles et leurs livrables propriétaires** (un livrable = un seul propriétaire ; les autres agents soumettent des propositions) :
- **Analyste métier** : cahier des charges (US numérotées + critères d'acceptation, `docs/objectifs-cahier-des-charges.md`) + **fichiers `.feature` Gherkin** + recettes métier (verdicts Validée / Validée avec réserves / Rejetée).
- **UX/UI** : revues design, propositions chiffrées ; accessibilité AA.
- **Architecte logiciel** : DAT versionné avec ADR ; valide chaque conception (Conformité / Conformité avec réserves / Non conforme).
- **Responsable technique (RT)** : guide de bonnes pratiques ; contrôle d'explicité + **readiness** des US ; **conception des évolutions** (découpage + plan de tests unitaires macro) ; revues de code (max 2 allers-retours par US).
- **Développeur** : code + step definitions BDD + tests + rapport de tests ; **relit la conception avant de coder**.
- **Chef de projet technique (CPM)** : planning, priorisation, charge, reporting, risques ; escalade les points bloquants à Mathieu.

**Cycle v6 (pour chaque US ou évolution — v5 + revue de lancement, revue d'entrée en test, `.feature` à la readiness, équipe extensible ; décision client du 03/11/2026, guide v1.7 §5.1)** :
1. Raffinement de l'US par l'analyste.
2. Contrôle d'explicité + readiness par le RT ; **dès que l'US est prête à démarrer le dev, le responsable fonctionnel (analyste métier) écrit la `.feature`** (tests Gherkin : un scénario par critère + limites, en français, vocabulaire figé, comportements observables uniquement) ; le RT vérifie couverture et steps réalisables, puis valide formellement le passage en conception.
3. Conception par le RT (+ plan de tests macro) ; **validation de conception par l'architecte** (conformité DAT/ADR) ; relecture par le développeur.
4. **Revue de lancement RT ↔ développeur** (avant codage) : lève les ambiguïtés résiduelles et aligne les attendus de chaque participant ; aucun codage avant clôture.
5. **Développement TDD strict sur une feature branch dédiée (`feat/USxx-…`)** : red (steps + tests d'abord) → green (comportement minimal) → refactor ; non-régression rejouée à chaque livraison.
6. **Relecture du code par le développeur, puis revue d'entrée en test** : le développeur présente ce qu'il a fait ; le responsable fonctionnel juge que **la recette est jouable**.
7. Revue de code par le RT (normes + conception, TDD respecté — les tests ont **précédé** le code, pas de dette non justifiée, sécurité).
8. Tests du développeur jusqu'au vert complet : **US « ready » = suite BDD de son périmètre ET non-régression des US antérieures vertes.**
9. Revue de fin de développement, puis **recette métier** par l'analyste (parcours des critères + bout-en-bout + limites) ; verdict consigné.
10-11. Boucle correction (points formulés en critères testables, l'analyste peut ajouter des `.feature`) → re-recette, jusqu'à acceptation ou **escalade à Mathieu** avec options argumentées.

**Gouvernance anti-boucles (v3 — s'applique à toi)** :
- Un seul orchestrateur route les phases ; chaque agent produit, n'interpelle pas un autre agent. **L'orchestrateur adapte le modèle utilisé à chaque rôle** pour une exécution efficiente par persona (décision client du 03/11/2026).
- Tout échange passe par un **livrable écrit** ; une information manquante devient une **interprétation consignée (Ix)** et le travail continue — jamais de question d'agent à agent.
- Les interprétations ne sont arbitrées que par l'humain aux points de validation, ou en revue de fin de cycle.
- Plafonds : revue de code max 2 allers-retours ; recette max 2 rejets ; au-delà → revue à trois + arbitrage humain. Aucune boucle ne tourne en silence.
- **Plusieurs développeurs peuvent être instanciés en parallèle** quand le besoin existe, après **vérification préalable du risque de modification des mêmes fichiers** (analyse d'impact fichiers avant lancement) ; chaque développeur travaille dans **sa propre branche `feat/USxx-…`**.
- Exécute un cycle complet en une session sans repasser par l'humain entre phases, sauf aux points de validation humaine obligatoires (readiness, anomalies bloquantes, arbitrage).
- **Revue de code automatique (décision client du 05/11/2026)** : l'orchestrateur lance la **revue de code par le RT dès la livraison du développeur, sans demande de validation humaine** (guide v1.11) ; les points de validation humaine obligatoires restent inchangés (readiness, anomalies bloquantes, arbitrage).

## 7. Suite prévue (après l'initialisation)

1. **M1 — Portage** : transplanter le domaine pur de la maquette (`docs/objectifs-maquette-v0.12.0.jsx` — les fonctions pures et leurs tests à l'identique, ADR-04), passer IndexedDB via le port (ADR-03), rembourser la dette A-006, rédiger les `.feature` US3–US14 (A-015). Structure cible §5. Stack : React 18 + TS strict + Vite (ADR-05) — nécessitera un ADR d'amendement pour passer du build zéro dépendance M0 au chaînage Vite.
2. **Guide utilisateur** (`docs/objectifs-guide-utilisateur.md`, v1.0, couvre installation + mise à jour) ; règle : mis à jour à chaque livraison modifiant l'expérience utilisateur, avant clôture.
3. **Historisation** : **un commit + un tag versionné par livraison** (`v0.13.0-m0`, etc.) et les livrables documentaires versionnés dans `docs/` — une livraison n'est close que lorsque ses livrables sont archivés. Chaque document reste la propriété de son rôle (§6).
4. **Persistance entre sessions** : le dépôt distant **est** la persistance — pousse chaque livraison.
5. **Livraison par US, validation humaine par paliers fonctionnels (décision client du 03/11/2026, guide v1.9 §5.1)** : chaque US est livrée individuellement (cycle v6, merge après tests verts + revue, non-régression BDD à chaque livraison) ; **lorsqu'un palier fonctionnel est livré, une phase de test utilisateur en conditions réelles avec Mathieu** est organisée, timeboxée et planifiée comme jalon par le CPM (cohérent avec le guichet humain groupé de la gouvernance v3). La phase par palier ne remplace pas la recette métier par US (analyste) et ne bloque pas les livraisons suivantes. Risques restants consignés : disponibilité du testeur unique (planification en jalon), calendrier (timebox).

## 8. Points d'attention immédiats

- Le schéma de données actuel est **v9** ; la version app **v0.13.0-m0** ; le cache du service worker est versionné par version d'app (`objectifs-<version>`).
- L'export/import « objectifs-donnees-v1 » (US23) est le format de portabilité ; l'export **A-001** de Mathieu contient ses données réelles d'usage — le round-trip import/export est un critère de sortie du M1.
- En cas d'anomalie bloquante ou d'arbitrage nécessaire : **arrête-toi et présente les options à Mathieu**, ne tranche jamais à sa place un arbitrage produit.

## Annexe — Arborescence de référence (fichiers recettés v0.13.0-m0, à vérifier)

```
objectifs-pwa/
├── README.md
├── package.json
├── build.js
├── src/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── sw.js
│   ├── manifest.webmanifest
│   └── domain/
│       ├── exportImport.js
│       └── persistence.js
├── specs/
│   └── us34-socle-pwa.feature
├── tests/
│   ├── domain.test.js
│   ├── livraison.test.js
│   └── bdd/
│       ├── runner.js
│       └── etapes-us34.js
└── docs/
    ├── REPRISE.md (ce document)
    ├── objectifs-maquette-v0.12.0.jsx
    ├── objectifs-cahier-des-charges.md
    ├── objectifs-dat-architecture.md
    ├── objectifs-guide-bonnes-pratiques-dev.md
    ├── objectifs-pilotage-projet.md
    ├── objectifs-guide-utilisateur.md
    └── objectifs-etude-faisabilite-persistance-distante.md
```

Commandes : `node build.js` · `node --test tests/domain.test.js tests/livraison.test.js` · `node tests/bdd/runner.js`. Attendu : 11 fichiers dans `dist/`, tests 0 échec, BDD 5/5 verts.
