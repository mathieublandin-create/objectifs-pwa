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
    <>
      <section className="card" aria-label="Statistiques globales">
        <h2>Statistiques</h2>
        <ul className="liste">
          <li className="ligne">Vélocité : <b>{vel.velocite !== null ? `${vel.velocite} h/sem` : "—"}</b>
            <span className="meta">({vel.statut}, {vel.jours} j de saisies)</span></li>
          <li className="ligne">Fiabilité : <b>{fiab.derive !== null ? `${fiab.derive > 0 ? "+" : ""}${fiab.derive} h de dérive` : "—"}</b>
            <span className="meta">sur {fiab.nb} tâche(s) clôturée(s)</span></li>
          <li className="ligne">Reste à faire : <b>{h(restantTotal)}</b>
            <span className="meta">→ fin estimée {finGlobale ? finGlobale.toLocaleDateString("fr-FR") : "—"}</span></li>
        </ul>
      </section>
      <section className="card" aria-label="Par objectif">
        <h3>Par objectif</h3>
        {objectifs.length === 0 ? <p className="vide">Aucun objectif actif.</p> : (
          <ul className="liste">
            {objectifs.map((g) => {
              const s = smartCheck(g, taches, vel.velocite, now);
              const fin = estimeFinObjectif(g, taches, vel.velocite, now);
              const complet = s.manquants.length === 0;
              return (
                <li className="ligne" key={g.id}>
                  <span className="pastille" style={{ background: g.color }} />
                  <b>{g.title}</b>
                  <span className="meta">reste {h(s.restant)}</span>
                  <span className={`badge ${complet ? "smart-ok" : "smart-ko"}`}>SMART {complet ? "5/5" : `${5 - s.manquants.length}/5`}</span>
                  {s.risque && <span className="badge risque">⚠️ à risque</span>}
                  <span className="meta">fin estimée {fin ? fin.toLocaleDateString("fr-FR") : "—"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="card" aria-label="Saisies par jour">
        <h3>Saisies par jour (10 derniers)</h3>
        {parJour.length === 0 ? <p className="vide">Aucune saisie de temps.</p> : (
          <ul className="liste">
            {parJour.slice(0, 10).map((j) => (
              <li className="ligne" key={j.date}>{j.date} <span className="meta">{h(j.total)}</span></li>
            ))}
          </ul>
        )}
      </section>
      <section className="card" aria-label="Backlog par urgence">
        <h3>Backlog par urgence</h3>
        <ol>
          {triParUrgence(taches.filter((t) => t.etat === "a_planifier" || t.etat === "planifiee"), data.goals, taches, vel.velocite, now).slice(0, 10).map((t) => (
            <li key={t.id}>{t.title} <span className="meta">({h(t.restant)})</span></li>
          ))}
        </ol>
      </section>
    </>
  );
}
