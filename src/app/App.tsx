import { useEffect, useRef, useState } from "react";
import { Accueil } from "../screens/Accueil";
import { Objectifs } from "../screens/Objectifs";
import { Taches } from "../screens/Taches";
import { Calendrier } from "../screens/Calendrier";
import { Stats } from "../screens/Stats";
import { Rituel } from "../screens/Rituel";
import { FicheTache } from "../screens/FicheTache";
import { JournalEcran } from "../screens/Journal";
import { ajouterEvenement, evenementsDeDiff, journalCle, type Journal } from "../journal/journal";
import { chargerDonnees, sauvegarderDonnees } from "../storage/donnees";
import { adaptateurIndexedDB } from "../storage/indexeddb";
import { cleStockage } from "../storage/port";
import { APP_VERSION_M1 } from "../domaineConstantes";
import { genIdSeq, horlogeSysteme } from "../clock/horloge";
import type { AppData } from "../domain/types";

type Onglet = "accueil" | "objectifs" | "taches" | "calendrier" | "rituel" | "stats" | "journal";

export function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("accueil");
  const [ficheId, setFicheId] = useState<string | null>(null);
  const [journal, setJournal] = useState<Journal>({ lots: [] });
  const prevRef = useRef<AppData | null>(null);

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

  if (!data) return <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>Chargement…</main>;
  const now = horlogeSysteme.maintenant();
  const genId = genIdSeq();
  const fiche = data.tasks.find((t) => t.id === ficheId);
  return (
    <>
      {erreur && <p role="alert" style={{ background: "#fef3c7", color: "#92400e", padding: "0.5rem 1rem" }}>⚠️ {erreur}</p>}
      <nav aria-label="Navigation" style={{ display: "flex", gap: 8, padding: "0.5rem 1rem", flexWrap: "wrap" }}>
        {(["accueil", "objectifs", "taches", "calendrier", "rituel", "stats", "journal"] as Onglet[]).map((o) => (
          <button key={o} aria-current={onglet === o ? "page" : undefined} style={{ minHeight: 44 }}
            onClick={() => setOnglet(o)}>
            {o === "accueil" ? "Accueil" : o === "objectifs" ? "Objectifs" : o === "taches" ? "Tâches" : o === "calendrier" ? "Calendrier" : o === "rituel" ? "Rituel" : o === "stats" ? "Stats" : "Journal"}
          </button>
        ))}
      </nav>
      {onglet === "accueil" && <Accueil data={data} now={now} majData={majData} versionApp={APP_VERSION_M1} />}
      {onglet === "objectifs" && <Objectifs data={data} now={now} genId={genId} majData={majData} />}
      {onglet === "taches" && <Taches data={data} now={now} genId={genId} majData={majData} onOuvrirFiche={setFicheId} />}
      {onglet === "calendrier" && <Calendrier data={data} now={now} majData={majData} onOuvrirFiche={setFicheId} />}
      {onglet === "rituel" && <Rituel data={data} now={now} onOuvrirFiche={setFicheId} />}
      {onglet === "stats" && <Stats data={data} now={now} />}
      {onglet === "journal" && <JournalEcran journal={journal} />}
      {fiche && <FicheTache data={data} task={fiche} now={now} genId={genId} majData={majData} onClose={() => setFicheId(null)} />}
    </>
  );
}
