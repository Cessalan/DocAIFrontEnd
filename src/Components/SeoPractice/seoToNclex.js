/* ══════════════════════════════════════════════════════════════════════
   SEO → NCLEX — what a landing-page result means inside the app.

   WHY THIS EXISTS
   ───────────────
   The landing pages used to hand a student off to the main chat with a
   sentence pre-typed in the composer: "Help me prepare for NCLEX-RN. Start a
   short practice on Anticoagulant safety." Everything she had just done — the
   score, the concepts she missed, the exam date she typed into the planner —
   was saved to Firestore and then read by nothing. The value evaporated at
   the signup wall.

   This file turns that result into the vocabulary /nclex already speaks:
   a SUBJECT she can browse, an AREA to open a session on, and the
   CLIENT-NEEDS CATEGORY the attempt should score into. With those three, the
   arrival screen can propose a real first session, and the attempt log can
   count her landing-page answers as evidence.

   MAPPED BY QUESTION ID, NOT BY CONCEPT LABEL
   ───────────────────────────────────────────
   Two catalog questions share the concept "Weight-based calculation" — one
   in the dosage bank (a generic med-math item) and one in the pediatric bank.
   They belong in different areas. Mapping on the id is the only key that
   cannot collide; the concept label is kept as a fallback for callers that
   only have the label (the "topic" a planner row hands over).

   NEVER INVENT A ROW
   ──────────────────
   A question that is not in this table produces NO attempt — the same rule
   as nclexProfile's fold. The HESI A2 bank (fractions, reading, vocabulary)
   is deliberately absent: an admission-exam item scored into an NCSBN
   category would be a number the product cannot stand behind.
   ══════════════════════════════════════════════════════════════════════ */

import catalog from './catalog.json';
import { grade } from './model';

/** Area → the client-needs code an attempt in that area scores into. */
const AREA_CATEGORY = {
  'Medication safety': 'PHAR',
  'Cardiovascular drugs': 'PHAR',
  'Adverse effects & interactions': 'PHAR',
  'Infection control & precautions': 'SIC',
  'Patient safety & falls': 'SIC',
  Cardiovascular: 'PA',
  'Growth & development': 'HPM',
  'Pediatric dosing & safety': 'PHAR',
};

const target = (subject, area) => ({ subject, area, category: AREA_CATEGORY[area] });

/** Catalog question id → where it lives in the NCLEX curriculum. */
export const QUESTION_TARGETS = {
  // Pharmacology bank
  'p-1': target('pharmacology', 'Cardiovascular drugs'),
  'p-2': target('pharmacology', 'Medication safety'),
  'p-3': target('pharmacology', 'Adverse effects & interactions'),
  'p-4': target('pharmacology', 'Adverse effects & interactions'),
  'p-5': target('pharmacology', 'Cardiovascular drugs'),
  'p-6': target('pharmacology', 'Medication safety'),
  'p-7': target('pharmacology', 'Adverse effects & interactions'),
  'p-8': target('pharmacology', 'Adverse effects & interactions'),
  'p-9': target('pharmacology', 'Adverse effects & interactions'),
  'p-10': target('pharmacology', 'Cardiovascular drugs'),
  // Cardiac bank
  'c-1': target('adult-health', 'Cardiovascular'),
  'c-2': target('adult-health', 'Cardiovascular'),
  'c-3': target('pharmacology', 'Cardiovascular drugs'),
  'c-4': target('adult-health', 'Cardiovascular'),
  'c-5': target('adult-health', 'Cardiovascular'),
  'c-6': target('adult-health', 'Cardiovascular'),
  'c-7': target('adult-health', 'Cardiovascular'),
  'c-8': target('adult-health', 'Cardiovascular'),
  'c-9': target('pharmacology', 'Cardiovascular drugs'),
  'c-10': target('adult-health', 'Cardiovascular'),
  // Dosage bank
  'd-1': target('pharmacology', 'Medication safety'),
  'd-2': target('pharmacology', 'Medication safety'),
  'd-3': target('pharmacology', 'Medication safety'),
  'd-4': target('pediatrics', 'Pediatric dosing & safety'),
  'd-5': target('pharmacology', 'Medication safety'),
  'd-6': target('pharmacology', 'Medication safety'),
  'd-7': target('pharmacology', 'Medication safety'),
  'd-8': target('pharmacology', 'Medication safety'),
  'd-9': target('pharmacology', 'Medication safety'),
  'd-10': target('pharmacology', 'Medication safety'),
  // Fundamentals bank
  'f-1': target('fundamentals', 'Infection control & precautions'),
  'f-2': target('fundamentals', 'Infection control & precautions'),
  'f-3': target('fundamentals', 'Infection control & precautions'),
  'f-4': target('fundamentals', 'Infection control & precautions'),
  'f-5': target('fundamentals', 'Infection control & precautions'),
  'f-6': target('fundamentals', 'Infection control & precautions'),
  'f-7': target('fundamentals', 'Infection control & precautions'),
  'f-8': target('fundamentals', 'Infection control & precautions'),
  'f-9': target('fundamentals', 'Infection control & precautions'),
  'f-10': target('fundamentals', 'Infection control & precautions'),
  // Pediatrics bank
  'ped-1': target('pediatrics', 'Growth & development'),
  'ped-2': target('pediatrics', 'Growth & development'),
  'ped-3': target('pediatrics', 'Growth & development'),
  'ped-4': target('pediatrics', 'Pediatric dosing & safety'),
  'ped-5': target('pediatrics', 'Growth & development'),
  'ped-6': target('pediatrics', 'Growth & development'),
  'ped-7': target('pediatrics', 'Growth & development'),
  'ped-8': target('pediatrics', 'Growth & development'),
  'ped-9': target('pediatrics', 'Pediatric dosing & safety'),
  'ped-10': target('pediatrics', 'Growth & development'),
};

