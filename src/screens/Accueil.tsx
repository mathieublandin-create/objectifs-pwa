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
    <main style={{ fontFamily: "sans-serif", padding: "1rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>Objectifs</h1>
      <p style={{ color: "#555" }}>App v{versionApp} · schéma v9 — accueil lecture seule (M1 en cours).</p>
      <p>
        <button onClick={onExport} style={{ minHeight: 44 }}>⬇ Exporter mes données (JSON)</button>{" "}
        <label style={{ minHeight: 44, display: "inline-block" }}>
          ⬆ Importer un export (JSON){" "}
          <input type="file" accept="application/json,.json" onChange={onImport} style={{ display: "block" }} />
        </label>
      </p>
      <h2>Objectifs ({goalsActifs.length})</h2>
      <ul>
        {goalsActifs.map((g) => (
          <li key={g.id}><b>{g.title}</b> — échéance {g.echeance || "—"}</li>
        ))}
      </ul>
      <h2>Tâches ({taches.length})</h2>
      {groupes.map((gr) => (
        <section key={gr.etat}>
          <h3>{etatLabel[gr.etat]} ({gr.items.length})</h3>
          <ul>
            {gr.items.map((t) => (
              <li key={t.id}>{t.title} — {h(t.restant)} restantes</li>
            ))}
          </ul>
        </section>
      ))}
      <h3>À planifier / planifiées par urgence</h3>
      <ol>
        {backlog.slice(0, 10).map((t) => (
          <li key={t.id}>{t.title} ({etatLabel[t.etat]})</li>
        ))}
      </ol>
    </main>
  );
}
