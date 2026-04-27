import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
   Helper: type-specific icon SVG for each node type
   ────────────────────────────────────────────────────────── */
const getNodeIcon = (type, status) => {
  if (status === 'done') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  switch (type) {
    case 'lesson':
      return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 2C4.89 2 4 2.9 4 4V20C4 21.1 4.89 22 6 22H18C19.1 22 20 21.1 20 20V4C20 2.9 19.1 2 18 2H6ZM6 4H11V12L8.5 10.5L6 12V4Z" /></svg>);
    case 'quiz':
      return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 19H11V17H13V19ZM15.07 11.25L14.17 12.17C13.45 12.9 13 13.5 13 15H11V14.5C11 13.4 11.45 12.4 12.17 11.67L13.41 10.41C13.78 10.05 14 9.55 14 9C14 7.9 13.1 7 12 7C10.9 7 10 7.9 10 9H8C8 6.79 9.79 5 12 5C14.21 5 16 6.79 16 9C16 9.88 15.64 10.68 15.07 11.25Z" /></svg>);
    case 'flashcard':
      return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 6H2V20C2 21.1 2.9 22 4 22H18V20H4V6ZM20 2H8C6.9 2 6 2.9 6 4V16C6 17.1 6.9 18 8 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H8V4H20V16ZM13 14H15V11H18V9H15V6H13V9H10V11H13V14Z" /></svg>);
    case 'audio':
      return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1C7.03 1 3 5.03 3 10V17C3 18.66 4.34 20 6 20H9V12H5V10C5 6.13 8.13 3 12 3C15.87 3 19 6.13 19 10V12H15V20H18C19.66 20 21 18.66 21 17V10C21 5.03 16.97 1 12 1Z" /></svg>);
    case 'mindmap':
      return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C13.1 2 14 2.9 14 4C14 4.74 13.6 5.39 13 5.73V7H14C15.1 7 16 7.9 16 9V10.27C16.6 10.61 17 11.26 17 12C17 12.74 16.6 13.39 16 13.73V15C16 16.1 15.1 17 14 17H13V18.27C13.6 18.61 14 19.26 14 20C14 21.1 13.1 22 12 22C10.9 22 10 21.1 10 20C10 19.26 10.4 18.61 11 18.27V17H10C8.9 17 8 16.1 8 15V13.73C7.4 13.39 7 12.74 7 12C7 11.26 7.4 10.61 8 10.27V9C8 7.9 8.9 7 10 7H11V5.73C10.4 5.39 10 4.74 10 4C10 2.9 10.9 2 12 2ZM10 9V15H14V9H10Z" /></svg>);
    case 'review':
      return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5L12 9V6C15.31 6 18 8.69 18 12C18 13.01 17.75 13.97 17.3 14.8L18.76 16.26C19.54 15.03 20 13.57 20 12C20 7.58 16.42 4 12 4ZM12 18C8.69 18 6 15.31 6 12C6 10.99 6.25 10.03 6.7 9.2L5.24 7.74C4.46 8.97 4 10.43 4 12C4 16.42 7.58 20 12 20V23L16 19L12 15V18Z" /></svg>);
    case 'exam':
      return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 5C9 3.9 9.9 3 11 3H13C14.1 3 15 3.9 15 5H19C20.1 5 21 5.9 21 7V20C21 21.1 20.1 22 19 22H5C3.9 22 3 21.1 3 20V7C3 5.9 3.9 5 5 5H9ZM11 5V4H13V5H11ZM7 9H17V7H7V9ZM7 13H17V11H7V13ZM7 17H13V15H7V17Z" /></svg>);
    default:
      return (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z" /></svg>);
  }
};

/* ──────────────────────────────────────────────────────────
   Helper: estimated minutes per node type
   ────────────────────────────────────────────────────────── */
const getNodeEstimate = (type) => {
  const map = { lesson: 5, quiz: 4, flashcard: 3, audio: 6, mindmap: 5, review: 2, exam: 15 };
  return map[type] || 4;
};

/* ──────────────────────────────────────────────────────────
   Helper: format a node type for display
   ────────────────────────────────────────────────────────── */
const formatNodeType = (type, t) => {
  return t(`study.nodeType.${type}`, type.charAt(0).toUpperCase() + type.slice(1));
};

/* ──────────────────────────────────────────────────────────
   Helper: extract the topic portion of a label
   ────────────────────────────────────────────────────────── */
const getStepTopicLabel = (label) => {
  if (!label) return '';
  const suffixes = [
    /\s*[-–]\s*(Quiz|Listen|Audio|Concept Map|Vocabulaire|Basics|Advanced|Review|Pre-Test|Final Test|Recap|Lesson)\s*$/i,
  ];
  let clean = label;
  for (const re of suffixes) {
    clean = clean.replace(re, '');
  }
  return clean.trim() || label;
};

/* ══════════════════════════════════════════════════════════
   COMPONENT: StudyPlanOverview
   Sections-as-cards with milestone mini-tests and
   ambient insights sidebar.
   ══════════════════════════════════════════════════════════ */
const StudyPlanOverview = ({
  studyState,
  onNodeSelect,
  onRetakeExam,
  onShowInsights,
  insightsData = null,
  sidebarOpen = true,
  isGeneratingPhase2 = false,
  onStartPhase2,
  isDev = false
}) => {
  const { t } = useTranslation();
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
            getNodeIcon(step.type, step.status)
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

      {/* ── Section Cards + Milestones (interleaved) ── */}
      <div className="sov3-sections">
        {renderOrder.map(item =>
          item.type === 'section'
            ? renderSectionCard(item.data)
            : renderMilestone(item.data)
        )}

        {/* Phase 2 placeholder */}
        {phase1AllDone && !hasPhase2Nodes && (
          <div className={`sov3-card sov3-card--phase2 ${isGeneratingPhase2 ? 'sov3-card--generating' : ''}`}>
            <div className="sov3-card__header" onClick={!isGeneratingPhase2 ? onStartPhase2 : undefined}>
              <div className="sov3-card__status-icon sov3-card__status-icon--phase2">
                {isGeneratingPhase2 ? (
                  <div className="study-loading-spinner" style={{ width: 16, height: 16 }} />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div className="sov3-card__title-group">
                <h3 className="sov3-card__title">
                  <span className="sov3-card__name">
                    {isGeneratingPhase2
                      ? t('study.generatingPlan', 'Analyzing your results...')
                      : t('study.basedOnInsights', 'Based on Your Insights')}
                  </span>
                </h3>
                <p className="sov3-card__summary">
                  {isGeneratingPhase2
                    ? t('study.buildingPersonalizedPlan', 'Building your personalized review plan...')
                    : t('study.tapToGenerateReview', 'Tap to generate your review plan')}
                </p>
              </div>
            </div>
          </div>
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
