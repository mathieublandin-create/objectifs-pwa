// Revue de code automatisée (agent RT) — règles statiques de la revue RT (guide §7),
// exécutées en CI comme job indépendant. Toute violation = échec bloquant.
// R1 : composants < 150 lignes (src/screens, src/app)
// R2 : domaine pur — aucun Date.now / Math.random / localStorage / fetch dans src/domain
// R3 : aucun secret en dur (patterns de clés/tokens) hors tests
// R4 : .feature présents et parsés (runner BDD en échec si scénario non défini = rôle dev non livré)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const echecs = [];
const ok = (cond, msg) => { if (!cond) echecs.push(msg); };

// R1 — composants < 150 lignes
for (const dossier of ["src/screens", "src/app"]) {
  for (const f of readdirSync(join(RACINE, dossier))) {
    if (!f.endsWith(".tsx")) continue;
    const n = readFileSync(join(RACINE, dossier, f), "utf8").split(/\r?\n/).length;
    ok(n < 150, `R1 ${dossier}/${f} = ${n} lignes (max 149)`);
  }
}

// R2 — domaine pur M1 (domaine.ts + exportImport.js ; persistence.js est le legacy M0 servi par build.js)
const INTERDITS = [/Date\.now\s*\(/, /Math\.random\s*\(/, /localStorage/, /sessionStorage/, /\bfetch\s*\(/, /XMLHttpRequest/];
for (const f of ["domaine.ts", "exportImport.js"]) {
  const src = readFileSync(join(RACINE, "src/domain", f), "utf8");
  for (const rx of INTERDITS) ok(!rx.test(src), `R2 src/domain/${f} contient ${rx}`);
}

// R3 — secrets en dur (hors tests et maquette de doc)
const PATTERNS = [/AIza[0-9A-Za-z_-]{20,}/, /client_secret["']?\s*[:=]/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? (e.name === "node_modules" || e.name === "dist" || e.name === ".git" ? [] : walk(join(d, e.name)))
    : [join(d, e.name)]);
for (const f of walk(join(RACINE, "src"))) {
  if (f.endsWith(".test.ts")) continue;
  const src = readFileSync(f, "utf8");
  for (const rx of PATTERNS) ok(!rx.test(src), `R3 ${f} contient un pattern de secret ${rx}`);
}

// R4 — BDD : tous les scénarios doivent avoir leurs steps (sinon la non-régression n'est pas exécutable)
let bddOk = true;
try {
  execFileSync("node", ["tests/bdd/runner.js"], { cwd: RACINE, stdio: "pipe" });
} catch {
  bddOk = false;
}
ok(bddOk, "R4 runner BDD : des scénarios ont des steps non définis (livrable analyste+dev incomplet)");

if (echecs.length > 0) {
  console.error("✘ Revue RT — BLOQUANT :");
  for (const e of echecs) console.error("  - " + e);
  process.exit(1);
}
console.log("✔ Revue RT automatisée conforme (R1 composants < 150 l., R2 domaine pur, R3 aucun secret, R4 BDD exécutable)");
