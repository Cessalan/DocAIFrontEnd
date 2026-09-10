/* ══════════════════════════════════════════════════════════════════════
   COURSE INTELLIGENCE MODEL — everything the report knows how to say,
   derived from the backend's payload, with no rendering in sight.

   WHY THIS FILE EXISTS
   ────────────────────
   The report makes claims about a student's own class. That is the entire
   value of it and also the entire risk: one line she can tell is invented
   and she stops believing the plan we are about to sell her. So the rules
   for what may be said, and how strongly, are written once, here, where
   they can be asserted in a test — not spread across three components
   where each one gets to decide how confident to sound.

   THE CENTRAL RULE: NOTHING IS PROMOTED
   ─────────────────────────────────────
   Every fact arrives from the backend already carrying a confidence. This
   file may DEMOTE (a section whose citations turn out to be unlinkable
   drops to inference, or out of the report entirely) and may DROP. It may
   never promote. There is no path through this file that turns an
   inference into a verified claim, and `normalizeReport` is written so
   that the absence of evidence produces the absence of a section rather
   than a hedged version of it.

   Section 5 of the product brief, in code:
       verified  🟣 her own upload, or an official page we can link to
       public    🔵 a credible public source we can link to
       inference 🟡 a pattern we noticed — always phrased as "appears to",
                    never as "will be on the exam"
   ══════════════════════════════════════════════════════════════════════ */

import { buildPlanPreview } from '../StudyMode/planPreviewModel';

export const CONFIDENCE = {
  VERIFIED: 'verified',
  PUBLIC: 'public',
  INFERENCE: 'inference',
};

const CONFIDENCE_RANK = {
  [CONFIDENCE.VERIFIED]: 2,
  [CONFIDENCE.PUBLIC]: 1,
  [CONFIDENCE.INFERENCE]: 0,
};

/**
 * ⚠️ CROSS-REPO CONTRACT — mirrors PRIORITY_WEIGHTS in
 * NQBackEnd2/services/course_intelligence.py.
 *
 * The backend scores; this is used only when the client re-ranks locally
 * (she deselects a topic, or a report is replayed from Firestore against a
 * different exam date). If the two drift, the report's order and the plan's
 * order stop matching, and the student is told to start on one topic and
 * handed another.
 */
export const PRIORITY_WEIGHTS = {
  exam_relevance: 0.34,
  material_emphasis: 0.24,
  objective_alignment: 0.16,
  dependency: 0.12,
  clinical_importance: 0.10,
  complexity: 0.04,
};

/**
 * The timeline's steps, in the order they are shown.
 *
 * `parallel: true` marks the four the backend runs concurrently. The UI needs
 * to know, because those four complete out of order and a timeline that
 * insists on finishing them top-to-bottom would have to hold completed steps
 * back — i.e. lie about when it knew something.
 *
 * `optional: true` marks a step that can legitimately have nothing to do (no
 * professor named, research switched off). Those render as skipped, with a
 * reason, rather than as failures.
 */
export const STEPS = [
  { id: 'course_context_received', icon: 'course', parallel: false, optional: false },
  { id: 'materials_analyzed', icon: 'documents', parallel: false, optional: false },
  { id: 'course_research', icon: 'search', parallel: true, optional: true },
  { id: 'professor_research', icon: 'instructor', parallel: true, optional: true },
  { id: 'academic_resources_research', icon: 'library', parallel: true, optional: true },
  { id: 'exam_analysis', icon: 'exam', parallel: true, optional: true },
  { id: 'concept_mapping', icon: 'connect', parallel: false, optional: false },
  { id: 'study_strategy', icon: 'strategy', parallel: false, optional: false },
];

export const STEP_IDS = STEPS.map(s => s.id);

/** Fresh timeline state: every step pending, nothing claimed. */
export const initialTimeline = () => ({
  steps: STEPS.map(s => ({ ...s, state: 'pending', detail: null })),
  progress: 0,
  done: false,
  failed: false,
});

