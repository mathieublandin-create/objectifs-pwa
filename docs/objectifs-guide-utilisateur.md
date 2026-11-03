---
name: "guide-utilisateur-objectifs"
title: "Objectifs — Guide utilisateur"
type: "text/markdown"
---

# 🎯 Objectifs — Guide utilisateur

> **Version v1.0** — 20/10/2026. Couvre le socle PWA du jalon M0 (v0.13.0-m0) ; les sections « à venir » seront complétées aux jalons M1–M4.
> Ce guide accompagne chaque livraison : il est mis à jour à chaque évolution visible par l'utilisateur (règle consignée au pilotage).

## 1. Présentation

« Objectifs » est votre application personnelle de gestion d'objectifs : objectifs SMART décomposés en tâches, planification, rituels du soir (21 h) et du matin (7 h), vélocité et statistiques. Vos données restent **sur votre appareil** ; rien ne quitte votre navigateur sans action explicite de votre part (export, ou intégrations Google que vous activez).

Deux supports :
- **La maquette interactive** (période de conception, désormais close) — données non persistantes.
- **L'application PWA** (livrable, jalon M0 en cours) — installable sur PC **et** mobile, données persistantes dans le navigateur.

## 2. Prérequis

- Un navigateur récent : **Chrome ou Edge** (PC), **Chrome** (Android). *(iOS/Safari : non couvert par le MVP.)*
- Un hébergement **HTTPS** du socle (voir §3) — l'installation PWA exige HTTPS.
- Node.js 22+ uniquement pour **construire** le livrable (pas pour l'utiliser).

## 3. Installation

### 3.1 Mettre le socle en ligne (une fois)

1. Construire : `npm run build` dans le dossier `objectifs-pwa` → le dossier `dist/` est prêt (aucune dépendance à installer).
2. Héberger le contenu de `dist/` sur un hébergement statique HTTPS (ex. pages GitHub, Netlify, bucket statique).
3. Ouvrir l'URL dans le navigateur : l'accueil affiche « App v0.13.0-m0 · schéma v9 ».

### 3.2 Installer l'application sur PC (Chrome/Edge)

1. Ouvrir l'URL du site.
2. Icône d'installation dans la barre d'adresse (⊕) → **Installer** (ou menu ⋮ → « Installer Objectifs » / « Ajouter au bureau »).
3. L'application s'ouvre dans sa propre fenêtre, hors navigateur ; une icône « Objectifs » apparaît dans le menu Démarrer / bureau.

### 3.3 Installer sur mobile (Chrome Android)

1. Ouvrir l'URL dans Chrome.
2. Bandeau « Ajouter à l'écran d'accueil » (ou menu ⋮ → **Ajouter à l'écran d'accueil** → Installer).
3. L'icône « Objectifs » apparaît sur l'écran d'accueil ; l'application s'ouvre plein écran.

## 4. Mise à jour

L'application se met à jour **automatiquement** :

1. À l'ouverture, le navigateur récupère la nouvelle version en arrière-plan.
2. La version active reste l'ancienne jusqu'à la **fermeture complète** de l'application.
3. À la réouverture suivante, la nouvelle version est active — le statut « App v… · schéma v… » sur l'accueil confirme la version en cours.

**Recommandations** :
- Fermez complètement l'application (tous les onglets/fenêtres) après une session pour ne pas rester bloqué sur une ancienne version.
- **Avant toute mise à jour attendue, faites un export** (§5) : c'est votre sauvegarde en cas de souci.
- Si une mise à jour semble bloquée : forcer le rafraîchissement (Ctrl+F5 / vider le cache du site), puis rouvrir.
- Les changements de schéma de données (ex. v9 → v10) sont **automatiques à l'ouverture** ; en cas d'échec, rien n'est modifié et un message explicite s'affiche.

## 5. Sauvegarder et restaurer ses données (export/import)

Vos données vivent dans le navigateur de l'appareil. L'export est votre sécurité.

- **Exporter** : bouton **⬇ Exporter mes données (JSON)** — un fichier `objectifs-export-<date>.json` est téléchargé. Conservez-le (cloud, clé USB…).
- **Importer** : bouton **⬆ Importer un export (JSON)** — sélectionnez un fichier d'export. ⚠️ L'import **remplace** l'ensemble des données de l'appareil par celles du fichier.
- Tout fichier non reconnu est refusé avec un message explicite, **sans rien modifier**.
- **Bannière ambre à l'ouverture** : le stockage du navigateur est indisponible — utilisez l'export à chaque session pour ne rien perdre (situation exceptionnelle, héritée de la maquette).

## 6. Utilisation au quotidien — socle M0

- L'accueil affiche en lecture seule vos **objectifs** et **tâches** importés.
- Les écrans complets (création, planification, rituels, statistiques) arrivent au **M1** — ce guide sera complété à chaque jalon.

## 7. Dépannage

| Symptôme | Que faire |
|---|---|
| Bannière ambre persistante | Stockage indisponible : exporter en fin de session, importer à la réouverture |
| Import refusé | Vérifiez que le fichier est bien un export « objectifs-donnees-v1 » (bouton Exporter de l'app ou de la maquette) |
| Application hors ligne ne charge pas | Rouvrez une fois en ligne pour compléter l'installation du cache |
| Version inchangée après mise à jour | Fermez complètement l'application, rouvrez |
| Données disparues | Importez votre dernier export (§5) |

## 8. À venir (jalons suivants)

- **M1** : portage des écrans complets (objectifs SMART, tâches, rituels, statistiques) + guide d'utilisation métier détaillé.
- **M2** : connexion Google (OAuth), agenda réel.
- **M3** : rappels des rituels via Google Calendar.
- **M4** : recette finale, guide complet.

---
*Maintenance : guide mis à jour à chaque livraison modifiant l'expérience utilisateur ; historisé dans la bibliothèque « Objectifs — Historique des livrables » (convention §5.4 du guide de développement).*