import React from 'react';
import { useTranslation } from 'react-i18next';
import { STATUS } from './topicJourneyModel';
import './TonightPlan.css';
import './TopicJourney.css';

/**
 * Where she is across her plan's topics, in Tonight's plan's own language
 * (TonightPlan.js): what she finished and how it went, where she is, what is
 * left. All the deciding is in topicJourneyModel.js; this only says it.
 *
 *   TopicJourneyPanel  on the plan overview
 *   TopicHandoff       after a step that finishes a topic
 */

const score = (s) => `${s.correct} / ${s.total}`;
const UPCOMING_SHOWN = 2;

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

export function TopicJourneyPanel({ journey }) {
  const { t } = useTranslation();
  if (!journey || journey.total < 2) return null;
  const current = journey.topics[journey.currentIndex];
  const done = journey.topics.filter((topic) => topic.status === STATUS.DONE);
  const upcoming = journey.topics.filter((topic) => topic.status === STATUS.UPCOMING);
  return <section className="tn-panel tj-panel" aria-label={t('topicJourney.aria')}>
    <p className="tn-eyebrow">{t('topicJourney.eyebrow', { done: journey.done, total: journey.total })}</p>
    {current
      ? <h3 className="tn-title">{t('topicJourney.current', { number: journey.currentIndex + 1, total: journey.total, topic: current.topic })}</h3>
      : <h3 className="tn-title">{t('topicJourney.allDone')}</h3>}
    <ol className="tj-topics">
      {done.map((topic) => <li key={topic.key} className="tj-topic is-done">
        <span className="tj-mark is-done" aria-hidden="true" />
        <div><b>{topic.topic}</b>{topic.comparable ? <Result topic={topic} /> : <span className="tj-note">{t('topicJourney.done')}</span>}</div>
      </li>)}
      {current && <li className="tj-topic is-current">
        <span className="tj-mark is-current" aria-hidden="true" />
        <div><b>{current.topic}</b><span className="tj-note">{t('topicJourney.here')}</span></div>
      </li>}
      {upcoming.slice(0, UPCOMING_SHOWN).map((topic) => <li key={topic.key} className="tj-topic is-upcoming">
        <span className="tj-mark" aria-hidden="true" />
        <div><b>{topic.topic}</b></div>
      </li>)}
    </ol>
    {upcoming.length > UPCOMING_SHOWN && <p className="tj-more">{t('topicJourney.more', { count: upcoming.length - UPCOMING_SHOWN })}</p>}
  </section>;
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
