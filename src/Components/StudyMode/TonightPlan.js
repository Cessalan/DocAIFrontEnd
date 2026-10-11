import React from 'react';
import { useTranslation } from 'react-i18next';
import { KIND, OUTCOME, ROLE, isComparable, tonightRole } from './tonightPlanModel';
import './TonightPlan.css';

/**
 * Tonight's plan, on screen. Two pieces:
 *
 *   TonightPanel     on the plan overview: why the plan is short, the rounds
 *                    done so far with their results, and the one next action.
 *   TonightRoundView between steps: after the taught fix step ("now check it
 *                    worked") and after the check (the round's result and the
 *                    next round).
 *
 * All the deciding is in tonightPlanModel.js; these only say it. Copy rules
 * (owner): one main action per moment, no red/green fills, numbers only
 * where they mean something, the small-sample caveat once, no em dashes.
 */

const score = (t) => `${t.correct} / ${t.total}`;

/** "select-all questions", "who-goes-first questions", a topic, … */
export const useTargetName = () => {
  const { t } = useTranslation();
  return (target) => {
    if (!target) return '';
    if (target.kind === KIND.SKILL) return t(`tonight.skill.${target.skill}`);
    if (target.kind === KIND.TOPIC) return target.topic;
    if (target.kind === KIND.FIND) return t('tonight.target.find');
    return t('tonight.target.mixed');
  };
};

/** One line on why the next round is what it is, from the evidence only. */
const nextReason = (target, t, evidence) => {
  if (!target) return '';
  if (target.kind === KIND.SKILL && target.easier) return t('tonight.reason.retry');
  if (target.kind === KIND.MIXED) return t(target.level > 1 ? 'tonight.reason.mixedHarder' : 'tonight.reason.mixed');
  if (target.kind === KIND.FIND) return t('tonight.reason.find');
  const pick = target.kind === KIND.SKILL ? (e) => e.skill === target.skill
    : (e) => String(e.topic || '').trim().toLowerCase() === String(target.topic || '').trim().toLowerCase();
  const mine = (evidence || []).filter(pick);
  const correct = mine.filter((e) => e.correct).length;
  return t('tonight.reason.weakest', { correct, total: mine.length });
};

/** The round's result line: a comparison only when both sides have answers. */
const ResultLine = ({ round }) => {
  const { t } = useTranslation();
  if (!round?.after?.total) return null;
  if (isComparable(round)) {
    return (
      <p className="tn-result">
        <span className="tn-result__from">{t('tonight.earlier', { score: score(round.before) })}</span>
        <span className="tn-result__arrow" aria-hidden="true">→</span>
        <span className="tn-result__to">{t('tonight.now', { score: score(round.after) })}</span>
      </p>
    );
  }
  return <p className="tn-result"><span className="tn-result__to">{t('tonight.onCheck', { score: score(round.after) })}</span></p>;
};

const daysLabel = (days, t) => {
  if (!Number.isFinite(days)) return null;
  if (days <= 0) return t('tonight.examToday');
  if (days === 1) return t('tonight.examTomorrow');
  return t('tonight.examInDays', { count: days });
};

