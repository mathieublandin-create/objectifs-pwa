export type Prio = "haute" | "moyenne" | "basse";
export type Etat = "a_planifier" | "planifiee" | "en_cours" | "terminee";

export interface Task {
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

export interface Goal {
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

export interface TimeEntry { id: string; taskId: string; date: string; hours: number; } // US4/US7 — journal des saisies
export interface MigrationLogEntry { name: string; from: number; to: number; date: string; } // US16/A5

export interface Preferences { capaciteJourOuvre: number; capaciteWeekEnd: number; } // US20 — capacité moyenne par défaut (heures/jour)
export interface Account { id: string; email: string; nom: string; } // US14 — compte Google unique (identifiant de cloisonnement)
export interface AgendaEvent { taskId: string; date: string; syncedAt: string; } // US1 — état connu de l'événement dans l'agenda externe
export interface SyncLogEntry { at: string; action: "cree" | "maj" | "retire"; taskId: string; } // US1 — journal de synchronisation

export interface AppData {
  version: number;
  preferences: Preferences;
  account: Account | null; // US14 — null = non connecté (données locales)
  agenda: { lastSync: string | null; events: Record<string, AgendaEvent>; log: SyncLogEntry[] }; // US1 — synchro Google Agenda
  goals: Goal[];
  tasks: Task[];
  entries: TimeEntry[];
  migrationLog: MigrationLogEntry[];
}
