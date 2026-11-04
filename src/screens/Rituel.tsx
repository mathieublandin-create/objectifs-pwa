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

  return (
    <section aria-label="Rituels">
      <h2>Rituel du jour — {auj}</h2>
      <h3>🌅 Matin (7 h) — aujourd'hui : {duJour.length} tâche(s), {h(charge)} / capacité {capacite} h</h3>
      <ul>
        {duJour.map((t) => (
          <li key={t.id}><button style={{ minHeight: 44 }} onClick={() => onOuvrirFiche(t.id)}>{t.title}</button> — {h(t.restant)} restantes</li>
        ))}
      </ul>
      {enCours.length > 0 && (
        <>
          <h3>▶ En cours</h3>
          <ul>{enCours.map((t) => <li key={t.id}>{t.title} — {h(t.restant)} restantes</li>)}</ul>
        </>
      )}
      <h3>🌙 Soir (21 h) — à planifier ensuite</h3>
      <ol>
        {backlog.slice(0, 10).map((t) => (
          <li key={t.id}><button style={{ minHeight: 44 }} onClick={() => onOuvrirFiche(t.id)}>{t.title}</button> ({h(t.restant)})</li>
        ))}
      </ol>
    </section>
  );
}
