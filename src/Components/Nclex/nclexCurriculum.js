/* ══════════════════════════════════════════════════════════════════════
   NCLEX CURRICULUM — the two axes, and why there have to be two.

   WHY THIS EXISTS
   ───────────────
   Everywhere else in this app the curriculum comes from the student's
   upload: the topics are her document's table of contents. An NCLEX
   candidate has graduated. There is no deck, no professor, no syllabus —
   so the curriculum has to be a constant, and this is it.

   THE TWO AXES
   ────────────
   They are not interchangeable and cannot be collapsed into one.

     SUBJECTS       how students think and search. "I'm bad at peds."
                    This is the NAVIGATION axis — what she browses.

     CLIENT NEEDS   how the NCSBN blueprint scores the exam. This is the
                    SCORING axis — what predicts pass/fail.

   She browses "Pediatrics"; her readiness verdict reports client-needs
   categories, because "62% in Adult Health" predicts nothing about an
   exam that is not blueprinted in adult health. Report a subject score
   as readiness and you have invented a number.

   Most subjects span two categories (see SUBJECTS below) — that overlap
   is exactly why one axis cannot stand in for the other.

   ⚠️ BLUEPRINT WEIGHTS ARE NOT DECORATION
   ───────────────────────────────────────
   `weight` is the share of the real exam each category carries, and it is
   what makes coverage meaningful: being weak in Pharmacological Therapies
   (13-19% of the exam) is a different emergency from being weak in
   Psychosocial Integrity (6-12%). Any ranking of "what to fix first" that
   ignores weight will happily send her to study the smallest slice.

   These ranges MUST be re-verified against the current published NCSBN RN
   test plan before they are shown to a student. They are stated here as a
   single source of truth precisely so that verification has one place to
   land rather than eight.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * The eight NCSBN client-needs categories.
 *
 * `code` mirrors the `cat`/`subcat` values the backend already stamps on
 * every questionBank document (services/question_bank.py) — do not rename
 * one without the other, or coverage reads as zero for a full shelf.
 *
 * `min`/`max` are percentage points of the exam.
 */
export const CLIENT_NEEDS = [
  { code: 'MC',    parent: 'SECE',  label: 'Management of Care',                min: 15, max: 21 },
  { code: 'SIC',   parent: 'SECE',  label: 'Safety & Infection Control',        min: 10, max: 16 },
  { code: 'HPM',   parent: 'HPM',   label: 'Health Promotion & Maintenance',    min: 6,  max: 12 },
  { code: 'PSYCH', parent: 'PSYCH', label: 'Psychosocial Integrity',            min: 6,  max: 12 },
  { code: 'BC',    parent: 'PHYS',  label: 'Basic Care & Comfort',              min: 6,  max: 12 },
  { code: 'PHAR',  parent: 'PHYS',  label: 'Pharmacological & Parenteral',      min: 13, max: 19 },
  { code: 'RR',    parent: 'PHYS',  label: 'Reduction of Risk Potential',       min: 9,  max: 15 },
  { code: 'PA',    parent: 'PHYS',  label: 'Physiological Adaptation',          min: 11, max: 17 },
];

/** Midpoint of a category's blueprint range — the weight used for ranking. */
export const categoryWeight = (code) => {
  const c = CLIENT_NEEDS.find((x) => x.code === code);
  return c ? (c.min + c.max) / 2 : 0;
};

/** Lookup by code. Returns null rather than throwing — callers render "—". */
export const findCategory = (code) =>
  CLIENT_NEEDS.find((x) => x.code === code) || null;

/**
 * The subjects a student navigates by.
 *
 * `areas` are the practice units inside a subject. They exist so a subject
 * page shows structure rather than one undifferentiated "start quiz"
 * button — a student who knows she is bad at insulin should not have to
 * sit through cardiac questions to reach it.
 *
 * `needs` is which client-needs categories this subject's questions score
 * into. Order matters only for display.
 */
