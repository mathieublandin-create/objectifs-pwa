# language: fr
Fonctionnalité: Priorisation des objectifs et des tâches — US5
  Objectifs : priorités P1–P4. Tâches : haute / moyenne / basse.
  Le backlog est trié par (priorité objectif, priorité tâche, date).

  Scénario: Changement de priorité d'un objectif et d'une tâche
    Étant donné un objectif P3 et une tâche de priorité « basse »
    Quand l'utilisateur passe l'objectif à P1 et la tâche à « haute »
    Alors les deux priorités sont enregistrées

  Scénario: Re-tri automatique du backlog
    Étant donné un backlog contenant des tâches de priorités variées
    Quand l'utilisateur change la priorité d'une tâche
    Alors le backlog est re-trié automatiquement par priorité d'objectif, puis priorité de tâche, puis date

  Scénario: Badge visuel distinct par niveau de priorité
    Étant donné des tâches de priorités « haute », « moyenne » et « basse »
    Alors chaque niveau de priorité porte un badge visuel distinct
