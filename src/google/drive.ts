import type { PortDrive } from "./port";

// Adaptateur Drive réel (M2, ADR-10) : appDataFolder, un fichier par clé.
// L'état répliqué est le format d'export US23 (JSON). Sync par polling modifiedTime (V2-S2′).
// fetch et jeton injectés (ADR-08) pour les tests.

const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

export interface DepsDrive {
  fetch?: typeof fetch;
  jeton: () => string | null;
}

export interface FichierDistant {
  id: string;
  name: string;
  modifiedTime: string;
}

export interface PortDriveEtendu extends PortDrive {
  lireDistantAvecMeta(cle: string): Promise<{ valeur: string; meta: FichierDistant } | null>;
}

export function adaptateurDrive(deps: DepsDrive): PortDriveEtendu {
  const fetchFn = deps.fetch ?? fetch;

  async function req(url: string, init: RequestInit = {}, brut = false): Promise<any> {
    const j = deps.jeton();
    if (!j) throw new Error("non connecté à Google");
    const r = await fetchFn(url, { ...init, headers: { Authorization: `Bearer ${j}`, ...(init.headers as object ?? {}) } });
    if (!r.ok) throw new Error(`Drive : HTTP ${r.status}`);
    return brut ? r.text() : r.json();
  }

  async function trouver(cle: string): Promise<FichierDistant | null> {
    const q = encodeURIComponent(`appDataFolder and name='${cle}' and trashed=false`);
    const j = await req(`${API}?q=${q}&fields=files(id,name,modifiedTime)&spaces=appDataFolder`);
    return j.files?.[0] ?? null;
  }

  return {
    async lireDistant(cle: string): Promise<string | null> {
      const f = await trouver(cle);
      if (!f) return null;
      return req(`${API}/${f.id}?alt=media`, {}, true);
    },
    async lireDistantAvecMeta(cle: string) {
      const f = await trouver(cle);
      if (!f) return null;
      const valeur = await req(`${API}/${f.id}?alt=media`, {}, true);
      return { valeur, meta: f };
    },
    async ecrireDistant(cle: string, valeur: string): Promise<void> {
      const f = await trouver(cle);
      if (f) {
        await req(`${UPLOAD}/${f.id}?uploadType=media&fields=id,name,modifiedTime`, {
          method: "PATCH", body: valeur, headers: { "Content-Type": "application/json" },
        });
        return;
      }
      const meta = JSON.stringify({ name: cle, parents: ["appDataFolder"] });
      const form = new FormData();
      form.append("metadata", new Blob([meta], { type: "application/json" }));
      form.append("file", new Blob([valeur], { type: "application/json" }));
      await req(`${UPLOAD}?uploadType=multipart&fields=id,name,modifiedTime`, { method: "POST", body: form });
    },
  };
}
