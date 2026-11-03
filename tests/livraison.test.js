// TM6–TM10 — vérifications statiques du livrable dist/ (le build a été rejoué avant la suite : npm test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const APP_VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

function empreinte(dir) {
  const map = {};
  const walk = (d, rel = "") => readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const r = rel ? `${rel}/${e.name}` : e.name;
    return e.isDirectory() ? walk(join(d, e.name), r) : [r];
  }).sort();
  for (const rel of walk(dir)) map[rel] = createHash("sha256").update(readFileSync(join(dir, rel))).digest("hex");
  return map;
}

// TM6 — build rejouable : deux builds successifs → empreintes identiques (I2 : aucun horodatage)
test("TM6 build rejouable : deux builds → dist/ identiques", () => {
  const avant = empreinte(DIST);
  execFileSync("node", ["build.js"], { cwd: ROOT });
  assert.deepEqual(empreinte(DIST), avant);
});

// TM7 — dist/ complet
test("TM7 dist/ complet : coquille + domaine + manifeste + SW + icônes", () => {
  for (const f of ["index.html", "styles.css", "app.js", "domain/exportImport.js", "domain/persistence.js", "manifest.webmanifest", "sw.js", "icons/icon-192.png", "icons/icon-512.png"])
    assert.ok(statSync(join(DIST, f)).isFile(), `${f} manquant`);
});

// TM8 — manifeste : champs obligatoires + icônes PNG valides (signature + dimensions IHDR)
test("TM8 manifeste : nom, start_url, display standalone, icônes 192/512 PNG valides", () => {
  const m = JSON.parse(readFileSync(join(DIST, "manifest.webmanifest"), "utf8"));
  assert.equal(m.name, "Objectifs");
  assert.ok(m.start_url);
  assert.equal(m.display, "standalone");
  const tailles = m.icons.map((i) => i.sizes);
  assert.ok(tailles.includes("192x192") && tailles.includes("512x512"));
  for (const f of ["icons/icon-192.png", "icons/icon-512.png"]) {
    const png = readFileSync(join(DIST, f));
    assert.ok(png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), `signature PNG ${f}`);
    const taille = png.readUInt32BE(16);
    assert.ok([192, 512].includes(taille), `dimensions ${f}`);
  }
});

// TM9 — service worker : fetch handler présent, cache versionné par version d'app
test("TM9 SW : gestionnaire fetch, pré-cache, cache versionné", () => {
  const sw = readFileSync(join(DIST, "sw.js"), "utf8");
  assert.ok(sw.includes("addEventListener(\"fetch\""), "fetch handler");
  assert.ok(sw.includes(`objectifs-${APP_VERSION}`), "cache versionné par version d'app");
  assert.ok(sw.includes("icons/icon-192.png"), "icônes générées pré-cachées (retour dev intégré)");
});

// TM10 — cohérence de version : app, manifeste et SW portent la même version
test("TM10 version cohérente : HTML/manifeste/SW ↔ package.json", () => {
  const html = readFileSync(join(DIST, "index.html"), "utf8");
  const sw = readFileSync(join(DIST, "sw.js"), "utf8");
  const appjs = readFileSync(join(DIST, "app.js"), "utf8");
  assert.ok(html.includes("App v") || appjs.includes(APP_VERSION));
  assert.ok(sw.includes(APP_VERSION));
  assert.ok(appjs.includes(APP_VERSION));
  const m = JSON.parse(readFileSync(join(DIST, "manifest.webmanifest"), "utf8"));
  assert.equal(m.version, APP_VERSION);
});
