import { etatLabel, fmtIso, isoLocal } from "../domain/domaine";
import type { AppData } from "../domain/types";

// US22 — journal d'activité (MCO) : événements du catalogue, horodatage ISO local à la seconde.

export interface JournalEvent { at: string; type: string; message: string; contexte?: Record<string, string | number | boolean | null>; erreur?: boolean; }
export interface JournalLot { date: string; evenements: JournalEvent[]; }
export interface Journal { lots: JournalLot[]; }

export const JOURNAL_KEY = "objectifs-app-journal";
export const JOURNAL_MAX_LOTS = 30; // rotation : les 30 derniers lots quotidiens sont conservés

export function journalCle(accountId: string | null): string { return accountId ? JOURNAL_KEY + "::" + accountId : JOURNAL_KEY; }

export function horodatage(d: Date): string {
  return isoLocal(d) + "T" + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0");
}

export function ajouterEvenement(journal: Journal, evt: JournalEvent, now: Date): Journal {
  const jour = isoLocal(now);
  const lots = [...journal.lots];
  const i = lots.findIndex((l) => l.date === jour);
  if (i >= 0) lots[i] = { ...lots[i], evenements: [...lots[i].evenements, evt] };
  else lots.push({ date: jour, evenements: [evt] });
  return { lots: lots.sort((a, b) => b.date.localeCompare(a.date)).slice(0, JOURNAL_MAX_LOTS) };
}

// Détection des changements applicatifs → événements du catalogue US22 (pure, testable).
// Confidentialité : identifiants, titres, états, dénombrements uniquement — jamais de secret.
export function evenementsDeDiff(prev: AppData, next: AppData, now: Date): JournalEvent[] {
  const evts: JournalEvent[] = [];
  const at = horodatage(now);
  const mk = (type: string, message: string, contexte?: JournalEvent["contexte"]): JournalEvent => ({ at, type, message, contexte });
  if ((prev.account?.id ?? null) !== (next.account?.id ?? null)) {
    if (next.account) evts.push(mk("compte", "connexion du compte " + next.account.nom, { compte: next.account.id }));
    else evts.push(mk("compte", "déconnexion — retour aux données locales"));
  }
  const gPrev = new Map(prev.goals.map((g) => [g.id, g]));
  for (const g of next.goals) {
    const p = gPrev.get(g.id);
    if (!p) evts.push(mk("objectif", "objectif créé « " + g.title + " »", { id: g.id }));
    else if (g.archive && !p.archive) evts.push(mk("objectif", "objectif archivé « " + g.title + " »", { id: g.id }));
    else if (g.title !== p.title || g.p !== p.p || g.echeance !== p.echeance || g.specifique !== p.specifique ||
             g.mesurable !== p.mesurable || g.realiste !== p.realiste || g.motivation !== p.motivation)
      evts.push(mk("objectif", "objectif modifié « " + g.title + " »", { id: g.id }));
  }
  for (const g of prev.goals) if (!next.goals.some((x) => x.id === g.id)) evts.push(mk("objectif", "objectif supprimé « " + g.title + " »", { id: g.id }));
  const tPrev = new Map(prev.tasks.map((t) => [t.id, t]));
  for (const t of next.tasks) {
    const p = tPrev.get(t.id);
    if (!p) { evts.push(mk("tache", "tâche créée « " + t.title + " »", { id: t.id, etat: t.etat, estime: t.estimeInitial, planifiee: t.date ?? null })); continue; }
    if (t.supprimee && !p.supprimee) { evts.push(mk("tache", "tâche supprimée (logique) « " + t.title + " » — historique des saisies conservé", { id: t.id })); continue; }
    if (t.etat !== p.etat) evts.push(mk("etat", "état de « " + t.title + " » : " + etatLabel[p.etat] + " → " + etatLabel[t.etat], { id: t.id }));
    if (t.passe !== p.passe || t.restant !== p.restant)
      evts.push(mk("saisie", "saisie de temps sur « " + t.title + " » : +" + (Math.round((t.passe - p.passe) * 10) / 10) + " h, restant " + t.restant + " h", { id: t.id }));
    if ((t.date ?? null) !== (p.date ?? null))
      evts.push(mk("planification", t.date ? "tâche planifiée « " + t.title + " » → " + fmtIso(t.date) : "tâche déplanifiée « " + t.title + " »", { id: t.id }));
    if (t.prio !== p.prio) evts.push(mk("tache", "priorité de « " + t.title + " » : " + p.prio + " → " + t.prio, { id: t.id }));
    if (t.goalId !== p.goalId) evts.push(mk("tache", "tâche déplacée « " + t.title + " » → objectif « " + (next.goals.find((g) => g.id === t.goalId)?.title ?? t.goalId) + " »", { id: t.id })); // US27 — changement d'objectif lié depuis la fiche
    if (t.estimeInitial !== p.estimeInitial) evts.push(mk("tache", "charge estimée de « " + t.title + " » : " + p.estimeInitial + " h → " + t.estimeInitial + " h", { id: t.id })); // US27 — édition depuis la fiche
    if (t.title !== p.title) evts.push(mk("tache", "tâche renommée : « " + p.title + " » → « " + t.title + " »", { id: t.id }));
    if (JSON.stringify(p.deps ?? []) !== JSON.stringify(t.deps ?? []))
      evts.push(mk("tache", "dépendances de « " + t.title + " » : " + (t.deps ?? []).length + " prérequis", { id: t.id }));
  }
  for (const t of prev.tasks) if (!next.tasks.some((x) => x.id === t.id)) evts.push(mk("tache", "tâche « " + t.title + " » retirée des données", { id: t.id }));
  if (prev.preferences.capaciteJourOuvre !== next.preferences.capaciteJourOuvre || prev.preferences.capaciteWeekEnd !== next.preferences.capaciteWeekEnd)
    evts.push(mk("preferences", "capacités modifiées : " + next.preferences.capaciteJourOuvre + " h/jour ouvré, " + next.preferences.capaciteWeekEnd + " h/week-end"));
  if (next.agenda.lastSync !== prev.agenda.lastSync)
    evts.push(mk("sync_agenda", "synchronisation agenda : " + Math.max(next.agenda.log.length - prev.agenda.log.length, 0) + " opération(s) journalisée(s)")); // le journal US1 n'est pas dupliqué : seules les entrées du journal de synchronisation existant font foi
  return evts;
}
