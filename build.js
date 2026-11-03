// build.js — socle M0 (US34, ADR-13 : build Node zéro dépendance, rejouable bit à bit).
// Copie src/ → dist/ en injectant la version d'app ; génère les icônes PNG par encodeur pur
// (aucun asset binaire en entrée, aucun horodatage injecté → deux builds successifs identiques).
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");
const APP_VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const SCHEMA_VERSION = 9;

// --- Encodeur PNG minimal (RGBA, filtre 0) — zéro dépendance ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
// Icône « Objectifs » : fond dégradé bleu→vert simulé par bandes, cercle cible plus clair au centre.
function pngIcon(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const cx = size / 2, cy = size / 2, r = size * 0.28;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filtre 0
    for (let x = 0; x < size; x++) {
      const o = y * (size * 4 + 1) + 1 + x * 4;
      const t = y / size; // dégradé vertical bleu (30,64,175) → vert (16,122,87)
      const inside = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      raw[o] = Math.round(inside ? 250 : 30 + t * (16 - 30));
      raw[o + 1] = Math.round(inside ? 250 : 64 + t * (122 - 64));
      raw[o + 2] = Math.round(inside ? 250 : 175 + t * (87 - 175));
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Build ---
rmSync(DIST, { recursive: true, force: true });
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
for (const file of walk(SRC)) {
  const rel = file.slice(SRC.length + 1);
  const dest = join(DIST, rel);
  mkdirSync(dirname(dest), { recursive: true });
  if (/\.(js|html|css|webmanifest)$/.test(rel)) {
    // Injection de la version d'app (et du schéma) — aucun horodatage (rejouabilité US34-c1)
    writeFileSync(dest, readFileSync(file, "utf8")
      .replaceAll("{{APP_VERSION}}", APP_VERSION)
      .replaceAll("{{SCHEMA_VERSION}}", String(SCHEMA_VERSION)));
  } else {
    writeFileSync(dest, readFileSync(file));
  }
}
mkdirSync(join(DIST, "icons"), { recursive: true });
writeFileSync(join(DIST, "icons", "icon-192.png"), pngIcon(192));
writeFileSync(join(DIST, "icons", "icon-512.png"), pngIcon(512));
const built = walk(DIST).length + 2;
console.log(`dist/ construit (${built} fichiers, app v${APP_VERSION}, schéma v${SCHEMA_VERSION})`);
if (!statSync(join(DIST, "index.html")).isFile()) throw new Error("index.html manquant");
