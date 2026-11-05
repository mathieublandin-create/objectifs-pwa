# language: fr
Fonctionnalité: Rituels quotidiens — US11
  Rappel du soir à 21h (saisie du temps et actions du lendemain) et
  rappel du matin à 7h (programme du jour ajustable).

  Scénario: Rappel du soir à 21h
    Étant donné l'heure réglée à 21h
    Alors l'utilisateur reçoit une notification ouvrant l'écran de saisie du temps passé
    Et la proposition d'actions pour le lendemain est affichée

  Scénario: Validation ou modification des actions du lendemain
    Étant donné la liste des actions proposées pour le lendemain
    Quand l'utilisateur valide ou modifie cette liste
    Alors les tâches acceptées passent à l'état « planifiée » avec la date du lendemain

  Scénario: Rappel du matin à 7h avec programme du jour
    Étant donné l'heure réglée à 7h
    Alors l'utilisateur reçoit une notification avec le programme du jour
    Et le programme peut être ajusté en quelques interactions (déplacer, replanifier, ajouter, retirer)

  Scénario: Heures de rappel paramétrables et désactivables
    Étant donné les réglages des rituels
    Quand l'utilisateur modifie les heures de rappel ou les désactive
    Alors les nouveaux réglages sont pris en compte

  Scénario: La saisie du soir alimente statistiques et vélocité
    Étant donné des saisies de temps effectuées depuis le rituel du soir
    Alors les statistiques et la vélocité sont mises à jour sans autre action de l'utilisateur
