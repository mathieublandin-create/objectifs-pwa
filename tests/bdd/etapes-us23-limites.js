// Steps BDD — US23 cas limites (dev B). Réutilise les steps globaux existants.
import { exporterDonnees, importerDonnees } from "../../src/domain/exportImport.js";

export const etapes = [
  { motif: /^un export « objectifs-donnees-v1 » du schéma v(\d+)$/, action: ([, v], c) => {
    c.export = exporterDonnees({ version: +v, objectifs: [], taches: [], preferences: {}, account: null }, { versionApp: "0.14.0-m1" });
  } },
  { motif: /^l'utilisateur tente d'importer cet export$/, action: (m, c) => { c.refus = importerDonnees(c.export).erreur; } },
];
