Fonctionnalité: Export/import — cas limites (US23)

Scénario: Refus d'un export d'un schéma obsolète
  Étant donné un espace actif contenant 1 objectif importé
  Et un export « objectifs-donnees-v1 » du schéma v8
  Quand l'utilisateur tente d'importer cet export
  Alors l'import est refusé avec un message explicite
  Et les données existantes sont intactes
