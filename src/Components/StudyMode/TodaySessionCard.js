import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNodeType, getStepTopicLabel, estimateMinutes } from './planFormatting';
import { getStudyNodeIcon } from './planNodeIcon';

/**
 * TodaySessionCard — the near goal.
 *
 * WHY: plans generate 15–20 nodes, and production data shows the median
 * student completes ONE. Plan length doesn't predict whether they get past
 * node 1, but a 20-row wall does set the felt size of the commitment, and a
 * plan-level progress bar barely moves no matter how hard they work.
 *
 * So the page leads with a small, finishable target — the next few nodes and
 * nothing else — while the full plan stays one tap away. Two behavioural
 * levers are doing the work here:
 *
 *   - GOAL GRADIENT: a 3-step bar visibly advances a third per node. The
 *     16-step bar advances 6%.
 *   - ENDOWED PROGRESS: the onboarding answers already personalised the plan,
 *     so the bar opens with a completed "Plan tuned" segment rather than at
 *     zero. People finish what looks already started.
 *
 * @param {Array}    nodes         - All real (non-banner) nodes, in plan order
 * @param {Function} onNodeSelect  - (node) => start/resume that node
 * @param {number}   [sessionSize] - How many nodes make up one session
 * @param {boolean}  [planTuned]   - Show the endowed "Plan tuned" segment
 * @param {boolean}  [expanded]    - Whether the full plan is currently shown
 * @param {Function} onToggleFull  - Toggle the full plan list
 */
const TodaySessionCard = ({
  nodes = [],
  onNodeSelect,
  sessionSize = 3,
  planTuned = true,
  expanded = false,
  onToggleFull,
}) => {
  const { t } = useTranslation();

  // The session window is ANCHORED, not recomputed from what's left.
  //
  // A sliding "next N unfinished nodes" window can never show progress: with
  // 15 nodes left and a size of 3 the slice is always full, so the bar sits at
  // 0 of 3 no matter how much work gets done. Anchoring to a fixed start index
  // is what makes the goal-gradient effect real — each completed node visibly
  // fills a third of the bar.
  //
  // When every node in the window is done the anchor jumps to the next
  // unfinished node, which starts a fresh session.
  const firstUnfinished = useMemo(
    () => {
      const i = nodes.findIndex(n => n.status !== 'done');
      return i === -1 ? nodes.length : i;
    },
    [nodes]
  );

  const [anchor, setAnchor] = useState(firstUnfinished);

  const { sessionNodes, doneToday, allDone, totalRemaining } = useMemo(() => {
    const window = nodes.slice(anchor, anchor + sessionSize);
    const done = window.filter(n => n.status === 'done').length;
    return {
      sessionNodes: window,
      doneToday: done,
      allDone: nodes.every(n => n.status === 'done'),
      totalRemaining: nodes.filter(n => n.status !== 'done').length,
    };
  }, [nodes, anchor, sessionSize]);

  // Window fully cleared (or the plan grew past it) — open the next session.
  useEffect(() => {
    if (allDone) return;
    const windowDone = sessionNodes.length > 0
      && sessionNodes.every(n => n.status === 'done');
    if (windowDone || sessionNodes.length === 0) {
      setAnchor(firstUnfinished);
    }
  }, [sessionNodes, firstUnfinished, allDone]);

  const minutes = useMemo(() => estimateMinutes(sessionNodes), [sessionNodes]);
  const totalSteps = nodes.length;

  if (allDone) return null;

  // Current node = first unfinished IN THE WINDOW (not simply the first slot,
  // which may already be completed now that the window is anchored).
  const primary = sessionNodes.find(n => n.status !== 'done');

  return (
    <div className="tsc">
      <div className="tsc__head">
        <span className="tsc__eyebrow">
          {t('study.todaySession', "Today's session")}
        </span>
        {minutes > 0 && (
          <span className="tsc__minutes">
            {t('study.aboutMinutes', '~{{min}} min', { min: minutes })}
          </span>
        )}
      </div>

      {/* Segmented session bar. The leading segment is the endowed one. */}
      <div className="tsc__track" aria-hidden="true">
        {planTuned && (
          <span className="tsc__seg tsc__seg--endowed" title={t('study.planTuned', 'Plan tuned')} />
        )}
        {Array.from({ length: sessionSize }, (_, i) => (
          <span
            key={i}
            className={`tsc__seg${i < doneToday ? ' tsc__seg--done' : ''}${i === doneToday ? ' tsc__seg--next' : ''}`}
          />
        ))}
      </div>

      <p className="tsc__status">
        {planTuned && (
          <span className="tsc__tuned">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.6"
                 strokeLinecap="round" strokeLinejoin="round" width="11" height="11" aria-hidden="true">
              <polyline points="3 8.5 6.5 12 13 4.5" />
            </svg>
            {t('study.planTuned', 'Plan tuned')}
          </span>
        )}
        <span className="tsc__count">
          {t('study.nodesOfSession', '{{done}} of {{total}} done', {
            done: doneToday,
            total: sessionSize,
          })}
        </span>
      </p>

      <ul className="tsc__list">
        {sessionNodes.map((node, idx) => {
          const isPrimary = node.id === primary?.id;
          const isDone = node.status === 'done';
          // Only the current node is actionable. The rest are a preview of
          // what this session contains — the path is sequential, and
          // completeNodeAndAdvance assumes you finish nodes in order, so
          // launching a later one out of turn would desync the plan.
          const inner = (
            <>
              <span className="tsc__item-icon" aria-hidden="true">
                {getStudyNodeIcon(node.type, isDone ? 'done' : isPrimary ? 'active' : 'locked')}
              </span>
              <span className="tsc__item-text">
                <span className="tsc__item-type">{formatNodeType(node.type, t)}</span>
                <span className="tsc__item-label">{getStepTopicLabel(node.label)}</span>
              </span>
              {isDone ? (
                <span className="tsc__item-step">{t('study.done', 'Done')}</span>
              ) : isPrimary ? (
                <span className="tsc__item-cta">
                  {node.nodeProgress > 0
                    ? t('study.continue', 'Continue')
                    : t('study.start', 'Start')}
                </span>
              ) : (
                <span className="tsc__item-step">
                  {t('study.stepN', 'Step {{n}}', { n: anchor + idx + 1 })}
                </span>
              )}
            </>
          );

          return (
            <li key={node.id}>
              {isPrimary ? (
                <button
                  type="button"
                  className="tsc__item is-primary"
                  onClick={() => onNodeSelect?.(node)}
                >
                  {inner}
                </button>
              ) : (
                <div className={`tsc__item${isDone ? ' is-done' : ' is-upcoming'}`}>
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* The rest of the plan stays available, just not in the way. */}
      {totalSteps > sessionNodes.length && (
        <button type="button" className="tsc__toggle" onClick={onToggleFull} aria-expanded={expanded}>
          <span>
            {expanded
              ? t('study.hideFullPlan', 'Hide full plan')
              : t('study.seeFullPlan', '{{count}}-step plan · see all', { count: totalSteps })}
          </span>
          <svg
            className={`tsc__chev${expanded ? ' is-open' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" width="15" height="15" aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {totalRemaining > sessionNodes.length && (
        <p className="tsc__after">
          {t('study.afterThisSession', '{{count}} more steps after this', {
            count: totalRemaining - sessionNodes.length,
          })}
        </p>
      )}
    </div>
  );
};

export default TodaySessionCard;
