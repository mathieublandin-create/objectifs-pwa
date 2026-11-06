import { actives, etatLabel, h, groupesParEtat, triParUrgence } from "../domain/domaine";
import { exporterDonnees, importerDonnees } from "../domain/exportImport";
import type { AppData } from "../domain/types";

interface Props {
  data: AppData;
  now: Date;
  majData: (d: AppData) => void;
  versionApp: string;
}

export function Accueil({ data, now, majData, versionApp }: Props) {
  const goalsActifs = data.goals.filter((g) => !g.archive);
  const taches = actives(data.tasks);
  const groupes = groupesParEtat(taches, data.goals);
  const backlog = triParUrgence(taches.filter((t) => t.etat === "a_planifier" || t.etat === "planifiee"), data.goals, taches, null, now);

  const onExport = () => {
    const json = exporterDonnees(data, { versionApp, dateIso: now.toISOString() } as any);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `objectifs-export-${now.toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then((txt) => {
      const r = importerDonnees(txt);
      if (r.data) majData(r.data);
      else if (r.erreur) alert(`Import refusé : ${r.erreur}`);
    });
  };

  return (
    <>
      <section className="card" aria-label="Bienvenue">
        <p style={{ margin: 0, fontWeight: 600 }}>👋 Bienvenue dans Objectifs</p>
        <p className="meta" style={{ margin: "4px 0 0" }}>
          App v{versionApp} · schéma v9 — créez un objectif, ajoutez des tâches, planifiez.
        </p>
      </section>
      <section className="card" aria-label="Export import">
        <button className="secondaire" onClick={onExport}>⬇ Exporter mes données (JSON)</button>{" "}
        <label className="btn secondaire" style={{ display: "inline-block" }}>
          ⬆ Importer un export (JSON)
          <input type="file" accept="application/json,.json" onChange={onImport} style={{ display: "block", minHeight: 0 }} />
        </label>
      </section>
      <section className="card" aria-label="Objectifs actifs">
        <h2>Objectifs ({goalsActifs.length})</h2>
        {goalsActifs.length === 0 ? (
          <p className="vide">Aucun objectif actif — créez-en un dans l'onglet Objectifs.</p>
        ) : (
          <ul className="liste">
            {goalsActifs.map((g) => (
              <li className="ligne" key={g.id}>
                <span className="pastille" style={{ background: g.color }} />
                <b>{g.title}</b>
                <span className="meta">échéance {g.echeance || "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {groupes.map((gr) => (
        <section className="card" key={gr.etat} aria-label={etatLabel[gr.etat]}>
          <h3>{etatLabel[gr.etat]} ({gr.items.length})</h3>
          {gr.items.length === 0 ? <p className="vide">Aucune tâche.</p> : (
            <ul className="liste">
              {gr.items.map((t) => (
                <li className="ligne" key={t.id}>{t.title} <span className="meta">{h(t.restant)} restantes</span></li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <section className="card" aria-label="À planifier par urgence">
        <h3>À planifier / planifiées par urgence</h3>
        {backlog.length === 0 ? <p className="vide">Rien à planifier.</p> : (
          <ol>
            {backlog.slice(0, 10).map((t) => (
              <li key={t.id}>{t.title} <span className="meta">({etatLabel[t.etat]})</span></li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
