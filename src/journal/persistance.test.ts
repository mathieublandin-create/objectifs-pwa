import { describe, expect, it } from "vitest";
import { chargerJournal, sauvegarderJournal } from "./persistance";
import { ajouterEvenement, horodatage, type Journal } from "./journal";
import type { PortStockageAsync } from "../storage/port";

const NOW = new Date(2026, 10, 3, 9, 0, 0);
const portMemoire = (): PortStockageAsync & { brut: Map<string, string> } => {
  const brut = new Map<string, string>();
  return { brut, async lire(c) { return brut.get(c) ?? null; }, async ecrire(c, v) { brut.set(c, v); } };
};

describe("journal — persistance via le port", () => {
  it("round-trip : sauvegarde puis rechargement identique", async () => {
    const port = portMemoire();
    let j: Journal = { lots: [] };
    j = ajouterEvenement(j, { at: horodatage(NOW), type: "tache", message: "tâche créée « X »" }, NOW);
    await sauvegarderJournal(port, null, j);
    const relu = await chargerJournal(port, null);
    expect(relu).toEqual(j);
  });
  it("journal illisible : repli sur journal vide", async () => {
    const port = portMemoire();
    await port.ecrire("objectifs-app-journal", "{invalide");
    expect(await chargerJournal(port, null)).toEqual({ lots: [] });
  });
});
