# language: fr
Fonctionnalité: Saisie rapide de tâche — US3
  L'utilisateur dispose d'un formulaire dédié pour créer une tâche
  (titre, objectif parent, priorité, charge, date optionnelle).

  Scénario: Création d'une tâche avec seulement un titre en ≤ 3 interactions
    Étant donné un objectif actif existant
    Quand l'utilisateur saisit uniquement un titre et valide
    Alors la tâche est créée en au plus 3 interactions
    Et elle apparaît immédiatement dans le backlog de l'objectif

  Scénario: Champs du formulaire accessibles directement
    Étant donné le formulaire de saisie rapide de tâche
    Alors les champs titre, objectif parent, priorité, charge et date optionnelle sont accessibles directement
    Et aucune saisie en langage naturel ni syntaxe spéciale n'est requise

  Scénario: Valeurs par défaut à la création
    Étant donné le formulaire de saisie rapide de tâche
    Quand l'utilisateur ne renseigne que le titre
    Alors la priorité est « moyenne » et la charge estimée est 1 h (1 pt = 1 h)

  Scénario: Refus d'une tâche sans titre
    Étant donné le formulaire de saisie rapide de tâche
    Quand l'utilisateur valide sans titre
    Alors la création est refusée avec un message explicite
    Et aucune tâche n'est enregistrée