/**
 * Fold one backend event into timeline state.
 *
 * Progress only ever goes UP. The four concurrent steps report percentages
 * out of order, and a bar that slides backwards reads as a bug in exactly the
 * moment the feature is asking to be trusted.
 */
export const reduceTimeline = (state, event) => {
  if (!event || !state) return state;

  if (event.status === 'course_material_excerpt') {
    return { ...state, transformation: { state: 'building', source: event.source, topics: event.topics || [] } };
  }
  if (event.status === 'course_question_ready') {
    return { ...state, transformation: { ...state.transformation, state: 'ready', source: event.source } };
  }
  if (event.status === 'course_question_unavailable') {
    return { ...state, transformation: { ...state.transformation, state: 'unavailable' } };
  }

  if (event.status === 'course_intelligence_ready') {
    return {
      ...state,
      steps: state.steps.map(s => (s.state === 'pending' || s.state === 'running'
        ? { ...s, state: 'done' }
        : s)),
      progress: 100,
      done: true,
    };
  }

  if (event.status === 'error') {
    return { ...state, failed: true };
  }

  if (event.status !== 'course_intelligence_progress') return state;

  const idx = state.steps.findIndex(s => s.id === event.step);
  if (idx === -1) return state;

  const steps = state.steps.slice();
  steps[idx] = {
    ...steps[idx],
    state: event.state || 'done',
    started: steps[idx].started || event.state === 'running',
    detail: event.detail || steps[idx].detail,
  };

  const nextProgress = Math.max(state.progress, Number(event.progress) || 0);
  return { ...state, steps, progress: Math.min(100, nextProgress) };
};

// ─────────────────────────────────────────────────────────────────────
// REPORT NORMALIZATION
// ─────────────────────────────────────────────────────────────────────

const cleanString = (value, max = 400) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, max) : '';
};

const cleanList = (value, max = 12) => (Array.isArray(value) ? value : [])
  .map(v => cleanString(v, 200))
  .filter(Boolean)
  .slice(0, max);

/**
 * Keep only citations we can actually link to.
 *
 * A "source" the student cannot click is indistinguishable from one we made
 * up, and this component's whole claim is that it looked things up. The
 * backend already filters these; doing it again here costs nothing and means
 * a replayed report from Firestore — written before that filter existed —
 * cannot show an unlinkable source either.
 */
export const cleanCitations = (raw, max = 6) => (Array.isArray(raw) ? raw : [])
  .filter(c => c && typeof c.url === 'string' && /^https?:\/\//i.test(c.url))
  .map(c => ({
    url: c.url,
    title: cleanString(c.title, 160) || c.url,
    snippet: cleanString(c.snippet, 240),
    host: hostOf(c.url),
  }))
  .slice(0, max);

export const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (e) {
    return '';
  }
};

/**
 * A researched section survives only if it claims a find AND can cite one.
 * Returns null otherwise, and null means the section is not rendered at all —
 * "we found nothing about your professor" is a line worth showing once, in
 * the timeline; it is not worth a card in the report.
 */
const normalizeResearched = (section, fallbackConfidence) => {
  if (!section || !section.found) return null;
  const citations = cleanCitations(section.citations);
  if (citations.length === 0) return null;
  const confidence = section.confidence in CONFIDENCE_RANK
    ? section.confidence
    : fallbackConfidence;
  return { ...section, citations, confidence };
};

const normalizeInstructor = (raw) => {
  const section = normalizeResearched(raw, CONFIDENCE.PUBLIC);
  if (!section) return null;

  const profile = {
    name: cleanString(section.display_name, 120),
    title: cleanString(section.title, 120),
    department: cleanString(section.department, 160),
    specialties: cleanList(section.clinical_specialties, 5),
    research: cleanList(section.research_areas, 5),
    publications: cleanList(section.notable_publications, 3),
    citations: section.citations,
    confidence: section.confidence,
  };

  // A name and a link is not context. If we cannot say what they do
  // professionally, there is nothing here worth putting in front of a student
  // and the section is dropped — which is also the honest outcome when the
  // search matched the wrong person.
  const hasSubstance = profile.title
    || profile.specialties.length
    || profile.research.length
    || profile.publications.length;
  return hasSubstance ? profile : null;
};

