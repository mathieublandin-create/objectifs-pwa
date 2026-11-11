import { isoLocal } from "../domain/domaine";

export const STORAGE_KEY = "objectifs-app-data";
export const PROBE_KEY = STORAGE_KEY + "::sonde";

export type StatutStockage = "indisponible" | "ephemere" | "persistant";

export function cleStockage(accountId: string | null): string {
  return accountId ? STORAGE_KEY + "::" + accountId : STORAGE_KEY;
}

// Timestamp de dernière écriture locale (synchro Drive V2-S2′)
export const cleMaj = (accountId: string | null): string => cleStockage(accountId) + "::maj";

export interface PortStockage {
  lire(cle: string): string | null;
  ecrire(cle: string, valeur: string): void;
}

export interface PortStockageAsync {
  lire(cle: string): Promise<string | null>;
  ecrire(cle: string, valeur: string): Promise<void>;
}

export function diagnosticStockage(ls: PortStockage | null, now: Date): StatutStockage {
  if (!ls) return "indisponible";
  try {
    if (ls.lire(PROBE_KEY)) return "persistant";
    ls.ecrire(PROBE_KEY, isoLocal(now));
    return "ephemere";
  } catch {
    return "indisponible";
  }
}