export function TonightPanel({ tonight, nodes = [], activeNodeId, daysToExam, nextTarget, busy, onOpenNode, onNextRound }) {
  const { t } = useTranslation();
  const name = useTargetName();
  const rounds = tonight?.rounds || [];
  const done = rounds.filter((r) => r.status === 'done');
  const current = rounds.find((r) => r.status === 'active') || null;
  const activeNode = nodes.find((n) => n.id === activeNodeId && n.status === 'active') || null;
  const activeRole = tonightRole(activeNode);
  const steps = current ? nodes.filter((n) => tonightRole(n)?.round === current.n) : [];

  return (
    <section className="tn-panel" aria-label={t('tonight.title')}>
      {daysLabel(daysToExam, t) && <p className="tn-eyebrow">{daysLabel(daysToExam, t)}</p>}
      <h2 className="tn-title">{t('tonight.title')}</h2>
      <p className="tn-why">{t('tonight.why')}</p>

      {done.length > 0 && (
        <ol className="tn-rounds">
          {done.map((r) => (
            <li key={r.n} className="tn-round is-done">
              <div className="tn-round__head">
                <b>{t('tonight.roundName', { n: r.n, name: name(r) })}</b>
                <span>{t(`tonight.outcomeShort.${r.outcome}`)}</span>
              </div>
              <ResultLine round={r} />
            </li>
          ))}
        </ol>
      )}

      {current && (
        <div className="tn-round is-current">
          <div className="tn-round__head">
            <b>{t('tonight.roundName', { n: current.n, name: name(current) })}</b>
          </div>
          {steps.length > 1 && (
            <ol className="tn-steps" aria-label={t('tonight.stepsLabel')}>
              {steps.map((n) => {
                const role = tonightRole(n).role;
                return (
                  <li key={n.id} className={n.status === 'done' ? 'is-done' : n.id === activeNodeId ? 'is-on' : ''}>
                    {t(role === ROLE.FIX ? (current.kind === KIND.TOPIC ? 'tonight.step.learnTopic' : 'tonight.step.learn') : 'tonight.step.check')}
                  </li>
                );
              })}
            </ol>
          )}
          <button type="button" className="tn-cta" disabled={busy || !activeNode} onClick={() => activeNode && onOpenNode(activeNode)}>
            {activeRole?.role === ROLE.CHECK ? t('tonight.ctaCheck') : t('tonight.ctaContinue', { n: current.n })}
          </button>
        </div>
      )}

      {!current && nextTarget && (
        <div className="tn-round is-next">
          <div className="tn-round__head"><b>{t('tonight.roundName', { n: rounds.length + 1, name: name(nextTarget) })}</b></div>
          <p className="tn-reason">{nextReason(nextTarget, t, tonight?.evidence)}</p>
          <button type="button" className="tn-cta" disabled={busy} onClick={onNextRound}>
            {busy ? t('tonight.preparing') : t('tonight.ctaStart', { n: rounds.length + 1 })}
          </button>
        </div>
      )}

      <p className="tn-hint">{t(done.length ? 'tonight.hintStop' : 'tonight.hintFirst')}</p>
    </section>
  );
}

/**
 * @param {'between'|'result'} mode
 * @param {object} round  the round (active for 'between', just closed for 'result')
 * @param {{correct,total}|null} fixTally  the fix step's answers, for 'between'
 */
export function TonightRoundView({ mode, round, fixTally, nextTarget, evidence, busy, onContinue, onNextRound, onStop }) {
  const { t } = useTranslation();
  const name = useTargetName();
  if (!round) return null;

  if (mode === 'between') {
    return (
      <section className="tn-view" aria-live="polite">
        <p className="tn-eyebrow">{t('tonight.roundName', { n: round.n, name: name(round) })}</p>
        <h2 className="tn-title">{fixTally?.total ? t('tonight.between.practised', { score: score(fixTally) }) : t('tonight.between.learned')}</h2>
        <p className="tn-why">{t('tonight.between.next')}</p>
        <button type="button" className="tn-cta" disabled={busy} onClick={onContinue}>{t('tonight.ctaCheck')}</button>
      </section>
    );
  }

  const comparable = isComparable(round);
  const headKey = round.outcome === OUTCOME.FIXED && !comparable ? 'solid' : round.outcome;
  return (
    <section className="tn-view" aria-live="polite">
      <p className="tn-eyebrow">{t('tonight.roundName', { n: round.n, name: name(round) })}</p>
      <h2 className="tn-title">{t(`tonight.outcome.${headKey}.title`)}</h2>
      <ResultLine round={round} />
      <p className="tn-why">{t(`tonight.outcome.${headKey}.body`)}</p>
      {comparable && <p className="tn-caveat">{t('tonight.caveat')}</p>}

      {nextTarget && (
        <div className="tn-round is-next">
          <div className="tn-round__head"><b>{t('tonight.nextRound', { n: round.n + 1, name: name(nextTarget) })}</b></div>
          <p className="tn-reason">{nextReason(nextTarget, t, evidence)}</p>
        </div>
      )}
      <button type="button" className="tn-cta" disabled={busy} onClick={onNextRound}>
        {busy ? t('tonight.preparing') : t('tonight.ctaStart', { n: round.n + 1 })}
      </button>
      <button type="button" className="tn-stop" disabled={busy} onClick={onStop}>{t('tonight.stop')}</button>
      <p className="tn-hint">{t('tonight.hintStop')}</p>
    </section>
  );
}
