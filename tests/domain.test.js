// TM1–TM5, TM11 — domaine pur : import/export, round-trip, persistance (mock), sans DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { exporterDonnees, importerDonnees } from "../src/domain/exportImport.js";
import { creePersistance } from "../src/domain/persistence.js";

const DATA = {
  version: 9,
  objectifs: [{ id: "o1", titre: " repeindre le salon ", statut: "actif", points: 8 }],
  taches: [{ id: "t1", objectifId: "o1", title: "acheter la peinture", state: "à planifier", charge: 2 }],
  preferences: { rituel: { heureSoir: "21:00", heureMatin: "07:00" } },
  account: { id: "local" },
};

// TM1 — export : structure « objectifs-donnees-v1 » complète, compte exclu
test("TM1 export : format, contexte (versions/espace/date), account exclu", () => {
  const obj = JSON.parse(exporterDonnees(DATA, { versionApp: "0.13.0-m0", espace: "local", dateIso: "2026-10-20T20:00:00.000Z" }));
  assert.equal(obj.format, "objectifs-donnees-v1");
  assert.equal(obj.contexte.application, "Objectifs");
  assert.equal(obj.contexte.versionApp, "0.13.0-m0");
  assert.equal(obj.contexte.versionSchema, 9);
  assert.equal(obj.contexte.espace, "local");
  assert.ok(obj.contexte.dateExport);
  assert.equal(obj.donnees.account, null);
  assert.equal(obj.donnees.objectifs.length, 1);
  assert.equal(obj.donnees.taches.length, 1);
});

// TM2 — import valide accepté, données accessibles
test("TM2 import v9 valide : accepté, données intactes", () => {
  const json = exporterDonnees(DATA, { versionApp: "x" });
  const { data, erreur } = importerDonnees(json);
  assert.equal(erreur, null);
  assert.ok(data);
  assert.equal(data.version, 9);
  assert.deepEqual(data.objectifs, DATA.objectifs);
  assert.deepEqual(data.taches, DATA.taches);
  assert.equal(data.account, null);
});

// TM3 — refus explicites sans écriture (JSON illisible, mauvais format, mauvais schéma, incomplet)
test("TM3 refus : JSON illisible / format inconnu / schéma ≠ 9 / données incomplètes", () => {
  for (const json of ["{pas json", JSON.stringify({ format: "autre" }), JSON.stringify({ format: "objectifs-donnees-v1", donnees: { version: 8 } }), JSON.stringify({ format: "objectifs-donnees-v1", donnees: { version: 9, objectifs: [] } })]) {
    const { data, erreur } = importerDonnees(json);
    assert.equal(data, null, "refus = data null");
    assert.ok(erreur, "erreur explicite");
  }
  const avant = DATA.objectifs[0];
  const { data } = importerDonnees("{invalide");
  assert.equal(data, null);
  assert.deepEqual(DATA.objectifs[0], avant, "aucune donnée source modifiée");
});

// TM4 — round-trip import → export : identité structurelle
test("TM4 round-trip : import → export → identité structurelle des données", () => {
  const { data } = importerDonnees(exporterDonnees(DATA, { versionApp: "0.13.0-m0" }));
  const reexport = JSON.parse(exporterDonnees(data, { versionApp: "0.13.0-m0" }));
  assert.deepEqual(reexport.donnees, JSON.parse(exporterDonnees(DATA, { versionApp: "0.13.0-m0" })).donnees);
});

// TM5 — persistance via adaptateur gardé (mock localStorage) ; indisponible sans plantage
test("TM5 persistance : écriture/lecture, statut persistant ; levée SecurityError → indisponible sans plantage", () => {
  const ok = new Map();
  const storage = { setItem: (k, v) => ok.set(k, String(v)), getItem: (k) => ok.get(k) ?? null, removeItem: (k) => ok.delete(k) };
  const p = creePersistance(storage, "cle");
  assert.equal(p.statut(), "persistant");
  assert.equal(p.ecrire(DATA), true);
  assert.deepEqual(p.lire().objectifs, DATA.objectifs);
  const hostile = { setItem: () => { throw new Error("SecurityError"); }, getItem: () => { throw new Error("SecurityError"); }, removeItem: () => {} };
  const h = creePersistance(hostile, "cle");
  assert.equal(h.statut(), "indisponible");
  assert.equal(h.lire(), null);
  assert.equal(h.ecrire(DATA), false);
});

// TM11 — domaine sans dépendance DOM : les modules s'importent hors navigateur (précondition de ce fichier)
test("TM11 domaine pur : import/export et persistance testables hors navigateur", () => {
  assert.equal(typeof exporterDonnees, "function");
  assert.equal(typeof importerDonnees, "function");
  assert.equal(typeof creePersistance, "function");
});
