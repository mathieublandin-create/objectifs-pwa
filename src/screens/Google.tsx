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
    <section aria-label="Google">
      <h2>Google (US14/US1)</h2>
      {data.account ? (
        <p>Connecté : <b>{data.account.nom}</b> ({data.account.email}){" "}
          <button style={{ minHeight: 44 }} onClick={() => majData({ ...data, account: null })}>Déconnecter</button></p>
      ) : (
        <p>
          <label>E-mail du compte Google <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ minHeight: 44 }} /></label>{" "}
          <button style={{ minHeight: 44 }} onClick={connecter}>Connecter</button>
        </p>
      )}
      {erreur && <p role="alert" style={{ background: "#fee2e2", color: "#991b1b", padding: "0.5rem" }}>⚠️ {erreur}</p>}
      <button style={{ minHeight: 44 }} onClick={lancerSync} disabled={!data.account}>Synchroniser l'agenda</button>
      <h3>Tâches planifiées ({planifiees.length})</h3>
      <ul>
        {planifiees.map((t) => (
          <li key={t.id}>{t.title} — {t.date} — {statutSyncTache(t, data.agenda, now)}</li>
        ))}
      </ul>
    </section>
  );
}
