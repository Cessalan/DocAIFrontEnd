import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNodeType, getStepTopicLabel, estimateMinutes } from './planFormatting';
import { getStudyNodeIcon } from './planNodeIcon';
import WarmUrgencyDashboard from './WarmUrgencyDashboard';
import TodaySessionCard from './TodaySessionCard';
import BlockCompleteCard from './BlockCompleteCard';
import { buildStudySchedule } from './studySchedule';
// normalizeTopic lives with the projection because both sides must bucket
// node labels the same way — two copies would silently drift apart.
import { projectReadiness, normalizeTopic } from './readinessProjection';
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
      // Strip node-label suffixes ("- Pre-Test", "- Review", …). Topic keys can
      // originate from a node label: the backend tags a question with
      // `node_label` when the question carries no topic of its own, and that
      // string becomes a studyPerformance key. Without this, raw labels leak
      // into user-facing copy — e.g. "One focused session on ABCDE Protocol -
      // Pre-Test could lock it in".
      name: getStepTopicLabel(entry.name),
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
  examName = null,
  onNodeSelect,
  onRetakeExam,
  onShowInsights,
  insightsData = null,
  sidebarOpen = true,
  isGeneratingPhase2 = false,
  onStartPhase2,
  onExtendBlock,
  onDrillGaps,
  isDev = false
}) => {
  const { t, i18n } = useTranslation();
  const language = i18n?.language || 'en';
  const activeSectionRef = useRef(null);

  // Memoised because `?? []` mints a fresh array on every render, which would
  // otherwise invalidate every downstream useMemo — including the schedule,
  // whose pinned `now` is only stable if its deps are.
  const nodes = useMemo(() => studyState?.path?.nodes || [], [studyState?.path?.nodes]);
  const topics = useMemo(() => studyState?.path?.topics || [], [studyState?.path?.topics]);
  const realNodes = useMemo(
    () => nodes.filter(n => n.type !== 'section_banner'),
    [nodes]
  );
  const completedCount = realNodes.filter(n => n.status === 'done').length;
  const totalNodes = realNodes.length;

  // ── Derive sections + milestones from flat nodes array ──
  const { sections, renderOrder } = useMemo(
    () => buildSections(nodes, topics, insightsData),
    [nodes, topics, insightsData]
  );

  // ── Full-plan disclosure ──
  // The page leads with TodaySessionCard (the next few nodes). The complete
  // 15–20 row list is opt-in: it's reference material, not the daily surface.
  // Once a student has real momentum the wall stops reading as a wall, so it
  // auto-expands after a third of the plan is behind them.
  const [showFullPlan, setShowFullPlan] = useState(false);

  // ── Expand/collapse state for completed sections ──
  const [expandedSections, setExpandedSections] = useState(new Set());
  const toggleSection = (id) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Momentum unlocks the full plan: past a third done, the list is a map of
  // what they've achieved rather than a pile of what's left.
  useEffect(() => {
    if (totalNodes > 0 && completedCount / totalNodes >= 0.34) {
      setShowFullPlan(true);
    }
  }, [completedCount, totalNodes]);

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

  // ── The dated plan ──
  // Recomputed every render from node status + completedAt + examDate. See
  // studySchedule.js for why nothing here is persisted: a stored calendar
  // goes stale the first day a student misses, and then every screen is
  // nagging them about a past they can't change.
  //
  // `now` is pinned to plan-state changes rather than read at call time, so an
  // unrelated re-render can't shuffle the mission window mid-interaction. It
  // refreshes when a node completes — exactly when the day's picture changed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => new Date(), [realNodes, examDate]);

  const schedule = useMemo(
    () => buildStudySchedule({
      nodes: realNodes,
      examDate,
      startDate: studyState?.startedAt || null,
      now,
    }),
    [realNodes, examDate, studyState?.startedAt, now]
  );

  // ── Phase 2 detection ──
  const hasPhase2Nodes = nodes.some(n => n.phase === 2);
  const phase1AllDone = completedCount === totalNodes && totalNodes > 0 && !hasPhase2Nodes;

  // ── Block completion ──
  // The plan ships one finishable block at a time (see firstBlock.js); the rest
  // of the planner's path waits in reserve. Finishing the block is the ending
  // the old 15-node plan never gave anyone.
  const reserveCount = studyState?.reserve?.remaining || 0;
  const blockComplete = phase1AllDone;

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

  // ── Action → outcome ──
  // Turns today's mission into the only number the student actually cares
  // about: where this session leaves their readiness. Replaces the step-count
  // footer, which described the system rather than the outcome.
  const projection = useMemo(
    () => projectReadiness({
      scoredTopics,
      missionNodes: schedule.missionNodes,
      remainingNodes: realNodes.filter(n => n.status !== 'done'),
      labelOf: (n) => getStepTopicLabel(n?.label || ''),
    }),
    [scoredTopics, schedule.missionNodes, realNodes]
  );

  // (The per-topic grouping that fed the ambient "Your Progress" sidebar lived
  // here. It went with the panel — the insights modal computes its own.)

  // Global 1-based position of each real node, for the "Step N" chip that
  // replaced the padlocks.
  const stepIndexById = useMemo(() => {
    const map = new Map();
    realNodes.forEach((n, i) => map.set(n.id, i));
    return map;
  }, [realNodes]);

  // ── Render a single step row ──
  const renderStep = (step) => {
    const stepNumber = stepIndexById.get(step.id);
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
        {/* Not-yet-reached steps keep their type icon, dimmed. A padlock here
            reads as "pay to unlock" in a freemium app — it made a fully-free
            plan look ~80% paywalled. Sequence is communicated by the step
            number in the action slot instead. */}
        <div className="sov3-step__icon">
          {getStudyNodeIcon(step.type, step.status)}
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
            <span className="sov3-step__step-num">
              {t('study.stepN', 'Step {{n}}', { n: (stepNumber ?? 0) + 1 })}
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
            <div className="sov3-card__status-icon sov3-card__status-icon--upcoming">
              <span className="sov3-card__status-num">{section.sectionNumber}</span>
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
                {' · '}
                {t('study.aboutMinutes', '~{{min}} min', {
                  min: estimateMinutes(section.steps.filter(s => s.status !== 'done')),
                })}
              </p>
            )}
            {isLocked && (
              <p className="sov3-card__summary">
                {section.steps.length} {t('study.nodes', 'nodes')}
                {' · '}
                {t('study.aboutMinutes', '~{{min}} min', {
                  min: estimateMinutes(section.steps),
                })}
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
            <div className="sov3-card__upcoming-tag">
              {t('study.upcoming', 'Upcoming')}
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
            <span className="sov3-milestone__upcoming">
              {t('study.upcoming', 'Upcoming')}
            </span>
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

      {/* ── Header ──
          The exam is the top of the hierarchy (exam → readiness → today's
          mission), so it takes the h1 when we know its name. The plan's topic
          becomes the mission headline further down rather than the page title,
          which is where a student looking for "what am I preparing for?"
          used to land on a subject name instead of their exam. */}
      <div className="sov3-header">
        <div className="sov3-header__title-section">
          <h1 className="study-overview-title">
            {examName
              || (topics.length > 0 ? topics[0] : t('study.yourStudyPlan', 'Your Study Plan'))}
          </h1>
          {examName && schedule.examAt ? (
            <p className="study-overview-subtitle">
              {schedule.examAt.toLocaleDateString(language, {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          ) : topics.length > 1 ? (
            <p className="study-overview-subtitle">
              {topics.slice(1, 3).join(', ')}
            </p>
          ) : null}
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

      {/* ── Warm Urgency Dashboard
          Empathic replacement for the old countdown+confidence layout.
          Effort-framed, no deficit language, tone driven by examDate.
          During Phase 2 generation we still render the original
          `.sov3-readiness__generating` block — that animation is
          intentional and part of the build flow.
          ────────────────────────────────────────────── */}
      {!hasPhase2Nodes && (() => {
          const snap = buildReadinessSnapshot(scoredTopics);
          if (!snap.hasData) return null;

          // The dashboard's only remaining action is starting the phase-2
          // practice round once the plan is finished. Mid-plan there is no CTA
          // here at all — TodaySessionCard owns "what do I do next", and a
          // second button that did the same thing one block higher was both
          // redundant and (while the section list was collapsed) a dead click.
          const handleCtaClick = (e) => {
            e.stopPropagation();
            onStartPhase2?.();
          };

          // (The binary "locked in / ready to explore" topic list that used to
          // be built here is gone. Every entry rendered the same badge until a
          // topic went strong, so it carried no information on the screen that
          // matters most — a new student's first — while duplicating the topic
          // list that TodaySessionCard and the full plan already show.)

          // Next-up topic = the most-prioritized "ready" entry.
          // snap.weak[] is already sorted untested-first then by lowest pct,
          // so its first element is the natural next focus.
          const nextTopicName = snap.weak[0]?.name || null;

          if (isGeneratingPhase2) {
            // Keep the original generating animation — it's part of the
            // "building your review" UX, not the dashboard surface.
            return (
              <div className="sov3-readiness sov3-readiness--generating">
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
              </div>
            );
          }

          return (
            <WarmUrgencyDashboard
              schedule={schedule}
              examName={examName}
              readinessPct={snap.overallPct}
              questionsAnswered={snap.totalQuestions}
              nodesCompleted={completedCount}
              topicsCompleted={snap.strongCount}
              topicsTotal={snap.topicsTotal}
              nextTopicName={nextTopicName}
              studyComplete={phase1AllDone}
              estimatedMinutes={snap.estMin}
              onCtaClick={handleCtaClick}
              language={language}
            />
          );
        })()}


      {/* ── The ending. Shown in place of today's mission once the block is
             done, because there is no mission left to show. ── */}
      {blockComplete && (
        <BlockCompleteCard
          completedCount={completedCount}
          reserveCount={reserveCount}
          onExtend={onExtendBlock}
          onDrillGaps={onDrillGaps}
        />
      )}

      {/* ── Today's mission — the near, finishable, DATED goal ── */}
      {totalNodes > 0 && !blockComplete && (
        <TodaySessionCard
          schedule={schedule}
          projection={projection}
          onNodeSelect={onNodeSelect}
          planTuned={completedCount === 0}
          expanded={showFullPlan}
          onToggleFull={() => setShowFullPlan(v => !v)}
        />
      )}

      {/* ── Section Cards + Milestones (interleaved) ──
          Reference view. Hidden until the student asks for it (or earns it by
          getting a third of the way in) so the first impression is a short
          session, not a 20-row backlog. */}
      {showFullPlan && (
        <div className="sov3-sections">
          {renderOrder.map(item =>
            item.type === 'section'
              ? renderSectionCard(item.data)
              : renderMilestone(item.data)
          )}
        </div>
      )}

      {/* Empty state */}
      {sections.length === 0 && totalNodes === 0 && (
        <div className="sov3-sections">
          <div className="sov3-empty">
            <p>{t('study.noNodesYet', 'No study plan generated yet.')}</p>
          </div>
        </div>
      )}

      {/* The ambient "Your Progress" sidebar used to float here — a truncated
          topic list with per-topic bars and a "View all" link. Removed: it
          competed with the readiness ring and today's mission for attention
          while answering neither "am I ready?" nor "what do I do now?", and
          on the page that leads with one action, a second floating panel is
          just clutter. The same data is one tap away via the insights modal.

          That tap is this link. `onShowInsights` was passed in but never
          rendered when the panel was removed, which left the modal reachable
          only from the mascot INSIDE a node — so the overview, the page you
          land on, had no route to your own results at all. A single quiet
          line doesn't compete with the ring the way the panel did. */}
      {onShowInsights && completedCount > 0 && (
        <div className="sov3-insights-link-row">
          <button
            type="button"
            className="sov3-insights-link"
            onClick={onShowInsights}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="15" height="15" aria-hidden="true">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('study.viewInsightsLink', 'See how you\'re doing')}
          </button>
        </div>
      )}

    </div>
  );
};

export default StudyPlanOverview;
