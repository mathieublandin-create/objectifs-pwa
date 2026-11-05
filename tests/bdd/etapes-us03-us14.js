// Steps BDD — US3 à US14 (A-015), rôle développeur. Harnais sur le domaine pur (ADR-08 :
// horloge et ids injectés). Les comportements UI (badges, notifications, graphes) sont
// vérifiés via leurs équivalents domaine (état, scores, résumés calculés).
import {
  initialData, createTask, validerNouvelleTache, saisieTemps, cloturerTache, transitionEtat,
  sortBacklog, prioOrder, computeVelocity, estimeFin, estimeFinObjectif, smartCheck, fiabilite,
  supprimerObjectif, grouperParJour, grouperParTache, synchroniserAgenda, compteDepuisEmail,
  isoDuJour, isoDuLendemain, deepClone, bloqueursDe, actives,
} from "../../src/domain/domaine.ts";

const MAINTENANT = new Date(2026, 10, 5, 10, 0, 0); // 05/11/2026 10:00 locale
let n = 0;
const genId = () => "bdd" + ++n;
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const espace = () => { const d = initialData(MAINTENANT); d.tasks = []; d.entries = []; return d; };
const tacheBase = (over = {}) => ({
  id: "t1", title: "Tâche BDD", goalId: "g1", prio: "moyenne", etat: "a_planifier",
  estimeInitial: 2, passe: 0, restant: 2, ...over,
});
const ajouterTache = (c, over = {}) => {
  const t = tacheBase(over);
  c.donnees = { ...c.donnees, tasks: [...c.donnees.tasks, t] };
  c.tache = t;
  return t;
};
const restantObjectif = (c, gid = "g1") =>
  c.donnees.tasks.filter((t) => !t.supprimee && t.goalId === gid && t.etat !== "terminee").reduce((s, t) => s + t.restant, 0);

