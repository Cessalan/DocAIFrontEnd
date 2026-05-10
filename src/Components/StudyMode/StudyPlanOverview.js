import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNodeType, getStepTopicLabel } from './planFormatting';
import { getStudyNodeIcon } from './planNodeIcon';
import './StudyMode.css';

/* ──────────────────────────────────────────────────────────
   Helper: extract the base topic from a node label by
   matching against the known topics array, then fallback
   to stripping " - suffix" patterns.
   ────────────────────────────────────────────────────────── */
const getBaseTopic = (label, topics) => {
  if (!label) return label;
  for (const topic of topics) {
    if (label.toLowerCase().startsWith(topic.toLowerCase())) return topic;
  }
  return label.replace(/\s*[-–]\s*\S.*$/, '').trim() || label;
};

/* ──────────────────────────────────────────────────────────
   Helper: derive a performance summary for a section by
   fuzzy-matching the section name against insightsData.topics
   ────────────────────────────────────────────────────────── */
const getSectionPerformance = (sectionName, insightsData) => {
  if (!insightsData?.topics || !sectionName) return null;
  const strip = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const sn = strip(sectionName);

  for (const [topicName, data] of Object.entries(insightsData.topics)) {
    const tn = strip(topicName);
    if (tn.includes(sn) || sn.includes(tn)) {
      const qAcc = data.questionsTotal > 0 ? data.questionsCorrect / data.questionsTotal : null;
      const fAcc = data.flashcardsTotal > 0 ? data.flashcardsMastered / data.flashcardsTotal : null;
      const scores = [qAcc, fAcc].filter(s => s !== null);
      const pct = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) : null;
      const strengthLevel = pct !== null
        ? (pct >= 85 ? 'strong' : pct >= 60 ? 'developing' : 'weak')
        : null;
      return { pct, strengthLevel, ...data };
    }
  }
  return null;
};

/* ──────────────────────────────────────────────────────────
   Helper: group the flat nodes array into sections.

   Returns { sections[], renderOrder[] }
   - sections: topic groups (exam nodes excluded)
   - renderOrder: interleaved array of
       { type: 'section', data: section }
       { type: 'milestone', data: examNode, afterSection: sectionId }
   ────────────────────────────────────────────────────────── */
const buildSections = (nodes, topics, insightsData) => {
  const sections = [];
  const milestones = []; // exam nodes extracted out
  let currentSection = null;
  let prevTopic = null;

  const finalize = (sec) => {
    const allDone = sec.steps.every(s => s.status === 'done');
    const anyActive = sec.steps.some(s => s.status === 'active');
    sec.status = allDone ? 'complete' : anyActive ? 'active' : 'locked';
    sec.performance = getSectionPerformance(sec.name, insightsData);
    return sec;
  };

  for (const node of nodes) {
    // Section banners create a hard boundary (Phase 2 divider)
    if (node.type === 'section_banner') {
      if (currentSection) sections.push(finalize(currentSection));
      currentSection = null;
      prevTopic = null;
      continue;
    }

    // Exam nodes are pulled out as standalone milestones
    if (node.type === 'exam') {
      milestones.push({
        node,
        afterSectionIndex: sections.length + (currentSection ? 0 : -1),
      });
      continue;
    }

    const baseTopic = node.adaptive ? prevTopic : getBaseTopic(node.label, topics);

    if (baseTopic !== prevTopic || currentSection === null) {
      if (currentSection) sections.push(finalize(currentSection));
      currentSection = {
        id: `section-${sections.length}`,
        name: baseTopic,
        sectionNumber: sections.length + 1,
        phase: node.phase || 1,
        steps: [node],
      };
    } else {
      currentSection.steps.push(node);
    }

    if (!node.adaptive) prevTopic = baseTopic;
  }

  if (currentSection) sections.push(finalize(currentSection));

  // Build interleaved render order: section, then its trailing milestones
  const renderOrder = [];
  sections.forEach((sec, idx) => {
    renderOrder.push({ type: 'section', data: sec });
    // Attach any milestones that follow this section
    milestones
      .filter(m => m.afterSectionIndex === idx)
      .forEach(m => renderOrder.push({ type: 'milestone', data: m.node }));
  });

  return { sections, renderOrder };
};


/* ──────────────────────────────────────────────────────────
   Helper: estimated minutes per node type
   ────────────────────────────────────────────────────────── */
const getNodeEstimate = (type) => {
  const map = { lesson: 5, quiz: 4, flashcard: 3, audio: 6, mindmap: 5, review: 2, exam: 15 };
  return map[type] || 4;
};

/* ──────────────────────────────────────────────────────────
   Mini-test question-count assumption.

   Mini-tests store nodeProgress as a percentage but not the
   raw count. Reading the actual count would require an extra
   Firestore message read per exam node. The exam generator
   defaults to 10 questions (FastAPICalls.generate_exam), so
   we assume 10 here. If the student configured a different
   size, this is an approximation — but for the readiness %
   it only shifts a topic's weight slightly and the direction
   of the score is unchanged.
   ────────────────────────────────────────────────────────── */
const EXAM_QUESTION_ESTIMATE = 10;

/* ──────────────────────────────────────────────────────────
   Hide the readiness card until the student has answered
   enough questions for the score to mean something. Below
   this threshold a single bad answer can swing the number by
   20+ points, which would demoralize anxious students more
   than it would motivate them.
   ────────────────────────────────────────────────────────── */
const MIN_QUESTIONS_THRESHOLD = 10;

/* ──────────────────────────────────────────────────────────
   A topic is "measured" only once it has at least this many
   answered questions backing its score. Below this threshold
   we treat it as untested — its measured pct is too noisy
   (one wrong answer swings a 3-question topic by 33%).
   ────────────────────────────────────────────────────────── */
const MIN_PER_TOPIC_QUESTIONS = 5;

/* ──────────────────────────────────────────────────────────
   Helper: normalize a topic name for fuzzy matching.
   Strip diacritics, lowercase, collapse whitespace.
   ────────────────────────────────────────────────────────── */
const normalizeTopic = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/* ──────────────────────────────────────────────────────────
   Helper: build per-topic { correct, total } stats by merging
   two sources of graded responses:

     1. insightsData.topics — per-quiz answer aggregates with
        REAL question counts (questionsCorrect/questionsTotal).
        This is the trustworthy quiz signal.

     2. Completed exam (mini-test) nodes — give us a percentage
        via nodeProgress; we approximate the raw counts using
        EXAM_QUESTION_ESTIMATE so they can be combined with (1).

   Skipped on purpose:
     - Lesson, audio, mindmap, flashcard nodes (not graded;
       flashcard mastery is a different signal and would
       dilute the "if you took a test now" intuition)
     - Exam nodes with nodeProgress === 0 (legacy "Passed"
       badges where no real score was captured — see
       StudyPlanOverview milestone rendering)

   Topics from the two sources are merged by fuzzy match
   (substring either direction on normalized names) so a
   mini-test labeled "Pharmacology of Drugs ..." lands in
   the same bucket as its quiz aggregate.

   Returns an array sorted by pct ascending, each entry:
     { name, correct, total, pct, level, hasMiniTest }
   ────────────────────────────────────────────────────────── */
