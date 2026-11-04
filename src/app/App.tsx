import { useEffect, useState } from "react";
import { Accueil } from "../screens/Accueil";
import { Objectifs } from "../screens/Objectifs";
import { Taches } from "../screens/Taches";
import { Calendrier } from "../screens/Calendrier";
import { Stats } from "../screens/Stats";
import { Rituel } from "../screens/Rituel";
import { FicheTache } from "../screens/FicheTache";
import { chargerDonnees, sauvegarderDonnees } from "../storage/donnees";
import { adaptateurIndexedDB } from "../storage/indexeddb";
import { cleStockage } from "../storage/port";
import { APP_VERSION_M1 } from "../domaineConstantes";
import { genIdSeq, horlogeSysteme } from "../clock/horloge";
import type { AppData } from "../domain/types";

type Onglet = "accueil" | "objectifs" | "taches" | "calendrier" | "rituel" | "stats";

export function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("accueil");
  const [ficheId, setFicheId] = useState<string | null>(null);

  useEffect(() => {
    const port = adaptateurIndexedDB();
    chargerDonnees(port, cleStockage(null), horlogeSysteme.maintenant()).then((r) => {
      if (r.error) setErreur(r.error);
      setData(r.data);
    });
  }, []);

  // Point de passage unique (ADR-06) : toute mutation passe par majData et persiste via le port.
  const majData = (d: AppData) => {
    setData(d);
    const port = adaptateurIndexedDB();
    sauvegarderDonnees(port, cleStockage(d.account?.id ?? null), d).catch(() => {});
  };

  if (!data) return <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>Chargement…</main>;
  const now = horlogeSysteme.maintenant();
  const genId = genIdSeq();
  const fiche = data.tasks.find((t) => t.id === ficheId);
  return (
    <>
      {erreur && <p role="alert" style={{ background: "#fef3c7", color: "#92400e", padding: "0.5rem 1rem" }}>⚠️ {erreur}</p>}
      <nav aria-label="Navigation" style={{ display: "flex", gap: 8, padding: "0.5rem 1rem", flexWrap: "wrap" }}>
        {(["accueil", "objectifs", "taches", "calendrier", "rituel", "stats"] as Onglet[]).map((o) => (
          <button key={o} aria-current={onglet === o ? "page" : undefined} style={{ minHeight: 44 }}
            onClick={() => setOnglet(o)}>
            {o === "accueil" ? "Accueil" : o === "objectifs" ? "Objectifs" : o === "taches" ? "Tâches" : o === "calendrier" ? "Calendrier" : o === "rituel" ? "Rituel" : "Stats"}
          </button>
        ))}
      </nav>
      {onglet === "accueil" && <Accueil data={data} now={now} majData={majData} versionApp={APP_VERSION_M1} />}
      {onglet === "objectifs" && <Objectifs data={data} now={now} genId={genId} majData={majData} />}
      {onglet === "taches" && <Taches data={data} now={now} genId={genId} majData={majData} onOuvrirFiche={setFicheId} />}
      {onglet === "calendrier" && <Calendrier data={data} now={now} majData={majData} onOuvrirFiche={setFicheId} />}
      {onglet === "rituel" && <Rituel data={data} now={now} onOuvrirFiche={setFicheId} />}
      {onglet === "stats" && <Stats data={data} now={now} />}
      {fiche && <FicheTache data={data} task={fiche} now={now} genId={genId} majData={majData} onClose={() => setFicheId(null)} />}
    </>
  );
}