export const SUBJECTS = [
  {
    id: 'pharmacology',
    label: 'Pharmacology',
    blurb: 'Medication safety, adverse effects, and the nursing interventions around them.',
    needs: ['PHAR'],
    areas: [
      'Medication safety',
      'Cardiovascular drugs',
      'Antibiotics',
      'Endocrine & insulin',
      'Pain management',
      'Adverse effects & interactions',
    ],
  },
  {
    id: 'fundamentals',
    label: 'Fundamentals',
    blurb: 'Core nursing care, infection control, and the safety habits everything else rests on.',
    needs: ['BC', 'SIC'],
    areas: [
      'Infection control & precautions',
      'Mobility & positioning',
      'Nutrition & elimination',
      'Vital signs & assessment basics',
      'Patient safety & falls',
    ],
  },
  {
    id: 'adult-health',
    label: 'Adult Health',
    blurb: 'Med-surg across body systems — recognizing deterioration and choosing interventions.',
    needs: ['PA', 'RR'],
    areas: [
      'Cardiovascular',
      'Respiratory',
      'Fluid & electrolytes',
      'Renal & endocrine',
      'Neurological',
      'Perioperative care',
    ],
  },
  {
    id: 'maternal-newborn',
    label: 'Maternal & Newborn',
    blurb: 'Antepartum through postpartum, plus newborn assessment and complications.',
    needs: ['HPM', 'PA'],
    areas: [
      'Antepartum care',
      'Labor & delivery',
      'Postpartum complications',
      'Newborn assessment',
      'Fetal monitoring',
    ],
  },
  {
    id: 'pediatrics',
    label: 'Pediatrics',
    blurb: 'Growth and development, and how assessment changes when the patient is a child.',
    needs: ['HPM', 'PA'],
    areas: [
      'Growth & development',
      'Pediatric respiratory',
      'Congenital conditions',
      'Immunizations',
      'Pediatric dosing & safety',
    ],
  },
  {
    id: 'mental-health',
    label: 'Mental Health',
    blurb: 'Therapeutic communication, crisis response, and psychiatric medication management.',
    needs: ['PSYCH'],
    areas: [
      'Therapeutic communication',
      'Mood & anxiety disorders',
      'Psychotic disorders',
      'Substance use & withdrawal',
      'Crisis & suicide risk',
    ],
  },
  {
    id: 'leadership',
    label: 'Leadership & Management',
    blurb: 'Delegation, prioritization, and the judgment calls that decide who is seen first.',
    needs: ['MC'],
    areas: [
      'Delegation & supervision',
      'Prioritization',
      'Legal & ethical practice',
      'Care coordination',
      'Quality & safety systems',
    ],
  },
];

/** Lookup by id. Null rather than throwing — an unknown slug renders 404. */
export const findSubject = (id) =>
  SUBJECTS.find((s) => s.id === id) || null;

/**
 * Combined blueprint weight of a subject — the share of the exam it
 * touches. Used to order the subject grid so the heaviest subjects are not
 * below the fold.
 *
 * Subjects share categories (Pediatrics and Maternal both score into HPM
 * and PA), so these deliberately DO NOT sum to 100 across subjects. This
 * is a display ordering, never a coverage total — presenting it as one
 * would double-count every shared category.
 */
export const subjectWeight = (subject) =>
  (subject?.needs || []).reduce((sum, code) => sum + categoryWeight(code), 0);

/**
 * The clinical-reasoning skills tracked as their own dimension.
 *
 * This is the axis a student can fail on while knowing every fact: she
 * understands pharmacology and still cannot say which patient to assess
 * first. `prioritization` and `select-all-that-apply` are the two the
 * backend's node_debrief already emits (see SKILL_PRIORITY / SKILL_MULTI in
 * StudyMode/nodeReadout.js) — the rest are new and must be kept in sync
 * with whatever the generator is asked to tag.
 */
export const SKILLS = [
  { id: 'prioritization',        label: 'Prioritization' },
  { id: 'delegation',            label: 'Delegation' },
  { id: 'assessment-first',      label: 'Assess before intervening' },
  { id: 'deterioration',         label: 'Recognizing deterioration' },
  { id: 'adverse-effects',       label: 'Identifying adverse effects' },
  { id: 'patient-safety',        label: 'Patient safety' },
  { id: 'select-all-that-apply', label: 'Select all that apply' },
];

export const findSkill = (id) => SKILLS.find((s) => s.id === id) || null;

/** Question formats, mirroring FORMATS in ExamDrill/drillModel.js. */
export const FORMATS = ['mcq', 'sata', 'casestudy'];

export const FORMAT_LABELS = {
  mcq: 'Multiple choice',
  sata: 'Select all that apply',
  casestudy: 'Case study',
};

/**
 * Formats that actually discriminate readiness.
 *
 * Same list, and the same reason, as HARD_FORMATS in drillModel: measured
 * across 68 students and 1,081 answers, accuracy runs ~82% on multiple
 * choice against ~30% on select-all and ~15% on case studies. A verdict
 * built on multiple choice alone is not a cautious estimate, it is wrong.
 */
export const HARD_FORMATS = ['sata', 'casestudy'];
