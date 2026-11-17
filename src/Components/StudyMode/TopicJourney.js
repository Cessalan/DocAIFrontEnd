import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STATUS } from './topicJourneyModel';
import './TonightPlan.css';
import './TopicJourney.css';
import TopicCard from './TopicCard';

/**
 * Where she is across her plan's topics, in Tonight's plan's own language
 * (TonightPlan.js): what she finished and how it went, where she is, what is
 * left. All the deciding is in topicJourneyModel.js; this only says it.
 *
 *   TopicJourneyPanel  on the plan overview
 *   TopicHandoff       after a step that finishes a topic
 *   TopicSwitcher      on a step and between steps: "Switch topic"
 *
 * With `onSwitch`, a topic she has not finished opens to a "Study this now"
 * button that takes her there (topicSwitchModel.js). The choice is hers at any moment; it is
 * not something the plan has to get round to offering.
 */

const score = (s) => `${s.correct} / ${s.total}`;
const UPCOMING_SHOWN = 2;

const Chevron = ({ open = false }) => <svg className={`tj-chevron${open ? ' is-open' : ''}`} viewBox="0 0 24 24" width="16" height="16"
  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <polyline points="6 9 12 15 18 9" /></svg>;

function Result({ topic }) {
  const { t } = useTranslation();
  if (topic.comparable) {
    return <p className="tn-result">
      <span className="tn-result__from">{t('tonight.earlier', { score: score(topic.before) })}</span>
      <span className="tn-result__arrow" aria-hidden="true">→</span>
      <span className="tn-result__to">{t('tonight.now', { score: score(topic.after) })}</span>
    </p>;
  }
  return null;
}

/** How far she got on a topic she started and left. Nothing for one she never opened. */
function Started({ option }) {
  const { t } = useTranslation();
  if (!option || option.stepsDone === 0) return null;
  return <span className="tj-note">{t('topicJourney.started', { done: option.stepsDone, total: option.stepsDone + option.stepsLeft })}</span>;
}

/**
 * A topic she can switch to. Tapping the row OPENS it; the switch itself is
 * the button inside. The first version switched on the row tap behind a
 * right-pointing chevron, and the owner's first tap changed their plan when
 * they expected the row to expand (2026-11-16). A switch rewrites the plan,
 * so it gets a control that says what it does.
 */
export function SwitchRow({ option, mark = false, open, onToggle, busyKey, onSwitch }) {
  const { t } = useTranslation();
  return <li className={`tj-topic is-switchable${mark ? ' is-upcoming' : ''}${open ? ' is-open' : ''}`}>
    <button type="button" className="tj-topic__btn" aria-expanded={open} onClick={onToggle}>
      {mark && <span className="tj-mark" aria-hidden="true" />}
      <span className="tj-topic__text"><b>{option.topic}</b>{!open && <Started option={option} />}</span>
      <Chevron open={open} />
    </button>
    {open && <div className={`tj-topic__more${mark ? ' has-mark' : ''}`}>
      <p className="tj-note">{option.stepsDone > 0
        ? t('topicJourney.started', { done: option.stepsDone, total: option.stepsDone + option.stepsLeft })
        : t('topicJourney.stepsLeft', { count: option.stepsLeft })}</p>
      <button type="button" className="tj-go" disabled={!!busyKey}
        aria-label={t('topicJourney.switchTo', { topic: option.topic })} onClick={() => onSwitch(option.key)}>
        {busyKey === option.key ? t('topicJourney.switching') : t('topicJourney.go')}
      </button>
    </div>}
  </li>;
}

