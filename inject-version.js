// Substitue {{APP_VERSION}} (version de package.json) dans les fichiers statiques
// copiés tels quels par Vite (public/ -> dist/), après le build.
import { readFileSync, writeFileSync } from "node:fs";

const version = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
for (const f of ["dist/sw.js", "dist/manifest.webmanifest"]) {
  const p = new URL("./" + f, import.meta.url);
  writeFileSync(p, readFileSync(p, "utf8").split("{{APP_VERSION}}").join(version));
}
console.log(`version ${version} injectée dans dist/sw.js et dist/manifest.webmanifest`);
