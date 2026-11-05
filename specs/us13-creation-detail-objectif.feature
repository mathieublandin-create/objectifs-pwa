# language: fr
Fonctionnalité: Création et détail/édition d'un objectif — US13
  Page de création dédiée avec contrôle SMART en direct ; le clic sur un
  objectif ouvre son détail avec ses tâches et permet de tout modifier.

  Scénario: Création via une page dédiée avec contrôle en direct
    Étant donné la page de création d'un objectif
    Quand l'utilisateur remplit les 5 attributs SMART
    Alors le contrôleur de conformité s'affiche en direct pendant la saisie
    Et la création est possible même en brouillon si le formulaire est incomplet

  Scénario: Le clic sur un objectif ouvre son détail
    Étant donné la liste des objectifs
    Quand l'utilisateur clique sur une carte objectif
    Alors le détail de l'objectif s'ouvre avec toutes ses tâches et leur état

  Scénario: Modification de n'importe quel attribut depuis le détail
    Étant donné le détail d'un objectif
    Quand l'utilisateur modifie le titre, les attributs SMART, la priorité, l'échéance ou la disponibilité
    Alors la modification est enregistrée

  Scénario: Recalcul automatique après modification
    Étant donné le détail d'un objectif
    Quand l'utilisateur modifie un attribut
    Alors la charge, le temps restant, la date de fin estimée et le contrôle SMART sont recalculés automatiquement

  Scénario: Ajout d'une tâche liée depuis le détail en ≤ 3 interactions
    Étant donné le détail d'un objectif
    Quand l'utilisateur ajoute une tâche liée
    Alors la tâche est créée en au plus 3 interactions
    Et elle apparaît dans la section des tâches liées

  Scénario: Suppression d'un objectif avec choix explicite supprimer ou archiver
    Étant donné le détail d'un objectif avec des tâches et du temps passé
    Quand l'utilisateur demande à supprimer l'objectif
    Alors un choix explicite est proposé : supprimer ou archiver en conservant les tâches
    Et aucun historique de temps passé n'est perdu
