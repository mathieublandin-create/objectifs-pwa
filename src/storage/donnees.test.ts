import { describe, expect, it } from "vitest";
import { chargerDonnees, sauvegarderDonnees } from "./donnees";
import type { PortStockageAsync } from "./port";
import { initialData, SCHEMA_VERSION } from "../domain/domaine";

const NOW = new Date(2026, 10, 3, 10, 0, 0);

function portMemoire(): PortStockageAsync & { brut: Map<string, string> } {
  const brut = new Map<string, string>();
  return {
    brut,
    async lire(cle) { return brut.get(cle) ?? null; },
    async ecrire(cle, valeur) { brut.set(cle, valeur); },
  };
}

describe("persistance via le port (ADR-03)", () => {
  it("premier démarrage : données initiales v9", async () => {
    const port = portMemoire();
    const r = await chargerDonnees(port, "objectifs-app-data", NOW);
    expect(r.error).toBeNull();
    expect(r.data.version).toBe(SCHEMA_VERSION);
  });

  it("round-trip : sauvegarde puis rechargement identique", async () => {
    const port = portMemoire();
    const data = {
      ...initialData(NOW),
      goals: [{ id: "g1", title: "Peindre", p: 2 as const, color: "#1e40af", echeance: "2026-12-31" }],
      tasks: [{ id: "t1", title: "X", goalId: "g1", prio: "haute" as const, etat: "a_planifier" as const, estimeInitial: 2, passe: 0, restant: 2, historiqueEtat: [{ etat: "a_planifier" as const, date: "2026-11-03" }] }],
      entries: [],
    };
    await sauvegarderDonnees(port, "objectifs-app-data", data);
    const r = await chargerDonnees(port, "objectifs-app-data", NOW);
    expect(r.error).toBeNull();
    expect(r.data.tasks).toHaveLength(1);
    expect(r.data.tasks[0].title).toBe("X");
  });

  it("données v8 : migrées vers v9 et persistées", async () => {
    const port = portMemoire();
    const v8 = { ...initialData(NOW), version: 8 };
    await port.ecrire("objectifs-app-data", JSON.stringify(v8));
    const r = await chargerDonnees(port, "objectifs-app-data", NOW);
    expect(r.error).toBeNull();
    expect(r.data.version).toBe(9);
    expect(r.applied.length).toBeGreaterThan(0);
    const relu = JSON.parse(port.brut.get("objectifs-app-data")!);
    expect(relu.version).toBe(9);
  });

  it("données corrompues : repli sur données initiales avec erreur signalée", async () => {
    const port = portMemoire();
    await port.ecrire("objectifs-app-data", JSON.stringify({ version: 9, goals: "pas-une-liste" }));
    const r = await chargerDonnees(port, "objectifs-app-data", NOW);
    expect(r.error).toContain("invalides");
    expect(r.data.version).toBe(SCHEMA_VERSION);
    expect(Array.isArray(r.data.goals)).toBe(true);
  });
});
