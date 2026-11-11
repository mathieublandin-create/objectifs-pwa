import { useEffect, useMemo, useRef, useState } from "react";
import { Accueil } from "../screens/Accueil";
import { Objectifs } from "../screens/Objectifs";
import { Taches } from "../screens/Taches";
import { Calendrier } from "../screens/Calendrier";
import { Stats } from "../screens/Stats";
import { Rituel } from "../screens/Rituel";
import { Google } from "../screens/Google";
import { FicheTache } from "../screens/FicheTache";
import { JournalEcran } from "../screens/Journal";
import { ajouterEvenement, evenementsDeDiff, journalCle, type Journal } from "../journal/journal";
import { chargerDonnees, sauvegarderDonnees } from "../storage/donnees";
import { adaptateurIndexedDB } from "../storage/indexeddb";
import { cleMaj, cleStockage, type PortStockage } from "../storage/port";
import { googleConfigure, JETON_CLE } from "../google/config";
import { adaptateurAuth } from "../google/auth";
import { adaptateurDrive } from "../google/drive";
import { adaptateurCalendar } from "../google/calendar";
import { adaptateurSync } from "../google/sync";
import { APP_VERSION_M1 } from "../domaineConstantes";
import { genIdSeq, horlogeSysteme } from "../clock/horloge";
import type { AppData } from "../domain/types";

type Onglet = "accueil" | "objectifs" | "taches" | "calendrier" | "rituel" | "stats" | "journal" | "google";

const ONGLETS: { id: Onglet; label: string }[] = [
  { id: "accueil", label: "Accueil" },
  { id: "objectifs", label: "Objectifs" },
  { id: "taches", label: "Tâches" },
  { id: "calendrier", label: "Calendrier" },
  { id: "rituel", label: "Rituel" },
  { id: "stats", label: "Stats" },
  { id: "journal", label: "Journal" },
  { id: "google", label: "Google" },
];

export function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("accueil");
  const [ficheId, setFicheId] = useState<string | null>(null);
  const [journal, setJournal] = useState<Journal>({ lots: [] });
  const prevRef = useRef<AppData | null>(null);

  // M2 — adaptateurs Google réels quand le client OAuth est configuré (ADR-12) ;
  // jetons conservés derrière le port de stockage, jamais dans le code.
  const google = useMemo(() => {
    if (!googleConfigure()) return null;
    const stockageJeton: PortStockage = {
      lire: (c) => { try { return localStorage.getItem(c); } catch { return null; } },
      ecrire: (c, v) => { try { v ? localStorage.setItem(c, v) : localStorage.removeItem(c); } catch { /* stockage indisponible */ } },
    };
    const auth = adaptateurAuth({
      lireJeton: () => stockageJeton.lire(JETON_CLE),
      ecrireJeton: (j) => stockageJeton.ecrire(JETON_CLE, j ?? ""),
    });
    const drive = adaptateurDrive({ jeton: auth.jetonActuel });
    return {
      auth,
      drive,
      calendar: adaptateurCalendar({ jeton: auth.jetonActuel }),
      sync: adaptateurSync({
        drive,
        lireMaj: () => { try { return localStorage.getItem(cleMaj(null)); } catch { return null; } },
        versionApp: APP_VERSION_M1,
        now: horlogeSysteme.maintenant,
      }),
    };
  }, []);

  useEffect(() => {
    const port = adaptateurIndexedDB();
    chargerDonnees(port, cleStockage(null), horlogeSysteme.maintenant()).then(async (r) => {
      if (r.error) setErreur(r.error);
      setData(r.data);
      prevRef.current = r.data;
      const rawJ = await port.lire(journalCle(null));
      if (rawJ) { try { setJournal(JSON.parse(rawJ)); } catch { /* journal illisible : on repart à zéro */ } }
    });
  }, []);

  // Point de passage unique (ADR-06) : toute mutation passe par majData et persiste via le port.
  const majData = (d: AppData) => {
    setData(d);
    const port = adaptateurIndexedDB();
    sauvegarderDonnees(port, cleStockage(d.account?.id ?? null), d).catch(() => {});
    // V2-S2′ — timestamp de dernière écriture locale (base du dernier écrivain gagne)
    try { localStorage.setItem(cleMaj(d.account?.id ?? null), horlogeSysteme.maintenant().toISOString()); } catch { /* stockage indisponible */ }
    // US22 — trace par diff vers le journal (point de passage unique majData, ADR-06)
    if (prevRef.current) {
      const now = horlogeSysteme.maintenant();
      const evts = evenementsDeDiff(prevRef.current, d, now);
      if (evts.length > 0) {
        setJournal((j) => {
          let nj = j;
          for (const e of evts) nj = ajouterEvenement(nj, e, now);
          port.ecrire(journalCle(d.account?.id ?? null), JSON.stringify(nj)).catch(() => {});
          return nj;
        });
      }
    }
    prevRef.current = d;
  };

  if (!data) return <main className="contenu"><p>Chargement…</p></main>;
  const now = horlogeSysteme.maintenant();
  const genId = genIdSeq();
  const fiche = data.tasks.find((t) => t.id === ficheId);
  return (
    <>
      <header className="app-header">
        <h1>🎯 Objectifs</h1>
        <p className="version">v{APP_VERSION_M1} · schéma v9</p>
      </header>
      {erreur && <p role="alert" className="alerte avertissement">⚠️ {erreur}</p>}
      <nav aria-label="Navigation" className="onglets">
        {ONGLETS.map(({ id, label }) => (
          <button key={id} aria-current={onglet === id ? "page" : undefined} onClick={() => setOnglet(id)}>
            {label}
          </button>
        ))}
      </nav>
      <main className="contenu">
        {onglet === "accueil" && <Accueil data={data} now={now} majData={majData} versionApp={APP_VERSION_M1} />}
        {onglet === "objectifs" && <Objectifs data={data} now={now} genId={genId} majData={majData} />}
        {onglet === "taches" && <Taches data={data} now={now} genId={genId} majData={majData} onOuvrirFiche={setFicheId} />}
        {onglet === "calendrier" && <Calendrier data={data} now={now} majData={majData} onOuvrirFiche={setFicheId} />}
        {onglet === "rituel" && <Rituel data={data} now={now} onOuvrirFiche={setFicheId} />}
        {onglet === "stats" && <Stats data={data} now={now} />}
        {onglet === "journal" && <JournalEcran journal={journal} />}
        {onglet === "google" && <Google data={data} now={now} majData={majData} versionApp={APP_VERSION_M1} google={google} />}
      </main>
      {fiche && <FicheTache data={data} task={fiche} now={now} genId={genId} majData={majData} onClose={() => setFicheId(null)} />}
    </>
  );
}
