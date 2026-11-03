# Objectifs — PWA personnelle (objectifs SMART, tâches, rituels)

Socle M0 (US34, v0.13.0-m0) — build Node zéro dépendance (ADR-13). Application personnelle de gestion d'objectifs et de tâches, offline-first, français.

Documentation projet : `docs/` — **commencer par `docs/REPRISE.md`** (mission, état du projet, cycle de développement v5).

## Build et tests

```bash
node build.js                                                    # build → dist/ (11 fichiers)
node --test tests/domain.test.js tests/livraison.test.js          # tests unitaires (TM1–TM11)
node tests/bdd/runner.js                                         # suite BDD (features Gherkin FR)
```

Aucune dépendance, aucun `npm install` (ADR-13/14).
