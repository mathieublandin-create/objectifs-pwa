import { useMemo } from "react";
import { actives, capaciteJour, groupesParEtat, h, isoDuJour, triParUrgence } from "../domain/domaine";
import type { AppData } from "../domain/types";

interface Props {
  data: AppData;
  now: Date;
  onOuvrirFiche: (taskId: string) => void;
}

export function Rituel({ data, now, onOuvrirFiche }: Props) {
  const taches = actives(data.tasks);
  const auj = isoDuJour(now);
  const duJour = taches.filter((t) => t.date === auj && t.etat !== "terminee");
  const capacite = capaciteJour(now, data.preferences);
  const charge = duJour.reduce((s, t) => s + t.restant, 0);
  const backlog = useMemo(
    () => triParUrgence(taches.filter((t) => (t.etat === "a_planifier" || t.etat === "planifiee") && t.date !== auj), data.goals, taches, null, now),
    [taches, data.goals, now, auj]
  );
  const enCours = groupesParEtat(taches, data.goals).find((g) => g.etat === "en_cours")?.items ?? [];
  const pct = capacite > 0 ? Math.min(100, Math.round((charge / capacite) * 100)) : 0;

  return (
    <>
      <section className="card" aria-label="Rituel du matin">
        <h2>🌅 Matin (7 h) — {auj}</h2>
        <p className="meta">{duJour.length} tâche(s) aujourd'hui · {h(charge)} / capacité {capacite} h ({pct}%)</p>
        <div className="barre" style={{ margin: "6px 0 10px" }}><div style={{ width: `${pct}%` }} /></div>
        {duJour.length === 0 ? <p className="vide">Aucune tâche planifiée aujourd'hui.</p> : (
          <ul className="liste">
            {duJour.map((t) => (
              <li className="ligne" key={t.id}>
                <button className="lien" onClick={() => onOuvrirFiche(t.id)}>{t.title}</button>
                <span className="meta">{h(t.restant)} restantes</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {enCours.length > 0 && (
        <section className="card" aria-label="Tâches en cours">
          <h3>▶ En cours</h3>
          <ul className="liste">
            {enCours.map((t) => <li className="ligne" key={t.id}>{t.title} <span className="meta">{h(t.restant)} restantes</span></li>)}
          </ul>
        </section>
      )}
      <section className="card" aria-label="Rituel du soir">
        <h3>🌙 Soir (21 h) — à planifier ensuite</h3>
        {backlog.length === 0 ? <p className="vide">Backlog vide.</p> : (
          <ol>
            {backlog.slice(0, 10).map((t) => (
              <li key={t.id}>
                <button className="lien" onClick={() => onOuvrirFiche(t.id)}>{t.title}</button>{" "}
                <span className="meta">({h(t.restant)})</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
