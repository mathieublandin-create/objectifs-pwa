import { useMemo } from "react";
import {
  actives, computeVelocity, estimeFin, estimeFinObjectif, fiabilite, grouperParJour, h, smartCheck, triParUrgence,
} from "../domain/domaine";
import type { AppData } from "../domain/types";

interface Props {
  data: AppData;
  now: Date;
}

export function Stats({ data, now }: Props) {
  const taches = actives(data.tasks);
  const vel = useMemo(() => computeVelocity(data.entries), [data.entries]);
  const fiab = useMemo(() => fiabilite(taches), [taches]);
  const parJour = useMemo(() => grouperParJour(data.entries), [data.entries]);
  const restantTotal = taches.filter((t) => t.etat !== "terminee").reduce((s, t) => s + t.restant, 0);
  const finGlobale = estimeFin(restantTotal, vel.velocite, now);
  const objectifs = data.goals.filter((g) => !g.archive);

  return (
    <section aria-label="Statistiques">
      <h2>Statistiques</h2>
      <p>Vélocité : <b>{vel.velocite !== null ? `${vel.velocite} h/j` : "—"}</b> ({vel.statut}, {vel.jours} j de saisies)</p>
      <p>Fiabilité : <b>{fiab.derive !== null ? `${fiab.derive > 0 ? "+" : ""}${fiab.derive} h de dérive` : "—"}</b> sur {fiab.nb} tâches clôturées</p>
      <p>Reste à faire : <b>{h(restantTotal)}</b> → fin estimée {finGlobale ? finGlobale.toLocaleDateString("fr-FR") : "—"}</p>
      <h3>Par objectif</h3>
      <ul>
        {objectifs.map((g) => {
          const s = smartCheck(g, taches, vel.velocite, now);
          const fin = estimeFinObjectif(g, taches, vel.velocite, now);
          return (
            <li key={g.id}>
              <b>{g.title}</b> — reste {h(s.restant)} — SMART {s.score}/100
              {s.risque && " ⚠️ risque"} — fin estimée {fin ? fin.toLocaleDateString("fr-FR") : "—"}
            </li>
          );
        })}
      </ul>
      <h3>Saisies par jour (10 derniers)</h3>
      <ul>
        {parJour.slice(0, 10).map((j) => (
          <li key={j.date}>{j.date} — {h(j.total)}</li>
        ))}
      </ul>
      <h3>Backlog par urgence</h3>
      <ol>
        {triParUrgence(taches.filter((t) => t.etat === "a_planifier" || t.etat === "planifiee"), data.goals, taches, vel.velocite, now).slice(0, 10).map((t) => (
          <li key={t.id}>{t.title} ({h(t.restant)})</li>
        ))}
      </ol>
    </section>
  );
}
