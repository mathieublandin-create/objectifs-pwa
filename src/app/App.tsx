import { useEffect, useState } from "react";
import { Accueil } from "../screens/Accueil";
import { chargerDonnees, sauvegarderDonnees } from "../storage/donnees";
import { adaptateurIndexedDB } from "../storage/indexeddb";
import { cleStockage } from "../storage/port";
import { APP_VERSION_M1 } from "../domaineConstantes";
import { horlogeSysteme } from "../clock/horloge";
import type { AppData } from "../domain/types";

export function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const port = adaptateurIndexedDB();
    const now = horlogeSysteme.maintenant();
    chargerDonnees(port, cleStockage(null), now).then((r) => {
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
  return (
    <>
      {erreur && <p role="alert" style={{ background: "#fef3c7", color: "#92400e", padding: "0.5rem 1rem" }}>⚠️ {erreur}</p>}
      <Accueil data={data} now={horlogeSysteme.maintenant()} majData={majData} versionApp={APP_VERSION_M1} />
    </>
  );
}
