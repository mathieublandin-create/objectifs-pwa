# language: fr
Fonctionnalité: Vue backlog et burndown de l'objectif — US9
  Chaque objectif dispose d'un graphe de charge restante dans le temps,
  comparé à une ligne théorique de décroissance idéale.

  Scénario: Graphe de charge restante affiché
    Étant donné un objectif avec un historique de charges restantes
    Alors un graphe de charge restante par jour et par semaine est affiché

  Scénario: Ligne théorique affichée en comparaison
    Étant donné un objectif avec une échéance cible
    Alors une ligne théorique de décroissance idéale jusqu'à l'échéance est affichée

  Scénario: Mise à jour automatique du graphe
    Étant donné le graphe de burndown d'un objectif
    Quand une tâche est complétée ou ré-estimée
    Alors le graphe est mis à jour automatiquement
