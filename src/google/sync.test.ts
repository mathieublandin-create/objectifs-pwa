import { describe, expect, it } from "vitest";
import { adaptateurSync, deciderSynchro } from "./sync";
import { exporterDonnees } from "../domain/exportImport";
import { initialData } from "../domain/domaine";

const NOW = new Date(2026, 10, 11, 10, 0, 0);

describe("deciderSynchro (dernier écrivain gagne)", () => {
  it("pas de distant -> pousser", () => expect(deciderSynchro("2026-11-11T10:00:00Z", null)).toBe("pousser"));
  it("pas de local -> tirer", () => expect(deciderSynchro(null, "2026-11-11T10:00:00Z")).toBe("tirer"));
  it("distant plus récent -> tirer", () => expect(deciderSynchro("2026-11-10T10:00:00Z", "2026-11-11T10:00:00Z")).toBe("tirer"));
  it("local plus récent -> pousser", () => expect(deciderSynchro("2026-11-12T10:00:00Z", "2026-11-11T10:00:00Z")).toBe("pousser"));
  it("égalité -> rien", () => expect(deciderSynchro("2026-11-11T10:00:00Z", "2026-11-11T10:00:00Z")).toBe("rien"));
});

function fauxDrive(initial: Record<string, { valeur: string; modifiedTime: string }>) {
  const store = initial;
  return {
    async lireDistantAvecMeta(cle: string) {
      return store[cle] ? { valeur: store[cle].valeur, meta: { id: "f", name: cle, modifiedTime: store[cle].modifiedTime } } : null;
    },
    async ecrireDistant(cle: string, valeur: string) {
      store[cle] = { valeur, modifiedTime: "2026-11-11T12:00:00Z" };
    },
  } as any;
}

describe("adaptateurSync", () => {
  const data = initialData(NOW);

  it("pousse l'export US23 quand le distant est absent", async () => {
    const drive = fauxDrive({});
    const sync = adaptateurSync({ drive, lireMaj: () => "2026-11-11T10:00:00Z", versionApp: "0.14.0-m1", now: () => NOW });
    const r = await sync.synchroniser(data);
    expect(r.action).toBe("pousser");
    const stocke = drive && (await (drive as any).lireDistantAvecMeta("objectifs-app-data"));
    expect(JSON.parse(stocke.valeur).format).toBe("objectifs-donnees-v1");
  });

  it("tire et importe quand le distant est plus récent", async () => {
    const distant = exporterDonnees({ ...data, goals: data.goals.map((g, i) => (i === 0 ? { ...g, title: "Depuis Drive" } : g)) }, { versionApp: "0.14.0-m1", dateIso: NOW.toISOString() } as any);
    const drive = fauxDrive({ "objectifs-app-data": { valeur: distant, modifiedTime: "2026-11-12T09:00:00Z" } });
    const sync = adaptateurSync({ drive, lireMaj: () => "2026-11-11T10:00:00Z", versionApp: "0.14.0-m1", now: () => NOW });
    const r = await sync.synchroniser(data);
    expect(r.action).toBe("tirer");
    expect(r.data?.goals[0].title).toBe("Depuis Drive");
  });

  it("refuse un contenu distant illisible sans toucher au local", async () => {
    const drive = fauxDrive({ "objectifs-app-data": { valeur: "pas du json", modifiedTime: "2026-11-12T09:00:00Z" } });
    const sync = adaptateurSync({ drive, lireMaj: () => "2026-11-11T10:00:00Z", versionApp: "0.14.0-m1", now: () => NOW });
    const r = await sync.synchroniser(data);
    expect(r.action).toBe("tirer");
    expect(r.erreur).toBeTruthy();
    expect(r.data).toBeUndefined();
  });

  it("rien à faire si local == distant", async () => {
    const drive = fauxDrive({ "objectifs-app-data": { valeur: "{}", modifiedTime: "2026-11-11T10:00:00Z" } });
    const sync = adaptateurSync({ drive, lireMaj: () => "2026-11-11T10:00:00Z", versionApp: "0.14.0-m1", now: () => NOW });
    expect((await sync.synchroniser(data)).action).toBe("rien");
  });
});
