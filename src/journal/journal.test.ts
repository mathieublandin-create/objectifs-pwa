import { describe, expect, it } from "vitest";
import { ajouterEvenement, evenementsDeDiff, horodatage, JOURNAL_MAX_LOTS, type Journal } from "./journal";
import { createTask, initialData, saisieTemps } from "../domain/domaine";
import type { AppData } from "../domain/types";

const NOW = new Date(2026, 10, 3, 9, 30, 15);
const genId = (() => { let n = 0; return () => "id" + ++n; })();

describe("US22 — journal", () => {
  it("horodatage ISO local à la seconde", () => {
    expect(horodatage(NOW)).toBe("2026-11-03T09:30:15");
  });

  it("ajouterEvenement : crée le lot du jour, rotation à 30 lots", () => {
    let j: Journal = { lots: [] };
    j = ajouterEvenement(j, { at: horodatage(NOW), type: "tache", message: "m1" }, NOW);
    expect(j.lots).toHaveLength(1);
    expect(j.lots[0].evenements[0].message).toBe("m1");
    for (let d = 1; d <= 35; d++) {
      const day = new Date(2026, 10, 3 + d);
      j = ajouterEvenement(j, { at: horodatage(day), type: "t", message: "x" }, day);
    }
    expect(j.lots.length).toBe(JOURNAL_MAX_LOTS);
  });

  it("evenementsDeDiff : création de tâche détectée", () => {
    const goal = { id: "g1", title: "Cuisine", p: 2 as const, color: "#000", echeance: "" };
    const prev: AppData = { ...initialData(NOW), goals: [], tasks: [], entries: [] };
    const avecGoal = { ...prev, goals: [goal] };
    const { data: next } = createTask(avecGoal, { title: "Peindre", goalId: "g1", prio: "haute", estime: 2 }, NOW, genId);
    const next2 = next;
    const evts = evenementsDeDiff(prev, next2, NOW);
    expect(evts.some((e) => e.type === "objectif" && e.message.includes("créé"))).toBe(true);
    expect(evts.some((e) => e.type === "tache" && e.message.includes("créée"))).toBe(true);
  });

  it("evenementsDeDiff : saisie de temps et changement d'état détectés", () => {
    const base: AppData = { ...initialData(NOW), goals: [{ id: "g1", title: "Cuisine", p: 2 as const, color: "#000", echeance: "" }], tasks: [], entries: [] };
    const { data: d1, task } = createTask(base, { title: "Peindre", goalId: "g1", prio: "haute", estime: 2 }, NOW, genId);
    const { task: t2 } = saisieTemps(task, 1, 1, NOW, genId);
    const d2 = { ...d1, tasks: [t2], entries: [{ id: "e1", taskId: t2.id, date: "2026-11-03", hours: 1 }] };
    const evts = evenementsDeDiff(d1, d2, NOW);
    expect(evts.some((e) => e.type === "saisie")).toBe(true);
    expect(evts.some((e) => e.type === "etat")).toBe(true);
  });

  it("evenementsDeDiff : aucun changement → aucun événement", () => {
    const d = initialData(NOW);
    expect(evenementsDeDiff(d, d, NOW)).toEqual([]);
  });
});
