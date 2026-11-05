# language: fr
Fonctionnalité: Charge prévisionnelle et temps passé — US4
  Chaque tâche porte une charge estimée (1 pt = 1 h), un temps passé
  cumulé et une charge restante ; la saisie de temps comporte deux champs
  obligatoires (temps passé ET temps restant estimé).

  Scénario: Attributs de charge affichés sur chaque tâche
    Étant donné une tâche ouverte avec une charge estimée de 3 h
    Alors la tâche affiche une charge estimée, un temps passé cumulé et une charge restante
    Et la charge restante vaut max(charge estimée − temps passé cumulé, 0)

  Scénario: Saisie de temps à deux champs obligatoires
    Étant donné le formulaire de saisie de temps d'une tâche
    Quand l'utilisateur ne renseigne que le temps passé sans le temps restant estimé
    Alors la saisie est refusée avec un message explicite
    Et quand l'utilisateur renseigne les deux champs
    Alors la saisie est acceptée

  Scénario: Recalage systématique après une saisie
    Étant donné une tâche avec 2 h déjà loguées et une charge estimée de 5 h
    Quand l'utilisateur saisit 1 h passée et 2 h restantes estimées
    Alors le temps passé cumulé vaut 3 h
    Et la charge restante vaut 2 h
    Et la charge estimée recalée vaut 5 h

  Scénario: Agrégats au niveau de l'objectif
    Étant donné un objectif avec deux tâches ouvertes de charges 3 h et 2 h, dont 1 h passée sur chacune
    Alors la charge de l'objectif vaut 5 h
    Et le temps passé de l'objectif vaut 2 h

  Scénario: Mise à jour des vues après une saisie
    Étant donné une tâche du backlog suivie dans les statistiques
    Quand l'utilisateur valide une saisie de temps
    Alors le backlog, les statistiques et les prévisions sont mis à jour

  Scénario: Dérive alimentant l'indicateur de fiabilité
    Étant donné une tâche créée avec une charge estimée de 2 h
    Quand l'utilisateur clôture la tâche avec un temps passé total ajusté de 4 h
    Alors l'écart entre charge estimée initiale et charge recalée alimente l'indicateur de fiabilité de l'estimation

  Scénario: Clôture exigeant le temps passé total ajusté
    Étant donné une tâche en cours avec 2 h déjà loguées
    Quand l'utilisateur tente de passer la tâche à « terminée » sans saisir le temps passé total ajusté
    Alors la clôture est refusée
    Et quand l'utilisateur saisit un temps total ajusté de 3 h
    Alors la tâche passe à « terminée », la charge restante passe à 0 et la date réelle de complétion est posée

  Scénario: Clôture refusée pour une tâche bloquée
    Étant donné une tâche en cours bloquée par une dépendance non terminée
    Quand l'utilisateur tente de la clôturer avec un temps ajusté
    Alors la clôture est refusée avec la règle violée affichée

  Scénario: Historique du temps logué groupé par jour et par tâche
    Étant donné des saisies de temps réparties sur 2 jours et 2 tâches
    Quand l'utilisateur consulte l'historique du temps logué
    Alors les saisies sont groupées par jour décroissant et par tâche
    Et chaque groupe affiche ses saisies détaillées et son total
