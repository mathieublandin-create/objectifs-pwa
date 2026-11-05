# language: fr
Fonctionnalité: Estimation de date de fin — US7
  Vélocité progressive : pas d'estimation avant 2 jours avec saisie ;
  estimation dès le 2ème jour ; date de fin = aujourd'hui + (charge
  restante / vélocité) semaines, en jours calendaires.

  Scénario: Pas d'estimation avant 2 jours avec saisie
    Étant donné un objectif avec des saisies de temps sur 1 seul jour
    Alors aucune date de fin estimée n'est affichée
    Et le message « estimation dès la prochaine saisie » est affiché

  Scénario: Estimation dès le 2ème jour avec saisie
    Étant donné un objectif avec 6 h passées réparties sur 2 jours avec saisie
    Alors la vélocité hebdomadaire estimée vaut (6 h / 2 jours) × 7 = 21 h/semaine
    Et une date de fin estimée est affichée pour l'objectif

  Scénario: Date de fin recalculée après chaque mise à jour
    Étant donné un objectif avec une date de fin estimée affichée
    Quand l'utilisateur saisit du temps ou modifie une tâche
    Alors la date de fin estimée est recalculée

  Scénario: Indicateur « à risque » si estimation au-delà de l'échéance
    Étant donné un objectif avec une échéance cible fixée
    Quand la date de fin estimée dépasse l'échéance cible
    Alors l'indicateur « à risque » est affiché sur l'objectif

  Scénario: Date estimée visible au niveau tâche et objectif
    Étant donné une tâche planifiée avec une durée
    Alors la tâche affiche sa date planifiée et sa durée
    Et l'objectif affiche sa date de fin estimée à partir de la vitesse agrégée
