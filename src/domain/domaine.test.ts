import { describe, expect, it } from "vitest";
import {
  checkIntegrity,
  createTask,
  detectCycle,
  initialData,
  migrateData,
  prochainEtat,
  saisieTemps,
  smartCheck,
  synchroniserAgenda,
  transitionEtat,
  triParUrgence,
  validerNouvelleTache,
  isoDuJour,
  parseISO,
  computeVelocity,
} from "./domaine";
import type { AppData, Goal, Task } from "./types";

const NOW = new Date(2026, 10, 3, 10, 0, 0); // 03/11/2026 10:00 locale
const genId = (() => { let n = 0; return () => "id" + ++n; })();

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: "g1", title: "Peindre la cuisine", p: 2, color: "#1e40af", echeance: "2026-12-31", ...over,
});

const tache = (over: Partial<Task> = {}): Task => ({
  id: "t1", title: "Acheter la peinture", goalId: "g1", prio: "haute", etat: "a_planifier",
  estimeInitial: 2, passe: 0, restant: 2, ...over,
});

describe("domaine transplanté (ADR-04) — US16 migrations", () => {
  it("données v9 valides : intégrité OK, aucune migration", () => {
    const data = initialData(NOW);
    expect(checkIntegrity(data)).toBeNull();
    const r = migrateData(data, NOW);
    expect(r.error).toBeNull();
    expect(r.applied).toEqual([]);
    expect(r.data?.version).toBe(9);
  });

  it("données v8 migrées vers v9 avec journal", () => {
    const v8 = { ...initialData(NOW), version: 8 };
    const r = migrateData(v8, NOW);
    expect(r.error).toBeNull();
    expect(r.data?.version).toBe(9);
    expect(r.applied.length).toBeGreaterThan(0);
    expect(r.data?.migrationLog.length).toBe(r.applied.length);
  });

  it("version inconnue : refus avec erreur", () => {
    const r = migrateData({ version: 42 }, NOW);
    expect(r.data).toBeNull();
    expect(r.error).toContain("inattendu");
  });
});

describe("US28 — contrôles de saisie", () => {
  it("validerNouvelleTache : titre vide refusé", () => {
    expect(validerNouvelleTache({ title: "  ", goalId: "g1", estime: 2 }, ["g1"])).toBeTruthy();
  });
  it("validerNouvelleTache : objectif inconnu refusé", () => {
    expect(validerNouvelleTache({ title: "X", goalId: "g9", estime: 2 }, ["g1"])).toBeTruthy();
  });
  it("validerNouvelleTache : estimation nulle refusée, valide sinon", () => {
    expect(validerNouvelleTache({ title: "X", goalId: "g1", estime: 0 }, ["g1"])).toBeTruthy();
    expect(validerNouvelleTache({ title: "X", goalId: "g1", estime: 2 }, ["g1"])).toBeNull();
  });
});

describe("US29 — machine à états", () => {
  it("prochainEtat a_planifier -> planifiee -> en_cours -> terminee", () => {
    expect(prochainEtat(tache({ etat: "a_planifier" }))).toBe("planifiee");
    expect(prochainEtat(tache({ etat: "planifiee" }))).toBe("en_cours");
    expect(prochainEtat(tache({ etat: "en_cours" }))).toBe("terminee");
  });
  it("transition vers planifiee refusée sans date planifiée valide", () => {
    const r = transitionEtat(tache({ etat: "a_planifier" }), "planifiee", [], false);
    expect(r.ok).toBe(false);
    expect(r.raison).toBeTruthy();
  });
  it("transition hors cycle strict refusée", () => {
    const r = transitionEtat(tache({ etat: "a_planifier" }), "terminee", [], true);
    expect(r.ok).toBe(false);
    expect(r.raison).toContain("cycle strict");
  });
  it("transition en_cours -> terminee OK avec date valide", () => {
    const r = transitionEtat(tache({ etat: "en_cours", date: "2026-11-05" }), "terminee", [], true);
    expect(r.ok).toBe(true);
  });
});

describe("US4/US6 — saisie de temps", () => {
  it("saisie partielle -> en_cours, entrée journalisée à la date locale injectée", () => {
    const { task, entry } = saisieTemps(tache(), 1, 1, NOW, genId);
    expect(task.etat).toBe("en_cours");
    expect(task.passe).toBe(1);
    expect(entry?.date).toBe(isoDuJour(NOW));
  });
  it("saisie complète -> terminee avec dateFin", () => {
    const { task } = saisieTemps(tache(), 2, 0, NOW, genId);
    expect(task.etat).toBe("terminee");
    expect(task.dateFin).toBe(isoDuJour(NOW));
  });
});

describe("US24 — création de tâche", () => {
  it("createTask ajoute une tâche non supprimée, état initial journalisé", () => {
    const data: AppData = { ...initialData(NOW), tasks: [] };
    const { data: d2, task } = createTask(data, { title: "  Peindre ", goalId: "g1", prio: "haute", estime: 3, date: "2026-11-05" }, NOW, genId);
    expect(d2.tasks).toHaveLength(1);
    expect(task.title).toBe("Peindre");
    expect(task.etat).toBe("planifiee");
    expect(task.historiqueEtat?.[0].date).toBe(isoDuJour(NOW));
  });
});

describe("US19 — dépendances", () => {
  it("detectCycle refuse un cycle", () => {
    const a = tache({ id: "a" }), b = tache({ id: "b", deps: ["a"] });
    expect(detectCycle([a, b], "a", "b")).toBe(true);
    expect(detectCycle([a, b], "b", "a")).toBe(false);
  });
});

describe("US12 — contrôle SMART", () => {
  it("objectif non SMART : manquants remontés", () => {
    const r = smartCheck(goal(), [], null, NOW);
    expect(r.score).toBeLessThan(100);
    expect(r.manquants.length).toBeGreaterThan(0);
  });
});

describe("US30 — tri par urgence", () => {
  it("tâche planifiée aujourd'hui avant tâche sans date", () => {
    const today = isoDuJour(NOW);
    const urgente = tache({ id: "u", date: today, prio: "haute" });
    const autre = tache({ id: "a2", prio: "basse" });
    const tri = triParUrgence([autre, urgente], [goal()], [autre, urgente], null, NOW);
    expect(tri[0].id).toBe("u");
  });
});

describe("US7 — vélocité", () => {
  it("computeVelocity sans saisies -> aucune", () => {
    expect(computeVelocity([]).velocite).toBeNull();
  });
});

describe("US1 — synchronisation agenda (simulée)", () => {
  it("refus sans compte connecté", () => {
    const r = synchroniserAgenda(initialData(NOW), NOW);
    expect(r.resume.erreur).toBeTruthy();
  });
  it("crée un événement par tâche planifiée active avec compte", () => {
    const data = initialData(NOW);
    data.account = { id: "m@b.fr", email: "m@b.fr", nom: "m" };
    data.tasks = [tache({ date: "2026-11-05" })];
    const r = synchroniserAgenda(data, NOW);
    expect(r.resume.erreur).toBeNull();
    expect(r.resume.crees).toBe(1);
  });
});

describe("dates — utilitaires ISO locaux", () => {
  it("parseISO valide / invalide", () => {
    expect(parseISO("2026-11-03")).not.toBeNull();
    expect(parseISO("03/11/2026")).toBeNull();
    expect(parseISO("")).toBeNull();
  });
});