/**
 * Landing page → the subject its practice belongs to. `area` is set only
 * where the whole page is about one area; otherwise the arrival screen picks
 * the area from what she actually missed.
 */
export const PAGE_TARGETS = {
  'pharmacology-nclex-questions': { subject: 'pharmacology' },
  'cardiac-nclex-questions': { subject: 'adult-health', area: 'Cardiovascular' },
  'pediatric-nclex-questions': { subject: 'pediatrics' },
  'nursing-fundamentals-practice-questions': {
    subject: 'fundamentals',
    area: 'Infection control & precautions',
  },
  'dosage-calculation-practice-questions': { subject: 'pharmacology', area: 'Medication safety' },
  'nclex-study-plan': { subject: null },
};

/** Planner subject label (SeoPractice/model.js `subjects`) → curriculum id. */
export const PLANNER_SUBJECTS = {
  Pharmacology: 'pharmacology',
  Fundamentals: 'fundamentals',
  'Adult health': 'adult-health',
  Pediatrics: 'pediatrics',
  Maternity: 'maternal-newborn',
  'Mental health': 'mental-health',
  'Safety & infection control': 'fundamentals',
  'Management of care': 'leadership',
  'Coordinated care': 'leadership',
};

/** Pages whose handoff should land on /nclex rather than the chat. */
export const NCLEX_HANDOFF_SLUGS = Object.keys(PAGE_TARGETS);

export const handsOffToNclex = (page) => !!page && NCLEX_HANDOFF_SLUGS.includes(page.slug);

const questionById = (id) => catalog.questions.find((q) => q.id === id) || null;

/**
 * Her landing-page answers as attempt rows, in the shape `logAttempt`
 * stores. Questions with no target are skipped, never bucketed.
 *
 * @param {Object} value  the diagnostic's saved value: { answers, questionIds }
 */
export const attemptsFromDiagnostic = (value) => {
  const ids = Array.isArray(value?.questionIds) ? value.questionIds : [];
  const answers = value?.answers || {};
  return ids
    .map((id) => {
      const q = questionById(id);
      const where = QUESTION_TARGETS[id];
      const picked = answers[id];
      if (!q || !where || !Array.isArray(picked)) return null;
      return {
        questionId: id,
        subject: where.subject,
        area: where.area,
        category: where.category,
        concept: q.concept,
        format: q.type === 'sata' ? 'sata' : 'mcq',
        difficulty: 1,
        correct: grade(q, picked),
        skills: [],
      };
    })
    .filter(Boolean);
};

/**
 * Where the first in-app session should open.
 *
 * Preference: the area she missed most (ties → earlier in her set), then the
 * page's fixed area, then the page's subject with no area. A student who got
 * everything right gets the page subject — there is nothing to fix, so the
 * session widens rather than repeating what she knows.
 */
export const focusFor = (page, value) => {
  const base = PAGE_TARGETS[page?.slug] || { subject: null };
  const rows = attemptsFromDiagnostic(value);
  const missed = rows.filter((r) => !r.correct);

  if (missed.length) {
    const tally = {};
    missed.forEach((r) => {
      const k = `${r.subject}|${r.area}`;
      tally[k] = (tally[k] || 0) + 1;
    });
    const [best] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    const [subject, area] = best.split('|');
    return { subject, area, category: AREA_CATEGORY[area] || null };
  }

  return {
    subject: base.subject,
    area: base.area || null,
    category: base.area ? AREA_CATEGORY[base.area] || null : null,
  };
};

/**
 * The intent the arrival screen and the generator read. One object, built
 * once at the CTA, so the two never disagree about what she did.
 */
export const buildIntent = (page, value, { topic = '', track = 'RN' } = {}) => {
  if (!handsOffToNclex(page)) return null;
  const at = Date.now();

  if (page.kind === 'planner') {
    const plan = value?.plan || null;
    const priorities = (plan?.priorities || [])
      .map((label) => PLANNER_SUBJECTS[label])
      .filter(Boolean);
    const first = topic ? PLANNER_SUBJECTS[topic] : null;
    return {
      version: 1,
      at,
      kind: 'planner',
      sourcePage: page.slug,
      cluster: page.cluster,
      examTrack: plan?.track || track,
      subject: first || priorities[0] || null,
      area: null,
      category: null,
      missedConcepts: [],
      strongest: null,
      score: null,
      attempts: [],
      plan: plan
        ? {
            examDate: plan.examDate || null,
            days: plan.days,
            minutes: plan.minutes,
            priorities: plan.priorities || [],
            prioritySubjects: priorities,
          }
        : null,
    };
  }

  const attempts = attemptsFromDiagnostic(value);
  const focus = focusFor(page, value);
  const result = value?.result || {};
  return {
    version: 1,
    at,
    kind: 'diagnostic',
    sourcePage: page.slug,
    cluster: page.cluster,
    examTrack: track,
    subject: focus.subject,
    area: focus.area,
    category: focus.category,
    missedConcepts: [...new Set(attempts.filter((a) => !a.correct).map((a) => a.concept))],
    strongest: result.strongest || null,
    score: attempts.length
      ? {
          correct: attempts.filter((a) => a.correct).length,
          total: attempts.length,
          percentage: Math.round(
            (attempts.filter((a) => a.correct).length / attempts.length) * 100
          ),
        }
      : null,
    attempts,
    plan: null,
  };
};