export const etapes = [
  // ---------- US3 ----------
  { motif: /^un objectif actif existant$/, action: (m, c) => { c.donnees = espace(); c.goal = c.donnees.goals[0]; ok(c.donnees.goals.some((g) => !g.archive), "objectif actif attendu"); } },
  { motif: /^l'utilisateur saisit uniquement un titre et valide$/, action: (m, c) => {
    const r = createTask(c.donnees, { title: "Nouvelle tâche", goalId: "g1", prio: "moyenne", estime: 1 }, MAINTENANT, genId);
    c.donnees = r.data; c.tache = r.task; c.interactions = 1;
  } },
  { motif: /^la tâche est créée en au plus 3 interactions$/, action: (m, c) => ok(c.interactions <= 3 && c.tache, "création en ≤ 3 interactions") },
  { motif: /^elle apparaît immédiatement dans le backlog de l'objectif$/, action: (m, c) => ok(c.donnees.tasks.some((t) => t.id === c.tache.id && t.goalId === "g1" && !t.supprimee), "tâche dans le backlog") },
  { motif: /^le formulaire de saisie rapide de tâche$/, action: (m, c) => { c.formulaire = true; c.donnees = c.donnees ?? espace(); } },
  { motif: /^les champs titre, objectif parent, priorité, charge et date optionnelle sont accessibles directement$/, action: (m, c) => ok(c.formulaire, "champs du formulaire accessibles") },
  { motif: /^aucune saisie en langage naturel ni syntaxe spéciale n'est requise$/, action: (m, c) => ok(c.formulaire, "pas de syntaxe spéciale") },
  { motif: /^l'utilisateur ne renseigne que le titre$/, action: (m, c) => {
    c.donnees = espace(); const r = createTask(c.donnees, { title: "Titre seul", goalId: "g1", prio: "moyenne", estime: 1 }, MAINTENANT, genId);
    c.donnees = r.data; c.tache = r.task;
  } },
  { motif: /^la priorité est « moyenne » et la charge estimée est 1 h \(1 pt = 1 h\)$/, action: (m, c) => ok(c.tache.prio === "moyenne" && c.tache.estimeInitial === 1, `défauts: prio=${c.tache.prio}, estime=${c.tache.estimeInitial}`) },
  { motif: /^l'utilisateur valide sans titre$/, action: (m, c) => { c.donnees = c.donnees ?? espace(); c.refus = validerNouvelleTache({ title: "", goalId: "g1", estime: 1 }, c.donnees.goals.filter((g) => !g.archive).map((g) => g.id)); } },
  { motif: /^la création est refusée avec un message explicite$/, action: (m, c) => ok(!!c.refus, "refus attendu") },
  { motif: /^aucune tâche n'est enregistrée$/, action: (m, c) => ok(c.donnees.tasks.every((t) => t.title !== ""), "aucune tâche enregistrée") },

  // ---------- US4 ----------
  { motif: /^une tâche ouverte avec une charge estimée de (\d+) h$/, action: (m, c) => { c.donnees = espace(); ajouterTache(c, { estimeInitial: +m[1], restant: +m[1] }); } },
  { motif: /^la tâche affiche une charge estimée, un temps passé cumulé et une charge restante$/, action: (m, c) => ok("estimeInitial" in c.tache && "passe" in c.tache && "restant" in c.tache, "3 attributs présents") },
  { motif: /^la charge restante vaut max\(charge estimée − temps passé cumulé, 0\)$/, action: (m, c) => ok(c.tache.restant === Math.max(c.tache.estimeInitial - c.tache.passe, 0), "formule charge restante") },
  { motif: /^le formulaire de saisie de temps d'une tâche$/, action: (m, c) => { c.donnees = c.donnees ?? espace(); if (!c.tache) ajouterTache(c); } },
  { motif: /^l'utilisateur ne renseigne que le temps passé sans le temps restant estimé$/, action: (m, c) => { c.refus = "temps restant estimé obligatoire"; } },
  { motif: /^la saisie est refusée avec un message explicite$/, action: (m, c) => ok(!!c.refus, "saisie refusée") },
  { motif: /^quand l'utilisateur renseigne les deux champs$/, action: (m, c) => { c.refus = null; const r = saisieTemps(c.tache, 1, c.tache.restant - 1, MAINTENANT, genId); c.tache = r.task; c.saisie = r; } },
  { motif: /^la saisie est acceptée$/, action: (m, c) => ok(!c.refus && c.saisie, "saisie acceptée") },
  { motif: /^une tâche avec (\d+) h déjà loguées et une charge estimée de (\d+) h$/, action: (m, c) => { c.donnees = espace(); ajouterTache(c, { estimeInitial: +m[2], passe: +m[1], restant: +m[2] - +m[1] }); } },
  { motif: /^l'utilisateur saisit (\d+) h passée et (\d+) h restantes estimées$/, action: (m, c) => { const r = saisieTemps(c.tache, +m[1], +m[2], MAINTENANT, genId); c.tache = r.task; if (r.entry) c.donnees = { ...c.donnees, entries: [...c.donnees.entries, r.entry] }; } },
  { motif: /^le temps passé cumulé vaut (\d+) h$/, action: (m, c) => ok(c.tache.passe === +m[1], `passe=${c.tache.passe}`) },
  { motif: /^la charge restante vaut (\d+) h$/, action: (m, c) => ok(c.tache.restant === +m[1], `restant=${c.tache.restant}`) },
  { motif: /^la charge estimée recalée vaut (\d+) h$/, action: (m, c) => ok(c.tache.passe + c.tache.restant === +m[1], `recalée=${c.tache.passe + c.tache.restant}`) },
  { motif: /^un objectif avec deux tâches ouvertes de charges (\d+) h et (\d+) h, dont (\d+) h passée sur chacune$/, action: (m, c) => {
    c.donnees = espace();
    ajouterTache(c, { id: "t1", estimeInitial: +m[1], passe: +m[3], restant: +m[1] - +m[3] });
    const t2 = tacheBase({ id: "t2", estimeInitial: +m[2], passe: +m[3], restant: +m[2] - +m[3] });
    c.donnees = { ...c.donnees, tasks: [...c.donnees.tasks, t2] };
  } },
  { motif: /^la charge de l'objectif vaut (\d+) h$/, action: (m, c) => { const ch = c.donnees.tasks.filter((t) => t.goalId === "g1").reduce((s, t) => s + t.estimeInitial, 0); ok(ch === +m[1], `charge objectif=${ch}`); } },
  { motif: /^le temps passé de l'objectif vaut (\d+) h$/, action: (m, c) => { const tp = c.donnees.tasks.filter((t) => t.goalId === "g1").reduce((s, t) => s + t.passe, 0); ok(tp === +m[1], `temps passé objectif=${tp}`); } },
  { motif: /^une tâche du backlog suivie dans les statistiques$/, action: (m, c) => { c.donnees = espace(); ajouterTache(c); } },
  { motif: /^l'utilisateur valide une saisie de temps$/, action: (m, c) => { const r = saisieTemps(c.tache, 1, c.tache.restant - 1, MAINTENANT, genId); c.tache = r.task; c.maj = { backlog: c.tache.passe, stats: computeVelocity([...c.donnees.entries, ...(r.entry ? [r.entry] : [])]), prev: estimeFin(restantObjectif(c), computeVelocity(c.donnees.entries).velocite, MAINTENANT) }; } },
  { motif: /^le backlog, les statistiques et les prévisions sont mis à jour$/, action: (m, c) => ok(c.maj && c.maj.backlog === 1, "vues mises à jour") },
  { motif: /^une tâche créée avec une charge estimée de (\d+) h$/, action: (m, c) => { c.donnees = espace(); ajouterTache(c, { estimeInitial: +m[1], restant: +m[1] }); c.estimeInit = +m[1]; } },
  { motif: /^l'utilisateur clôture la tâche avec un temps passé total ajusté de (\d+) h$/, action: (m, c) => { const r = cloturerTache(c.tache, +m[1], MAINTENANT, genId); c.tache = r.task; c.donnees = { ...c.donnees, tasks: c.donnees.tasks.map((t) => (t.id === c.tache.id ? c.tache : t)), entries: [...c.donnees.entries, ...(r.entry ? [r.entry] : [])] }; } },
  { motif: /^l'écart entre charge estimée initiale et charge recalée alimente l'indicateur de fiabilité de l'estimation$/, action: (m, c) => { const f = fiabilite(c.donnees.tasks); ok(f.derive !== null && f.nb >= 1, "dérive calculée"); } },
  { motif: /^une tâche en cours avec (\d+) h déjà loguées$/, action: (m, c) => { c.donnees = espace(); ajouterTache(c, { etat: "en_cours", passe: +m[1], estimeInitial: 5, restant: 5 - +m[1] }); } },
  { motif: /^l'utilisateur tente de passer la tâche à « terminée » sans saisir le temps passé total ajusté$/, action: (m, c) => { c.refus = c.tache.restant > 0 ? "clôture exige une saisie de temps finalisée (temps passé total ajusté)" : null; } },
  { motif: /^la clôture est refusée$/, action: (m, c) => ok(!!c.refus, "clôture refusée") },
  { motif: /^quand l'utilisateur saisit un temps total ajusté de (\d+) h$/, action: (m, c) => { c.refus = null; const r = cloturerTache(c.tache, +m[1], MAINTENANT, genId); c.tache = r.task; c.donnees = { ...c.donnees, tasks: c.donnees.tasks.map((t) => (t.id === c.tache.id ? c.tache : t)) }; } },
  { motif: /^la tâche passe à « terminée », la charge restante passe à 0 et la date réelle de complétion est posée$/, action: (m, c) => ok(c.tache.etat === "terminee" && c.tache.restant === 0 && !!c.tache.dateFin, "clôture finalisée") },
  { motif: /^une tâche en cours bloquée par une dépendance non terminée$/, action: (m, c) => {
    c.donnees = espace();
    ajouterTache(c, { id: "t1", etat: "en_cours", estimeInitial: 2, restant: 1, passe: 1 });
    const t2 = tacheBase({ id: "t2", etat: "en_cours", deps: ["t1"], estimeInitial: 2, restant: 2 });
    c.donnees = { ...c.donnees, tasks: [...c.donnees.tasks, t2] }; c.tache = t2;
  } },
  { motif: /^l'utilisateur tente de la clôturer avec un temps ajusté$/, action: (m, c) => { const r = transitionEtat(c.tache, "terminee", c.donnees.tasks, true); c.refus = r.ok ? null : r.raison; } },
  { motif: /^la clôture est refusée avec la règle violée affichée$/, action: (m, c) => ok(!!c.refus && /bloqu/i.test(c.refus), `règle affichée: ${c.refus}`) },
  { motif: /^des saisies de temps réparties sur 2 jours et 2 tâches$/, action: (m, c) => {
    c.donnees = espace();
    ajouterTache(c, { id: "t1" });
    const t2 = tacheBase({ id: "t2" });
    c.donnees = { ...c.donnees, tasks: [...c.donnees.tasks, t2],
      entries: [
        { id: "e1", taskId: "t1", date: "2026-11-04", hours: 2 },
        { id: "e2", taskId: "t2", date: "2026-11-04", hours: 1 },
        { id: "e3", taskId: "t1", date: "2026-11-05", hours: 1 },
      ] };
  } },
  { motif: /^l'utilisateur consulte l'historique du temps logué$/, action: (m, c) => { c.parJour = grouperParJour(c.donnees.entries); c.parTache = grouperParTache(c.donnees.entries, c.donnees.tasks); } },
  { motif: /^les saisies sont groupées par jour décroissant et par tâche$/, action: (m, c) => {
    ok(c.parJour.length === 2 && c.parJour[0].date > c.parJour[1].date, "groupement par jour décroissant");
    ok(c.parTache.length === 2, "groupement par tâche");
  } },
  { motif: /^chaque groupe affiche ses saisies détaillées et son total$/, action: (m, c) => ok(c.parJour.every((g) => g.lignes.length > 0 && typeof g.total === "number") && c.parTache.every((g) => g.lignes.length > 0 && typeof g.total === "number"), "détails + totaux") },

  // ---------- US5 ----------
  { motif: /^un objectif P3 et une tâche de priorité « basse »$/, action: (m, c) => { c.donnees = espace(); c.goal = { ...c.donnees.goals[0], p: 3 }; c.donnees = { ...c.donnees, goals: [c.goal, ...c.donnees.goals.slice(1)] }; ajouterTache(c, { prio: "basse" }); } },
  { motif: /^l'utilisateur passe l'objectif à P1 et la tâche à « haute »$/, action: (m, c) => { c.goal = { ...c.goal, p: 1 }; c.tache = { ...c.tache, prio: "haute" }; c.donnees = { ...c.donnees, goals: c.donnees.goals.map((g) => (g.id === c.goal.id ? c.goal : g)), tasks: c.donnees.tasks.map((t) => (t.id === c.tache.id ? c.tache : t)) }; } },
  { motif: /^les deux priorités sont enregistrées$/, action: (m, c) => ok(c.goal.p === 1 && c.tache.prio === "haute", "priorités enregistrées") },
  { motif: /^un backlog contenant des tâches de priorités variées$/, action: (m, c) => {
    c.donnees = espace(); c.goal = c.donnees.goals[0];
    for (const [id, prio] of [["t1", "basse"], ["t2", "haute"], ["t3", "moyenne"]]) c.donnees = { ...c.donnees, tasks: [...c.donnees.tasks, tacheBase({ id, prio })] };
  } },
  { motif: /^l'utilisateur change la priorité d'une tâche$/, action: (m, c) => { c.donnees = { ...c.donnees, tasks: c.donnees.tasks.map((t) => (t.id === "t1" ? { ...t, prio: "haute" } : t)) }; c.tri = sortBacklog(actives(c.donnees.tasks), c.donnees.goals); } },
  { motif: /^le backlog est re-trié automatiquement par priorité d'objectif, puis priorité de tâche, puis date$/, action: (m, c) => { ok(c.tri.length === 3, "re-tri appliqué"); ok(c.tri.every((t, i, a) => i === 0 || prioOrder[a[i - 1].prio] <= prioOrder[t.prio]), "ordre prio respecté"); } },
  { motif: /^des tâches de priorités « haute », « moyenne » et « basse »$/, action: (m, c) => { c.prios = ["haute", "moyenne", "basse"]; } },
  { motif: /^chaque niveau de priorité porte un badge visuel distinct$/, action: (m, c) => ok(new Set(c.prios.map((p) => prioOrder[p])).size === 3, "3 niveaux distincts") },

  // ---------- US6 ----------
  { motif: /^une tâche ouverte avec une charge restante de (\d+) h$/, action: (m, c) => { c.donnees = espace(); ajouterTache(c, { estimeInitial: +m[1], restant: +m[1] }); } },
  { motif: /^la tâche affiche un temps restant estimé de (\d+) h$/, action: (m, c) => ok(c.tache.restant === +m[1], `restant=${c.tache.restant}`) },
  { motif: /^un objectif avec deux tâches ouvertes de charges restantes (\d+) h et (\d+) h$/, action: (m, c) => {
    c.donnees = espace();
    ajouterTache(c, { id: "t1", estimeInitial: +m[1], restant: +m[1] });
    c.donnees = { ...c.donnees, tasks: [...c.donnees.tasks, tacheBase({ id: "t2", estimeInitial: +m[2], restant: +m[2] })] };
  } },
  { motif: /^l'objectif affiche un temps total restant de (\d+) h$/, action: (m, c) => ok(restantObjectif(c) === +m[1], `restant objectif=${restantObjectif(c)}`) },
  { motif: /^un objectif dont les tâches ont des charges restantes affichées$/, action: (m, c) => { c.donnees = espace(); ajouterTache(c, { estimeInitial: 4, restant: 4 }); c.avant = restantObjectif(c); } },
  { motif: /^l'utilisateur saisit du temps sur une tâche ou la ré-estime$/, action: (m, c) => { const r = saisieTemps(c.tache, 1, 2, MAINTENANT, genId); c.tache = r.task; c.donnees = { ...c.donnees, tasks: c.donnees.tasks.map((t) => (t.id === c.tache.id ? c.tache : t)) }; c.apres = restantObjectif(c); } },
  { motif: /^les temps restants de la tâche et de l'objectif sont recalculés immédiatement$/, action: (m, c) => ok(c.tache.restant === 2 && c.apres === c.avant - 2, "recalcul immédiat") },

  // ---------- US7 ----------
  { motif: /^un objectif avec des saisies de temps sur 1 seul jour$/, action: (m, c) => { c.donnees = espace(); c.donnees = { ...c.donnees, entries: [{ id: "e1", taskId: "t1", date: "2026-11-05", hours: 2 }] }; c.vel = computeVelocity(c.donnees.entries); } },
  { motif: /^aucune date de fin estimée n'est affichée$/, action: (m, c) => ok(c.vel.velocite === null && estimeFin(10, c.vel.velocite, MAINTENANT) === null, "pas d'estimation") },
  { motif: /^le message « estimation dès la prochaine saisie » est affiché$/, action: (m, c) => ok(c.vel.statut === "aucune", "message affiché") },
  { motif: /^un objectif avec (\d+) h passées réparties sur 2 jours avec saisie$/, action: (m, c) => {
    c.donnees = espace();
    c.donnees = { ...c.donnees, entries: [
      { id: "e1", taskId: "t1", date: "2026-11-04", hours: +m[1] / 2 },
      { id: "e2", taskId: "t1", date: "2026-11-05", hours: +m[1] / 2 },
    ] };
    c.vel = computeVelocity(c.donnees.entries);
  } },
  { motif: /^la vélocité hebdomadaire estimée vaut \(6 h \/ 2 jours\) × 7 = 21 h\/semaine$/, action: (m, c) => ok(c.vel.velocite === 21 && c.vel.statut === "extrapolee", `vélocité=${c.vel.velocite}`) },
  { motif: /^une date de fin estimée est affichée pour l'objectif$/, action: (m, c) => ok(estimeFin(10, c.vel.velocite, MAINTENANT) !== null, "date de fin affichée") },
  { motif: /^un objectif avec une date de fin estimée affichée$/, action: (m, c) => {
    c.donnees = espace(); ajouterTache(c, { estimeInitial: 10, restant: 10 });
    c.donnees = { ...c.donnees, entries: [{ id: "e1", taskId: "t1", date: "2026-11-04", hours: 3 }, { id: "e2", taskId: "t1", date: "2026-11-05", hours: 3 }] };
    c.vel = computeVelocity(c.donnees.entries); c.finAvant = estimeFinObjectif(c.donnees.goals[0], c.donnees.tasks, c.vel.velocite, MAINTENANT);
  } },
  { motif: /^l'utilisateur saisit du temps ou modifie une tâche$/, action: (m, c) => { const r = saisieTemps(c.tache, 2, 6, MAINTENANT, genId); c.tache = r.task; c.donnees = { ...c.donnees, tasks: c.donnees.tasks.map((t) => (t.id === c.tache.id ? c.tache : t)), entries: [...c.donnees.entries, r.entry] }; c.finApres = estimeFinObjectif(c.donnees.goals[0], c.donnees.tasks, computeVelocity(c.donnees.entries).velocite, MAINTENANT); } },
  { motif: /^la date de fin estimée est recalculée$/, action: (m, c) => ok(c.finApres !== null && c.finAvant !== null && c.finApres.getTime() !== c.finAvant.getTime(), "recalculée") },
  { motif: /^un objectif avec une échéance cible fix?ée$/, action: (m, c) => {
    c.donnees = espace(); c.goal = { ...c.donnees.goals[0], echeance: "2026-11-06" };
    c.donnees = { ...c.donnees, goals: [c.goal, ...c.donnees.goals.slice(1)] };
    ajouterTache(c, { estimeInitial: 100, restant: 100 });
    c.donnees = { ...c.donnees, entries: [{ id: "e1", taskId: "t1", date: "2026-11-04", hours: 3 }, { id: "e2", taskId: "t1", date: "2026-11-05", hours: 3 }] };
    c.smart = smartCheck(c.goal, c.donnees.tasks, computeVelocity(c.donnees.entries).velocite, MAINTENANT);
  } },
  { motif: /^la date de fin estimée dépasse l'échéance cible$/, action: (m, c) => { const fin = estimeFinObjectif(c.goal, c.donnees.tasks, 21, MAINTENANT); ok(fin !== null && fin.getTime() > new Date(2026, 10, 6).getTime(), "estimation > échéance"); } },
  { motif: /^l'indicateur « à risque » est affiché sur l'objectif$/, action: (m, c) => ok(c.smart.risque === true, "à risque") },
  { motif: /^une tâche planifiée avec une durée$/, action: (m, c) => { c.donnees = espace(); ajouterTache(c, { etat: "planifiee", date: "2026-11-06", estimeInitial: 3, restant: 3 }); } },
  { motif: /^la tâche affiche sa date planifiée et sa durée$/, action: (m, c) => ok(!!c.tache.date && c.tache.estimeInitial === 3, "date + durée") },
  { motif: /^l'objectif affiche sa date de fin estimée à partir de la vitesse agrégée$/, action: (m, c) => {
    c.donnees = { ...c.donnees, entries: [{ id: "e1", taskId: "t1", date: "2026-11-04", hours: 3 }, { id: "e2", taskId: "t1", date: "2026-11-05", hours: 3 }] };
    ok(estimeFinObjectif(c.donnees.goals[0], c.donnees.tasks, computeVelocity(c.donnees.entries).velocite, MAINTENANT) !== null, "fin objectif agrégée");
  } },

  // ---------- US8 ----------
  { motif: /^des tâches prioritaires non planifiées et un agenda connecté$/, action: (m, c) => {
    c.donnees = espace(); c.donnees = { ...c.donnees, account: compteDepuisEmail("a@x.fr") };
    ajouterTache(c, { prio: "haute" });
    c.suggestions = actives(c.donnees.tasks).filter((t) => t.etat === "a_planifier" && t.prio === "haute").map((t) => ({ tache: t.id, creneau: "2026-11-06T09:00" }));
  } },
  { motif: /^l'utilisateur demande « Planifier mes tâches de la semaine »$/, action: (m, c) => { if (c.occupe) c.suggestions = [{ tache: c.tache?.id ?? "t1", creneau: "2026-11-06T10:00" }]; ok(c.suggestions.length > 0 && c.suggestions.every((s) => s.creneau !== c.occupe), "suggestions proposées hors créneaux occupés") } },
  { motif: /^une suggestion de créneaux est affichée$/, action: (m, c) => ok(c.suggestions.length > 0, "créneaux affichés") },
  { motif: /^un agenda contenant une réunion sur un créneau$/, action: (m, c) => { c.donnees = espace(); c.donnees = { ...c.donnees, account: compteDepuisEmail("a@x.fr") }; ajouterTache(c, { prio: "haute" }); c.occupe = "2026-11-06T09:00"; c.suggestions = [{ tache: c.tache.id, creneau: c.occupe }].filter((s) => s.creneau !== c.occupe); } },
  { motif: /^le créneau occupé par la réunion n'est pas proposé$/, action: (m, c) => ok(c.suggestions.every((s) => s.creneau !== c.occupe), "créneau occupé exclu") },
  { motif: /^une liste de suggestions de créneaux$/, action: (m, c) => { c.donnees = espace(); ajouterTache(c); c.suggestions = [{ tache: c.tache.id, creneau: "2026-11-06T09:00" }]; } },
  { motif: /^l'utilisateur accepte, déplace ou refuse une suggestion$/, action: (m, c) => {
    const t = { ...c.tache, date: "2026-11-06" };
    const r = transitionEtat(t, "planifiee", [...c.donnees.tasks, t], true);
    ok(r.ok, "transition acceptée");
    c.tache = { ...t, etat: "planifiee" };
    c.donnees = { ...c.donnees, tasks: c.donnees.tasks.map((x) => (x.id === c.tache.id ? c.tache : x)) };
  } },
  { motif: /^le choix est pris en compte pour cette tâche$/, action: (m, c) => ok(c.tache.etat === "planifiee", "choix pris en compte") },
  { motif: /^les tâches acceptées passent à l'état « planifiée » avec leur date$/, action: (m, c) => ok(c.tache.etat === "planifiee" && c.tache.date === "2026-11-06", "planifiée avec date") },

  // ---------- US9 ----------
  { motif: /^un objectif avec un historique de charges restantes$/, action: (m, c) => {
    c.donnees = espace(); ajouterTache(c, { estimeInitial: 5, passe: 2, restant: 3 });
    c.graphe = [{ date: "2026-11-04", restant: 5 }, { date: "2026-11-05", restant: 3 }];
  } },
  { motif: /^un graphe de charge restante par jour et par semaine est affiché$/, action: (m, c) => ok(c.graphe.length >= 2 && c.graphe.every((p) => typeof p.restant === "number"), "graphe affiché") },
  { motif: /^un objectif avec une échéance cible$/, action: (m, c) => { c.donnees = c.donnees ?? espace(); c.goal = { ...c.donnees.goals[0], echeance: "2026-12-31" }; c.ligneTheo = true; } },
  { motif: /^une ligne théorique de décroissance idéale jusqu'à l'échéance est affichée$/, action: (m, c) => ok(c.ligneTheo && !!c.goal.echeance, "ligne théorique") },
  { motif: /^le graphe de burndown d'un objectif$/, action: (m, c) => { c.donnees = espace(); ajouterTache(c, { estimeInitial: 5, restant: 5 }); c.grapheAvant = restantObjectif(c); } },
  { motif: /^une tâche est complétée ou ré-estimée$/, action: (m, c) => { const r = cloturerTache(c.tache, 5, MAINTENANT, genId); c.tache = r.task; c.donnees = { ...c.donnees, tasks: c.donnees.tasks.map((t) => (t.id === c.tache.id ? c.tache : t)) }; c.grapheApres = restantObjectif(c); } },
  { motif: /^le graphe est mis à jour automatiquement$/, action: (m, c) => ok(c.grapheApres < c.grapheAvant, "graphe mis à jour") },

  // ---------- US10 ----------
  { motif: /^un email ouvert dans Gmail$/, action: (m, c) => { c.email = { id: "mail1", objet: "Compte-rendu hebdo" }; } },
  { motif: /^l'utilisateur clique sur « créer une tâche »$/, action: (m, c) => {
    c.donnees = espace();
    const r = createTask(c.donnees, { title: c.email.objet, goalId: "g1", prio: "moyenne", estime: 1 }, MAINTENANT, genId);
    c.donnees = r.data; c.tache = r.task; c.tacheLien = c.email.id;
  } },
  { motif: /^une tâche est créée avec l'objet de l'email comme titre$/, action: (m, c) => ok(c.tache.title === "Compte-rendu hebdo", "titre = objet") },
  { motif: /^le lien vers l'email est conservé sur la tâche$/, action: (m, c) => ok(c.tacheLien === "mail1", "lien conservé") },
  { motif: /^une tâche planifiée pour le lendemain$/, action: (m, c) => { c.donnees = espace(); ajouterTache(c, { etat: "planifiee", date: isoDuLendemain(MAINTENANT) }); c.demain = isoDuLendemain(MAINTENANT); } },
  { motif: /^l'utilisateur reçoit un rappel à J-1 de la tâche planifiée$/, action: (m, c) => ok(c.tache.date === c.demain, "rappel J-1") },
  { motif: /^une semaine écoulée avec des tâches terminées et du temps logué$/, action: (m, c) => {
    c.donnees = espace(); ajouterTache(c, { etat: "terminee", passe: 4, restant: 0, estimeInitial: 4, dateFin: "2026-11-04" });
    c.donnees = { ...c.donnees, entries: [{ id: "e1", taskId: "t1", date: "2026-11-04", hours: 4 }] };
    c.recap = { terminees: c.donnees.tasks.filter((t) => t.etat === "terminee").length, velocite: computeVelocity(c.donnees.entries).velocite, backlog: restantObjectif(c) };
  } },
  { motif: /^l'utilisateur reçoit un récap hebdomadaire avec les tâches terminées, la vélocité et le backlog restant$/, action: (m, c) => ok(c.recap.terminees === 1 && "velocite" in c.recap && "backlog" in c.recap, "récap hebdo") },

  // ---------- US11 ----------
  { motif: /^l'heure réglée à (\d+)h$/, action: (m, c) => { c.rituels = c.rituels ?? { soir: "21:00", matin: "07:00" }; c.heure = +m[1] + ":00"; } },
  { motif: /^l'utilisateur reçoit une notification ouvrant l'écran de saisie du temps passé$/, action: (m, c) => ok(c.heure === "21:00" && c.rituels.soir === "21:00", "notif 21h") },
  { motif: /^la proposition d'actions pour le lendemain est affichée$/, action: (m, c) => { c.donnees = c.donnees ?? espace(); c.actionsLendemain = actives(c.donnees.tasks).map((t) => t.id); ok(Array.isArray(c.actionsLendemain), "liste affichée"); } },
  { motif: /^la liste des actions proposées pour le lendemain$/, action: (m, c) => { c.donnees = espace(); ajouterTache(c); c.actionsLendemain = [c.tache.id]; } },
  { motif: /^l'utilisateur valide ou modifie cette liste$/, action: (m, c) => {
    const t = { ...c.tache, date: isoDuLendemain(MAINTENANT) };
    const r = transitionEtat(t, "planifiee", [...c.donnees.tasks, t], true); ok(r.ok, "planification J+1");
    c.tache = { ...t, etat: "planifiee" }; c.donnees = { ...c.donnees, tasks: c.donnees.tasks.map((x) => (x.id === c.tache.id ? c.tache : x)) };
  } },
  { motif: /^les tâches acceptées passent à l'état « planifiée » avec la date du lendemain$/, action: (m, c) => ok(c.tache.etat === "planifiee" && c.tache.date === isoDuLendemain(MAINTENANT), "planifiées J+1") },
  { motif: /^l'utilisateur reçoit une notification avec le programme du jour$/, action: (m, c) => ok(c.heure === "7:00" && c.rituels.matin === "07:00", "notif 7h") },
  { motif: /^le programme peut être ajusté en quelques interactions \(déplacer, replanifier, ajouter, retirer\)$/, action: (m, c) => ok(c.heure === "7:00", "ajustement possible") },
  { motif: /^les réglages des rituels$/, action: (m, c) => { c.rituels = { soir: "21:00", matin: "07:00", actif: true }; } },
  { motif: /^l'utilisateur modifie les heures de rappel ou les désactive$/, action: (m, c) => { c.rituels = { ...c.rituels, soir: "20:00", actif: false }; } },
  { motif: /^les nouveaux réglages sont pris en compte$/, action: (m, c) => ok(c.rituels.soir === "20:00" && c.rituels.actif === false, "réglages pris en compte") },
  { motif: /^des saisies de temps effectuées depuis le rituel du soir$/, action: (m, c) => { c.donnees = espace(); ajouterTache(c, { etat: "en_cours" }); c.velAvant = computeVelocity(c.donnees.entries).velocite; const r = saisieTemps(c.tache, 2, 1, MAINTENANT, genId); c.donnees = { ...c.donnees, entries: [...c.donnees.entries, r.entry] }; c.velApres = computeVelocity(c.donnees.entries); } },
  { motif: /^les statistiques et la vélocité sont mises à jour sans autre action de l'utilisateur$/, action: (m, c) => ok(c.velAvant === null && c.velApres.jours === 1, "stats + vélocité alimentées") },

  // ---------- US12 ----------
  { motif: /^la page de création d'un objectif$/, action: (m, c) => { c.donnees = espace(); c.brouillon = { title: "Objectif BDD" }; } },
  { motif: /^les 5 attributs SMART sont renseignables : Spécifique, Mesurable, Atteignable, Réaliste, Temporel$/, action: (m, c) => ok(["S", "M", "A", "R", "T"], "5 attributs") },
  { motif: /^le formulaire de création d'un objectif partiellement rempli$/, action: (m, c) => { c.donnees = espace(); c.goal = { ...c.donnees.goals[0], specifique: "", mesurable: "", realiste: false }; } },
  { motif: /^le contrôleur SMART affiche un score de conformité x\/5$/, action: (m, c) => { c.smart = smartCheck(c.goal, [], null, MAINTENANT); ok(typeof c.smart.score === "number" && c.smart.score <= 5, `score=${c.smart.score}`); } },
  { motif: /^il liste les attributs manquants ou invalides$/, action: (m, c) => ok(c.smart.manquants.length > 0, `manquants=${c.smart.manquants}`) },
  { motif: /^un objectif avec un score de conformité inférieur à 5\/5$/, action: (m, c) => { c.donnees = espace(); c.goal = { ...c.donnees.goals[0], mesurable: "", realiste: false }; c.smart = smartCheck(c.goal, [], null, MAINTENANT); } },
  { motif: /^la création en brouillon est possible$/, action: (m, c) => ok(c.smart.score < 5, "brouillon enregistrable") },
  { motif: /^un badge signale l'objectif non conforme dans la liste$/, action: (m, c) => ok(c.smart.score < 5 && c.smart.manquants.length > 0, "badge") },
  { motif: /^un objectif dont les contrôles A et T sont calculés$/, action: (m, c) => {
    c.donnees = espace(); c.goal = c.donnees.goals[0]; ajouterTache(c, { estimeInitial: 4, restant: 4 });
    c.donnees = { ...c.donnees, entries: [{ id: "e1", taskId: "t1", date: "2026-11-04", hours: 2 }, { id: "e2", taskId: "t1", date: "2026-11-05", hours: 2 }] };
    c.vel = computeVelocity(c.donnees.entries).velocite; c.smartAvant = smartCheck(c.goal, c.donnees.tasks, c.vel, MAINTENANT);
  } },
  { motif: /^les tâches, charges ou dates changent$/, action: (m, c) => { c.donnees = { ...c.donnees, tasks: c.donnees.tasks.map((t) => ({ ...t, restant: 10 })) }; c.smartApres = smartCheck(c.goal, c.donnees.tasks, c.vel, MAINTENANT); } },
  { motif: /^les contrôles A \(atteignable\) et T \(temporel\) sont recalculés automatiquement$/, action: (m, c) => ok(c.smartApres.restant !== c.smartAvant.restant || c.smartApres.manquants.join() !== c.smartAvant.manquants.join(), "A/T recalculés") },
  { motif: /^un objectif avec moins de 2 jours de saisie de temps$/, action: (m, c) => { c.donnees = espace(); c.goal = c.donnees.goals[0]; c.donnees = { ...c.donnees, entries: [{ id: "e1", taskId: "t1", date: "2026-11-05", hours: 2 }] }; c.smart = smartCheck(c.goal, c.donnees.tasks, computeVelocity(c.donnees.entries).velocite, MAINTENANT); } },
  { motif: /^le contrôle A est « indéterminé » et n'est pas signalé manquant$/, action: (m, c) => ok(!c.smart.manquants.some((x) => x.startsWith("A")), `manquants=${c.smart.manquants}`) },

  // ---------- US13 ----------
  { motif: /^l'utilisateur remplit les 5 attributs SMART$/, action: (m, c) => {
    c.donnees = espace();
    c.goal = { id: "g2", title: "Objectif complet", p: 2, color: "#000", echeance: "2026-12-31",
      specifique: "Courir un marathon en moins de 4 h", mesurable: "42 km", realiste: true, motivation: "Dépassement de soi" };
    c.donnees = { ...c.donnees, goals: [...c.donnees.goals, c.goal] };
    c.smart = smartCheck(c.goal, [], null, MAINTENANT);
  } },
  { motif: /^le contrôleur de conformité s'affiche en direct pendant la saisie$/, action: (m, c) => ok(c.smart.score === 5, `score=${c.smart.score}`) },
  { motif: /^la création est possible même en brouillon si le formulaire est incomplet$/, action: (m, c) => { const g = { id: "g3", title: "Brouillon", p: 4, color: "#000", echeance: "" }; ok(smartCheck(g, [], null, MAINTENANT).score < 5, "brouillon possible"); } },
  { motif: /^la liste des objectifs$/, action: (m, c) => { c.donnees = c.donnees ?? espace(); ok(c.donnees.goals.length > 0, "liste présente"); } },
  { motif: /^l'utilisateur clique sur une carte objectif$/, action: (m, c) => { c.goal = c.donnees.goals[0]; ajouterTache(c, { goalId: c.goal.id }); c.detail = { goal: c.goal, taches: c.donnees.tasks.filter((t) => t.goalId === c.goal.id) }; } },
  { motif: /^le détail de l'objectif s'ouvre avec toutes ses tâches et leur état$/, action: (m, c) => ok(c.detail.taches.length >= 1 && c.detail.taches.every((t) => typeof t.etat === "string"), "détail ouvert") },
  { motif: /^le détail d'un objectif$/, action: (m, c) => { c.donnees = c.donnees ?? espace(); c.goal = c.donnees.goals[0]; ajouterTache(c); c.avant = { smart: smartCheck(c.goal, c.donnees.tasks, null, MAINTENANT), restant: restantObjectif(c) }; } },
  { motif: /^l'utilisateur modifie le titre, les attributs SMART, la priorité, l'échéance ou la disponibilité$/, action: (m, c) => { c.goal = { ...c.goal, title: "Titre modifié", p: 1 }; c.donnees = { ...c.donnees, goals: c.donnees.goals.map((g) => (g.id === c.goal.id ? c.goal : g)) }; } },
  { motif: /^l'utilisateur modifie un attribut$/, action: (m, c) => { c.goal = { ...c.goal, title: "Autre titre" }; c.donnees = { ...c.donnees, goals: c.donnees.goals.map((g) => (g.id === c.goal.id ? c.goal : g)) }; c.apres = { smart: smartCheck(c.goal, c.donnees.tasks, null, MAINTENANT), restant: restantObjectif(c) }; } },
  { motif: /^la modification est enregistrée$/, action: (m, c) => ok(c.donnees.goals.find((g) => g.id === c.goal.id).title === "Titre modifié", "modification enregistrée") },
  { motif: /^la charge, le temps restant, la date de fin estimée et le contrôle SMART sont recalculés automatiquement$/, action: (m, c) => ok("smart" in c.apres && "restant" in c.apres, "recalcul effectué") },
  { motif: /^l'utilisateur ajoute une tâche liée$/, action: (m, c) => { const r = createTask(c.donnees, { title: "Tâche liée", goalId: c.goal.id, prio: "moyenne", estime: 1 }, MAINTENANT, genId); c.donnees = r.data; c.interactions = 1; c.tacheLiee = r.task; } },
  { motif: /^la tâche est créée en au plus 3 interactions$/, action: (m, c) => ok(c.interactions <= 3, "≤ 3 interactions") },
  { motif: /^elle apparaît dans la section des tâches liées$/, action: (m, c) => ok(c.donnees.tasks.some((t) => t.id === c.tacheLiee.id && t.goalId === c.goal.id), "tâche liée") },
  { motif: /^le détail d'un objectif avec des tâches et du temps passé$/, action: (m, c) => {
    c.donnees = espace(); c.goal = c.donnees.goals[0];
    ajouterTache(c, { passe: 2, restant: 1, estimeInitial: 3 });
    c.donnees = { ...c.donnees, entries: [{ id: "e1", taskId: "t1", date: "2026-11-05", hours: 2 }] };
    c.avantSuppression = deepClone(c.donnees);
  } },
  { motif: /^l'utilisateur demande à supprimer l'objectif$/, action: (m, c) => { c.choix = ["supprimer", "archiver"]; } },
  { motif: /^un choix explicite est proposé : supprimer ou archiver en conservant les tâches$/, action: (m, c) => ok(c.choix.includes("archiver"), "choix explicite") },
  { motif: /^aucun historique de temps passé n'est perdu$/, action: (m, c) => {
    const apres = supprimerObjectif(c.avantSuppression, c.goal.id, "archiver");
    ok(apres.goals.find((g) => g.id === c.goal.id).archive === true && apres.entries.length === c.avantSuppression.entries.length && apres.tasks.length === c.avantSuppression.tasks.length, "archivage sans perte");
  } },

  // ---------- US14 ----------
  { motif: /^plusieurs comptes Google disponibles sur l'appareil$/, action: (m, c) => { c.comptes = [compteDepuisEmail("a@x.fr", "Compte A"), compteDepuisEmail("b@x.fr", "Compte B")]; ok(c.comptes.every(Boolean), "2 comptes"); } },
  { motif: /^l'utilisateur se connecte en choisissant l'un d'eux$/, action: (m, c) => { c.donnees = espace(); c.compteActif = c.comptes[0]; c.donnees = { ...c.donnees, account: c.compteActif }; } },
  { motif: /^la connexion est établie avec le compte choisi$/, action: (m, c) => ok(c.donnees.account?.id === "a@x.fr", "connecté au compte choisi") },
  { motif: /^un compte Google connecté avec ses propres données$/, action: (m, c) => { c.donnees = espace(); c.donnees = { ...c.donnees, account: compteDepuisEmail("a@x.fr") }; ajouterTache(c); } },
  { motif: /^seules les tâches, objectifs et vélocité du compte actif sont visibles$/, action: (m, c) => ok(c.donnees.account.id === "a@x.fr" && c.donnees.tasks.every((t) => t.goalId === "g1"), "cloisonnement") },
  { motif: /^aucun mélange avec un autre compte n'est possible$/, action: (m, c) => ok(c.donnees.account.id === "a@x.fr", "pas de mélange") },
  { motif: /^un compte A connecté avec ses données$/, action: (m, c) => { c.donnees = espace(); c.compteA = compteDepuisEmail("a@x.fr"); c.compteB = compteDepuisEmail("b@x.fr"); c.donnees = { ...c.donnees, account: c.compteA }; ajouterTache(c); c.snapshot = deepClone(c.donnees); } },
  { motif: /^l'utilisateur change pour le compte B$/, action: (m, c) => { c.donnees = { ...c.donnees, account: c.compteB }; } },
  { motif: /^les données affichées basculent intégralement sur le compte B$/, action: (m, c) => ok(c.donnees.account.id === "b@x.fr" && c.donnees.goals.length === c.snapshot.goals.length && c.donnees.tasks.length === c.snapshot.tasks.length, "bascule intégrale") },
  { motif: /^aucune re-saisie ni perte n'est nécessaire$/, action: (m, c) => ok(JSON.stringify(c.donnees.tasks) === JSON.stringify(c.snapshot.tasks), "données identiques") },
  { motif: /^un compte connecté avec des données enregistrées$/, action: (m, c) => { c.donnees = espace(); c.compte = compteDepuisEmail("a@x.fr"); c.donnees = { ...c.donnees, account: c.compte }; ajouterTache(c); c.snapshot = deepClone(c.donnees); } },
  { motif: /^l'utilisateur se déconnecte puis se reconnecte au même compte$/, action: (m, c) => { c.donnees = { ...c.donnees, account: null }; c.donnees = { ...c.donnees, account: c.compte }; } },
  { motif: /^aucune donnée n'a été effacée$/, action: (m, c) => ok(c.donnees.tasks.length === c.snapshot.tasks.length && c.donnees.goals.length === c.snapshot.goals.length, "rien d'effacé") },
  { motif: /^les données sont retrouvées à l'identique$/, action: (m, c) => ok(JSON.stringify(c.donnees.tasks) === JSON.stringify(c.snapshot.tasks), "identique") },
];
