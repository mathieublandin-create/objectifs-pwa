import type { Account, AgendaEvent, AppData, Etat, Goal, MigrationLogEntry, Prio, Preferences, Task, TimeEntry } from "./types";

export const SCHEMA_VERSION = 9;
export const STORAGE_KEY = "objectifs-app-data";

// ==================== US16 : migrations ====================

export const MIGRATIONS: { from: number; to: number; name: string; migrate: (d: any, now: Date) => any }[] = [
  {
    from: 1, to: 2, name: "v01_v02_saisie_deux_champs",
    migrate: (d, now: Date) => ({
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
    migrate: (d, now: Date) => {
      const today = isoLocal(now);
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
    migrate: (d, now: Date) => {
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
    migrate: (d, now: Date) => ({
      ...d,
      preferences: d.preferences ?? { capaciteJourOuvre: 6, capaciteWeekEnd: 3 },
    }),
  },
  {
    from: 5, to: 6, name: "v05_v06_compte_google",
    // US14 réduit — compte Google unique (cloisonnement par compte) ; US1 — état de synchronisation agenda
    migrate: (d, now: Date) => ({
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
    migrate: (d, now: Date) => {
      const today = isoLocal(now);
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
    migrate: (d, now: Date) => ({
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
    migrate: (d, now: Date) => {
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

export function deepClone<T>(o: T): T { return JSON.parse(JSON.stringify(o)); }

export function checkIntegrity(d: AppData): string | null {
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
    for (const [taskId, ev] of Object.entries(ag.events) as [string, AgendaEvent][]) {
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

export function migrateData(input: any, now: Date): { data: AppData | null; applied: string[]; untouched: any; error: string | null } {
  const untouched = deepClone(input);
  let current = deepClone(input);
  const applied: string[] = [];
  if (typeof current.version !== "number") return { data: null, applied, untouched, error: "version de schéma absente" };
  for (const m of MIGRATIONS) {
    if (current.version === m.from) {
      try {
        const next = m.migrate(deepClone(current), now);
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
  const logDate = isoLocal(now);
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


// Passe 3 — historisation des changements d'état : toute transition ajoute une entrée datée au journal
export function avecEtat(t: Task, etat: Etat, now: Date): Task {
  if (t.etat === etat) return t;
  return { ...t, etat, historiqueEtat: [...(t.historiqueEtat ?? []), { etat, date: isoLocal(now) }] };
}

export function saisieTemps(t: Task, tempsPasse: number, tempsRestant: number, now: Date, genId: () => string): { task: Task; entry: TimeEntry | null } {
  if (isNaN(tempsPasse) || isNaN(tempsRestant) || tempsPasse < 0 || tempsRestant < 0)
    throw new Error("temps passé et temps restant doivent être des nombres ≥ 0");
  if (tempsPasse === 0 && tempsRestant === t.restant) return { task: t, entry: null };
  const passe = Math.round((t.passe + tempsPasse) * 10) / 10;
  const restant = Math.round(tempsRestant * 10) / 10;
  const cible: Etat = restant === 0 ? "terminee" : "en_cours"; // complétion uniquement par saisie finalisée (passe d'usage 2)
  return {
    task: { ...avecEtat(t, cible, now), passe, restant, dateFin: cible === "terminee" ? isoLocal(now) : undefined }, // US2 — date réelle de complétion ; Passe 3 — état journalisé
    entry: { id: genId(), taskId: t.id, date: isoLocal(now), hours: tempsPasse },
  };
}

// Passe 2 — clôture de tâche : la complétion exige la saisie du temps passé TOTAL ajusté (obligatoire) ;
// le restant passe à 0, la date réelle de complétion est posée (US2), l'écart éventuel alimente la dérive (A3).
export function cloturerTache(t: Task, totalAjuste: number, now: Date, genId: () => string): { task: Task; entry: TimeEntry | null } {
  if (isNaN(totalAjuste) || totalAjuste < 0) throw new Error("temps passé total invalide : nombre ≥ 0 attendu");
  const total = Math.round(totalAjuste * 10) / 10;
  if (total < t.passe) throw new Error(`le temps passé total (${h(total)}) ne peut pas être inférieur au temps déjà logué (${h(t.passe)})`);
  return saisieTemps(t, Math.round((total - t.passe) * 10) / 10, 0, now, genId); // restant 0 → complétion + date réelle (US2)
}

// Passe 2 — historique du temps logué : groupements purs par jour (décroissant) et par tâche
export function grouperParJour(entries: TimeEntry[]): { date: string; lignes: { taskId: string; hours: number }[]; total: number }[] {
  const map = new Map<string, { taskId: string; hours: number }[]>();
  for (const e of entries) { const l = map.get(e.date) ?? []; l.push({ taskId: e.taskId, hours: e.hours }); map.set(e.date, l); }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, lignes]) => ({ date, lignes, total: Math.round(lignes.reduce((s, l) => s + l.hours, 0) * 10) / 10 }));
}
export function grouperParTache(entries: TimeEntry[], tasks: Task[]): { taskId: string; lignes: { date: string; hours: number }[]; total: number }[] {
  const map = new Map<string, { date: string; hours: number }[]>();
  for (const e of entries) { const l = map.get(e.taskId) ?? []; l.push({ date: e.date, hours: e.hours }); map.set(e.taskId, l); }
  return [...map.entries()].map(([taskId, lignes]) => ({ taskId, lignes: lignes.slice().sort((a, b) => a.date.localeCompare(b.date)), total: Math.round(lignes.reduce((s, l) => s + l.hours, 0) * 10) / 10 }))
    .sort((a, b) => (tasks.find((t) => t.id === a.taskId)?.title ?? a.taskId).localeCompare(tasks.find((t) => t.id === b.taskId)?.title ?? b.taskId));
}


export function createTask(data: AppData, t: { title: string; goalId: string; prio: Prio; estime: number; date?: string }, now: Date, genId: () => string): { data: AppData; task: Task } {
  // Itération 7 / US28 — champs obligatoires et contrôlés (titre, objectif lié, charge > 0, date valide si renseignée)
  const err = validerNouvelleTache(t, data.goals.filter((g) => !g.archive).map((g) => g.id));
  if (err) throw new Error(err);
  const date = t.date?.trim() || undefined; // itération 7 — date vide ou blanche normalisée (jamais « planifiée » avec une date vide)
  const task: Task = {
    id: genId(), // US24 — ids uniques même en création en lot (même milliseconde)
    title: t.title.trim(), goalId: t.goalId, prio: t.prio,
    etat: date ? "planifiee" : "a_planifier", estimeInitial: t.estime, passe: 0, restant: t.estime, date,
    historiqueEtat: [{ etat: date ? "planifiee" : "a_planifier", date: isoLocal(now) }], // Passe 3 — état initial journalisé
  };
  return { data: { ...data, tasks: [...data.tasks, task] }, task };
}

export const prioOrder: Record<Prio, number> = { haute: 0, moyenne: 1, basse: 2 };
export const etatLabel: Record<Etat, string> = { a_planifier: "à planifier", planifiee: "planifiée", en_cours: "en cours", terminee: "terminée" };
export function sortBacklog(tasks: Task[], goals: Goal[]): Task[] {
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
export function validerNouvelleTache(input: { title: string; goalId: string; estime: number; date?: string }, goalIds: string[]): string | null {
  if (!input.title.trim()) return "titre obligatoire";
  if (!input.goalId || !goalIds.includes(input.goalId)) return "objectif lié obligatoire";
  if (isNaN(input.estime) || input.estime <= 0) return "charge estimée obligatoire (> 0 h) — elle n'est plus remplacée automatiquement";
  if (input.date && input.date.trim() && !parseISO(input.date.trim()))
    return `date planifiée invalide : « ${input.date} » (choisissez une date dans le calendrier, ou laisse le champ vide)`; // US26 — ISO via calendrier
  return null;
}

// US29/US26 — une date planifiée est valide si c'est une date ISO résolvable (garde, le calendrier la rend valide par construction)
export function datePlanifieeOk(t: Task): boolean {
  return !!t.date && !!parseISO(t.date);
}

// US29 — prochaine étape du cycle strict (le bouton d'état ne propose jamais une transition hors cycle)
export function prochainEtat(t: Task): Etat {
  const cycle: Etat[] = ["a_planifier", "planifiee", "en_cours", "terminee"];
  return t.etat === "terminee" ? "a_planifier" : cycle[cycle.indexOf(t.etat) + 1];
}

// US29 — matrice de transitions strictement séquentielle : la ré-ouverture (terminée → à planifier)
// est la seule transition arrière (confirmation explicite exigée côté appelant) ;
// gardes existantes conservées (US19 bloquage, US4-c6 clôture hors de cette fonction).
export function transitionEtat(t: Task, cible: Etat, tasks: Task[], datePlanifieeValide: boolean): { ok: boolean; raison?: string } {
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
export function reouvrirTache(t: Task, now: Date): Task {
  const y = avecEtat(t, "a_planifier", now); // Passe 3 — ré-ouverture journalisée
  return { ...y, restant: Math.max(t.restant || t.estimeInitial - t.passe, 0), dateFin: undefined };
}

// US30 — urgence d'une suggestion du rituel : (1) échéance cible de l'objectif la plus proche d'abord
// (sans échéance en dernier), (2) objectif « à risque » (US7/US12) devant à échéance égale,
// (3) priorité de la tâche, (4) priorité de l'objectif, (5) date déjà posée, puis restant décroissant.
// Ordre total et stable : dernier critère de départage, l'identifiant.
export function triParUrgence(tasks: Task[], goals: Goal[], allTasks: Task[], velocite: number | null, now: Date): Task[] {
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
export function groupesParEtat(tasks: Task[], goals: Goal[]): { etat: Etat; items: Task[] }[] {
  const cycle: Etat[] = ["a_planifier", "planifiee", "en_cours", "terminee"];
  return cycle.map((etat) => ({
    etat,
    items: etat === "terminee" ? tasks.filter((t) => t.etat === etat) : sortBacklog(tasks.filter((t) => t.etat === etat), goals),
  }));
}

export function parseDDMM(s: string, now: Date): Date | null {
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
export function capaciteJour(d: Date, prefs: Preferences): number {
  return d.getDay() === 0 || d.getDay() === 6 ? prefs.capaciteWeekEnd : prefs.capaciteJourOuvre;
}

// US20 — clé ISO locale (yyyy-mm-dd) sans décalage de fuseau
export function isoLocal(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// Itération 8 / US26 — ISO du jour et du lendemain (remplacent les libellés roulants « aujourd'hui » / « demain »)
export const isoDuJour = (now: Date) => isoLocal(now);
export const isoDuLendemain = (now: Date) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); return isoLocal(d); };

// Itération 8 / US26 — date ISO valide (yyyy-mm-dd, jour réellement existant — rejette 2026-02-31)
export function parseISO(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s ?? "")) return null;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

// Itération 8 / US26 — affichage court jj/mm d'une date ISO (les dates sont réelles, plus de libellés roulants)
export const fmtIso = (iso?: string) => (iso ? parseISO(iso)?.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) ?? "—" : "—");

// US7 — vélocité progressive : estimation dès le 2ᵉ jour de saisie
export function computeVelocity(entries: TimeEntry[]): { velocite: number | null; statut: "aucune" | "extrapolee" | "hebdo" | "glissante"; jours: number } {
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
export function estimeFin(restantTotal: number, vel: number | null, now: Date): Date | null {
  if (vel === null || vel <= 0) return null;
  const fin = new Date(now);
  fin.setDate(fin.getDate() + Math.ceil((restantTotal / vel) * 7));
  return fin;
}

export const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

// US12 — contrôleur SMART
export function h(n: number): string { // US33 — durée lisible « 2 h 30 » / « 45 min », arrondi à 5 min près
  const min = Math.round((n * 60) / 5) * 5;
  if (min <= 0) return "0 min";
  if (min < 60) return min + " min";
  const hh = Math.floor(min / 60), mm = min % 60;
  return hh + " h" + (mm ? " " + mm : "");
}

export const MOTS_VAGUES = ["améliorer", "mieux", "assez", "divers", "etc."];
export function smartCheck(g: Goal, tasks: Task[], vel: number | null, now: Date): { score: number; manquants: string[]; risque: boolean; restant: number } {
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
export function fiabilite(tasks: Task[]): { derive: number | null; nb: number } {
  const ciblees = tasks.filter((t) => !t.supprimee && (t.passe > 0 || t.restant !== t.estimeInitial));
  if (ciblees.length === 0) return { derive: null, nb: 0 };
  const derives = ciblees.map((t) => (t.passe + t.restant - t.estimeInitial) / t.estimeInitial);
  return { derive: Math.round((derives.reduce((s, d) => s + d, 0) / derives.length) * 1000) / 10, nb: ciblees.length };
}

// US13/A4/US15 — suppression d'objectif avec choix explicite (suppression logique :
// l'historique des saisies est conservé, aucune dépendance pendante ne subsiste).
export function supprimerObjectif(data: AppData, goalId: string, mode: "archiver" | "supprimer"): AppData {
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

export function actives(tasks: Task[]): Task[] { return tasks.filter((t) => !t.supprimee); }

// Prérequis non terminés d'une tâche (bloqueurs)
export function bloqueursDe(t: Task, tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((x) => [x.id, x]));
  return (t.deps ?? []).map((d) => byId.get(d)).filter((x): x is Task => !!x && x.etat !== "terminee" && !x.supprimee);
}

// Détection de cycle (direct ou transitif) : ajouter newDep à taskId créerait-il une boucle ?
export function detectCycle(tasks: Task[], taskId: string, newDep: string): boolean {
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
export function estimeFinTache(t: Task, tasks: Task[], vel: number | null, now: Date): Date | null {
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
export function depsHeritees(g: Goal, tasks: Task[]): { goalId: string; liens: number; taches: string[] }[] {
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
export function estimeFinObjectif(g: Goal, tasks: Task[], vel: number | null, now: Date): Date | null {
  if (vel === null || vel <= 0) return null;
  const own = actives(tasks).filter((t) => t.goalId === g.id);
  const restant = own.filter((t) => t.etat !== "terminee").reduce((s, t) => s + t.restant, 0);
  const fins = own.filter((t) => (t.deps ?? []).length > 0).map((t) => estimeFinTache(t, tasks, vel, now));
  const all = [estimeFin(restant, vel, now), ...fins].filter((f): f is Date => !!f);
  return all.length ? new Date(Math.max(...all.map((f) => f.getTime()))) : null;
}

// US19/US15 — suppression logique d'une tâche (choix explicite : retirer les liens, historique conservé)
export function deleteTask(data: AppData, taskId: string): AppData {
  return {
    ...data,
    tasks: data.tasks.map((t) =>
      t.id === taskId ? { ...t, supprimee: true, deps: [] } : { ...t, deps: (t.deps ?? []).filter((d) => d !== taskId) }
    ),
  };
}

// ==================== US14/US1 — compte Google et synchronisation agenda ====================

export function isoDateTime(d: Date): string { return isoLocal(d) + "T" + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }

// US14 — validation d'une adresse de compte (identifiant = adresse normalisée, cloisonnement du stockage)
export function compteDepuisEmail(email: string, nom?: string): Account | null {
  const e = (email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return { id: e, email: e, nom: (nom ?? "").trim() || e.split("@")[0] };
}

// US15/US14 — clé de stockage cloisonnée par compte (espace distinct, jamais de mélange)
export function synchroniserAgenda(data: AppData, now: Date): { data: AppData; resume: { crees: number; maj: number; retires: number; erreur: string | null } } {
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
export function statutSyncTache(t: Task, agenda: AppData["agenda"], now: Date): "hors_agenda" | "nouveau" | "a_jour" | "a_sync" {
  if (!t.date || t.etat === "terminee" || t.supprimee) return "hors_agenda";
  const ev = agenda.events[t.id];
  const iso = parseISO(t.date) ? t.date : ""; // US26 — ISO réelle
  if (!ev) return "nouveau";
  return ev.date === iso ? "a_jour" : "a_sync";
}

// ==================== Données initiales (v9) ====================

export function initialData(now: Date): AppData {
  const auj = now; // dates ISO au jour réel (US26) — la démo se cale sur la date d'ouverture
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

