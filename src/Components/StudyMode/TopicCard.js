import React from 'react';
import { useTranslation } from 'react-i18next';
import { estimateMinutes, formatNodeType, getStepTopicLabel } from './planFormatting';
import { getStudyNodeIcon } from './planNodeIcon';
import './StudyMode.css';
import './TopicJourney.css';

/**
 * TopicCard: a topic she can switch to, drawn ONE way everywhere.
 *
 * WHY THIS EXISTS (2026-11-16)
 * The same topic was drawn twice in two styles: as a section card on the
 * plan overview ("Section 2 · Gerontologic Considerations, 2 nodes · ~9 min",
 * with its steps) and as a bare row under "Switch topic" inside a step
 * ("3 steps, not started"). The owner put the two screenshots side by side:
 * "these don't even look similar... the user feels lost". They also counted
 * differently, because the overview drew the topic's mini-test as a separate
 * row and the switcher counted it.
 *
 * So both places render this card from the same option (topicSwitchModel
 * `switchOptions`): the plan's own card look, the same summary, the same
 * steps including the mini-test, and the same quiet button.
 *
 * Every step in the card can be started by itself, and the ROW is the
 * control: drawn at full strength with an arrow, like a link in a list. The
 * first version dimmed these rows and revealed a "Study now" button on hover;
 * dimmed reads as "locked", nobody hovers what looks locked, and a touch
 * screen has no hover, so every row grew a button (2026-11-17).
 * She chooses the quick review, the quiz or the mini-test; the plan does not
 * march her through them in order (topicSwitchModel, "any step").
 *
 * The button is deliberately secondary. A screen has one filled button, the
 * step she is on (today's card, or the question in front of her); picking
 * something else is always available and never competes with it.
 *
 * @param {Object}   option    {key, topic, stepsLeft, stepsDone, steps:[node]}
 * @param {string}   [eyebrow] e.g. "Section 2", on the plan overview only
 * @param {boolean}  open
 * @param {Function} onToggle
 * @param {string}   [busyKey] the topic being switched to, if any
 * @param {Function} onSwitch     (topicKey) => void, used when onStartStep is absent
 * @param {Function} [onStartStep] (node) => void, start that one step
 */
const TopicCard = ({ option, eyebrow = null, open = false, onToggle, busyKey = null, onSwitch, onStartStep = null }) => {
  const { t } = useTranslation();
  const steps = option.steps || [];
  const minutes = estimateMinutes(steps);
  const summary = option.stepsDone > 0
    ? t('topicJourney.summaryStarted', { done: option.stepsDone, total: option.stepsDone + option.stepsLeft, min: minutes })
    : t('topicJourney.summary', { count: option.stepsLeft, min: minutes });
  const onKey = (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle?.(); }
  };

  return (
    <div className={`sov3-card sov3-card--topic${open ? ' sov3-card--expanded' : ''}`}>
      <div className="sov3-card__header sov3-card__header--toggle" role="button" tabIndex={0} aria-expanded={open}
        aria-label={option.topic} onClick={onToggle} onKeyDown={onKey}>
        <div className="sov3-card__title-group">
          <h3 className="sov3-card__title">
            {eyebrow && <><span className="sov3-card__number">{eyebrow}</span><span className="sov3-card__dot"> · </span></>}
            <span className="sov3-card__name">{option.topic}</span>
          </h3>
          <p className="sov3-card__summary">{summary}</p>
        </div>
        <div className={`sov3-card__chevron ${open ? 'sov3-card__chevron--open' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            width="18" height="18" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
        </div>
      </div>

      <div className={`sov3-card__steps-wrapper ${open ? 'sov3-card__steps-wrapper--open' : ''}`}>
        <div className="sov3-card__steps">
          {steps.map((step) => (
            <div key={step.id} className="sov3-step sov3-step--pickable"
              role="button" tabIndex={open ? 0 : -1} aria-disabled={!!busyKey || undefined}
              aria-label={t('topicJourney.startStep', { step: formatNodeType(step.type, t), topic: option.topic })}
              onClick={() => { if (!busyKey) (onStartStep ? onStartStep(step) : onSwitch?.(option.key)); }}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!busyKey) (onStartStep ? onStartStep(step) : onSwitch?.(option.key)); } }}>
              <div className="sov3-step__icon">{getStudyNodeIcon(step.type, step.status)}</div>
              <div className="sov3-step__content">
                <span className="sov3-step__format">{formatNodeType(step.type, t)}</span>
                <span className="sov3-step__label">{getStepTopicLabel(step.label)}</span>
              </div>
              <div className="sov3-step__action">
                {busyKey === `step:${step.id}` || busyKey === option.key
                  ? <span className="sov3-step__step-num">{t('topicJourney.switching')}</span>
                  : <svg className="sov3-step__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TopicCard;
