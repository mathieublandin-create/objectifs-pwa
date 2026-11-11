import { describe, expect, it } from "vitest";
import { adaptateurAuth } from "./auth";
import { adaptateurDrive } from "./drive";
import { adaptateurCalendar, idEventTache } from "./calendar";

const jeton = () => "JETON";

function reponse(json: any, ok = true, status = 200) {
  return { ok, status, json: async () => json, text: async () => (typeof json === "string" ? json : JSON.stringify(json)) } as Response;
}

describe("adaptateurAuth (OAuth réel, deps injectées)", () => {
  it("connecte : jeton demandé, stocké, compte dérivé de l'email userinfo", async () => {
    let stocke: string | null = null;
    const auth = adaptateurAuth({
      chargerGsi: async () => {},
      demanderJeton: (cb) => cb({ access_token: "JETON" }),
      fetch: async () => reponse({ email: "mathieu@exemple.fr" }),
      lireJeton: () => stocke,
      ecrireJeton: (j) => { stocke = j; },
    });
    const compte = await auth.connecter();
    expect(compte?.email).toBe("mathieu@exemple.fr");
    expect(stocke).toBe("JETON");
    expect(auth.jetonActuel()).toBe("JETON");
  });

  it("échec de consentement -> compte null, rien n'est stocké", async () => {
    let stocke: string | null = "ancien";
    const auth = adaptateurAuth({
      chargerGsi: async () => {},
      demanderJeton: (cb) => cb({ error: "access_denied" }),
      ecrireJeton: (j) => { stocke = j; },
    });
    expect(await auth.connecter()).toBeNull();
    expect(stocke).toBe("ancien");
  });

  it("déconnecte : jeton local effacé + révocation appelée", async () => {
    let revoque = false;
    let stocke: string | null = "JETON";
    const auth = adaptateurAuth({
      fetch: async (url) => { if (String(url).includes("revoke")) revoque = true; return reponse({}); },
      lireJeton: () => stocke,
      ecrireJeton: (j) => { stocke = j; },
    });
    await auth.deconnecter();
    expect(stocke).toBeNull();
    expect(revoque).toBe(true);
  });
});

describe("adaptateurDrive (appDataFolder, fetch injecté)", () => {
  it("lireDistant : null si absent, contenu sinon", async () => {
    const appels: string[] = [];
    const drive = adaptateurDrive({
      jeton,
      fetch: async (url) => {
        appels.push(String(url));
        if (String(url).includes("alt=media")) return reponse("{\"version\":9}");
        return reponse({ files: [{ id: "f1", name: "objectifs-app-data", modifiedTime: "2026-11-05T10:00:00Z" }] });
      },
    });
    expect(await drive.lireDistant("objectifs-app-data")).toBe('{"version":9}');
    const meta = await drive.lireDistantAvecMeta("objectifs-app-data");
    expect(meta?.meta.modifiedTime).toBe("2026-11-05T10:00:00Z");
    const driveVide = adaptateurDrive({ jeton, fetch: async () => reponse({ files: [] }) });
    expect(await driveVide.lireDistant("x")).toBeNull();
  });

  it("ecrireDistant : PATCH si le fichier existe, création multipart sinon", async () => {
    const methods: string[] = [];
    const drive = adaptateurDrive({
      jeton,
      fetch: async (url, init) => {
        methods.push(`${init?.method ?? "GET"} ${String(url).slice(0, 60)}`);
        if (String(url).includes("uploadType")) return reponse({ id: "f1" });
        return reponse({ files: [{ id: "f1", name: "k", modifiedTime: "t" }] });
      },
    });
    await drive.ecrireDistant("k", "{}");
    expect(methods.some((m) => m.startsWith("PATCH"))).toBe(true);
    const driveNeuf = adaptateurDrive({
      jeton,
      fetch: async (url, init) => {
        methods.push(`${init?.method ?? "GET"} ${String(url).slice(0, 60)}`);
        if (String(url).includes("uploadType")) return reponse({ id: "f2" });
        return reponse({ files: [] });
      },
    });
    await driveNeuf.ecrireDistant("k", "{}");
    expect(methods.some((m) => m.startsWith("POST"))).toBe(true);
  });

  it("sans jeton -> erreur explicite", async () => {
    const drive = adaptateurDrive({ jeton: () => null, fetch: async () => reponse({}) });
    await expect(drive.lireDistant("k")).rejects.toThrow("non connecté");
  });
});

describe("adaptateurCalendar (événements, fetch injecté)", () => {
  it("pousserTache : PUT sur l'id dérivé, start/end = date planifiée", async () => {
    let body = "";
    const cal = adaptateurCalendar({
      jeton,
      fetch: async (_url, init) => { body = String(init?.body); return reponse({ id: "e" }); },
    });
    await cal.pousserTache({ id: "t1", title: "Courses", date: "2026-11-06" } as any);
    expect(idEventTache("t1")).toBe("objectif-tache-t1");
    const ev = JSON.parse(body);
    expect(ev.summary).toBe("Courses");
    expect(ev.start.date).toBe("2026-11-06");
  });

  it("retirerTache : DELETE ; tâche sans date ignorée", async () => {
    const appels: string[] = [];
    const cal = adaptateurCalendar({
      jeton,
      fetch: async (url, init) => { appels.push(`${init?.method} ${url}`); return reponse(null, true, 204) as any; },
    });
    await cal.retirerTache("t1");
    expect(appels[0]).toContain("DELETE");
    await cal.pousserTache({ id: "t2", title: "x" } as any);
    expect(appels.length).toBe(1);
  });
});
