import { useState } from "react";
import { smartCheck, supprimerObjectif } from "../domain/domaine";
import type { AppData, Goal } from "../domain/types";

interface Props {
  data: AppData;
  now: Date;
  genId: () => string;
  majData: (d: AppData) => void;
}

export function Objectifs({ data, now, genId, majData }: Props) {
  const [titre, setTitre] = useState("");
  const [echeance, setEcheance] = useState("");
  const [specifique, setSpecifique] = useState("");

  const actifs = data.goals.filter((g) => !g.archive);
  const archives = data.goals.filter((g) => g.archive);

  const creer = () => {
    const g: Goal = {
      id: genId(), title: titre.trim(), p: 2, color: "#1e40af",
      echeance: echeance || "", specifique: specifique.trim() || undefined,
    };
    if (!g.title) return;
    majData({ ...data, goals: [...data.goals, g] });
    setTitre(""); setEcheance(""); setSpecifique("");
  };

  return (
    <section aria-label="Objectifs">
      <h2>Objectifs ({actifs.length})</h2>
      <ul>
        {actifs.map((g) => {
          const s = smartCheck(g, data.tasks, null, now);
          return (
            <li key={g.id}>
              <b>{g.title}</b> — échéance {g.echeance || "—"}
              {s.score < 100 && <span> · SMART {s.score}/100 (manquants : {s.manquants.join(", ")})</span>}
              {" "}<button aria-label={`Archiver ${g.title}`} style={{ minHeight: 44 }}
                onClick={() => majData(supprimerObjectif(data, g.id, "archiver"))}>Archiver</button>
            </li>
          );
        })}
      </ul>
      {archives.length > 0 && <details><summary>Archivés ({archives.length})</summary>
        <ul>{archives.map((g) => <li key={g.id}>{g.title}</li>)}</ul>
      </details>}
      <h3>Nouvel objectif</h3>
      <p>
        <label>Titre <input value={titre} onChange={(e) => setTitre(e.target.value)} style={{ minHeight: 44 }} /></label>
      </p>
      <p>
        <label>Échéance <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} style={{ minHeight: 44 }} /></label>
      </p>
      <p>
        <label>Spécifique (SMART) <input value={specifique} onChange={(e) => setSpecifique(e.target.value)} style={{ minHeight: 44 }} /></label>
      </p>
      <button onClick={creer} disabled={!titre.trim()} style={{ minHeight: 44 }}>Créer l'objectif</button>
    </section>
  );
}
