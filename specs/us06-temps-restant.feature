# language: fr
Fonctionnalité: Temps prévisionnel restant — US6
  Temps restant tâche = charge restante (1 pt = 1 h) ; temps restant
  objectif = somme des charges restantes des tâches ouvertes.

  Scénario: Temps restant affiché sur chaque tâche ouverte
    Étant donné une tâche ouverte avec une charge restante de 4 h
    Alors la tâche affiche un temps restant estimé de 4 h

  Scénario: Temps total restant affiché sur l'objectif
    Étant donné un objectif avec deux tâches ouvertes de charges restantes 3 h et 2 h
    Alors l'objectif affiche un temps total restant de 5 h

  Scénario: Mise à jour après avancement ou ré-estimation
    Étant donné un objectif dont les tâches ont des charges restantes affichées
    Quand l'utilisateur saisit du temps sur une tâche ou la ré-estime
    Alors les temps restants de la tâche et de l'objectif sont recalculés immédiatement
