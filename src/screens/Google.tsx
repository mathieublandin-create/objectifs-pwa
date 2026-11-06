import { useState } from "react";
import { compteDepuisEmail, statutSyncTache, synchroniserAgenda, actives } from "../domain/domaine";
import type { AppData } from "../domain/types";

interface Props {
  data: AppData;
  now: Date;
  majData: (d: AppData) => void;
}

// US14/US1 — écran Google (simulation au M1 : la vraie OAuth/Drive arrive au M2, ADR-10/12).
export function Google({ data, now, majData }: Props) {
  const [email, setEmail] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const connecter = () => {
    const compte = compteDepuisEmail(email);
    if (!compte) { setErreur("Adresse e-mail invalide"); return; }
    majData({ ...data, account: compte });
    setErreur(null);
  };

  const lancerSync = () => {
    const r = synchroniserAgenda(data, now);
    if (r.resume.erreur) { setErreur(r.resume.erreur); return; }
    majData(r.data);
    setErreur(null);
  };

  const planifiees = actives(data.tasks).filter((t) => t.date);

  return (
    <>
      <section className="card" aria-label="Compte Google">
        <h2>Google (US14/US1)</h2>
        {data.account ? (
          <p>Connecté : <b>{data.account.nom}</b> <span className="meta">({data.account.email})</span>{" "}
            <button className="petite secondaire" onClick={() => majData({ ...data, account: null })}>Déconnecter</button></p>
        ) : (
          <>
            <label className="champ"><span>E-mail du compte Google</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="primaire" onClick={connecter}>Connecter</button>
          </>
        )}
        {erreur && <p role="alert" className="alerte erreur">⚠️ {erreur}</p>}
      </section>
      <section className="card" aria-label="Synchronisation agenda">
        <h3>Agenda</h3>
        <button className="secondaire" onClick={lancerSync} disabled={!data.account}>Synchroniser l'agenda</button>
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
