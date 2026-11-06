import { useState } from "react";
import {
  bloqueursDe, cloturerTache, datePlanifieeOk, deleteTask, detectCycle,
  etatLabel, h, prochainEtat, reouvrirTache, transitionEtat,
} from "../domain/domaine";
import type { AppData, Etat, Prio, Task } from "../domain/types";

interface Props {
  data: AppData;
  task: Task;
  now: Date;
  genId: () => string;
  majData: (d: AppData) => void;
  onClose: () => void;
}

export function FicheTache({ data, task, now, genId, majData, onClose }: Props) {
  const [titre, setTitre] = useState(task.title);
  const [prio, setPrio] = useState<Prio>(task.prio);
  const [date, setDate] = useState(task.date ?? "");
  const [deps, setDeps] = useState<string[]>(task.deps ?? []);
  const [total, setTotal] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const majTache = (patch: Partial<Task>) =>
    majData({ ...data, tasks: data.tasks.map((x) => (x.id === task.id ? { ...x, ...patch } : x)) });

  const basculeDep = (id: string) => {
    if (deps.includes(id)) { setDeps(deps.filter((d) => d !== id)); return; }
    if (detectCycle(data.tasks, task.id, id)) { setErreur("Dépendance refusée : cycle détecté (US19)"); return; }
    setDeps([...deps, id]); setErreur(null);
  };

  const appliquer = () => {
    majTache({ title: titre.trim(), prio, date: date || undefined, deps });
    onClose();
  };

  const transition = (cible: Etat) => {
    const r = transitionEtat(task, cible, data.tasks, datePlanifieeOk({ ...task, date: date || undefined }));
    if (!r.ok) { setErreur(r.raison ?? "transition refusée"); return; }
    const nouvelle = cible === "a_planifier" ? reouvrirTache(task, now) : { ...task, etat: cible };
    majTache({ ...nouvelle, title: titre.trim(), prio, date: date || undefined, deps });
    setErreur(null);
  };

  const cloturer = () => {
    const t = Number(total);
    if (isNaN(t) || t < 0) { setErreur("temps total invalide"); return; }
    try {
      const { task: nt, entry } = cloturerTache({ ...task, title: titre.trim(), prio, date: date || undefined, deps }, t, now, genId);
      majData({ ...data, tasks: data.tasks.map((x) => (x.id === task.id ? nt : x)), entries: entry ? [...data.entries, entry] : data.entries });
      onClose();
    } catch (e) {
      setErreur((e as Error).message);
    }
  };

  const bloqueurs = bloqueursDe(task, data.tasks);
  const candidatsDeps = data.tasks.filter((t) => t.id !== task.id && !t.supprimee && t.etat !== "terminee");

  return (
    <div role="dialog" aria-label={`Fiche ${task.title}`} className="dialog-fond">
      <div className="dialog">
        <h2>Fiche tâche</h2>
        {erreur && <p role="alert" className="alerte erreur">⚠️ {erreur}</p>}
        <label className="champ"><span>Titre</span>
          <input type="text" value={titre} onChange={(e) => setTitre(e.target.value)} />
        </label>
        <label className="champ"><span>Priorité</span>
          <select value={prio} onChange={(e) => setPrio(e.target.value as Prio)}>
            <option value="haute">haute</option><option value="moyenne">moyenne</option><option value="basse">basse</option>
          </select>
        </label>
        <label className="champ"><span>Date planifiée</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <fieldset>
          <legend>Prérequis (US19)</legend>
          {bloqueurs.length > 0 && <p className="alerte avertissement">Bloquée par : {bloqueurs.map((b) => b.title).join(", ")}</p>}
          {candidatsDeps.map((t) => (
            <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44 }}>
              <input type="checkbox" checked={deps.includes(t.id)} onChange={() => basculeDep(t.id)} /> {t.title}
            </label>
          ))}
        </fieldset>
        <p>État : <span className={`badge ${task.prio}`}>{etatLabel[task.etat]}</span> · restantes {h(task.restant)} · passées {h(task.passe)}</p>
        <p>
          {prochainEtat(task) !== task.etat && (
            <button className="secondaire" onClick={() => transition(prochainEtat(task))}>
              → {etatLabel[prochainEtat(task)]}
            </button>
          )}
          {task.etat === "terminee" && (
            <button className="secondaire" onClick={() => transition("a_planifier")}>↺ ré-ouvrir</button>
          )}
        </p>
        {task.etat === "en_cours" && (
          <p>
            <label className="champ"><span>Temps total passé (h)</span>
              <input type="number" min="0" step="0.5" value={total} onChange={(e) => setTotal(e.target.value)} style={{ maxWidth: 110 }} />
            </label>
            <button className="secondaire" onClick={cloturer}>Clôturer (US2)</button>
          </p>
        )}
        <p>
          <button className="primaire" onClick={appliquer}>Enregistrer</button>{" "}
          <button className="secondaire" aria-label="Supprimer la tâche" onClick={() => { majData(deleteTask(data, task.id)); onClose(); }}>🗑 supprimer</button>{" "}
          <button className="secondaire" onClick={onClose}>Fermer</button>
        </p>
      </div>
    </div>
  );
}
