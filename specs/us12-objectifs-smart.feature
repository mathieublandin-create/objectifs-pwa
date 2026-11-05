# language: fr
Fonctionnalité: Objectifs SMART avec contrôles de conformité — US12
  Chaque objectif porte 5 attributs SMART ; un contrôleur affiche en
  temps réel un score de conformité (x/5) et les attributs manquants.

  Scénario: Renseignement des 5 attributs SMART à la création
    Étant donné la page de création d'un objectif
    Alors les 5 attributs SMART sont renseignables : Spécifique, Mesurable, Atteignable, Réaliste, Temporel

  Scénario: Contrôleur SMART en temps réel
    Étant donné le formulaire de création d'un objectif partiellement rempli
    Alors le contrôleur SMART affiche un score de conformité x/5
    Et il liste les attributs manquants ou invalides

  Scénario: Objectif non conforme signalé mais enregistrable en brouillon
    Étant donné un objectif avec un score de conformité inférieur à 5/5
    Alors la création en brouillon est possible
    Et un badge signale l'objectif non conforme dans la liste

  Scénario: Recalcul automatique des contrôles A et T
    Étant donné un objectif dont les contrôles A et T sont calculés
    Quand les tâches, charges ou dates changent
    Alors les contrôles A (atteignable) et T (temporel) sont recalculés automatiquement

  Scénario: A indéterminé tant que la vélocité n'est pas mesurable
    Étant donné un objectif avec moins de 2 jours de saisie de temps
    Alors le contrôle A est « indéterminé » et n'est pas signalé manquant
