import { useMemo } from "react";
import { actives, capaciteJour, datePlanifieeOk, h, isoDuJour } from "../domain/domaine";
import type { AppData } from "../domain/types";

interface Props {
  data: AppData;
  now: Date;
  majData: (d: AppData) => void;
  onOuvrirFiche: (taskId: string) => void;
}

export function Calendrier({ data, now, majData, onOuvrirFiche }: Props) {
  const jours = useMemo(() => {
    const out: { iso: string; date: Date; capacite: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      out.push({ iso: isoDuJour(d), date: d, capacite: capaciteJour(d, data.preferences) });
    }
    return out;
  }, [now, data.preferences]);

  const planifiees = actives(data.tasks).filter((t) => t.date && datePlanifieeOk(t));
  const nonPlanifiees = actives(data.tasks).filter((t) => t.etat !== "terminee" && !datePlanifieeOk(t));

  const planifier = (taskId: string, iso: string) => {
    majData({ ...data, tasks: data.tasks.map((t) => (t.id === taskId ? { ...t, date: iso, etat: t.etat === "a_planifier" ? "planifiee" : t.etat } : t)) });
  };

  return (
    <section className="card" aria-label="Calendrier">
      <h2>Calendrier (14 jours)</h2>
      {jours.map((j) => {
        const duJour = planifiees.filter((t) => t.date === j.iso);
        const charge = duJour.reduce((s, t) => s + t.restant, 0);
        const pct = j.capacite > 0 ? Math.min(100, Math.round((charge / j.capacite) * 100)) : 0;
        return (
          <details key={j.iso}>
            <summary>
              <b>{j.iso}</b>
              <span className="meta">capacité {j.capacite} h · prévu {h(charge)} ({pct}%)</span>
            </summary>
            <div className="barre" style={{ margin: "4px 0 8px" }}><div style={{ width: `${pct}%` }} /></div>
            {duJour.length === 0 ? <p className="vide">Rien de planifié.</p> : (
              <ul className="liste">
                {duJour.map((t) => (
                  <li className="ligne" key={t.id}>
                    <button className="lien" onClick={() => onOuvrirFiche(t.id)}>{t.title}</button>
                    <span className="meta">{h(t.restant)}</span>
                  </li>
                ))}
              </ul>
            )}
            {j.iso >= isoDuJour(now) && nonPlanifiees.length > 0 && (
              <label className="champ"><span>Planifier</span>
                <select defaultValue="" onChange={(e) => e.target.value && planifier(e.target.value, j.iso)}>
                  <option value="">— choisir une tâche —</option>
                  {nonPlanifiees.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </label>
            )}
          </details>
        );
      })}
    </section>
  );
}