export function TopicJourneyPanel({ journey, options = [], onSwitch = null, busyKey = null, bare = false }) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const [openKey, setOpenKey] = useState(null);
  if (!journey || journey.total < 2) return null;
  const current = journey.topics[journey.currentIndex];
  const done = journey.topics.filter((topic) => topic.status === STATUS.DONE);
  const upcoming = journey.topics.filter((topic) => topic.status === STATUS.UPCOMING);
  const optionByKey = new Map(options.map((option) => [option.key, option]));
  const canSwitch = typeof onSwitch === 'function' && upcoming.some((topic) => optionByKey.has(topic.key));
  // `bare` is the list alone, every topic shown, for inside today's card
  // (TodaySessionCard), which already says which topic she is on.
  const shown = showAll || bare ? upcoming : upcoming.slice(0, UPCOMING_SHOWN);
  const hidden = upcoming.length - shown.length;
  const Wrap = bare ? 'div' : 'section';
  return <Wrap className={bare ? 'tj-bare' : 'tn-panel tj-panel'} role={bare ? 'group' : undefined} aria-label={t('topicJourney.aria')}>
    {!bare && <p className="tn-eyebrow">{t('topicJourney.eyebrow', { done: journey.done, total: journey.total })}</p>}
    {!bare && (current
      ? <h3 className="tn-title">{t('topicJourney.current', { number: journey.currentIndex + 1, total: journey.total, topic: current.topic })}</h3>
      : <h3 className="tn-title">{t('topicJourney.allDone')}</h3>)}
    {canSwitch && <p className="tj-hint">{t('topicJourney.switchHint')}</p>}
    <ol className="tj-topics">
      {done.map((topic) => <li key={topic.key} className="tj-topic is-done">
        <span className="tj-mark is-done" aria-hidden="true" />
        <div><b>{topic.topic}</b>{topic.comparable ? <Result topic={topic} /> : <span className="tj-note">{t('topicJourney.done')}</span>}</div>
      </li>)}
      {current && <li className="tj-topic is-current">
        <span className="tj-mark is-current" aria-hidden="true" />
        <div><b>{current.topic}</b><span className="tj-note">{t('topicJourney.here')}</span></div>
      </li>}
      {shown.map((topic) => {
        const option = optionByKey.get(topic.key);
        if (!canSwitch || !option) {
          return <li key={topic.key} className="tj-topic is-upcoming">
            <span className="tj-mark" aria-hidden="true" />
            <div><b>{topic.topic}</b></div>
          </li>;
        }
        return <SwitchRow key={topic.key} option={option} mark open={openKey === topic.key} busyKey={busyKey} onSwitch={onSwitch}
          onToggle={() => setOpenKey(openKey === topic.key ? null : topic.key)} />;
      })}
    </ol>
    {hidden > 0 && (canSwitch
      ? <button type="button" className="tj-more tj-more--btn" onClick={() => setShowAll(true)}>{t('topicJourney.showMore', { count: hidden })}</button>
      : <p className="tj-more">{t('topicJourney.more', { count: hidden })}</p>)}
  </Wrap>;
}

/**
 * "Switch topic", one quiet line that opens the list of her other topics.
 * Lives on the step itself and on the screen between steps, so leaving a
 * topic never depends on reaching the plan overview.
 */
export function TopicSwitcher({ options = [], onSwitch, onStartStep = null, busyKey = null, className = '' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [openKey, setOpenKey] = useState(null);
  if (typeof onSwitch !== 'function' || options.length === 0) return null;
  return <div className={`tj-switch ${open ? 'is-open' : ''} ${className}`.trim()}>
    <button type="button" className="tj-switch__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        strokeLinejoin="round" aria-hidden="true"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
      <span>{t('topicJourney.switch')}</span>
    </button>
    {open && <div className="tj-switch__list" role="group" aria-label={t('topicJourney.aria')}>
      <p className="tj-hint">{t('topicJourney.switchHint')}</p>
      {/* The same card the plan overview draws for a topic (TopicCard.js). */}
      <div className="tj-cards">
        {options.map((option) => <TopicCard key={option.key} option={option} open={openKey === option.key} busyKey={busyKey}
          onSwitch={onSwitch} onStartStep={onStartStep} onToggle={() => setOpenKey(openKey === option.key ? null : option.key)} />)}
      </div>
    </div>}
  </div>;
}

export function TopicHandoff({ handoff }) {
  const { t } = useTranslation();
  if (!handoff) return null;
  return <div className="tj-handoff" role="status">
    <p className="tj-handoff__done"><span className="tj-mark is-done" aria-hidden="true" />{t('topicJourney.finished', { topic: handoff.done.topic })}</p>
    <Result topic={handoff.done} />
    <p className="tj-handoff__next">{t('topicJourney.next', { number: handoff.nextNumber, total: handoff.total, topic: handoff.next.topic })}</p>
  </div>;
}
