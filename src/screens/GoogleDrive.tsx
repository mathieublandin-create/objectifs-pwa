import type { AppData } from "../domain/types";
import type { AuthReelle } from "../google/auth";
import type { PortDriveEtendu } from "../google/drive";
import type { adaptateurSync } from "../google/sync";

interface Props {
  data: AppData;
  now: Date;
  versionApp: string;
  occupe: boolean;
  setOccupe: (b: boolean) => void;
  setErreur: (e: string | null) => void;
  setInfo: (i: string | null) => void;
  majData: (d: AppData) => void;
  drive: PortDriveEtendu;
  sync: ReturnType<typeof adaptateurSync>;
}

// Carte Drive (ADR-10) : sauvegarde, restauration et synchro dernier écrivain gagne (V2-S2′).
export function GoogleDrive({ data, now, versionApp, occupe, setOccupe, setErreur, setInfo, majData, drive, sync }: Props) {
  const sauvegarder = async () => {
    if (!data.account) return;
    setOccupe(true);
    try {
      const { exporterDonnees } = await import("../domain/exportImport");
      const { cleStockage } = await import("../storage/port");
      const json = exporterDonnees(data, { versionApp, dateIso: now.toISOString() } as any);
      await drive.ecrireDistant(cleStockage(data.account.id), json);
      setInfo("Sauvegarde Drive OK (appDataFolder, ADR-10)");
      setErreur(null);
    } catch (e) { setErreur((e as Error).message); }
    finally { setOccupe(false); }
  };

  const restaurer = async () => {
    if (!data.account) return;
    setOccupe(true);
    try {
      const { importerDonnees } = await import("../domain/exportImport");
      const { cleStockage } = await import("../storage/port");
      const txt = await drive.lireDistant(cleStockage(data.account.id));
      if (!txt) { setErreur("Aucune sauvegarde distante trouvée"); return; }
      const r = importerDonnees(txt);
      if (r.data) { majData(r.data); setInfo("Données restaurées depuis Drive"); }
      else setErreur(`Import refusé : ${r.erreur}`);
    } catch (e) { setErreur((e as Error).message); }
    finally { setOccupe(false); }
  };

  const synchroniser = async () => {
    if (!data.account) return;
    setOccupe(true);
    try {
      const r = await sync.synchroniser(data);
      if (r.erreur) { setErreur(r.erreur); return; }
      if (r.action === "tirer" && r.data) {
        majData({ ...r.data, account: data.account }); // compte actif conservé (US14)
        setInfo("Synchronisation Drive : données distantes appliquées (dernier écrivain gagne)");
      } else {
        setInfo(`Synchronisation Drive : ${r.action === "pousser" ? "état local publié" : "déjà à jour"}`);
      }
      setErreur(null);
    } catch (e) { setErreur((e as Error).message); }
    finally { setOccupe(false); }
  };

  return (
    <section className="card" aria-label="Sauvegarde distante">
      <h3>Drive appDataFolder (ADR-10)</h3>
      <button className="secondaire" onClick={sauvegarder} disabled={occupe}>💾 Sauvegarder sur Drive</button>{" "}
      <button className="secondaire" onClick={restaurer} disabled={occupe}>📥 Restaurer depuis Drive</button>{" "}
      <button className="primaire" onClick={synchroniser} disabled={occupe}>🔄 Synchroniser (Drive)</button>
    </section>
  );
}
