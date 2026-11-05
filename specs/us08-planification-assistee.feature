# language: fr
Fonctionnalité: Planification assistée / time-blocking — US8
  L'application propose des créneaux libres de l'agenda pour les tâches
  prioritaires non planifiées.

  Scénario: Demande de planification de la semaine
    Étant donné des tâches prioritaires non planifiées et un agenda connecté
    Quand l'utilisateur demande « Planifier mes tâches de la semaine »
    Alors une suggestion de créneaux est affichée

  Scénario: Exclusion des créneaux occupés
    Étant donné un agenda contenant une réunion sur un créneau
    Quand l'utilisateur demande « Planifier mes tâches de la semaine »
    Alors le créneau occupé par la réunion n'est pas proposé

  Scénario: Acceptation, déplacement ou refus de chaque suggestion
    Étant donné une liste de suggestions de créneaux
    Quand l'utilisateur accepte, déplace ou refuse une suggestion
    Alors le choix est pris en compte pour cette tâche
    Et les tâches acceptées passent à l'état « planifiée » avec leur date
