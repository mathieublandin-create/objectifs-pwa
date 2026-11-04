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
    <div role="dialog" aria-label={`Fiche ${task.title}`} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", padding: "1rem", maxWidth: 480, width: "90%", maxHeight: "90vh", overflow: "auto" }}>
        <h2>Fiche tâche</h2>
        {erreur && <p role="alert" style={{ background: "#fee2e2", color: "#991b1b", padding: "0.5rem" }}>⚠️ {erreur}</p>}
        <p><label>Titre <input value={titre} onChange={(e) => setTitre(e.target.value)} style={{ minHeight: 44 }} /></label></p>
        <p><label>Priorité <select value={prio} onChange={(e) => setPrio(e.target.value as Prio)} style={{ minHeight: 44 }}>
          <option value="haute">haute</option><option value="moyenne">moyenne</option><option value="basse">basse</option>
        </select></label></p>
        <p><label>Date planifiée <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ minHeight: 44 }} /></label></p>
        <fieldset>
          <legend>Prérequis (US19)</legend>
          {bloqueurs.length > 0 && <p>Bloquée par : {bloqueurs.map((b) => b.title).join(", ")}</p>}
          {candidatsDeps.map((t) => (
            <label key={t.id} style={{ display: "block", minHeight: 44 }}>
              <input type="checkbox" checked={deps.includes(t.id)} onChange={() => basculeDep(t.id)} /> {t.title}
            </label>
          ))}
        </fieldset>
        <p>État : <b>{etatLabel[task.etat]}</b> · restantes {h(task.restant)} · passées {h(task.passe)}</p>
        <p>
          {prochainEtat(task) !== task.etat && (
            <button style={{ minHeight: 44 }} onClick={() => transition(prochainEtat(task))}>→ {etatLabel[prochainEtat(task)]}</button>
          )}
          {task.etat === "terminee" && (
            <button style={{ minHeight: 44, marginLeft: 8 }} onClick={() => transition("a_planifier")}>↺ ré-ouvrir</button>
          )}
        </p>
        {task.etat === "en_cours" && (
          <p>
            <label>Temps total passé (h) <input type="number" min="0" step="0.5" value={total} onChange={(e) => setTotal(e.target.value)} style={{ minHeight: 44, width: 80 }} /></label>
            <button style={{ minHeight: 44 }} onClick={cloturer}>Clôturer (US2)</button>
          </p>
        )}
        <p>
          <button style={{ minHeight: 44 }} onClick={appliquer}>Enregistrer</button>{" "}
          <button aria-label="Supprimer la tâche" style={{ minHeight: 44 }} onClick={() => { majData(deleteTask(data, task.id)); onClose(); }}>🗑 supprimer</button>{" "}
          <button style={{ minHeight: 44 }} onClick={onClose}>Fermer</button>
        </p>
      </div>
    </div>
  );
}
