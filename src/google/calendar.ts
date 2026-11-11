import type { Task } from "../domain/types";

// Adaptateur Calendar réel (M2) : synchro des tâches planifiées en événements
// (id dérivé de la tâche), canal d'affichage — jamais un stockage du domaine (ADR-11).
// rappelsRituels (événements récurrents 7h/21h) est posé au M3.
// fetch et jeton injectés (ADR-08) pour les tests.

const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export interface DepsCalendar {
  fetch?: typeof fetch;
  jeton: () => string | null;
}

export interface EvenementLu {
  id: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
}

export const prefixeEventTache = "objectif-tache-";

export function idEventTache(taskId: string): string {
  return prefixeEventTache + taskId;
}

export function adaptateurCalendar(deps: DepsCalendar) {
  const fetchFn = deps.fetch ?? fetch;

  async function req(url: string, init: RequestInit = {}): Promise<any> {
    const j = deps.jeton();
    if (!j) throw new Error("non connecté à Google");
    const r = await fetchFn(url, { ...init, headers: { Authorization: `Bearer ${j}`, "Content-Type": "application/json", ...(init.headers as object ?? {}) } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`Calendar : HTTP ${r.status}`);
    return r.json();
  }

  return {
    async lister(): Promise<EvenementLu[]> {
      const j = await req(`${API}?q=${encodeURIComponent("")}&singleEvents=true&orderBy=startTime&maxResults=250`);
      return j.items ?? [];
    },
    async pousserTache(t: Task): Promise<void> {
      if (!t.date) return;
      const ev = {
        summary: t.title,
        start: { date: t.date },
        end: { date: t.date },
        extendedProperties: { private: { objectifTaskId: t.id } },
      };
      await req(`${API}/${encodeURIComponent(idEventTache(t.id))}`, { method: "PUT", body: JSON.stringify(ev) });
    },
    async retirerTache(taskId: string): Promise<void> {
      await req(`${API}/${encodeURIComponent(idEventTache(taskId))}`, { method: "DELETE" });
    },
  };
}
