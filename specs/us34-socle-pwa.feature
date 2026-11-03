# language: fr
Fonctionnalité: Socle PWA — US34 (jalon M0)
  L'utilisateur dispose d'une PWA installable (mobile et PC) dont les données
  persistent et dans laquelle il importe l'export de la maquette.

  Scénario: Import d'un export v9 valide
    Étant donné un export « objectifs-donnees-v1 » du schéma v9 contenant 2 objectifs et 3 tâches
    Quand l'utilisateur importe cet export
    Alors l'import est accepté sans erreur
    Et l'accueil affiche 2 objectifs et 3 tâches

  Scénario: Refus d'un contenu non reconnu sans impact sur l'existant
    Étant donné un espace actif contenant 1 objectif importé
    Quand l'utilisateur importe un contenu non reconnu
    Alors l'import est refusé avec un message explicite
    Et les données existantes sont intactes

  Scénario: Round-trip export puis import sans perte
    Étant donné un espace actif issu d'un import de 2 objectifs et 3 tâches
    Quand l'utilisateur exporte ses données
    Alors l'export est au format « objectifs-donnees-v1 » et exclut le compte connecté
    Et le réimport de cet export restitue des données identiques structurellement

  Scénario: Stockage indisponible — pas de plantage, secours affiché
    Étant donné un navigateur dont le stockage est indisponible
    Quand l'application s'ouvre
    Alors le statut du stockage est « indisponible » sans plantage
    Et l'écriture des données échoue proprement

  Scénario: Livrable complet et cohérent
    Étant donné le livrable construit dans dist/
    Alors le manifeste, le service worker et les icônes 192 et 512 sont présents
    Et la version de l'application est visible dans l'accueil, le manifeste et le service worker
