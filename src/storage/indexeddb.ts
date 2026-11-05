import type { PortStockageAsync } from "./port";

// Adaptateur IndexedDB derrière le port (ADR-03) — code natif, zéro dépendance.
const DB_NAME = "objectifs-pwa";
const STORE = "kv";

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function adaptateurIndexedDB(): PortStockageAsync {
  let db: Promise<IDBDatabase> | null = null;
  const ouvrirSiBesoin = () => (db ??= ouvrir());
  return {
    async lire(cle) {
      const d = await ouvrirSiBesoin();
      return new Promise((resolve, reject) => {
        const tx = d.transaction(STORE, "readonly").objectStore(STORE).get(cle);
        tx.onsuccess = () => resolve((tx.result as string | undefined) ?? null);
        tx.onerror = () => reject(tx.error);
      });
    },
    async ecrire(cle, valeur) {
      const d = await ouvrirSiBesoin();
      return new Promise((resolve, reject) => {
        const tx = d.transaction(STORE, "readwrite").objectStore(STORE).put(valeur, cle);
        tx.onsuccess = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };
}
