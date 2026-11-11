import { useState } from "react";
import { compteDepuisEmail, statutSyncTache, synchroniserAgenda, actives } from "../domain/domaine";
import type { AppData } from "../domain/types";
import type { AuthReelle } from "../google/auth";
import type { PortDriveEtendu } from "../google/drive";
import type { adaptateurCalendar } from "../google/calendar";
import type { adaptateurSync } from "../google/sync";
import { GoogleDrive } from "./GoogleDrive";

interface Props {
  data: AppData;
  now: Date;
  majData: (d: AppData) => void;
  versionApp: string;
  google: { auth: AuthReelle; drive: PortDriveEtendu; calendar: ReturnType<typeof adaptateurCalendar>; sync: ReturnType<typeof adaptateurSync> } | null;
}

// US14/US1 — écran Google. M2 : OAuth/Drive/Calendar réels quand VITE_OBJECTIFS_GOOGLE_CLIENT_ID
// est configuré (ADR-12) ; sinon repli sur la simulation M1.
export function Google({ data, now, majData, versionApp, google }: Props) {
  const [email, setEmail] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const connecter = async () => {
    setOccupe(true);
    try {
      if (google) {
        const compte = await google.auth.connecter();
        if (!compte) { setErreur("Connexion Google refusée ou impossible"); return; }
        majData({ ...data, account: compte });
      } else {
        const compte = compteDepuisEmail(email);
        if (!compte) { setErreur("Adresse e-mail invalide"); return; }
        majData({ ...data, account: compte });
      }
      setErreur(null); setInfo(null);
    } catch (e) { setErreur((e as Error).message); }
    finally { setOccupe(false); }
  };

  const deconnecter = async () => {
    if (google) await google.auth.deconnecter();
    majData({ ...data, account: null });
  };

  const lancerSync = async () => {
    setOccupe(true);
    try {
      if (google) {
        for (const t of actives(data.tasks)) {
          if (t.date && t.etat !== "terminee") await google.calendar.pousserTache(t);
          else if (t.etat === "terminee" || t.supprimee) await google.calendar.retirerTache(t.id).catch(() => {});
        }
      }
      const r = synchroniserAgenda(data, now);
      if (r.resume.erreur && !google) { setErreur(r.resume.erreur); return; }
      majData(r.data);
      setInfo(google ? `Agenda synchronisé (${r.resume.crees} créés, ${r.resume.maj} maj, ${r.resume.retires} retirés)` : null);
      setErreur(null);
    } catch (e) { setErreur((e as Error).message); }
    finally { setOccupe(false); }
  };

  const planifiees = actives(data.tasks).filter((t) => t.date);

  return (
    <>
      <section className="card" aria-label="Compte Google">
        <h2>Google (US14/US1)</h2>
        {!google && <p className="alerte info">OAuth non configurée (VITE_OBJECTIFS_GOOGLE_CLIENT_ID) — mode simulation M1.</p>}
        {data.account ? (
          <p>Connecté : <b>{data.account.nom}</b> <span className="meta">({data.account.email})</span>{" "}
            <button className="petite secondaire" onClick={deconnecter} disabled={occupe}>Déconnecter</button></p>
        ) : (
          <>
            {!google && (
              <label className="champ"><span>E-mail du compte Google (simulation)</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
            )}
            <button className="primaire" onClick={connecter} disabled={occupe}>
              {google ? "Se connecter avec Google" : "Connecter"}
            </button>
          </>
        )}
        {erreur && <p role="alert" className="alerte erreur">⚠️ {erreur}</p>}
        {info && <p className="alerte info">ℹ️ {info}</p>}
      </section>
      {google && data.account && (
        <GoogleDrive data={data} now={now} versionApp={versionApp} occupe={occupe}
          setOccupe={setOccupe} setErreur={setErreur} setInfo={setInfo} majData={majData}
          drive={google.drive} sync={google.sync} />
      )}
      <section className="card" aria-label="Synchronisation agenda">
        <h3>Agenda</h3>
        <button className="secondaire" onClick={lancerSync} disabled={!data.account || occupe}>Synchroniser l'agenda</button>
        <h3>Tâches planifiées ({planifiees.length})</h3>
        {planifiees.length === 0 ? <p className="vide">Aucune tâche planifiée.</p> : (
          <ul className="liste">
            {planifiees.map((t) => (
              <li className="ligne" key={t.id}>
                {t.title} <span className="meta">{t.date}</span>
                <span className="badge">{statutSyncTache(t, data.agenda, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
