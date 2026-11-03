// Adaptateur de persistance localStorage — entièrement gardé (leçon incident v0.11.1/0.11.2 :
// tout accès au stockage peut lever une SecurityError ; aucun accès non gardé, jamais de plantage).
// Injecté avec un mock aux tests (TM5) — aucune dépendance DOM directe au niveau domaine.

export function creePersistance(storage, cle) {
  const statutStockage = () => {
    try {
      storage.setItem(cle + ".sonde", "1");
      storage.removeItem(cle + ".sonde");
      return "persistant";
    } catch { return "indisponible"; }
  };
  return {
    statut: statutStockage,
    lire() {
      try {
        const brut = storage.getItem(cle);
        return brut ? JSON.parse(brut) : null;
      } catch { return null; } // lecture gardée : jamais de plantage
    },
    ecrire(data) {
      try { storage.setItem(cle, JSON.stringify(data)); return true; }
      catch { return false; }
    },
  };
}