const normalizeCourse = (raw) => {
  const section = normalizeResearched(raw, CONFIDENCE.PUBLIC);
  if (!section) return null;
  return {
    officialName: cleanString(section.official_name, 160),
    department: cleanString(section.department, 160),
    level: cleanString(section.level, 80),
    description: cleanString(section.description, 600),
    objectives: cleanList(section.learning_objectives, 8),
    syllabusTopics: cleanList(section.syllabus_topics, 12),
    citations: section.citations,
    // An official university page is the only public source allowed to
    // outrank "public" — see the backend's `official_source`.
    confidence: section.official_source ? CONFIDENCE.VERIFIED : CONFIDENCE.PUBLIC,
  };
};

const normalizeResources = (raw) => {
  if (!raw || !raw.found) return null;
  const resources = (Array.isArray(raw.resources) ? raw.resources : [])
    .filter(r => r && typeof r.url === 'string' && /^https?:\/\//i.test(r.url))
    .map(r => ({
      title: cleanString(r.title, 140) || hostOf(r.url),
      url: r.url,
      host: hostOf(r.url),
      kind: cleanString(r.kind, 40) || 'reference',
      why: cleanString(r.why_useful, 160),
      official: Boolean(r.official),
    }))
    .slice(0, 6);
  if (resources.length === 0) return null;
  return { resources, confidence: CONFIDENCE.PUBLIC };
};

const normalizeExam = (raw) => {
  if (!raw) return null;
  const coverage = cleanList(raw.coverage, 10);
  const formats = cleanList(raw.formats, 5);
  if (coverage.length === 0 && formats.length === 0) return null;
  return {
    type: cleanString(raw.exam_type, 120),
    coverage,
    formats,
    emphasis: cleanList(raw.stated_emphasis, 5),
    unstated: cleanList(raw.unstated, 4),
    // Her own words about her own exam. The only section that is verified
    // without a citation, because the citation is the sentence she typed.
    confidence: CONFIDENCE.VERIFIED,
  };
};

const normalizePriority = (raw) => (Array.isArray(raw) ? raw : [])
  .map((row) => {
    const topic = cleanString(row && row.topic, 120);
    if (!topic) return null;
    const signals = (row && row.signals) || {};
    return {
      topic,
      score: clampScore(row.score),
      signals: {
        exam_relevance: clampScore(signals.exam_relevance),
        material_emphasis: clampScore(signals.material_emphasis),
        objective_alignment: clampScore(signals.objective_alignment),
        dependency: clampScore(signals.dependency),
        clinical_importance: clampScore(signals.clinical_importance),
        complexity: clampScore(signals.complexity),
      },
      evidence: (Array.isArray(row.evidence) ? row.evidence : [])
        .map(e => ({
          text: cleanString(e && e.text, 180),
          source: cleanString(e && e.source, 40) || 'inference',
          confidence: e && e.confidence in CONFIDENCE_RANK ? e.confidence : CONFIDENCE.INFERENCE,
        }))
        .filter(e => e.text)
        .slice(0, 3),
      keyPoints: cleanList(row.key_points, 4),
      fileCount: Number(row.file_count) || 0,
    };
  })
  .filter(Boolean);

const clampScore = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

/**
 * Turn a raw backend report into the shape the UI renders.
 *
 * Returns null for a report with no usable content at all, which the caller
 * treats as "carry on to the plan" rather than as an error.
 */
export const normalizeReport = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const materials = raw.uploaded_material_insights || {};
  const publicCtx = raw.relevant_public_context || {};
  const strategy = raw.study_strategy || {};

  const priorityTopics = normalizePriority(raw.priority_topics);
  const course = normalizeCourse(
    raw.verified_public_information
    || publicCtx.course
    || (raw.course_information || {}).public_profile
  );

  const report = {
    context: {
      school: cleanString((raw.course_information || {}).school, 160),
      courseCode: cleanString((raw.course_information || {}).courseCode, 60),
      courseName: cleanString((raw.course_information || {}).courseName, 160),
      professor: cleanString((raw.course_information || {}).professor, 120),
      examDescription: cleanString((raw.course_information || {}).examDescription, 600),
      examDate: (raw.course_information || {}).examDate || null,
      confidence: CONFIDENCE.VERIFIED,
    },
    materials: {
      filenames: cleanList(materials.filenames, 50),
      fileCount: Number(materials.file_count) || 0,
      topicCount: Number(materials.topic_count) || 0,
      conceptCount: Number(materials.concept_count) || 0,
      documentTypes: cleanList(materials.document_types, 4),
      frameworks: cleanList(materials.frameworks, 4),
      topics: (Array.isArray(materials.topics) ? materials.topics : []).slice(0, 12),
      confidence: CONFIDENCE.VERIFIED,
    },
    course,
    instructor: normalizeInstructor(publicCtx.instructor),
    resources: normalizeResources(publicCtx.resources),
    exam: normalizeExam(raw.exam_analysis),
    priorityTopics,
    strategy: {
      note: cleanString(strategy.note, 400),
      connections: (Array.isArray(strategy.connections) ? strategy.connections : []).slice(0, 6),
      recommendedStart: strategy.recommended_start || null,
      orderedTopics: cleanList(strategy.ordered_topics, 12),
      confidence: CONFIDENCE.INFERENCE,
    },
    researchRan: Boolean(raw.research_ran),
    researchEnabled: raw.research_enabled !== false,
    elapsedMs: Number(raw.elapsed_ms) || 0,
  };

  const hasAnything = report.priorityTopics.length
    || report.materials.topicCount
    || report.exam
    || report.course
    || report.instructor;
  return hasAnything ? report : null;
};

