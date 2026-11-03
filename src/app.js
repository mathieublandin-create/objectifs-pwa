// app.js — coquille du socle M0 : accueil lecture seule (objectifs, tâches), import/export,
// statut de stockage, version app ↔ schéma (US34-c6..c9). Le portage complet des écrans est le M1.
import { exporterDonnees, importerDonnees } from "./domain/exportImport.js";
import { creePersistance } from "./domain/persistence.js";

const APP_VERSION = "{{APP_VERSION}}";
const SCHEMA_VERSION = {{SCHEMA_VERSION}};
const CLE = "objectifs-espace-v" + SCHEMA_VERSION;

const persistance = creePersistance(globalThis.localStorage, CLE);
const $ = (id) => document.getElementById(id);
const statut = persistance.statut();
if (statut !== "persistant") $("banniere-stockage").hidden = false;
$("version").textContent = `App v${APP_VERSION} · schéma v${SCHEMA_VERSION}`;

function afficher(data) {
  const objectifs = data?.objectifs ?? [];
  const taches = data?.taches ?? [];
  $("liste-objectifs").replaceChildren(...objectifs.map((o) => {
    const li = document.createElement("li");
    li.textContent = o.titre ?? "(sans titre)";
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = o.statut ?? "";
    li.append(meta);
    return li;
  }));
  $("vide-objectifs").hidden = objectifs.length > 0;
  $("liste-taches").replaceChildren(...taches.map((t) => {
    const li = document.createElement("li");
    li.textContent = t.title ?? "(sans titre)";
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = t.state ?? t.etat ?? "";
    li.append(meta);
    return li;
  }));
  $("vide-taches").hidden = taches.length > 0;
}

function message(texte, erreur = false) {
  const el = $("message");
  el.textContent = texte;
  el.className = erreur ? "erreur" : "";
}

// Données persistées → accueil
afficher(persistance.lire());

// Import : fichier JSON → validation (refus sans écriture, I4) → persistance → affichage
$("import-fichier").addEventListener("change", async (e) => {
  const fichier = e.target.files?.[0];
  if (!fichier) return;
  try {
    const json = await fichier.text();
    const { data, erreur } = importerDonnees(json);
    if (!data) { message(erreur, true); return; }
    if (!persistance.ecrire(data)) { message("Écriture impossible : stockage indisponible.", true); return; }
    afficher(data);
    message("Import réussi — espace actif remplacé.");
  } catch { message("Lecture du fichier impossible.", true); }
  e.target.value = "";
});

// Export : téléchargement du format « objectifs-donnees-v1 »
$("export-bouton").addEventListener("click", () => {
  const data = persistance.lire();
  if (!data) { message("Aucune donnée à exporter : importez d'abord un export.", true); return; }
  const json = exporterDonnees(data, { versionApp: APP_VERSION, dateIso: new Date().toISOString() });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  a.download = `objectifs-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  message("Export généré.");
});

// Service worker (US34-c3/c4) — échec silencieux hors HTTPS (analyse statique + recette navigateur)
if ("serviceWorker" in navigator && location.protocol === "https:")
  navigator.serviceWorker.register("sw.js").catch(() => {});