const buildScoredTopics = (nodes, topics, insightsData) => {
  // Map: normalizedKey -> { name, correct, total, hasMiniTest }
  const stats = new Map();

  // Step 1: seed from insightsData (quiz answer counts only)
  if (insightsData?.topics) {
    for (const [topicName, data] of Object.entries(insightsData.topics)) {
      const total = data?.questionsTotal || 0;
      if (total <= 0) continue;
      const key = normalizeTopic(topicName);
      stats.set(key, {
        name: topicName,
        correct: data.questionsCorrect || 0,
        total,
        hasMiniTest: false,
      });
    }
  }

  // Step 2: find a stats key for a label, by substring match either way
  const findStatsKey = (label) => {
    const baseTopic = getBaseTopic(label, topics) || label;
    const norm = normalizeTopic(baseTopic);
    if (stats.has(norm)) return { key: norm, name: baseTopic };
    for (const existingKey of stats.keys()) {
      if (existingKey.includes(norm) || norm.includes(existingKey)) {
        return { key: existingKey, name: baseTopic };
      }
    }
    return { key: norm, name: baseTopic };
  };

  // Step 3: layer in mini-test (exam) contributions
  for (const node of nodes) {
    if (node.type !== 'exam') continue;
    if (node.status !== 'done') continue;
    const pct = typeof node.nodeProgress === 'number' ? node.nodeProgress : 0;
    if (pct <= 0) continue;

    const { key, name } = findStatsKey(node.label);
    const entry = stats.get(key) || {
      name,
      correct: 0,
      total: 0,
      hasMiniTest: false,
    };
    const correctEst = Math.round((pct / 100) * EXAM_QUESTION_ESTIMATE);
    entry.correct += correctEst;
    entry.total += EXAM_QUESTION_ESTIMATE;
    entry.hasMiniTest = true;
    stats.set(key, entry);
  }

  // Step 4: register every curriculum topic (from path.topics) so
  // untouched topics are visible as 0% — a student who has nailed
  // one topic out of three should not be "ready," they should see
  // the two they haven't measured yet.
  if (Array.isArray(topics)) {
    for (const expected of topics) {
      const norm = normalizeTopic(expected);
      if (!norm) continue;
      if (stats.has(norm)) continue;
      // Substring match against existing keys (handles label drift)
      let matched = false;
      for (const existingKey of stats.keys()) {
        if (existingKey.includes(norm) || norm.includes(existingKey)) {
          matched = true;
          break;
        }
      }
      if (matched) continue;
      stats.set(norm, {
        name: expected,
        correct: 0,
        total: 0,
        hasMiniTest: false,
      });
    }
  }

  // Step 5: convert, level-bucket, mark untested, sort weakest-first
  const out = [];
  for (const entry of stats.values()) {
    const untested = entry.total < MIN_PER_TOPIC_QUESTIONS;
    const pct = entry.total > 0
      ? Math.round((entry.correct / entry.total) * 100)
      : 0;
    const level = untested
      ? 'weak'
      : pct >= 85 ? 'strong' : pct >= 60 ? 'developing' : 'weak';
    out.push({
      name: entry.name,
      correct: entry.correct,
      total: entry.total,
      pct,
      level,
      hasMiniTest: entry.hasMiniTest,
      untested,
    });
  }
  // Untested topics first (effectively 0%), then weakest measured
  out.sort((a, b) => {
    if (a.untested !== b.untested) return a.untested ? -1 : 1;
    return a.pct - b.pct;
  });
  return out;
};

/* ──────────────────────────────────────────────────────────
   Helper: build a "readiness snapshot" for the Phase 2 CTA.

   Overall % is COVERAGE-AWARE: it's the mean of every
   curriculum topic's pct, with untested topics counted as 0.
   This is the "test-day readiness across the whole
   curriculum" number — a student who has aced 1 of 3 topics
   is ~33% ready, not 92%. Measured topics keep their honest
   per-topic % (correct / questions answered) for display.
   ────────────────────────────────────────────────────────── */
const buildReadinessSnapshot = (scoredTopics) => {
  if (!scoredTopics || scoredTopics.length === 0) {
    return {
      hasData: false,
      overallPct: null,
      overallLevel: null,
      weak: [],
      strongCount: 0,
      untestedCount: 0,
      miniTestCount: 0,
      totalCorrect: 0,
      totalQuestions: 0,
      topicsTotal: 0,
      tone: 'unknown',
      estNodes: 5,
      estMin: 12,
    };
  }

  const totalCorrect = scoredTopics.reduce((s, t) => s + t.correct, 0);
  const totalQuestions = scoredTopics.reduce((s, t) => s + t.total, 0);
  const topicsTotal = scoredTopics.length;

  // Coverage-aware overall: each topic counts equally,
  // untested topics contribute 0, denominator = all topics.
  const overallPct = topicsTotal > 0
    ? Math.round(scoredTopics.reduce((s, t) => s + t.pct, 0) / topicsTotal)
    : null;
  const overallLevel = overallPct == null
    ? null
    : overallPct >= 85 ? 'strong' : overallPct >= 60 ? 'developing' : 'weak';

  const untestedCount = scoredTopics.filter(t => t.untested).length;
  const strongCount = scoredTopics.filter(t => !t.untested && t.level === 'strong').length;
  const miniTestCount = scoredTopics.reduce(
    (sum, t) => sum + (t.hasMiniTest ? 1 : 0), 0
  );

  // Surface the worst 3, untested topics first
  const weak = scoredTopics
    .filter(t => t.untested || t.level !== 'strong')
    .slice(0, 3);

  // Tone: untested takes priority — they need to know there
  // are still topics they haven't proven anything on.
  const tone = untestedCount > 0
    ? 'untested'
    : weak.length === 0
      ? 'allStrong'
      : strongCount > 0 ? 'mixed' : 'buildUp';

  // Effort estimate: scale by number of gap-worthy topics
  const estNodes = Math.max(3, (weak.length + untestedCount) * 2 + 1);
  const estMin = estNodes * 4;

  return {
    hasData: true,
    overallPct,
    overallLevel,
    weak,
    strongCount,
    untestedCount,
    miniTestCount,
    totalCorrect,
    totalQuestions,
    topicsTotal,
    tone,
    estNodes,
    estMin,
  };
};

