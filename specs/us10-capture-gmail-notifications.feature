# language: fr
Fonctionnalité: Capture depuis Gmail et notifications de suivi — US10
  Un email peut être transformé en tâche en un clic ; des rappels
  accompagnent les tâches planifiées.

  Scénario: Création d'une tâche depuis un email en 1 clic
    Étant donné un email ouvert dans Gmail
    Quand l'utilisateur clique sur « créer une tâche »
    Alors une tâche est créée avec l'objet de l'email comme titre
    Et le lien vers l'email est conservé sur la tâche

  Scénario: Rappel la veille d'une tâche planifiée
    Étant donné une tâche planifiée pour le lendemain
    Alors l'utilisateur reçoit un rappel à J-1 de la tâche planifiée

  Scénario: Récapitulatif hebdomadaire
    Étant donné une semaine écoulée avec des tâches terminées et du temps logué
    Alors l'utilisateur reçoit un récap hebdomadaire avec les tâches terminées, la vélocité et le backlog restant
