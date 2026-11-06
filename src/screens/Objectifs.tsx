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
      id: genId(), title: titre.trim(), p: 2, color: "#6366f1",
      echeance: echeance || "", specifique: specifique.trim() || undefined,
    };
    if (!g.title) return;
    majData({ ...data, goals: [...data.goals, g] });
    setTitre(""); setEcheance(""); setSpecifique("");
  };

  return (
    <>
      <section className="card" aria-label="Objectifs actifs">
        <h2>Objectifs ({actifs.length})</h2>
        {actifs.length === 0 ? <p className="vide">Aucun objectif — créez-en un ci-dessous.</p> : (
          <ul className="liste">
            {actifs.map((g) => {
              const s = smartCheck(g, data.tasks, null, now);
              const complet = s.manquants.length === 0;
              return (
                <li className="ligne" key={g.id}>
                  <span className="pastille" style={{ background: g.color }} />
                  <b>{g.title}</b>
                  <span className="meta">échéance {g.echeance || "—"}</span>
                  <span className={`badge ${complet ? "smart-ok" : "smart-ko"}`}>
                    SMART {complet ? "5/5" : `${5 - s.manquants.length}/5`}
                  </span>
                  {!complet && <span className="meta">manquants : {s.manquants.join(", ")}</span>}
                  <button className="petite secondaire" aria-label={`Archiver ${g.title}`}
                    onClick={() => majData(supprimerObjectif(data, g.id, "archiver"))}>Archiver</button>
                </li>
              );
            })}
          </ul>
        )}
        {archives.length > 0 && (
          <details>
            <summary>📦 Archivés ({archives.length})</summary>
            <ul className="liste">{archives.map((g) => <li className="ligne" key={g.id}>{g.title}</li>)}</ul>
          </details>
        )}
      </section>
      <section className="card" aria-label="Nouvel objectif">
        <h3>Nouvel objectif</h3>
        <label className="champ"><span>Titre</span>
          <input type="text" value={titre} onChange={(e) => setTitre(e.target.value)} />
        </label>
        <label className="champ"><span>Échéance</span>
          <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
        </label>
        <label className="champ"><span>Spécifique (SMART)</span>
          <input type="text" value={specifique} onChange={(e) => setSpecifique(e.target.value)} />
        </label>
        <button className="primaire" onClick={creer} disabled={!titre.trim()}>Créer l'objectif</button>
      </section>
    </>
  );
}
