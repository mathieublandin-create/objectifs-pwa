
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, Legend } from "recharts";

// ==================== Socle : schéma versionné (US15/US16) ====================

const APP_VERSION = "0.12.0"; // itération 10 (US31 élargie P1-P7 + US33) — durées lisibles, cibles 44 px, focus visible, aria-current, role=alert, libellés de création, états vides guidés, carte Bienvenue, onglets non tronqués. Sans migration, schéma v9 inchangé
const SCHEMA_VERSION = 9;
const STORAGE_KEY = "objectifs-app-data";

type Prio = "haute" | "moyenne" | "basse";
type Etat = "a_planifier" | "planifiee" | "en_cours" | "terminee";

interface Task {
  id: string;
  title: string;
  goalId: string;
  prio: Prio;
  etat: Etat;
  estimeInitial: number;
  passe: number;
  restant: number;
  date?: string;
  deps?: string[]; // US19 — prérequis par référence (ids de tâches)
  dateFin?: string; // US2 — date réelle de complétion
  supprimee?: boolean; // US15 — suppression logique (historique conservé)
  historiqueEtat?: { etat: Etat; date: string }[]; // Passe 3 — journal des changements d'état (date réelle au jour)
}

interface Goal {
  id: string;
  title: string;
  p: 1 | 2 | 3 | 4;
  color: string;
  echeance: string; // itération 8 / US26 — date ISO yyyy-mm-dd ("" = pas d'échéance)
  archive?: boolean;
  // US12 — SMART
  specifique?: string; // S
  mesurable?: string; // M — itération 8 / US25 : texte libre unique (ex. « 100 % des murs peints »)
  realiste?: boolean; // R
  motivation?: string; // R
}

interface TimeEntry { id: string; taskId: string; date: string; hours: number; } // US4/US7 — journal des saisies
interface MigrationLogEntry { name: string; from: number; to: number; date: string; } // US16/A5

interface Preferences { capaciteJourOuvre: number; capaciteWeekEnd: number; } // US20 — capacité moyenne par défaut (heures/jour)
interface Account { id: string; email: string; nom: string; } // US14 — compte Google unique (identifiant de cloisonnement)
interface AgendaEvent { taskId: string; date: string; syncedAt: string; } // US1 — état connu de l'événement dans l'agenda externe
interface SyncLogEntry { at: string; action: "cree" | "maj" | "retire"; taskId: string; } // US1 — journal de synchronisation

interface AppData {
  version: number;
  preferences: Preferences;
  account: Account | null; // US14 — null = non connecté (données locales)
  agenda: { lastSync: string | null; events: Record<string, AgendaEvent>; log: SyncLogEntry[] }; // US1 — synchro Google Agenda
  goals: Goal[];
  tasks: Task[];
  entries: TimeEntry[];
  migrationLog: MigrationLogEntry[];
}

// ==================== US16 : migrations ====================

const MIGRATIONS: { from: number; to: number; name: string; migrate: (d: any) => any }[] = [
  {
    from: 1, to: 2, name: "v01_v02_saisie_deux_champs",
    migrate: (d) => ({
      ...d,
      tasks: d.tasks.map((t: any) => ({
        ...t,
        estimeInitial: t.estimeInitial ?? t.estime,
        passe: t.passe ?? 0,
        restant: t.restant ?? Math.max((t.estime ?? t.estimeInitial ?? 0) - (t.passe ?? 0), 0),
      })),
    }),
  },
  {
    from: 2, to: 3, name: "v02_v03_smart_saisies",
    // Ajoute les attributs SMART aux objectifs, le journal des saisies (amorcé depuis
    // les temps passés existants, datés du jour de migration) et le journal des migrations.
    migrate: (d) => {
      const today = new Date().toISOString().slice(0, 10);
      return {
        ...d,
        goals: d.goals.map((g: any) => ({
          ...g,
          specifique: g.specifique ?? "",
          mesurableValeur: g.mesurableValeur ?? undefined,
          mesurableUnite: g.mesurableUnite ?? "",
          realiste: g.realiste ?? false,
          motivation: g.motivation ?? "",
          archive: g.archive ?? false,
        })),
        entries: [
          ...(d.entries ?? []),
          ...d.tasks
            .filter((t: any) => (t.passe ?? 0) > 0)
            .map((t: any) => ({ id: "e_seed_" + t.id, taskId: t.id, date: today, hours: t.passe ?? 0 })),
        ],
        migrationLog: d.migrationLog ?? [], // A5 — journal créé par cette migration (les entrées sont ajoutées par migrateData)
      };
    },
  },
  {
    from: 3, to: 4, name: "v03_v04_deps_suppression_logique",
    // US19 — dépendances entre tâches par référence ; US2 — date réelle de fin
    // (amorcée depuis la dernière saisie des tâches terminées) ; US15 — suppression
    // logique des tâches pour ne jamais casser l'historique des saisies.
    migrate: (d) => {
      const lastEntry = new Map<string, string>();
      for (const e of (d.entries ?? []) as any[]) {
        if (e.hours > 0 && (!lastEntry.has(e.taskId) || e.date > lastEntry.get(e.taskId)!)) lastEntry.set(e.taskId, e.date);
      }
      return {
        ...d,
        tasks: d.tasks.map((t: any) => ({
          ...t,
          deps: t.deps ?? [],
          supprimee: t.supprimee ?? false,
          dateFin: t.dateFin ?? (t.etat === "terminee" ? lastEntry.get(t.id) : undefined),
        })),
      };
    },
  },
  {
    from: 4, to: 5, name: "v04_v05_preferences_capacite",
    // US20 — capacité moyenne par défaut, configurable jour ouvré / week-end
    migrate: (d) => ({
      ...d,
      preferences: d.preferences ?? { capaciteJourOuvre: 6, capaciteWeekEnd: 3 },
    }),
  },
  {
    from: 5, to: 6, name: "v05_v06_compte_google",
    // US14 réduit — compte Google unique (cloisonnement par compte) ; US1 — état de synchronisation agenda
    migrate: (d) => ({
      ...d,
      account: d.account ?? null,
      agenda: d.agenda ?? { lastSync: null, events: {}, log: [] },
    }),
  },
  {
    from: 6, to: 7, name: "v06_v07_historique_etats",
    // Passe 3 — journal des changements d'état : amorcé avec l'état courant de chaque tâche,
    // daté de la date de fin réelle (US2) si elle est terminée, sinon de la date de migration.
    // Au passage, le champ `disponibilite` des objectifs (retiré à la passe 2) disparaît définitivement.
    migrate: (d) => {
      const today = new Date().toISOString().slice(0, 10);
      return {
        ...d,
        goals: (d.goals ?? []).map((g: any) => { const { disponibilite, ...reste } = g; return reste; }),
        tasks: d.tasks.map((t: any) => ({
          ...t,
          historiqueEtat: t.historiqueEtat ?? [{ etat: t.etat, date: t.etat === "terminee" ? (t.dateFin ?? today) : today }],
        })),
      };
    },
  },
  {
    from: 7, to: 8, name: "v07_v08_mesurable_texte",
    // Itération 8 / US25 — M — Mesurable devient un champ texte unique : concaténation
    // valeur + unité des données v7, sans perte ; les anciens champs disparaissent.
    migrate: (d) => ({
      ...d,
      goals: (d.goals ?? []).map((g: any) => {
        const { mesurableValeur, mesurableUnite, ...reste } = g;
        const valeur = mesurableValeur === undefined || mesurableValeur === null ? "" : String(mesurableValeur);
        const unite = (mesurableUnite ?? "").trim();
        const mesurable = (valeur + (valeur && unite ? " " : "") + unite).trim();
        return { ...reste, mesurable: mesurable || undefined };
      }),
    }),
  },
  {
    from: 8, to: 9, name: "v08_v09_dates_iso",
    // Itération 8 / US26 — toutes les dates passent au stockage ISO yyyy-mm-dd :
    // libellés roulants résolus au jour réel (« aujourd'hui » → ISO du jour, « demain » → ISO du lendemain),
    // jj/mm résolus à l'année courante la plus proche par parseDDMM existant (année en cours si la date
    // est à venir, sinon année suivante) ; un texte non résolvable est écarté proprement (plus de date).
    migrate: (d) => {
      const now = new Date();
      const isoJour = isoLocal(now);
      const isoLendemain = isoDuLendemain(now);
      const isoDe = (s: string): string | undefined => {
        if (!s || !s.trim()) return undefined;
        if (s === "aujourd'hui") return isoJour;
        if (s === "demain") return isoLendemain;
        const p = parseDDMM(s.trim(), now);
        return p ? isoLocal(p) : undefined;
      };
      return {
        ...d,
        goals: (d.goals ?? []).map((g: any) => ({ ...g, echeance: isoDe(g.echeance) ?? "" })),
        tasks: (d.tasks ?? []).map((t: any) => ({ ...t, date: isoDe(t.date) })),
      };
    },
  },
];

function deepClone<T>(o: T): T { return JSON.parse(JSON.stringify(o)); }

function checkIntegrity(d: AppData): string | null {
  if (!d || typeof d.version !== "number") return "version de schéma absente";
  if (!Array.isArray(d.goals) || !Array.isArray(d.tasks)) return "collections invalides";
  const goalIds = new Set(d.goals.map((g) => g.id));
  const taskIds = new Set(d.tasks.map((t) => t.id));
  for (const t of d.tasks) {
    if (t.supprimee) continue; // tâche historisée (US15) : sa référence d'objectif peut avoir disparu
    if (!goalIds.has(t.goalId)) return `tâche ${t.id ?? "?"} rattachée à un objectif inconnu`;
    if (typeof t.estimeInitial !== "number" || t.estimeInitial <= 0) return `tâche ${t.id} : estimation initiale invalide`;
    if (typeof t.restant !== "number" || t.restant < 0) return `tâche ${t.id} : temps restant invalide`;
    if (typeof t.passe !== "number" || t.passe < 0) return `tâche ${t.id} : temps passé invalide`;
  }
  for (const t of d.tasks) {
    for (const dep of t.deps ?? []) {
      if (!taskIds.has(dep)) return `tâche ${t.id} : dépendance pendante vers ${dep}`;
      if (dep === t.id) return `tâche ${t.id} : dépendance vers elle-même`;
    }
  }
  for (const e of d.entries ?? []) {
    if (!taskIds.has(e.taskId)) return `saisie ${e.id} rattachée à une tâche inconnue`;
    if (typeof e.hours !== "number" || e.hours < 0) return `saisie ${e.id} : heures invalides`;
  }
  if (d.version >= 5) { // US20 — v5 : préférences de capacité (contrôle uniquement à partir de v5 : le check s'exécute aussi sur la version source pendant une migration)
    const p = (d as any).preferences;
    if (!p || typeof p.capaciteJourOuvre !== "number" || p.capaciteJourOuvre <= 0 || typeof p.capaciteWeekEnd !== "number" || p.capaciteWeekEnd < 0)
      return "préférences de capacité invalides";
  }
  if (d.version >= 6) { // US14/US1 — v6 : compte connecté + état agenda (contrôles à partir de v6 uniquement)
    const acc = (d as any).account;
    if (acc !== null && acc !== undefined && (typeof acc.id !== "string" || !acc.id || typeof acc.email !== "string" || typeof acc.nom !== "string"))
      return "compte connecté invalide";
    const ag = (d as any).agenda;
    if (!ag || typeof ag !== "object" || Array.isArray(ag) || (ag.lastSync !== null && typeof ag.lastSync !== "string") || !Array.isArray(ag.log) || !ag.events || typeof ag.events !== "object")
      return "état agenda invalide";
    for (const l of ag.log) {
      if (!["cree", "maj", "retire"].includes(l.action) || !taskIds.has(l.taskId)) return `journal de synchronisation invalide : ${l.action} ${l.taskId}`;
    }
    for (const [taskId, ev] of Object.entries(ag.events)) {
      if (!taskIds.has(taskId)) return `événement agenda rattaché à une tâche inconnue : ${taskId}`;
      if (typeof ev.date !== "string" || typeof ev.syncedAt !== "string") return `événement agenda ${taskId} : champs invalides`;
    }
  }
  if (d.version >= 7) { // Passe 3 — v7 : journal des changements d'état (dernière entrée = état courant)
    for (const t of d.tasks) {
      const h = (t as any).historiqueEtat;
      if (!Array.isArray(h)) return `tâche ${t.id ?? "?"} : journal d'états invalide`;
      for (const e of h) {
        if (!["a_planifier", "planifiee", "en_cours", "terminee"].includes(e?.etat) || typeof e?.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.date))
          return `tâche ${t.id} : entrée de journal d'états invalide`;
      }
      if (h.length > 0 && h[h.length - 1].etat !== t.etat) return `tâche ${t.id} : journal d'états incohérent avec l'état courant`;
    }
  }
  if (d.version >= 8) { // Itération 8 / US25 — v8 : M en texte unique, ancien couple valeur/unité retiré
    for (const g of d.goals) {
      const m = (g as any).mesurable;
      if (m !== undefined && typeof m !== "string") return `objectif ${g.id ?? "?"} : indicateur mesurable invalide`;
      if ((g as any).mesurableValeur !== undefined || (g as any).mesurableUnite !== undefined)
        return `objectif ${g.id ?? "?"} : ancien format M (valeur + unité) encore présent`;
    }
  }
  if (d.version >= 9) { // Itération 8 / US26 — v9 : dates stockées ISO valides
    for (const g of d.goals) {
      if ((g as any).echeance && !parseISO((g as any).echeance)) return `objectif ${g.id ?? "?"} : échéance invalide « ${(g as any).echeance} »`;
    }
    for (const t of d.tasks) {
      if ((t as any).date && !parseISO((t as any).date)) return `tâche ${t.id} : date planifiée invalide « ${(t as any).date} »`;
    }
  }
  return null;
}

function migrateData(input: any): { data: AppData | null; applied: string[]; untouched: any; error: string | null } {
  const untouched = deepClone(input);
  let current = deepClone(input);
  const applied: string[] = [];
  if (typeof current.version !== "number") return { data: null, applied, untouched, error: "version de schéma absente" };
  for (const m of MIGRATIONS) {
    if (current.version === m.from) {
      try {
        const next = m.migrate(deepClone(current));
        const integrityError = checkIntegrity(next);
        if (integrityError) throw new Error(integrityError);
        next.version = m.to;
        current = next;
        applied.push(m.name);
      } catch (e: any) {
        return { data: null, applied, untouched, error: `migration ${m.name} en échec : ${e.message}` };
      }
    }
  }
  if (current.version !== SCHEMA_VERSION)
    return { data: null, applied, untouched, error: `schéma v${current.version} inattendu (attendu v${SCHEMA_VERSION})` };
  // A5 — journal des migrations persistant
  const logDate = new Date().toISOString().slice(0, 10);
  let from = input.version;
  for (const name of applied) {
    const m = MIGRATIONS.find((x) => x.name === name)!;
    if (!current.migrationLog.some((l: MigrationLogEntry) => l.name === name)) {
      current.migrationLog.push({ name, from, to: m.to, date: logDate });
    }
    from = m.to;
  }
  return { data: current as AppData, applied, untouched, error: null };
}

function loadAppData(): { data: AppData; applied: string[]; error: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: initialData(), applied: [], error: null };
    const stored = JSON.parse(raw);
    if (stored.version === SCHEMA_VERSION) {
      const err = checkIntegrity(stored);
      if (err) return { data: initialData(), applied: [], error: `données stockées invalides : ${err}` };
      return { data: stored, applied: [], error: null };
    }
    const result = migrateData(stored);
    if (result.error || !result.data) return { data: initialData(), applied: result.applied, error: result.error };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
    return { data: result.data, applied: result.applied, error: null };
  } catch { return { data: initialData(), applied: [], error: null }; }
}

// ==================== US4/US6/US7/US12/A3 : logique métier ====================

// Passe 3 — historisation des changements d'état : toute transition ajoute une entrée datée au journal
function avecEtat(t: Task, etat: Etat, now = new Date()): Task {
  if (t.etat === etat) return t;
  return { ...t, etat, historiqueEtat: [...(t.historiqueEtat ?? []), { etat, date: isoLocal(now) }] };
}

function saisieTemps(t: Task, tempsPasse: number, tempsRestant: number): { task: Task; entry: TimeEntry | null } {
  if (isNaN(tempsPasse) || isNaN(tempsRestant) || tempsPasse < 0 || tempsRestant < 0)
    throw new Error("temps passé et temps restant doivent être des nombres ≥ 0");
  if (tempsPasse === 0 && tempsRestant === t.restant) return { task: t, entry: null };
  const passe = Math.round((t.passe + tempsPasse) * 10) / 10;
  const restant = Math.round(tempsRestant * 10) / 10;
  const cible: Etat = restant === 0 ? "terminee" : "en_cours"; // complétion uniquement par saisie finalisée (passe d'usage 2)
  return {
    task: { ...avecEtat(t, cible), passe, restant, dateFin: cible === "terminee" ? new Date().toISOString().slice(0, 10) : undefined }, // US2 — date réelle de complétion ; Passe 3 — état journalisé
    entry: { id: "e" + Date.now() + Math.floor(Math.random() * 1000), taskId: t.id, date: new Date().toISOString().slice(0, 10), hours: tempsPasse },
  };
}

// Passe 2 — clôture de tâche : la complétion exige la saisie du temps passé TOTAL ajusté (obligatoire) ;
// le restant passe à 0, la date réelle de complétion est posée (US2), l'écart éventuel alimente la dérive (A3).
function cloturerTache(t: Task, totalAjuste: number): { task: Task; entry: TimeEntry | null } {
  if (isNaN(totalAjuste) || totalAjuste < 0) throw new Error("temps passé total invalide : nombre ≥ 0 attendu");
  const total = Math.round(totalAjuste * 10) / 10;
  if (total < t.passe) throw new Error(`le temps passé total (${h(total)}) ne peut pas être inférieur au temps déjà logué (${h(t.passe)})`);
  return saisieTemps(t, Math.round((total - t.passe) * 10) / 10, 0); // restant 0 → complétion + date réelle (US2)
}

// Passe 2 — historique du temps logué : groupements purs par jour (décroissant) et par tâche
function grouperParJour(entries: TimeEntry[]): { date: string; lignes: { taskId: string; hours: number }[]; total: number }[] {
  const map = new Map<string, { taskId: string; hours: number }[]>();
  for (const e of entries) { const l = map.get(e.date) ?? []; l.push({ taskId: e.taskId, hours: e.hours }); map.set(e.date, l); }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, lignes]) => ({ date, lignes, total: Math.round(lignes.reduce((s, l) => s + l.hours, 0) * 10) / 10 }));
}
function grouperParTache(entries: TimeEntry[], tasks: Task[]): { taskId: string; lignes: { date: string; hours: number }[]; total: number }[] {
  const map = new Map<string, { date: string; hours: number }[]>();
  for (const e of entries) { const l = map.get(e.taskId) ?? []; l.push({ date: e.date, hours: e.hours }); map.set(e.taskId, l); }
  return [...map.entries()].map(([taskId, lignes]) => ({ taskId, lignes: lignes.slice().sort((a, b) => a.date.localeCompare(b.date)), total: Math.round(lignes.reduce((s, l) => s + l.hours, 0) * 10) / 10 }))
    .sort((a, b) => (tasks.find((t) => t.id === a.taskId)?.title ?? a.taskId).localeCompare(tasks.find((t) => t.id === b.taskId)?.title ?? b.taskId));
}

let TASK_SEQ = 0; // US24 — séquenceur d'ids de tâches (création en lot dans la même milliseconde)

function createTask(data: AppData, t: { title: string; goalId: string; prio: Prio; estime: number; date?: string }): { data: AppData; task: Task } {
  // Itération 7 / US28 — champs obligatoires et contrôlés (titre, objectif lié, charge > 0, date valide si renseignée)
  const err = validerNouvelleTache(t, data.goals.filter((g) => !g.archive).map((g) => g.id));
  if (err) throw new Error(err);
  const date = t.date?.trim() || undefined; // itération 7 — date vide ou blanche normalisée (jamais « planifiée » avec une date vide)
  const task: Task = {
    id: "t" + Date.now() + "_" + (TASK_SEQ = (TASK_SEQ ?? 0) + 1), // US24 — ids uniques même en création en lot (même milliseconde)
    title: t.title.trim(), goalId: t.goalId, prio: t.prio,
    etat: date ? "planifiee" : "a_planifier", estimeInitial: t.estime, passe: 0, restant: t.estime, date,
    historiqueEtat: [{ etat: date ? "planifiee" : "a_planifier", date: isoLocal(new Date()) }], // Passe 3 — état initial journalisé
  };
  return { data: { ...data, tasks: [...data.tasks, task] }, task };
}

const prioOrder: Record<Prio, number> = { haute: 0, moyenne: 1, basse: 2 };
function sortBacklog(tasks: Task[], goals: Goal[]): Task[] {
  const goalP = new Map(goals.map((g) => [g.id, g.p]));
  return [...tasks].sort(
    (a, b) =>
      (goalP.get(a.goalId) ?? 9) - (goalP.get(b.goalId) ?? 9) ||
      prioOrder[a.prio] - prioOrder[b.prio] ||
      (a.date ? 0 : 1) - (b.date ? 0 : 1) ||
      (a.date ?? "").localeCompare(b.date ?? "")
  );
}

// ==================== Itération 7 — US28/US29/US30 : contrôles de saisie, gardes de statut, urgence ====================

// US28 — validation des champs d'une nouvelle tâche : titre, objectif lié, charge estimée > 0,
// date planifiée valide si renseignée. Fin du repli silencieux à 1 h : une charge invalide est
// refusée avec un message explicite, jamais remplacée automatiquement.
function validerNouvelleTache(input: { title: string; goalId: string; estime: number; date?: string }, goalIds: string[]): string | null {
  if (!input.title.trim()) return "titre obligatoire";
  if (!input.goalId || !goalIds.includes(input.goalId)) return "objectif lié obligatoire";
  if (isNaN(input.estime) || input.estime <= 0) return "charge estimée obligatoire (> 0 h) — elle n'est plus remplacée automatiquement";
  if (input.date && input.date.trim() && !parseISO(input.date.trim()))
    return `date planifiée invalide : « ${input.date} » (choisissez une date dans le calendrier, ou laisse le champ vide)`; // US26 — ISO via calendrier
  return null;
}

// US29/US26 — une date planifiée est valide si c'est une date ISO résolvable (garde, le calendrier la rend valide par construction)
function datePlanifieeOk(t: Task): boolean {
  return !!t.date && !!parseISO(t.date);
}

// US29 — prochaine étape du cycle strict (le bouton d'état ne propose jamais une transition hors cycle)
function prochainEtat(t: Task): Etat {
  const cycle: Etat[] = ["a_planifier", "planifiee", "en_cours", "terminee"];
  return t.etat === "terminee" ? "a_planifier" : cycle[cycle.indexOf(t.etat) + 1];
}

// US29 — matrice de transitions strictement séquentielle : la ré-ouverture (terminée → à planifier)
// est la seule transition arrière (confirmation explicite exigée côté appelant) ;
// gardes existantes conservées (US19 bloquage, US4-c6 clôture hors de cette fonction).
function transitionEtat(t: Task, cible: Etat, tasks: Task[], datePlanifieeValide: boolean): { ok: boolean; raison?: string } {
  if (t.etat === cible) return { ok: false, raison: "la tâche est déjà dans cet état" };
  const reouverture = t.etat === "terminee" && cible === "a_planifier";
  if (!reouverture && prochainEtat(t) !== cible)
    return { ok: false, raison: `transition « ${etatLabel[t.etat]} » → « ${etatLabel[cible]} » refusée : cycle strict (à planifier → planifiée → en cours → terminée ; ré-ouverture pour revenir)` };
  const bloq = bloqueursDe(t, tasks); // US19 — prérequis non terminés : transition refusée
  if (bloq.length > 0) return { ok: false, raison: `« ${t.title} » bloquée par : ${bloq.map((b) => b.title).join(", ")}` };
  if (cible === "planifiee" && !datePlanifieeValide)
    return { ok: false, raison: "date planifiée requise pour planifier une tâche (calendrier, ou via le rituel du soir)" };
  return { ok: true };
}