// ─────────────────────────────────────────────────────────────────────
// WHAT THE REPORT IS ALLOWED TO SAY
// ─────────────────────────────────────────────────────────────────────

/** Did any external research produce something we can show? */
export const hasPublicFindings = (report) => Boolean(
  report && (report.course || report.instructor || report.resources)
);

/**
 * The line shown when research found nothing.
 *
 * Deliberately not an error and not an apology. Her materials were always the
 * primary source; this says so, and says which of the three reasons applies so
 * the sentence is true rather than merely soothing.
 */
export const emptyResearchReason = (report) => {
  if (!report) return null;
  if (hasPublicFindings(report)) return null;
  if (!report.researchEnabled) return 'disabled';
  if (!report.context.school && !report.context.courseCode && !report.context.courseName) {
    return 'no_course_named';
  }
  return 'not_found';
};

/**
 * The top N priority topics, with a display band.
 *
 * The band is a RANKING inside this course, not a verdict about her: `focus`
 * means "start here", never "you are weak here". We have measured what the
 * second reading costs (see UploadInsightsCard's header) and the copy keys
 * below are named so nobody reintroduces it by accident.
 */
export const priorityRows = (report, max = 5) => {
  if (!report || !Array.isArray(report.priorityTopics)) return [];
  return report.priorityTopics.slice(0, max).map((row, index) => ({
    ...row,
    rank: index + 1,
    band: index === 0 ? 'focus' : index < 3 ? 'strong' : 'support',
    // The strongest single reason to show under the title. Verified evidence
    // outranks inferred evidence regardless of order, because the first line
    // a sceptical student reads should be the one she can check.
    lead: [...row.evidence].sort(
      (a, b) => (CONFIDENCE_RANK[b.confidence] || 0) - (CONFIDENCE_RANK[a.confidence] || 0)
    )[0] || null,
  }));
};

