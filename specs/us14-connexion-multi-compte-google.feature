# language: fr
Fonctionnalité: Connexion multi-compte Google — US14
  L'utilisateur choisit le compte Google de connexion ; les données
  (objectifs, tâches, temps passés, statistiques, vélocité) sont
  cloisonnées par compte.

  Scénario: Connexion avec un compte Google au choix
    Étant donné plusieurs comptes Google disponibles sur l'appareil
    Quand l'utilisateur se connecte en choisissant l'un d'eux
    Alors la connexion est établie avec le compte choisi

  Scénario: Cloisonnement des données par compte
    Étant donné un compte Google connecté avec ses propres données
    Alors seules les tâches, objectifs et vélocité du compte actif sont visibles
    Et aucun mélange avec un autre compte n'est possible

  Scénario: Changement de compte avec bascule intégrale
    Étant donné un compte A connecté avec ses données
    Quand l'utilisateur change pour le compte B
    Alors les données affichées basculent intégralement sur le compte B
    Et aucune re-saisie ni perte n'est nécessaire

  Scénario: Déconnexion sans perte de données
    Étant donné un compte connecté avec des données enregistrées
    Quand l'utilisateur se déconnecte puis se reconnecte au même compte
    Alors aucune donnée n'a été effacée
    Et les données sont retrouvées à l'identique
