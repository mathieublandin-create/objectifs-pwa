import { useState } from "react";
import {
  actives, cloturerTache, createTask, deleteTask, groupesParEtat, etatLabel, h,
  prochainEtat, reouvrirTache, saisieTemps, transitionEtat, validerNouvelleTache,
} from "../domain/domaine";
import type { AppData, Etat, Prio, Task } from "../domain/types";

interface Props {
  data: AppData;
  now: Date;
  genId: () => string;
  majData: (d: AppData) => void;
}

export function Taches({ data, now, genId, majData }: Props) {
  const [titre, setTitre] = useState("");
  const [goalId, setGoalId] = useState("");
  const [prio, setPrio] = useState<Prio>("moyenne");
  const [estime, setEstime] = useState("1");
  const [date, setDate] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [saisieId, setSaisieId] = useState<string | null>(null);
  const [temps, setTemps] = useState("");

  const goalIds = data.goals.filter((g) => !g.archive).map((g) => g.id);
  const taches = actives(data.tasks);
  const groupes = groupesParEtat(taches, data.goals);

  const creer = () => {
    const input = { title: titre, goalId, prio, estime: Number(estime), date: date || undefined };
    const err = validerNouvelleTache(input, goalIds);
    if (err) { setErreur(err); return; }
    const { data: d2 } = createTask(data, input, now, genId);
    majData(d2);
    setTitre(""); setErreur(null);
  };

  const transition = (t: Task, cible: Etat) => {
    const r = transitionEtat(t, cible, data.tasks, !!t.date);
    if (!r.ok) { setErreur(r.raison ?? "transition refusée"); return; }
    // US29 : la ré-ouverture (terminée → à planifier) emprunte reouvrirTache
    const nouvelle = cible === "a_planifier" ? reouvrirTache(t, now) : { ...t, etat: cible };
    const maj = data.tasks.map((x) => (x.id === t.id ? { ...nouvelle, historiqueEtat: [...(x.historiqueEtat ?? []), { etat: cible, date: now.toISOString().slice(0, 10) }] } : x));
    majData({ ...data, tasks: maj });
    setErreur(null);
  };

  const validerSaisie = (t: Task) => {
    const total = Number(temps);
    if (isNaN(total) || total < 0) { setErreur("temps invalide"); return; }
    const restant = Math.max(Math.round((t.estimeInitial - (t.passe + (total - t.passe))) * 10) / 10, 0);
    const { task, entry } = saisieTemps(t, total - t.passe, restant, now, genId);
    const tasks = data.tasks.map((x) => (x.id === t.id ? task : x));
    majData({ ...data, tasks, entries: entry ? [...data.entries, entry] : data.entries });
    setSaisieId(null); setTemps("");
  };

  return (
    <section aria-label="Tâches">
      <h2>Tâches ({taches.length})</h2>
      {erreur && <p role="alert" style={{ background: "#fee2e2", color: "#991b1b", padding: "0.5rem" }}>⚠️ {erreur}</p>}
      {groupes.map((gr) => (
        <section key={gr.etat}>
          <h3>{etatLabel[gr.etat]} ({gr.items.length})</h3>
          <ul>
            {gr.items.map((t) => (
              <li key={t.id}>
                {t.title} — {h(t.restant)} restantes
                {prochainEtat(t) !== t.etat && (
                  <button aria-label={`Passer ${t.title} à ${etatLabel[prochainEtat(t)]}`} style={{ minHeight: 44, marginLeft: 8 }}
                    onClick={() => transition(t, prochainEtat(t))}>
                    → {etatLabel[prochainEtat(t)]}
                  </button>
                )}
                {t.etat === "en_cours" && (
                  saisieId === t.id ? (
                    <span>
                      <input type="number" min="0" step="0.5" value={temps} onChange={(e) => setTemps(e.target.value)} style={{ minHeight: 44, width: 80 }} aria-label="Temps total passé en heures" />
                      <button style={{ minHeight: 44 }} onClick={() => validerSaisie(t)}>Valider</button>
                    </span>
                  ) : (
                    <button aria-label={`Saisir du temps sur ${t.title}`} style={{ minHeight: 44, marginLeft: 8 }} onClick={() => setSaisieId(t.id)}>⏱ temps</button>
                  )
                )}
                <button aria-label={`Supprimer ${t.title}`} style={{ minHeight: 44, marginLeft: 8 }}
                  onClick={() => majData(deleteTask(data, t.id))}>🗑</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <h3>Nouvelle tâche</h3>
      <p><label>Titre <input value={titre} onChange={(e) => setTitre(e.target.value)} style={{ minHeight: 44 }} /></label></p>
      <p><label>Objectif <select value={goalId} onChange={(e) => setGoalId(e.target.value)} style={{ minHeight: 44 }}>
        <option value="">— choisir —</option>
        {goalIds.map((id) => <option key={id} value={id}>{data.goals.find((g) => g.id === id)?.title}</option>)}
      </select></label></p>
      <p><label>Priorité <select value={prio} onChange={(e) => setPrio(e.target.value as Prio)} style={{ minHeight: 44 }}>
        <option value="haute">haute</option><option value="moyenne">moyenne</option><option value="basse">basse</option>
      </select></label></p>
      <p><label>Estimation (h) <input type="number" min="0.5" step="0.5" value={estime} onChange={(e) => setEstime(e.target.value)} style={{ minHeight: 44, width: 80 }} /></label>
        <label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ minHeight: 44 }} /></label></p>
      <button onClick={creer} disabled={!titre.trim() || !goalId} style={{ minHeight: 44 }}>Créer la tâche</button>
    </section>
  );
}
