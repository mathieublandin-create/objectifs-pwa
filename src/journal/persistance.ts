import type { PortStockageAsync } from "../storage/port";
import { journalCle, type Journal } from "./journal";

export async function chargerJournal(port: PortStockageAsync, accountId: string | null): Promise<Journal> {
  try {
    const raw = await port.lire(journalCle(accountId));
    if (!raw) return { lots: [] };
    const j = JSON.parse(raw);
    return Array.isArray(j?.lots) ? j : { lots: [] };
  } catch {
    return { lots: [] };
  }
}

export async function sauvegarderJournal(port: PortStockageAsync, accountId: string | null, journal: Journal): Promise<void> {
  await port.ecrire(journalCle(accountId), JSON.stringify(journal));
}
