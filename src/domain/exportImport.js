// Domaine pur : import/export « objectifs-donnees-v1 » (schéma v9), identique à l'US23 de la maquette.
// Aucune dépendance DOM — testable hors navigateur (US34-c6/c7, TM1–TM4, TM11).

export const FORMAT = "objectifs-donnees-v1";
export const SCHEMA_VERSION = 9;

const clone = (o) => JSON.parse(JSON.stringify(o));

// Export : en-tête de contexte (versions, espace, date) + données complètes ; compte exclu (donnée de session).
export function exporterDonnees(data, { versionApp, espace = "local", dateIso } = {}) {
  return JSON.stringify({
    format: FORMAT,
    contexte: {
      application: "Objectifs",
      versionApp,
      versionSchema: SCHEMA_VERSION,
      espace,
      dateExport: dateIso ?? new Date().toISOString(),
    },
    donnees: { ...clone(data), account: null },
  }, null, 2);
}

// Import contrôlé (pur) : format reconnu → contrôle d'intégrité (schéma v9 au M0) → remplacement.
// Tout refus est explicite et ne modifie rien (I4) : data === null.
export function importerDonnees(json) {
  let obj;
  try { obj = JSON.parse(json); } catch { return { data: null, erreur: "JSON illisible — vérifiez le contenu." }; }
  if (!obj || obj.format !== FORMAT || !obj.donnees || typeof obj.donnees !== "object")
    return { data: null, erreur: "Format non reconnu : un export « objectifs-donnees-v1 » est attendu." };
  const d = obj.donnees;
  if (d.version !== SCHEMA_VERSION)
    return { data: null, erreur: `Schéma v${d.version} non supporté (attendu v${SCHEMA_VERSION}).` };
  if (!Array.isArray(d.objectifs) || !Array.isArray(d.taches))
    return { data: null, erreur: "Données incomplètes : objectifs et tâches attendus." };
  return { data: { ...d, account: null }, erreur: null };
}