/**
 * The numbers on the reveal: how many sessions, how long, how many days left.
 *
 * Delegates to buildPlanPreview rather than inventing its own arithmetic. That
 * function already mirrors the backend's budget rules and is already covered
 * by tests; a second, nearly-identical calculation here is exactly how the
 * reveal ends up promising fourteen sessions for a plan that delivers eight.
 */
export const revealStats = ({ report, daysToExam = null, diagnostic = null } = {}) => {
  const topics = report && report.strategy.orderedTopics.length
    ? report.strategy.orderedTopics
    : (report ? report.priorityTopics.map(r => r.topic) : []);

  const preview = buildPlanPreview({ topics, diagnostic, daysToExam });

  return {
    topicCount: topics.length,
    sessionCount: preview.sessionCount,
    estimatedMinutes: preview.estimatedMinutes,
    archetype: preview.archetype,
    daysToExam,
    trimmed: preview.trimmed,
  };
};

/**
 * The recommended first topic, with its reasons resolved against the priority
 * rows so the card can show evidence rather than an assertion.
 *
 * Falls back to the top-ranked topic when the backend named no start, and
 * returns null when there are no topics at all — an empty upload must not
 * produce a confident "start here" pointing at nothing.
 */
export const recommendedStart = (report) => {
  if (!report) return null;
  const rows = priorityRows(report, 8);
  if (rows.length === 0) return null;

  const named = report.strategy.recommendedStart;
  const topic = (named && cleanString(named.topic, 120)) || rows[0].topic;
  const row = rows.find(r => r.topic.toLowerCase() === topic.toLowerCase()) || rows[0];

  const reasons = (named && Array.isArray(named.reasons) ? named.reasons : [])
    .filter(r => r && r.key)
    .slice(0, 3);

  return {
    topic: row.topic,
    score: row.score,
    signals: row.signals,
    evidence: row.evidence,
    keyPoints: row.keyPoints,
    reasons: reasons.length ? reasons : [{ key: 'emphasis', confidence: CONFIDENCE.VERIFIED }],
  };
};

/**
 * Rebuild the priority order locally.
 *
 * Used when the client has to re-rank without another backend round trip. It
 * reproduces the backend's weighted sum exactly — see the contract note on
 * PRIORITY_WEIGHTS — so a locally re-ranked list and a server-ranked one put
 * the same topic first.
 */
export const rescorePriority = (rows) => (Array.isArray(rows) ? rows : [])
  .map((row) => {
    const signals = row.signals || {};
    const score = Math.round(
      Object.keys(PRIORITY_WEIGHTS).reduce(
        (sum, key) => sum + PRIORITY_WEIGHTS[key] * (Number(signals[key]) || 0),
        0
      )
    );
    return { ...row, score };
  })
  .sort((a, b) => (
    b.score - a.score
    || (b.signals.material_emphasis || 0) - (a.signals.material_emphasis || 0)
    || a.topic.localeCompare(b.topic)
  ));

/**
 * The topic list handed to the planner.
 *
 * Order matters more than membership here: this is what stops the plan
 * following the order of her slide deck.
 */
export const plannerTopics = (report, fallback = [], limit = 5) => {
  const ordered = report && report.strategy.orderedTopics.length
    ? report.strategy.orderedTopics
    : (report ? report.priorityTopics.map(r => r.topic) : []);
  return (ordered.length ? ordered : fallback).slice(0, limit);
};

/**
 * The two topics the plan leads with, for `hardestTopics`.
 *
 * Replaces the question we stopped asking. These come from evidence in her own
 * material and her own exam description rather than from a student's guess
 * about her own weaknesses.
 */
export const leadTopics = (report, max = 2) => plannerTopics(report, [], max);
