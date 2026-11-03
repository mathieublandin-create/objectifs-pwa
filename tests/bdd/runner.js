// Runner BDD zéro dépendance (ADR-14) — parseur Gherkin FR minimal + moteur de step definitions.
// Syntaxe supportée : Fonctionnalité:, Scénario:, Étant donné/Etant donné, Quand, Alors, Et, Mais.
// « Et »/« Mais » héritent du mot-clé précédent (sémantique Gherkin), le matching reste global.
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MOTS = ["Étant donné", "Etant donné", "Quand", "Alors", "Et", "Mais"];
const PRELIM = ["Étant donné", "Etant donné", "Quand", "Alors"];

function parseFeature(texte) {
  const lignes = texte.split(/\r?\n/).map((l) => l.trim());
  const feature = { nom: null, scenarios: [] };
  let scenario = null;
  for (const ligne of lignes) {
    if (!ligne || ligne.startsWith("#")) continue;
    if (ligne.startsWith("Fonctionnalité:")) { feature.nom = ligne.slice("Fonctionnalité:".length).trim(); continue; }
    if (ligne.startsWith("Scénario:") || ligne.startsWith("Scenario:")) {
      scenario = { nom: ligne.replace(/^Sc(é|e)nario:/, "").trim(), steps: [] };
      feature.scenarios.push(scenario);
      continue;
    }
    const mot = MOTS.find((m) => ligne.startsWith(m + " ") || ligne === m);
    if (mot && scenario) {
      const texte = mot === "Et" || mot === "Mais" ? null : mot;
      scenario.steps.push({ mot: texte ?? scenario.steps.at(-1)?.mot ?? "Étant donné", texte: ligne.slice(mot.length).trim() });
    }
  }
  return feature;
}

async function executer(feature, defs, journal) {
  for (const scenario of feature.scenarios) {
    const contexte = { donnees: null, export: null, erreur: null, refus: null };
    let echec = null;
    for (const step of scenario.steps) {
      const def = defs.find((d) => d.motif.test(step.texte));
      if (!def) { echec = `step non défini : « ${step.texte} »`; break; }
      try { await def.action(step.texte.match(def.motif), contexte); }
      catch (e) { echec = `« ${step.texte} » → ${e.message}`; break; }
    }
    journal.push({ scenario: scenario.nom, statut: echec ? "ÉCHEC" : "OK", detail: echec });
  }
}

const ICI = dirname(fileURLToPath(import.meta.url));
const SPECS = join(ICI, "..", "..", "specs");
const args = process.argv.slice(2);
const fichiers = args.length ? args.map((f) => ({ path: f, nom: basename(f) }))
  : readdirSync(SPECS).filter((f) => f.endsWith(".feature")).map((f) => ({ path: join(SPECS, f), nom: f }));

const defs = [];
for (const f of readdirSync(ICI).filter((f) => f.startsWith("etapes-") && f.endsWith(".js")))
  defs.push(...(await import(`./${f}`)).etapes);

const journal = [];
for (const f of fichiers)
  await executer(parseFeature(readFileSync(f.path, "utf8")), defs, journal);

const ok = journal.filter((j) => j.statut === "OK").length;
for (const j of journal) console.log(`${j.statut === "OK" ? "✔" : "✘"} ${j.scenario}${j.detail ? ` — ${j.detail}` : ""}`);
console.log(`\nBDD : ${ok}/${journal.length} scénarios verts (${fichiers.length} feature(s), ${defs.length} steps)`);
process.exitCode = ok === journal.length ? 0 : 1;