/* ──────────────────────────────────────────────────────────
   Helper: coerce an exam date from any of the shapes we
   might receive (Firestore Timestamp, JS Date, ISO string,
   millis number) into a JS Date — or null if invalid.
   ────────────────────────────────────────────────────────── */
const coerceExamDate = (raw) => {
  if (!raw) return null;
  let d = null;
  if (raw && typeof raw.toDate === 'function') d = raw.toDate();
  else if (raw instanceof Date) d = raw;
  else if (typeof raw === 'number') d = new Date(raw);
  else if (typeof raw === 'string') d = new Date(raw);
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

/* ──────────────────────────────────────────────────────────
   Helper: live time-left breakdown for the countdown banner.
   Keeps days/hours/minutes/seconds in sync with the wall
   clock so the urgency tier flips automatically when a far
   exam slides into the < 24h window.
   ────────────────────────────────────────────────────────── */
const computeTimeLeft = (date) => {
  if (!date) return null;
  const now = Date.now();
  const diff = date.getTime() - now;
  const isPast = diff < 0;
  const abs = Math.abs(diff);
  return {
    isPast,
    diffMs: diff,
    days: Math.floor(abs / 86400000),
    hours: Math.floor((abs % 86400000) / 3600000),
    minutes: Math.floor((abs % 3600000) / 60000),
    seconds: Math.floor((abs % 60000) / 1000),
  };
};

/* ──────────────────────────────────────────────────────────
   ReadinessCountdown — premium banner that sits at the top
   of the readiness card and drives test-day urgency.
   Tier scales styling from calm (>7d) to urgent (<24h).
   ────────────────────────────────────────────────────────── */
const ReadinessCountdown = ({ examDate, language = 'en' }) => {
  const { t } = useTranslation();
  const date = useMemo(() => coerceExamDate(examDate), [examDate]);

  // Tick every second when exam is within 24h (so the seconds
  // visibly count down); every 30s otherwise to keep perf cheap.
  // We re-read Date.now() inside computeTimeLeft on every render
  // and only use this state to force re-renders on a cadence.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!date) return undefined;
    const remaining = date.getTime() - Date.now();
    if (remaining <= 0) return undefined; // already past — no need to tick
    const cadence = remaining < 86400000 ? 1000 : 30000;
    const id = setInterval(() => setTick(n => n + 1), cadence);
    return () => clearInterval(id);
  }, [date]);

  if (!date) return null;
  const tl = computeTimeLeft(date);
  if (!tl) return null;

  // Stale cutoff: once an exam is more than 14 days behind us,
  // the banner stops carrying useful signal and just clutters
  // the readiness card. The chat doc still has the date if a
  // future flow wants to offer "set a new exam date".
  const STALE_PAST_DAYS = 14;
  if (tl.isPast && tl.days > STALE_PAST_DAYS) return null;

  // Urgency tier governs color, copy, and pulse animation
  const tier = tl.isPast
    ? 'past'
    : tl.days >= 7
      ? 'far'
      : tl.days >= 3
        ? 'soon'
        : tl.days >= 1
          ? 'close'
          : 'imminent';

  const locale = (language || 'en').toLowerCase().startsWith('fr') ? 'fr-FR' : 'en-US';
  const formattedDate = date.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  // Past exams use a single localized phrase ("5 days ago" /
  // "il y a 5 jours") instead of the big-number-plus-unit
  // layout. That layout assumes a forward count to render
  // cleanly; "5 days · Exam day has passed" reads as two
  // disconnected facts. Today-but-already-done collapses to
  // "Earlier today" since `tl.days === 0`.
  const pastPhrase = tl.isPast
    ? (tl.days === 0
        ? t('countdown.earlierToday', 'Earlier today')
        : t('countdown.daysAgo', { count: tl.days, defaultValue: '{{count}} days ago' }))
    : null;

  // Primary line: big number + unit. Choose the tightest
  // unit that still feels stable (no "23h 59m" jittering when
  // a "1d" reading would do — shown alongside as detail).
  let primaryNumber = tl.days;
  let primaryUnit = t('countdown.unitDays', { count: tl.days, defaultValue: 'days' });
  let detail = '';

  if (!tl.isPast) {
    if (tier === 'imminent' && tl.days === 0) {
      if (tl.hours >= 1) {
        primaryNumber = tl.hours;
        primaryUnit = t('countdown.unitHours', { count: tl.hours, defaultValue: 'hours' });
        detail = `${tl.minutes}m ${String(tl.seconds).padStart(2, '0')}s`;
      } else if (tl.minutes >= 1) {
        primaryNumber = tl.minutes;
        primaryUnit = t('countdown.unitMinutes', { count: tl.minutes, defaultValue: 'minutes' });
        detail = `${String(tl.seconds).padStart(2, '0')}s`;
      } else {
        primaryNumber = tl.seconds;
        primaryUnit = t('countdown.unitSeconds', { count: tl.seconds, defaultValue: 'seconds' });
        detail = t('countdown.almostThere', 'Almost there');
      }
    } else {
      // 1+ days: show days + a soft "Xh Ym" detail line
      detail = `${tl.hours}h ${String(tl.minutes).padStart(2, '0')}m`;
    }
  }

  const eyebrow = tl.isPast
    ? t('countdown.eyebrowPast', 'Exam passed')
    : tier === 'imminent'
      ? t('countdown.eyebrowToday', 'Test day')
      : t('countdown.eyebrowUntil', 'Exam in');

  return (
    <div
      className={`sov3-countdown sov3-countdown--${tier}`}
      role="status"
      aria-live="polite"
      aria-label={t('countdown.aria', 'Time until exam')}
    >
      <div className="sov3-countdown__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <rect x="3" y="4" width="18" height="18" rx="3" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <circle cx="12" cy="16" r="2.2" fill="currentColor" stroke="none" />
        </svg>
      </div>

      <div className="sov3-countdown__main">
        <span className="sov3-countdown__eyebrow">{eyebrow}</span>
        {tl.isPast ? (
          <span className="sov3-countdown__phrase">{pastPhrase}</span>
        ) : (
          <div className="sov3-countdown__primary">
            <span className="sov3-countdown__number">{primaryNumber}</span>
            <span className="sov3-countdown__unit">{primaryUnit}</span>
            {detail && (
              <span className="sov3-countdown__detail">{detail}</span>
            )}
          </div>
        )}
      </div>

      <div className="sov3-countdown__date" aria-hidden="true">
        {formattedDate}
      </div>

      {tier === 'imminent' && !tl.isPast && (
        <span className="sov3-countdown__pulse" aria-hidden="true" />
      )}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────
   Narration stages shown while Phase 2 generates. We stream
   client-side because the backend returns the plan in one
   shot — but seeing the system "think" is what makes anxious
   students trust the output.
   ────────────────────────────────────────────────────────── */
const NARRATION_STAGES = [
  { key: 'study.narrationReview',   fallback: 'Reviewing your results' },
  { key: 'study.narrationAnalyze',  fallback: 'Mapping accuracy by topic' },
  { key: 'study.narrationFinding',  fallback: 'Picking the spots that matter most' },
  { key: 'study.narrationBuilding', fallback: 'Building your targeted nodes' },
];

/* ══════════════════════════════════════════════════════════
   COMPONENT: StudyPlanOverview
   Sections-as-cards with milestone mini-tests and
   ambient insights sidebar.
   ══════════════════════════════════════════════════════════ */
const StudyPlanOverview = ({
  studyState,
  examDate = null,
  onNodeSelect,
  onRetakeExam,
  onShowInsights,
  insightsData = null,
  sidebarOpen = true,
  isGeneratingPhase2 = false,
  onStartPhase2,
  isDev = false
}) => {
  const { t, i18n } = useTranslation();
  const language = i18n?.language || 'en';
  const activeSectionRef = useRef(null);

  const nodes = studyState?.path?.nodes || [];
  const topics = studyState?.path?.topics || [];
  const realNodes = nodes.filter(n => n.type !== 'section_banner');
  const completedCount = realNodes.filter(n => n.status === 'done').length;
  const totalNodes = realNodes.length;

  // ── Derive sections + milestones from flat nodes array ──
  const { sections, renderOrder } = useMemo(
    () => buildSections(nodes, topics, insightsData),
    [nodes, topics, insightsData]
  );

  // ── Expand/collapse state for completed sections ──
  const [expandedSections, setExpandedSections] = useState(new Set());
  const toggleSection = (id) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Auto-scroll to active section on mount ──
  useEffect(() => {
    if (activeSectionRef.current) {
      setTimeout(() => {
        activeSectionRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }, 100);
    }
  }, [sections]);

  // ── Phase 2 detection ──
  const hasPhase2Nodes = nodes.some(n => n.phase === 2);
  const phase1AllDone = completedCount === totalNodes && totalNodes > 0 && !hasPhase2Nodes;

  // ── Narration stage progression while Phase 2 generates ──
  const [narrationIdx, setNarrationIdx] = useState(0);
  useEffect(() => {
    if (!isGeneratingPhase2) {
      setNarrationIdx(0);
      return undefined;
    }
    const interval = setInterval(() => {
      setNarrationIdx(idx => Math.min(idx + 1, NARRATION_STAGES.length - 1));
    }, 1400);
    return () => clearInterval(interval);
  }, [isGeneratingPhase2]);

  // ── Score every topic by question-weighted accuracy ──
  // Combines quiz answer counts (insightsData.topics) with
  // mini-test results (estimated from exam node scores). Each
  // entry is { correct, total, pct, level, hasMiniTest }.
  const scoredTopics = useMemo(
    () => buildScoredTopics(nodes, topics, insightsData),
    [nodes, topics, insightsData]
  );

  // ── Compute insights groups for the sidebar ──
  const insightsGroups = useMemo(() => {
    if (!insightsData?.topics) return null;
    const groups = { weak: [], developing: [], strong: [] };
    for (const [name, tp] of Object.entries(insightsData.topics)) {
      const qAcc = tp.questionsTotal > 0 ? tp.questionsCorrect / tp.questionsTotal : null;
      const fAcc = tp.flashcardsTotal > 0 ? tp.flashcardsMastered / tp.flashcardsTotal : null;
      const scores = [qAcc, fAcc].filter(s => s !== null);
      if (scores.length === 0) continue;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const level = avg >= 0.85 ? 'strong' : avg >= 0.6 ? 'developing' : 'weak';
      groups[level].push({ name, pct: Math.round(avg * 100), level });
    }
    const hasAny = Object.values(groups).some(g => g.length > 0);
    return hasAny ? groups : null;
  }, [insightsData]);

  // ── Render a single step row ──
  const renderStep = (step) => {
    const isActive = step.status === 'active';
    const isDone = step.status === 'done';
    const isLocked = step.status === 'locked';
    const canClick = !isLocked || isDev;
    const topicLabel = getStepTopicLabel(step.label);
    const nodeProgress = step.nodeProgress || 0;

    return (
      <div
        key={step.id}
        className={[
          'sov3-step',
          isActive ? 'sov3-step--active' : '',
          isDone ? 'sov3-step--done' : '',
          isLocked ? 'sov3-step--locked' : '',
          step.adaptive ? 'sov3-step--adaptive' : '',
        ].filter(Boolean).join(' ')}
        onClick={canClick ? (e) => { e.stopPropagation(); onNodeSelect(step); } : undefined}
      >
        <div className="sov3-step__icon">
          {isLocked && !isDev ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 10h-1V7a5 5 0 00-10 0v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2zM9 7a3 3 0 016 0v3H9V7zm3 9a2 2 0 110-4 2 2 0 010 4z"/>
            </svg>
          ) : (
            getStudyNodeIcon(step.type, step.status)
          )}
        </div>
        <div className="sov3-step__content">
          <span className="sov3-step__format">
            {step.adaptive && step.reason
              ? step.reason.length > 30 ? step.reason.substring(0, 30) + '...' : step.reason
              : formatNodeType(step.type, t)}
          </span>
          <span className="sov3-step__label">{topicLabel}</span>
        </div>
        <div className="sov3-step__action">
          {isDone && (
            <span className="sov3-step__score">
              {nodeProgress > 0 ? `${nodeProgress}%` : t('study.done', 'Done')}
            </span>
          )}
          {isActive && (
            <button
              className="sov3-step__start-btn"
              onClick={(e) => { e.stopPropagation(); onNodeSelect(step); }}
            >
              {nodeProgress > 0
                ? t('study.continue', 'Continue')
                : t('study.start', 'Start')}
            </button>
          )}
          {isLocked && !isDev && (
            <span className="sov3-step__lock-badge">
              <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                <path d="M18 10h-1V7a5 5 0 00-10 0v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2zM9 7a3 3 0 016 0v3H9V7zm3 9a2 2 0 110-4 2 2 0 010 4z"/>
              </svg>
            </span>
          )}
        </div>
      </div>
    );
  };

  // ── Render a section card ──
  const renderSectionCard = (section) => {
    const isComplete = section.status === 'complete';
    const isActive = section.status === 'active';
    const isLocked = section.status === 'locked';
    const isExpanded = isActive || expandedSections.has(section.id);
    const doneSteps = section.steps.filter(s => s.status === 'done').length;

    return (
      <div
        key={section.id}
        ref={isActive ? activeSectionRef : null}
        className={[
          'sov3-card',
          isComplete ? 'sov3-card--complete' : '',
          isActive ? 'sov3-card--active' : '',
          isLocked && !isDev ? 'sov3-card--locked' : '',
          isLocked && isDev ? 'sov3-card--dev' : '',
          isExpanded ? 'sov3-card--expanded' : '',
        ].filter(Boolean).join(' ')}
        onClick={isComplete ? () => toggleSection(section.id) : undefined}
      >
        {/* Card header */}
        <div className="sov3-card__header">
          {isComplete && (
            <div className="sov3-card__status-icon sov3-card__status-icon--complete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          )}
          {isActive && (
            <div className="sov3-card__status-icon sov3-card__status-icon--active" />
          )}
          {isLocked && !isDev && (
            <div className="sov3-card__status-icon sov3-card__status-icon--locked">
              <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                <path d="M18 10h-1V7a5 5 0 00-10 0v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2zM9 7a3 3 0 016 0v3H9V7zm3 9a2 2 0 110-4 2 2 0 010 4z"/>
              </svg>
            </div>
          )}

          <div className="sov3-card__title-group">
            <h3 className="sov3-card__title">
              <span className="sov3-card__number">
                {t('study.sectionLabel', 'Section {{number}}', { number: section.sectionNumber })}
              </span>
              <span className="sov3-card__dot"> · </span>
              <span className="sov3-card__name">{section.name}</span>
            </h3>

            {isComplete && (
              <p className="sov3-card__summary">
                {section.steps.length} {t('study.nodesDone', 'nodes done')}
                {section.performance?.pct != null && (
                  <> · <span className={`sov3-card__strength sov3-card__strength--${section.performance.strengthLevel}`}>
                    {section.performance.pct}% {t(`study.${section.performance.strengthLevel}`, section.performance.strengthLevel)}
                  </span></>
                )}
              </p>
            )}
            {isActive && (
              <p className="sov3-card__summary">
                {doneSteps} {t('study.of', 'of')} {section.steps.length} {t('study.done', 'done')}
              </p>
            )}
            {isLocked && (
              <p className="sov3-card__summary">
                {section.steps.length} {t('study.nodes', 'nodes')}
              </p>
            )}
          </div>

          {isComplete && (
            <div className={`sov3-card__chevron ${isExpanded ? 'sov3-card__chevron--open' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          )}

          {isComplete && !isExpanded && (
            <button
              className="sov3-card__review-btn"
              onClick={(e) => { e.stopPropagation(); toggleSection(section.id); }}
            >
              {t('study.review', 'Review')}
            </button>
          )}

          {isLocked && !isDev && (
            <div className="sov3-card__lock">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M18 10h-1V7a5 5 0 00-10 0v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2zM9 7a3 3 0 016 0v3H9V7zm3 9a2 2 0 110-4 2 2 0 010 4z"/>
              </svg>
            </div>
          )}
        </div>

        {/* Expanded steps list */}
        <div className={`sov3-card__steps-wrapper ${isExpanded ? 'sov3-card__steps-wrapper--open' : ''}`}>
          <div className="sov3-card__steps">
            {section.steps.map(step => renderStep(step))}
          </div>
        </div>
      </div>
    );
  };

  // ── Render a standalone milestone (mini-test) ──
  const renderMilestone = (examNode) => {
    const isDone = examNode.status === 'done';
    const isActive = examNode.status === 'active';
    const isLocked = examNode.status === 'locked';
    const canClick = !isLocked || isDev;
    const topicLabel = getStepTopicLabel(examNode.label);
    const score = examNode.nodeProgress || 0;
    const scoreLevel = score >= 85 ? 'strong' : score >= 60 ? 'developing' : 'weak';

    return (
      <div
        key={examNode.id}
        ref={isActive ? activeSectionRef : null}
        className={[
          'sov3-milestone',
          (isDone || score > 0) ? 'sov3-milestone--done' : '',
          isActive && score === 0 ? 'sov3-milestone--active' : '',
          isLocked && !isDev ? 'sov3-milestone--locked' : '',
        ].filter(Boolean).join(' ')}
        onClick={canClick ? () => onNodeSelect(examNode) : undefined}
      >
        {/* Connector line above */}
        <div className="sov3-milestone__connector" />

        {/* Icon circle */}
        <div className="sov3-milestone__icon">
          {(isDone || score > 0) ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 5C9 3.9 9.9 3 11 3H13C14.1 3 15 3.9 15 5H19C20.1 5 21 5.9 21 7V20C21 21.1 20.1 22 19 22H5C3.9 22 3 21.1 3 20V7C3 5.9 3.9 5 5 5H9ZM11 5V4H13V5H11ZM7 9H17V7H7V9ZM7 13H17V11H7V13ZM7 17H13V15H7V17Z" />
            </svg>
          )}
        </div>

        {/* Label */}
        <div className="sov3-milestone__content">
          <span className="sov3-milestone__badge">
            {t('study.miniTest', 'Mini-Test')}
          </span>
          <span className="sov3-milestone__label">{topicLabel}</span>
        </div>

        {/* Action / Result */}
        <div className="sov3-milestone__action">
          {(isDone || score > 0) && score > 0 && (
            <>
              <div className={`sov3-milestone__result sov3-milestone__result--${scoreLevel}`}>
                <span className="sov3-milestone__score">{score}%</span>
                <span className="sov3-milestone__level">
                  {scoreLevel === 'strong'
                    ? t('study.strong', 'Strong')
                    : scoreLevel === 'developing'
                      ? t('study.developing', 'Developing')
                      : t('study.needsWork', 'Needs work')}
                </span>
              </div>
              <button
                className="sov3-milestone__retake"
                onClick={(e) => { e.stopPropagation(); onRetakeExam(examNode); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                {t('study.retake', 'Retake')}
              </button>
            </>
          )}
          {isDone && score === 0 && (
            <>
              <span className="sov3-milestone__done-badge">
                {t('study.passed', 'Passed')}
              </span>
              <button
                className="sov3-milestone__retake"
                onClick={(e) => { e.stopPropagation(); onRetakeExam(examNode); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                {t('study.retake', 'Retake')}
              </button>
            </>
          )}
          {isActive && score === 0 && (
            <button
              className="sov3-milestone__start-btn"
              onClick={(e) => { e.stopPropagation(); onNodeSelect(examNode); }}
            >
              {t('study.start', 'Start')}
            </button>
          )}
          {isLocked && !isDev && (
            <svg className="sov3-milestone__lock" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
              <path d="M18 10h-1V7a5 5 0 00-10 0v3H6a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2v-8a2 2 0 00-2-2zM9 7a3 3 0 016 0v3H9V7zm3 9a2 2 0 110-4 2 2 0 010 4z"/>
            </svg>
          )}
        </div>

        {/* Connector line below */}
        <div className="sov3-milestone__connector" />
      </div>
    );
  };

  return (
    <div className={`study-overview-container study-overview-v3 ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>

      {/* ── Living background canvas ── */}
      <div className="study-bg-canvas" aria-hidden="true">
        <div className="sbg-orb sbg-orb--1" />
        <div className="sbg-orb sbg-orb--2" />
        <div className="sbg-orb sbg-orb--3" />
        <div className="sbg-orb sbg-orb--4" />
        <svg className="sbg-doodle sbg-d1" viewBox="0 0 54 64" fill="none">
          <path d="M11 8 C11 18 19 24 27 29" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
          <path d="M43 8 C43 18 35 24 27 29" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
          <path d="M27 29 C27 38 33 46 39 55" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
          <circle cx="39" cy="55" r="8" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.08"/>
          <circle cx="39" cy="55" r="4.5" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.4"/>
          <circle cx="39" cy="55" r="2" fill="currentColor"/>
          <circle cx="11" cy="7" r="4" fill="currentColor"/>
          <circle cx="43" cy="7" r="4" fill="currentColor"/>
        </svg>
        <svg className="sbg-doodle sbg-d2" viewBox="0 0 48 44" fill="none">
          <path d="M24 40 C24 40 3 27 3 14 A10.5 10.5 0 0 1 24 10 A10.5 10.5 0 0 1 45 14 C45 27 24 40 24 40 Z" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M5 24 L13 24 L16 14 L20 34 L23 19 L26 24 L43 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <svg className="sbg-doodle sbg-d3" viewBox="0 0 64 22" fill="none">
          <path d="M50 11 L64 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <path d="M46 8.5 L50 10.5 L50 11.5 L46 13.5 Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
          <rect x="14" y="5" width="32" height="12" rx="6" stroke="currentColor" strokeWidth="1.8"/>
          <line x1="22" y1="5.5" x2="22" y2="16.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.4"/>
          <line x1="30" y1="5.5" x2="30" y2="16.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.4"/>
          <line x1="38" y1="5.5" x2="38" y2="16.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.4"/>
          <line x1="6" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <rect x="2" y="6.5" width="7.5" height="9" rx="2" stroke="currentColor" strokeWidth="1.8"/>
        </svg>
        <svg className="sbg-doodle sbg-d5" viewBox="0 0 30 30" fill="currentColor">
          <rect x="12" y="2" width="6" height="26" rx="3"/>
          <rect x="2" y="12" width="26" height="6" rx="3"/>
        </svg>
        <svg className="sbg-doodle sbg-d6" viewBox="0 0 50 22" fill="none">
          <rect x="1" y="2" width="48" height="18" rx="9" stroke="currentColor" strokeWidth="2"/>
          <path d="M10 2 L25 2 L25 20 L10 20 A9 9 0 0 1 10 2 Z" fill="currentColor" fillOpacity="0.2"/>
          <line x1="25" y1="3" x2="25" y2="19" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.45"/>
        </svg>
        <svg className="sbg-doodle sbg-d7" viewBox="0 0 46 46" fill="none">
          <g transform="rotate(45 23 23)">
            <rect x="2" y="15" width="9" height="16" rx="4.5" stroke="currentColor" strokeWidth="1.7"/>
            <rect x="11" y="12" width="24" height="22" rx="3" stroke="currentColor" strokeWidth="1.7"/>
            <rect x="35" y="15" width="9" height="16" rx="4.5" stroke="currentColor" strokeWidth="1.7"/>
            <circle cx="18" cy="23" r="1.4" fill="currentColor" opacity="0.55"/>
            <circle cx="28" cy="23" r="1.4" fill="currentColor" opacity="0.55"/>
          </g>
        </svg>
        <svg className="sbg-doodle sbg-d8" viewBox="0 0 18 54" fill="none">
          <rect x="5.5" y="2" width="7" height="30" rx="3.5" stroke="currentColor" strokeWidth="1.8"/>
          <rect x="7.5" y="18" width="3" height="16" rx="1.5" fill="currentColor" fillOpacity="0.35"/>
          <circle cx="9" cy="43" r="7" stroke="currentColor" strokeWidth="1.8"/>
          <circle cx="9" cy="43" r="4" fill="currentColor" fillOpacity="0.3"/>
          <line x1="12.5" y1="7" x2="15" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          <line x1="12.5" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          <line x1="12.5" y1="19" x2="15" y2="19" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          <line x1="12.5" y1="25" x2="14" y2="25" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        </svg>
        <svg className="sbg-doodle sbg-d9" viewBox="0 0 84 26" fill="none">
          <path d="M2 13 L19 13 L23 3 L27 23 L31 7 L35 13 L82 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <svg className="sbg-doodle sbg-d10" viewBox="0 0 26 38" fill="none">
          <rect x="5" y="1" width="16" height="7" rx="3" stroke="currentColor" strokeWidth="1.7"/>
          <path d="M8 7.5 L8 11 M18 7.5 L18 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <rect x="2" y="11" width="22" height="26" rx="4" stroke="currentColor" strokeWidth="1.7"/>
          <rect x="5.5" y="15" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.5"/>
          <line x1="13" y1="17.5" x2="13" y2="23.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="10" y1="20.5" x2="16" y2="20.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>

      {/* ── Header ── */}
      <div className="sov3-header">
        <div className="sov3-header__title-section">
          <h1 className="study-overview-title">
            {topics.length > 0 ? topics[0] : t('study.yourStudyPlan', 'Your Study Plan')}
          </h1>
          {topics.length > 1 && (
            <p className="study-overview-subtitle">
              {topics.slice(1, 3).join(', ')}
            </p>
          )}
        </div>

        {/* Segmented progress bar */}
        {sections.length > 0 && (
          <div className="sov3-progress-bar">
            {sections.map(s => (
              <div
                key={s.id}
                className={`sov3-progress-segment sov3-progress-segment--${s.status}`}
                style={{ flex: s.steps.length }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Readiness Hero (radial ring + summary)
          Sits between the header and the section cards so the
          score is visible without scrolling. Same data as before;
          rectangular score badge swapped for a radial progress
          ring (`.sov3-readiness__ring`). */}
      {!hasPhase2Nodes && (() => {
          const snap = buildReadinessSnapshot(scoredTopics);
          // Show the card whenever we have a curriculum to talk about
          // (even at 0 questions answered — that's the urgency moment).
          if (!snap.hasData) return null;

          const nodesRemaining = Math.max(0, totalNodes - completedCount);
          const isMidSession = !phase1AllDone;
          const noDataYet = snap.totalQuestions === 0;

          const headlineText = noDataYet
            ? t('study.readinessJustStarted', 'Your test readiness starts here')
            : snap.tone === 'untested'
              ? t('study.readinessUntested', '{{count}} topic not measured yet', { count: snap.untestedCount })
              : snap.tone === 'allStrong'
                ? t('study.readinessAllStrong', "You're solid across the board")
                : snap.tone === 'mixed'
                  ? t('study.readinessMixed', "Strong start. Let's close these gaps.")
                  : t('study.readinessBuildUp', "Let's build your foundation before test day");

          const subtitleText = noDataYet
            ? t('study.readinessFirstQuiz', 'Take your first quiz to start measuring how ready you are')
            : snap.tone === 'untested'
              ? t('study.readinessUntestedSub', 'Your confidence will sharpen as you cover more')
              : snap.tone === 'allStrong'
                ? t('study.readinessAllStrongSub', 'A few mixed-format quizzes to keep it sharp')
                : t('study.readinessGapsSub', "We'll target the spots most likely to surprise you on test day");

          // CTA morphs based on whether Phase 1 is done
          const ctaText = isMidSession
            ? t('study.keepGoingCta', 'Keep going')
            : (snap.tone === 'allStrong'
                ? t('study.buildPracticeRound', 'Build my practice round')
                : t('study.buildFocusedReview', 'Build my focused review'));

          const ctaMeta = isMidSession
            ? t('study.nodesUntilReview', '{{count}} more node', { count: nodesRemaining })
            : t('study.estimateMin', '~{{min}} min', { min: snap.estMin });

          const handleCtaClick = (e) => {
            e.stopPropagation();
            if (isMidSession) {
              activeSectionRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
            } else {
              onStartPhase2?.();
            }
          };

          return (
            <div
              className={[
                'sov3-readiness',
                isGeneratingPhase2 ? 'sov3-readiness--generating' : '',
                isMidSession ? 'sov3-readiness--mid-session' : '',
                snap.overallLevel ? `sov3-readiness--${snap.overallLevel}` : '',
              ].filter(Boolean).join(' ')}
              role="button"
              tabIndex={isGeneratingPhase2 ? -1 : 0}
              onClick={!isGeneratingPhase2 ? handleCtaClick : undefined}
              onKeyDown={(e) => {
                if (!isGeneratingPhase2 && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleCtaClick(e);
                }
              }}
            >
              {!isGeneratingPhase2 ? (
                <>
                  {/* Countdown banner — only renders when an exam
                      date is on the chat doc. Sits at the top of
                      the readiness card to drive test-day urgency
                      before the score conversation. */}
                  {examDate && (
                    <ReadinessCountdown
                      examDate={examDate}
                      language={language}
                    />
                  )}
                  <div className="sov3-readiness__head">
                    <div className="sov3-readiness__title-group">
                      <span className="sov3-readiness__eyebrow">
                        {isMidSession
                          ? t('study.readinessSoFar', 'Readiness so far')
                          : t('study.testReadiness', 'Test readiness')}
                      </span>
                      <h3 className="sov3-readiness__title">{headlineText}</h3>
                      <p className="sov3-readiness__subtitle">{subtitleText}</p>
                      {!noDataYet && (
                        <p className="sov3-readiness__data-source">
                          {t('study.basedOnQuestions', 'Based on {{count}} answered question', { count: snap.totalQuestions })}
                        </p>
                      )}
                    </div>
                    {snap.overallPct != null && (() => {
                      // Radial readiness ring. SVG with two circles —
                      // background track + colored progress arc — using
                      // stroke-dasharray/offset for the arc length.
                      // When `noDataYet` (no questions answered), we hold
                      // the same shape and typography but show an em dash
                      // in place of the number — speaks the same visual
                      // language as the populated state, just without
                      // baking in a "0%" failing grade.
                      const ringSize = 104;
                      const stroke = 9;
                      const ringRadius = (ringSize - stroke) / 2;
                      const ringCircumference = 2 * Math.PI * ringRadius;
                      const safePct = Math.max(0, Math.min(100, snap.overallPct));
                      const ringOffset = ringCircumference * (1 - safePct / 100);
                      const ringLevel = noDataYet ? 'starter' : snap.overallLevel;
                      return (
                        <div
                          className={`sov3-readiness__ring sov3-readiness__ring--${ringLevel}`}
                          style={{ width: ringSize, height: ringSize }}
                          aria-label={
                            noDataYet
                              ? t('study.readyToBegin', 'Ready to begin')
                              : t('study.confidence', 'confidence') + ` ${snap.overallPct}%`
                          }
                        >
                          <svg
                            className="sov3-readiness__ring-svg"
                            viewBox={`0 0 ${ringSize} ${ringSize}`}
                            width={ringSize}
                            height={ringSize}
                          >
                            <circle
                              className="sov3-readiness__ring-track"
                              cx={ringSize / 2}
                              cy={ringSize / 2}
                              r={ringRadius}
                              strokeWidth={stroke}
                              fill="none"
                            />
                            {/* Skip the colored progress arc in starter mode —
                                a zero-length arc looks like a tiny coral dot
                                at the top of the ring, which reads as broken. */}
                            {!noDataYet && (
                              <circle
                                className="sov3-readiness__ring-arc"
                                cx={ringSize / 2}
                                cy={ringSize / 2}
                                r={ringRadius}
                                strokeWidth={stroke}
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={ringCircumference}
                                strokeDashoffset={ringOffset}
                                transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                              />
                            )}
                          </svg>
                          <div className="sov3-readiness__ring-content">
                            {noDataYet ? (
                              <span className="sov3-readiness__ring-pct sov3-readiness__ring-pct--starter" aria-hidden="true">
                                {/* Em dash — same big-bold treatment as the
                                    score, just without a number to render. */}
                                —
                              </span>
                            ) : (
                              <span className="sov3-readiness__ring-pct">{snap.overallPct}<span className="sov3-readiness__ring-pct-sign">%</span></span>
                            )}
                            <span className="sov3-readiness__ring-tag">
                              {t('study.confidence', 'confidence')}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {snap.weak.length > 0 && (
                    <div className="sov3-readiness__gaps">
                      <div className="sov3-readiness__gaps-label">
                        {snap.tone === 'untested'
                          ? t('study.gapsAndUntested', 'Topics to cover before test day')
                          : t('study.gapsToClose', 'Gaps to close before test day')}
                      </div>
                      <div className="sov3-readiness__gaps-list">
                        {snap.weak.map(topic => (
                          <div
                            key={topic.name}
                            className={[
                              'sov3-readiness__gap',
                              `sov3-readiness__gap--${topic.level}`,
                              topic.untested ? 'sov3-readiness__gap--untested' : '',
                            ].filter(Boolean).join(' ')}
                            title={topic.name}
                          >
                            <span className="sov3-readiness__gap-dot" aria-hidden="true" />
                            <span className="sov3-readiness__gap-name">{topic.name}</span>
                            <span className="sov3-readiness__gap-pct">
                              {topic.untested
                                ? t('study.notMeasuredYet', 'Not measured')
                                : `${topic.pct}%`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {snap.strongCount > 0 && (
                    <div className="sov3-readiness__locked">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                        <polyline points="3 8.5 6.5 12 13 4.5" />
                      </svg>
                      <span>
                        {t('study.lockedIn', '{{count}} topic locked in', { count: snap.strongCount })}
                      </span>
                    </div>
                  )}

                  <div className="sov3-readiness__cta-row">
                    <button
                      type="button"
                      className={[
                        'sov3-readiness__cta',
                        isMidSession ? 'sov3-readiness__cta--soft' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={handleCtaClick}
                    >
                      <span className="sov3-readiness__cta-text">{ctaText}</span>
                      {(isMidSession ? nodesRemaining > 0 : true) && (
                        <span className="sov3-readiness__cta-meta">{ctaMeta}</span>
                      )}
                      <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                        <path d="M3 7h8M8 4l3 3-3 3" />
                      </svg>
                    </button>
                  </div>
                </>
              ) : (
                <div className="sov3-readiness__generating">
                  <div className="sov3-readiness__gen-head">
                    <div className="study-loading-spinner sov3-readiness__gen-spinner" />
                    <h3 className="sov3-readiness__title">
                      {t('study.buildingFocusedReview', 'Building your focused review')}
                    </h3>
                  </div>
                  <ul className="sov3-readiness__steps">
                    {NARRATION_STAGES.map((stage, i) => {
                      const isDone = i < narrationIdx;
                      const isActive = i === narrationIdx;
                      return (
                        <li
                          key={stage.key}
                          className={[
                            'sov3-readiness__step',
                            isDone ? 'sov3-readiness__step--done' : '',
                            isActive ? 'sov3-readiness__step--active' : '',
                          ].filter(Boolean).join(' ')}
                        >
                          <span className="sov3-readiness__step-icon" aria-hidden="true">
                            {isDone ? (
                              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                                <polyline points="2.5 7.5 5.5 10.5 11.5 4" />
                              </svg>
                            ) : isActive ? (
                              <span className="sov3-readiness__step-pulse" />
                            ) : (
                              <span className="sov3-readiness__step-dot" />
                            )}
                          </span>
                          <span className="sov3-readiness__step-text">
                            {t(stage.key, stage.fallback)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })()}

      {/* ── Section Cards + Milestones (interleaved) ── */}
      <div className="sov3-sections">
        {renderOrder.map(item =>
          item.type === 'section'
            ? renderSectionCard(item.data)
            : renderMilestone(item.data)
        )}

        {/* Empty state */}
        {sections.length === 0 && totalNodes === 0 && (
          <div className="sov3-empty">
            <p>{t('study.noNodesYet', 'No study plan generated yet.')}</p>
          </div>
        )}
      </div>

      {/* ── Ambient Insights Sidebar (desktop only) ── */}
      {insightsGroups && (
        <div
          className="sov3-insights"
          onClick={onShowInsights}
          role="button"
          title={t('study.viewInsights', 'View full insights')}
        >
          <div className="sov3-insights__header">
            <svg viewBox="0 0 14 14" fill="currentColor" width="12" height="12">
              <rect x="0" y="7" width="3.5" height="7" rx="1"/>
              <rect x="5.25" y="3.5" width="3.5" height="10.5" rx="1"/>
              <rect x="10.5" y="0" width="3.5" height="14" rx="1"/>
            </svg>
            <span className="sov3-insights__title">{t('study.yourProgress', 'Your Progress')}</span>
          </div>

          {/* Strength summary chips */}
          <div className="sov3-insights__chips">
            {insightsGroups.strong.length > 0 && (
              <span className="sov3-insights__chip sov3-insights__chip--strong">
                <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" width="8" height="8"><polyline points="1.5,5.5 3.5,7.5 8.5,2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {insightsGroups.strong.length}
              </span>
            )}
            {insightsGroups.developing.length > 0 && (
              <span className="sov3-insights__chip sov3-insights__chip--developing">
                <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" width="8" height="8"><circle cx="5" cy="5" r="3.5"/></svg>
                {insightsGroups.developing.length}
              </span>
            )}
            {insightsGroups.weak.length > 0 && (
              <span className="sov3-insights__chip sov3-insights__chip--weak">
                <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" width="8" height="8"><line x1="2" y1="2" x2="8" y2="8" strokeLinecap="round"/><line x1="8" y1="2" x2="2" y2="8" strokeLinecap="round"/></svg>
                {insightsGroups.weak.length}
              </span>
            )}
          </div>

          {/* Topic bars — show up to 5 most relevant */}
          <div className="sov3-insights__topics">
            {[...insightsGroups.weak, ...insightsGroups.developing, ...insightsGroups.strong]
              .slice(0, 5)
              .map(topic => (
                <div key={topic.name} className="sov3-insights__topic">
                  <span className="sov3-insights__topic-name" title={topic.name}>{topic.name}</span>
                  <div className="sov3-insights__topic-bar">
                    <div
                      className={`sov3-insights__topic-fill sov3-insights__topic-fill--${topic.level}`}
                      style={{ width: `${Math.max(topic.pct, 6)}%` }}
                    />
                  </div>
                  <span className={`sov3-insights__topic-pct sov3-insights__topic-pct--${topic.level}`}>
                    {topic.pct}%
                  </span>
                </div>
              ))}
          </div>

          {/* "View all" nudge */}
          <div className="sov3-insights__footer">
            <span>{t('study.viewAll', 'View all')}</span>
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" width="9" height="9">
              <path d="M2 8L8 2M8 2H4M8 2v4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      )}

    </div>
  );
};

export default StudyPlanOverview;