// US29 — ré-ouverture confirmée : restant restauré (borné à 0), date de fin effacée, changement journalisé
function reouvrirTache(t: Task): Task {
  const y = avecEtat(t, "a_planifier"); // Passe 3 — ré-ouverture journalisée
  return { ...y, restant: Math.max(t.restant || t.estimeInitial - t.passe, 0), dateFin: undefined };
}

// US30 — urgence d'une suggestion du rituel : (1) échéance cible de l'objectif la plus proche d'abord
// (sans échéance en dernier), (2) objectif « à risque » (US7/US12) devant à échéance égale,
// (3) priorité de la tâche, (4) priorité de l'objectif, (5) date déjà posée, puis restant décroissant.
// Ordre total et stable : dernier critère de départage, l'identifiant.
function triParUrgence(tasks: Task[], goals: Goal[], allTasks: Task[], velocite: number | null, now = new Date()): Task[] {
  const infos = new Map<string, { ech: number; risque: number; p: number }>();
  for (const g of goals) {
    const e = parseISO(g.echeance); // US26 — échéance ISO réelle
    infos.set(g.id, {
      ech: e ? e.getTime() : Number.MAX_SAFE_INTEGER, // pas d'échéance → en dernier
      risque: smartCheck(g, allTasks, velocite, now).risque ? 0 : 1, // à risque d'abord
      p: g.p,
    });
  }
  const cle = (t: Task): number[] => {
    const i = infos.get(t.goalId) ?? { ech: Number.MAX_SAFE_INTEGER, risque: 1, p: 9 };
    return [i.ech, i.risque, prioOrder[t.prio], i.p, t.date ? 0 : 1, -(Math.round(t.restant * 10) / 10)];
  };
  return [...tasks].sort((a, b) => {
    const ka = cle(a), kb = cle(b);
    for (let i = 0; i < ka.length; i++) { const c = ka[i] - kb[i]; if (c !== 0) return c; }
    return a.id.localeCompare(b.id); // stabilité : ordre total
  });
}

// Passe 3 — regroupement des tâches par état, dans l'ordre du cycle de vie (tri interne inchangé, US5)
function groupesParEtat(tasks: Task[], goals: Goal[]): { etat: Etat; items: Task[] }[] {
  const cycle: Etat[] = ["a_planifier", "planifiee", "en_cours", "terminee"];
  return cycle.map((etat) => ({
    etat,
    items: etat === "terminee" ? tasks.filter((t) => t.etat === etat) : sortBacklog(tasks.filter((t) => t.etat === etat), goals),
  }));
}

function parseDDMM(s: string, now = new Date()): Date | null {
  // Itération 8 / US26 — plus utilisé en saisie (calendrier ISO) ; conservé pour la migration v08_v09
  // qui résout les jj/mm historiques (année courante la plus proche).
  const m = /^(\d{2})\/(\d{2})$/.exec(s ?? "");
  if (!m) return null;
  const day = parseInt(m[1]);
  const month = parseInt(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let d = new Date(now.getFullYear(), month - 1, day);
  if (d.getDate() !== day || d.getMonth() !== month - 1) return null; // rejette 31/04, 32/12, 99/99…
  if (d < now) d = new Date(now.getFullYear() + 1, month - 1, day);
  return d;
}

// US20 — capacité moyenne du jour selon les préférences (samedi/dimanche = week-end)
function capaciteJour(d: Date, prefs: Preferences): number {
  return d.getDay() === 0 || d.getDay() === 6 ? prefs.capaciteWeekEnd : prefs.capaciteJourOuvre;
}

// US20 — clé ISO locale (yyyy-mm-dd) sans décalage de fuseau
function isoLocal(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Itération 8 / US26 — ISO du jour et du lendemain (remplacent les libellés roulants « aujourd'hui » / « demain »)
const isoDuJour = (now = new Date()) => isoLocal(now);
const isoDuLendemain = (now = new Date()) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); return isoLocal(d); };

// Itération 8 / US26 — date ISO valide (yyyy-mm-dd, jour réellement existant — rejette 2026-02-31)
function parseISO(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s ?? "")) return null;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

// Itération 8 / US26 — affichage court jj/mm d'une date ISO (les dates sont réelles, plus de libellés roulants)
const fmtIso = (iso?: string) => (iso ? parseISO(iso)?.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) ?? "—" : "—");

// US7 — vélocité progressive : estimation dès le 2ᵉ jour de saisie
function computeVelocity(entries: TimeEntry[]): { velocite: number | null; statut: "aucune" | "extrapolee" | "hebdo" | "glissante"; jours: number } {
  const withHours = entries.filter((e) => e.hours > 0);
  if (withHours.length === 0) return { velocite: null, statut: "aucune", jours: 0 };
  const dayTotals = new Map<string, number>();
  for (const e of withHours) dayTotals.set(e.date, (dayTotals.get(e.date) ?? 0) + e.hours);
  const jours = dayTotals.size;
  if (jours < 2) return { velocite: null, statut: "aucune", jours };
  const total = [...dayTotals.values()].reduce((s, v) => s + v, 0);
  const dates = [...dayTotals.keys()].sort();
  const ecartJours = Math.max(1, Math.round((new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / 864e5) + 1);
  if (ecartJours <= 7) return { velocite: Math.round((total / jours) * 7 * 10) / 10, statut: "extrapolee", jours };
  const nbSemaines = Math.max(1, Math.floor(ecartJours / 7));
  if (nbSemaines < 3) return { velocite: Math.round((total / nbSemaines) * 10) / 10, statut: "hebdo", jours };
  const cutoff = new Date(dates[dates.length - 1]);
  cutoff.setDate(cutoff.getDate() - 20);
  let win = 0;
  for (const [d, v] of dayTotals) if (new Date(d).getTime() >= cutoff.getTime()) win += v;
  return { velocite: Math.round((win / 3) * 10) / 10, statut: "glissante", jours };
}

// US7 — date de fin estimée d'un objectif (reste / vélocité)
function estimeFin(restantTotal: number, vel: number | null, now = new Date()): Date | null {
  if (vel === null || vel <= 0) return null;
  const fin = new Date(now);
  fin.setDate(fin.getDate() + Math.ceil((restantTotal / vel) * 7));
  return fin;
}

const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

// US12 — contrôleur SMART
const MOTS_VAGUES = ["améliorer", "mieux", "assez", "divers", "etc."];
function smartCheck(g: Goal, tasks: Task[], vel: number | null, now = new Date()): { score: number; manquants: string[]; risque: boolean; restant: number } {
  const manquants: string[] = [];
  const spec = (g.specifique ?? "").trim();
  if (spec.length < 10 || MOTS_VAGUES.some((m) => spec.toLowerCase().includes(m))) manquants.push("S — Spécifique");
  if (!(g.mesurable ?? "").trim()) manquants.push("M — Mesurable"); // US25 — texte libre non vide
  const restant = tasks.filter((t) => !t.supprimee && t.goalId === g.id && t.etat !== "terminee").reduce((s, t) => s + t.restant, 0); // restant de CET objectif
  const echeance = parseISO(g.echeance); // US26 — ISO réelle
  const semainesRestantes = echeance ? Math.max(0, (echeance.getTime() - now.getTime()) / (7 * 864e5)) : 0;
  // Passe 2 — A — Atteignable dérivé de la vélocité réelle observée (plus de disponibilité hebdomadaire
  // déclarée par objectif) : manquant si le restant dépasse ce que la vélocité permet de tenir avant
  // l'échéance ; tant que la vélocité n'est pas mesurable, A est indéterminé et n'est pas signalé.
  if (vel !== null && restant > vel * semainesRestantes) manquants.push("A — Atteignable");
  if (g.realiste !== true) manquants.push("R — Réaliste");
  if (!echeance) manquants.push("T — Temporel");
  const fin = estimeFinObjectif(g, tasks, vel, now); // US19 — tient compte des chaînes de dépendances
  const risque = !!fin && !!echeance && fin.getTime() > echeance.getTime();
  return { score: 5 - manquants.length, manquants, risque, restant };
}

// A3 — fiabilité des estimations : dérive moyenne entre estimé initial et recalé
function fiabilite(tasks: Task[]): { derive: number | null; nb: number } {
  const ciblees = tasks.filter((t) => !t.supprimee && (t.passe > 0 || t.restant !== t.estimeInitial));
  if (ciblees.length === 0) return { derive: null, nb: 0 };
  const derives = ciblees.map((t) => (t.passe + t.restant - t.estimeInitial) / t.estimeInitial);
  return { derive: Math.round((derives.reduce((s, d) => s + d, 0) / derives.length) * 1000) / 10, nb: ciblees.length };
}

// US13/A4/US15 — suppression d'objectif avec choix explicite (suppression logique :
// l'historique des saisies est conservé, aucune dépendance pendante ne subsiste).
function supprimerObjectif(data: AppData, goalId: string, mode: "archiver" | "supprimer"): AppData {
  if (mode === "archiver") return { ...data, goals: data.goals.map((g) => (g.id === goalId ? { ...g, archive: true } : g)) };
  const removed = new Set(data.tasks.filter((t) => t.goalId === goalId).map((t) => t.id));
  return {
    ...data,
    goals: data.goals.filter((g) => g.id !== goalId),
    tasks: data.tasks.map((t) =>
      t.goalId === goalId
        ? { ...t, supprimee: true, deps: [] } // historisée : invisible mais intacte pour les saisies
        : { ...t, deps: (t.deps ?? []).filter((d) => !removed.has(d)) } // US19 — aucun lien pendant
    ),
  };
}

// ==================== US19 — Dépendances entre tâches, héritées à l'objectif ====================

function actives(tasks: Task[]): Task[] { return tasks.filter((t) => !t.supprimee); }

// Prérequis non terminés d'une tâche (bloqueurs)
function bloqueursDe(t: Task, tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((x) => [x.id, x]));
  return (t.deps ?? []).map((d) => byId.get(d)).filter((x): x is Task => !!x && x.etat !== "terminee" && !x.supprimee);
}

// Détection de cycle (direct ou transitif) : ajouter newDep à taskId créerait-il une boucle ?
function detectCycle(tasks: Task[], taskId: string, newDep: string): boolean {
  if (newDep === taskId) return true;
  const byId = new Map(tasks.map((x) => [x.id, x]));
  const seen = new Set<string>();
  const stack = [newDep];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === taskId) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const d of byId.get(cur)?.deps ?? []) stack.push(d);
  }
  return false;
}

// US7/US19 — fin estimée d'une tâche : max(fin des prérequis, aujourd'hui) + restant ÷ vélocité
function estimeFinTache(t: Task, tasks: Task[], vel: number | null, now = new Date()): Date | null {
  if (vel === null || vel <= 0) return null;
  const byId = new Map(tasks.map((x) => [x.id, x]));
  const memo = new Map<string, Date | null>();
  const fin = (id: string, depth: number): Date | null => {
    if (memo.has(id)) return memo.get(id)!;
    if (depth > 64) return null; // garde-fou
    const task = byId.get(id);
    if (!task) return null;
    const depFins = (task.deps ?? []).map((d) => fin(d, depth + 1)).filter((f): f is Date => !!f);
    const base = depFins.length ? new Date(Math.max(now.getTime(), ...depFins.map((f) => f.getTime()))) : now;
    const f = new Date(base);
    f.setDate(f.getDate() + Math.ceil((task.restant / vel) * 7));
    memo.set(id, f);
    return f;
  };
  return fin(t.id, 0);
}

// US19 — dépendances héritées à l'objectif : prérequis inter-objectifs de ses tâches
function depsHeritees(g: Goal, tasks: Task[]): { goalId: string; liens: number; taches: string[] }[] {
  const byId = new Map(tasks.map((x) => [x.id, x]));
  const agg = new Map<string, { goalId: string; liens: number; taches: Set<string> }>();
  for (const t of actives(tasks).filter((x) => x.goalId === g.id)) {
    for (const d of t.deps ?? []) {
      const dep = byId.get(d);
      if (!dep || dep.supprimee || dep.goalId === g.id) continue;
      const cur = agg.get(dep.goalId) ?? { goalId: dep.goalId, liens: 0, taches: new Set<string>() };
      cur.liens++;
      cur.taches.add(t.id);
      agg.set(dep.goalId, cur);
    }
  }
  return [...agg.values()].map((v) => ({ goalId: v.goalId, liens: v.liens, taches: [...v.taches] }));
}

// US7/US19 — fin estimée d'un objectif : agrégée + héritée des chaînes de dépendances de ses tâches
function estimeFinObjectif(g: Goal, tasks: Task[], vel: number | null, now = new Date()): Date | null {
  if (vel === null || vel <= 0) return null;
  const own = actives(tasks).filter((t) => t.goalId === g.id);
  const restant = own.filter((t) => t.etat !== "terminee").reduce((s, t) => s + t.restant, 0);
  const fins = own.filter((t) => (t.deps ?? []).length > 0).map((t) => estimeFinTache(t, tasks, vel, now));
  const all = [estimeFin(restant, vel, now), ...fins].filter((f): f is Date => !!f);
  return all.length ? new Date(Math.max(...all.map((f) => f.getTime()))) : null;
}

// US19/US15 — suppression logique d'une tâche (choix explicite : retirer les liens, historique conservé)
function deleteTask(data: AppData, taskId: string): AppData {
  return {
    ...data,
    tasks: data.tasks.map((t) =>
      t.id === taskId ? { ...t, supprimee: true, deps: [] } : { ...t, deps: (t.deps ?? []).filter((d) => d !== taskId) }
    ),
  };
}

// ==================== US14/US1 — compte Google et synchronisation agenda ====================

