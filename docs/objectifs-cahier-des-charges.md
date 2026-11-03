---
name: "cahier-des-charges-app-taches"
title: "Cahier des charges — App de suivi d'objectifs et tâches"
type: "text/markdown"
---

# Cahier des charges simplifié — Application de suivi d'objectifs et tâches

**Contexte** : application Android personnelle, intégrée à l'environnement Google (Agenda, Gmail). Objectifs décomposés en tâches, priorisées, planifiées dans l'agenda, avec suivi de backlog, vélocité et prévisions.

**Principes transverses** (s'appliquent à toutes les US) :
- Données locales d'abord, synchronisation Google Agenda en sortie (une tâche planifiée = un événement).
- Priorité d'objectif = `P1` (critique) à `P4` (optionnel). Priorité de tâche = haute / moyenne / basse.
- Charge prévisionnelle d'une tâche : estimée en **points** (1 pt = 1 heure de travail), saisie manuellement à la création.
- États d'une tâche : `à planifier` (par défaut, sans date) → `planifiée` (date fixée) → `en cours` → `terminée`.
- Objectifs **SMART** : chaque objectif porte les 5 attributs SMART (voir US12), avec des contrôles automatiques de conformité.
- Navigation : un objectif est cliquable → écran de **détail de l'objectif** (attributs SMART, tâches liées et leur statut, modification). La création passe par un **écran dédié** (voir US13).
- Données **cloisonnées par compte Google** connecté (US14) ; schéma de données **versionné**, toute évolution passe par une migration (US15–US16).
- L'application est **responsive** (smartphone → desktop, US17).

---

## User stories

### US1 — Vue de planification et d'état des tâches
> En tant qu'utilisateur, je veux avoir une vue pour savoir si mes tâches sont planifiées et leur état.

- **Écran** : liste "Tâches" avec colonnes : titre, objectif parent, état (`à planifier` / `planifiée` / `en cours` / `terminée`), date planifiée, priorité, charge.
- **Règles** :
  - Une tâche avec une date planifiée apparaît dans Google Agenda (événement synchronisé, mis à jour si la date change).
  - Le passage à "terminée" met à jour le backlog, la vélocité et l'avancement de l'objectif parent.
  - **Regroupement par état (passe d'usage 3)** : dans l'écran Tâches, les tâches sont regroupées par état dans l'ordre du cycle de vie (`à planifier` → `planifiée` → `en cours` → `terminée`), chaque groupe précédé d'un intitulé avec son compte ; les groupes vides ne sont pas affichés ; le tri interne à chaque groupe est inchangé (US5) ; les filtres par état et par objectif restent fonctionnels (un filtre d'état n'affiche que le groupe correspondant).
  - **Journal des changements d'état (passe d'usage 3)** : chaque changement d'état d'une tâche est historisé avec sa date réelle au jour (liste ordonnée portée par la tâche ; migration numérotée `v06_v07_historique_etats` conformément à US16, amorcée avec l'état courant — daté de la date de fin réelle si la tâche est terminée, sinon de la date de migration) ; l'état courant doit toujours correspondre à la dernière entrée du journal (invariant contrôlé par l'intégrité du schéma v7) ; l'historique est consultable depuis l'écran Tâches (fiche de la tâche), la date du dernier changement étant visible sur chaque rangée.
- **Critères d'acceptation** :
  1. Je vois en un coup d'œil l'état de chaque tâche et si elle est planifiée.
  2. Changer la date d'une tâche met à jour l'événement agenda.
  3. Je peux filtrer par objectif et par état.
  4. (Passe d'usage 3) L'écran Tâches affiche un groupe intitulé par état avec son compte, dans l'ordre du cycle de vie ; les filtres restent fonctionnels à l'intérieur des groupes.
  5. (Passe d'usage 3) Chaque changement d'état ajoute une entrée datée au journal de la tâche ; l'état courant correspond toujours à la dernière entrée ; l'historique est consultable sur la fiche de la tâche.

### US2 — Statistiques de réalisation (jour / semaine / mois)
> En tant qu'utilisateur, je veux une vue statistique du nombre de tâches réalisées par jour, par semaine et par mois.

- **Écran** : vue "Statistiques" avec 3 granularités commutables (jour / semaine / mois), graphique du nombre de tâches terminées et de points réalisés.
- **Critères d'acceptation** :
  1. Je peux basculer entre vue journalière, hebdomadaire et mensuelle.
  2. Les compteurs affichent tâches terminées **et** points réalisés.
  3. Une tâche terminée est comptée à sa date réelle de complétion.

### US3 — Formulaire de saisie rapide de tâche
> En tant qu'utilisateur, je veux un formulaire de saisie rapide de tâches.

- **Écran** : formulaire simple à champs dédiés : titre (obligatoire), objectif parent, priorité (défaut : moyenne), charge en heures (défaut : 1 h), date optionnelle.
- **Critères d'acceptation** :
  1. Je peux créer une tâche avec seulement un titre en ≤ 3 interactions.
  2. Chaque champ est accessible directement dans le formulaire, sans saisie en langage naturel ni syntaxe spéciale.
  3. La tâche apparaît immédiatement dans le backlog de l'objectif.

### US4 — Charge prévisionnelle et temps passé par tâche
> En tant qu'utilisateur, je veux pouvoir avoir une charge prévisionnelle sur chaque tâche et saisir le temps réellement passé.

- **Règles** :
  - Charge estimée en points (1 pt = 1 h) à la création, modifiable à tout moment.
  - **Formule** : charge restante = max(charge estimée − temps passé cumulé, 0), tant qu'aucune ré-estimation n'a eu lieu.
  - **Saisie de temps en deux valeurs** : à chaque saisie, l'utilisateur renseigne **le temps passé** ET **le temps restant estimé** (recalage systématique, pas optionnel). La saisie en une valeur seule est refusée : ce sont les deux champs du formulaire de saisie de temps (saisie manuelle, rappel du soir US11).
  - Après une saisie : temps passé cumulé += temps passé saisi ; charge restante = temps restant saisi ; charge estimée (recalée) = temps passé cumulé + charge restante.
  - **Clôture obligatoire avec temps ajusté (passe d'usage 2)** : une tâche ne passe à l'état « terminée » **que par une saisie de temps finalisée** — l'utilisateur saisit le **temps passé total ajusté** (champ obligatoire, ≥ temps déjà logué, suggestion pré-remplie = estimation courante) ; le restant passe à 0, la date réelle de complétion (US2) est posée et l'écart éventuel alimente la dérive (A3). La clôture est annulable sans complétion ; une tâche bloquée (US19) ne peut pas être clôturée.
  - **Historique du temps logué (passe d'usage 2)** : chaque saisie est journalisée (tâche, jour, heures — journal US4/US7 existant) ; l'historique est consultable groupé **par jour** et **par tâche** (écran Statistiques), avec totaux par groupe.
- **Critères d'acceptation** :
  1. Chaque tâche porte une charge estimée, un temps passé cumulé et une charge restante.
  2. Le formulaire de saisie de temps comporte obligatoirement les deux champs : temps passé et temps restant estimé.
  3. La charge d'un objectif = somme des charges de ses tâches ; le temps passé d'un objectif = somme des temps passés.
  4. Toute saisie met à jour backlog, statistiques et prévisions.
  5. L'écart entre charge estimée initiale et charge recalée alimente l'indicateur de fiabilité de l'estimation (dérive).
  6. (Passe d'usage 2) Terminer une tâche exige la saisie du temps passé total ajusté ; aucune tâche ne passe à « terminée » sans saisie ; la clôture d'une tâche bloquée est refusée.
  7. (Passe d'usage 2) L'historique du temps logué est consultable groupé par jour (décroissant) et par tâche, avec les saisies détaillées et les totaux de chaque groupe.

### US5 — Priorisation des objectifs et des tâches
> En tant qu'utilisateur, je veux pouvoir prioriser les objectifs et les tâches.

- **Règles** :
  - Objectifs : P1–P4, tri par défaut de la liste d'objectifs. Le changement de priorité d'un **objectif** s'effectue depuis l'écran de détail de l'objectif (US13) ; le changement de priorité d'une **tâche** est accessible directement depuis la liste des tâches.
  - Tâches : haute / moyenne / basse ; le backlog est trié par (priorité objectif, priorité tâche, date).
- **Critères d'acceptation** :
  1. Je peux changer la priorité d'un objectif et d'une tâche à tout moment.
  2. Le backlog est automatiquement re-trié selon les priorités.
  3. Un badge visuel distinct chaque niveau de priorité.

### US6 — Temps prévisionnel restant (objectif et tâche)
> En tant qu'utilisateur, je veux avoir le temps prévisionnel restant pour un objectif et une tâche.

- **Règles** :
  - Temps restant tâche = charge restante en heures (1 pt = 1 h), converti en jours ouvrés si souhaité (1 jour ≈ 7 h travaillées, paramétrable).
  - Temps restant objectif = Σ charges restantes des tâches ouvertes.
- **Critères d'acceptation** :
  1. Chaque tâche ouverte affiche son temps restant estimé.
  2. Chaque objectif affiche son temps total restant.
  3. Les valeurs se mettent à jour dès qu'une tâche avance ou est ré-estimée.

### US7 — Estimation de date de fin (objectifs / tâches)
> En tant qu'utilisateur, je veux une estimation de la date de fin des objectifs et tâches, basée sur une mise à jour manuelle des tâches.

- **Règles** :
  - **Vélocité progressive — estimation dès le 2ᵉ jour de saisie** :
    - Moins de 2 jours avec saisie : pas d'estimation affichée (message explicite « estimation dès la prochaine saisie »).
    - Dès le 2ᵉ jour avec saisie : vélocité hebdomadaire estimée = (temps passé cumulé ÷ nombre de jours avec saisie) × 7 (extrapolation de la moyenne journalière).
    - Dès 1 semaine complète d'historique : vélocité = moyenne des points réalisés par semaine écoulée.
    - Dès 3 semaines d'historique : vélocité = moyenne des points réalisés sur les 3 dernières semaines (fenêtre glissante).
  - Date de fin estimée = aujourd'hui + (charge restante / vélocité) semaines, en jours calendaires.
  - L'utilisateur ajuste manuellement l'avancement (terminée, temps restant saisi à chaque saisie — US4) ; l'estimation se recalcule.
- **Critères d'acceptation** :
  1. Chaque objectif affiche une date de fin estimée, recalculée après chaque mise à jour.
  2. Si la vélocité est trop faible, un indicateur "à risque" apparaît (estimation > échéance cible).
  3. Je vois la date estimée au niveau tâche (date planifiée + durée) et objectif (vitesse agrégée).

---

### US8 — Planification assistée / time-blocking automatique
> En tant qu'utilisateur, je veux que l'application propose automatiquement un créneau dans mon agenda pour chaque tâche, en fonction de ma disponibilité et de ma vélocité.

- L'app lit les créneaux libres de Google Agenda, les priorise et suggère un bloc pour les tâches prioritaires non planifiées.
- **Critères d'acceptation** :
  1. Je peux demander "Planifier mes tâches de la semaine" et obtenir une suggestion de créneaux.
  2. Les créneaux occupés (réunions, événements) sont exclus.
  3. Je peux accepter / déplacer / refuser chaque suggestion.

### US9 — Vue backlog et burndown de l'objectif
> En tant qu'utilisateur, je veux visualiser l'évolution du backlog d'un objectif sous forme de graphique de burndown (charge restante dans le temps).

- Suivi de l'avancement d'un objectif d'un simple coup d'œil ; comparaison tendance réelle vs théorique.
- **Critères d'acceptation** :
  1. Chaque objectif a un graphe de charge restante par jour/semaine.
  2. Une ligne théorique (décroissance idéale jusqu'à l'échéance) est affichée en comparaison.
  3. Le graphe se met à jour automatiquement à chaque complétion ou ré-estimation.

### US10 — Capture depuis Gmail / notifications de suivi
> En tant qu'utilisateur, je veux transformer un email en tâche en un clic et recevoir des rappels sur mes tâches planifiées.

- Intégration Gmail : bouton "créer une tâche" depuis un email (titre = objet, lien vers l'email conservé). Notifications Android : rappel à J-1 d'une tâche planifiée, alerte hebdomadaire du backlog.
- **Critères d'acceptation** :
  1. Je crée une tâche depuis un email en 1 clic, avec le lien vers l'email.
  2. Je reçois une notification la veille d'une tâche planifiée.
  3. Je reçois un récap hebdomadaire (tâches terminées, vélocité, backlog restant).

### US11 — Rituels quotidiens : bilan du soir (21h) et revue du matin (7h)
> En tant qu'utilisateur, je veux recevoir un rappel le soir (21h) pour saisir mon temps passé et préparer les actions du lendemain, et un rappel le matin (7h) pour consulter le programme de la journée et l'ajuster.

- **Rappel du soir (21h, notification Android)** :
  - Saisie rapide du temps passé **et du temps restant estimé** sur les tâches du jour (US4), une par une.
  - Passage en "terminée" des tâches finies (temps restant saisi = 0).
  - Génération de la **liste des actions du lendemain** : tâches planifiées pour J+1 + suggestions issues du backlog (triées par priorité et vélocité disponible).
- **Rappel du matin (7h, notification Android)** :
  - Affichage du programme du jour (tâches planifiées, créneaux agenda, temps prévu vs disponible).
  - Ajustement possible : déplacer, replanifier, ajouter ou retirer des tâches avant de démarrer la journée.
- **Critères d'acceptation** :
  1. Je reçois une notification à 21h qui m'ouvre l'écran de saisie du temps passé et la proposition d'actions pour le lendemain.
  2. Je peux valider ou modifier la liste des actions du lendemain ; les tâches acceptées sont planifiées (état `planifiée`, date J+1).
  3. Je reçois une notification à 7h avec le programme du jour, que je peux ajuster en quelques interactions.
  4. Les heures de rappel (21h / 7h) sont paramétrables et peuvent être désactivées.
  5. La saisie du temps du soir alimente les statistiques (US2) et la vélocité (US7) sans autre action de ma part.

### US12 — Objectifs SMART avec contrôles de conformité
> En tant qu'utilisateur, je veux que mes objectifs soient structurés selon la méthode SMART, avec des contrôles automatiques qui me signalent les attributs manquants ou incohérents.

- **Règles** — chaque objectif porte 5 attributs :
  - **S — Spécifique** : formulation explicite du résultat attendu (texte obligatoire ; contrôle : longueur minimale + détection de formulation vague par mots-clés).
  - **M — Mesurable** : indicateur de réussite chiffré + unité (ex. « 100 % des murs peints », « courir 42 km ») ; contrôle : valeur numérique obligatoire.
  - **A — Atteignable** : **dérivé de la vélocité réelle observée (US7)** — plus de disponibilité hebdomadaire déclarée par objectif (décision de la passe d'usage 2 : l'utilisateur ne veut pas affecter de capacité de temps par objectif) ; contrôle : alerte si le restant de l'objectif dépasse ce que la vélocité permet de tenir avant l'échéance (vélocité × semaines restantes) ; tant que la vélocité n'est pas mesurable (moins de 2 jours de saisie), A est **indéterminé** et n'est pas signalé manquant.
  - **R — Réaliste / pertinent** : confirmation explicite de l'utilisateur (« objectif réaliste au vu de mes disponibilités ») + motivation rattachée ; contrôle : case obligatoire à la création.
  - **T — Temporel** : échéance cible obligatoire ; contrôle : date valide obligatoire + croisement avec la date de fin estimée (US7) → indicateur « à risque » si estimation > échéance.
- **Critères d'acceptation** :
  1. Je peux renseigner les 5 attributs SMART à la création d'un objectif (US13).
  2. Un **contrôleur SMART** affiche en temps réel un score de conformité (x/5) et liste les attributs manquants ou invalides.
  3. Un objectif non conforme (score < 5/5) est signalé par un badge dans la liste, mais reste enregistrable en brouillon.
  4. Les contrôles A et T se recalculent automatiquement quand les tâches, charges ou dates changent (couplage US4/US7).

### US13 — Pages de création et de détail/édition d'un objectif
> En tant qu'utilisateur, je veux une page de création d'objectif et pouvoir cliquer sur un objectif pour voir ses tâches liées, leur statut, et modifier l'objectif.

- **Écran 1 — Création d'objectif** :
  - Formulaire : titre, description spécifique (S), indicateur mesurable + unité (M), échéance cible (T), priorité P1–P4 (US5), confirmation « réaliste » (R), disponibilité hebdomadaire (heures/sem, alimente le contrôle A).
  - Le contrôleur SMART s'affiche en direct pendant la saisie ; création possible en brouillon même si incomplet.
  - Après création : ajout immédiat de tâches depuis la page (US3).
- **Écran 2 — Détail d'un objectif** (accessible en cliquant sur une carte objectif) :
  - En-tête : titre, badge SMART (score + attributs manquants), priorité, échéance cible, date de fin estimée (US7), indicateur « à risque », temps restant (US6).
  - Section SMART : les 5 attributs, éditables en place.
  - Section tâches liées : liste des tâches de l'objectif avec état (`à planifier` / `planifiée` / `en cours` / `terminée`), charge et temps restant ; ajout de tâche et changement d'état depuis cette vue (réutilise US1/US3/US4).
  - Section avancement : burndown de l'objectif (US9) et progression en %.
- **Critères d'acceptation** :
  1. Je crée un objectif via une page dédiée avec les 5 attributs SMART, avec contrôle de conformité en direct.
  2. Cliquer sur un objectif ouvre son détail avec toutes ses tâches et leur statut.
  3. Je peux modifier n'importe quel attribut de l'objectif depuis son détail (titre, SMART, priorité, échéance, disponibilité).
  4. Toute modification recalcule automatiquement charge, temps restant, date de fin estimée et contrôle SMART.
  5. Depuis le détail, je peux ajouter une tâche liée en ≤ 3 interactions.

### US14 — Connexion multi-compte Google
> En tant qu'utilisateur, je veux pouvoir choisir le compte Google avec lequel je me connecter et voir mes tâches, objectifs et vélocité associés à ce compte.

- **Règles** :
  - Authentification Google (OAuth) avec sélecteur de compte ; possibilité de changer de compte à tout moment (écran de paramètres ou bouton dédié).
  - Les données (objectifs, tâches, temps passés, statistiques, vélocité) sont **cloisonnées par compte** : jamais de mélange entre comptes.
  - La synchronisation agenda (US1/US8) s'effectue sur le calendrier du compte connecté.
- **Critères d'acceptation** :
  1. Je peux me connecter avec un compte Google de mon choix parmi les comptes disponibles sur l'appareil.
  2. Après connexion, je ne vois que les tâches, objectifs et vélocité du compte actif.
  3. Je peux changer de compte : les données affichées basculent intégralement sur l'autre compte sans re-saisie ni perte.
  4. Se déconnecter n'efface aucune donnée ; se reconnecter les retrouve à l'identique.

### US15 — Persistance et modélisation des données
> En tant qu'utilisateur, je veux que mes données soient persistantes et que la modélisation facilite les modifications et les migrations de données.

- **Règles** :
  - Toute donnée (objectifs, tâches, temps passés, paramètres) survit à la fermeture de l'application et au redémarrage de l'appareil.
  - Modélisation **versionnée** : schéma de données avec numéro de version explicite, identifiants stables, entités découplées (objectif, tâche, saisie de temps, compte) avec relations par référence plutôt que par imbrication, pour limiter l'impact d'une évolution.
  - Toute suppression logique plutôt que physique lorsque les données sont impliquées dans l'historique (temps passé, statistiques).
- **Critères d'acceptation** :
  1. Créer des données, fermer puis rouvrir l'application : tout est intact (objectifs, tâches, états, temps passés, préférences).
  2. Le schéma de données porte un numéro de version consultable et modifiable uniquement par migration.
  3. Aucune redondance de stockage d'une même information entre entités (une valeur calculée est dérivée, pas dupliquée en dur).
  4. La suppression d'un objectif propose un choix explicite (supprimer ou archiver ses tâches) sans perte de l'historique de temps passé.

### US16 — Migration automatique des données à chaque évolution
> En tant qu'utilisateur, je veux que pour toute nouvelle user story, si l'application contient des données, un script de migration soit joué pour les adapter au nouveau schéma.

- **Règles** :
  - Chaque évolution du schéma (nouvelle US modifiant la structure de données) est livrée avec un **script de migration** nommé et numéroté (ex. `v03_v04_ajout_attributs_smart`), s'exécutant automatiquement au lancement de l'application.
  - La migration compare la version du schéma stocké dans les données à la version courante et joue toutes les migrations intermédiaires dans l'ordre, en une seule transaction ; en cas d'échec, les données restent dans leur état d'origine (migration atomique, annulable).
  - Après migration, un contrôle d'intégrité vérifie que les données lues sont conformes au schéma attendu (cardinalités, champs obligatoires).
- **Critères d'acceptation** :
  1. Installer une mise à jour qui modifie le schéma sur un jeu de données existant : la migration s'exécute sans intervention de l'utilisateur et sans perte de données.
  2. Les migrations sont idempotentes et rejouables : une migration déjà appliquée ne s'applique pas deux fois.
  3. Une migration en échec laisse les données intactes et signale l'erreur à l'utilisateur sans bloquer l'ancienne version lisible des données.
  4. Chaque migration est documentée dans un **journal des migrations** : version de départ, version d'arrivée, transformations appliquées, date d'exécution.

### US17 — Application responsive
> En tant qu'utilisateur, je veux que l'application soit responsive, pour l'utiliser confortablement sur tous mes écrans.

- **Règles** :
  - Mise en page fluide sur smartphones (portrait/paysage), tablettes et écran de bureau / web (largeur minimale 320 px, jusqu'au desktop).
  - Tailles de police et zones de tap conformes aux bonnes pratiques d'accessibilité tactile (cible ≥ 44 px).
  - Les composants denses (backlog multi-colonnes, graphiques) s'adaptent : empilement vertical sur petits écrans, colonnes multiples sur grands écrans.
- **Critères d'acceptation** :
  1. Sur un smartphone en portrait (360 px), toutes les vues sont utilisables sans défilement horizontal et sans chevauchement.
  2. En paysage et sur tablette, les listes/graphiques utilisent mieux la largeur (colonnes additionnelles ou vues côte à côte) sans régression de lisibilité.
  3. Aucun élément interactif n'est rogné ni caché sur aucun des formats testés (360 px, 768 px, 1280 px).
  4. Les tailles de texte restent lisibles sur tous les formats (pas de troncature des libellés clés : états, priorités, heures).

### US18 — Binaire autoporteur et mise à jour (binaire + base de données)
> En tant qu'utilisateur, je veux un binaire/installateur full autoporteur (rien d'autre à installer) et un mécanisme de mise à jour pour les versions déjà installées, incluant la migration du binaire et de la base de données.

- **Règles** :
  - **Distribution PWA (décision utilisateur)** : le livrable est une **application web progressive (PWA) autoporteuse** — aucune dépendance à installer autre qu'un navigateur moderne ; installable sur Android **et sur PC** (bureau via le navigateur), déployable sur tout hébergement statique compatible HTTPS. Un empaquetage APK (ex. TWA) reste possible en option mais n'est pas le support principal.
  - Le paquet embarque tout le nécessaire : assets, manifeste d'installation, service worker ; aucune donnée externe requise au démarrage.
  - **Versionnage** : le binaire porte un numéro de version d'application (semantique : Majeure.Mineure.Corrective) distinct de la version de schéma de données (US15) ; la correspondance app ↔ schéma minimal requis est documentée dans le journal des migrations (US16/A5).
  - **Mise à jour** : déployer une nouvelle version puis recharger l'application préserve toutes les données ; le service worker sert la nouvelle version au prochain lancement et la migration de la base s'exécute alors automatiquement selon le mécanisme US16 (chaîne de migrations, idempotence, atomicité).
  - **Intégrité et sécurité** : l'application est servie exclusivement en HTTPS ; une mise à jour interrompue ou un chargement corrompu ne détruit pas les données existantes — l'ancienne version en cache (service worker) et ses données restent utilisables.
  - **Maintenance** : la procédure de build PWA (script reproductible, version, nommage) est documentée et rejouable à chaque livraison.
- **Critères d'acceptation** :
  1. Depuis un navigateur vierge (Android ou PC), l'installation de la PWA suffit : aucune autre dépendance à installer, l'application démarre et est utilisable immédiatement, y compris sur PC au besoin.
  2. Déployer une version supérieure puis recharger conserve toutes les données ; la migration binaire + base s'exécute automatiquement au premier lancement de la nouvelle version, sans intervention de l'utilisateur.
  3. Le numéro de version de l'application est visible dans l'application et la correspondance avec la version de schéma est consultable (journal des migrations).
  4. Une mise à jour interrompue ou un chargement corrompu ne détruit aucune donnée : la version précédemment en cache et ses données restent utilisables.
  5. La procédure de build documentée permet de régénérer un paquet équivalent (reproductibilité : même sources → même version, service worker et manifeste valides).

### US19 — Dépendances entre tâches, héritées au niveau de l'objectif
> En tant qu'utilisateur, je veux déclarer des dépendances entre mes tâches et voir ces dépendances héritées au niveau de l'objectif, pour qu'une tâche bloquante bloque aussi visuellement et prévisionnellement l'objectif qui en dépend.

- **Règles** :
  - **Dépendance de tâche** : « B dépend de A » signifie que B ne peut pas passer à `planifiée` ou `en cours` tant que A n'est pas `terminée`. Une tâche bloquée affiche la liste de ses prérequis non terminés (« bloquée par : A, C »).
  - **Aucun cycle** : une dépendance qui créerait une chaîne circulaire (directement ou transitivement) est refusée à la saisie avec un message explicite.
  - **Héritage à l'objectif** : les dépendances entre tâches de objectifs différents génèrent automatiquement une **dépendance héritée** entre objectifs — si une tâche de O2 dépend d'une tâche de O1, alors « O2 dépend de O1 ». Le détail d'un objectif affiche ses dépendances héritées (objectifs prérequis, nombre de liens, tâches concernées).
  - **Impact prévisionnel (US7)** : la date de fin estimée d'une tâche dépendante ne peut précéder la fin estimée de ses prérequis (fin estimée dépendante = max(fin estimée prérequis, aujourd'hui) + charge restante ÷ vélocité) ; l'objectif hérite de l'ensemble du chemin.
  - **Impact planification** : les tâches bloquées sont exclues des suggestions du rituel du soir (US11) et de la planification assistée (US8, V2).
  - **Cohérence des données** : la suppression d'une tâche prérequis propose de supprimer les liens dépendants ou d'annuler la suppression ; aucune dépendance « pendante » vers une tâche inexistante (contrôle d'intégrité US15/16).
  - **Schéma** : les dépendances sont stockées par référence (liste d'identifiants de tâches sur chaque tâche), introduites par une migration numérotée conformément à US16.
- **Critères d'acceptation** :
  1. Je peux ajouter et retirer une dépendance entre deux tâches depuis la fiche de la tâche.
  2. Une tâche dont un prérequis n'est pas terminé ne peut pas passer à `planifiée` ni `en cours` : le changement est refusé et les prérequis bloquants sont listés.
  3. Toute dépendance circulaire (directe ou transitive) est refusée à la saisie avec un message explicite.
  4. Le détail d'un objectif affiche les dépendances héritées de ses tâches (objectifs prérequis et nombre de liens) ; une modification de dépendance de tâche se répercute immédiatement.
  5. La date de fin estimée d'une tâche dépendante est postérieure ou égale à la fin estimée de chacun de ses prérequis ; l'indicateur « à risque » (US7/US12) en tient compte.
  6. Supprimer une tâche prérequis de tâches dépendantes déclenche un choix explicite (supprimer les liens ou annuler), sans jamais créer de référence pendante.
  7. Tant que l'estimation est indisponible (US7 : moins de 2 jours de saisie), les tâches dépendantes affichent « estimation en attente de prérequis » plutôt qu'une date erronée.

### US20 — Capacité par défaut et calendrier de charge (ajustement d'usage)

> En tant qu'utilisateur, je veux configurer ma capacité moyenne de travail par jour ouvré et par jour de week-end, et la visualiser sous forme de calendrier mensuel face à mon travail planifié, pour savoir d'un coup d'œil si mes journées et mon mois sont surchargés.

- **Règles** :
  - **Préférences** : deux valeurs configurables en heures (jour ouvré, jour de week-end), persistées avec les données applicatives (migration numérotée du schéma, conformément à US16). Valeurs par défaut : 6 h ouvré, 3 h week-end. Jour ouvré > 0, week-end ≥ 0 (contrôle d'intégrité).
  - **Capacité d'un jour** : la capacité appliquée à une date est celle du type de jour (samedi/dimanche = week-end).
  - **Charge planifiée d'un jour** : somme des temps restants des tâches actives non terminées planifiées à cette date réelle (libellés « aujourd'hui » / « demain » / jj/mm résolus en dates réelles).
  - **Calendrier** : vue mensuelle (lundi en première colonne), navigation mois précédent/suivant ; chaque case affiche la capacité du jour et la charge planifiée ; surcharge visible (avertissement) ; week-ends distingués ; jour courant mis en évidence ; total du mois capacité vs planifié.
  - **Écran Aujourd'hui** : le résumé du jour affiche le nombre de tâches prévues, le temps prévu, la capacité du jour et un indicateur de charge (plafonné à 100 %).
- **Critères d'acceptation** :
  1. Je peux saisir et enregistrer ma capacité moyenne pour les jours ouvrés et pour les jours de week-end ; les valeurs sont conservées au rechargement.
  2. Une valeur invalide (jour ouvré nul ou négatif, week-end négatif) est refusée avec un message explicite.
  3. Le calendrier affiche pour chaque jour sa capacité (week-ends avec la capacité week-end) et la charge des tâches planifiées ce jour-là.
  4. Un jour dont la charge dépasse la capacité est signalé visuellement comme surcharge.
  5. L'écran Aujourd'hui affiche le nombre de tâches prévues et le rapport prévu/capacité du jour (avec avertissement en cas de surcharge).

### US21 — Fait scientifique du jour dans le rituel (ajustement d'usage)

> En tant qu'utilisateur, je veux découvrir chaque jour dans mon rituel une information scientifique amusante différente, pour rendre le rituel plus attractif et donner envie d'y revenir.

- **Règles** :
  - **Corpus** : 100 faits scientifiques courts en français, recueillis à partir de sources en ligne (agences spatiales, muséums, universités, magazines scientifiques) et embarqués dans l'application.
  - **Tirage équilibré** : le fait affiché est tiré au hasard parmi ceux qui ont été le **moins affichés** depuis l'installation ; le nombre d'affichages de chaque fait est compté et persisté.
  - **Stabilité du jour** : le même fait est affiché toute la journée, quel que soit le nombre de consultations du rituel (matin et soir).
  - **Anti-répétition** : le fait du jour ne peut pas être le même que celui de la veille.
  - **Persistance autonome** : l'état (fait du jour + compteurs) est stocké séparément des données applicatives, sans impact sur le schéma versionné.
- **Critères d'acceptation** :
  1. Le rituel (vues du soir et du matin) affiche une carte « le saviez-vous ? » avec un fait scientifique amusant issu d'un corpus d'au moins 100 éléments.
  2. Le même fait reste affiché toute la journée.
  3. Deux journées consécutives n'affichent jamais le même fait.
  4. Chaque fait affiche son compteur d'affichages ; les faits les moins affichés sont prioritaires au tirage.
  5. Sur une longue période simulée, les compteurs restent équilibrés (aucun fait systématiquement privilégié).

### US22 — Journal d'activité par lots, pour le diagnostic MCO

> En tant qu'agent MCO (ou utilisateur lui transmettant un lot), je veux que l'activité de l'application soit tracée de façon horodatée et regroupée en lots quotidiens consultables et exportables, pour repérer et analyser les bugs pendant l'usage réel.

- **Règles** :
  - **Événement tracé** : { at : horodatage ISO local **précis à la seconde**, type, message, contexte } ; l'horodatage est celui du moment de l'événement (pas de l'écriture).
  - **Catalogue v1 des événements tracés** : démarrage de l'application (version app, version de schéma, migrations appliquées, résultat du contrôle d'intégrité, compte actif ou données locales) ; connexion / déconnexion de compte ; synchronisation agenda (les entrées du journal US1 existant sont **reprises à l'export, pas dupliquées**) ; création / modification / suppression logique de tâche ou d'objectif ; changement d'état d'une tâche ; saisie de temps ; planification / déplanification ; modification des préférences de capacité ; remplacement complet des données de l'espace actif (rechargement de la démo, import ou remise à zéro — US23) ; changement de jour détecté ; **erreur attrapée** (données stockées invalides, refus d'intégrité, exception) avec son message.
  - **Lots** : un lot = les événements d'une **journée locale** (identifiant du lot = date ISO yyyy-mm-dd) ; au changement de jour, les événements basculent dans un nouveau lot ; **rotation : les 30 derniers lots sont conservés**, les plus anciens sont supprimés.
  - **Stockage autonome hors schéma** (précédent US21 des faits) : clé `objectifs-app-journal`, **cloisonnée par compte** (`objectifs-app-journal::<id>` si un compte est connecté, cohérent avec US14) ; jamais soumis au contrôle d'intégrité des données métier ; toute erreur de lecture/écriture du journal est **silencieuse** — le journal ne peut jamais bloquer ni altérer l'application, c'est sa raison d'être MCO.
  - **Confidentialité** : aucun secret dans les traces (pas de jeton OAuth ni de données d'authentification) ; contenu limité aux identifiants, titres, états, dénombrements et messages d'erreur.
  - **Consultation** : écran « Journal » dédié : liste des lots par date (volume, nombre d'erreurs), événements du lot sélectionné en ordre chronologique, erreurs mises en évidence.
  - **Export MCO** : chaque lot est exportable en un clic en JSON conforme à un **format documenté et stable** : en-tête de contexte (version app, version de schéma, plateforme, espace actif — compte ou local —, dates bornes du lot) + **reprise des journaux existants sans duplication (migrations US16, synchronisation agenda US1)** + liste des événements ; l'export est destiné à être fourni à un agent MCO (IA ou humain) pour analyse — l'analyse elle-même reste hors périmètre de l'application. *(Précision apportée en recette itération 5 : les journaux existants voyagent dans une section dédiée `journauxExistants` de l'export — additive, donc stable pour tout consommateur du format.)*
- **Critères d'acceptation** :
  1. Chaque événement du catalogue est journalisé horodaté à la seconde près dans le lot du jour courant (ex. : créer une tâche → événement « tâche créée » visible avec son horodatage).
  2. Au changement de jour, les événements basculent dans un nouveau lot ; les lots passés restent consultables par date ; la rotation ne conserve que les 30 derniers lots.
  3. Une erreur (données invalides au chargement, refus d'intégrité, exception attrapée) est tracée avec son message et mise en évidence dans l'écran du lot.
  4. Un lot est exportable en un clic en JSON conforme au format documenté (en-tête de contexte + événements), copiable pour analyse externe.
  5. Le journal est cloisonné par compte (US14) ; une écriture ou lecture du journal ne modifie jamais les données métier et ne peut pas déclencher leur réinitialisation (échec silencieux).
  6. Le traçage n'altère pas le comportement fonctionnel : la suite de tests développeur existante reste intégralement passante avec le journal actif.

### US23 — Export, import et remise à zéro des données (portabilité)

> En tant qu'utilisateur, je veux exporter toutes mes données applicatives dans un JSON portable, les importer dans une autre installation (maquette → livrable réel, nouvel appareil), et remettre l'espace actif à zéro proprement, afin que mes données m'appartiennent et survivent au changement de support sans perte.

- **Écran concerné** : Google — nouvelle section « Vos données — sauvegarde et portabilité » (cet écran gère déjà l'espace de stockage : compte connecté ou local, cloisonnement US14) ; le bouton « ↺ Démo » de l'en-tête reste inchangé et distinct.
- **Règles** :
  - **Export** : en un clic, JSON copiable dans le presse-papiers (même mécanique que l'export journal US22) au format documenté et stable `objectifs-donnees-v1` : en-tête de contexte (application, version app, version de schéma, espace actif — compte ou local —, date d'export) + données applicatives complètes de l'espace actif (préférences, objectifs, tâches, saisies, agenda, journal des migrations), **compte connecté exclu** (donnée de session, re-résolue à l'import selon l'espace actif).
  - **Import** : le JSON collé est contrôlé (format reconnu), **migré par le mécanisme US16** si sa version de schéma est antérieure (chaîne de migrations, journal des migrations alimenté), puis **validé par le contrôle d'intégrité** ; en cas de succès, il **remplace intégralement l'espace actif** et les recalculs en cascade s'exécutent (backlog, temps restant, vélocité, SMART, burndown) ; un export de sécurité des données courantes est proposé avant remplacement.
  - **Refus propre** : JSON illisible, format non reconnu, version de schéma **supérieure** à la version courante, ou contrôle d'intégrité en échec → message explicite, **aucune modification** des données courantes.
  - **Remise à zéro** : « Vider l'espace » (double confirmation, export de sécurité proposé avant) → état vide conforme : zéro objectif, zéro tâche, zéro saisie, vélocité nulle, **intégrité passante** ; distinct du « ↺ Démo » qui charge le jeu de démonstration.
  - **Cloisonnement et traçage** : export, import et remise à zéro agissent sur **l'espace actif uniquement** (US14) ; les autres espaces et le journal d'activité (US22) ne sont jamais touchés ; chaque opération est tracée au journal d'activité (type `donnees`, catalogue US22).
- **Critères d'acceptation** :
  1. L'export produit en un clic un JSON `objectifs-donnees-v1` copiable contenant l'intégralité des données de l'espace actif (compte exclu) ; un aller-retour export → import sur un espace vierge restitue l'état complet à l'identique (recalculs inclus).
  2. Un import de données à version de schéma antérieure est migré (chaîne US16, journal des migrations alimenté) puis validé par le contrôle d'intégrité **avant** remplacement de l'espace actif.
  3. Un JSON invalide, de format non reconnu, de version de schéma supérieure à la version courante, ou refusé par le contrôle d'intégrité est rejeté avec un message explicite, sans aucune modification des données courantes.
  4. « Vider l'espace » (double confirmation) produit un état vide conforme (0 objectif, 0 tâche, 0 saisie, vélocité nulle, intégrité passante) ; « ↺ Démo » reste disponible et distinct.
  5. Les trois opérations agissent sur l'espace actif uniquement, ne touchent ni les autres espaces ni le journal US22, et sont tracées au journal d'activité (type `donnees`).
  6. La suite de tests développeur existante reste intégralement passante avec l'export/import actifs.

---

## Revue conjointe développeur / analyste — Priorisation MVP

*Issue de la revue entre l'agent développeur et l'agent analyste métier. Les raffinements ci-dessus (formule US4, amorçage vélocité US7, journal des migrations US16) en découlent.*

### Corrections et raffinements apportés au document

1. Suppression de l'en-tête obsolète « US proposées » (US8–US10 sont adoptées).
2. **US4** : formule explicite de la charge restante et règle de recalage lors d'une ré-estimation (ambiguïté levée : « il me reste X » redéfinit le restant, pas l'estimé initial).
3. **US7** : règle d'amorçage de la vélocité (moins de 3 semaines d'historique) — sans elle, la date de fin estimée est incalculable au démarrage.
4. **US16** : le journal des migrations remplace la référence floue « au développeur » ; critère rendu testable.
5. **US3** : la saisie en langage naturel est **supprimée** au profit d'un formulaire simple à champs dédiés (décision utilisateur) ; critère 2 reformulé en conséquence.
6. **Dépendance identifiée** : le contrôle « A — Atteignable » de l'US12 exige la disponibilité hebdomadaire saisie à la création d'objectif (US13) → US13 doit être développée avant ou avec US12.

### Découpage MVP / V2

**Socle technique (avant toute US fonctionnelle)**
| US | Raison |
|---|---|
| US15 — Persistance & modélisation | Sans persistance, rien n'est testable dans la durée ; le schéma versionné conditionne toutes les migrations futures |
| US16 — Migrations | Mécanisme à mettre en place dès la 1ʳᵉ version pour ne jamais rattraper l'arriéré |
| US17 — Responsive | Grille et navigation posées dès le départ, moins coûteux que de reprendre tous les écrans après coup |

**MVP — Itération 1 : cœur tâches** (US3, US4, US5)
Saisie rapide, charges/temps passé, priorisation. Le tri du backlog et les formules sont l'ossature de tout le reste.

**MVP — Itération 2 : vies d'objectif et tâche, livrable installable** (US13, US12, US6, US7, US18 + anomalies de la recette itération 1)

*Revue conjointe analyste/développeur du périmètre : l'US18 arrive en fin d'itération, une fois les fonctionnalités stabilisées — packager avant fige le schéma et multiplie les migrations d'artefact. Ordre de développement :*

1. **US13 — Création + détail/édition d'objectif**, en couvrant au passage **A2** (agrégats par objectif : charge totale, temps passé) et **A4** (suppression d'objectif avec choix supprimer/archiver).
2. **US12 — SMART et contrôleur** (dépend de la disponibilité hebdomadaire saisie en US13), avec **A6** (date planifiée visible sur petits écrans, retouches responsive du nouvel écran détail).
3. **US6 + US7 — Temps restant, vélocité progressive (estimation dès le 2ᵉ jour de saisie), date de fin estimée et indicateur « à risque »**, avec **A3** (indicateur de fiabilité d'estimation : dérive moyenne entre estimé initial et estimé recalé).
4. **US18 — Binaire autoporteur + mise à jour** : build du paquet unique signé, versionnage app ↔ schéma, procédure de mise à jour sur installation existante (bascule sur le mécanisme US16 pour la base), en clôturant **A5** (journal des migrations persistant, consultable — nécessaire au critère 3 de l'US18).

**Anomalies reportées à l'itération 2** (issues de la recette métier du socle + itération 1) :
- **A2 — US4** : afficher la charge totale et le temps passé agrégés par objectif (naturellement portés par l'écran détail US13).
- **A3 — US4** : indicateur de fiabilité d'estimation agrégé (dérive moyenne entre estimé initial et estimé recalé), en plus de l'affichage par tâche.
- **A4 — US15** : suppression d'objectif avec choix explicite (supprimer ou archiver ses tâches), sans perte de l'historique de temps passé (à couvrir avec US13).
- **A5 — US16** : journal des migrations persistant (version de départ, version d'arrivée, transformations, date d'exécution), consultable, en plus de la bannière éphémère.
- **A6 — US17/US1** : la date planifiée doit rester visible sur petits écrans (< 640 px), p. ex. en seconde ligne de la carte tâche.

### Recette métier — Itération 2 (verdicts et anomalies)

**Verdicts** : US12 **validée** · US6 **validée avec réserves** (R1) · US7 **validée avec réserves** (R2) · US13 **validée après correction A7/A8** (re-recette : critères 1–5 tous conformes, priorité et titre modifiables depuis le détail, navigation directe vers le détail après création) · US18 **non testable sur maquette** pour les critères de packaging (1, 4, 5) — critère 3 validé, packaging réel à recetter au livrable PWA · A2, A3, A4, A5, A6 **toutes corrigées et validées**.

**Anomalies A7 et A8 : corrigées par le développeur et re-validées en recette** (tests A7/A8 : 15/15 passants, dont 5 de régression du cœur métier ; régression US5 critère 1 soldée — la priorité d'objectif est désormais modifiable depuis le détail conformément aux règles US5).

**Anomalies relevées en première passe (corrigées puis re-validées)** :
- **A7 — US13 critère 3 / US5 critère 1 (majeure)** : depuis l'écran de détail d'un objectif, le **titre** et la **priorité P1–P4** ne sont pas modifiables. Critères testables attendus : (a) depuis le détail, je peux modifier le titre et constater le recalcul en cascade ; (b) depuis le détail, je peux changer la priorité P1–P4 (cycle ou sélecteur) et la liste d'objectifs se re-trie selon la nouvelle priorité ; (c) modification sans perte des autres attributs SMART.
- **A8 — US13 écran 1 (mineure)** : après création d'un objectif, l'app revient à la liste au lieu d'ouvrir le détail pour l'ajout immédiat de tâches (« Après création : ajout immédiat de tâches depuis la page »). Correction : naviguer vers le détail de l'objectif créé.

**Réserves (mineures, correction ultérieure ou arbitrage V2)** :
- **R1 — US6** : la conversion du temps restant en jours ouvrés (1 jour ≈ 7 h, paramétrable) n'est pas couverte — règle optionnelle (« si souhaité »), à arbitrer pour la V2.
- **R2 — US7 critère 3** : au niveau tâche, la date planifiée et la durée restante sont affichées mais pas de date de fin calculée par tâche.
- **Observation hors périmètre (US2, itération 3)** : le commutateur jour/semaine/mois de l'écran Stats ne modifie pas encore l'agrégation du graphique.

*Risques techniques relevés par le développeur pour l'US18 : la signature du paquet et la procédure de mise à jour over-the-air dépendent du support final (APK direct vs store) — arbitrage à demander à l'utilisateur au lancement de l'étape 4 ; le numéro de version d'application et la version de schéma restent distincts pour ne pas coupler la cadence de livraison au schéma de données.*

**MVP — Itération 3 : suivi, rituels et dépendances** (US1 sans sync agenda, US2, US11, US9, **US19**)

*Revue conjointe analyste/développeur : l'US19 (dépendances entre tâches, héritées à l'objectif) est placée en itération 3, après l'itération 2, car son impact prévisionnel s'appuie sur la logique de date de fin estimée de l'US7 et son interface de gestion sur l'écran de détail de l'US13 — toutes deux livrées en itération 2. Elle introduit une migration de schéma (v03 → v04 : références de dépendances, date réelle de complétion, suppression logique des tâches), ce qui a constitué la première mise en œuvre réelle du processus US16/US18 (migration base + livrable). Vue tâches/états, statistiques, rituels 21h/7h avec notifications locales, burndown par objectif.*

### Recette métier — Itération 3 (verdicts et anomalies)

**Verdicts** : US19 **validée après correction A9/A10** (re-recette : 7/7 critères conformes — bloquage effectif des transitions et de la saisie, cycles refusés, héritage affiché avec tâches concernées, fins héritées prises en compte dans l'indicateur « à risque », suppressions sans référence pendante) · US2 **validée après correction A9** (3/3 — agrégation réelle jour/semaine/mois, tâches comptées à leur date réelle de complétion, y compris depuis le détail) · US11 **validée après correction A11** (5/5 sur maquette — les notifications Android réelles restent à recetter sur le livrable PWA) · US9 **validée** (3/3 — burndown réel + ligne théorique jusqu'à l'échéance, recalcul automatique) · US1 **validée sur son périmètre d'itération** (critères 1 et 3 conformes ; critère 2 — synchronisation agenda — hors périmètre, reporté à l'itération 4 conformément au découpage). Suite de tests développeur de re-recette : **34/34 passants** (migrations, saisies, SMART, vélocité, fiabilité, dépendances et fins héritées, suppressions logiques, rituel, stats, burndown, + corrections A9–A11).

**Anomalies relevées en première passe (corrigées par le développeur puis re-validées en recette)** :
- **A9 — US2 critère 3 / US19 (majeure)** : la complétion d'une tâche depuis le détail d'objectif ne posait pas de date réelle de complétion (la tâche n'était jamais comptée dans les statistiques) et ignorait les prérequis (une tâche bloquée pouvait être terminée en un clic). Critères testables attendus : (a) compléter depuis le détail pose la date de complétion et la tâche est comptée dans les statistiques à cette date ; (b) compléter une tâche bloquée depuis le détail est refusé et les prérequis bloquants sont listés. → corrigé et vérifié.
- **A10 — US19 (mineure)** : le détail d'objectif affichait les dépendances héritées (objectif prérequis, nombre de liens) mais pas les tâches concernées prévues par la règle. → corrigé : le badge liste les tâches concernées.
- **A11 — US11 critère 4 / US15 critère 1 (mineure)** : les heures de rappel et les interrupteurs de notification n'étaient pas conservés au rechargement. → corrigé : préférences persistées, les onglets du rituel affichent l'heure configurée.

**Réserves** :
- **R3 — US9 (mineure, arbitrage V2)** : la courbe « réelle » du burndown ne descend qu'avec les saisies de temps (recalage US4) ; une complétion sans saisie ne la fait pas évoluer. À arbitrer : adosser la courbe au restant des tâches ou conserver la logique « recalage à la saisie ».
- R1 (conversion jours ouvrés) et R2 (date de fin estimée par tâche — désormais affichée pour les tâches à dépendances) restent posées pour la V2.
- L'observation US2 de la recette itération 2 est soldée : le commutateur jour/semaine/mois alimente désormais l'agrégation réelle du graphique.

**Corrections préventives du développeur consignées lors de la recette** : cloisonnement du restant par objectif dans le contrôleur SMART (les vues liste/accueil cumulaient le restant de tous les objectifs) ; suppression d'objectif réécrite en suppression logique (l'ancien mécanisme générait des saisies orphelines qui provoquaient une réinitialisation des données au rechargement) ; restauration du corps de la migration v02_v03 endommagé dans la maquette.

**Ajustements issus de la passe d'usage réel (après l'itération 3)** :
Passe d'usage menée sur la maquette avec l'utilisateur. Décisions : (a) ergonomie mobile — onglets déplacés **en haut** de l'écran (barre dégradée, style « pills ») et zone basse réservée aux soft buttons Android (marge de sécurité système) ; (b) esthétique éclaircie et colorée (dégradés, teintes pastel) ; (c) navigation — les objectifs de l'écran Aujourd'hui sont cliquables et ouvrent leur détail ; (d) résumé du travail planifié sur l'écran Aujourd'hui (nombre de tâches, prévu vs capacité) ; (e) deux capacités moyennes par défaut configurables — jour ouvré / jour de week-end — et nouvel écran Calendrier de charge mensuel (**US20**, schéma v03 → v04 des dépendances suivi d'une migration **v04 → v05 « preferences_capacite »**) ; (f) fait scientifique amusant du jour dans le rituel, corpus de 100 faits recueillis en ligne, compteur d'affichages persisté, tirage parmi les moins affichés (**US21**, stockage autonome hors schéma). Ces ajustements sont recettables comme les US standard (critères listés dans les fiches US20/US21).

**Recette métier — passe d'usage réel (US20/US21)** :
Conduite sur la maquette v0.4.0 (schéma v5), données de démonstration, après rapport de tests développeur **69/69 passants**. Déroulé : parcours des 10 critères d'acceptation, scénarios bout-en-bout (configuration des capacités → calendrier → accueil ; consultation du rituel soir puis matin même jour, puis le lendemain ; simulation de 250 journées), tests des limites (capacité week-end nulle, surcharge, objectif archivé).

*Verdicts par critère* :
| Critère | Preuve observée | Verdict |
|---|---|---|
| US20-1 (saisie/enregistrement/rechargement) | 7 h/4 h enregistrés, conservés dans les données applicatives v5 et restaurés au rechargement (contrôle d'intégrité v5 conforme) | Conforme |
| US20-2 (valeurs invalides) | vide, « abc », −1, 0 en jour ouvré, −2 en week-end : refusés avec message, préférences intactes | Conforme |
| US20-3 (calendrier capacité + charge) | Octobre 2026 : 22 jours ouvrés × 6 h + 9 week-ends × 3 h = 159 h ; charge 13/10 = 4 h (2 tâches), 14/10 = 2 h, tâche terminée exclue, total mois 6 h | Conforme |
| US20-4 (surcharge visible) | Tâche de 8 h le samedi 17/10 (capacité 3 h) : jour signalé ⚠ ; le total du mois (14 h ≤ 159 h) reste sans alerte — cohérent, le critère porte sur le jour | Conforme |
| US20-5 (résumé accueil) | Démo : « 2 tâches · 4 h sur 6 h · 67 % » sans alerte ; scénario 9 h/6 h : barre plafonnée 100 % + « ⚠ surcharge » | Conforme |
| US21-1 (carte + corpus ≥ 100) | Carte « 🧪 Le saviez-vous ? » présente dans les vues soir **et** matin du rituel, corpus de 100 faits, compteur affiché | Conforme |
| US21-2 (même fait toute la journée) | Deux montages du rituel le même jour : même fait, compteur non incrémenté | Conforme |
| US21-3 (jamais deux jours de suite) | 13/10 → 14/10 : faits différents ; garanti par construction (exclusion du fait de la veille du tirage) et vérifié sur 250 journées | Conforme |
| US21-4 (moins affichés prioritaires) | Un fait affiché 5 fois face à d'autres jamais affichés : jamais retenu sur 30 tirages | Conforme |
| US21-5 (équilibrage longue période) | 250 journées simulées : chaque fait tiré 2 ou 3 fois (écart ≤ 1), total 250, aucune répétition consécutive | Conforme |

*Tests des limites* : capacité week-end = 0 un samedi avec 4 h planifiées — pas de division par zéro, barre à 0 %, jour signalé en surcharge (garde-fou conforme au critère 2 : week-end ≥ 0 autorisé) ; la surcharge d'un jour ne déclenche l'alerte du mois que si le mois lui-même est surchargé (cohérent avec le critère 4).

**Verdicts** : US20 **validée** (5/5) · US21 **validée** (5/5). **Aucune anomalie relevée** (ni bloquante, ni majeure, ni mineure).

**Réserves (à arbitrer en V2)** :
- **R4 — US20 (mineure)** : les tâches des objectifs **archivés** comptent encore dans la charge du calendrier, alors que l'accueil et le contrôleur SMART les ignorent. Arbitrage à trancher : exclure les tâches des objectifs archivés du calendrier, ou les distinguer visuellement.
- **R5 — US21 (mineure, précision de règle)** : le compteur « déjà affiché N fois » compte les **journées** où le fait a été le fait du jour (et non le nombre de consultations du rituel dans la journée). Ce choix garantit l'équilibrage du critère 5 ; interprétation consignée comme référence pour le critère 4.

**Conclusion** : la passe d'usage réel est soldée. US20 et US21 rejoignent le périmètre validé (itérations 1–3 + passe d'usage réel) ; suite logique : **MVP — Itération 4 : intégration Google** (US14 réduit, US1 sync agenda).

**MVP — Itération 4 : intégration Google** (US14 réduit, US1 sync agenda)
Connexion à **un seul compte Google** avec cloisonnement des données par compte (le schéma du socle prévoit `account_id` dès le départ pour ne pas migrer plus tard), synchronisation des tâches planifiées vers Google Agenda.

*Revue conjointe analyste/développeur du périmètre (avant développement) : comme pour l'US18 (packaging) et l'US11 (notifications Android), l'authentification OAuth réelle et l'appel à l'API Google Agenda ne sont pas exécutables dans la maquette. La connexion et la synchronisation y sont donc simulées fidèlement — compte saisissable, cloisonnement réel du stockage par compte, événements et journal de synchronisation dérivés des tâches — l'OAuth réel restant à recetter sur le livrable PWA. Le compte actif est porté par les données applicatives (identifiant de compte au schéma, migration numérotée `v05_v06_compte_google` conformément à US16). Raffinement en critères testables :*

**US14 réduit — Compte Google unique (raffinement itération 4)**
> En tant qu'utilisateur, je veux connecter mon compte Google pour que mes données soient rattachées à ce compte et cloisonnées, sans jamais mélanger les espaces.

- **Critères d'acceptation** :
  1. Je peux « me connecter » avec une adresse Google valide (simulation d'OAuth : adresse + nom) ; une adresse invalide (vide, sans @, mal formée) est refusée avec un message.
  2. Une fois connecté, le compte actif est visible dans l'application (en-tête/écran dédié) et les données sont enregistrées dans l'espace de stockage du compte (cloisonnement par identifiant de compte).
  3. Me déconnecter n'efface aucune donnée : me reconnecter avec le même compte retrouve les données à l'identique.
  4. Connecter un autre compte ne montre ni ne mélange jamais les données du premier ; chaque espace évolue séparément (un nouveau compte démarre sur l'état local courant).
  5. L'authentification OAuth réelle n'est pas testable sur maquette — à recetter sur le livrable PWA.

**US1 critère 2 — Synchronisation agenda (clôture du report de l'itération 3)**
> En tant qu'utilisateur, je veux que mes tâches planifiées apparaissent dans mon Google Agenda et que l'événement suive la vie de la tâche.

- **Règles** : la synchronisation s'effectue sur le calendrier du compte connecté (refus explicite sans compte connecté) ; une tâche planifiée active = un événement agenda (titre de la tâche, date réelle résolue, charge restante) ; l'événement est mis à jour si la date de la tâche change (les libellés « aujourd'hui »/« demain » sont résolus au jour réel à chaque synchronisation) ; l'événement est retiré si la tâche est terminée, supprimée ou déplanifiée ; chaque opération est journalisée (créé / mis à jour / retiré, horodatée) ; la date de dernière synchronisation est consultable.
- **Critères d'acceptation** :
  1. Sans compte connecté, la synchronisation est refusée avec un message explicite.
  2. Après connexion, « Synchroniser » crée un événement pour chaque tâche planifiée ; une re-synchronisation immédiate ne crée ni ne modifie rien (état stable).
  3. Changer la date d'une tâche puis synchroniser met à jour l'événement (journal « mis à jour »).
  4. Terminer, supprimer ou déplanifier une tâche puis synchroniser retire son événement (journal « retiré »).
  5. L'écran de synchronisation montre pour chaque tâche planifiée son état (à jour / à synchroniser / nouvelle), la date de dernière synchronisation et le journal des opérations.

### Recette métier — Itération 4 (verdicts et réserves)

Conduite sur la maquette v0.5.0 (schéma v6), après rapport de tests développeur **39/39 passants** (migrations v1→v6, intégrité v6 avec portes de version, compte Google, synchronisation agenda, régressions clés US19/US20/US21). Déroulé : parcours des critères testables des deux fiches, scénarios bout-en-bout rejoués avec un stockage local simulé pour les flux de connexion/déconnexion (12/12 conformes), tests des limites (adresses invalides, sync sans compte, jour roulant, intégrité des espaces après bascules multi-comptes).

*Verdicts par critère* :
| Critère | Preuve observée | Verdict |
|---|---|---|
| US14-1 (connexion valide/invalides) | « pas-un-email », « a@b » : refusés avec message « Adresse Google invalide… », aucun compte créé ; adresse avec espaces/casse → connecté, identifiant normalisé (minuscules, trimé) | Conforme |
| US14-2 (compte visible + cloisonnement) | Badge 👤 du compte dans l'en-tête + écran dédié ; les écritures vont dans la clé `objectifs-app-data::<id>`, la clé locale ne reçoit jamais les données d'un compte connecté | Conforme |
| US14-3 (déconnexion sans perte) | Déconnexion → retour à l'état local d'avant connexion ; l'espace du compte reste intact ; reconnexion → données retrouvées à l'identique (événements, journal, lastSync) | Conforme |
| US14-4 (second compte sans mélange) | Compte B démarre sur l'état local courant, évolue séparément (t5 terminée dans B) ; espace A intact (t5 active, 3 événements) ; chaque espace retrouvé à la reconnexion | Conforme |
| US14-5 (OAuth réel) | Non testable sur maquette (simulation fidèle consignée en revue conjointe) | À recetter sur le livrable PWA |
| US1-c2-1 (refus sans compte) | « Connectez un compte Google pour synchroniser l'agenda. », données strictement inchangées | Conforme |
| US1-c2-2 (création + stabilité) | 1ʳᵉ sync : 3 créés (t2, t5, t8 ; t1 terminée exclue), statuts « nouvelle » → « à jour » ; re-sync immédiate : 0 créé, 0 maj, 0 retiré | Conforme |
| US1-c2-3 (maj au changement de date) | t2 → 20/10 : statut « à synchroniser », puis 1 maj journalisée, événement déplacé au 2026-10-20 | Conforme |
| US1-c2-4 (retraits) | Terminer t5, déplanifier t8, supprimer t2 : 3 retraits journalisés, plus aucun événement résiduel | Conforme |
| US1-c2-5 (écran de synchronisation) | Statut par tâche planifiée, « Dernière synchro : 2026-10-13 à 10:00 », journal des 6 dernières opérations (créé/mis à jour/retiré, horodaté) | Conforme |
| Règle US1-c2 (libellés roulants) | Sync le 13/10 puis le 14/10 : 3 maj — « aujourd'hui » → 14/10, « demain » → 15/10 (résolution au jour réel à chaque sync) | Conforme |
| Intégrité des espaces | Les 3 espaces persistés (local + 2 comptes) passent le contrôle d'intégrité après toutes les bascules | Conforme |

**Anomalies** : **aucune** (ni bloquante, ni majeure, ni mineure). Trois échecs initiaux de la suite développeur (événement orphelin, jour roulant, test de cycle) ont été diagnostiqués comme défauts du **harnais de tests** (attentes mal construites) et corrigés côté tests — aucun défaut de code n'a été relevé.

**Réserves (à arbitrer en V2 ou micro-corriger au prochain passage)** :
- **R6 — US1-c2-1 (mineure, cosmétique)** : sans compte connecté, le bouton « Synchroniser » est désactivé alors que le texte de l'écran évoque un « message explicite au clic » (impossible du fait du désactivation). Le refus explicite existe bien au niveau métier (message « Connectez un compte Google… », testé) et un texte statique l'explique à l'écran ; micro-corrrection recommandée : activer le bouton pour afficher le refus au clic, ou reformuler le texte.
- R4 (tâches d'objectifs archivés dans le calendrier) et R5 (compteur du fait du jour = journées) restent posées.

**Conclusion** : l'itération 4 est soldée. **US14 réduit validée** (4/4 critères testables, OAuth réel reporté au livrable PWA) · **US1 critère 2 validé** (5/5 + règle des libellés roulants) — le report de l'itération 3 est soldé, l'US1 est désormais **validée sur l'ensemble de ses critères**. Le périmètre MVP (itérations 1–4 + passe d'usage réel) est développé et recetté ; restent pour accepter le MVP : la recette OAuth/API Calendar sur le livrable PWA (US14-5) et **l'usage réel de 2 semaines sans perte de données ni migration en échec** (critère de sortie).

**Ajustements d'usage — passe 2 (après l'itération 4, avant le développement de l'US22)**

Quatre demandes de l'utilisateur, raffinées en règles et critères testables, implémentées dans la maquette **v0.6.0** (schéma v6 inchangé — le champ `disponibilite` des données existantes est toléré et ignoré, aucune migration nécessaire, il disparaîtra à la prochaine migration) :

1. **Suppression de la capacité de temps par semaine affectée à un objectif** — le champ « disponibilité (h/semaine) » disparaît de la création, de l'édition et du contrôleur SMART (US12). Le critère **A — Atteignable** est désormais dérivé de la **vélocité réelle observée** (US7) : alerte si restant > vélocité × semaines restantes avant l'échéance ; indéterminé (non signalé) tant que la vélocité n'est pas mesurable. Critères : (a) plus aucun champ de disponibilité napparaît à la création/édition ; (b) A est signalé manquant uniquement quand le restant dépasse la capacité dérivée de la vélocité ; (c) sans vélocité mesurable, A n'est jamais signalé.
2. **Bouton « Créer un objectif » plus identifiable** — bouton pleine largeur en dégradé indigo→violet, gras, avec ombre, en tête de liste des objectifs. Critère : le bouton est visuellement dominant dans l'écran Objectifs.
3. **Complétion = saisie obligatoire du temps passé ajusté** (règle ajoutée à US4, critère 6) — le passage à « terminée » (écran Tâches comme détail d'objectif) ouvre une clôture : saisie du **temps passé total ajusté** obligatoire (≥ temps déjà logué, suggestion pré-remplie) ; restant → 0, date réelle posée, saisie journalisée ; annulable sans complétion ; tâche bloquée refusée. Le rituel du soir est déjà conforme (sa saisie à deux champs couvre la clôture quand le restant atteint 0).
4. **Historique du temps logué par tâche et par jour** (règle ajoutée à US4, critère 7) — nouvelle carte « Historique du temps logué » dans l'écran Statistiques, commutateur **Par jour** (groupement décroissant, saisies détaillées, total du jour) / **Par tâche** (saisies datées, total par tâche).

**Passe 3 (à la suite, avant le développement de l'US22)** — deux demandes supplémentaires de l'utilisateur, implémentées dans la maquette **v0.7.0** (schéma **v7**, migration numérotée `v06_v07_historique_etats` conformément à US16) :

5. **Regroupement des tâches par statut dans l'écran Tâches** (règle et critère 4 ajoutés à US1) — groupes par état dans l'ordre du cycle de vie (`à planifier` → `Planifiées` → `En cours` → `Terminées`), intitulé et compte par groupe, groupes vides non affichés, tri interne inchangé (US5), filtres par état et par objectif fonctionnels à l'intérieur des groupes (un filtre d'état n'affiche que le groupe correspondant).
6. **Historisation de la date de changement de statut** (règle et critère 5 ajoutés à US1) — journal des changements d'état datés au jour réel, porté par chaque tâche ; invariant d'intégrité : l'état courant correspond toujours à la dernière entrée ; consultation sur la fiche de la tâche (écran Tâches) et date du dernier changement visible sur chaque rangée ; données v6 migrées automatiquement (amorçage : état courant daté de la date de fin réelle si la tâche est terminée, sinon de la date de migration). La migration `v06_v07` nettoie au passage le champ `disponibilite` résiduel des objectifs v6, tenant la promesse de la passe 2 (« disparaîtra à la prochaine migration »).

### Recette métier — Ajustements d'usage (passe 2 et passe 3)

Conduite sur la maquette **v0.7.0** (schéma v7), après rapport de tests développeur **38/38 passants** (suite miroir : SMART/A-vélocité, clôture obligatoire, historiques de saisies groupés, regroupement par état, journal des changements d'état, migration v6→v7 avec invariant « dernière entrée = état courant », chaîne v5→v7, régressions US7/US14/US1-sync). Déroulé : parcours des critères 6-7 de l'US4 et 4-5 de l'US1, inspection des écrans (Objectifs, Tâches, détail d'objectif, Statistiques, rituel), scénarios bout-en-bout rejoués sur les données de démonstration.

*Verdicts par ajustement* :
| Ajustement | Preuve observée | Verdict |
|---|---|---|
| 1. Retrait de la capacité hebdo par objectif | Aucun champ de disponibilité (création, édition, contrôleur) ; A signalé uniquement quand restant (13 h) > vélocité × semaines restantes (1 × 9) ; indéterminé (non signalé) sans vélocité ; g1 démo 5/5 à 9,6 h/sem | Conforme |
| 2. Bouton « Créer un objectif » | Bouton pleine largeur, dégradé indigo→violet, gras, ombre, en tête de la liste des objectifs — visuellement dominant | Conforme |
| 3. Clôture avec temps ajusté (US4-c6) | Passage à « terminée » (Tâches et détail) → panneau de clôture, suggestion pré-remplie, refus sous le temps déjà logué et des valeurs non numériques, « Annuler » sans complétion (2 écrans), tâche bloquée refusée, rituel du soir conforme (2 champs) | Conforme |
| 4. Historique du temps logué (US4-c7) | Carte Statistiques : Par jour (décroissant, saisies détaillées, total du jour — 4 jours démo) / Par tâche (saisies datées croissantes, total par tâche — t1 3 h, t6 2,5 h) | Conforme |
| 5. Regroupement par état (US1-c4) | 4 groupes dans l'ordre du cycle de vie avec compte (démo : 4/3/1/1), groupes vides masqués, tri interne conservé (priorités US5), filtres état/objectif fonctionnels dans les groupes | Conforme |
| 6. Journal des changements d'état (US1-c5) | Cycle complet rejoué (planifiée → en cours → terminée → ré-ouverte : 4 entrées datées au jour réel) ; invariant contrôlé par l'intégrité v7 (dernière entrée = état courant, 3 contre-exemples refusés) ; fiche de tâche (historique complet) + « état depuis » sur chaque rangée ; migration v6→v7 amorcée (terminée → date de fin réelle) et journalisée | Conforme |
| Onglets du rituel | Contrôle segmenté à deux couleurs (indigo soir / ambre matin), onglet actif en fond plein, `role="tab"` / `aria-selected` | Conforme |
| Non-régression | Vélocité 9,6 h/sem extrapolée, sync agenda 3 créés puis état stable, dérive +31,3 % sur 2 tâches recalées, intégrité des données de démonstration v7 | Conforme |

**Anomalies** : **aucune** (ni bloquante, ni majeure, ni mineure). Les trois échecs initiaux de la passe 2 (P2-A2, P2-A3, D1) ont été diagnostiqués comme défauts du **harnais de tests** (motif vague « assez » dans les données de test, erreur d'arithmétique sur la dérive attendue) et corrigés côté tests, sans défaut de code. Un défaut antérieur mineur a été corrigé au passage : la ré-ouverture d'une tâche clôturée au-delà de son estimation produisait un temps restant négatif (données invalides au rechargement) — le restant restauré est désormais borné à 0 (test S9).

**Réserves** : aucune nouvelle. R4 (tâches d'objectifs archivés dans le calendrier), R5 (compteur du fait du jour = journées) et R6 (bouton « Synchroniser » désactivé sans compte, cosmétique) restent posées. Limite consignée d'office : l'historique d'états amorcé à la migration ne retrace pas les changements antérieurs à celle-ci (par construction de l'amorçage, règle US1).

**Conclusion** : les passes d'usage 2 et 3 sont soldées. **US4 validée** sur ses 7 critères · **US1 validée** sur ses 5 critères (les critères 4 et 5 rejoignent le périmètre validé). Suite logique : **MVP — Itération 5 : journal d'activité par lots (US22)**, prêt au développement.

**MVP — Itération 5 : traçabilité d'activité et diagnostic MCO** (US22)

Journal d'activité horodatée, regroupé en **lots quotidiens** consultables et exportables, destiné à repérer et analyser les bugs pendant l'usage réel.

*Revue conjointe analyste/développeur du positionnement (avant développement) : l'US22 est transverse (socle technique) et trouve sa pleine utilité **pendant les 2 semaines d'usage réel** exigées par le critère de sortie du MVP — c'est pendant cette phase que les anomalies se révèlent, et sans trace horodatée l'agent MCO ne dispose que du témoignage de l'utilisateur. Elle est donc placée en **itération 5, avant l'usage réel**, plutôt qu'en V2. Choix de conception : stockage **autonome hors schéma** (précédent US21 des faits) et non dans les données applicatives — un journal intégré au schéma contrôlé par checkIntegrity pourrait lui-même compromettre les données qu'il doit protéger (une trace invalide réinitialiserait tout) ; le stockage autonome cloisonné par compte garantit qu'une panne du journal reste sans effet métier, et dispense d'une migration v6 → v7. Le journal des migrations (US16) et le journal de synchronisation (US1) existants sont repris à l'export sans être dupliqués. L'analyse des lots par l'agent MCO (diagnostic, reproduction, proposition de correctifs) est une procédure d'usage, hors périmètre de l'application.*

*Ajustement d'usage réalisé à la demande de l'utilisateur (livré avec l'itération 5) : l'onglet actif du rituel est désormais nettement identifiable — contrôle segmenté à deux couleurs propres (indigo pour le rapport du soir, ambre pour la routine du matin), fond plein et texte blanc pour l'onglet sélectionné, arrière-plan neutre pour l'inactif, attributs d'accessibilité `role="tab"` / `aria-selected`. Aucun changement fonctionnel (même logique, mêmes préférences d'heures conservées).*

### Recette métier — Itération 5 (US22)

Conduite sur la maquette **v0.7.0** (schéma v7), après rapport de tests développeur **62/62 passants** (suite miroir : régressions intégrales des itérations 1–4 — SMART/A-vélocité, clôture obligatoire, historiques groupés, regroupement par état, journal d'états v7 + migrations v5→v7 et v6→v7, sync agenda, faits US21, dépendances US19 — plus 17 checks US22 : horodatage à la seconde, clé cloisonnée, lots quotidiens, rotation 30, silence sans stockage, export `objectifs-journal-lot-v1`, catalogue diff complet, round-trip `tracer`, cloisonnement local/compte). Déroulé : parcours des 6 critères d'acceptation de l'US22, inspection de l'écran Journal et du câblage App, scénario bout-en-bout rejoué (démarrage → création de tâche → clôture → connexion compte → synchronisation → erreur attrapée → export du lot).

*Verdicts par critère* :
| Critère | Preuve observée | Verdict |
|---|---|---|
| 1. Catalogue horodaté à la seconde, lot du jour courant | `horodatage()` ISO local à la seconde (test J1) ; catalogue complet vérifié par diff (J8–J14) : démarrage (versions, migrations, intégrité, espace), connexion/déconnexion, sync agenda (résumé d'opérations, sans duplication du journal US1), objectif créé/modifié/archivé/supprimé, tâche créée/supprimée logique/renommée/priorité/dépendances, changement d'état, saisie de temps, planification/déplanification, préférences de capacité, changement de jour ; « tâche créée » visible dans le lot du jour avec son horodatage | Conforme |
| 2. Nouveau lot au changement de jour, consultation par date, rotation 30 | Changement de jour → bascule dans un nouveau lot (J3, J16) ; écran : lots par date avec volume et nombre d'erreurs, sélection d'un lot, événements en ordre chronologique ; 35 jours de traçage → 30 lots conservés, les 5 plus anciens supprimés (J4) | Conforme |
| 3. Erreurs tracées avec message, mises en évidence | Exceptions attrapées (7 points fonctionnels) et refus de synchronisation tracés `erreur:true` avec message ; écran : erreurs en rouge avec ⚠, badge rouge, compteur d'erreurs par lot ; **correctif de recette** : l'erreur de chargement (données stockées invalides / refus d'intégrité) est désormais tracée comme événement `erreur` dédié — elle n'était auparavant portée que par le contexte de `demarrage` | Conforme (après correctif) |
| 4. Export 1-clic JSON documenté, copiable | Bouton « ⬇ Export MCO (JSON) » → JSON `objectifs-journal-lot-v1` (en-tête de contexte + événements, testé J7) avec « 📋 Copier » (presse-papiers, repli manuel) ; **correctif de recette** : l'export reprend désormais les journaux existants US16 (migrations) et US1 (synchronisation) dans la section `journauxExistants`, conformément à la règle « repris à l'export, pas dupliqués » (tests J7b/J7c : reprise exacte, section absente = tableaux vides, compatibilité ascendante) | Conforme (après correctif) |
| 5. Cloisonnement par compte, échec silencieux, zéro altération métier | Clé `objectifs-app-journal::<id>` cohérente avec US14 (J2, J16 : espaces local/compte étanches) ; stockage autonome hors schéma, jamais soumis au contrôle d'intégrité ; lecture/écriture en try/catch silencieux — sans `localStorage`, l'application démarre sans erreur (J5, S6) ; `tracer` ne lève jamais (J17) et n'écrit jamais dans les données métier | Conforme |
| 6. Traçage sans altération fonctionnelle | Suite développeur **62/62 passante** avec les fonctions du journal actives dans le harnais (toutes les US des itérations 1–4 re-vérifiées : vélocité démo 9,6 h/sem extrapolée, sync 3 créés puis stable, intégrité v7, etc.) ; `evenementsDeDiff` est pure, `majData` ne modifie les données que via `setData` | Conforme |

**Anomalies** : deux anomalies **mineures** détectées en recette, corrigées dans la foulée et re-testées : (a) l'erreur de chargement n'était pas mise en évidence comme erreur — un événement `erreur` dédié est désormais émis au démarrage quand les données stockées sont invalides ; (b) l'export ne reprenait pas les journaux existants — section `journauxExistants` ajoutée (additive : le format reste stable pour tout consommateur). **US22 modifiée en conséquence** : la règle « Export MCO » documente explicitement la reprise des journaux US16/US1 dans l'export.

**Réserves** (aucune bloquante) :
- Le changement de jour est détecté au premier rendu suivant minuit — sans interaction, une application React ne re-rend pas ; l'événement est donc tracé dès la première activité du nouveau jour. Acceptable sur maquette ; sur le livrable Android, les notifications planifiées (US11) réveilleront l'application et fiabiliseront la détection.
- Le traçage par diff ne détecte pas les refus fonctionnels sans changement de données (ex. : tentative sur une tâche bloquée) — hors catalogue v1, par conception.
- R4 (tâches d'objectifs archivés dans le calendrier), R5 (compteur du fait du jour = journées) et R6 (bouton « Synchroniser » désactivé sans compte, cosmétique) restent posées.

**Conclusion** : **US22 validée sur ses 6 critères**. L'itération 5 est soldée : **toutes les US du périmètre MVP (itérations 1 à 5) sont validées en recette métier** sur la maquette. Restent au critère de sortie du MVP : la **recette du livrable réel** (OAuth Google, API Calendar, notifications, PWA installable — US14 complet et US18), puis **l'usage réel de 2 semaines** sans perte de données ni migration en échec — le journal US22 fournira précisément les lots de diagnostic MCO attendus pendant cette phase.

**MVP — Itération 6 : portabilité des données (US23)**

Export JSON complet de l'espace actif, import avec migration US16 + contrôle d'intégrité, remise à zéro de l'espace.

*Revue conjointe analyste/développeur du positionnement (avant développement) : issue de la demande utilisateur à la suite de la recette de l'itération 5 (« vider les données », persistance, import dans l'application de prod). L'US23 est le chaînon manquant du critère de sortie du MVP : les 2 semaines d'usage réel se déroulent sur la maquette, et leurs données doivent pouvoir être transportées vers le livrable réel sans perte. Elle se place donc **avant l'usage réel** — la remise à blanc est le point de départ naturel des 2 semaines (sinon l'usage réel se mêle aux données de démonstration), et l'export en fin de période alimente l'import du livrable réel (US18). Les données étant du JSON versionné (schéma v7) et la machinerie d'accueil existant déjà (migrations US16 + contrôle d'intégrité), le coût est faible. Choix de conception : l'export exclut le compte connecté (donnée de session, re-résolue à l'import selon l'espace actif) ; le format documenté `objectifs-donnees-v1` est homéomorphe de l'export journal `objectifs-journal-lot-v1` (US22) : en-tête de contexte + charge utile. Ordre de développement suggéré : socle pur (format, export, import avec migration/intégrité, état vide) → écran (section « Vos données » de l'écran Google) → suite miroir.*

### Recette métier — Itération 6 (US23)

Conduite sur la maquette **v0.8.0** (schéma v7 inchangé — l'US23 est un ajout sans migration ; la version applicative a été relevée à 0.8.0 en cours de recette, voir anomalies), après rapport de tests développeur **12/12 passants** sur le socle US23 (format `objectifs-donnees-v1`, round-trips intégraux, import v6 migré, 4 refus sans altération, état vide conforme) et **non-régression en cumul 77/77** (62/62 itération 5 + 3/3 export journal corrigé + 12/12 US23 ; aucune fonction pure existante modifiée). Déroulé : parcours des 6 critères d'acceptation de l'US23, inspection de la section « Vos données » de l'écran Google, scénarios bout-en-bout rejoués (export → remise à zéro → import à l'identique avec recalculs ; import d'un export v6 → migration chaînée US16 ; chaque cas de refus).

*Verdicts par critère* :
| Critère | Preuve observée | Verdict |
|---|---|---|
| 1. Export 1-clic JSON complet, copiable, round-trip intégral | « ⬇ Exporter mes données » → JSON `objectifs-donnees-v1` (en-tête de contexte + données complètes de l'espace actif, **compte exclu** — P1/P2) avec « 📋 Copier » (repli manuel) ; aller-retour sur espace vierge : état restitué à l'identique, vélocité recalculée identique (P3/P4) | Conforme |
| 2. Import migré puis validé avant remplacement | Import d'un export v6 : chaîne US16 appliquée (journal des migrations alimenté, `disponibilite` nettoyé, historique d'états amorcé), **contrôle d'intégrité avant adoption**, compte de session conservé (P5) ; en-tête d'export v0.8.0, et les exports applicatifs antérieurs (v0.7.0, même schéma) s'importent sans friction — seule la version de schéma fait foi | Conforme |
| 3. Refus propres sans altération | JSON illisible, format non reconnu, schéma v8 supérieur, intégrité en échec : message explicite pour chacun, `data` nulle, données d'origine intactes (P6–P10) ; à l'écran : refus affiché, aucune modification | Conforme |
| 4. Remise à zéro conforme, « ↺ Démo » distinct | « 🗑 Vider l'espace » → double confirmation avec « ⬇ Exporter d'abord » proposé sur le panneau ; état vide : 0 objectif, 0 tâche, 0 saisie, agenda réinitialisé (sinon événements orphelins), préférences et journal des migrations conservés, intégrité passante, vélocité nulle (P11) ; « ↺ Démo » inchangé en en-tête | Conforme |
| 5. Espace actif uniquement, journal US22 préservé, opérations tracées | Export, import et vidage agissent sur l'espace actif (clé US14), les autres espaces ne sont jamais touchés ; journal d'activité jamais altéré ; export, import confirmé et vidage tracés type `donnees`, import refusé tracé `erreur` | Conforme |
| 6. Non-altération fonctionnelle | Aucune fonction pure existante modifiée (ajouts seuls) ; 62/62 it. 5 inchangés, 3/3 export journal, 12/12 US23 ; l'écran Google élargit sa prop `setData` sans impact pour les autres écrans | Conforme |

**Anomalies** : **aucune** (ni bloquante, ni majeure, ni mineure). Un point d'hygiène a été relevé et corrigé au passage : la version applicative n'avait pas été relevée à la livraison de l'US23 — conformément à la discipline de versionnage app ↔ schéma (US18), la maquette passe en **v0.8.0** (schéma v7 inchangé). L'en-tête d'export et l'événement de démarrage portent la nouvelle version ; les exports applicatifs antérieurs restent importables (vérifié par tests 2/2).

**Réserves** (aucune bloquante) :
- L'aperçu d'import est une photographie de la vérification : ce sont les données vérifiées qui sont confirmées, même si l'espace évolue entre-temps (par construction, sans effet sur la maquette mono-utilisateur).
- La copie presse-papiers dépend d'un contexte sécurisé (repli manuel affiché le cas échéant) — à fiabiliser sur le livrable réel.
- L'import se fait par collage (pas de sélection de fichier) — confort à envisager pour la PWA (US18).
- R4 (tâches d'objectifs archivés dans le calendrier), R5 (compteur du fait du jour = journées) et R6 (bouton « Synchroniser » désactivé sans compte, cosmétique) restent posées.

**Conclusion** : **US23 validée sur ses 6 critères**. L'itération 6 est soldée : **toutes les US du périmètre MVP (itérations 1 à 6) sont validées en recette métier**. Le MVP entre dans sa phase finale : **remise à blanc de l'espace (US23), puis usage réel de 2 semaines** — le journal US22 documentant la période —, **export final en fin de période pour alimenter l'import du livrable réel** (US18 : OAuth Google, API Calendar, notifications, PWA installable), qui fera l'objet de la dernière recette avant l'acceptation du MVP.

**Phase d'usage réel — démarrage (mardi 13/10/2026)**

Le MVP entre dans sa période d'usage réel de 2 semaines, dernier jalon du critère de sortie. Protocole :

1. **Remise à blanc de l'espace actif** (« 🗑 Vider l'espace », onglet ☁️ Google) — l'événement « remise à zéro » tracé au journal US22 marque le début de période ; les données de démonstration restent rechargeables (« ↺ Démo »).
2. **Usage quotidien réel** : objectifs SMART, tâches, planification, rituels du soir (saisie des temps, programme du lendemain) et du matin, clôtures avec temps ajusté, synchronisation agenda (simulée). Les notifications 21h/7h étant simulées sur maquette, l'utilisateur ouvre l'application de lui-même aux heures de rituel.
3. **Toute anomalie** : export du lot du jour (🧾 Journal → « ⬇ Export MCO (JSON) ») transmis à l'agent MCO pour analyse, sans attendre la fin de période.
4. **Fin de période prévue le mardi 27/10/2026** : export des données (« ⬇ Exporter mes données ») + export des lots du journal, puis vérification du critère de sortie (2 semaines sans perte de données ni migration en échec, journal exploitable) et bilan de la période.

*Note : la rotation du journal US22 conserve 30 lots quotidiens — les 14 lots de la période resteront intégralement disponibles jusqu'au bilan. Les réserves R4/R5/R6 restent connues et acceptées pendant la période.*

**V2 (après validation du MVP)**
| US périmètre | Contenu |
|---|---|
| US8 | Time-blocking assisté (lecture des créneaux libres + suggestions) |
| US10 | Capture Gmail + récap hebdomadaire |
| US14 complet | Bascule multi-comptes à chaud (le cloisonnement simple suffit au MVP) |
| US24 | Formulaire rapide d'ajout de tâches liées sur la fenêtre de création/édition d'un objectif (écran 1 de l'US13) |
| US25 | M — Mesurable en champ texte unique libre, remplaçant le couple valeur numérique + unité (migration de schéma v7 → v8) |
| US26 | Saisie des dates via un calendrier (toutes dates de l'application, stockage ISO, migration v8 → v9) |
| US27 | Écran d'édition de tâche (fiche complète) avec changement de statut explicite |
| US28 | Champs obligatoires et contrôles à la saisie (charge estimée bloquante, fin du repli silencieux à 1 h) |
| US29 | Contrôles sur les changements de statut (cycle strict, date exigée pour planifier, confirmation de ré-ouverture) |
| US30 | Suggestions du rituel du soir triées par urgence (échéance de l'objectif d'abord, à risque, priorités) |
| US31 | Ergonomie tactile et accessibilité de base (cibles ≥ 44 px, libellés accessibles, contraste AA, anti-discrimination chromatique) |
| US32 | Allègement des rangées de tâches et hiérarchie des actions (2 actions par rangée, le reste dans la fiche US27) |
| US33 | Durées lisibles en h/min, états vides guidés et accueil de première utilisation |

*US ajoutées au backlog à la demande de l'utilisateur pendant la phase d'usage réel (13/10/2026) et raffinées ci-dessous. Positionnement : développement **après le bilan du 27/10/2026** — modifier la maquette en cours de période fausserait l'observation du critère de sortie, et l'US25 introduit une migration de schéma (v7 → v8) qui ne doit pas s'exécuter pendant les 2 semaines sous peine de brouiller le critère « aucune migration en échec » (une migration réussie en cours de période resterait traçable, mais l'événement polluerait le journal de diagnostic). L'US26 enchaîne une seconde migration (v8 → v9) : l'ordre US25 → US26 est figé par la priorisation ci-dessous. Les US28/US29, proposées puis arbitrées le 13/10/2026, sont sans migration de schéma (contrôles purs) ; l'US30 l'est aussi (tri à l'affichage), de même que les US31–33 issues de la revue UX/UI (présentation seule).*

**US24 — Formulaire rapide de tâches liées sur la fenêtre de création/édition d'un objectif**
> En tant qu'utilisateur, je veux ajouter des tâches directement depuis la fenêtre de création/édition d'un objectif, sans attendre la navigation vers l'écran de détail.

- **Règles** : la fenêtre de création (écran 1 de l'US13) et le panneau d'édition de l'objectif portent un formulaire rapide d'ajout de tâche **réutilisant les champs de l'US3** (titre obligatoire, priorité, charge estimée, date optionnelle) ; une tâche ajoutée avant validation est **liée à l'objectif en cours de création** et persistée avec lui à la création ; depuis le panneau d'édition, la tâche est créée liée immédiatement ; chaque ajout est tracé au journal d'activité (type « tâche créée », catalogue US22) ; les agrégats de l'objectif (charge totale A2, temps restant US6) et le contrôleur SMART (US12) se recalculent en conséquence. *Complément de l'US13 : l'ajout existe déjà depuis le détail (critère 5), il manque sur la fenêtre de création/édition.*
- **Critères d'acceptation** :
  1. Depuis la fenêtre de création, je peux saisir une ou plusieurs tâches avant de valider ; elles sont créées liées à l'objectif, sans étape intermédiaire.
  2. Après création, chaque tâche ajoutée apparaît dans la section « Tâches liées » du détail, avec son état initial `à planifier`.
  3. Un ajout sans titre est refusé sans impact sur l'objectif ni sur les autres tâches saisies.
  4. La charge totale (A2) et le temps restant (US6) de l'objectif tiennent compte des tâches ajoutées dès la validation.
  5. Le même formulaire rapide est disponible depuis le panneau d'édition d'un objectif existant ; la tâche créée y est liée immédiatement et tracée au journal.

**US25 — Indicateur mesurable (M) en champ texte unique**
> En tant qu'utilisateur, je veux saisir l'attribut M — Mesurable comme un texte libre, au lieu d'un couple valeur numérique + unité.

- **Règles** : l'attribut M devient un **champ texte unique** (ex. « 100 % des murs peints », « courir 42,2 km en moins de 4h ») ; le contrôle de conformité US12 passe de « valeur numérique + unité obligatoires » à **« texte non vide »** ; le schéma remplace `mesurableValeur` + `mesurableUnite` par un champ texte `mesurable` via une **migration numérotée `v07_v08_mesurable_texte`** conformément à l'US16 (concaténation valeur + unité des données existantes, sans perte) ; le contrôle d'intégrité v8 est mis à jour en conséquence ; l'affichage du détail (US13) et le contrôleur SMART utilisent le texte tel quel ; les exports antérieurs (`objectifs-donnees-v1`, schéma ≤ v7 — US23) s'importent via la chaîne de migrations US16 puis le contrôle d'intégrité, comme tout export ancien ; l'événement `donnees` de l'US22 n'est pas concerné (aucun changement de format d'export).
- **Critères d'acceptation** :
  1. Les formulaires de création et d'édition d'objectif présentent un champ texte unique pour M ; plus aucun champ numérique ni champ unité.
  2. Le contrôleur SMART signale M manquant uniquement si le texte est vide ; un texte libre quelconque (avec ou sans chiffre) rend M conforme.
  3. Les données v7 existantes sont migrées : chaque objectif conserve son indicateur (valeur + unité concaténées), le journal des migrations est alimenté, le contrôle d'intégrité v8 passe.
  4. Un export applicatif réalisé en schéma v7 s'importe sur la nouvelle version : migration chaînée puis validation d'intégrité avant remplacement (US23), sans perte de l'attribut M.
  5. Le détail d'objectif et le badge SMART affichent le texte libre de M.

**US26 — Saisie des dates via calendrier**
> En tant qu'utilisateur, je veux choisir toute date dans un calendrier, au lieu de la saisir à la main en texte libre.

- **Règles** : un composant **sélecteur de date** unique remplace tous les champs texte `jj/mm` : échéance cible (création US13 + panneau d'édition), date planifiée (formulaire US3, ajout rapide US24, écran d'édition US27, planification du rituel US11) ; les raccourcis « aujourd'hui » / « demain » restent proposés en un geste dans le calendrier ; le stockage passe d'un texte `jj/mm` (sans année) ou libellé roulant à une **date ISO `yyyy-mm-dd`** via une **migration numérotée `v08_v09_dates_iso`** conformément à l'US16 (chaînée après `v07_v08` de l'US25 ; les jj/mm sans année voient leur année résolue à l'année courante la plus proche — année en cours si la date est à venir, sinon année suivante) ; le contrôle d'intégrité v9 vérifie la validité de chaque date ; la résolution des libellés au jour réel (`dateReelleDe`, US20) devient inutile pour les nouvelles données et disparaît avec la migration ; les consommateurs (statistiques US2, fin estimée US7, calendrier de charge US20, sync agenda US1-c2, rituels US11) passent au format ISO **sans changement de comportement** ; les exports antérieurs (US23) s'importent via la chaîne de migrations comme tout export ancien.
- **Critères d'acceptation** :
  1. Toute saisie de date de l'application se fait via le calendrier ; plus aucun champ texte de date libre.
  2. Une date invalide n'est plus saisissable ; planifier une date passée déclenche un avertissement explicite avant confirmation.
  3. Les dates existantes (jj/mm et libellés roulants) sont migrées en ISO sans perte, l'année étant résolue par la règle ci-dessus ; journal des migrations alimenté, intégrité v9 passante.
  4. Les comportements dépendants des dates sont inchangés après migration : stats à la date réelle, fin estimée, calendrier de charge, événements agenda (vérifiés par la suite de tests existante).
  5. Un export applicatif antérieur à la migration s'importe via la chaîne US16 puis le contrôle d'intégrité (US23), dates comprises.

**US27 — Écran d'édition de tâche et changement de statut explicite**
> En tant qu'utilisateur, je veux un écran dédié pour éditer une tâche et changer son statut explicitement, au lieu du bouton d'état cyclique et d'actions dispersées sur la rangée.

- **Règles** : un **écran d'édition de tâche** (ou panneau plein écran sur mobile), accessible depuis toute rangée de tâche (écran Tâches, détail d'objectif, suggestions du rituel), regroupe l'édition de **toutes les propriétés** : titre (renommage — le traçage « tâche renommée » du journal US22 existe déjà, l'UI n'existait pas), objectif lié (changement possible, avec recalcul des agrégats US6/A2 et du SMART US12 des deux objectifs), priorité (US5), charge estimée et temps restant, date planifiée (calendrier US26), dépendances US19 et historique d'états (reprise de la fiche 🔗), saisie de temps (US4) et suppression logique (US15) ; le changement de statut se fait par **sélection explicite de l'état cible** (les 4 états visibles, l'état courant signalé) et non plus par cycle à un bouton ; chaque transition reste gardée par les règles existantes : tâche bloquée refusée (US19), passage à « terminée » uniquement via la clôture avec temps passé total ajusté obligatoire (US4-c6), ré-ouverture avec restant restauré borné à 0 et journalisation de l'état (Passe 3) ; une transition refusée affiche la règle en cause ; les raccourcis de rangée (⏱ saisie, cycle rapide, fiche 🔗) restent disponibles ; toute modification est tracée au journal d'activité (US22).
- **Critères d'acceptation** :
  1. Depuis toute rangée de tâche, j'ouvre l'écran d'édition ; toutes les propriétés y sont modifiables et enregistrées en une seule validation.
  2. Je peux renommer une tâche depuis cet écran ; le renommage est tracé au journal (« tâche renommée »).
  3. Changer l'objectif lié déplace la tâche : charge, temps restant et contrôleur SMART des deux objectifs se recalculent.
  4. Le statut se choisit explicitement ; toute transition interdite affiche la règle en cause (bloquée / clôture obligatoire) et est impossible depuis l'écran ; les transitions autorisées alimentent l'historique d'états (invariant Passe 3 maintenu).
  5. Historique d'états complet, dépendances, historique des saisies et suppression logique sont accessibles depuis cet écran, sans retour à la liste.

### US28 et US29 — champs obligatoires et contrôles de statut (proposées puis arbitrées le 13/10/2026)

*Constats à l'origine des propositions (relevés dans la maquette) : la charge estimée d'une tâche invalide ou absente est aujourd'hui **silencieusement forcée à 1 h** à la création ; l'échéance cible d'objectif est un texte `jj/mm` libre non validé ; les transitions de statut ne sont visibles qu'au clic du bouton cyclique (l'état cible n'est pas affiché avant l'action) ; le passage à « planifiée » n'exige aucune date planifiée. Arbitrages rendus par l'utilisateur le 13/10/2026 : (1) l'échéance d'objectif reste **signalée par le contrôleur SMART seulement** (brouillon enregistrable, statu quo US12-c3) ; (2) **cycle strict** — aucune transition hors cycle.*

**US28 — Champs obligatoires et contrôles à la saisie**
> En tant qu'utilisateur, je veux que les champs indispensables soient obligatoires et contrôlés, pour ne jamais créer de données implicites ou invalides.

- **Règles** : pour une **tâche** — titre obligatoire (existant), **objectif lié toujours renseigné** (présélection de l'objectif le plus prioritaire, jamais vide), **charge estimée > 0 obligatoire** (suppression du repli silencieux à 1 h : refus bloquant avec message explicite), date planifiée valide si renseignée (US26 rend les dates valides par construction, le contrôle reste en garde) ; pour un **objectif** — titre obligatoire (existant), échéance cible **non bloquante** : un objectif sans échéance valide reste enregistrable en brouillon, l'attribut T étant signalé manquant par le contrôleur SMART (décision d'arbitrage, statu quo US12-c3) ; tout refus bloquant s'affiche avec un message explicite et **n'enregistre rien** ; les mêmes contrôles s'appliquent à tous les points de saisie (formulaire US3, ajout rapide US24, rituel US11, écran d'édition US27).
- **Critères d'acceptation** :
  1. Une création de tâche sans charge estimée valide (> 0) est refusée avec un message explicite, rien n'est enregistré — le repli silencieux à 1 h disparaît.
  2. Une tâche ne peut jamais être créée sans objectif lié.
  3. Une date planifiée invalide est refusée avec message (garde complémentaire à l'US26) ; la tâche et les autres champs saisis restent intacts.
  4. Un objectif sans échéance valide reste enregistrable en brouillon ; T est signalé manquant dans le badge SMART — l'enregistrement n'est jamais bloqué par l'échéance.
  5. Les contrôles s'appliquent à l'identique sur tous les points de saisie de tâches de l'application.

**US29 — Contrôles sur les changements de statut**
> En tant qu'utilisateur, je veux que les changements de statut soient contrôlés et explicites, pour ne jamais dégrader l'état d'une tâche par erreur.

- **Règles** : matrice de transitions **strictement séquentielle** (décision d'arbitrage) : `à planifier` → `planifiée` → `en cours` → `terminée`, aucune transition hors cycle possible (le bouton rapide et l'écran US27 ne proposent que l'état suivant du cycle, plus la ré-ouverture) ; vers `planifiée` : **date planifiée valide exigée**, refus avec message sinon (cohérent avec la sync agenda US1-c2 : une tâche planifiée = un événement agenda) ; vers `en cours` : refus si bloquée (US19, existant) ; vers `terminée` : clôture obligatoire avec temps passé total ajusté (US4-c6, existant) ; **ré-ouverture** (`terminée` → `à planifier`, seule transition arrière) : **confirmation explicite** demandée — un clic de trop ne rouvre plus rien — restant restauré borné à 0 et événement journalisé dans l'historique d'états (Passe 3, existants) ; chaque transition autorisée alimente l'historique d'états (invariant : l'état courant est toujours la dernière entrée) ; les gardes s'appliquent partout (rangées Tâches, détail d'objectif, écran US27, rituel).
- **Critères d'acceptation** :
  1. Une transition hors cycle (ex. `à planifier` → `terminée`) est impossible partout, avec message explicitant la règle.
  2. Le passage à `planifiée` sans date valide est refusé avec message ; l'état est inchangé.
  3. La ré-ouverture d'une tâche terminée exige une confirmation ; annulée, rien ne change ; confirmée, l'événement est journalisé et le restant restauré est borné à 0.
  4. Un clic de trop sur le bouton cyclique d'une tâche terminée ne rouvre plus la tâche sans confirmation.
  5. L'invariant d'intégrité est maintenu sur toutes les transitions : l'état courant correspond toujours à la dernière entrée de l'historique (contrôle d'intégrité du schéma courant).

**US30 — Suggestions du rituel du soir triées par urgence**
> En tant qu'utilisateur, je veux que les tâches proposées par le rituel du soir soient ordonnées de la plus urgente à la moins urgente, pour planifier le lendemain en confiance.

- **Règles** : le tri des « Actions de demain » du rituel du soir (aujourd'hui le tri standard du backlog US5 : priorité d'objectif → priorité de tâche → date, carte intitulée « backlog trié par priorité ») est remplacé par un **tri par urgence**, dans le rituel uniquement — les autres vues (Tâches, détail d'objectif) conservent le tri US5 ; définition de l'urgence, par ordre décroissant de poids : (1) **échéance cible de l'objectif** la plus proche d'abord, les objectifs sans échéance en dernier ; (2) **indicateur « à risque »** (US7/US12 : fin estimée après l'échéance) : l'objectif à risque précède à échéance égale ; (3) **priorité de la tâche** (haute → moyenne → basse) ; (4) **priorité de l'objectif** (P1 → P4) ; (5) **date déjà posée** (une tâche « à planifier » déjà datée passe devant), puis restant décroissant pour un ordre total et stable ; le périmètre des suggestions est inchangé — tâches `à planifier` actives non bloquées (US19), 3 propositions (US11) — seul l'ordre change ; chaque suggestion affiche son **motif d'urgence** (échéance de l'objectif, badge « à risque ») pour un tri lisible ; l'intitulé de la carte devient « triées par urgence » ; tri effectué par une fonction pure dédiée (testable), sans migration de schéma.
- **Critères d'acceptation** :
  1. Les suggestions sont ordonnées de la plus urgente à la moins urgente : deux tâches d'objectifs à échéances différentes → celle dont l'échéance est la plus proche est proposée en premier.
  2. À échéance égale, la tâche de l'objectif « à risque » précède ; à risque égal, la priorité de tâche tranche, puis la priorité d'objectif, puis la date posée — l'ordre est total et stable (aucun tri ambigu).
  3. Les objectifs sans échéance sont proposés en dernier, départagés par les critères suivants (2 à 5).
  4. Le périmètre et les garde-fous sont inchangés : tâches bloquées exclues (US19), 3 propositions maximum (US11) ; les autres vues conservent le tri US5.
  5. Le motif d'urgence de chaque suggestion est visible à l'écran (échéance de l'objectif, badge « à risque » le cas échéant) et l'intitulé de la carte ne mentionne plus « trié par priorité ».

### Revue UX/UI et consensus design (13/10/2026)

*Revue conduite par l'agent UX/UI (skill `objectifs-ux-ui-agent`) sur la maquette v0.8.0 et le présent cahier — grille heuristique de Nielsen + axes systématiques (cibles tactiles, contraste WCAG AA, accessibilité, charge cognitive, états vides). Propositions soumises au développeur (faisabilité, effort, impact tests/régression, migrations) et à l'analyste métier (cohérence avec les US et transverses, reformulation, positionnement) ; verdict par proposition : Adoptée / Adoptée avec modification / Ajournée.*

**Constats saillants** (tous localisés et prouvés dans le code de la maquette) :

- **Cibles tactiles sous-dimensionnées (majeur)** : bouton d'état de tâche 24×24 px, boutons ⏱/🔗/🗑 28 px — sous le seuil de 44 px, sur les actions les plus fréquentes de l'application (l'écran Tâches).
- **Contraste insuffisant (majeur)** : textes informatifs en 10–11 px `slate-400` sur blanc (≈ 2,8:1, seuil WCAG AA 4,5:1) — méta-données des rangées, aides de formulaires, libellés secondaires.
- **Accessibilité (majeur)** : bouton ⏱ sans `aria-label` ni `title` ; état d'une tâche porté par la **seule couleur** du rond ; `focus` clavier non visible sur les boutons personnalisés.
- **Charge cognitive (majeur)** : jusqu'à 6 actions visibles par rangée de tâche (état, priorité, ⏱, 🔗, 🗑, badge) ; changement d'état à l'aveugle (cycle, cible non affichée avant l'action).
- **Frictions de lecture (mineur)** : durées en heures décimales (« 2,5 h » pour 2 h 30) partout ; libellés d'onglets tronqués (« Auj. », « Calend. ») en 10 px sur 8 colonnes.
- **États vides passifs (mineur)** : « Aucune tâche à afficher », « Aucune saisie enregistrée » — constatés sans guidage ni action directe ; après la remise à zéro (US23), première utilisation sans accompagnement.
- **Points preservés** : hiérarchie visuelle des cartes, panels inline de saisie/clôture/suppression (feedback proche de l'action), double confirmation destructive — jugés conformes.

**Consensus** :

- **Endossements** : la revue confirme la valeur UX de l'US26 (calendrier — fin des dates en texte libre), de l'US27 (fiche d'édition + statut explicite — lève l'action à l'aveugle) et de l'US30 (motif d'urgence lisible sur chaque suggestion).
- **Adoptées** (après arbitrage développeur : sans migration de schéma, présentation seule, effort cumulé M ; analyste : reformulées en critères testables) : **US31, US32, US33** ci-dessous, positionnées avec les US28–30 pour une **passe design post-bilan 27/10**.
- **Ajournée** : regroupement de la navigation en 5 onglets + menu « Plus » (Stats/Google/Journal) — pertinent pour la PWA réelle, coût injustifié en cours de maquette ; à ré-arbitrer au livrable (US18).
- **Non proposée** : retour des onglets en bas d'écran — contraire à la décision consignée de la passe d'usage réel (onglets en haut), non remise en cause.

**US31 — Ergonomie tactile et accessibilité de base**
> En tant qu'utilisateur, je veux des cibles tactiles confortables et une interface lisible et accessible, pour utiliser l'application au quotidien sur mobile sans erreur de manipulation ni fatigue visuelle.

- **Règles** : toute cible interactive ≥ **44 px** (boutons d'état, ⏱/🔗/🗑, pastilles d'onglets) ; chaque bouton-icône porte un **libellé accessible** (`aria-label` + `title`) ; `focus` visible au clavier sur tous les éléments interactifs (`focus-visible`) ; **contraste ≥ 4,5:1** pour les textes informatifs (les libellés porteurs d'information passent de `slate-400` 10–11 px à `slate-500`/`slate-600` ≥ 11 px) ; aucune information n'est portée par la seule couleur : le bouton d'état d'une tâche est doublé d'un libellé court au survol/`title` et le badge d'état reste visible ; les pastilles d'onglets reçoivent des libellés non tronqués à taille lisible (raccourcis d'usage réel : « Aujourd'hui », « Calendrier ») ; contraste des badges vérifié.
- **Critères d'acceptation** :
  1. Toute cible interactive mesure au moins 44 px (vérifiable dans le DOM rendu).
  2. Tout bouton-icône porte un `aria-label` et un `title` ; le bouton ⏱ notamment est annoncé correctement au lecteur d'écran.
  3. Le focus clavier est visible sur 100 % des éléments interactifs.
  4. Les textes informatifs affichent un contraste ≥ 4,5:1 sur leur arrière-plan (libellés de rangées, méta-données, aides de formulaire).
  5. L'état d'une tâche reste identifiable sans la couleur (badge texte + `title` sur le bouton d'état).

**US32 — Allègement des rangées de tâches et hiérarchie des actions**
> En tant qu'utilisateur, je veux des rangées de tâches épurées avec des actions hiérarchisées, pour me concentrer sur l'essentiel : faire avancer les tâches.

- **Règles** : une rangée de tâche n'expose que **2 actions** : le changement d'état (cible ≥ 44 px, prochaine étape indiquée avant l'action — `title` ou libellé, cohérent avec l'US29 cycle strict) et l'ouverture de la **fiche d'édition** (US27) ; les actions secondaires (⏱ saisie de temps, 🔗 dépendances, 🗑 suppression) migrent dans la fiche d'édition ; le badge d'état et la priorité restent visibles sur la rangée ; aucune perte de fonctionnalité — chaque action secondaire reste accessible en ≤ 1 interaction supplémentaire ; le cycle de priorité reste accessible depuis la fiche (et la rangée pour la version rapide) ; dépend de l'US27 (développée conjointement).
- **Critères d'acceptation** :
  1. Une rangée de tâche n'expose plus que 2 actions visibles (état + éditer) ; le reste est dans la fiche d'édition.
  2. La prochaine étape du cycle d'état est indiquée avant l'action (pas de changement à l'aveugle).
  3. Saisie de temps, dépendances, suppression et renommage restent accessibles depuis la fiche en ≤ 1 interaction supplémentaire.
  4. Les comportements métier sont inchangés : tri des groupes, historique d'états, gardes US19/US4-c6 (suite de tests passante).

**US33 — Durées lisibles, états vides guidés et accueil de première utilisation**
> En tant qu'utilisateur, je veux des durées qui se lisent naturellement et des écrans vides qui me guident, pour démarrer sans friction même après une remise à zéro.

- **Règles** : affichage des durées au format **« 2 h 30 » / « 45 min »** (arrondi à 5 min près) partout dans l'application, via une fonction pure de formatage partagée ; les calculs internes et le stockage restent en décimal (aucune migration, aucune donnée modifiée) ; **états vides guidés** : chaque écran vide (Tâches, Objectifs, Aujourd'hui, Statistiques, Journal, Calendrier) affiche une phrase de guidage + une action directe (« Crée ton premier objectif SMART », « Lance le rituel du soir »…) ; **première utilisation** : sur un espace sans aucun objectif (état vide US23), l'accueil affiche une carte éphémère « Bienvenue — 3 étapes » (créer un objectif SMART → ajouter des tâches → rituel du soir), masquable manuellement, disparaissant automatiquement dès qu'un objectif existe.
- **Critères d'acceptation** :
  1. Aucune durée ne s'affiche plus en décimal (« 2,5 h » n'apparaît plus nulle part) ; l'arrondi à 5 min est respecté ; les totaux restent cohérents avec les valeurs internes (0,5 h d'écart maximal d'affichage).
  2. Chaque écran vide porte un guidage et une action directe vers l'écran de création ou l'action correspondante.
  3. La carte « Bienvenue » n'apparaît que sur un espace sans objectif ; créer un objectif la fait disparaître sans rechargement ; le masquage manuel est effectif pour la session.
  4. Aucun changement de schéma ni de données : la suite de tests existante reste passante à l'identique (les valeurs comparées restent décimales).

### Priorisation du backlog V2 (13/10/2026)

*Priorisation consignée par l'analyste métier, revue UX/UI et arbitrages du jour intégrés. Cadence inchangée : chaque itération = développement + suite de tests miroir (bump de version applicative conforme à l'US18), puis recette métier ; les itérations V2 démarrent après le bilan d'usage réel du 27/10/2026.*

| Ordre | Itération V2 | US | Motif de la priorité |
|---|---|---|---|
| 1 | **Itération 7 — Contrôles, gardes et rituel** (effort S) | US28, US29, US30 | Valeur d'usage quotidien immédiate : saisie protégée (fin du repli silencieux à 1 h), plus aucune ré-ouverture accidentelle, rituel du soir plus utile. Sans migration de schéma, risque de régression minimal, livrable vite. **Livrée et validée le 13/10/2026** (recette ci-dessous). |
| 2 | **Itération 8 — Refonte de la saisie et du schéma** (effort M) | US25 → US26 → US24 | Les deux migrations chaînées (v7→v8 : M texte libre, puis v8→v9 : dates ISO) s'exécutent consécutives, une seule passe de tests de migrations ; US24 en dernier hérite du calendrier de l'US26 pour son champ date. **Livrée et validée le 13/10/2026** (recette ci-dessous). |
| 3 | **Itération 9 — Fiche d'édition et allègement** (effort M) | US27 → US32 | US27 s'appuie sur le calendrier US26, les contrôles US28 et les gardes US29 ; US32 dépend de la fiche US27 (les actions secondaires des rangées y migrent). **Livrée et validée le 13/10/2026** (recette ci-dessous). |
| 4 | **Itération 10 — Design et accessibilité** (effort M) | US31 → US33 | Passe visuelle volontairement en dernier : US27/US32 restructurent les écrans (Tâches notamment) — retoucher contrastes et cibles tactiles avant serait du double travail ; US33 (durées lisibles, états vides guidés, « Bienvenue ») clôt l'expérience de bout en bout. |
| 5 | **Après livrable réel** (recette PWA/OAuth — US18) | US14 complet, US8, US10 | Nécessitent l'OAuth et les API Google réelles, non fidélisables sur maquette : l'US8 lit les créneaux libres de l'agenda réel, l'US10 capture Gmail, l'US14 complet bascule les comptes à chaud. À relier à l'arbitrage « navigation regroupée » ajourné lors de la revue UX/UI. |

*Règles de priorisation appliquées : valeur d'usage quotidien avant refonte visuelle ; migrations de schéma regroupées et consécutives ; design après restructuration des écrans ; les seules dépendances d'ordre sont US25 → US26 (chaîne de migrations) et US27 → US32 (fiche d'édition), toutes deux figées ci-dessus. Les US8/US10/US14 complet restent conditionnées au livrable réel : elles ne sont pas estimables sur maquette.*

### Livraison et recette — Itération 7 (13/10/2026)

*Développement demandé explicitement par l'utilisateur en cours de période d'usage réel — dérogation au positionnement « post-bilan » constatée et assumée. Sans migration de schéma (schéma v7 inchangé, le critère de sortie « aucune migration en échec » n'est pas touché) ; version applicative relevée **v0.8.0 → v0.9.0** conformément à la discipline US18, le journal d'activité (US22) tracera la nouvelle version au prochain démarrage. La période d'usage réel se poursuit sur la maquette v0.9.0. Cycle complet : analyste (US déjà raffinées) → développeur → vérifications UX/UI intégrées → recette métier.*

**Rapport développeur** (maquette v0.9.0, schéma v7) :

- **US28** : contrôle centralisé dans `createTask` via `validerNouvelleTache` — titre, **objectif lié** (objectif inconnu ou archivé refusé), **charge estimée > 0** (fin du repli silencieux à 1 h), **date valide si renseignée** (jj/mm ou libellés roulants) ; refus avec message explicite, rien d'enregistré ; les deux points de saisie (formulaire US3 de l'écran Tâches, ajout rapide du détail d'objectif) passent par la même fonction ; l'échéance d'objectif reste non bloquante (brouillon enregistrable, T signalé par le contrôleur SMART — arbitrage du 13/10 respecté).
- **US29** : nouvelles fonctions pures `prochainEtat`, `transitionEtat` (matrice strictement séquentielle, ré-ouverture = seule transition arrière, gardes US19 conservées, **date exigée pour planifier**) et `reouvrirTache` (restant restauré borné à 0, dateFin effacée, journalisation Passe 3) ; à l'écran : le bouton d'état **annonce la prochaine étape avant l'action** (`title` + `aria-label` dynamiques) ; planification sans date → **panel de saisie en place** (récupération, pas de blocage sec) ; clic sur une tâche terminée → **confirmation explicite** de ré-ouverture (panneau ambre, annulable).
- **US30** : fonction pure `triParUrgence` (échéance de l'objectif → à risque → priorité de tâche → priorité d'objectif → date posée → restant décroissant, départage par identifiant pour un ordre total et stable) ; appliquée aux « Actions de demain » du rituel du soir, périmètre inchangé (tâches `à planifier` actives non bloquées, 3 propositions) ; chaque suggestion affiche son **motif d'urgence** (échéance, ⚠ à risque, déjà datée) ; intitulé de la carte actualisé.
- **Boucle de correction** : suite miroir **27/27 passants** après 2 itérations — (a) défaut de code réel corrigé : une date blanche créait une tâche « planifiée » avec une date vide, la date est désormais normalisée ; (b) défaut du **harnais de tests** (incohérence d'identifiant d'objectif dans un scénario) corrigé côté tests, sans défaut de code. Fonctions existantes inchangées sauf `createTask` (modification volontaire US28, comportements nominaux re-testés).

**Vérifications UX/UI** (agent `objectifs-ux-ui-agent`, intégrées au cycle à la demande de l'utilisateur) :

| Livrable | Vérification | Verdict |
|---|---|---|
| Bouton d'état (US29) | Prochaine étape annoncée avant l'action (`title` + `aria-label`) — visibilité de l'état et prévention d'erreur ; cible 24 px inchangée, dérogation consignée (normalisation 44 px = US31, itération 10) | Conforme |
| Panel de planification (US29) | Récupération en place plutôt que blocage sec ; formats acceptés explicites ; contrastes indigo-700/indigo-50 ≈ 5,9:1 (AA) ; reprend le pattern inline existant (cohérence) | Conforme |
| Confirmation de ré-ouverture (US29) | Sévérité correcte : ambre (avertissement), distinguée du rouge destructif ; conséquences explicites ; annulation sans effet | Conforme |
| Messages de refus US28 | Message explicite citant la valeur fautive et la règle, affiché près de la saisie ; rouge-600/blanc ≈ 4,5:1 (AA) | Conforme |
| Suggestions du rituel (US30) | Motif d'urgence lisible (texte + glyphe, pas de couleur seule) en 11 px slate-500 ≈ 4,6:1 (AA, meilleur que l'existant) ; hiérarchie titre/motif/badges | Conforme |

**Anomalies UX : aucune** (ni bloquante, ni majeure, ni mineure). **Observation** (non bloquante, à considérer avec l'US27) : le focus clavier n'est pas posé automatiquement sur le champ date du panel de planification.

**Recette métier — Itération 7** :

| Critère | Preuve observée | Verdict |
|---|---|---|
| US28-1 (charge invalide refusée, rien d'enregistré) | NaN, 0, −2 : refus « charge estimée obligatoire (> 0 h) — elle n'est plus remplacée automatiquement », aucune tâche créée (tests I7-1/I7-1b) ; les deux formulaires passent la valeur brute à `createTask` | Conforme |
| US28-2 (objectif lié toujours renseigné) | Objectif vide, inconnu ou archivé : refus « objectif lié obligatoire » (I7-3/I7-3b) ; le sélecteur ne propose que les objectifs actifs | Conforme |
| US28-3 (date invalide refusée, champs intacts) | « 31/04 » : refus avec la valeur citée (I7-4) ; « demain » : tâche créée planifiée ; vide/blanche : normalisée, à planifier (I7-4b–d, correctif de boucle) | Conforme |
| US28-4 (échéance non bloquante) | Objectif sans échéance : enregistrable en brouillon, T signalé par le contrôleur SMART uniquement (arbitrage du 13/10 respecté ; revue de code de la création d'objectif) | Conforme |
| US28-5 (contrôles identiques partout) | Formulaire US3 et ajout rapide du détail passent par la même `createTask` contrôlée ; la planification du rituel pose une date valide (« demain ») | Conforme |
| US29-1 (hors cycle impossible partout) | 5 transitions hors cycle testées : toutes refusées avec le motif « cycle strict » (I7-6) ; l'unique chemin du bouton est l'état suivant ; la clôture reste le seul passage à « terminée » (US4-c6) | Conforme |
| US29-2 (planifiée exige une date) | Sans date : refus « date planifiée requise » (I7-7) ; à l'écran, saisie en place — la transition ne s'effectue qu'avec une date valide | Conforme |
| US29-3 (ré-ouverture confirmée) | Panneau de confirmation ; confirmée : état « à planifier », restant restauré (borné à 0), dateFin effacée, événement journalisé (I7-9) ; annulée : aucun changement | Conforme |
| US29-4 (clic de trop inopérant) | Le bouton d'état d'une tâche terminée ouvre la confirmation, jamais la ré-ouverture directe (revue de code) | Conforme |
| US29-5 (invariant d'intégrité) | Cycle complet rejoué : dernière entrée = état courant à chaque transition, y compris ré-ouverture (I7-9b/I7-10) | Conforme |
| US30-1 (échéance proche d'abord) | 20/10 avant 05/11, indépendamment de la priorité d'objectif (I7-12) | Conforme |
| US30-2 (chaîne de départage totale) | À risque → priorité tâche → priorité objectif → date posée → restant décroissant, puis identifiant (I7-13/I7-14/I7-16) | Conforme |
| US30-3 (sans échéance en dernier) | Départagés par priorité de tâche (I7-15) | Conforme |
| US30-4 (périmètre et garde-fous inchangés) | Filtre (actives, non bloquées US19) et top 3 inchangés dans le rituel ; le tri ne filtre ni ne duplique (I7-16b) | Conforme |
| US30-5 (motif d'urgence visible, intitulé actualisé) | Chaque suggestion affiche échéance / ⚠ à risque / déjà datée ; la carte s'intitule « triées par urgence » (vérification UX ci-dessus) | Conforme |

**Verdicts** : **US28 validée** (5/5) · **US29 validée** (5/5) · **US30 validée** (5/5). **Anomalies : aucune** (ni bloquante, ni majeure, ni mineure).

**Conclusion** : l'itération 7 est soldée — première itération du backlog V2 livrée et validée, vérifications UX/UI intégrées au cycle sans écart. La maquette passe en **v0.9.0** (schéma v7 inchangé, aucune migration exécutée pendant la période d'usage réel) ; la période se poursuit sur la maquette mise à jour, le journal US22 documentant le changement de version au prochain démarrage. Prochaine étape du backlog : itération 8 (US25 → US26 → US24), au lancement convenu avec l'utilisateur.

### Livraison et recette — Itération 8 (13/10/2026)

*Lancement demandé explicitement par l'utilisateur en cours de période d'usage réel — seconde dérogation, plus lourde que celle de l'itération 7 : cette itération introduit **deux migrations de schéma chaînées** (v7 → v8 → v9) qui s'exécuteront sur les données d'usage réel au prochain chargement de la maquette. Précaution demandée et consignée : **exporter ses données (« ⬇ Exporter mes données ») avant de charger la v0.10.0**. Le critère de sortie « aucune migration en échec » s'appréciera au bilan du 27/10 sur l'ensemble des migrations exécutées pendant la période ; la réussite des deux passes restera traçable (journal des migrations A5 + journal d'activité US22). Version applicative relevée **v0.9.0 → v0.10.0**, schéma **v7 → v9**. Cycle complet : analyste (US déjà raffinées) → développeur → vérifications UX/UI → recette métier.*

**Rapport développeur** (maquette v0.10.0, schéma v9) :

- **US25** : l'attribut M devient un champ texte unique `mesurable` (le couple `mesurableValeur`/`mesurableUnite` disparaît du schéma) via la migration **`v07_v08_mesurable_texte`** (concaténation valeur + unité, sans perte, anciens champs retirés) ; le contrôle SMART M passe à « texte non vide » ; le contrôle d'intégrité v8 vérifie le type texte **et** l'absence de l'ancien couple ; le journal d'activité trace les modifications de M (ligne de diff mise à jour) ; création, édition SMART et détail affichent/saisissent le texte tel quel ; les exports `objectifs-donnees-v1` en schéma ≤ v7 s'importent par la chaîne US16 comme avant.
- **US26** : toutes les dates passent au **calendrier natif** (`type="date"`) — échéance cible (création + panneau d'édition), date planifiée (formulaire US3, ajout rapide US24, planification inline US29) — avec **stockage ISO `yyyy-mm-dd`** via la migration **`v08_v09_dates_iso`** : libellés roulants résolus au jour réel, jj/mm résolus à l'année courante la plus proche par `parseDDMM` existant ; raccourcis « Aujourd'hui » / « Demain » en un geste dans le panel de planification ; **avertissement explicite avant de confirmer une date passée** (second clic, bouton renommé) ; l'intégrité v9 rejette toute date non ISO ou inexistante (ex. 2026-02-31) ; `dateReelleDe` disparaît (dates réelles par construction) ; tous les consommateurs (SMART, urgence US30, accueil, rituel, calendrier de charge US20, burndown US9, sync agenda US1, affichages en jj/mm via `fmtIso`) passent à l'ISO **sans changement de comportement** ; la démo rejoue des dates ISO au jour réel.
- **US24** : la fenêtre de création d'objectif porte un **formulaire rapide de tâches liées** (titre*, priorité, charge > 0 contrôlée US28, date calendrier optionnelle) : les tâches sont stagées avant validation, listées (supprimables), puis **créées avec l'objectif en un seul `setData`** (chaînage `createTask`, ids uniques en lot) — un seul lot au journal d'activité (objectif créé + tâches créées) ; agrégats A2/US6 et SMART recalculés dès la validation.
- **Boucle de correction** : suite miroir **36/36 passants** — deux échecs inituels étaient des **attendus de harnais erronés** (ré-ouverture d'une tâche intégralement loguée → restant restauré 0 h, conforme ; tri US30 où l'échéance « 30/06 » passée se résout à l'année suivante, donc plus lointaine), corrigés côté tests sans défaut de code, plus un test complémentaire de restauration (passe < estime). Invariants de régression itération 7 rejoués : cycle strict, date exigée, bloquage US19, ré-ouverture, tri par urgence — tous passants.

**Vérifications UX/UI** (agent `objectifs-ux-ui-agent`, intégrées au cycle) :

| Livrable | Vérification | Verdict |
|---|---|---|
| Champ M texte unique (US25) | Label descriptif + exemples en placeholder (guide la saisie libre) ; plus de champ numérique ni unité ; cohérent création/édition ; contrôleur SMART temps réel fonctionnel avec le nouveau champ | Conforme |
| Calendriers (US26) | Composant natif homogène sur les 6 points de saisie (titre/label partout) ; fin des dates texte libre ; affichage stable jj/mm (`fmtIso`) partout | Conforme |
| Raccourcis Aujourd'hui/Demain + avertissement date passée (US26-c2) | Raccourcis en un geste dans le panel, même pattern que les boutons existants ; date passée → avertissement explicite ⚠ et confirmation dédiée (bouton renommé), annulable | Conforme |
| Formulaire US24 | Tâches stagées visibles avant validation (titre, badge priorité, charge, date) avec retrait un geste (`aria-label`) ; refus contrôlés affichés près de la saisie sans impact sur le reste ; libellés conformes US3 | Conforme |
| Messages de refus | Valeur fautive citée, règle explicite, rouge-600/blanc ≈ 4,5:1 (AA, pattern itération 7) | Conforme |

**Anomalies UX : aucune** (ni bloquante, ni majeure, ni mineure). **Observation** (non bloquante, reportée avec l'US27) : le focus clavier n'est toujours pas posé automatiquement sur le champ date du panel de planification.

**Recette métier — Itération 8** :

| Critère | Preuve observée | Verdict |
|---|---|---|
| US25-1 (champ texte unique partout, plus de valeur/unité) | Création et édition : un seul champ M texte, exemples en placeholder ; plus aucun `type="number"` ni champ unité pour M (revue d'écran + tests P7) | Conforme |
| US25-2 (M manquant uniquement si vide) | M vide → « M — Mesurable » signalé ; texte libre sans chiffre (« courir un marathon ») → conforme (P7) | Conforme |
| US25-3 (migration v7 sans perte, journal, intégrité v8) | « 100 % des murs peints », « 42.2 km » concaténés sans perte, anciens champs retirés, journal des migrations alimenté, intégrité v8 passante (P3/P3c/P5f) | Conforme |
| US25-4 (export v7 s'importe sans perte de M) | Chaîne v7→v8→v9 en une passe sur données réalistes, intégrité avant remplacement (mécanisme US23 inchangé), M conservé (P5) | Conforme |
| US25-5 (détail + badge affichent le texte) | Détail : `M : {texte}` ; contrôleur SMART temps réel au texte tel quel (revue d'écran) | Conforme |
| US26-1 (toute date via calendrier, plus de texte libre) | 6 saisies en `type="date"` : échéances (création, édition), dates planifiées (US3 ×2, US24, planification inline) ; plus aucun champ texte de date | Conforme |
| US26-2 (invalide non saisissable, passée avertie) | Sélecteur natif + garde ISO en dernier recours (P9) ; date passée → ⚠ avertissement puis confirmation dédiée avant planification | Conforme |
| US26-3 (migration ISO sans perte, année résolue, journal, intégrité v9) | « 15/12 » → 2026-12-15 ; « 30/06 » (passé) → 2027-06-30 ; « aujourd'hui »/« demain » → ISO du jour/lendemain ; journal alimenté ; intégrité v9 passante (P5b–P5f) | Conforme |
| US26-4 (comportements dépendants inchangés) | SMART T/risque sur ISO (P8/P8b), urgence US30 (P12), bloquage US19, ré-ouverture, tri — invariants rejoués conformes | Conforme |
| US26-5 (export antérieur importé, dates comprises) | Export v7 → chaîne US16 → intégrité avant remplacement, dates migrées (P5) | Conforme |
| US24-1 (tâches saisies avant validation, liées sans étape intermédiaire) | 2 tâches stagées créées liées à l'objectif en un seul `setData` (P13) ; pas d'étape intermédiaire | Conforme |
| US24-2 (apparaissent au détail, état initial) | Tâches visibles dans « Tâches liées » du détail après création ; **interprétation consignée** : état « à planifier » sans date, « planifiée » avec date (cohérent US3/US28) | Conforme |
| US24-3 (ajout sans titre refusé sans impact) | Refus titre/charge/date invalide, aucune tâche parasite, objectif et autres tâches intactes (P14) | Conforme |
| US24-4 (agrégats dès la validation) | Charge totale A2 et temps restant recalculés à partir des tâches créées (dérivés, P13d : 4,5 h pour 3 h + 1,5 h) | Conforme |
| US24-5 (formulaire rapide depuis le panneau d'édition) | **Interprétation consignée** : satisfait par le formulaire rapide du détail d'objectif existant (US13, critère 5), passant par la même `createTask` contrôlée et tracée au journal | Conforme |

**Verdicts** : **US25 validée** (5/5) · **US26 validée** (5/5) · **US24 validée** (5/5). **Anomalies : aucune** (ni bloquante, ni majeure, ni mineure). Interprétations consignées : US24-c2 (état initial selon la date) et US24-c5 (formulaire du détail préexistant) ; US26 : les jj/mm passés (ex. « 07/10 ») se résolvent à l'année suivante (règle de la fiche), la date réelle de complétion (`dateFin`) fait foi pour l'historique.

**Conclusion** : l'itération 8 est soldée — les trois US livrées et validées, migrations v7→v8→v9 en chaîne testées (36/36), vérifications UX/UI sans écart. La maquette passe en **v0.10.0** (schéma v9) ; **au prochain chargement, les migrations s'exécuteront sur les données d'usage réel** — l'export préalable demandé à l'utilisateur reste la précaution de référence, le bilan du 27/10 appréciera le critère de sortie sur l'ensemble des migrations de la période. Prochaine étape du backlog : itération 9 (US27 → US32 — fiche d'édition de tâche avec statut explicite et allègement des rangées).

### Livraison et recette — Itération 9 (13/10/2026)

*Lancement demandé explicitement par l'utilisateur en cours de période d'usage réel — troisième dérogation, la plus légère des trois : cette itération est **sans migration de schéma** (contrôles et UI purs), le schéma reste **v9** et aucune migration ne s'exécutera au chargement — le critère de sortie « aucune migration en échec » reste observable sans pollution du journal. Version applicative relevée **v0.10.0 → v0.11.0** (discipline US18). Cycle complet : analyste (US déjà raffinées) → développeur → vérifications UX/UI → recette métier.*

**Rapport développeur** (maquette v0.11.0, schéma v9 inchangé) :

- **US27 — fiche d'édition de tâche** : panneau plein écran en overlay (`role="dialog"`, bouton ✕ 44 px), ouvert depuis toute rangée de tâche — écran Tâches, « Tâches liées » du détail d'objectif, **suggestions du rituel du soir et programme du matin** ; **toutes les propriétés modifiables en une seule validation** (titre, objectif lié, priorité, charge estimée, temps restant, date planifiée au calendrier US26) avec les contrôles US28 (refus sans rien enregistrer) ; **statut explicite** : les 4 états visibles en boutons 44 px, l'état courant signalé ●, chaque transition passe par la matrice US29 (refus = règle affichée), « terminée » uniquement via la clôture US4-c6, ré-ouverture confirmée en sous-panneau ambre ; saisie de temps (US4), dépendances US19 avec détection de cycle, **historique d'états, historique des saisies et suppression logique confirmée** accessibles sans retour à la liste ; le journal d'activité trace deux nouveaux événements — **« tâche déplacée »** (changement d'objectif lié) et **« charge estimée »** (avant → après) — en plus du renommage préexistant.
- **US32 — allègement des rangées** : les rangées de l'écran Tâches et du détail d'objectif n'exposent plus que **l'état (cible portée à 44 px — dérogation itération 7 levée) et la fiche ✏️ (44 px)** ; les actions ⏱ (saisie de temps), 🔗 (dépendances) et 🗑 (suppression) migrent dans la fiche ; le badge d'état et la priorité restent visibles, le **cycle de priorité rapide reste sur la rangée** (version rapide expressément permise par la règle US32) et la priorité est aussi éditable dans la fiche ; le bouton cyclique d'état reste sur la rangée avec ses panneaux inline (planification, clôture, ré-ouverture) — l'US32 conserve le changement d'état sur la rangée.
- **Boucle de correction** : suite miroir **54/54 passants** (matrice choisirEtat complète, validation une-fois, traçage, recalculs inter-objectifs, régressions itérations 7/8). Deux échecs initiaux étaient des **attendus de harnais erronés** (le patch de test touchait le restant → événement « saisie » légitime ; les événements du journal référencent le titre courant de la tâche, pas l'ancien), corrigés côté tests sans défaut de code. **Un correctif de code appliqué pendant le développement** : la sélection « Terminée » depuis la fiche ouvrait le panneau de clôture depuis n'importe quel état, contredisant l'US29-c1 (« hors cycle impossible **partout** », fiche comprise) — la garde cycle strict est désormais posée dans la fiche (« Terminée » n'est atteignable que depuis « En cours », refus avec la règle affichée, test dédié passant).

**Vérifications UX/UI** (agent `objectifs-ux-ui-agent`, intégrées au cycle) :

| Livrable | Vérification | Verdict |
|---|---|---|
| Fiche d'édition (US27) | Overlay `role="dialog"` avec libellé, ✕ 44 px `aria-label` ; 4 boutons d'état `min-h-[44px]` avec état courant ● ; boutons texte lisibles (pas d'icône seule) ; fermeture par clic hors panneau ou ✕ | Conforme |
| Refus et règles dans la fiche | Message rouge-600 sur blanc (AA, pattern itération 7), règle en cause citée intégralement (cycle strict, bloquée US19, date requise) ; aucune transition silencieuse | Conforme |
| Sous-panneaux de la fiche | Patterns inline existants repris à l'identique (clôture emerald-50/700, ré-ouverture amber-50/800), annulables | Conforme |
| Rangées allégées (US32) | Cercle d'état et ✏️ en 44 px, `aria-label` + `title` dynamiques (prochaine étape annoncée) ; badge état + priorité visibles ; charge cognitive réduite (2 actions) | Conforme |
| Bouton ✏️ du rituel | `aria-label` + `title` ; cible 36 px (w-9 h-9) — **rituel hors périmètre US32** (l'US ne vise que les rangées de tâches) ; normalisation globale reportée à l'US31 (itération 10) | Conforme (périmètre) |
| Dépendances de la fiche | Ajout/retrait en un geste, cycle refusé avec message, bloquage affiché 🔒, estimation en attente si prérequis | Conforme |

**Anomalies UX : aucune** (ni bloquante, ni majeure, ni mineure). **Observations** (non bloquantes, reportées à l'US31 — itération 10) : les boutons secondaires `size="sm"` des sous-panneaux inline (≈ 32 px) suivent le pattern préexistant ; le bouton ↕ du programme du matin du rituel reste à 36 px d'altitude visuelle réduite ; le focus clavier n'est toujours pas posé automatiquement sur le premier champ de la fiche à l'ouverture.

**Recette métier — Itération 9** :

| Critère | Preuve observée | Verdict |
|---|---|---|
| US27-1 (écran d'édition depuis toute rangée, une validation) | Fiche ouverte depuis Tâches, « Tâches liées », rituel soir (suggestions) et matin (programme) ; patch complet en une validation (test B6 : titre trimé, objectif, priorité, charge 5 h, restant 3,5 h, date ISO) ; refus → rien enregistré (B1–B5) | Conforme |
| US27-2 (renommage tracé « tâche renommée ») | Test C3/C7 : événement « tâche renommée : « ancien » → « nouveau » » au journal (l'UI de renommage est nouvelle, le traçage préexistant) | Conforme |
| US27-3 (changement d'objectif → recalcul des deux) | Test D1–D3 : restant g1 11 → 7 h, g2 4 → 8 h, fin estimée de l'objectif cible repoussée ; événement « tâche déplacée … → objectif « Certification » » tracé | Conforme |
| US27-4 (statut explicite, refus avec règle, historique alimenté) | Matrice complète (A1–A13) : hors cycle refusé avec règle, planifiée sans date refusée, clôture bloquée US19 refusée, ré-ouverture confirmée ; invariant Passe 3 maintenu (dernière entrée = état courant à chaque étape) ; garde « Terminée » hors « En cours » ajoutée (US29-c1) | Conforme |
| US27-5 (historique, dépendances, saisies, suppression sans retour) | Cartes dédiées dans la fiche : historique d'états + saisies passées listées, dépendances ajoutées/retirées avec détection de cycle, suppression logique confirmée en 2 clics avec avertissement des tâches dépendantes | Conforme |
| US32-1 (2 actions visibles : état + éditer) | Rangées Tâches et détail : cercle d'état + ✏️ uniquement ; ⏱/🔗/🗑 retirés des rangées ; **interprétation consignée** : le bouton priorité reste sur la rangée en tant que « version rapide » expressément permise par la règle US32 ; le badge d'état reste affiché (information, pas une action) | Conforme |
| US32-2 (prochaine étape indiquée avant l'action) | `title` + `aria-label` dynamiques du bouton d'état (« Passer à « Planifiée » » / « Ré-ouvrir… confirmation requise ») | Conforme |
| US32-3 (actions secondaires en ≤ 1 interaction depuis la fiche) | Saisie de temps, dépendances, suppression et renommage chacun dans une carte dédiée de la fiche, atteignables en 1 clic depuis la rangée | Conforme |
| US32-4 (comportements métier inchangés) | Régressions rejouées (bloc E) : tri US5 des groupes, tri urgence US30, ISO US26, contrôles US28, bloquage US19, historique Passe 3 — tous passants ; cible d'état portée à 44 px (dérogation itération 7 levée) | Conforme |

**Verdicts** : **US27 validée** (5/5) · **US32 validée** (4/4). **Anomalies : aucune** (ni bloquante, ni majeure, ni mineure). Interprétations consignées : US32-c1 (« 2 actions » = état + fiche, priorité = version rapide permise par la règle US32 elle-même) ; le raccourci ⏱ de rangée est retiré au profit de la fiche (l'US32, plus récente, arbitre sur ce point de l'US27) ; le bouton cyclique d'état reste sur la rangée avec ses panneaux inline ; l'US29-c1 (cycle strict « partout », fiche comprise) prime sur la sélection libre : « Terminée » n'est atteignable que depuis « En cours » via la clôture.

**Conclusion** : l'itération 9 est soldée — les deux US livrées et validées, tests miroir 54/54, vérifications UX/UI sans écart bloquant ou majeur. La maquette passe en **v0.11.0** (schéma v9 inchangé) ; **aucune migration ne s'exécutera au chargement**, la période d'usage réel reste observable sans pollution du journal de diagnostic — la dérogation est donc la plus légère consignée à ce jour. Prochaine étape du backlog : itération 10 (US31 → US33 — normalisation 44 px/contrastes, durées lisibles, états vides guidés), volontairement **après le bilan de la période du 27/10/2026** pour ne pas fausser l'observation du critère de sortie.

### Incident bloquant et hotfix v0.11.1 — garde-fou persistance (19/10/2026)

**Signalement (Mathieu, 19/10/2026, en période d'usage réel)** : les données sont **réinitialisées entre deux ouvertures** de la maquette — l'usage réel est impossible en l'état. Anomalie classée **bloquante** (critère de sortie du MVP « sans perte de données » directement visé).

**Diagnostic (développeur + architecte)** :

- **Le code de persistance est sain** : charge et sauvegarde utilisent la même clé (`objectifs-app-data`, cloisonnée par compte US14/US15), les migrations et le contrôle d'intégrité s'exécutent au chargement, l'effet racine de sauvegarde réécrit l'espace actif à chaque changement. Le domaine métier (US15) n'est pas en cause.
- **Cause racine identifiée : le runtime d'exécution de la maquette (bac à sable du canvas) ne garantit pas un stockage persistant entre les sessions** — le `localStorage` y est éphémère ou indisponible. Tous les accès sont enveloppés de `try/catch` silencieux (« mémoire seule ») : l'application redémarre donc sans erreur visible sur les données de démonstration, ce qui masque la perte.
- **Diagnostic de confirmation** (si besoin) : l'écran 🧾 Journal ne montre que les événements de la session courante — aucun événement des jours précédents ne survit à la réouverture.
- **Cas secondaire distingué** (si un compte Google fictif est connecté) : au démarrage l'application charge l'espace LOCAL par design (US14) ; les données du compte ne sont pas perdues, elles redeviennent visibles après reconnexion — comportement nominal, hors périmètre de l'incident.

**Décision** : aucun changement de domaine ni de schéma (discipline « pas de migration pendant l'usage réel » respectée — le hotfix est un garde-fou de présentation et d'avertissement). Le remplacement du stockage local par la persistance distante reste **acté en Option E** (ADR-10, DAT v1.1), post-MVP. Correctif livré en **v0.11.1** :

1. **Sonde de persistance** (`diagnosticStockage`) : au démarrage, une sonde datée (`objectifs-app-data::sonde`) est posée dans le stockage ; sa présence à l'ouverture suivante prouve la persistance. Trois statuts : `indisponible` (stockage en échec), `ephemere` (sonde absente — première utilisation **ou** stockage perdu), `persistant` (sonde survivante).
2. **Bannière d'avertissement** (non bloquante, ambre, sous l'en-tête) affichée tant que le statut n'est pas `persistant` : « ⚠️ Stockage non persistant — exportez vos données (onglet ☁️ Google → Exporter US23) avant de fermer, importez-les à la réouverture ».
3. **Traçage US22** : événement « stockage » au démarrage avec le statut, marqué en erreur si non persistant — le journal de diagnostic documente l'incident pour le bilan.
4. **Version** : v0.11.0 → **v0.11.1** (discipline US18), schéma v9 inchangé, aucune migration.

**Tests miroir** : suite dédiée **11/11 passants** (copies exactes : runtime sans `localStorage` → `indisponible` ; stockage en échec → `indisponible` ; stockage vide → `ephemere` + sonde posée datée du jour ; sonde survivante → `persistant` sans réécriture ; stockage effacé entre sessions → retour à `ephemere` ; bannière affichée/masquée selon le statut ; trace démarrage marquée erreur si non persistant). Aucun défaut de code ni de harnais — premier passage vert.

**Protocole d'usage réel ajusté (jusqu'au bilan du 27/10)** : pont export/import US23 systématique — **exporter avant de fermer, importer à la réouverture** ; le journal sera discontinu (chaque session repart des données réimportées), le bilan du 27/10 en tiendra compte. L'export du 27/10 (A-001) devra être refait à partir du dernier export/état en cours.

**Hotfix v0.11.2 (19/10/2026, soir) — correctif du correctif** : la v0.11.1 introduisait le **seul accès au stockage non gardé** du fichier (lecture de `localStorage` au démarrage pour poser la sonde). Or dans le runtime bac à sable, la seule lecture de `localStorage` peut lever une `SecurityError` (origine opaque) — `typeof` déclenche aussi l'accesseur — d'où un **plantage au démarrage (écran blanc)** observé à la réouverture de la maquette. Ce plantage affine la cause racine de l'incident : le stockage n'y est pas « éphémère » mais **inaccessible** (masqué depuis l'origine par les `try/catch` silencieux « mémoire seule » — ce qui explique aussi le signalement initial). Correctif : accès entièrement gardé via `statutStockageInitial` (statut `indisponible`), invariant « aucun accès au stockage non gardé » restauré ; bannière, trace et sonde inchangées (la bannière affichera la variante « stockage indisponible »). Tests miroir dédiés **8/8** (dont : lecture levante → `indisponible` sans plantage ; un attendu de harnais erroné corrigé côté tests — faux stockage partagé entre deux cas — aucun défaut de code). **La recette H1–H5 s'applique désormais à la v0.11.2.**

**Recette métier (à passer par Mathieu, puis à solder)** :

**Livraison v0.11.4 (19/10/2026, soir) — UX/UI, fiche d'édition US27, demande explicite utilisateur** (dérogation à la période d'usage réel, sans impact domaine ni schéma) : les libellés des champs n'étaient pas identifiables — le titre n'avait qu'un `placeholder` (disparaissant dès la saisie), l'objectif lié et la priorité n'avaient qu'un `aria-label` invisible, charge/restant/date qu'une infobulle au survol (heuristique Nielsen #6 « reconnaissance plutôt que rappel », association WCAG). Correctif : **6 libellés visibles et associés** (`htmlFor`/`id` : Titre, Objectif lié, Priorité, Charge estimée (h), Temps restant (h), Date planifiée), obligatoires marqués * rouge (titre, objectif, charge), placeholder neutre d'exemple, tooltips conservés en complément. Contrôles US28 et légende inchangés ; revue statique 18/18 (2 faux échecs de harnais : placeholders « Titre * » légitimes des formulaires de *création*, hors périmètre). **Observation reportée à l'US31 (itération 10)** : les formulaires de création (objectif ligne 1044, tâche ligne 1545) présentent le même pattern libellé-placeholder — à normaliser dans la passe design.

### Revue UX/UI globale — consensus tripartite (19/10/2026)

Revue exhaustive des écrans (grille Nielsen + axes 44 px / AA / aria / états vides) à la demande explicite de l'utilisateur. Huit propositions P1–P8, **toutes Adoptées**, sans impact domaine ni schéma, **positionnées après le bilan du 27/10** (discipline de période — aucune modification pendant l'usage réel) :

| # | Constat (localisé) | Recommandation | Verdict / positionnement |
|---|---|---|---|
| P1 | Formulaires de création (objectif, tâche) : libellés en placeholders uniquement | Libellés visibles `htmlFor`/`id` (pattern v0.11.4) | Adoptée — **absorbée par US31** |
| P2 | Navigation : 8 onglets 10 px, ~34 px de haut, sans état courant programmatique | `aria-current="page"`, cible ≥ 44 px, texte 11 px | Adoptée avec modification — **US31 élargie** |
| P3 | Fiche US27 : focus non piégé, non posé à l'ouverture | Autofocus premier champ + piège de focus (guide §2.6) | Adoptée — **US31** (déjà observée it. 9) |
| P4 | ~15 boutons < 44 px (sous-panneaux inline, cartes Google/Rituel) | Normalisation 44 px | Adoptée — **US31** (dérogation existante levée) |
| P5 | Accueil « Programme du jour » : rangées non cliquables, sans title | Rangée cliquable → fiche US27, `aria-label`+`title` | Adoptée avec modification — **US31 élargie** |
| P6 | Erreurs sans `role="alert"`/`aria-live` (fiche, Tâches) : non annoncées au lecteur d'écran | `role="alert"` sur tous les bandeaux d'erreur | Adoptée avec modification — **US31 élargie** |
| P7 | Google : bouton ternaire au libellé identique dans les deux branches ; export JSON 10 px illisible | Libellé explicite hors connexion ; export 12 px | Adoptée avec modification — **US31 élargie** |
| P8 | États vides constatés sans action directe | Phrase + bouton d'action | Adoptée — **absorbée par US33** |

Consensus : développeur — édits ciblés, aucune fonction pure touchée, aucun risque de migration, suite de tests sans impact ; analyste — cohérence US1-33 vérifiée (P5 s'appuie sur US27, P6 renforce US28, P7 renforce US1), aucune nouvelle US, périmètre US31 élargi aux réserves P2/P5/P6/P7. Première application : **itération 10 (30/10–05/11)** selon le cycle de développement v2 (RT : contrôle d'explicité US31/US33 élargies → conception + plan de tests macro → dev : relecture, développement, relecture code RT, tests).

### Bilan d'usage réel — clôture anticipée (19/10/2026, décision client)

**Motif de la clôture anticipée** : l'incident bloquant de persistance (stockage **inaccessible** dans le runtime de la maquette — cf. section incident et hotfix) rend l'usage réel impossible : les données sont réinitialisées à chaque fermeture, malgré le garde-fou v0.11.2 et le pont export/import US23. La poursuite de la période jusqu'au 27/10 n'apportait plus d'observations exploitables ; Mathieu a décidé de clôturer la période le 19/10 (5 jours au lieu de 14).

**Observations de la période (13/10 → 19/10)** :

- **Usage réel interrompu** : à partir du signalement, chaque session repartait des données de démonstration ; le journal d'activité US22 est donc **discontinu** (événements de session uniquement). Les observations d'usage exploitable se limitent aux jours précédant l'incident.
- **Trois correctifs livrés le 19/10** (v0.11.1 garde-fou → v0.11.2 accès gardé → v0.11.3 régression `vel` du rituel) et **une livraison UX** (v0.11.4 — libellés de la fiche d'édition, demande explicite) ; **revue UX/UI globale consignée** (P1–P8 ci-dessus).
- **Recette des correctifs (H1–H5) non encore passée** — première action attendue de Mathieu, avec l'**export de la session courante** (A-001) avant toute fermeture : les données des sessions antérieures sont perdues (stockage inaccessible), l'export du 27/10 initialement prévu est remplacé par l'export du dernier état exploitable.

**Critère de sortie « 2 semaines d'usage réel sans perte de données »** : **non observable sur la maquette** — dérogation définitive consignée. L'observation sera conduite sur le **livrable PWA** (localStorage persistant d'un vrai navigateur) : import du dernier export au M0, suivi d'usage pendant M1, appréciation du critère au M4 (recette finale). La trajectoire de remède est déjà actée (persistance distante Option E, ADR-10, post-MVP).

**Décisions consécutives (actées)** :

1. **Itération 10 avancée au 20/10** (au lieu du 30/10) — US31 (élargie P2/P5/P6/P7) puis US33, première application du **cycle de développement v2**.
2. **Replanification globale** : jalons avancés d'environ deux semaines (M0 : 27/10-02/11, M1 : 03-13/11, M2 : 16-24/11, M3 : 25/11-01/12, M4 : 02-08/12) ; sortie MVP ≈ **mi-décembre 2026**, sous réserve des 2 semaines d'usage réel documentées sur le livrable.
3. **Phasage V2 (D-1, A-011)** : **maintenu sans changement** — V2-S1′ sauvegarde Drive (~2-3 j) puis V2-S2′ synchronisation (~3-5 j) post-MVP ; le bilan anticipé n'apporte pas d'élément nouveau.

### Livraison et recette — Itération 10 (20/10/2026) — première application du cycle de développement v2

*Lancée à la demande explicite de l'utilisateur le 19/10 au soir (clôture anticipée de l'usage réel). Cycle v2 tracé : **RT** — contrôle d'explicité (verdict « prêt », 6 interprétations I1–I6 consignées : I1 durées via `h()` seule + vélocité = cadence inchangée ; I2 piège focus = autofocus + Tab borné + Escape ; I3 états vides sur les 6 écrans nommés ; I4 Bienvenue = aucun objectif actif, masquage par session ; I5 onglets non tronqués 44 px/11 px ; I6 contrastes globaux sauf fonds sombres), **conception en 7 lots avec plan de tests macro TM1–TM11** ; **dev** — relecture de conception (1 retour intégré : export sombre traité avant le remplacement global), développement, puis **tests** après la **relecture de code du RT** (3 constats corrigés : 2 durées décimales résiduelles, cellules calendrier 9 px → 10-11 px avec dérogation densité consignée).*

**Rapport développeur** (maquette **v0.12.0**, schéma v9 inchangé, aucune migration) :

- **US31 (élargie P1–P7)** : navigation 8 onglets « Aujourd'hui »/« Calendrier » non tronqués, `aria-current="page"`, cibles 44 px, texte 11 px ; **focus visible global** (`focus-visible` sur 100 % des interactifs via style racine) ; **piège de focus** de la fiche US27 (autofocus titre, Tab borné, Escape ferme) ; `role="alert"` sur les 3 bandeaux d'erreur ; libellés associés (`htmlFor`/`id`) sur les **8 champs des formulaires de création** (objectif + tâche) ; contrastes : `slate-400`→`slate-500` et 10 px→11 px globaux (0 occurrence restante) ; accueil — rangées du jour cliquables vers la fiche ; Google — libellé explicite hors connexion, export 12 px.
- **US33** : durées lisibles partout via `h()` (arrondi 5 min, stockage décimal intact) ; états vides **guidés** sur les 6 écrans (Tâches, Objectifs, Accueil, Stats, Journal, Calendrier — phrase + action directe) ; **carte « Bienvenue — 3 étapes »** sur un espace sans objectif actif, masquable manuellement (session), disparaissant automatiquement dès qu'un objectif existe.
- **Boucle de correction** : suite macro **TM1–TM11 : 11/11 passants** après correction d'1 défaut réel détecté par TM9 (durée décimale résiduelle dans le rituel) ; les autres écarts du premier passage étaient des attendus de harnais mal formulés (« 1 » vs « true », « ≥1 » vs « 2 »), corrigés côté tests. **Régressions : aucune** — domaine et schéma inchangés (clôture US4-c6, vélocité, migrations intactes).

**Recette métier — Itération 10 (passée le 20/10/2026, verdict rendu)** :

| # | Critère | Preuve observée | Verdict |
|---|---|---|---|
| R1 | Durées lisibles partout (US33-c1) | h(2,5) = « 2 h 30 », h(0,75) = « 45 min », arrondi 5 min vérifié (3,33 h → 3 h 20) ; 37 affichages via `h()`, 0 décimal résiduel (la vélocité « h/sem » est une cadence, hors périmètre durée — interprétation I1) | Conforme |
| R2 | Cibles 44 px et onglets lisibles (US31-c1) | Onglets « Aujourd'hui »/« Calendrier » non tronqués, `min-h-[44px]` + 11 px, `aria-current="page"` ; 6 cibles `w-11 h-11` (44 px) sur rangées et fiche | Conforme |
| R3 | Focus clavier (US31-c3) | `focus-visible` global au style racine ; fiche : autofocus Titre, Tab piégé (Shift+Tab premier→dernier), Escape ferme | Conforme |
| R4 | Erreurs annoncées (P6) | 4 `role="alert"` : les 3 bandeaux d'erreur (fiche, Tâches, création objectif) **+ la bannière de persistance v0.11.2** — avertissement annoncé également, cohérent et intentionnel | Conforme |
| R5 | Libellés de création (P1) | 8 champs (gc-/nt-) avec `label htmlFor` + `id` associés ; plus aucun placeholder porteur de libellé | Conforme |
| R6 | Accueil (P5 + US33-c3) | Rangées du jour `role="button"` → fiche ; carte Bienvenue conditionnée « aucun objectif actif », ✕ = masquage session, condition recalculée au rendu (disparition à la création sans rechargement) ; vide du jour guidé avec bouton rituel | Conforme |
| R7 | États vides guidés (US33-c2) | Les 6 écrans nommés (Tâches, Objectifs, Accueil, Stats, Journal, Calendrier) portent phrase + action directe | Conforme |
| R8 | Aucune régression métier (US33-c4) | Schéma v9 intact (aucune migration) ; correctifs v0.11.2/v0.11.3 en place ; US23 export/import/reset, US4-c6 clôture, US30 tri d'urgence, US22 journal présents à l'identique | Conforme |

**Verdicts recette** : **US31 (élargie P1–P7) validée** (5/5) · **US33 validée** (4/4). **Anomalies : aucune** (ni bloquante, ni majeure, ni mineure). Deux faux négatifs du harnais de recette distingués des défauts de code et corrigés côté harnais : le 4ᵉ `role="alert"` est la bannière de persistance (conforme) ; le test du câblage Rituel butait sur la flèche `=>` du JSX (vérification directe : `vel={vel}` bien passé). La boucle correction/re-recette du cycle v3 n'a **pas** été déclenchée — acceptation au premier passage.

**Conclusion** : l'itération 10 est **soldée et acceptée par le métier** — US31/US33 validées sans anomalie, maquette **v0.12.0** (schéma v9 inchangé, aucune migration). Cycle v3 exécuté intégralement pour la première fois : contrôle d'explicité RT → conception + plan TM → relecture dev → développement → revue de code RT (3 constats corrigés) → tests 11/11 → **recette métier 8/8 au premier passage**. Prochaine étape : **M0 — socle PWA (27/10 → 02/11)**, avec import du dernier export et arbitrage R1 avant le 02/11.

**Arbitrage R1 final (rendu par Mathieu le 20/10/2026)** : la trajectoire est confirmée — **PWA** (TWA définitivement écartée), notifications des rituels via **rappels Google Calendar** (D-2 du 19/10, ADR-11, implémentation au M3 en continuité de M2 OAuth/Calendar), et **nouvelle exigence consignée : portabilité sur navigateur de PC** — le livrable doit être installable et pleinement fonctionnel sur navigateur desktop (usage au bureau), pas seulement sur mobile. Le choix des rappels Calendar rend cette exigence naturelle : les notifications arrivent dans Google Calendar sur **tous** les appareils connectés (PC, mobile, web), indépendamment des limites d'arrière-plan des PWA — aucune implémentation native mobile n'est requise. Implications : M0 vérifie l'installabilité sur navigateur desktop ET mobile ; M3 recette les rappels sur le couple PC + mobile ; US11 (rituels 21 h/7 h) inchangée dans ses critères, seul le canal de notification est Calendar.

**Suivi post-arbitrage (20/10/2026, décisions client)** : **A-001 soldé** — Mathieu a réalisé l'export du dernier état exploitable (import de référence pour le M0) ; **A-012 annulée** — la recette H1–H5 des correctifs v0.11.x est abandonnée (usage réel clos, export sécurisé) ; les garanties correspondantes (persistance, bannière) seront vérifiées sur le livrable PWA au M0. **Workflow de développement v4 (guide v1.4)** : le cycle v3 est complété par une **validation de la conception du RT par l'architecte logiciel avant le développement** (conformité DAT/ADR, verdict Conformité / Conformité avec réserves / Non conforme) ; la relecture du développeur suit cette validation, la boucle d'acceptation métier est inchangée. Première application : itération M0 du 27/10.

**Hotfix v0.11.3 (19/10/2026, soir) — régression itération 9 corrigée (US30)** : `ReferenceError: vel is not defined` à l'ouverture de l'onglet 🌙 Rituel. Le tri d'urgence US30 (itération 9) utilisait la vélocité (`vel.velocite`, 2 occurrences : `triParUrgence` des suggestions du soir, `smartCheck` du motif d'urgence du matin) alors que le composant `Rituel` ne déclarait pas la prop `vel` et que `App` ne la lui passait pas — échec masqué lors de l'itération 9 car le tri d'urgence avait été testé en miroir sur la fonction pure, pas via le câblage JSX de l'écran (leçon consignée : les tests miroir couvrent le domaine, pas le câblage des composants). Correctif : prop déclarée et passée (`vel={vel}`), version v0.11.3, schéma v9 inchangé. Vérification 6/6 : signature et appel câblés, `vel` défini dans `App`, aucun autre composant orphelin (audit statique de tous les composants). **La recette H1–H5 s'applique à la v0.11.3** (test supplémentaire : ouvrir l'onglet Rituel — soir et matin — sans erreur).

| # | Critère | Preuve attendue | Verdict |
|---|---|---|---|
| H1 | Bannière visible à l'ouverture (stockage non persistant du runtime) | Bandeau ambre sous l'en-tête au premier chargement | À passer |
| H2 | La bannière indique le pont de secours | Message cite l'onglet ☁️ Google et l'export US23 | À passer |
| H3 | Le journal 🧾 trace l'événement « stockage » au démarrage | Événement visible avec statut (erreur si non persistant) | À passer |
| H4 | Export avant fermeture → import à la réouverture → données intactes | Round-trip US23 : objectifs, tâches et saisies restaurés ; bannière toujours affichée (stockage éphémère) | À passer |
| H5 | Aucune régression du domaine | Comportements métier inchangés (schéma v9, aucune migration au chargement) | À passer |



### US34 — Socle PWA installable (jalon M0, proposée le 20/10/2026)

**En tant qu'** utilisateur de « Objectifs », **je veux** une PWA installable sur mobile et sur navigateur de PC, **afin de** disposer d'un livrable réel persistant (données conservées entre sessions) où importer mes données existantes, remplaçant l'usage de la maquette.

**Écran concerné** : socle applicatif du livrable (coquille PWA — écran d'accueil lecture seule du périmètre M0 ; le portage complet des écrans est le jalon M1, US « portage »).

**Règles de gestion** :
- Le socle est un projet multi-fichiers à **build rejouable et sans dépendance externe** (le build doit pouvoir être rejoué à l'identique).
- La persistance utilise le `localStorage` du navigateur (vrai stockage persistant), conformément à ADR-01/ADR-02 ; le format de données exportable/importable est « objectifs-donnees-v1 » (schéma v9), identique à l'US23 de la maquette.
- L'import d'un export « objectifs-donnees-v1 » remplace l'espace actif ; tout contenu non reconnu est refusé explicitement **sans modifier les données existantes**.
- Portabilité desktop (arbitrage R1) : l'application doit être installable et fonctionnelle sur navigateur de PC (Chrome/Edge) **et** mobile (Chrome Android).

**Critères d'acceptation** :
1. `npm run build` (Node, zéro dépendance) produit un livrable complet dans `dist/` ; deux builds successifs depuis les mêmes sources produisent des sorties identiques.
2. Manifeste PWA complet : nom « Objectifs », `start_url`, `display: standalone`, icônes 192 px et 512 px.
3. Service worker : la coquille applicative est servie depuis le cache — l'application se charge sans réseau.
4. Installabilité : critères satisfaits (HTTPS, service worker avec gestionnaire `fetch`, manifeste complet) sur navigateur desktop **et** mobile ; invite/barre d'installation observable.
5. Persistance : les données sont conservées entre fermeture et réouverture dans un vrai navigateur (localStorage persistant, plus de perte de session).
6. Import d'un export « objectifs-donnees-v1 » (schéma v9) : données visibles à l'accueil (objectifs, tâches) ; refus explicite d'un contenu non reconnu sans impact sur l'existant.
7. Export au format « objectifs-donnees-v1 » ; round-trip import → export sans perte.
8. L'accueil du socle affiche en lecture seule objectifs et tâches importés, avec le statut de stockage (persistant/indisponible) et la version app ↔ schéma.
9. Portabilité PC : navigation souris/clavier fonctionnelle et lisible en fenêtre desktop large.

### Livraison M0 — socle PWA (cycle v4, lancée le 20/10/2026)

**RT — contrôle d'explicité et readiness de l'US34** : verdict **« prêt »**. L'US est claire, testable et estimable ; interprétations consignées : **I1** — US34-c8 « lecture seule » : aucune édition au M0, les écrans complets arrivent en M1 (l'accueil suffit à prouver persistance + import) ; **I2** — US34-c1 « sorties identiques » : comparaison empreinte à empreinte du contenu de `dist/`, la date de build n'étant pas injectée dans les fichiers (version injectée, pas d'horodatage) ; **I3** — US34-c3/c4 : les critères d'installabilité et de chargement hors ligne sont prouvés par analyse statique (présence et conformité du SW et du manifeste) + recette navigateur réel à passer par Mathieu (desktop ET mobile), la maquette d'environnement ne pouvant pas rendre un navigateur ; **I4** — US34-c6 : la validation d'import exige `format = objectifs-donnees-v1` et `version = 9`, tout autre contenu est refusé sans écriture ; **I5** — US34-c9 : cible desktop ≥ 1024 px, navigation clavier complète (focus visible, focusables natifs), aucune exigence de nouvelle UI (reprise du vocabulaire visuel de la maquette).

**RT — conception (7 lots) et plan de tests macro** :
- **L1 — Outillage** : projet multi-fichiers `objectifs-pwa` (ES modules), `package.json` (scripts `build`/`test`, zéro dépendance), `build.js` (copie `src/` → `dist/`, injection version app, génération des icônes PNG par encodeur pur Node — pas d'asset binaire en entrée, garant de la rejouabilité I2).
- **L2 — Manifeste + icônes** : `manifest.webmanifest` (nom « Objectifs », `start_url: ./`, `display: standalone`, `standalone` + icônes 192/512) ; icônes générées par L1.
- **L3 — Service worker** : pré-cache de la coquille (HTML, CSS, JS, manifeste, icônes) dans un **cache versionné par version d'app** (invalidation au changement de version, conforme ADR-02), `fetch` en cache-first pour la coquille.
- **L4 — Persistance** : adaptateur `localStorage` **entièrement gardé** (leçon de l'incident v0.11.1/0.11.2 : aucun accès non gardé), clé unique versionnée, statut de stockage exposé (`persistant`/`indisponible`) et affiché (US34-c8).
- **L5 — Domaine import/export** : logique pure — `importerDonnees` (validation format « objectifs-donnees-v1 », schéma v9, refus sans écriture) et `exporterDonnees` (ré-encapsulation contexte) ; testable hors navigateur (node:test).
- **L6 — UI socle** : `index.html` + `app.js` — accueil lecture seule (objectifs → tâches), import/export par fichier, bannière statut stockage, version app ↔ schéma affichée ; navigation clavier native, focus visible.
- **L7 — Tests** : suite `node:test` (domaine pur + vérifications statiques du livrable) ; les tests liés au navigateur réel (c3 observé, c4, c5, c9) font l'objet de la recette métier et de la vérification de Mathieu.

**Plan de tests macro (TM1–TM12)** : TM1 export → structure « objectifs-donnees-v1 » complète (contexte versions/espace/date, `account` exclu) · TM2 import d'un export v9 valide → accepté, données accessibles · TM3 import d'un contenu non reconnu (JSON illisible, mauvais format, mauvais schéma) → refus explicite, données existantes intactes · TM4 round-trip import → export → identité structurelle des données · TM5 persistance : écriture/lecture/rechargement via adaptateur gardé (localStorage réel ou mock) ; statut `indisponible` si accès en échec, sans plantage · TM6 build rejouable : deux builds → empreintes identiques · TM7 `dist/` complet : HTML, CSS, JS, manifeste, SW, icônes présents · TM8 manifeste : champs obligatoires + icônes 192/512 valides (signature PNG, dimensions) · TM9 SW : gestionnaire `fetch` présent, cache versionné par version d'app · TM10 cohérence version : version app injectée identique dans HTML/manifeste/SW · TM11 domaine pur sans dépendance DOM : import/export testables hors navigateur · TM12 lancement de la suite complet sans échec.

**Architecte — validation de la conception (cycle v4, 20/10/2026)** : verdict **Conformité avec réserves, levées avant développement**. La conception est conforme aux ADR-01 (statique, coût nul), ADR-02 (versionnage app ↔ schéma — cache SW versionné) et à l'exigence desktop du jalon (arbitrage R1). **Écart structurel relevé et arbitré par ADR-13** : la roadmap du DAT prévoyait Vite + Workbox au M0 ; la conception RT retient un **build Node zéro dépendance** — retenu pour la rejouabilité bit à bit (I2/TM6), l'absence de chaîne d'outillage à auditer et la suppression des assets binaires (icônes générées) ; réévaluation Vite/Workbox prévue aux M1/M2 si la complexité l'exige. Réserves : (r1) le SW doit gérer l'invalidation au changement de version — couvert par L3 ; (r2) l'adaptateur de persistance doit rester entièrement gardé (leçon incident v0.11.x) — couvert par L4 ; (r3) l'import ne doit jamais écrire en cas de refus — couvert par L5/I4. DAT amendé en v1.2 (ADR-13 + exigence desktop M0). **Développement autorisé.**

**Rapport développeur (M0 — socle PWA, livrable `objectifs-pwa` v0.13.0-m0, schéma v9)** :

- **Relecture de conception** : 1 retour intégré (icônes générées au build ajoutées au pré-cache du SW). Aucun autre écart.
- **Développement selon les 7 lots de la conception** : L1 outillage Node zéro dépendance (`build.js`, injection version, encodeur PNG pur — ADR-13) ; L2 manifeste (`display: standalone`, start_url/scope/id `./`, icônes 192/512 générées) ; L3 service worker (pré-cache coquille, cache versionné `objectifs-<version>`, invalidation au changement de version, cache-first) ; L4 adaptateur persistance entièrement gardé (`statut` persistant/indisponible, lecture/écriture gardées — leçon incident v0.11.x) ; L5 domaine pur import/export « objectifs-donnees-v1 » (validation format + schéma v9, **refus sans écriture**) ; L6 UI socle (accueil lecture seule objectifs/tâches, import fichier, export téléchargement, bannière stockage, version app ↔ schéma, focus visible, cibles 44 px) ; L7 suite `node:test`.
- **Revue de code RT (avant tests)** : 2 constats, corrigés — (1) bloquant : script `test` (`node --test tests/`) non fonctionnel en Node 22/ESM → suite énumérée ; (2) non bloquant : `id: "/"` du manifeste contradictoire avec `scope: "./"` → `id: "./"`.
- **Tests (plan macro TM1–TM11 + TM12)** : **11/11 passés, 0 échec** (TM12 : suite complète sans échec). Aucune itération de correction supplémentaire après les deux constats de revue. Les critères nécessitant un navigateur réel (c3 observé, c4, c5, c9) restent à la recette/usage navigateur conformément à I3.

**Revue de fin de développement (RT + dev + analyste)** : conformité au guide (§2.2 dates ISO, §4.1 harnais d'abord, §4.6 aucun secret, zéro dépendance), au DAT (ADR-01/02/13) et à la conception validée constatée ; `dist/` complet et rejouable (TM6/TM7) ; pas de dette non justifiée. **Passage en recette métier autorisé.**

**Recette métier — M0 socle PWA (US34, cycle v4)** :

| # | Critère | Preuve observée | Verdict |
|---|---|---|---|
| M0-1 | Build rejouable sans dépendance | `node build.js` ×2 → `dist/` identique empreinte à empreinte (TM6) ; aucun package externe (ADR-13) | Conforme |
| M0-2 | Manifeste complet (nom, start_url, standalone, icônes 192/512) | TM8 : champs vérifiés, PNG signatures et dimensions valides ; `display: standalone` | Conforme |
| M0-3 | Service worker, coquille hors ligne | TM9 : `fetch` handler, pré-cache coquille + icônes, cache versionné ; chargement sans réseau observable uniquement en navigateur réel (I3) | Conforme (analyse statique) — à confirmer navigateur |
| M0-4 | Installable desktop ET mobile | Critères d'installabilité satisfaits par construction (manifeste + SW + HTTPS requis à l'hébergement) ; **invite d'installation observable uniquement en navigateur réel** | À confirmer par Mathieu |
| M0-5 | Persistance entre sessions | Adaptateur gardé + clé `objectifs-espace-v9` (TM5) ; conservation observable uniquement en navigateur réel | À confirmer par Mathieu |
| M0-6 | Import v9 valide → visible ; refus sans impact | TM2/TM3 : accepté, objectifs/tâches rendus à l'accueil ; refus explicites (JSON illisible, format, schéma ≠ 9, incomplet) sans écriture | Conforme |
| M0-7 | Export + round-trip sans perte | TM1/TM4 : format complet, compte exclu, identité structurelle | Conforme |
| M0-8 | Accueil lecture seule, statut stockage, version affichée | Inspection du livrable : sections Objectifs/Tâches, bannière `role="alert"` si stockage indisponible, « App v0.13.0-m0 · schéma v9 » | Conforme |
| M0-9 | Portabilité PC (navigation, fenêtre large) | Layout 1024 px, focus visible global, cibles 44 px, navigation clavier native ; usage réel en fenêtre large à confirmer | Conforme — à confirmer navigateur |

**Verdict recette : US34 Validée avec réserves** — aucune anomalie bloquante ni majeure ; 9/9 critères conformes ou conformes par analyse statique. **Réserves (mineures, listées pour vérification en conditions réelles)** : (r1) invite d'installation observée sur Chrome/Edge desktop **et** Chrome Android (M0-4) ; (r2) chargement hors ligne (M0-3) ; (r3) persistance fermeture/réouverture (M0-5) — import initial avec l'export A-001, données visibles à l'accueil. Ces vérifications exigent un hébergement HTTPS + navigateurs réels, hors de portée de l'environnement de recette : elles incombent à Mathieu à la mise en ligne du socle. **La boucle correction/re-recette n'est pas déclenchée** ; US34 close côté métier sous réserve des constats de mise en ligne.

### Évolution du processus — BDD/TDD, cycle v5 (décision client du 20/10/2026)

À compter de cette décision, le cycle de développement (guide v1.6, §5.1 v5) intègre le **BDD** et le **TDD** :

- **Scénarios Gherkin par l'analyste métier** : chaque critère d'acceptation d'une US est formulé en scénario (Étant donné / Quand / Alors) et consigné dans un **fichier `.feature`** par US, plus les scénarios de limite. La `.feature` est un livrable de l'analyste : le développeur ne la modifie pas (écart → signalement au RT) ; les anomalies de recette sont retournées en **nouveaux scénarios testables**.
- **TDD côté développeur** : steps et tests d'abord (rouge), comportement minimal ensuite (vert), refactorisation ; la **suite de toutes les `.feature` livrées = non-régression fonctionnelle**, rejouée avant toute déclaration **ready** d'une US — c'est la précondition des revues de fin de développement et de la recette métier.
- **Exécution** : runner Gherkin **zéro dépendance** du livrable PWA (ADR-14) ; la non-régression est intégrée au cycle de test du build.
- **Rétro-conversion** : les US déjà livrées (US1–US34) sont converties **progressivement** — en priorité le périmètre MVP (US3–US14) au lancement du M1, puis les autres au fil des jalons ; aucune conversion en bloc. La `.feature` **US34** (socle M0) est livrée immédiatement comme première application.
- La recette métier reste l'apanage de l'analyste : la suite BDD verte est une **précondition**, pas un substitut — la recette rejoue les parcours bout-en-bout et les limites en s'appuyant sur les scénarios.

**Première application (20/10/2026)** : la `.feature` **US34** est livrée (5 scénarios : import v9 valide, refus sans impact, round-trip, stockage indisponible sans plantage, livrable complet et cohérent) avec son runner Gherkin **zéro dépendance** (ADR-14) et ses step definitions ; exécution : **5/5 scénarios verts (19 steps)**, intégrée au cycle de test du livrable (`build → tests unitaires → BDD`). La non-régression fonctionnelle est désormais exigée pour toute déclaration **ready**.

### Risques techniques identifiés par le développeur

1. **OAuth Google + API Calendar** : point d'intégration le plus coûteux du MVP → isolé en itération 4, la maquette mocke déjà le comportement attendu.
2. **Notifications planifiées (21h/7h)** : à fiabiliser en premier sur Android (alarmes exactes vs Doze), sinon les rituels ne se déclenchent pas.
3. **Cohérence des recalculs en cascade** (état tâche → backlog → temps restant → date estimée → SMART) : à couvrir par des tests unitaires de logique métier avant tout test d'écran.

### Critère de sortie du MVP

Le MVP est accepté lorsque : chaque itération a ses critères d'acceptation cochés par le développeur, la recette métier de l'analyste valide les US3–US14 (périmètre MVP), et un usage réel de 2 semaines sans perte de données ni migration en échec est constaté.