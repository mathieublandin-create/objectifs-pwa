import { exporterDonnees } from "../domain/exportImport";
import { checkIntegrity, SCHEMA_VERSION } from "../domain/domaine";
import { cleStockage } from "../storage/port";
import type { AppData } from "../domain/types";
import type { PortDriveEtendu } from "./drive";

// Synchronisation Drive (V2-S2′, ADR-10) : polling du modifiedTime, dernier écrivain gagne.
// La décision est une fonction pure (testable) ; l'I/O reste derrière le port Drive.
// Hors ligne : aucune synchro, l'app reste pleinement fonctionnelle (ADR-01).

export type ActionSync = "pousser" | "tirer" | "rien";

export function deciderSynchro(majLocale: string | null, modifiedTimeDistant: string | null): ActionSync {
  if (!modifiedTimeDistant) return "pousser"; // aucun état distant -> on publie
  if (!majLocale) return "tirer"; // aucune trace locale -> on adopte le distant
  const l = new Date(majLocale).getTime();
  const d = new Date(modifiedTimeDistant).getTime();
  if (isNaN(l) || isNaN(d)) return "rien";
  if (d > l) return "tirer";
  if (l > d) return "pousser";
  return "rien"; // à égalité : rien (le distant est déjà reflété)
}

// Import v9 strict via le contrôle d'intégrité du domaine (cohérent avec l'export AppData)
function importerV9(json: string): { data: AppData | null; erreur: string | null } {
  try {
    const obj = JSON.parse(json);
    if (obj?.format !== "objectifs-donnees-v1" || obj?.donnees?.version !== SCHEMA_VERSION)
      return { data: null, erreur: "Format ou schéma non reconnu" };
    const err = checkIntegrity(obj.donnees);
    if (err) return { data: null, erreur: err };
    return { data: { ...obj.donnees, account: null }, erreur: null };
  } catch {
    return { data: null, erreur: "JSON illisible" };
  }
}

export interface DepsSync {
  drive: PortDriveEtendu;
  lireMaj: () => string | null;
  versionApp: string;
  now: () => Date;
}

export interface ResultatSync {
  action: ActionSync;
  erreur: string | null;
  data?: AppData; // renseigné quand action = "tirer" (données distantes à appliquer)
}

export function adaptateurSync(deps: DepsSync) {
  return {
    async synchroniser(data: AppData): Promise<ResultatSync> {
      const cle = cleStockage(data.account?.id ?? null);
      const dist = await deps.drive.lireDistantAvecMeta(cle);
      const action = deciderSynchro(deps.lireMaj(), dist?.meta.modifiedTime ?? null);
      if (action === "pousser") {
        const json = exporterDonnees(data, { versionApp: deps.versionApp, dateIso: deps.now().toISOString() } as any);
        await deps.drive.ecrireDistant(cle, json);
        return { action, erreur: null };
      }
      if (action === "tirer" && dist) {
        const r = importerV9(dist.valeur);
        if (!r.data) return { action, erreur: r.erreur ?? "import distant refusé" };
        return { action, erreur: null, data: r.data };
      }
      return { action, erreur: null };
    },
  };
}