function isoDateTime(d: Date): string { return isoLocal(d) + "T" + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

// US14 — validation d'une adresse de compte (identifiant = adresse normalisée, cloisonnement du stockage)
function compteDepuisEmail(email: string, nom?: string): Account | null {
  const e = (email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return { id: e, email: e, nom: (nom ?? "").trim() || e.split("@")[0] };
}

// US15/US14 — clé de stockage cloisonnée par compte (espace distinct, jamais de mélange)
function cleStockage(accountId: string | null): string {
  return accountId ? STORAGE_KEY + "::" + accountId : STORAGE_KEY;
}

// v0.11.1 — garde-fou persistance : le runtime de la maquette peut offrir un stockage éphémère
// (réinitialisé entre deux ouvertures — incident du 19/10/2026). Une sonde datée détecte ce cas
// pour avertir l'utilisateur ; l'export/import US23 sert de pont de secours jusqu'à la persistance distante (ADR-10).
const PROBE_KEY = STORAGE_KEY + "::sonde";
type StatutStockage = "indisponible" | "ephemere" | "persistant";

function diagnosticStockage(ls: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void } | null, now = new Date()): StatutStockage {
  if (!ls) return "indisponible"; // aucun localStorage exposé par le runtime
  try {
    if (ls.getItem(PROBE_KEY)) return "persistant"; // la sonde posée lors d'une ouverture précédente a survécu
    ls.setItem(PROBE_KEY, isoLocal(now)); // première utilisation (ou stockage effacé) : verdict définitif à la prochaine ouverture
    return "ephemere";
  } catch { return "indisponible"; } // accès en échec (quota, mode privé strict…)
}

// v0.11.2 — accès entièrement gardé : dans le runtime bac à sable, la SEULE lecture de `localStorage`
// peut lever une SecurityError (origine opaque) — `typeof` déclenche aussi l'accesseur. L'invariant
// « aucun accès au stockage non gardé » (US15, try/catch « mémoire seule » partout ailleurs) est restauré.
function statutStockageInitial(): StatutStockage {
  try { return diagnosticStockage(typeof localStorage !== "undefined" ? localStorage : null); } catch { return "indisponible"; }
}

// US1 — synchronisation agenda (simulée sur maquette, API Google réel au livrable PWA) :
// un événement par tâche planifiée active, mis à jour si la date réelle change, retiré si la
// tâche est terminée/supprimée/déplanifiée ; opérations journalisées ; refus sans compte connecté.
function synchroniserAgenda(data: AppData, now = new Date()): { data: AppData; resume: { crees: number; maj: number; retires: number; erreur: string | null } } {
  if (!data.account) return { data, resume: { crees: 0, maj: 0, retires: 0, erreur: "Connectez un compte Google pour synchroniser l'agenda." } };
  const events: Record<string, AgendaEvent> = { ...data.agenda.events };
  const log = [...data.agenda.log];
  const at = isoDateTime(now);
  let crees = 0, maj = 0, retires = 0;
  // retraits : événements dont la tâche n'est plus planifiée (terminée, supprimée, déplanifiée)
  for (const [taskId, ev] of Object.entries(events)) {
    const t = data.tasks.find((x) => x.id === taskId);
    if (!t || t.supprimee || t.etat === "terminee" || !t.date) {
      delete events[taskId];
      log.push({ at, action: "retire", taskId });
      retires++;
    }
  }
  // créations / mises à jour (la date réelle résolue au jour courant fait foi)
  for (const t of actives(data.tasks)) {
    if (t.etat === "terminee" || !t.date) continue;
    const iso = parseISO(t.date) ? t.date : null; // US26 — ISO réelle (garde, l'intégrité v9 la garantit)
    if (!iso) continue;
    const ev = events[t.id];
    if (!ev) { events[t.id] = { taskId: t.id, date: iso, syncedAt: at }; log.push({ at, action: "cree", taskId: t.id }); crees++; }
    else if (ev.date !== iso) { events[t.id] = { taskId: t.id, date: iso, syncedAt: at }; log.push({ at, action: "maj", taskId: t.id }); maj++; }
  }
  return { data: { ...data, agenda: { lastSync: at, events, log } }, resume: { crees, maj, retires, erreur: null } };
}

// US1 — état de synchronisation d'une tâche planifiée (pour l'écran et les badges)
function statutSyncTache(t: Task, agenda: AppData["agenda"], now = new Date()): "hors_agenda" | "nouveau" | "a_jour" | "a_sync" {
  if (!t.date || t.etat === "terminee" || t.supprimee) return "hors_agenda";
  const ev = agenda.events[t.id];
  const iso = parseISO(t.date) ? t.date : ""; // US26 — ISO réelle
  if (!ev) return "nouveau";
  return ev.date === iso ? "a_jour" : "a_sync";
}

// ==================== Données initiales (v9) ====================

function initialData(): AppData {
  const auj = new Date(); // dates ISO au jour réel (US26) — la démo se cale sur la date d'ouverture
  return {
    version: SCHEMA_VERSION,
    preferences: { capaciteJourOuvre: 6, capaciteWeekEnd: 3 }, // US20 — capacité par défaut
    account: null, // US14 — non connecté au démarrage (données locales)
    agenda: { lastSync: null, events: {}, log: [] }, // US1 — aucune synchronisation au démarrage
    goals: [
      { id: "g1", title: "Rénover le salon", p: 1, color: "#6366f1", echeance: "2026-12-15",
        specifique: "Salon repeint en entier, plinthes posées et luminaire remplacé", mesurable: "100 % des murs peints",
        realiste: true, motivation: "Recevoir pour les fêtes" },
      { id: "g2", title: "Préparer le marathon", p: 2, color: "#10b981", echeance: "2026-12-01",
        specifique: "Courir 42,2 km en moins de 4h", mesurable: "42,2 km en moins de 4h",
        realiste: true, motivation: "Boucler un marathon" },
      { id: "g3", title: "Apprendre l'espagnol", p: 3, color: "#f59e0b", echeance: "2027-06-30",
        specifique: "Tenir une conversation de 15 minutes", mesurable: "15 minutes de conversation tenue",
        realiste: false, motivation: "Voyager en Amérique du Sud" },
    ],
    tasks: [
      { id: "t1", title: "Choisir les peintures", goalId: "g1", prio: "haute", etat: "terminee", estimeInitial: 3, passe: 3, restant: 0, date: "2026-10-07", deps: [], dateFin: "2026-10-11", historiqueEtat: [{ etat: "planifiee", date: "2026-10-07" }, { etat: "terminee", date: "2026-10-11" }] },
      { id: "t2", title: "Demander 3 devis artisans", goalId: "g1", prio: "haute", etat: "planifiee", estimeInitial: 2, passe: 0, restant: 2, date: isoLocal(auj), deps: [], historiqueEtat: [{ etat: "planifiee", date: "2026-10-12" }] },
      { id: "t3", title: "Vider la pièce", goalId: "g1", prio: "moyenne", etat: "a_planifier", estimeInitial: 5, passe: 0, restant: 5, deps: [], historiqueEtat: [{ etat: "a_planifier", date: "2026-10-10" }] },
      { id: "t4", title: "Poncer les murs", goalId: "g1", prio: "moyenne", etat: "a_planifier", estimeInitial: 6, passe: 0, restant: 6, deps: ["t3"], historiqueEtat: [{ etat: "a_planifier", date: "2026-10-10" }] },
      { id: "t5", title: "Sortie longue 18 km", goalId: "g2", prio: "haute", etat: "planifiee", estimeInitial: 2, passe: 0, restant: 2, date: isoLocal(auj), deps: [], historiqueEtat: [{ etat: "planifiee", date: "2026-10-12" }] },
      { id: "t6", title: "Plan d'entraînement sem. 3", goalId: "g2", prio: "moyenne", etat: "en_cours", estimeInitial: 4, passe: 2.5, restant: 2, deps: [], historiqueEtat: [{ etat: "en_cours", date: "2026-10-09" }] },
      { id: "t7", title: "Acheter chaussures", goalId: "g2", prio: "basse", etat: "a_planifier", estimeInitial: 1, passe: 0, restant: 1, deps: [], historiqueEtat: [{ etat: "a_planifier", date: "2026-10-10" }] },
      { id: "t8", title: "Leçon 2 : conjugaison", goalId: "g3", prio: "moyenne", etat: "planifiee", estimeInitial: 2, passe: 0, restant: 2, date: isoDuLendemain(auj), deps: ["t9"], historiqueEtat: [{ etat: "planifiee", date: "2026-10-12" }] },
      { id: "t9", title: "Réserver cours du soir", goalId: "g3", prio: "basse", etat: "a_planifier", estimeInitial: 1, passe: 0, restant: 1, deps: [], historiqueEtat: [{ etat: "a_planifier", date: "2026-10-10" }] },
    ],
    entries: [
      { id: "e1", taskId: "t1", date: "2026-10-08", hours: 2 },
      { id: "e2", taskId: "t6", date: "2026-10-09", hours: 1.5 },
      { id: "e3", taskId: "t1", date: "2026-10-11", hours: 1 },
      { id: "e4", taskId: "t6", date: "2026-10-12", hours: 1 },
    ],
    migrationLog: [],
  };
}

// ==================== UI : constantes ====================

const prioBadge: Record<Prio, string> = {
  haute: "bg-red-100 text-red-700",
  moyenne: "bg-amber-100 text-amber-700",
  basse: "bg-slate-100 text-slate-600",
};
const etatLabel: Record<Etat, string> = {
  a_planifier: "À planifier", planifiee: "Planifiée", en_cours: "En cours", terminee: "Terminée",
};
const etatBadge: Record<Etat, string> = {
  a_planifier: "bg-slate-100 text-slate-500", planifiee: "bg-indigo-100 text-indigo-700",
  en_cours: "bg-sky-100 text-sky-700", terminee: "bg-emerald-100 text-emerald-700",
};
// Passe 3 — journal des changements d'état : formats d'affichage (jj/mm court, historique complet)
const fmtJour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
const historiqueEtatsLabel = (t: Task) => (t.historiqueEtat ?? []).map((e) => `${etatLabel[e.etat]} (${fmtJour(e.date)})`).join(" → ");
const velLabel: Record<string, string> = {
  aucune: "estimation dès la prochaine saisie",
  extrapolee: "extrapolée depuis le 2ᵉ jour de saisie",
  hebdo: "moyenne des semaines écoulées",
  glissante: "moyenne des 3 dernières semaines",
};
function h(n: number): string { // US33 — durée lisible « 2 h 30 » / « 45 min », arrondi à 5 min près ; le stockage et les calculs restent décimaux (aucune migration)
  const min = Math.round((n * 60) / 5) * 5;
  if (min <= 0) return "0 min";
  if (min < 60) return min + " min";
  const hh = Math.floor(min / 60), mm = min % 60;
  return hh + " h" + (mm ? " " + mm : "");
}

// ==================== Écran : Accueil ====================

function Accueil({ data, vel, goRituel, goObjectif, goObjectifs, ouvrirFiche }: { data: AppData; vel: ReturnType<typeof computeVelocity>; goRituel: () => void; goObjectif: (id: string) => void; goObjectifs: () => void; ouvrirFiche: (id: string) => void }) {
  const [bienvenueMasquee, setBienvenueMasquee] = useState(false); // US33 — carte Bienvenue masquable manuellement (session)
  const auj = isoDuJour(); // US26 — ISO du jour réel (plus de libellé « aujourd'hui »)
  const today = data.tasks.filter((t) => t.date === auj && t.etat !== "terminee" && !t.supprimee);
  const prevu = today.reduce((s, t) => s + t.restant, 0);
  const cap = capaciteJour(new Date(), data.preferences); // US20 — capacité du jour selon les préférences
  const chargePct = cap > 0 ? Math.min(100, Math.round((prevu / cap) * 100)) : 0;
  const salut = new Date().getHours() >= 18 ? "Bonsoir Mathieu 🌙" : new Date().getHours() < 6 ? "Bonne nuit Mathieu 🌜" : "Bonjour Mathieu 👋";
  const jourLong = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }); // date du jour réelle (usage multi-jours)
  const risques = data.goals
    .filter((g) => !g.archive)
    .map((g) => ({ g, check: smartCheck(g, data.tasks, vel.velocite) }))
    .filter((x) => x.check.risque);
  const aucunObjectif = data.goals.filter((g) => !g.archive).length === 0; // US33 — première utilisation : espace sans objectif actif
  return (
    <div className="md:grid md:grid-cols-2 md:gap-4 md:items-start">
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="text-xs text-slate-500">{jourLong.charAt(0).toUpperCase() + jourLong.slice(1)}</div>
            <div className="font-bold text-lg">{salut}</div>
          </div>
          <Button size="sm" variant="outline" onClick={goRituel}>Revue du matin</Button>
        </div>
        {aucunObjectif && !bienvenueMasquee && ( // US33-c3 — carte « Bienvenue » : espace sans objectif, masquable, disparaît dès qu'un objectif existe
          <Card className="p-3 mb-3 bg-gradient-to-r from-violet-50 to-indigo-50 border-violet-200">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">👋 Bienvenue dans Objectifs</div>
                <div className="text-xs text-slate-600 mt-1">3 étapes pour démarrer :</div>
                <ol className="text-xs text-slate-600 mt-1 list-decimal list-inside">
                  <li>Crée ton premier objectif SMART</li>
                  <li>Ajoute des tâches avec leur charge estimée</li>
                  <li>Le soir, fais le rituel de bilan (21 h)</li>
                </ol>
                <Button size="sm" className="mt-2 min-h-[44px]" onClick={goObjectifs}>＋ Créer mon premier objectif</Button>
              </div>
              <button onClick={() => setBienvenueMasquee(true)} className="w-11 h-11 -mr-2 rounded-full hover:bg-white/70 text-slate-500 text-lg shrink-0" aria-label="masquer la carte Bienvenue" title="Masquer la carte (cette session)">✕</button>
            </div>
          </Card>
        )}
        <Card className="p-3 mb-3 bg-indigo-50 border-indigo-100">
          <div className="text-sm font-semibold mb-1">Programme du jour</div>
          <div className="text-xs text-slate-600 mb-1">
            {today.length} tâche(s) prévue(s) · <b>{h(prevu)}</b> sur <b>{h(cap)}</b> de capacité
            {prevu > cap ? " ⚠ surcharge" : ""}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Progress value={chargePct} />
            <span className="text-[11px] text-slate-500 w-8 text-right">{chargePct}%</span>
          </div>
          {today.length === 0 && (
            <div className="text-xs text-slate-500 py-1">
              Aucune tâche planifiée aujourd'hui — planifie ta journée depuis l'écran Tâches, ou laisse le rituel du soir te suggérer des actions.
              <div className="mt-1"><Button size="sm" variant="outline" className="min-h-[44px]" onClick={goRituel}>🌙 Lancer le rituel du soir</Button></div>
            </div>
          )}
          {today.map((t) => {
            const g = data.goals.find((x) => x.id === t.goalId)!;
            return (
              <div key={t.id} role="button" tabIndex={0} onClick={() => ouvrirFiche(t.id)} // US31/P5 — la rangée du jour ouvre la fiche d'édition
                className="flex items-center gap-2 py-2 border-b border-indigo-100 last:border-0 cursor-pointer rounded px-1 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                aria-label={"ouvrir la fiche de la tâche « " + t.title + " »"} title="Ouvrir la fiche de la tâche (édition complète)">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g.color }} />
                <div className="flex-1 text-sm">{t.title}</div>
                <Badge className={prioBadge[t.prio]}>{t.prio}</Badge>
                <span className="text-xs text-slate-500 w-10 text-right">{h(t.restant)}</span>
              </div>
            );
          })}
        </Card>
        {risques.length > 0 ? (
          risques.map(({ g, check }) => {
            const fin = estimeFinObjectif(g, data.tasks, vel.velocite); // US19 — chaînes de dépendances incluses
            return (
              <Card key={g.id} className="p-3 border-amber-200 bg-amber-50 mb-3">
                <div className="text-sm font-semibold text-amber-800">⚠ Objectif à risque</div>
                <div className="text-xs text-amber-700 mt-1">
                  <b>{g.title}</b> : date de fin estimée <b>{fin ? fmtDate(fin) : "—"}</b>, après l'échéance cible du <b>{fmtIso(g.echeance)}</b> (vélocité {vel.velocite} h/sem).
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="p-3 border-emerald-200 bg-emerald-50 mb-3 text-xs text-emerald-700">Aucun objectif à risque 🎉</Card>
        )}
      </div>
      <Card className="p-3">
        <div className="text-sm font-semibold mb-2">Temps restant par objectif (US6)</div>
        {data.goals.filter((g) => !g.archive).sort((a, b) => a.p - b.p).map((g) => {
          const ts = data.tasks.filter((t) => t.goalId === g.id && t.etat !== "terminee" && !t.supprimee);
          const rest = ts.reduce((s, t) => s + t.restant, 0);
          const fin = estimeFinObjectif(g, data.tasks, vel.velocite);
          return (
            <div key={g.id} role="button" tabIndex={0} onClick={() => goObjectif(g.id)}
              className="flex items-center gap-2 py-1.5 text-sm cursor-pointer rounded px-1 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: g.color }} />
              <span className="flex-1">{g.title}</span>
              <span className="text-slate-500 text-xs">{ts.length} tâches</span>
              <span className="text-xs text-slate-500 w-14 text-right">{fin ? "→ " + fmtDate(fin) : "—"}</span>
              <b className="text-xs w-14 text-right">{h(rest)}</b>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ==================== Écran : Objectifs (liste / création / détail — US13) ====================

type GoalView = { mode: "list" } | { mode: "create" } | { mode: "detail"; id: string };

function SmartChecklist({ score, manquants, compact }: { score: number; manquants: string[]; compact?: boolean }) {
  return (
    <div className={"flex flex-wrap gap-1 items-center " + (compact ? "text-xs" : "text-sm")}>
      <Badge className={score === 5 ? "bg-emerald-100 text-emerald-700" : score >= 3 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}>
        SMART {score}/5
      </Badge>
      {manquants.map((m) => <Badge key={m} className="bg-red-50 text-red-600 border border-red-200">{m}</Badge>)}
      {score < 5 && <span className="text-xs text-slate-500">brouillon enregistrable</span>}
    </div>
  );
}

function Objectifs({ data, setData, vel, openGoalId, ouvrirFiche }: { data: AppData; setData: (d: AppData) => void; vel: ReturnType<typeof computeVelocity>; openGoalId?: string | null; ouvrirFiche: (id: string) => void }) {
  const [view, setView] = useState<GoalView>({ mode: "list" });
  const [showArchives, setShowArchives] = useState(false);

  useEffect(() => { if (openGoalId) setView({ mode: "detail", id: openGoalId }); }, [openGoalId]); // usage réel — clic sur un objectif depuis l'accueil

  if (view.mode === "create") return <GoalCreate data={data} setData={setData} vel={vel} back={() => setView({ mode: "list" })} onCreated={(id) => setView({ mode: "detail", id })} />;
  if (view.mode === "detail") return <GoalDetail data={data} setData={setData} vel={vel} id={view.id} back={() => setView({ mode: "list" })} ouvrirFiche={ouvrirFiche} />;

  const actifs = data.goals.filter((g) => !g.archive).sort((a, b) => a.p - b.p);
  const archives = data.goals.filter((g) => g.archive);
  return (
    <div>
      {actifs.length === 0 && ( // US33-c2 — état vide guidé : phrase + action directe (le bouton de création suit immédiatement)
        <Card className="p-3 mb-3 bg-indigo-50 border-indigo-100">
          <div className="text-sm font-semibold">Aucun objectif pour l'instant</div>
          <div className="text-xs text-slate-600 mt-1">Crée ton premier objectif SMART — le bouton juste en dessous t'attend.</div>
        </Card>
      )}
      {actifs.map((g) => {
        const ts = data.tasks.filter((t) => t.goalId === g.id && !t.supprimee);
        const total = ts.reduce((s, t) => s + t.estimeInitial, 0);
        const done = ts.filter((t) => t.etat === "terminee").reduce((s, t) => s + t.estimeInitial, 0);
        const pct = total ? Math.round((done / total) * 100) : 0;
        const check = smartCheck(g, ts, vel.velocite);
        return (
          <Card key={g.id} className="p-4 mb-3 cursor-pointer hover:border-indigo-300" onClick={() => setView({ mode: "detail", id: g.id })}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: g.color }} />
                <span className="font-semibold">{g.title}</span>
                <Badge className="bg-purple-100 text-purple-700">P{g.p}</Badge>
              </div>
              <Badge variant="secondary">{pct}%</Badge>
            </div>
            <Progress value={pct} />
            <div className="mt-2"><SmartChecklist score={check.score} manquants={check.manquants} compact /></div>
          </Card>
        );
      })}
      <button onClick={() => setView({ mode: "create" })} className="w-full mb-3 py-3 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-indigo-600 to-violet-600 shadow-md hover:from-indigo-500 hover:to-violet-500 flex items-center justify-center gap-2" title="Créer un nouvel objectif (US13)">＋ Créer un objectif</button>
      {archives.length > 0 && (
        <Card className="p-3 mb-3">
          <button className="text-sm font-semibold text-slate-500" onClick={() => setShowArchives(!showArchives)}>
            📦 {archives.length} objectif(s) archivé(s) {showArchives ? "▾" : "▸"}
          </button>
          {showArchives && archives.map((g) => (
            <div key={g.id} className="flex items-center gap-2 py-1.5 text-sm text-slate-500">
              <span className="flex-1">{g.title}</span>
              <Button size="sm" variant="outline" className="text-xs h-6" onClick={() => setData({ ...data, goals: data.goals.map((x) => x.id === g.id ? { ...x, archive: false } : x) })}>Réactiver</Button>
            </div>
          ))}
        </Card>
      )}
      <Card className="p-3">
        <div className="text-sm font-semibold mb-2">Journal des migrations (US16)</div>
        {data.migrationLog.length === 0 && <div className="text-xs text-slate-500">Aucune migration appliquée sur ces données.</div>}
        {data.migrationLog.map((l, i) => (
          <div key={i} className="text-xs text-slate-600 py-0.5">v{l.from} → v{l.to} · {l.name} · {l.date}</div>
        ))}
        <div className="text-xs text-slate-500 mt-1">App v{APP_VERSION} · schéma v{SCHEMA_VERSION}</div>
      </Card>
    </div>
  );
}

function GoalCreate({ data, setData, vel, back, onCreated }: { data: AppData; setData: (d: AppData) => void; vel: ReturnType<typeof computeVelocity>; back: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [p, setP] = useState<1 | 2 | 3 | 4>(2);
  const [echeance, setEcheance] = useState(""); // US26 — ISO via calendrier
  const [specifique, setSpecifique] = useState("");
  const [mesurable, setMesurable] = useState(""); // US25 — M en texte libre unique
  const [realiste, setRealiste] = useState(false);
  const [motivation, setMotivation] = useState("");
  // Itération 8 / US24 — tâches liées stagées avant validation : créées avec l'objectif en un seul setData
  const [staged, setStaged] = useState<{ title: string; prio: Prio; estime: number; date?: string }[]>([]);
  const [sTitle, setSTitle] = useState("");
  const [sPrio, setSPrio] = useState<Prio>("moyenne");
  const [sEstime, setSEstime] = useState("2");
  const [sDate, setSDate] = useState("");
  const [sErr, setSErr] = useState<string | null>(null);

  const draft: Goal = {
    id: "draft", title, p, color: "#0ea5e9", echeance,
    specifique, mesurable: mesurable.trim() || undefined, // US25 — texte tel quel
    realiste, motivation,
  };
  const check = smartCheck(draft, [], vel.velocite);

  // US24 + US28 — contrôles du formulaire rapide : titre et charge > 0 obligatoires, date ISO valide (US26)
  const ajouterStaged = () => {
    const estime = parseFloat(sEstime);
    if (!sTitle.trim()) { setSErr("titre obligatoire"); return; } // US24-c3 — refus sans impact sur l'objectif ni les autres tâches
    if (isNaN(estime) || estime <= 0) { setSErr("charge estimée obligatoire (> 0 h) — elle n'est plus remplacée automatiquement"); return; }
    if (sDate && !parseISO(sDate)) { setSErr("date planifiée invalide : choisissez une date dans le calendrier"); return; }
    setStaged([...staged, { title: sTitle.trim(), prio: sPrio, estime, date: sDate || undefined }]);
    setSTitle(""); setSEstime("2"); setSDate(""); setSErr(null);
  };

  const creer = () => {
    if (!title.trim()) return;
    // US24 — l'objectif et ses tâches stagées sont persistés ensemble (un seul setData, un seul lot au journal)
    const g: Goal = { ...draft, id: "g" + Date.now() };
    let d: AppData = { ...data, goals: [...data.goals, g] };
    for (const s of staged) d = createTask(d, { ...s, goalId: g.id }).data; // liées dès la création, contrôlées US28
    setData(d);
    onCreated(g.id); // A8 — ajout immédiat de tâches depuis le détail
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Button size="sm" variant="outline" onClick={back}>← Retour</Button>
        <div className="font-semibold">Nouvel objectif (US13)</div>
      </div>
      <Card className="p-3 mb-3">
        <div className="text-xs text-slate-500 mb-2">Titre * · priorité · échéance cible (calendrier) *</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="col-span-2 space-y-1">
            <label htmlFor="gc-titre" className="text-xs font-semibold text-slate-600">Titre <span className="text-red-500" aria-hidden>*</span></label>
            <Input id="gc-titre" placeholder="ex. : repeindre le salon" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="gc-prio" className="text-xs font-semibold text-slate-600">Priorité</label>
            <Select value={String(p)} onValueChange={(v) => setP(parseInt(v) as 1 | 2 | 3 | 4)}>
              <SelectTrigger id="gc-prio" className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">P1</SelectItem><SelectItem value="2">P2</SelectItem>
                <SelectItem value="3">P3</SelectItem><SelectItem value="4">P4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="gc-echeance" className="text-xs font-semibold text-slate-600">Échéance cible <span className="text-red-500" aria-hidden>*</span></label>
            <Input id="gc-echeance" type="date" title="Échéance cible" value={echeance} onChange={(e) => setEcheance(e.target.value)} /> {/* US26 — calendrier natif, stockage ISO */}
          </div>
        </div>
      </Card>
      <Card className="p-3 mb-3">
        <div className="text-sm font-semibold mb-2">Attributs SMART (US12)</div>
        <label className="text-xs text-slate-500">S — Spécifique : formulation explicite du résultat (≥ 10 caractères)</label>
        <Input className="mb-2 mt-1" placeholder="Ex. Salon repeint en entier, plinthes posées" value={specifique} onChange={(e) => setSpecifique(e.target.value)} />
        <label className="text-xs text-slate-500">M — Mesurable : texte libre (ex. « 100 % des murs peints »)</label>
        <Input className="mb-2 mt-1" placeholder="Ex. 100 % des murs peints · 42,2 km en moins de 4h…" value={mesurable} onChange={(e) => setMesurable(e.target.value)} /> {/* US25 — un seul champ texte */}
        <label className="text-xs text-slate-500">R — Motivation</label>
        <Input className="mb-2 mt-1" placeholder="Pourquoi cet objectif ?" value={motivation} onChange={(e) => setMotivation(e.target.value)} />
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={realiste} onChange={(e) => setRealiste(e.target.checked)} className="accent-indigo-600" />
          R — Objectif réaliste au vu de mon rythme réel
        </label>
      </Card>
      <Card className="p-3 mb-3">
        <div className="text-sm font-semibold mb-2">Contrôleur SMART (temps réel)</div>
        <SmartChecklist score={check.score} manquants={check.manquants} />
      </Card>
      {/* Itération 8 / US24 — formulaire rapide de tâches liées à l'objectif en création */}
      <Card className="p-3 mb-3">
        <div className="text-sm font-semibold mb-2">Tâches liées (US24){staged.length > 0 ? " — " + staged.length + " tâche(s) créée(s) avec l'objectif" : ""}</div>
        {staged.length > 0 && (
          <div className="mb-2 space-y-1">
            {staged.map((s, i) => (
              <div key={i} className="flex items-center gap-2 py-1 px-2 bg-indigo-50 rounded text-xs">
                <span className="flex-1 truncate">{s.title}</span>
                <Badge className={prioBadge[s.prio]}>{s.prio}</Badge>
                <span className="text-slate-500">{h(s.estime)}</span> {/* US33 — durée lisible */}
                <span className="text-slate-500 w-14 text-right">{s.date ? fmtIso(s.date) : "—"}</span>
                <button className="text-red-500 underline" aria-label={"Retirer la tâche « " + s.title + " »"} onClick={() => setStaged(staged.filter((_, j) => j !== i))}>retirer</button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Input className="md:col-span-2" placeholder="Nouvelle tâche liée *" value={sTitle} onChange={(e) => setSTitle(e.target.value)} />
          <Select value={sPrio} onValueChange={(v) => setSPrio(v as Prio)}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="haute">Haute</SelectItem><SelectItem value="moyenne">Moy.</SelectItem><SelectItem value="basse">Basse</SelectItem>
            </SelectContent>
          </Select>
          <Input className="text-center" type="number" min="0" step="0.5" title="Charge estimée (h)" value={sEstime} onChange={(e) => setSEstime(e.target.value)} />
          <Input type="date" title="Date planifiée (optionnelle)" value={sDate} onChange={(e) => setSDate(e.target.value)} />
        </div>
        <div className="flex items-center justify-between mt-2">
          <Button size="sm" variant="outline" onClick={ajouterStaged} disabled={!sTitle.trim()}>+ Ajouter au brouillon</Button>
          {sErr && <span className="text-xs text-red-600">{sErr}</span>}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">Chaque tâche est liée à l'objectif dès sa création : « à planifier » sans date, « planifiée » avec date (US28).</div>
      </Card>
      <div className="flex gap-2">
        <Button size="sm" onClick={creer} disabled={!title.trim()}>Créer l'objectif{staged.length > 0 ? " + " + staged.length + " tâche(s)" : ""}</Button>
        <Button size="sm" variant="outline" onClick={back}>Annuler</Button>
      </div>
      <p className="text-xs text-slate-500 mt-2">Un objectif non conforme reste enregistrable en brouillon (badge x/5 dans la liste).</p>
    </div>
  );
}

function GoalDetail({ data, setData, vel, id, back, ouvrirFiche }: { data: AppData; setData: (d: AppData) => void; vel: ReturnType<typeof computeVelocity>; id: string; back: () => void; ouvrirFiche: (id: string) => void }) {
  const g = data.goals.find((x) => x.id === id);
  const [confirmSuppr, setConfirmSuppr] = useState(false);
  const [fTitle, setFTitle] = useState("");
  const [fPrio, setFPrio] = useState<Prio>("moyenne");
  const [fEstime, setFEstime] = useState("2");
  const [fDate, setFDate] = useState("");
  const [finId, setFinId] = useState<string | null>(null); // Passe 2 — clôture : temps passé total ajusté obligatoire
  const [finTotal, setFinTotal] = useState("");
  const [err, setErr] = useState<string | null>(null);
  // Édition en place des attributs SMART
  const [edit, setEdit] = useState(false);
  const [eSpec, setESpec] = useState("");
  const [eMes, setEMes] = useState(""); // US25 — M en texte libre unique
  const [eEch, setEEch] = useState("");

  if (!g) return <div className="text-sm text-slate-500">Objectif introuvable. <button className="underline" onClick={back}>Retour</button></div>;

  const ts = data.tasks.filter((t) => t.goalId === g.id && !t.supprimee);
  const check = smartCheck(g, ts, vel.velocite);
  const total = ts.reduce((s, t) => s + t.estimeInitial, 0); // A2 — charge totale
  const passe = ts.reduce((s, t) => s + t.passe, 0); // A2 — temps passé
  const done = ts.filter((t) => t.etat === "terminee").reduce((s, t) => s + t.estimeInitial, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const fin = estimeFinObjectif(g, data.tasks, vel.velocite);

  const majGoal = (patch: Partial<Goal>) => setData({ ...data, goals: data.goals.map((x) => x.id === g.id ? { ...x, ...patch } : x) });

  const addTask = () => {
    try {
      const res = createTask(data, { title: fTitle, goalId: g.id, prio: fPrio, estime: parseFloat(fEstime), date: fDate.trim() || undefined }); // US28 — charge contrôlée dans createTask (fin du repli silencieux à 1 h)
      setData(res.data); setFTitle(""); setFEstime("2"); setFDate(""); setErr(null);
    } catch (e: any) { tracer("erreur", "Exception attrapée : " + e.message, undefined, true); setErr(e.message); }
  };

  // Itération 9 / US32 — la saisie rapide migre dans la fiche US27 (bouton ✏️ de la rangée)

  // Passe 2 — clôture : la complétion exige le temps passé total ajusté (obligatoire, annulable sans complétion)
  const proposerCloture = (t: Task) => {
    const bloq = bloqueursDe(t, data.tasks); // A9/US19 — une tâche bloquée ne peut pas être complétée depuis le détail
    if (bloq.length > 0) { setErr(`« ${t.title} » bloquée par : ${bloq.map((b) => b.title).join(", ")}`); return; }
    setFinId(t.id); setFinTotal(String(Math.round((t.passe + t.restant) * 10) / 10)); setErr(null); // suggestion = estimation courante
  };
  const validerCloture = () => {
    const t = data.tasks.find((x) => x.id === finId);
    if (!t) return;
    try {
      const { task, entry } = cloturerTache(t, parseFloat(finTotal));
      setData({ ...data, tasks: data.tasks.map((x) => (x.id === t.id ? task : x)), entries: entry ? [...data.entries, entry] : data.entries });
      setFinId(null); setErr(null);
    } catch (e: any) { tracer("erreur", "Exception attrapée : " + e.message, undefined, true); setErr(e.message); }
  };

  const validerSmart = () => {
    majGoal({
      specifique: eSpec, mesurable: eMes.trim() || undefined, // US25 — texte libre
      echeance: eEch,
    });
    setEdit(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Button size="sm" variant="outline" onClick={back}>← Retour</Button>
        <div className="flex gap-1 items-center">
          {/* A7 — priorité P1–P4 modifiable depuis le détail (cycle) */}
          <button onClick={() => majGoal({ p: ((g.p % 4) + 1) as 1 | 2 | 3 | 4 })} className="px-2 py-0.5 rounded text-xs font-medium min-w-[44px] bg-purple-100 text-purple-700 hover:bg-purple-200" title="Changer la priorité de l'objectif (P1 → P2 → P3 → P4)">P{g.p}</button>
          {check.risque && <Badge className="bg-amber-100 text-amber-800">⚠ à risque</Badge>}
          {g.archive && <Badge className="bg-slate-100 text-slate-500">archivé</Badge>}
        </div>
      </div>
      <Card className="p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: g.color }} />
          {/* A7 — titre modifiable en place */}
          <Input className="font-semibold h-8 border-transparent bg-transparent focus-visible:ring-1 focus-visible:ring-indigo-300" value={g.title} aria-label="Titre de l'objectif" onChange={(e) => majGoal({ title: e.target.value })} />
        </div>
        <Progress value={pct} />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3 text-xs text-slate-600">
          <div><div className="text-slate-500">Restant (US6)</div><b>{h(check.restant)}</b></div>
          <div><div className="text-slate-500">Charge totale (A2)</div><b>{h(total)}</b></div>
          <div><div className="text-slate-500">Temps passé (A2)</div><b>{h(passe)}</b></div>
          <div><div className="text-slate-500">Fin estimée (US7)</div><b>{fin ? fmtDate(fin) : velLabel[vel.statut]}</b></div>
          <div><div className="text-slate-500">Échéance cible</div><b>{fmtIso(g.echeance)}</b></div>
        </div>
        {/* US19 — dépendances héritées des tâches de cet objectif */}
        {depsHeritees(g, data.tasks).length > 0 && (
          <div className="text-xs text-slate-600 mt-2">🔗 Dépendances héritées :
            {depsHeritees(g, data.tasks).map((x) => {
              const pg = data.goals.find((y) => y.id === x.goalId);
              return <Badge key={x.goalId} className="bg-orange-50 text-orange-700 border border-orange-200 mr-1">{pg ? pg.title : x.goalId} · {x.liens} lien(s) · {x.taches.map((id) => data.tasks.find((y) => y.id === id)?.title ?? id).join(", ")}</Badge>; // A10 — tâches concernées affichées
            })}
          </div>
        )}
      </Card>

      <Card className="p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">SMART (US12)</div>
          {!edit ? (
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setESpec(g.specifique ?? ""); setEMes(g.mesurable ?? ""); setEEch(g.echeance); setEdit(true); }}>Modifier</Button>
          ) : (
            <Button size="sm" className="text-xs h-7" onClick={validerSmart}>Enregistrer</Button>
          )}
        </div>
        {!edit ? (
          <>
            <SmartChecklist score={check.score} manquants={check.manquants} />
            <div className="text-xs text-slate-600 mt-2 space-y-1">
              <div><b>S :</b> {g.specifique || "—"}</div>
              <div><b>M :</b> {g.mesurable ?? "—"}</div>
              <div><b>A :</b> {vel.velocite !== null ? "atteignable au vu de la vélocité réelle (" + h(vel.velocite) + "/sem)" : "vélocité non encore mesurée — A indéterminé"} · restant {h(check.restant)}</div>
              <div><b>R :</b> {g.realiste ? "confirmé réaliste" : "non confirmé"}{g.motivation ? ` — ${g.motivation}` : ""}</div>
              <div><b>T :</b> échéance {fmtIso(g.echeance)}{check.risque ? " — fin estimée après l'échéance ⚠" : ""}</div>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Input placeholder="Spécifique" value={eSpec} onChange={(e) => setESpec(e.target.value)} />
            <Input placeholder="Mesurable (texte libre — ex. 100 % des murs peints)" value={eMes} onChange={(e) => setEMes(e.target.value)} /> {/* US25 */}
            <Input type="date" title="Échéance cible" value={eEch} onChange={(e) => setEEch(e.target.value)} /> {/* US26 — calendrier */}
          </div>
        )}
      </Card>

      <Card className="p-3 mb-3">
        <div className="text-sm font-semibold mb-2">Tâches liées ({ts.length})</div>
        {sortBacklog(ts.filter((t) => t.etat !== "terminee"), [g]).map((t) => (
          <div key={t.id}>
            <div className="flex items-center gap-2 py-2 border-b border-slate-100">
              <button onClick={() => proposerCloture(t)} className="w-11 h-11 rounded-full border-2 border-slate-300 shrink-0" aria-label="terminer (saisie du temps passé obligatoire)" title="Terminer — saisie du temps passé total ajusté obligatoire" /> {/* US32 — cible 44 px (dérogation levée) */}
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm">{t.title}</div>
                <div className="text-xs text-slate-500">restant {h(t.restant)} · passé {h(t.passe)}{t.date ? ` · ${fmtIso(t.date)}` : ""}{bloqueursDe(t, data.tasks).length > 0 ? " · 🔒 bloquée" : ""}{vel.velocite !== null && (t.deps ?? []).length > 0 ? ` · fin est. ${fmtDate(estimeFinTache(t, data.tasks, vel.velocite)!)}` : ""}</div>
              </div>
              <button onClick={() => setData({ ...data, tasks: data.tasks.map((x) => x.id === t.id ? { ...x, prio: ({ haute: "moyenne", moyenne: "basse", basse: "haute" } as const)[x.prio] } : x) })} className={"px-2 py-0.5 rounded text-xs font-medium min-w-[44px] " + prioBadge[t.prio]}>{t.prio}</button>
              <Badge className={etatBadge[t.etat]}>{etatLabel[t.etat]}</Badge>
              <button onClick={() => ouvrirFiche(t.id)} className="w-11 h-11 rounded-lg text-base shrink-0 hover:bg-slate-100" title="Fiche de la tâche — édition complète (US27)" aria-label={"ouvrir la fiche de la tâche « " + t.title + " »"}>✏️</button> {/* US32 — saisie de temps déplacée dans la fiche (US27, plus récente, arbitre) */}
            </div>
            {finId === t.id && (
              <div className="flex flex-wrap items-center gap-2 py-2 px-6 bg-emerald-50 rounded mb-2 text-sm">
                <span className="text-xs text-emerald-700 w-full">Clôture de « {t.title} » — temps passé TOTAL ajusté obligatoire (déjà logué : {h(t.passe)})</span>
                <label className="text-xs">Total passé<input className="w-20 ml-1 border rounded px-1 text-xs py-0.5" type="number" min="0" step="0.5" value={finTotal} onChange={(e) => setFinTotal(e.target.value)} /></label>
                <Button size="sm" onClick={validerCloture}>✓ Terminer</Button>
                <Button size="sm" variant="outline" onClick={() => setFinId(null)}>Annuler</Button>
              </div>
            )}
          </div>
        ))}
        {ts.filter((t) => t.etat === "terminee").length > 0 && (
          <div className="mt-2 text-xs text-slate-500">
            ✔ {ts.filter((t) => t.etat === "terminee").length} tâche(s) terminée(s)
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
          <Input className="md:col-span-2" placeholder="Nouvelle tâche *" value={fTitle} onChange={(e) => setFTitle(e.target.value)} />
          <Select value={fPrio} onValueChange={(v) => setFPrio(v as Prio)}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="haute">Haute</SelectItem><SelectItem value="moyenne">Moy.</SelectItem><SelectItem value="basse">Basse</SelectItem>
            </SelectContent>
          </Select>
          <Input className="text-center" type="number" min="0" step="0.5" title="Charge estimée (h)" value={fEstime} onChange={(e) => setFEstime(e.target.value)} />
          <Input className="text-center" type="date" title="Date planifiée (optionnelle)" value={fDate} onChange={(e) => setFDate(e.target.value)} />
        </div>
        <div className="flex items-center justify-between mt-2">
          <Button size="sm" onClick={addTask} disabled={!fTitle.trim()}>Ajouter</Button>
          {err && <span role="alert" className="text-xs text-red-600">{err}</span>}
        </div>
      </Card>

      <Card className="p-3 mb-3">
        <div className="text-sm font-semibold mb-2">Avancement — burndown (US9, données réelles)</div>
        <Burndown tasks={ts} entries={data.entries} g={g} />
      </Card>

      <Card className="p-3">
        <div className="text-sm font-semibold mb-2">Supprimer l'objectif (A4)</div>
        {!confirmSuppr ? (
          <Button size="sm" variant="destructive" onClick={() => setConfirmSuppr(true)}>Supprimer…</Button>
        ) : (
          <div className="text-xs space-y-2">
            <div className="text-slate-600">Que faire des tâches et de l'historique de temps passé ?</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => { setData(supprimerObjectif(data, g.id, "archiver")); back(); }}>Archiver (conserver les tâches)</Button>
              <Button size="sm" variant="destructive" onClick={() => { setData(supprimerObjectif(data, g.id, "supprimer")); back(); }}>Supprimer l'objectif et ses tâches</Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmSuppr(false)}>Annuler</Button>
            </div>
            <div className="text-slate-500">Dans tous les cas, l'historique des saisies de temps est conservé.</div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Burndown({ tasks, entries, g }: { tasks: Task[]; entries: TimeEntry[]; g: Goal }) {
  const data = useMemo(() => {
    const total = tasks.reduce((s, t) => s + t.estimeInitial, 0);
    if (total === 0) return [];
    const es = entries.filter((e) => tasks.some((t) => t.id === e.taskId) && e.hours > 0);
    if (es.length === 0) return [{ jour: "auj.", "Réelle": total, "Théorique": total }];
    const byDay = new Map<string, number>();
    for (const e of es) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.hours);
    const days = [...byDay.keys()].sort();
    const echeance = parseISO(g.echeance) ?? new Date(); // US26 — ISO réelle
    const start = new Date(days[0]);
    const totalDays = Math.max(1, Math.round((echeance.getTime() - start.getTime()) / 864e5));
    let cumul = 0;
    const rows: { jour: string; "Réelle": number; "Théorique": number }[] = [];
    days.forEach((d) => {
      cumul += byDay.get(d)!;
      const elapsed = Math.min(Math.max(0, Math.round((new Date(d).getTime() - start.getTime()) / 864e5)), totalDays);
      rows.push({
        jour: new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
        "Réelle": Math.round((total - cumul) * 10) / 10,
        "Théorique": Math.round(total * (1 - elapsed / totalDays) * 10) / 10, // US9 — décroissance idéale jusqu'à l'échéance
      });
    });
    // point final à l'échéance : théorique = 0, réelle = restant constaté
    rows.push({ jour: echeance.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), "Réelle": Math.round((total - cumul) * 10) / 10, "Théorique": 0 });
    return rows.length ? rows : [{ jour: "auj.", "Réelle": total, "Théorique": total }];
  }, [tasks, entries, g]);
  if (data.length === 0) return <div className="text-xs text-slate-500">Aucune charge estimée.</div>;
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="jour" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="Théorique" stroke="#cbd5e1" strokeDasharray="5 3" dot={false} />
          <Line type="monotone" dataKey="Réelle" stroke="#6366f1" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ==================== Écran : Tâches (US1/US3/US4/US5 + A6) ====================

function Taches({ data, setData, vel, ouvrirFiche }: { data: AppData; setData: (d: AppData) => void; vel: ReturnType<typeof computeVelocity>; ouvrirFiche: (id: string) => void }) {
  const [filter, setFilter] = useState("all");
  const [goalFilter, setGoalFilter] = useState("all");
  const [fTitle, setFTitle] = useState("");
  const [fGoal, setFGoal] = useState("g1");
  const [fPrio, setFPrio] = useState<Prio>("moyenne");
  const [fEstime, setFEstime] = useState("2");
  const [fDate, setFDate] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [finId, setFinId] = useState<string | null>(null); // Passe 2 — clôture : temps passé total ajusté obligatoire
  const [finTotal, setFinTotal] = useState("");
  const [planifId, setPlanifId] = useState<string | null>(null); // Itération 7 / US29 — planification : date exigée, saisie en place
  const [planifDate, setPlanifDate] = useState(() => isoDuLendemain()); // US26 — ISO via calendrier (demain par défaut)
  const [planifPasse, setPlanifPasse] = useState(false); // US26-c2 — avertissement explicite avant de planifier une date passée
  const [reopenId, setReopenId] = useState<string | null>(null); // Itération 7 / US29 — ré-ouverture : confirmation explicite

  const list = useMemo(() => {
    let l = actives(data.tasks);
    if (filter !== "all") l = l.filter((t) => t.etat === filter);
    if (goalFilter !== "all") l = l.filter((t) => t.goalId === goalFilter);
    return l;
  }, [data, filter, goalFilter]);
  // Passe 3 — regroupement par état dans l'ordre du cycle de vie (groupes vides non affichés)
  const groupes = useMemo(() => groupesParEtat(list, data.goals).filter((g) => g.items.length > 0), [list, data.goals]);

  const addTask = () => {
    try {
      const res = createTask(data, { title: fTitle, goalId: fGoal, prio: fPrio, estime: parseFloat(fEstime), date: fDate.trim() || undefined }); // US28 — charge contrôlée dans createTask (fin du repli silencieux à 1 h)
      setData(res.data);
      setFTitle(""); setFEstime("2"); setFDate(""); setErr(null);
    } catch (e: any) { tracer("erreur", "Exception attrapée : " + e.message, undefined, true); setErr(e.message); }
  };

  // Passe 2 — clôture : la complétion exige le temps passé total ajusté (obligatoire, annulable sans complétion)
  const proposerCloture = (t: Task) => {
    const bloq = bloqueursDe(t, data.tasks); // US19 — une tâche bloquée ne peut pas être complétée
    if (bloq.length > 0) { setErr(`« ${t.title} » bloquée par : ${bloq.map((b) => b.title).join(", ")}`); return; }
    setFinId(t.id); setFinTotal(String(Math.round((t.passe + t.restant) * 10) / 10)); setErr(null); // suggestion = estimation courante
  };
  const validerCloture = () => {
    const t = data.tasks.find((x) => x.id === finId);
    if (!t) return;
    try {
      const { task, entry } = cloturerTache(t, parseFloat(finTotal));
      setData({ ...data, tasks: data.tasks.map((x) => (x.id === t.id ? task : x)), entries: entry ? [...data.entries, entry] : data.entries });
      setFinId(null); setErr(null);
    } catch (e: any) { tracer("erreur", "Exception attrapée : " + e.message, undefined, true); setErr(e.message); }
  };

  const cyclePrio = (id: string) => {
    const cycle: Prio[] = ["haute", "moyenne", "basse"];
    setData({ ...data, tasks: data.tasks.map((t) => (t.id === id ? { ...t, prio: cycle[(cycle.indexOf(t.prio) + 1) % 3] } : t)) });
  };
  const bumpEtat = (id: string) => {
    const t = data.tasks.find((x) => x.id === id);
    if (!t) return;
    // Itération 7 / US29 — cycle strict : le bouton propose l'état suivant uniquement ;
    // ré-ouverture (terminée → à planifier) : confirmation explicite avant tout changement.
    if (t.etat === "terminee") { setReopenId(id); setErr(null); return; }
    const next = prochainEtat(t);
    if (next === "terminee") { proposerCloture(t); return; } // Passe 2 — complétion uniquement via saisie du temps passé ajusté
    if (next === "planifiee" && !datePlanifieeOk(t)) { setPlanifId(id); setPlanifDate(isoDuLendemain()); setPlanifPasse(false); setErr(null); return; } // US29 — date requise : saisie en place, pas de blocage sec
    const garde = transitionEtat(t, next, data.tasks, datePlanifieeOk(t)); // US19 (bloquée) + US29 (cycle strict, date)
    if (!garde.ok) { setErr(garde.raison ?? "transition refusée"); return; }
    setData({ ...data, tasks: data.tasks.map((x) => (x.id === id ? avecEtat(x, next) : x)) }); // Passe 3 — changement journalisé
  };
  const validerPlanif = () => { // Itération 7 / US29 + US26 — planification via calendrier, ISO contrôlé
    const t = data.tasks.find((x) => x.id === planifId);
    if (!t) return;
    const d = planifDate.trim();
    if (!d || !parseISO(d)) { setErr(`date planifiée invalide : « ${d || "—"} » (choisissez une date dans le calendrier)`); setPlanifPasse(false); return; }
    if (d < isoDuJour() && !planifPasse) { setPlanifPasse(true); setErr(null); return; } // US26-c2 — date passée : avertissement explicite, second clic pour confirmer
    const garde = transitionEtat(t, "planifiee", data.tasks, true);
    if (!garde.ok) { setErr(garde.raison ?? "transition refusée"); return; }
    setData({ ...data, tasks: data.tasks.map((x) => (x.id === t.id ? avecEtat({ ...x, date: d }, "planifiee") : x)) });
    setPlanifId(null); setPlanifPasse(false); setErr(null);
  };
  const confirmerReouverture = () => { // Itération 7 / US29 — ré-ouverture après confirmation explicite
    const t = data.tasks.find((x) => x.id === reopenId);
    if (!t) return;
    const garde = transitionEtat(t, "a_planifier", data.tasks, true);
    if (!garde.ok) { setErr(garde.raison ?? "transition refusée"); return; }
    setData({ ...data, tasks: data.tasks.map((x) => (x.id === t.id ? reouvrirTache(x) : x)) });
    setReopenId(null); setErr(null);
  };

  const backlog = actives(data.tasks).filter((t) => t.etat !== "terminee");
  const backlogH = backlog.reduce((s, t) => s + t.restant, 0);

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-2 mb-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="text-xs md:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les états</SelectItem>
            <SelectItem value="a_planifier">À planifier</SelectItem>
            <SelectItem value="planifiee">Planifiées</SelectItem>
            <SelectItem value="en_cours">En cours</SelectItem>
            <SelectItem value="terminee">Terminées</SelectItem>
          </SelectContent>
        </Select>
        <Select value={goalFilter} onValueChange={setGoalFilter}>
          <SelectTrigger className="text-xs md:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous objectifs</SelectItem>
            {data.goals.filter((g) => !g.archive).map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card className="p-3 mb-3 text-xs text-slate-500 flex justify-between">
        <span>Backlog : <b>{backlog.length}</b> tâches</span>
        <span><b>{h(backlogH)}</b> restantes</span>
      </Card>
      <Card className="p-3">
        {groupes.length === 0 && (
          <div className="text-xs text-slate-500 py-2">
            Aucune tâche à afficher avec ces filtres — crée ta première tâche avec le formulaire ci-dessous, ou ajuste les filtres.
            <div className="mt-1"><Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => document.getElementById("nt-titre")?.focus()}>＋ Créer une tâche</Button></div>
          </div>
        )}
        {groupes.map((grp) => (
          <div key={grp.etat}>
            {/* Passe 3 — groupe d'état : intitulé + compte, dans l'ordre du cycle de vie */}
            <div className="flex items-baseline justify-between pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
              <span className={grp.etat === "terminee" ? "text-emerald-500" : grp.etat === "en_cours" ? "text-sky-500" : grp.etat === "planifiee" ? "text-indigo-500" : "text-slate-500"}>{etatLabel[grp.etat]}</span>
              <span className="text-slate-500">{grp.items.length}</span>
            </div>
            {grp.items.map((t) => {
          const g = data.goals.find((x) => x.id === t.goalId)!;
          return (
            <div key={t.id}>
              <div className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                {/* Itération 9 / US32 — 2 actions sur la rangée : état (cible 44 px, prochaine étape annoncée) et fiche ; le reste migre dans la fiche US27 */}
                <button onClick={() => bumpEtat(t.id)} className={"w-11 h-11 rounded-full border-2 shrink-0 " + (t.etat === "terminee" ? "bg-emerald-500 border-emerald-500" : t.etat === "en_cours" ? "bg-sky-500 border-sky-500" : "border-slate-300")}
                  aria-label={t.etat === "terminee" ? "ré-ouvrir la tâche (retour à « à planifier ») — confirmation requise" : "passer la tâche à « " + etatLabel[prochainEtat(t)] + " »"}
                  title={t.etat === "terminee" ? "Ré-ouvrir (confirmation requise)" : "Passer à « " + etatLabel[prochainEtat(t)] + " »"} /> {/* US29 — prochaine étape indiquée avant l'action ; US32 — cible ≥ 44 px */}
                <div className="flex-1 min-w-0">
                  <div className={"truncate text-sm " + (t.etat === "terminee" ? "line-through text-slate-500" : "")}>{t.title}</div>
                  {/* A6 — date visible sur petits écrans (seconde ligne) */}
                  <div className="flex gap-1 items-center text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: g.color }} />
                    restant {h(t.restant)}
                    {t.passe > 0 && ` · passé ${h(t.passe)}`}
                    {t.date ? ` · ${fmtIso(t.date)}` : ""}
                    {t.estimeInitial !== Math.round((t.passe + t.restant) * 10) / 10 && ` · estimé recalé ${h(t.passe + t.restant)}`}
                    {bloqueursDe(t, data.tasks).length > 0 && " · 🔒 bloquée"}
                    {t.historiqueEtat?.length ? ` · état depuis ${fmtJour(t.historiqueEtat[t.historiqueEtat.length - 1].date)}` : ""}
                  </div>
                </div>
                {/* US32 — version rapide du cycle de priorité conservée sur la rangée (règle US32) */}
                <button onClick={() => cyclePrio(t.id)} className={"px-2 py-0.5 rounded text-xs font-medium min-w-[44px] " + prioBadge[t.prio]} title="Changer la priorité (haute → moyenne → basse)">{t.prio}</button>
                <Badge className={etatBadge[t.etat]}>{etatLabel[t.etat]}</Badge>
                <button onClick={() => ouvrirFiche(t.id)} className="w-11 h-11 rounded-lg text-base shrink-0 hover:bg-slate-100" title="Fiche de la tâche — édition complète (US27)" aria-label={"ouvrir la fiche de la tâche « " + t.title + " »"}>✏️</button>
              </div>
              {finId === t.id && (
                <div className="flex flex-wrap items-center gap-2 py-2 px-8 bg-emerald-50 rounded mb-2 text-sm">
                  <span className="text-xs text-emerald-700 w-full">Clôture de « {t.title} » — temps passé TOTAL ajusté obligatoire (déjà logué : {h(t.passe)})</span>
                  <label className="text-xs">Total passé<input className="w-20 ml-1 border rounded px-1 text-xs py-0.5" type="number" min="0" step="0.5" value={finTotal} onChange={(e) => setFinTotal(e.target.value)} /></label>
                  <Button size="sm" onClick={validerCloture}>✓ Terminer</Button>
                  <Button size="sm" variant="outline" onClick={() => setFinId(null)}>Annuler</Button>
                </div>
              )}
              {/* Itération 7 / US29 + US26 — planification : calendrier ISO, raccourcis en un geste, avertissement date passée */}
              {planifId === t.id && (
                <div className="flex flex-wrap items-center gap-2 py-2 px-8 bg-indigo-50 rounded mb-2 text-sm">
                  <span className="text-xs text-indigo-700 w-full">Planifier « {t.title} » — une date est requise (US29).{planifPasse ? " ⚠ cette date est passée — confirmez pour planifier malgré tout." : ""}</span>
                  <label className="text-xs">Date<input className="w-36 ml-1 border rounded px-2 py-1 text-xs" type="date" value={planifDate} onChange={(e) => { setPlanifDate(e.target.value); setPlanifPasse(false); }} /></label>
                  <Button size="sm" variant="outline" onClick={() => { setPlanifDate(isoDuJour()); setPlanifPasse(false); }}>Aujourd'hui</Button>
                  <Button size="sm" variant="outline" onClick={() => { setPlanifDate(isoDuLendemain()); setPlanifPasse(false); }}>Demain</Button>
                  <Button size="sm" onClick={validerPlanif}>{planifPasse ? "⚠ Confirmer la date passée" : "Planifier"}</Button>
                  <Button size="sm" variant="outline" onClick={() => { setPlanifId(null); setPlanifPasse(false); setErr(null); }}>Annuler</Button>
                </div>
              )}
              {/* Itération 7 / US29 — ré-ouverture : confirmation explicite (un clic de trop ne rouvre plus rien) */}
              {reopenId === t.id && (
                <div className="flex flex-wrap items-center gap-2 py-2 px-8 bg-amber-50 rounded mb-2 text-sm">
                  <span className="text-xs text-amber-800 w-full">Ré-ouvrir « {t.title} » ? Elle repassera « à planifier » — temps restant restauré, historique conservé.</span>
                  <Button size="sm" onClick={confirmerReouverture}>Ré-ouvrir</Button>
                  <Button size="sm" variant="outline" onClick={() => { setReopenId(null); setErr(null); }}>Annuler</Button>
                </div>
              )}
              {/* Itération 9 / US32 — saisie, dépendances, suppression et renommage ont migré dans la fiche US27 (bouton ✏️ de la rangée) */}
            </div>
          );
        })}
          </div>
        ))}
      </Card>
      <Card className="p-3 mt-3">
        <div className="text-sm font-semibold mb-2">Nouvelle tâche (US3)</div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <div className="col-span-2 space-y-1">
            <label htmlFor="nt-titre" className="text-xs font-semibold text-slate-600">Titre <span className="text-red-500" aria-hidden>*</span></label>
            <Input id="nt-titre" placeholder="ex. : acheter la peinture" value={fTitle} onChange={(e) => setFTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="nt-objectif" className="text-xs font-semibold text-slate-600">Objectif <span className="text-red-500" aria-hidden>*</span></label>
            <Select value={fGoal} onValueChange={setFGoal}>
              <SelectTrigger id="nt-objectif" className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {data.goals.filter((g) => !g.archive).map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="nt-priorite" className="text-xs font-semibold text-slate-600">Priorité</label>
            <Select value={fPrio} onValueChange={(v) => setFPrio(v as Prio)}>
              <SelectTrigger id="nt-priorite" className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="haute">Haute</SelectItem><SelectItem value="moyenne">Moy.</SelectItem><SelectItem value="basse">Basse</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="nt-charge" className="text-xs font-semibold text-slate-600">Charge (h) <span className="text-red-500" aria-hidden>*</span></label>
            <Input id="nt-charge" className="text-center" type="number" min="0" step="0.5" title="Charge estimée (h)" value={fEstime} onChange={(e) => setFEstime(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="nt-date" className="text-xs font-semibold text-slate-600">Date planifiée</label>
            <Input id="nt-date" className="text-center" type="date" title="Date planifiée (optionnelle)" value={fDate} onChange={(e) => setFDate(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-between items-center mt-2">
          <Button size="sm" onClick={addTask} disabled={!fTitle.trim()}>Ajouter</Button>
          {err && <span role="alert" className="text-xs text-red-600">{err}</span>}
        </div>
      </Card>
    </div>
  );
}

// ==================== Itération 9 / US27 — fiche d'édition de tâche (surcouche plein écran) ====================

// US27 — toutes les propriétés d'une tâche en un seul écran, enregistrées en une seule validation ;
// statut par sélection explicite de l'état cible (les 4 états visibles, le courant signalé), gardes
// existantes conservées : cycle strict US29, bloquage US19, clôture US4-c6, ré-ouverture confirmée ;
// dépendances + historique (reprise de la fiche 🔗), saisie de temps US4, suppression logique US15 ;
// toute modification est tracée au journal US22 (diff) — y compris déplacement d'objectif et charge estimée.
function FicheTache({ data, setData, vel, id, onClose }: { data: AppData; setData: (d: AppData, manuel?: { type: string; message: string; erreur?: boolean }) => void; vel: ReturnType<typeof computeVelocity>; id: string; onClose: () => void }) {
  const t0 = data.tasks.find((x) => x.id === id);
  // US27-c1 — propriétés éditables, enregistrées en une seule validation
  const [fTitle, setFTitle] = useState(t0?.title ?? "");
  const [fGoal, setFGoal] = useState(t0?.goalId ?? "");
  const [fPrio, setFPrio] = useState<Prio>(t0?.prio ?? "moyenne");
  const [fEstime, setFEstime] = useState(String(t0?.estimeInitial ?? ""));
  const [fRestant, setFRestant] = useState(String(t0?.restant ?? ""));
  const [fDate, setFDate] = useState(t0?.date ?? "");
  const [err, setErr] = useState<string | null>(null);
  // Statut explicite : clôture (US4-c6) et ré-ouverture (US29) en sous-panneaux dédiés
  const [cloture, setCloture] = useState(false);
  const [finTotal, setFinTotal] = useState("");
  const [confirmReopen, setConfirmReopen] = useState(false);
  // Saisie de temps (US4) et suppression logique (US15)
  const [saisie, setSaisie] = useState(false);
  const [inPasse, setInPasse] = useState("");
  const [inRestant, setInRestant] = useState("");
  const [confirmSuppr, setConfirmSuppr] = useState(false);

  if (!t0) return null;
  const t = t0;
  const g = data.goals.find((x) => x.id === t.goalId);

  // US27-c1 — une seule validation pour toutes les propriétés (contrôles US28 : titre, objectif, charge > 0 ; date ISO US26)
  const enregistrer = () => {
    const estime = parseFloat(fEstime);
    const restant = parseFloat(fRestant);
    if (!fTitle.trim()) { setErr("titre obligatoire"); return; }
    if (!fGoal || !data.goals.some((x) => x.id === fGoal && !x.archive)) { setErr("objectif lié obligatoire (objectif inconnu ou archivé refusé)"); return; }
    if (isNaN(estime) || estime <= 0) { setErr("charge estimée obligatoire (> 0 h) — elle n'est plus remplacée automatiquement"); return; }
    if (isNaN(restant) || restant < 0) { setErr("temps restant invalide : nombre ≥ 0 attendu"); return; }
    if (fDate && !parseISO(fDate)) { setErr("date planifiée invalide : choisissez une date dans le calendrier"); return; }
    setData({ ...data, tasks: data.tasks.map((x) => x.id === t.id ? { ...x, title: fTitle.trim(), goalId: fGoal, prio: fPrio, estimeInitial: estime, restant: Math.round(restant * 10) / 10, date: fDate || undefined } : x) });
    setErr(null);
  };

  // US27-c4 — sélection explicite de l'état cible : chaque transition passe par la matrice US29,
  // les refus affichent la règle en cause ; « terminée » exige la clôture US4-c6 ; ré-ouverture confirmée.
  const choisirEtat = (cible: Etat) => {
    setErr(null); setCloture(false); setConfirmReopen(false);
    if (t.etat === cible) return; // état courant : rien à faire
    if (t.etat === "terminee" && cible === "a_planifier") { setConfirmReopen(true); return; } // ré-ouverture : confirmation explicite (US29)
    if (cible === "terminee") {
      if (prochainEtat(t) !== "terminee") { setErr(`transition « ${etatLabel[t.etat]} » → « ${etatLabel[cible]} » refusée : cycle strict (à planifier → planifiée → en cours → terminée) — « Terminée » n'est atteignable que depuis « En cours », via la clôture (US4-c6)`); return; } // US29-c1 — hors cycle impossible partout, fiche comprise
      const bloq = bloqueursDe(t, data.tasks); // US19 — une tâche bloquée ne peut pas être complétée
      if (bloq.length > 0) { setErr(`transition refusée : « ${t.title} » bloquée par : ${bloq.map((b) => b.title).join(", ")}`); return; }
      setCloture(true); setFinTotal(String(Math.round((t.passe + t.restant) * 10) / 10)); return; // US4-c6 — clôture obligatoire
    }
    const dateEffective = fDate || t.date; // la date saisie dans la fiche compte pour la planification
    const garde = transitionEtat(t, cible, data.tasks, !!dateEffective && !!parseISO(dateEffective));
    if (!garde.ok) { setErr(garde.raison ?? "transition refusée"); return; } // règle en cause affichée
    setData({ ...data, tasks: data.tasks.map((x) => x.id === t.id ? avecEtat({ ...x, date: cible === "planifiee" ? dateEffective : x.date }, cible) : x) });
  };
  const validerCloture = () => {
    try {
      const { task, entry } = cloturerTache(t, parseFloat(finTotal));
      setData({ ...data, tasks: data.tasks.map((x) => (x.id === t.id ? task : x)), entries: entry ? [...data.entries, entry] : data.entries });
      setCloture(false); setErr(null);
    } catch (e: any) { setErr(e.message); }
  };
  const confirmerReouverture = () => {
    setData({ ...data, tasks: data.tasks.map((x) => x.id === t.id ? reouvrirTache(x) : x) });
    setConfirmReopen(false);
  };
  const validerSaisieTemps = () => {
    try {
      const { task, entry } = saisieTemps(t, parseFloat(inPasse) || 0, parseFloat(inRestant));
      setData({ ...data, tasks: data.tasks.map((x) => (x.id === t.id ? task : x)), entries: entry ? [...data.entries, entry] : data.entries });
      setSaisie(false); setInPasse(""); setErr(null);
    } catch (e: any) { setErr(e.message); }
  };
  const ajouterDep = (depId: string) => {
    const c = data.tasks.find((x) => x.id === depId);
    if (!c) return;
    if (detectCycle(data.tasks, t.id, c.id)) { setErr(`Dépendance circulaire refusée : « ${c.title} » dépend déjà (directement ou transitivement) de « ${t.title} »`); return; }
    setData({ ...data, tasks: data.tasks.map((x) => x.id === t.id ? { ...x, deps: [...(x.deps ?? []), c.id] } : x) });
    setErr(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end md:items-center justify-center" role="dialog" aria-label="Fiche d'édition de tâche" onClick={onClose}
      onKeyDown={(e) => { // US31/§2.6 — Escape ferme, Tab reste piégé dans le dialog (focus clavier maîtrisé)
        if (e.key === "Escape") { onClose(); return; }
        if (e.key !== "Tab") return;
        const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")).filter((el) => !el.hasAttribute("disabled"));
        if (els.length === 0) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }}>
      <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl max-h-[92vh] overflow-y-auto p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: g?.color ?? "#999" }} />
            <div className="font-semibold truncate">Fiche de « {t.title} »</div>
          </div>
          <button onClick={onClose} className="w-11 h-11 -mr-2 rounded-full hover:bg-slate-100 text-slate-500 text-lg shrink-0" aria-label="fermer la fiche de tâche">✕</button>
        </div>
        {err && <div role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2">{err}</div>}

        {/* Statut — sélection explicite (US27) : les 4 états visibles, le courant signalé ; cibles 44 px (US32) */}
        <Card className="p-3">
          <div className="text-sm font-semibold mb-2">Statut — sélection explicite (US27)</div>
          <div className="grid grid-cols-2 gap-2">
            {(["a_planifier", "planifiee", "en_cours", "terminee"] as Etat[]).map((st) => (
              <button key={st} onClick={() => choisirEtat(st)}
                className={"py-3 px-2 rounded-lg border text-sm font-medium min-h-[44px] " + (st === t.etat ? "bg-indigo-600 border-indigo-600 text-white shadow" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")}
                title={st === t.etat ? "état courant" : "passer à « " + etatLabel[st] + " » — les transitions hors cycle sont refusées (cycle strict US29)"}>
                {etatLabel[st]}{st === t.etat ? " ●" : ""}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Cycle strict : une transition interdite affiche sa règle ; « terminée » exige la clôture avec temps passé total ajusté (US4-c6).</div>
          {cloture && (
            <div className="mt-2 p-2 bg-emerald-50 rounded text-sm space-y-2">
              <div className="text-xs text-emerald-700">Clôture — temps passé TOTAL ajusté obligatoire (déjà logué : {h(t.passe)})</div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs">Total passé<input className="w-20 ml-1 border rounded px-1 text-xs py-1" type="number" min="0" step="0.5" value={finTotal} onChange={(e) => setFinTotal(e.target.value)} /></label>
                <Button size="sm" onClick={validerCloture}>✓ Terminer</Button>
                <Button size="sm" variant="outline" onClick={() => setCloture(false)}>Annuler</Button>
              </div>
            </div>
          )}
          {confirmReopen && (
            <div className="mt-2 p-2 bg-amber-50 rounded text-sm space-y-2">
              <div className="text-xs text-amber-800">Ré-ouvrir « {t.title} » ? Elle repassera « à planifier » — temps restant restauré, historique conservé.</div>
              <div className="flex gap-2">
                <Button size="sm" onClick={confirmerReouverture}>Ré-ouvrir</Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmReopen(false)}>Annuler</Button>
              </div>
            </div>
          )}
        </Card>

        {/* Propriétés — une seule validation (US27-c1) */}
        <Card className="p-3">
          <div className="text-sm font-semibold mb-2">Propriétés — une seule validation</div>
          <div className="space-y-2">
            <div className="space-y-1">
              <label htmlFor="ft-titre" className="text-xs font-semibold text-slate-600">Titre <span className="text-red-500" aria-hidden>*</span></label>
              <Input id="ft-titre" autoFocus placeholder="ex. : réviser le chapitre 3" value={fTitle} onChange={(e) => setFTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor="ft-objectif" className="text-xs font-semibold text-slate-600">Objectif lié <span className="text-red-500" aria-hidden>*</span></label>
                <Select value={fGoal} onValueChange={setFGoal}>
                  <SelectTrigger id="ft-objectif" className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {data.goals.filter((x) => !x.archive).map((x) => <SelectItem key={x.id} value={x.id}>{x.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label htmlFor="ft-priorite" className="text-xs font-semibold text-slate-600">Priorité</label>
                <Select value={fPrio} onValueChange={(v) => setFPrio(v as Prio)}>
                  <SelectTrigger id="ft-priorite" className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="haute">Haute</SelectItem><SelectItem value="moyenne">Moyenne</SelectItem><SelectItem value="basse">Basse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label htmlFor="ft-charge" className="text-xs font-semibold text-slate-600">Charge estimée (h) <span className="text-red-500" aria-hidden>*</span></label>
                <Input id="ft-charge" type="number" min="0" step="0.5" title="Charge estimée (h) — obligatoire, > 0" value={fEstime} onChange={(e) => setFEstime(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="ft-restant" className="text-xs font-semibold text-slate-600">Temps restant (h)</label>
                <Input id="ft-restant" type="number" min="0" step="0.5" title="Temps restant (h) — nombre ≥ 0" value={fRestant} onChange={(e) => setFRestant(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label htmlFor="ft-date" className="text-xs font-semibold text-slate-600">Date planifiée</label>
                <Input id="ft-date" type="date" title="Date planifiée (calendrier US26)" value={fDate} onChange={(e) => setFDate(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 gap-2">
            <Button onClick={enregistrer} className="min-h-[44px]">💾 Enregistrer</Button>
            <span className="text-[11px] text-slate-500 text-right">Titre* · objectif lié* · charge &gt; 0 · restant ≥ 0 · date calendrier</span>
          </div>
        </Card>

        {/* Saisie de temps (US4) */}
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Temps</div>
            <div className="flex items-center gap-2 text-xs text-slate-500">passé {h(t.passe)} · restant {h(t.restant)}</div>
          </div>
          {!saisie ? (
            <Button size="sm" variant="outline" className="mt-2 min-h-[44px]" onClick={() => { setSaisie(true); setInPasse(""); setInRestant(String(t.restant)); }}>⏱ Saisir du temps</Button>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs text-slate-500 w-full">Passé et restant sont obligatoires (US4)</span>
              <label className="text-xs">Passé<input className="w-16 ml-1 border rounded px-1 text-xs py-1" type="number" min="0" step="0.5" value={inPasse} onChange={(e) => setInPasse(e.target.value)} /></label>
              <label className="text-xs">Restant<input className="w-16 ml-1 border rounded px-1 text-xs py-1" type="number" min="0" step="0.5" value={inRestant} onChange={(e) => setInRestant(e.target.value)} /></label>
              <Button size="sm" onClick={validerSaisieTemps}>OK</Button>
              <Button size="sm" variant="outline" onClick={() => setSaisie(false)}>Annuler</Button>
            </div>
          )}
        </Card>

        {/* Dépendances (US19) + historique des états (Passe 3) + historique des saisies — sans retour à la liste (US27-c5) */}
        <Card className="p-3 text-xs space-y-2">
          <div className="text-sm font-semibold">Dépendances &amp; historique</div>
          <div className="text-slate-500">Historique d'états : {historiqueEtatsLabel(t) || "—"}{t.dateFin ? ` · terminée le ${fmtJour(t.dateFin)}` : ""}</div>
          <div className="text-slate-500">Saisies de temps : {data.entries.filter((e) => e.taskId === t.id).length === 0 ? "aucune" : data.entries.filter((e) => e.taskId === t.id).map((e) => `${fmtJour(e.date)} · ${h(e.hours)}`).join(" · ")}</div> {/* US33 — durée lisible */}
          {(t.deps ?? []).length === 0 && <div className="text-slate-500">Aucun prérequis.</div>}
          {(t.deps ?? []).map((d) => {
            const dt = data.tasks.find((x) => x.id === d);
            return (
              <div key={d} className="flex items-center gap-2 py-0.5">
                <span className="w-2 h-2 rounded-full" style={{ background: dt && dt.etat === "terminee" ? "#10b981" : "#f43f5e" }} />
                <span className="flex-1">{dt ? dt.title : d} {dt && dt.etat !== "terminee" ? "(non terminée)" : "(terminée)"}</span>
                <button className="text-red-500 underline" onClick={() => setData({ ...data, tasks: data.tasks.map((x) => x.id === t.id ? { ...x, deps: (x.deps ?? []).filter((y) => y !== d) } : x) })}>retirer</button>
              </div>
            );
          })}
          {bloqueursDe(t, data.tasks).length > 0 && <div className="text-red-600">🔒 bloquée par : {bloqueursDe(t, data.tasks).map((b) => b.title).join(", ")}</div>}
          {(t.deps ?? []).length > 0 && (vel.velocite === null
            ? <div className="text-slate-500">estimation en attente de prérequis</div>
            : (() => { const f = estimeFinTache(t, data.tasks, vel.velocite); return f ? <div className="text-slate-500">fin estimée (prérequis inclus) : {fmtDate(f)}</div> : null; })())}
          <div className="text-slate-500">Ajouter un prérequis :</div>
          {actives(data.tasks).filter((c) => c.id !== t.id && !(t.deps ?? []).includes(c.id) && c.etat !== "terminee").slice(0, 6).map((c) => (
            <button key={c.id} className="block w-full text-left px-1 py-1 hover:bg-slate-200 rounded" onClick={() => ajouterDep(c.id)}>+ {c.title} <span className="text-slate-500">({data.goals.find((g2) => g2.id === c.goalId)?.title ?? ""})</span></button>
          ))}
          {(() => { const dv = actives(data.tasks).filter((x) => (x.deps ?? []).includes(t.id)); return dv.length > 0 ? <div className="text-slate-500">Tâches dépendantes : {dv.map((x) => x.title).join(", ")}</div> : null; })()}
        </Card>

        {/* Suppression logique (US15) — confirmation explicite sur les liens */}
        <Card className="p-3">
          <div className="text-sm font-semibold mb-2">Supprimer la tâche (US15)</div>
          {!confirmSuppr ? (
            <Button size="sm" variant="destructive" className="min-h-[44px]" onClick={() => setConfirmSuppr(true)}>Supprimer…</Button>
          ) : (() => {
            const dependents = actives(data.tasks).filter((x) => (x.deps ?? []).includes(t.id));
            return (
              <div className="text-xs space-y-2">
                <div className="text-slate-600">Supprimer « {t.title} » ? <span className="text-slate-500">(suppression logique : l'historique des saisies est conservé)</span></div>
                {dependents.length > 0 && <div className="text-amber-700">Tâches dépendantes : {dependents.map((x) => x.title).join(", ")} — leurs liens seront retirés.</div>}
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => { setData(deleteTask(data, t.id)); onClose(); }}>
                    {dependents.length > 0 ? "Supprimer la tâche et ses liens" : "Supprimer la tâche"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmSuppr(false)}>Annuler</Button>
                </div>
              </div>
            );
          })()}
        </Card>
      </div>
    </div>
  );
}

// ==================== Écran : Statistiques (US2 + vélocité réelle + A3) ====================

function Stats({ data, vel, goTaches }: { data: AppData; vel: ReturnType<typeof computeVelocity>; goTaches: () => void }) { // US33-c2 — état vide guidé avec action directe
  const [gran, setGran] = useState("semaine");
  const [histVue, setHistVue] = useState<"jour" | "tache">("jour"); // Passe 2 — historique du temps logué par jour / par tâche
  // US2 — statistiques calculées depuis les saisies réelles
  const chart = useMemo(() => {
    // US2 — agrégation réelle par jour / semaine / mois
    const granKey = (d: string) => {
      if (gran === "jour") return d;
      if (gran === "mois") return d.slice(0, 7);
      const dt = new Date(d);
      dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); // lundi de la semaine ISO
      return dt.toISOString().slice(0, 10);
    };
    const acc = new Map<string, { taches: number; heures: number }>();
    for (const e of data.entries) {
      if (e.hours <= 0) continue;
      const k = granKey(e.date);
      const cur = acc.get(k) ?? { taches: 0, heures: 0 };
      cur.heures += e.hours;
      acc.set(k, cur);
    }
    // US2 critère 3 — une tâche terminée est comptée à sa date réelle de complétion (dateFin)
    for (const t of actives(data.tasks)) {
      if (!t.dateFin) continue;
      const k = granKey(t.dateFin);
      const cur = acc.get(k) ?? { taches: 0, heures: 0 };
      cur.taches += 1;
      acc.set(k, cur);
    }
    const fmt = (k: string) =>
      gran === "mois" ? k.replace("-", "/")
      : gran === "semaine" ? "sem. " + new Date(k).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
      : new Date(k).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    return [...acc.keys()].sort().map((k) => ({ p: fmt(k), "Tâches": acc.get(k)!.taches, "Heures": Math.round(acc.get(k)!.heures * 10) / 10 }));
  }, [data, gran]);

  const totalH = data.tasks.reduce((s, t) => s + t.passe, 0);
  const fiab = fiabilite(data.tasks);

  return (
    <div>
      <div className="flex gap-2 mb-3">
        {["jour", "semaine", "mois"].map((g) => (
          <Button key={g} size="sm" variant={gran === g ? "default" : "outline"} onClick={() => setGran(g)} className="flex-1 capitalize">{g}</Button>
        ))}
      </div>
      <div className="md:grid md:grid-cols-2 md:gap-4 md:items-start">
        <Card className="p-3 mb-3 md:mb-0">
          <div className="text-sm font-semibold mb-1">Réalisation ({gran}, données réelles)</div>
          {chart.length === 0 ? <div className="text-xs text-slate-500">Aucune saisie enregistrée.</div> : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="p" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Tâches" fill="#6366f1" />
                  <Bar dataKey="Heures" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Card className="p-3 text-center">
              <div className="text-xs text-slate-500">Vélocité (US7)</div>
              <div className="text-xl font-bold text-indigo-600">{vel.velocite !== null ? vel.velocite + " h/sem" : "—"}</div>
              <div className="text-[11px] text-slate-500 mt-1">{velLabel[vel.statut]}</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-xs text-slate-500">Temps passé total</div>
              <div className="text-xl font-bold text-emerald-600">{h(totalH)}</div>
            </Card>
            <Card className="p-3 text-center col-span-2">
              <div className="text-xs text-slate-500">Fiabilité des estimations (A3)</div>
              <div className="text-lg font-bold text-amber-600">
                {fiab.derive === null ? "—" : fiab.derive > 0 ? `+${fiab.derive}% (sous-estimées)` : `${fiab.derive}% (sur-estimées)`}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">dérive moyenne estimé initial → estimé recalé, sur {fiab.nb} tâche(s)</div>
            </Card>
          </div>
          <Card className="p-3">
            <div className="text-sm font-semibold mb-1">Journal des migrations (US16)</div>
            {data.migrationLog.length === 0 && <div className="text-xs text-slate-500">Aucune migration appliquée.</div>}
            {data.migrationLog.map((l, i) => (
              <div key={i} className="text-xs text-slate-600 py-0.5">v{l.from} → v{l.to} · {l.name} · {l.date}</div>
            ))}
            <div className="text-xs text-slate-500 mt-1">App v{APP_VERSION} · schéma v{SCHEMA_VERSION}</div>
          </Card>
        </div>
      </div>
      <Card className="p-3 mt-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Historique du temps logué (US4)</div>
          <div className="grid grid-cols-2 gap-1" role="tablist" aria-label="Groupement de l'historique">
            <button role="tab" aria-selected={histVue === "jour"} onClick={() => setHistVue("jour")}
              className={"px-3 py-1 rounded-full text-xs font-semibold border transition " + (histVue === "jour" ? "bg-indigo-600 border-indigo-600 text-white shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50")}>Par jour</button>
            <button role="tab" aria-selected={histVue === "tache"} onClick={() => setHistVue("tache")}
              className={"px-3 py-1 rounded-full text-xs font-semibold border transition " + (histVue === "tache" ? "bg-emerald-600 border-emerald-600 text-white shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50")}>Par tâche</button>
          </div>
        </div>
        {data.entries.length === 0 && (
          <div className="text-xs text-slate-500">
            Aucune saisie enregistrée — saisis du temps depuis la fiche d'une tâche (✏️) ou depuis le rituel du soir.
            <div className="mt-1"><Button size="sm" variant="outline" className="min-h-[44px]" onClick={goTaches}>✅ Aller aux tâches</Button></div>
          </div>
        )}
        {histVue === "jour" ? (
          <div>
            {grouperParJour(data.entries).map((j) => (
              <div key={j.date} className="py-1.5 border-b border-slate-100 last:border-0">
                <div className="flex justify-between text-xs font-semibold text-slate-600"><span>{new Date(j.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}</span><span>{h(j.total)}</span></div>
                {j.lignes.map((l, i) => (
                  <div key={i} className="flex justify-between text-xs text-slate-500 py-0.5"><span>↳ {data.tasks.find((t) => t.id === l.taskId)?.title ?? l.taskId}</span><span>{h(l.hours)}</span></div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div>
            {grouperParTache(data.entries, data.tasks).map((gt) => (
              <div key={gt.taskId} className="py-1.5 border-b border-slate-100 last:border-0">
                <div className="flex justify-between text-xs font-semibold text-slate-600"><span>{data.tasks.find((x) => x.id === gt.taskId)?.title ?? gt.taskId}</span><span>{h(gt.total)}</span></div>
                {gt.lignes.map((l, i) => (
                  <div key={i} className="flex justify-between text-xs text-slate-500 py-0.5"><span>↳ {new Date(l.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</span><span>{h(l.hours)}</span></div>
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="text-[11px] text-slate-500 mt-1">Chaque saisie est journalisée (tâche, jour, heures) — groupable par jour ou par tâche.</div>
      </Card>
    </div>
  );
}

// ==================== US21 — fait scientifique du jour ====================

// Corpus de 100 faits scientifiques amusants, recueilli à partir de sources en ligne
// (agences spatiales, muséums, universités, magazines scientifiques) et mis en forme
// pour une lecture quotidienne. Hors schéma applicatif : persisté séparément (clé dédiée).
const FAITS_SCIENTIFIQUES: { id: string; fr: string }[] = [
  { id: "f001", fr: "Les tardigrades survivent au vide de l'espace : l'ESA en a lâché en orbite en 2007, et ils s'en sont tirés." },
  { id: "f002", fr: "En 1968, deux tortues des steppes ont fait le tour de la Lune à bord de la sonde soviétique Zond 5 — les premiers êtres vivants à le faire." },
  { id: "f003", fr: "En 2009, une chauve-souris a volé jusqu'en orbite cachée dans le réservoir de la navette Discovery, et a survécu au voyage." },
  { id: "f004", fr: "L'ours polaire a la peau noire et des poils transparents : c'est la lumière qui le fait paraître blanc." },
  { id: "f005", fr: "Un escargot porte des milliers de dents minuscules sur sa « langue » (la radula) — bien plus qu'un requin." },
  { id: "f006", fr: "L'étoile de mer n'a pas de cerveau, mais un système nerveux en réseau qui lui permet de chasser et de régénérer ses bras." },
  { id: "f007", fr: "En 2023, un crocodile femelle d'un zoo du Costa Rica a pondu 14 œufs sans mâle — un cas documenté de parthénogenèse." },
  { id: "f008", fr: "Un chat domestique en pleine course (près de 48 km/h) est plus rapide qu'Usain Bolt au 100 m." },
  { id: "f009", fr: "Les vaches produisent davantage de lait quand on leur joue de la musique classique, notamment de la musique lente." },
  { id: "f010", fr: "Des dauphins passent délibérément des poissons-gonflés (toxiques) de bec en bec, apparemment pour en ressentir les effets." },
  { id: "f011", fr: "La pieuvre a trois cœurs et un sang bleu teinté par l'hémocyanine, à base de cuivre." },
  { id: "f012", fr: "Le dauphin dort d'un seul hémisphère cérébral à la fois : un œil reste ouvert pour surveiller les prédateurs." },
  { id: "f013", fr: "Les flamants roses ne naissent pas roses : leur couleur vient des caroténoïdes des crevettes et algues qu'ils mangent." },
  { id: "f014", fr: "Les papillons goûtent avec leurs pattes : leurs récepteurs gustatifs y sont logés." },
  { id: "f015", fr: "Les abeilles peuvent apprendre à reconnaître des visages humains, en les traitant comme des motifs de fleurs." },
  { id: "f016", fr: "Les requins existaient avant les arbres : environ 450 millions d'années pour les requins, 350 pour les arbres." },
  { id: "f017", fr: "Le cœur possède son propre réseau électrique et continue de battre un temps hors du corps, sans ordre du cerveau." },
  { id: "f018", fr: "La paroi de l'estomac se renouvelle tous les 3 à 4 jours, sinon elle serait digérée par son propre acide." },
  { id: "f019", fr: "Le nez humain peut distinguer plus de 1 000 milliards d'odeurs différentes." },
  { id: "f020", fr: "Mis bout à bout, nos vaisseaux sanguins feraient environ 100 000 km — quatre fois le tour de la Terre." },
  { id: "f021", fr: "Les muscles des yeux sont environ 100 fois plus puissants que nécessaire pour leurs mouvements quotidiens." },
  { id: "f022", fr: "Le cerveau représente 2 % de la masse du corps mais consomme environ 20 % de son énergie." },
  { id: "f023", fr: "Nos yeux changent de mise au point jusqu'à 100 000 fois par jour, un record qu'aucun appareil photo n'égale." },
  { id: "f024", fr: "Nous partageons environ la moitié de nos gènes avec… la banane. Tout être vivant descend d'un ancêtre commun." },
  { id: "f025", fr: "Nous sommes légèrement plus grands le matin que le soir : les disques intervertébraux se tassent dans la journée." },
  { id: "f026", fr: "Le miel ne périme pas : du miel vieux de plus de 3 000 ans trouvé en Égypte était encore comestible." },
  { id: "f027", fr: "La banane est une baie au sens botanique — la fraise, elle, n'en est pas une." },
  { id: "f028", fr: "Sur Vénus, une journée dure plus longtemps qu'une année : 243 jours terrestres pour un tour sur elle-même, 225 pour un tour du Soleil." },
  { id: "f029", fr: "La lumière du Soleil qui vous éclaire a quitté sa surface il y a environ 8 minutes et 20 secondes." },
  { id: "f030", fr: "Un éclair chauffe l'air à environ 30 000 °C — cinq fois la surface du Soleil." },
  { id: "f031", fr: "Il y a plus d'arbres sur Terre (environ 3 000 milliards) que d'étoiles dans la Voie lactée (100 à 400 milliards)." },
  { id: "f032", fr: "Les journées s'allongent d'environ 1,78 milliseconde par siècle — on le mesure aux éclipses historiques." },
  { id: "f033", fr: "Le phytoplancton océanique produit environ la moitié de l'oxygène que vous respirez." },
  { id: "f034", fr: "Effet Mpemba : dans certaines conditions, l'eau chaude gèle plus vite que l'eau froide. Les physiciens débattent encore." },
  { id: "f035", fr: "La glace flotte parce qu'elle est moins dense que l'eau liquide — une anomalie rare qui protège la vie sous les lacs gelés." },
  { id: "f036", fr: "En apesanteur, les astronautes grandissent de plusieurs centimètres : leur colonne vertébrale se décompresse." },
  { id: "f037", fr: "La tour Eiffel mesure jusqu'à 15 cm de plus l'été : l'acier se dilate à la chaleur." },
  { id: "f038", fr: "Jupiter pèse plus de deux fois la masse de toutes les autres planètes du système solaire réunies." },
  { id: "f039", fr: "Par une nuit noire et si la Terre était plate, l'œil humain verrait une bougie à près de 48 km." },
  { id: "f040", fr: "Un crocodile ne peut pas sortir sa langue : elle est attachée au fond de sa bouche." },
  { id: "f041", fr: "Les loutres de mer dorment en se tenant par la patte pour ne pas dériver l'une loin de l'autre." },
  { id: "f042", fr: "Les écureuils oublient où ils ont enterré une partie de leurs noisettes — et font ainsi repousser des forêts." },
  { id: "f043", fr: "Le wombat est le seul animal dont les crottes sont cubiques, pour qu'elles ne roulent pas hors de son territoire." },
  { id: "f044", fr: "Le cœur de la crevette se situe… dans sa tête, juste derrière son cerveau." },
  { id: "f045", fr: "Le colibri est le seul oiseau capable de voler vers l'arrière." },
  { id: "f046", fr: "Le kangourou ne peut pas reculer : sa queue et ses jambes ne s'y prêtent pas." },
  { id: "f047", fr: "L'éléphant est le seul mammifère terrestre incapable de sauter — trop lourd, et ses jambes ne s'y prêtent pas." },
  { id: "f048", fr: "Le pic-vert cogne jusqu'à 12 000 fois par jour ; sa langue s'enroule autour de son crâne pour amortir les chocs." },
  { id: "f049", fr: "Une reine fourmi peut vivre plus de 10 ans, un record pour un insecte." },
  { id: "f050", fr: "La méduse Turritopsis peut inverser son cycle de vie et rajeunir : on l'appelle « la méduse immortelle »." },
  { id: "f051", fr: "L'axolotl régénère ses membres, sa moelle épinière et même des parties de son cœur et de son cerveau." },
  { id: "f052", fr: "L'ornithorynque, déjà étonnant avec son bec de canard, brille en bleu-vert sous les rayons ultraviolets." },
  { id: "f053", fr: "Le paresseux ne descend de son arbre qu'environ une fois par semaine — et c'est là qu'il est le plus vulnérable." },
  { id: "f054", fr: "Le caméléon change de couleur surtout pour communiquer sa humeur et sa température, pas pour se camoufler." },
  { id: "f055", fr: "Le nez d'un chien compte environ 300 millions de récepteurs olfactifs, contre environ 6 millions pour l'humain." },
  { id: "f056", fr: "Un chat passe environ 70 % de sa vie à dormir." },
  { id: "f057", fr: "Les corbeaux reconnaissent des visages humains et se souviennent de ceux qui les ont dérangés." },
  { id: "f058", fr: "Les vaches ont des « amies » préférées : séparées d'elles, leur rythme cardiaque s'accélère." },
  { id: "f059", fr: "Les chèvres s'approchent davantage des humains qui leur sourient — l'expression compte, même pour une chèvre." },
  { id: "f060", fr: "Le manchot propose souvent à sa partenaire un galet soigneusement choisi." },
  { id: "f061", fr: "Les couples d'hippocampes restent fidèles et se saluent chaque matin par une petite danse." },
  { id: "f062", fr: "La grenouille ne boit pas par la bouche : elle absorbe l'eau à travers sa peau." },
  { id: "f063", fr: "« Aveugle comme une taupe » est faux : les chauves-souris voient, et c'est le seul mammifère qui vole vraiment." },
  { id: "f064", fr: "Les grands corbeaux savent fabriquer des outils, par exemple des crochets découpés dans des feuilles." },
  { id: "f065", fr: "Les éléphants « parlent » en infrasons : des grondements que l'oreille humaine n'entend pas, portant à plusieurs kilomètres." },
  { id: "f066", fr: "Le chant des baleines à bosse peut voyager sur des centaines de kilomètres sous l'eau." },
  { id: "f067", fr: "Les cachalots dorment à la verticale, suspendus en groupe comme des flèches plantées." },
  { id: "f068", fr: "La « corne » du narval est en fait une canine de la mâchoire supérieure, truffée de millions de terminaisons nerveuses." },
  { id: "f069", fr: "Les méduses existaient déjà il y a plus de 500 millions d'années — bien avant les dinosaures." },
  { id: "f070", fr: "Une cuillère de matière d'étoile à neutrons pèserait environ un milliard de tonnes sur Terre." },
  { id: "f071", fr: "Olympus Mons, le volcan de Mars, est presque trois fois plus haut que l'Everest." },
  { id: "f072", fr: "Sur Mercure, un jour solaire dure 176 jours terrestres — plus qu'une année mercurienne de 88 jours." },
  { id: "f073", fr: "Saturne est si peu dense qu'elle flotterait sur l'eau… s'il existait une baignoire assez grande." },
  { id: "f074", fr: "Sur la planète HD 189733b, il pleut du verre fondu, balayé par des vents de 7 000 km/h." },
  { id: "f075", fr: "Les empreintes de pas laissées sur la Lune dureront des millions d'années : il n'y a ni vent ni pluie pour les effacer." },
  { id: "f076", fr: "Les astronautes décrivent l'odeur de l'espace comme celle du métal brûlé ou de viande grillée." },
  { id: "f077", fr: "Le Soleil concentre 99,86 % de la masse du système solaire." },
  { id: "f078", fr: "En apesanteur, impossible de roter : le gaz ne se sépare pas du liquide dans l'estomac." },
  { id: "f079", fr: "La grande tache rouge de Jupiter rétrécit, mais reste plus large que la Terre entière." },
  { id: "f080", fr: "À la naissance, un bébé a environ 300 os ; à l'âge adulte, il n'en reste que 206, fusionnés en grandissant." },
  { id: "f081", fr: "En proportion de sa taille, le masseter (muscle de la mâchoire) est le plus puissant du corps humain." },
  { id: "f082", fr: "Le foie se régénère : on peut en retirer une grande partie et il repousse pour retrouver sa fonction." },
  { id: "f083", fr: "Le corps humain émet une lueur très faible, invisible à l'œil nu mais captée par des caméras ultra-sensibles." },
  { id: "f084", fr: "Les ongles de la main moyenne poussent d'environ 3,5 cm par an — ceux du majeur, les plus vite." },
  { id: "f085", fr: "Nous clignons environ 15 fois par minute, sans jamais le remarquer." },
  { id: "f086", fr: "Les cellules du goût se renouvellent tous les 10 jours environ." },
  { id: "f087", fr: "Impossible de se chatouiller soi-même : le cerveau prévoit votre propre geste et annule la surprise." },
  { id: "f088", fr: "Les oreilles et le nez grandissent toute la vie — le cartilage continue de s'étendre." },
  { id: "f089", fr: "Le poumon gauche est plus petit que le droit : il laisse de la place au cœur." },
  { id: "f090", fr: "La pomme flotte sur l'eau : elle est composée d'environ 25 % d'air." },
  { id: "f091", fr: "Les carottes étaient pour la plupart violettes avant que les Néerlandais ne sélectionnent la variété orange au XVIᵉ siècle." },
  { id: "f092", fr: "Le café pousse dans une baie rouge qu'on appelle… la cerise de café." },
  { id: "f093", fr: "Le piment ne « brûle » pas vraiment : la capsaïcine trompe les capteurs de chaleur de la bouche." },
  { id: "f094", fr: "La cannelle provient de l'écorce d'un arbre — et fut un temps plus précieuse que l'or." },
  { id: "f095", fr: "Le bambou peut pousser jusqu'à 91 cm par jour : c'est la plante la plus rapide du monde." },
  { id: "f096", fr: "Les arbres d'une même forêt s'échangent sucres et signaux via des réseaux de champignons souterrains — le « wood wide web »." },
  { id: "f097", fr: "Jeune, le tournesol suit le Soleil d'est en ouest ; une fois adulte, il reste figé face à l'est." },
  { id: "f098", fr: "Le baobab stocke des dizaines de milliers de litres d'eau dans son tronc pour traverser la saison sèche." },
  { id: "f099", fr: "Les bananes s'épluchent plus facilement par le bas, comme le font les singes — moins de filaments résiduels." },
  { id: "f100", fr: "La matière ne touche jamais vraiment : les électrons de vos atomes repoussent ceux de tout ce que vous croyez toucher." },
];

interface FaitsState { date: string; id: string; counts: Record<string, number>; } // US21 — état du fait du jour + compteurs d'affichage
const FAITS_KEY = "objectifs-app-faits";

function loadFaitsState(): FaitsState {
  try {
    const raw = localStorage.getItem(FAITS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* mémoire seule */ }
  return { date: "", id: "", counts: {} };
}

// US21 — fait du jour : même fait toute la journée ; au changement de jour, tirage uniforme
// parmi les moins affichés (le fait choisi repasse au compteur minimal + 1 → jamais deux
// jours de suite, et équilibrage progressif des 100 faits du corpus).
function faitDuJour(state: FaitsState, today: string): FaitsState {
  if (state.date === today && state.id) return state;
  const counts = { ...state.counts };
  const min = Math.min(...FAITS_SCIENTIFIQUES.map((f) => counts[f.id] ?? 0));
  const candidats = FAITS_SCIENTIFIQUES.filter((f) => (counts[f.id] ?? 0) === min && f.id !== state.id);
  const pool = candidats.length > 0 ? candidats : FAITS_SCIENTIFIQUES.filter((f) => f.id !== state.id);
  const fait = pool[Math.floor(Math.random() * pool.length)];
  return { date: today, id: fait.id, counts: { ...counts, [fait.id]: (counts[fait.id] ?? 0) + 1 } };
}

// ==================== Écran : Calendrier (US20) ====================

function Calendrier({ data, setData }: { data: AppData; setData: (d: AppData) => void }) {
  const [capOuvre, setCapOuvre] = useState(String(data.preferences.capaciteJourOuvre));
  const [capWe, setCapWe] = useState(String(data.preferences.capaciteWeekEnd));
  const [offsetMois, setOffsetMois] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const auj = new Date();

  const enregistrer = () => {
    const o = parseFloat(capOuvre), w = parseFloat(capWe);
    if (isNaN(o) || o <= 0 || isNaN(w) || w < 0) { setMsg("Capacités invalides : jour ouvré > 0, week-end ≥ 0."); return; }
    setData({ ...data, preferences: { capaciteJourOuvre: o, capaciteWeekEnd: w } }); // US20 — persistées dans le schéma (v5)
    setMsg("Capacités enregistrées ✅");
  };

  // Charge planifiée par jour : restant des tâches actives non terminées, à leur date réelle
  const charge = new Map<string, number>();
  for (const t of actives(data.tasks)) {
    if (t.etat === "terminee") continue;
    if (t.date && parseISO(t.date)) charge.set(t.date, (charge.get(t.date) ?? 0) + t.restant); // US26 — ISO réelle
  }

  // Grille du mois (lundi en première colonne) + totaux capacité/planifié
  const base = new Date(auj.getFullYear(), auj.getMonth() + offsetMois, 1);
  const moisLabel = base.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const nbJours = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const premier = (base.getDay() + 6) % 7; // lundi = colonne 0
  const isoAuj = isoLocal(auj);
  const cellules: (Date | null)[] = Array(premier).fill(null).concat([...Array(nbJours)].map((_, i) => new Date(base.getFullYear(), base.getMonth(), i + 1)));
  let totalCap = 0, totalPrevu = 0;
  for (const d of cellules) if (d) { totalCap += capaciteJour(d, data.preferences); totalPrevu += charge.get(isoLocal(d)) ?? 0; }

  const jours = ["L", "M", "M", "J", "V", "S", "D"];
  return (
    <div>
      <Card className="p-3 mb-3 bg-gradient-to-r from-indigo-50 to-sky-50 border-indigo-100">
        <div className="text-sm font-semibold mb-2">Ma capacité moyenne</div>
        <div className="flex items-end gap-2 mb-2">
          <label className="text-xs flex-1">Jour ouvré (h)<input className="w-full border rounded px-2 py-1 text-sm" type="number" min="0" step="0.5" value={capOuvre} onChange={(e) => setCapOuvre(e.target.value)} /></label>
          <label className="text-xs flex-1">Week-end (h)<input className="w-full border rounded px-2 py-1 text-sm" type="number" min="0" step="0.5" value={capWe} onChange={(e) => setCapWe(e.target.value)} /></label>
          <Button size="sm" onClick={enregistrer}>Enregistrer</Button>
        </div>
        <div className="text-[11px] text-slate-500">Heures par jour. Le calendrier adapte la capacité à chaque journée.</div>
        {msg && <div className="text-xs mt-1 text-indigo-600">{msg}</div>}
      </Card>
      <Card className="p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setOffsetMois(offsetMois - 1)}>←</Button>
          <div className="text-sm font-semibold capitalize">{moisLabel}</div>
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setOffsetMois(offsetMois + 1)}>→</Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500 mb-1">{jours.map((j, i) => <div key={i}>{j}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cellules.map((d, i) => {
            if (!d) return <div key={"vide" + i} />;
            const iso = isoLocal(d);
            const cap = capaciteJour(d, data.preferences);
            const prev = charge.get(iso) ?? 0;
            const surcharge = prev > cap;
            const we = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div key={iso} className={"rounded-lg p-1 min-h-[3.4rem] " + (we ? "bg-rose-50" : "bg-slate-50") + (iso === isoAuj ? " ring-2 ring-indigo-500" : "")}>
                <div className="text-[11px] font-semibold">{d.getDate()}</div>
                <div className="text-[10px] text-slate-500">{h(cap)}</div> {/* US31 — dérogation densité grille consignée : 10 px, contraste AA respecté */}
                {prev > 0 && (
                  <div className={"text-[10px] " + (surcharge ? "text-red-600 font-bold" : "text-emerald-600")}>
                    {surcharge ? "⚠ " : ""}{h(prev)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="text-xs text-slate-500 mt-2">
          Capacité du mois : <b>{h(totalCap)}</b> · planifié : <b>{h(totalPrevu)}</b> {totalPrevu > totalCap ? "⚠ surcharge" : "✅"}
        </div>
        {totalPrevu === 0 && ( // US33-c2 — état vide guidé : aucune tâche planifiée sur le mois
          <div className="text-xs text-slate-500 mt-1">
            Aucune tâche planifiée ce mois-ci — planifie des tâches depuis l'écran Tâches pour visualiser ta charge.
          </div>
        )}
        <div className="text-[11px] text-slate-500 mt-1">Chaque case affiche la capacité du jour (h) et la charge planifiée ; rouge ⚠ = surcharge, week-ends en rose.</div>
      </Card>
    </div>
  );
}

// ==================== Écran : Google (US14 réduit + US1 sync agenda) ====================

function Google({ data, setData, connecter, deconnecter }: { data: AppData; setData: (d: AppData, manuel?: { type: string; message: string; erreur?: boolean }) => void; connecter: (email: string, nom: string) => void; deconnecter: () => void }) {
  const [email, setEmail] = useState("mathieu.blandin@gmail.com");
  const [nom, setNom] = useState("Mathieu");
  const [msg, setMsg] = useState<string | null>(null);
  const [importText, setImportText] = useState(""); // US23 — JSON collé à importer
  const [apercuImport, setApercuImport] = useState<{ data: AppData; resume: string } | null>(null); // US23 — validation avant remplacement
  const [exportDonnees, setExportDonnees] = useState<string | null>(null); // US23 — export JSON affiché et copiable
  const [copieOk, setCopieOk] = useState<string | null>(null); // US23 — retour de copie
  const [confirmVider, setConfirmVider] = useState(false); // US23 — double confirmation de la remise à zéro
  const compte = data.account;
  const auj = new Date();

  const tenterConnexion = () => {
    if (!compteDepuisEmail(email)) { setMsg("Adresse Google invalide (ex. : prenom.nom@gmail.com)."); return; }
    setMsg(null);
    connecter(email, nom); // reconnexion → restauration de l'espace du compte si déjà connu (US14)
  };

  const sync = () => {
    const r = synchroniserAgenda(data, auj);
    if (r.resume.erreur) tracer("sync_agenda", "synchronisation refusée : " + r.resume.erreur, undefined, true); // US22 — refus tracé comme erreur
    setData(r.data);
    setMsg(r.resume.erreur ?? `Agenda synchronisé : ${r.resume.crees} créé(s), ${r.resume.maj} mise(s) à jour, ${r.resume.retires} retiré(s).`);
  };

  // US23 — portabilité : export, import contrôlé en deux temps, remise à zéro confirmée (espace actif uniquement)
  const exporter = () => {
    setExportDonnees(exporterDonnees(data));
    tracer("donnees", "export des données de l'espace actif (format objectifs-donnees-v1)");
    setMsg("Export généré — copiez le JSON et conservez-le précieusement.");
  };
  const copierExport = async () => {
    if (!exportDonnees) return;
    try { await navigator.clipboard.writeText(exportDonnees); setCopieOk("Export copié dans le presse-papiers ✔"); }
    catch { setCopieOk("Copie indisponible — sélectionnez le JSON manuellement"); }
  };
  const verifierImport = () => {
    const r = importerDonnees(data, importText);
    if (!r.data || r.erreur) { // refus explicite : rien n'est modifié
      tracer("erreur", "import de données refusé : " + (r.erreur ?? "raison inconnue"), undefined, true);
      setApercuImport(null); setMsg(r.erreur ?? "import impossible.");
      return;
    }
    const g = r.data.goals.length, t = r.data.tasks.filter((x) => !x.supprimee).length, e = r.data.entries.length;
    setApercuImport({ data: r.data, resume: g + " objectif(s) · " + t + " tâche(s) · " + e + " saisie(s)" });
    setMsg(null);
  };
  const confirmerImport = () => {
    if (!apercuImport) return;
    setData(apercuImport.data, { type: "donnees", message: "import de données externes (remplacement complet de l'espace actif) : " + apercuImport.resume });
    setApercuImport(null); setImportText(""); setMsg("Données importées — espace remplacé.");
  };
  const vider = () => {
    setData(etatVide(data), { type: "donnees", message: "remise à zéro de l'espace actif (toutes les données vidées)" });
    setConfirmVider(false); setApercuImport(null); setMsg("Espace vidé — prêt pour un nouveau départ.");
  };

  const planifiees = actives(data.tasks).filter((t) => t.etat !== "terminee" && t.date);
  const statuts = planifiees.map((t) => ({ t, statut: statutSyncTache(t, data.agenda, auj) }));
  const aSync = statuts.filter((s) => s.statut !== "a_jour").length;
  const retirables = Object.keys(data.agenda.events).filter((id) => { const t = data.tasks.find((x) => x.id === id); return !t || statutSyncTache(t, data.agenda, auj) === "hors_agenda"; }).length;
  const journal = [...data.agenda.log].slice(-6).reverse();
  const actionLabel: Record<SyncLogEntry["action"], string> = { cree: "créé", maj: "mis à jour", retire: "retiré" };

  return (
    <div>
      <Card className="p-3 mb-3 bg-gradient-to-r from-sky-50 to-blue-50 border-sky-200">
        <div className="text-sm font-semibold mb-2">Compte Google</div>
        {compte ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-white flex items-center justify-center text-sm font-bold">{(compte.nom || compte.email).charAt(0).toUpperCase()}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold">{compte.nom || compte.email} <span className="text-xs text-emerald-600">🟢 connecté</span></div>
                <div className="text-[11px] text-slate-500">{compte.email}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => { deconnecter(); setMsg(null); }}>Se déconnecter</Button>
            </div>
            <div className="text-[11px] text-slate-500">Données enregistrées dans l'espace du compte (cloisonnées) — la déconnexion n'efface rien, la reconnection retrouve tout à l'identique.</div>
          </div>
        ) : (
          <div>
            <div className="flex items-end gap-2 mb-2">
              <label className="text-xs flex-1">Adresse Google<input className="w-full border rounded px-2 py-1 text-sm" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <label className="text-xs w-28">Nom<input className="w-full border rounded px-2 py-1 text-sm" value={nom} onChange={(e) => setNom(e.target.value)} /></label>
              <Button size="sm" onClick={tenterConnexion}>Se connecter</Button>
            </div>
            <div className="text-[11px] text-slate-500">OAuth réel au livrable PWA — simulation sur maquette. Un seul compte actif à la fois (multi-comptes à chaud : V2).</div>
          </div>
        )}
        {msg && <div className="text-xs mt-1 text-indigo-600">{msg}</div>}
      </Card>
      <Card className="p-3 mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-semibold">Synchronisation de l'agenda</div>
          <Button size="sm" disabled={!compte} onClick={sync}>{compte ? "🔄 Synchroniser" : "🔄 Se connecter pour synchroniser"}</Button> {/* US31/P7 — libellé explicite hors connexion (l'ancien ternaire affichait le même libellé des deux côtés) */}
        </div>
        <div className="text-xs text-slate-500 mb-2">
          Dernière synchro : <b>{data.agenda.lastSync ? data.agenda.lastSync.replace("T", " à ") : "jamais"}</b>
          {compte ? ` · calendrier de ${compte.email}` : ""}
          {compte && (aSync + retirables) > 0 ? ` · ${aSync + retirables} élément(s) à synchroniser` : compte && planifiees.length > 0 ? " · tout est à jour ✅" : ""}
        </div>
        {!compte && <div className="text-xs text-slate-500 mb-2">La synchronisation est refusée sans compte connecté (message explicite au clic).</div>}
        {planifiees.length === 0 && compte && <div className="text-xs text-slate-500 mb-2">Aucune tâche planifiée à synchroniser.</div>}
        {statuts.map(({ t, statut }) => (
          <div key={t.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: data.goals.find((g) => g.id === t.goalId)?.color ?? "#999" }} />
            <span className="flex-1">{t.title}</span>
            <span className="text-[11px] text-slate-500 w-16 text-right">{fmtIso(t.date)}</span>
            <Badge className={statut === "a_jour" ? "bg-emerald-100 text-emerald-700" : statut === "nouveau" ? "bg-amber-100 text-amber-700" : "bg-orange-100 text-orange-700"}>
              {statut === "a_jour" ? "à jour" : statut === "nouveau" ? "nouvelle" : "à synchroniser"}
            </Badge>
          </div>
        ))}
        <div className="text-[11px] text-slate-500 mt-1">Un événement par tâche planifiée (titre, date réelle, charge restante) ; mis à jour si la date change, retiré si la tâche est terminée/supprimée/déplanifiée.</div>
      </Card>
      <Card className="p-3">
        <div className="text-sm font-semibold mb-2">Journal de synchronisation</div>
        {journal.length === 0 && <div className="text-xs text-slate-500">Aucune opération pour l'instant.</div>}
        {journal.map((l, i) => {
          const t = data.tasks.find((x) => x.id === l.taskId);
          return (
            <div key={i} className="text-xs text-slate-600 py-0.5">
              <b>{actionLabel[l.action]}</b> — {t?.title ?? l.taskId} · {l.at.replace("T", " à ")}
            </div>
          );
        })}
      </Card>
      <Card className="p-3 mt-3 bg-gradient-to-r from-slate-50 to-zinc-100 border-slate-200">
        <div className="text-sm font-semibold mb-1">💾 Vos données — sauvegarde et portabilité</div>
        <div className="text-[11px] text-slate-500 mb-2">
          Espace actif : <b>{compte ? "compte " + compte.id : "local (sans compte)"}</b> — les opérations ci-dessous ne touchent que cet espace ; le journal d'activité (US22) et les autres espaces sont conservés.
        </div>
        <div className="flex gap-2 flex-wrap mb-2">
          <Button size="sm" variant="outline" onClick={exporter}>⬇ Exporter mes données (JSON)</Button>
          <Button size="sm" variant="outline" onClick={() => setConfirmVider(true)}>🗑 Vider l'espace</Button>
        </div>
        {confirmVider && (
          <div className="bg-red-50 border border-red-200 rounded p-2 mb-2">
            <div className="text-xs text-red-700 font-semibold mb-1">Vider définitivement toutes les données de l'espace actif ?</div>
            <div className="text-[11px] text-red-600 mb-2">Objectifs, tâches, saisies et agenda seront supprimés. Pensez à exporter une sauvegarde avant.</div>
            <div className="flex gap-1">
              <button onClick={exporter} className="text-[11px] px-2 py-1 rounded bg-white border border-red-300 text-red-700">⬇ Exporter d'abord</button>
              <button onClick={vider} className="text-[11px] px-2 py-1 rounded bg-red-600 text-white">Confirmer la remise à zéro</button>
              <button onClick={() => setConfirmVider(false)} className="text-[11px] px-2 py-1 rounded bg-white/60 text-red-700" aria-label="annuler">✕</button>
            </div>
          </div>
        )}
        {exportDonnees && (
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs font-semibold">Export « objectifs-donnees-v1 »</div>
              <div className="flex gap-1">
                <Button size="sm" className="text-xs h-6" onClick={copierExport}>📋 Copier</Button>
                <Button size="sm" variant="outline" className="text-xs h-6" onClick={() => { setExportDonnees(null); setCopieOk(null); }}>✕</Button>
              </div>
            </div>
            {copieOk && <div className="text-xs text-emerald-600 mb-1">{copieOk}</div>}
            <pre className="text-xs bg-slate-900 text-slate-100 rounded p-2 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all">{exportDonnees}</pre> {/* US31/P7 — export lisible (12 px) */}
          </div>
        )}
        <div className="border-t border-slate-100 pt-2">
          <div className="text-xs font-semibold mb-1">📥 Importer des données</div>
          <textarea className="w-full border rounded px-2 py-1 text-[11px] font-mono h-16" placeholder="Collez ici un export « objectifs-donnees-v1 »…" value={importText} onChange={(e) => setImportText(e.target.value)} />
          <div className="mt-1">
            <Button size="sm" disabled={!importText.trim()} onClick={verifierImport}>Vérifier l'import</Button>
          </div>
          {apercuImport && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2">
              <div className="text-xs text-amber-800 font-semibold mb-1">Import valide : {apercuImport.resume}</div>
              <div className="text-[11px] text-amber-700 mb-2">Remplacement complet de l'espace actif — exportez d'abord vos données actuelles si besoin.</div>
              <div className="flex gap-1">
                <button onClick={confirmerImport} className="text-[11px] px-2 py-1 rounded bg-amber-600 text-white">Confirmer l'import</button>
                <button onClick={() => setApercuImport(null)} className="text-[11px] px-2 py-1 rounded bg-white/70 text-amber-800" aria-label="annuler">✕</button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ==================== US22 — Journal d'activité par lots (diagnostic MCO) ====================
// Stockage autonome hors schéma (précédent US21) : jamais soumis au contrôle d'intégrité des
// données métier ; toute erreur de lecture/écriture est silencieuse — le journal ne peut ni
// bloquer ni altérer l'application, c'est sa raison d'être MCO. Aucun secret dans les traces.

interface JournalEvent { at: string; type: string; message: string; contexte?: Record<string, string | number | boolean | null>; erreur?: boolean; }
interface JournalLot { date: string; evenements: JournalEvent[]; }
interface Journal { lots: JournalLot[]; }

const JOURNAL_KEY = "objectifs-app-journal";
const JOURNAL_MAX_LOTS = 30; // rotation : les 30 derniers lots quotidiens sont conservés

// Horodatage ISO local précis à la seconde — celui du moment de l'événement (pas de l'écriture)
function horodatage(d: Date): string {
  return isoLocal(d) + "T" + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0");
}

// US14 — clé du journal cloisonnée par compte, cohérente avec le cloisonnement des données
function journalCle(accountId: string | null): string { return accountId ? JOURNAL_KEY + "::" + accountId : JOURNAL_KEY; }

// Ajout pur : l'événement rejoint le lot du jour courant (créé au besoin) ; rotation des 30 derniers lots
function ajouterEvenement(journal: Journal, evt: JournalEvent, now = new Date()): Journal {
  const jour = isoLocal(now);
  const lots = [...journal.lots];
  const i = lots.findIndex((l) => l.date === jour);
  if (i >= 0) lots[i] = { ...lots[i], evenements: [...lots[i].evenements, evt] };
  else lots.push({ date: jour, evenements: [evt] });
  return { lots: lots.sort((a, b) => b.date.localeCompare(a.date)).slice(0, JOURNAL_MAX_LOTS) };
}

function chargerJournal(cle: string): Journal {
  try { const raw = localStorage.getItem(cle); if (raw) { const j = JSON.parse(raw); if (j && Array.isArray(j.lots)) return j; } } catch { /* silencieux */ }
  return { lots: [] };
}
function sauverJournal(cle: string, journal: Journal): void {
  try { localStorage.setItem(cle, JSON.stringify(journal)); } catch { /* silencieux */ }
}

// Export MCO — format documenté et stable « objectifs-journal-lot-v1 » : en-tête de contexte
// (versions, plateforme, espace actif — compte ou local —, bornes du lot, dénombrements) + événements.
function exporterLot(lot: JournalLot, contexte: { versionApp: string; versionSchema: number; plateforme: string; espace: string }, journaux?: { migrations: MigrationLogEntry[]; synchronisation: SyncLogEntry[] }): string {
  return JSON.stringify({
    format: "objectifs-journal-lot-v1",
    contexte: {
      application: "Objectifs",
      versionApp: contexte.versionApp,
      versionSchema: contexte.versionSchema,
      plateforme: contexte.plateforme,
      espace: contexte.espace, // identifiant du compte actif ou "local"
      lot: lot.date, // identifiant du lot = journée locale yyyy-mm-dd
      bornes: { premierEvenement: lot.evenements[0]?.at ?? null, dernierEvenement: lot.evenements[lot.evenements.length - 1]?.at ?? null },
      nbEvenements: lot.evenements.length,
      nbErreurs: lot.evenements.filter((e) => e.erreur).length,
    },
    journauxExistants: { // recette it. 5 — journaux US16 (migrations) et US1 (synchronisation) repris à l'export, jamais dupliqués dans le journal US22
      migrations: journaux?.migrations ?? [],
      synchronisation: journaux?.synchronisation ?? [],
    },
    evenements: lot.evenements,
  }, null, 2);
}

// Détection des changements applicatifs → événements du catalogue US22 (pure, testable).
// Confidentialité : identifiants, titres, états, dénombrements uniquement — jamais de secret.
function evenementsDeDiff(prev: AppData, next: AppData, now = new Date()): JournalEvent[] {
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

// Journal actif en mémoire (module) — bascule d'espace au fil des connexions, échec silencieux
let journalMemoire: Journal | null = null;
let journalCleActive: string | null = null;
let dernierJourTrace: string | null = null; // US22 — détection du changement de jour

function activerJournal(accountId: string | null): void {
  try {
    journalCleActive = journalCle(accountId);
    journalMemoire = chargerJournal(journalCleActive);
  } catch { journalMemoire = null; journalCleActive = null; }
}

// Trace un événement dans le lot du jour courant — ne lève jamais, n'altère jamais les données métier
function tracer(type: string, message: string, contexte?: JournalEvent["contexte"], erreur?: boolean, now = new Date()): void {
  try {
    if (!journalMemoire || !journalCleActive) return;
    journalMemoire = ajouterEvenement(journalMemoire, { at: horodatage(now), type, message, contexte, erreur }, now);
    sauverJournal(journalCleActive, journalMemoire);
  } catch { /* silencieux — le journal ne bloque jamais l'application */ }
}

// ==================== US23 — Portabilité des données (export / import / remise à zéro) ====================

// Export au format documenté et stable « objectifs-donnees-v1 » : en-tête de contexte (versions, espace
// actif, date) + données applicatives complètes de l'espace actif. Le compte connecté est exclu :
// donnée de session, re-résolue à l'import selon l'espace actif (US14). Aucun secret (US22).
function exporterDonnees(data: AppData, now = new Date()): string {
  return JSON.stringify({
    format: "objectifs-donnees-v1",
    contexte: {
      application: "Objectifs",
      versionApp: APP_VERSION,
      versionSchema: SCHEMA_VERSION,
      espace: data.account?.id ?? "local",
      dateExport: isoDateTime(now),
    },
    donnees: { ...deepClone(data), account: null },
  }, null, 2);
}

// Import contrôlé (pur) : format reconnu → migration US16 si schéma antérieur (journal des migrations
// alimenté) → contrôle d'intégrité → remplacement de l'espace actif. Tout refus est explicite et
// ne modifie rien : data === null. Le compte de session est conservé (donnée hors export).
function importerDonnees(espace: AppData, json: string): { data: AppData | null; erreur: string | null } {
  let obj: any;
  try { obj = JSON.parse(json); } catch { return { data: null, erreur: "JSON illisible — vérifiez le contenu collé." }; }
  if (!obj || obj.format !== "objectifs-donnees-v1" || !obj.donnees || typeof obj.donnees !== "object")
    return { data: null, erreur: "Format non reconnu : un export « objectifs-donnees-v1 » est attendu." };
  const d = deepClone(obj.donnees);
  if (typeof d.version !== "number") return { data: null, erreur: "version de schéma absente dans l'export." };
  if (d.version > SCHEMA_VERSION) return { data: null, erreur: "export issu du schéma v" + d.version + ", supérieur au schéma courant v" + SCHEMA_VERSION + " — mettez l'application à jour avant d'importer." };
  let cible = d;
  if (d.version < SCHEMA_VERSION) {
    const r = migrateData(d);
    if (r.error || !r.data) return { data: null, erreur: "import refusé : " + (r.error ?? "migration impossible.") };
    cible = r.data;
  }
  const err = checkIntegrity(cible);
  if (err) return { data: null, erreur: "import refusé (contrôle d'intégrité) : " + err };
  return { data: { ...cible, account: espace.account }, erreur: null };
}

// US23 — état vide conforme : zéro objectif, tâche, saisie ; agenda réinitialisé (sinon l'intégrité
// refuserait des événements orphelins de leurs tâches) ; préférences et journal des migrations
// conservés (l'histoire du schéma appartient à l'espace) ; vélocité nulle par construction.
function etatVide(data: AppData): AppData {
  return {
    version: SCHEMA_VERSION,
    preferences: data.preferences,
    account: data.account,
    agenda: { lastSync: null, events: {}, log: [] },
    goals: [],
    tasks: [],
    entries: [],
    migrationLog: data.migrationLog,
  };
}

// ==================== Écran : Rituel (US11) ====================

// A11/US15 — préférences de rappel persistées (clé distincte des données applicatives, sans impact sur le schéma)
const RITUEL_PREFS_KEY = "objectifs-app-rituel";
const DEFAULT_RITUEL_PREFS = { notifSoir: true, notifMatin: true, heureSoir: "21:00", heureMatin: "07:00" };
function loadRituelPrefs(): typeof DEFAULT_RITUEL_PREFS {
  try {
    const raw = localStorage.getItem(RITUEL_PREFS_KEY);
    if (raw) return { ...DEFAULT_RITUEL_PREFS, ...JSON.parse(raw) };
  } catch { /* mémoire seule */ }
  return { ...DEFAULT_RITUEL_PREFS };
}

function Rituel({ data, setData, goTaches, ouvrirFiche, vel }: { data: AppData; setData: (d: AppData) => void; goTaches: () => void; ouvrirFiche: (id: string) => void; vel: ReturnType<typeof computeVelocity> }) { // US27 — fiche accessible depuis le rituel ; v0.11.3 — vel requis par le tri d'urgence US30 (régression it. 9 : prop déclarée absente → ReferenceError à l'ouverture de l'onglet)
  const [moment, setMoment] = useState<"soir" | "matin">("soir");
  const [saisies, setSaisies] = useState<Record<string, { passe: string; restant: string }>>({});
  const [acceptees, setAcceptees] = useState<Record<string, boolean>>({});
  const [notifSoir, setNotifSoir] = useState(() => loadRituelPrefs().notifSoir); // A11 — préférences restaurées au chargement
  const [notifMatin, setNotifMatin] = useState(() => loadRituelPrefs().notifMatin);
  const [heureSoir, setHeureSoir] = useState(() => loadRituelPrefs().heureSoir); // US11 — heures de rappel paramétrables
  const [heureMatin, setHeureMatin] = useState(() => loadRituelPrefs().heureMatin);
  const [msg, setMsg] = useState<string | null>(null);
  const [faits] = useState(() => { // US21 — fait scientifique du jour, tiré parmi les moins affichés (compteur persisté)
    const s = faitDuJour(loadFaitsState(), new Date().toISOString().slice(0, 10));
    try { localStorage.setItem(FAITS_KEY, JSON.stringify(s)); } catch { /* mémoire seule */ }
    return s;
  });

  useEffect(() => { // A11 — les préférences survivent au rechargement (US15)
    try { localStorage.setItem(RITUEL_PREFS_KEY, JSON.stringify({ notifSoir, notifMatin, heureSoir, heureMatin })); } catch { /* mémoire seule */ }
  }, [notifSoir, notifMatin, heureSoir, heureMatin]);

  const auj = isoDuJour(); // US26 — ISO du jour réel (plus de libellé « aujourd'hui »)
  const demain = isoDuLendemain(); // US26 — ISO du lendemain
  const jour = data.tasks.filter((t) => t.date === auj && t.etat !== "terminee" && !t.supprimee);
  // US19 — les tâches bloquées sont exclues des suggestions du rituel du soir
  // Itération 7 / US30 — suggestions triées par urgence : échéance de l'objectif d'abord, « à risque », priorités
  const suggestions = triParUrgence(
    data.tasks.filter((t) => t.etat === "a_planifier" && !t.supprimee && bloqueursDe(t, data.tasks).length === 0),
    data.goals, data.tasks, vel.velocite
  ).slice(0, 3);

  const validerTemps = () => {
    try {
      let tasks = data.tasks;
      let entries = [...data.entries];
      let count = 0;
      for (const t of jour) {
        const s = saisies[t.id];
        const passe = s?.passe ? parseFloat(s.passe) : NaN;
        const restant = s?.restant !== undefined && s.restant !== "" ? parseFloat(s.restant) : NaN;
        if (isNaN(passe) || isNaN(restant) || passe < 0 || restant < 0)
          throw new Error(`« ${t.title} » : temps passé et temps restant obligatoires`);
        if (passe > 0 || restant !== t.restant) {
          const bloq = bloqueursDe(t, data.tasks); // US19 — une tâche bloquée ne passe pas en cours
          if (bloq.length > 0) throw new Error(`« ${t.title} » bloquée par : ${bloq.map((b) => b.title).join(", ")}`);
          const { task, entry } = saisieTemps(t, passe, restant);
          tasks = tasks.map((x) => (x.id === t.id ? task : x));
          if (entry) entries.push(entry);
          count++;
        }
      }
      setData({ ...data, tasks, entries });
      setSaisies({}); setMsg(count + " saisie(s) enregistrée(s)");
    } catch (e: any) { tracer("erreur", "Exception attrapée : " + e.message, undefined, true); setMsg(e.message); }
  };

  const validerLendemain = () => {
    setData({ ...data, tasks: data.tasks.map((t) => (acceptees[t.id] ? { ...avecEtat(t, "planifiee"), date: demain } : t)) }); // Passe 3 — état journalisé ; US26 — ISO du lendemain
    setMsg("Actions planifiées pour demain");
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-3" role="tablist" aria-label="Moment du rituel">
        <button role="tab" aria-selected={moment === "soir"} onClick={() => setMoment("soir")}
          className={"py-2 px-2 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 transition " + (moment === "soir" ? "bg-indigo-600 border-indigo-600 text-white shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50")}>
          🌙 Bilan du soir · {heureSoir}
        </button>
        <button role="tab" aria-selected={moment === "matin"} onClick={() => setMoment("matin")}
          className={"py-2 px-2 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 transition " + (moment === "matin" ? "bg-amber-500 border-amber-500 text-white shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50")}>
          ☀️ Revue du matin · {heureMatin}
        </button>
      </div>
      {moment === "soir" ? (
        <div>
          <Card className="p-3 mb-3">
            <div className="text-sm font-semibold mb-1">1. Temps du jour (passé + restant obligatoires)</div>
            {jour.length === 0 && <div className="text-xs text-slate-500">Aucune tâche active aujourd'hui.</div>}
            {jour.map((t) => (
              <div key={t.id} className="py-2 border-b border-slate-100 last:border-0">
                <div className="text-sm">{t.title} <span className="text-xs text-slate-500">({h(t.restant)} restantes)</span></div> {/* US33 — durée lisible */}
                <div className="flex gap-2 mt-1">
                  <label className="text-xs flex items-center gap-1">Passé<input className="w-16 border rounded px-1 text-xs py-0.5" type="number" min="0" step="0.5" value={saisies[t.id]?.passe ?? ""} onChange={(e) => setSaisies((s) => ({ ...s, [t.id]: { passe: e.target.value, restant: s?.[t.id]?.restant ?? "" } }))} /></label>
                  <label className="text-xs flex items-center gap-1">Restant<input className="w-16 border rounded px-1 text-xs py-0.5" type="number" min="0" step="0.5" value={saisies[t.id]?.restant ?? ""} onChange={(e) => setSaisies((s) => ({ ...s, [t.id]: { passe: s?.[t.id]?.passe ?? "", restant: e.target.value } }))} /></label>
                </div>
              </div>
            ))}
            <Button size="sm" className="mt-2 w-full" onClick={validerTemps}>Enregistrer les saisies</Button>
          </Card>
          <Card className="p-3 mb-3">
            <div className="text-sm font-semibold mb-1">2. Actions de demain (triées par urgence — l'échéance de l'objectif d'abord)</div>
            {suggestions.map((t) => {
              const g = data.goals.find((x) => x.id === t.goalId);
              const risque = g ? smartCheck(g, data.tasks, vel.velocite).risque : false; // US30 — motif d'urgence
              return (
                <div key={t.id} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                  <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <input type="checkbox" checked={!!acceptees[t.id]} onChange={(e) => setAcceptees((a) => ({ ...a, [t.id]: e.target.checked }))} className="accent-indigo-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{t.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {risque ? "⚠ à risque · " : ""}{g?.echeance ? "échéance " + fmtIso(g.echeance) : "sans échéance"}{t.date ? ` · déjà datée ${fmtIso(t.date)}` : ""}
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">{h(t.restant)}</span> {/* US33 — durée lisible */}
                    <Badge className={prioBadge[t.prio]}>{t.prio}</Badge>
                  </label>
                  <button onClick={() => ouvrirFiche(t.id)} className="w-9 h-9 rounded-lg text-sm shrink-0 hover:bg-slate-100" title="Fiche de la tâche — édition complète (US27)" aria-label={"ouvrir la fiche de la tâche « " + t.title + " »"}>✏️</button> {/* US27 — fiche accessible depuis les suggestions du rituel (hors périmètre US32) */}
                </div>
              );
            })}
            <Button size="sm" className="mt-2 w-full" onClick={validerLendemain}>Planifier pour demain</Button>
          </Card>
          <Card className="p-3">
            <div className="text-sm font-semibold mb-2">Rappels</div>
            <div className="flex items-center justify-between py-1 text-sm"><span>Notification du soir</span>
              <span className="flex items-center gap-2"><Input className="w-20 h-7 text-xs" type="time" value={heureSoir} onChange={(e) => setHeureSoir(e.target.value)} /><Switch checked={notifSoir} onCheckedChange={setNotifSoir} /></span></div>
            <div className="flex items-center justify-between py-1 text-sm"><span>Notification du matin</span>
              <span className="flex items-center gap-2"><Input className="w-20 h-7 text-xs" type="time" value={heureMatin} onChange={(e) => setHeureMatin(e.target.value)} /><Switch checked={notifMatin} onCheckedChange={setNotifMatin} /></span></div>
            <div className="text-[11px] text-slate-500">Heures paramétrables, notifications activables/désactivables (les notifications Android réelles relèvent du livrable natif).</div>
          </Card>
        </div>
      ) : (
        <div>
          <Card className="p-3 mb-3">
            <div className="text-sm font-semibold mb-1">Programme du jour</div>
            {[...jour, ...data.tasks.filter((t) => t.date === demain && !t.supprimee)].map((t, i) => (
              <div key={t.id + i} className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
                <span className="text-xs text-slate-500 w-12">{t.date === auj ? "auj." : "demain"}</span>
                <div className="flex-1 text-sm">{t.title}</div>
                <span className="text-xs text-slate-500">{h(t.restant)}</span>
                <Button size="sm" variant="outline" className="text-xs h-6" onClick={() => setData({ ...data, tasks: data.tasks.map((x) => (x.id === t.id ? { ...x, date: x.date === auj ? demain : auj } : x)) })}>↕</Button>
                <button onClick={() => ouvrirFiche(t.id)} className="w-9 h-9 rounded-lg text-sm shrink-0 hover:bg-slate-100" title="Fiche de la tâche — édition complète (US27)" aria-label={"ouvrir la fiche de la tâche « " + t.title + " »"}>✏️</button> {/* US27 — fiche accessible depuis le programme du matin (hors périmètre US32) */}
              </div>
            ))}
          </Card>
          <Card className="p-3">
            <div className="text-sm font-semibold mb-2">Ajuster la journée</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={goTaches}>+ Ajouter une tâche</Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => { setData({ ...data, tasks: data.tasks.map((x) => (x.date === auj && x.etat !== "terminee" ? { ...x, date: demain } : x)) }); setMsg("Programme du jour déplacé à demain"); }}>Déplacer vers demain</Button>
            </div>
          </Card>
        </div>
      )}
      {(() => { // US21 — le saviez-vous ? (même fait toute la journée, compteur d'affichages persisté)
        const fait = FAITS_SCIENTIFIQUES.find((f) => f.id === faits.id);
        if (!fait) return null;
        const n = FAITS_SCIENTIFIQUES.indexOf(fait) + 1;
        return (
          <Card className="p-3 mt-3 bg-gradient-to-r from-violet-50 to-fuchsia-50 border-violet-200">
            <div className="text-sm font-semibold text-violet-800 mb-1">🧪 Le saviez-vous ?</div>
            <div className="text-xs text-slate-700">{fait.fr}</div>
            <div className="text-[11px] text-slate-500 mt-1">Fait n° {n}/{FAITS_SCIENTIFIQUES.length} · déjà affiché {faits.counts[fait.id] ?? 1} fois</div>
          </Card>
        );
      })()}
      {msg && <div className="text-xs mt-2 text-indigo-600">{msg}</div>}
    </div>
  );
}

// ==================== Écran : Journal (US22 — diagnostic MCO) ====================

function JournalScreen({ data, goTaches }: { data: AppData; goTaches: () => void }) { // US33-c2 — état vide guidé avec action directe
  const espaceId = data.account?.id ?? null;
  const journal = chargerJournal(journalCle(espaceId)); // lecture fraîche à chaque rendu (le traçage est silencieux et indépendant)
  const [lotSel, setLotSel] = useState<string | null>(null);
  const [exportJson, setExportJson] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);
  const lot = journal.lots.find((l) => l.date === (lotSel ?? journal.lots[0]?.date)) ?? null;
  const nbErreurs = (l: JournalLot) => l.evenements.filter((e) => e.erreur).length;

  const exporter = () => {
    if (!lot) return;
    setExportJson(exporterLot(lot, { versionApp: APP_VERSION, versionSchema: SCHEMA_VERSION, plateforme: "maquette React (navigateur)", espace: espaceId ?? "local" }, { migrations: data.migrationLog, synchronisation: data.agenda.log }));
  };
  const copier = async () => {
    if (!exportJson) return;
    try { await navigator.clipboard.writeText(exportJson); setCopie("Export copié dans le presse-papiers ✔"); }
    catch { setCopie("Copie indisponible — sélectionnez le JSON ci-dessous manuellement"); }
  };

  return (
    <div>
      <Card className="p-3 mb-3 bg-gradient-to-r from-slate-50 to-zinc-100 border-slate-200">
        <div className="text-sm font-semibold mb-1">🧾 Journal d'activité (diagnostic MCO)</div>
        <div className="text-xs text-slate-500">
          Traçage silencieux par lots quotidiens — les {JOURNAL_MAX_LOTS} derniers jours sont conservés.
          Espace actif : <b>{espaceId ? "compte " + espaceId : "local (sans compte)"}</b>. Aucune donnée sensible n'est journalisée.
        </div>
      </Card>

      {journal.lots.length === 0 ? (
        <Card className="p-3 text-xs text-slate-500">
          Aucun événement journalisé pour le moment — utilise l'application (crée un objectif, saisis du temps, fais le rituel), les traces apparaîtront ici.
          <div className="mt-1"><Button size="sm" variant="outline" className="min-h-[44px]" onClick={goTaches}>✅ Aller aux tâches</Button></div>
        </Card>
      ) : (
        <>
          <Card className="p-3 mb-3">
            <div className="text-sm font-semibold mb-2">Lots quotidiens ({journal.lots.length}/{JOURNAL_MAX_LOTS})</div>
            <div className="flex flex-wrap gap-1">
              {journal.lots.map((l) => (
                <button key={l.date} onClick={() => { setLotSel(l.date); setExportJson(null); setCopie(null); }}
                  className={"text-[11px] px-2 py-1 rounded-full " + (lot?.date === l.date ? "bg-indigo-600 text-white" : nbErreurs(l) > 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                  {fmtJour(l.date + "T00:00:00")} · {l.evenements.length} évt{nbErreurs(l) > 0 ? " · ⚠ " + nbErreurs(l) : ""}
                </button>
              ))}
            </div>
          </Card>

          {lot && (
            <Card className="p-3 mb-3">
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-semibold">Événements du {fmtJour(lot.date + "T00:00:00")} <span className="text-xs text-slate-500">({lot.evenements.length}, dont {nbErreurs(lot)} erreur(s))</span></div>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={exporter}>⬇ Export MCO (JSON)</Button>
              </div>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {lot.evenements.map((e, i) => (
                  <div key={i} className={"text-xs flex gap-2 items-baseline " + (e.erreur ? "text-red-600" : "text-slate-600")}>
                    <span className="text-[11px] text-slate-500 w-14 shrink-0">{e.at.slice(11)}</span>
                    <Badge className={e.erreur ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}>{e.type}</Badge>
                    <span className="flex-1">{e.erreur ? "⚠ " : ""}{e.message}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {exportJson && (
        <Card className="p-3 mb-3">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-semibold">Export MCO — format « objectifs-journal-lot-v1 »</div>
            <div className="flex gap-1">
              <Button size="sm" className="text-xs h-7" onClick={copier}>📋 Copier</Button>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setExportJson(null); setCopie(null); }}>✕</Button>
            </div>
          </div>
          {copie && <div className="text-xs text-emerald-600 mb-1">{copie}</div>}
          <pre className="text-[11px] bg-slate-900 text-slate-100 rounded p-2 overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap break-all">{exportJson}</pre>
        </Card>
      )}
    </div>
  );
}

// ==================== App ====================

export default function App() {
  const [loaded] = useState(() => {
    const r = loadAppData();
    activerJournal(r.data.account?.id ?? null); // US22 — journal cloisonné sur l'espace actif
    dernierJourTrace = isoLocal(new Date()); // US22 — référence pour la détection du changement de jour
    return r;
  });
  const [statutStockage] = useState(statutStockageInitial); // v0.11.2 — sonde de persistance posée au démarrage, accès entièrement gardé (écran blanc v0.11.1 corrigé)
  const [data, setData] = useState<AppData>(loaded.data);
  const [tab, setTab] = useState("accueil");
  const [openGoal, setOpenGoal] = useState<string | null>(null); // usage réel — objectif ouvert depuis l'accueil
  const [confirmReset, setConfirmReset] = useState(false); // passe d'usage réel — rechargement des données de démo confirmé en 2 clics
  const [ficheId, setFicheId] = useState<string | null>(null); // US27 — fiche tâche en overlay, ouverte depuis n'importe quel écran

  useEffect(() => { // US15 — persistance ; US14 — écriture dans l'espace du compte connecté (cloisonnement)
    try { localStorage.setItem(cleStockage(data.account?.id ?? null), JSON.stringify({ ...data, version: SCHEMA_VERSION })); } catch { /* mémoire seule */ }
  }, [data]);

  useEffect(() => { // US22 — événement de démarrage (versions, migrations, intégrité, espace actif)
    tracer("demarrage", "démarrage de l'application", {
      versionApp: APP_VERSION, versionSchema: SCHEMA_VERSION,
      migrations: loaded.applied.join(", ") || "aucune",
      integrite: loaded.error ?? "ok",
      espace: loaded.data.account?.id ?? "local",
    });
    if (loaded.error) tracer("erreur", loaded.error, undefined, true); // recette it. 5 — erreur de chargement (données invalides / refus d'intégrité) tracée et mise en évidence
    tracer("stockage", "sonde de persistance : " + statutStockage, { statut: statutStockage }, statutStockage !== "persistant"); // v0.11.1 — incident du 19/10/2026 tracé au journal (US22)
  }, []);

  // US22 — détection du changement de jour (application restée ouverte au-delà de minuit)
  { const auj = isoLocal(new Date()); if (auj !== dernierJourTrace) { tracer("jour", "changement de jour : " + dernierJourTrace + " → " + auj); dernierJourTrace = auj; } }

  // US22 — point de passage unique : toute évolution des données est tracée (par diff, ou manuellement)
  const majData = (next: AppData, manuel?: { type: string; message: string; erreur?: boolean }) => {
    if (manuel) tracer(manuel.type, manuel.message, undefined, manuel.erreur);
    else for (const e of evenementsDeDiff(data, next)) tracer(e.type, e.message, e.contexte, e.erreur);
    setData(next);
  };

  const vel = useMemo(() => computeVelocity(data.entries), [data.entries]);

  const goObjectif = (id: string) => { setOpenGoal(id); setTab("objectifs"); }; // usage réel — clic sur un objectif depuis l'accueil
  const ouvrirFiche = (id: string) => setFicheId(id); // US27 — point d'entrée unique de la fiche tâche

  // US14 — connexion d'un compte Google (simulation OAuth) : restaure l'espace du compte s'il existe,
  // sinon adopte l'état local courant ; déconnexion : bascule sur les données locales sans rien effacer.
  const connecter = (email: string, nom: string) => {
    const compte = compteDepuisEmail(email, nom);
    if (!compte) return;
    let espace: AppData | null = null;
    try { const raw = localStorage.getItem(cleStockage(compte.id)); if (raw) espace = JSON.parse(raw); } catch { espace = null; }
    const restaure = espace && espace.version === SCHEMA_VERSION && !checkIntegrity(espace) ? { ...espace, account: compte } : { ...data, account: compte };
    activerJournal(compte.id); // US22 — bascule vers le journal du compte (cloisonné)
    majData(restaure, { type: "compte", message: "connexion du compte " + compte.nom + (espace ? " — espace du compte restauré" : " — espace initialisé depuis l'état local") });
  };
  const deconnecter = () => {
    let local: AppData | null = null;
    try { const raw = localStorage.getItem(cleStockage(null)); if (raw) local = JSON.parse(raw); } catch { local = null; }
    const retour = local && local.version === SCHEMA_VERSION && !checkIntegrity(local) ? { ...local, account: null } : { ...data, account: null };
    activerJournal(null); // US22 — bascule vers le journal local
    majData(retour, { type: "compte", message: "déconnexion — retour aux données locales" });
  };

  const screens: Record<string, React.ReactNode> = {
    accueil: <Accueil data={data} vel={vel} goRituel={() => setTab("rituel")} goObjectif={goObjectif} goObjectifs={() => setTab("objectifs")} ouvrirFiche={ouvrirFiche} />,
    objectifs: <Objectifs data={data} setData={majData} vel={vel} openGoalId={openGoal} ouvrirFiche={ouvrirFiche} />,
    taches: <Taches data={data} setData={majData} vel={vel} ouvrirFiche={ouvrirFiche} />,
    stats: <Stats data={data} vel={vel} goTaches={() => setTab("taches")} />,
    calendrier: <Calendrier data={data} setData={majData} />,
    google: <Google data={data} setData={majData} connecter={connecter} deconnecter={deconnecter} />,
    rituel: <Rituel data={data} setData={majData} goTaches={() => setTab("taches")} ouvrirFiche={ouvrirFiche} vel={vel} />, // v0.11.3 — vélocité passée au rituel (tri d'urgence US30)
    journal: <JournalScreen data={data} goTaches={() => setTab("taches")} />,
  };

  const nav = [
    { id: "accueil", label: "🌤️ Aujourd'hui" },
    { id: "objectifs", label: "🎯 Objectifs" },
    { id: "taches", label: "✅ Tâches" },
    { id: "stats", label: "📊 Stats" },
    { id: "calendrier", label: "📅 Calendrier" },
    { id: "google", label: "☁️ Google" },
    { id: "rituel", label: "🌙 Rituel" },
    { id: "journal", label: "🧾 Journal" },
  ];

  return (
    <div className="w-full max-w-md md:max-w-4xl mx-auto bg-gradient-to-b from-indigo-50 via-slate-50 to-slate-50 min-h-screen flex flex-col">
      <style>{`button:focus-visible, [role="button"]:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }`}</style> {/* US31-c3 — focus visible au clavier sur 100 % des interactifs */}
      <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white px-4 py-3 shadow-lg sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <h1 className="font-bold text-lg">🎯 Objectifs</h1>
          <div className="flex gap-1 items-center">
            {loaded.applied.length > 0 && <Badge className="bg-amber-400 text-amber-900">Migration : {loaded.applied.join(", ")}</Badge>}
            {loaded.error && <Badge className="bg-red-100 text-red-700">Erreur données</Badge>}
            <Badge className="bg-white/20 text-white">app v{APP_VERSION} · schéma v{SCHEMA_VERSION}</Badge>
            {data.account && <Badge className="bg-emerald-100 text-emerald-800 truncate max-w-[110px]" title={data.account.email}>👤 {data.account.nom || data.account.email}</Badge>}
            {confirmReset ? (
              <span className="flex gap-1 items-center">
                <button onClick={() => { majData(initialData(), { type: "donnees", message: "rechargement des données de démonstration (remplacement complet)" }); setConfirmReset(false); }} className="text-[11px] px-2 py-1 rounded bg-red-100 text-red-700" title="Remplacer TOUTES les données par le jeu de démonstration">Confirmer ↺ démo</button>
                <button onClick={() => setConfirmReset(false)} className="text-[11px] px-2 py-1 rounded bg-white/20 hover:bg-white/30" aria-label="annuler">✕</button>
              </span>
            ) : (
              <button onClick={() => setConfirmReset(true)} className="text-[11px] px-2 py-1 rounded bg-white/20 hover:bg-white/30" title="Recharger les données de démonstration (remplace toutes les données)">↺ Démo</button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-8 gap-1 mt-3">
          {nav.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)} aria-current={tab === n.id ? "page" : undefined}
              className={"py-2 px-1 text-[11px] rounded-lg min-h-[44px] leading-tight " + (tab === n.id ? "bg-white text-indigo-700 shadow font-semibold" : "bg-white/20 text-white hover:bg-white/30")}>
              {n.label}
            </button>
          ))}
        </div>
      </div>
      {statutStockage !== "persistant" && ( // v0.11.1 — garde-fou persistance : avertissement non bloquant tant que la persistance n'est pas confirmée
        <div role="alert" className="mx-4 mt-3 px-3 py-2 rounded-lg bg-amber-100 text-amber-900 text-xs border border-amber-300">
          ⚠️ <b>Stockage non persistant</b>{statutStockage === "indisponible" ? " (stockage indisponible)" : ""} — vos données peuvent être réinitialisées à la fermeture.
          Avant de fermer : onglet <b>☁️ Google → Exporter (US23)</b>, copiez le JSON ; à la réouverture : <b>Importer</b> dans ce même écran. Le journal (🧾) trace chaque démarrage.
        </div>
      )}
      <div className="flex-1 px-4 pt-4 pb-4 min-h-0 overflow-y-auto">{screens[tab]}</div>
      {ficheId && <FicheTache data={data} setData={majData} vel={vel} id={ficheId} onClose={() => setFicheId(null)} />} {/* US27 — fiche d'édition en overlay au-dessus de l'écran courant */}
      <div aria-hidden style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }} /> {/* usage réel — zone basse réservée (soft buttons Android) */}
    </div>
  );
}
