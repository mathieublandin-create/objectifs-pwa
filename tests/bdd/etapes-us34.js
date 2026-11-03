// Steps BDD — US34 (socle M0). Écrits par le développeur, jamais modifiés par lui côté .feature.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { importerDonnees, exporterDonnees } from "../../src/domain/exportImport.js";
import { creePersistance } from "../../src/domain/persistence.js";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const unExport = (nbO, nbT) => {
  const objectifs = Array.from({ length: nbO }, (_, i) => ({ id: `o${i}`, titre: `Objectif ${i}`, statut: "actif" }));
  const taches = Array.from({ length: nbT }, (_, i) => ({ id: `t${i}`, objectifId: `o0`, title: `Tâche ${i}`, state: "à planifier" }));
  return exporterDonnees({ version: 9, objectifs, taches, preferences: {}, account: { id: "local" } }, { versionApp: "0.13.0-m0" });
};

export const etapes = [
  { motif: /^un export « objectifs-donnees-v1 » du schéma v9 contenant (\d+) objectifs et (\d+) tâches$/, action: ([, nbO, nbT], c) => { c.export = unExport(+nbO, +nbT); } },
  { motif: /^l'utilisateur importe cet export$/, action: (m, c) => { const r = importerDonnees(c.export); if (r.erreur) throw new Error(r.erreur); c.donnees = r.data; } },
  { motif: /^l'import est accepté sans erreur$/, action: (m, c) => { if (!c.donnees) throw new Error("aucune donnée importée"); } },
  { motif: /^l'accueil affiche (\d+) objectifs et (\d+) tâches$/, action: ([, nbO, nbT], c) => { if (c.donnees.objectifs.length !== +nbO || c.donnees.taches.length !== +nbT) throw new Error(`${c.donnees.objectifs.length}/${c.donnees.taches.length} affichés`); } },

  { motif: /^un espace actif contenant (\d+) objectif importé$/, action: ([, n], c) => { c.donnees = importerDonnees(unExport(+n, +n)).data; c.avant = JSON.stringify(c.donnees); } },
  { motif: /^l'utilisateur importe un contenu non reconnu$/, action: (m, c) => { const r = importerDonnees("{contenu invalide"); c.refus = r.erreur; if (r.data) throw new Error("refus attendu"); } },
  { motif: /^l'import est refusé avec un message explicite$/, action: (m, c) => { if (!c.refus) throw new Error("aucun message de refus"); } },
  { motif: /^les données existantes sont intactes$/, action: (m, c) => { if (JSON.stringify(c.donnees) !== c.avant) throw new Error("données modifiées"); } },

  { motif: /^un espace actif issu d'un import de (\d+) objectifs et (\d+) tâches$/, action: ([, nbO, nbT], c) => { c.donnees = importerDonnees(unExport(+nbO, +nbT)).data; } },
  { motif: /^l'utilisateur exporte ses données$/, action: (m, c) => { c.export = exporterDonnees(c.donnees, { versionApp: "0.13.0-m0" }); } },
  { motif: /^l'export est au format « objectifs-donnees-v1 » et exclut le compte connecté$/, action: (m, c) => { const o = JSON.parse(c.export); if (o.format !== "objectifs-donnees-v1") throw new Error("format"); if (o.donnees.account !== null) throw new Error("compte non exclu"); } },
  { motif: /^le réimport de cet export restitue des données identiques structurellement$/, action: (m, c) => { const r = importerDonnees(c.export); if (r.erreur) throw new Error(r.erreur); if (JSON.stringify(r.data) !== JSON.stringify(c.donnees)) throw new Error("round-trip divergent"); } },

  { motif: /^un navigateur dont le stockage est indisponible$/, action: (m, c) => { const hostile = { setItem: () => { throw new Error("SecurityError"); }, getItem: () => { throw new Error("SecurityError"); }, removeItem: () => {} }; c.persistance = creePersistance(hostile, "cle"); } },
  { motif: /^l'application s'ouvre$/, action: (m, c) => { c.statut = c.persistance.statut(); } },
  { motif: /^le statut du stockage est « indisponible » sans plantage$/, action: (m, c) => { if (c.statut !== "indisponible") throw new Error(c.statut); } },
  { motif: /^l'écriture des données échoue proprement$/, action: (m, c) => { if (c.persistance.ecrire({ version: 9 })) throw new Error("écriture inattendue"); if (c.persistance.lire() !== null) throw new Error("lecture inattendue"); } },

  { motif: /^le livrable construit dans dist\/$/, action: (m, c) => { c.dist = RACINE + "/dist"; } },
  { motif: /^le manifeste, le service worker et les icônes (\d+) et (\d+) sont présents$/, action: ([, a, b], c) => { for (const f of ["manifest.webmanifest", "sw.js", `icons/icon-${a}.png`, `icons/icon-${b}.png`]) if (!existsSync(join(c.dist, f))) throw new Error(`${f} manquant`); } },
  { motif: /^la version de l'application est visible dans l'accueil, le manifeste et le service worker$/, action: (m, c) => { const v = JSON.parse(readFileSync(join(RACINE, "package.json"), "utf8")).version; for (const f of ["app.js", "manifest.webmanifest", "sw.js"]) if (!readFileSync(join(c.dist, f), "utf8").includes(v)) throw new Error(`version absente de ${f}`); } },
];
