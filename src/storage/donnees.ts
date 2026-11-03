import { checkIntegrity, initialData, migrateData, SCHEMA_VERSION } from "../domain/domaine";
import type { AppData } from "../domain/types";
import type { PortStockageAsync } from "./port";

export interface ResultatChargement {
  data: AppData;
  applied: string[];
  error: string | null;
}

// Charge les données depuis le port, applique les migrations nommées (US16) et l'intégrité (A5).
export async function chargerDonnees(port: PortStockageAsync, cle: string, now: Date): Promise<ResultatChargement> {
  try {
    const raw = await port.lire(cle);
    if (!raw) return { data: initialData(now), applied: [], error: null };
    const stored = JSON.parse(raw);
    if (stored.version === SCHEMA_VERSION) {
      const err = checkIntegrity(stored);
      if (err) return { data: initialData(now), applied: [], error: `données stockées invalides : ${err}` };
      return { data: stored as AppData, applied: [], error: null };
    }
    const result = migrateData(stored, now);
    if (result.error || !result.data) return { data: initialData(now), applied: result.applied, error: result.error };
    await port.ecrire(cle, JSON.stringify(result.data));
    return { data: result.data, applied: result.applied, error: null };
  } catch {
    return { data: initialData(now), applied: [], error: null };
  }
}

export async function sauvegarderDonnees(port: PortStockageAsync, cle: string, data: AppData): Promise<void> {
  await port.ecrire(cle, JSON.stringify(data));
}
