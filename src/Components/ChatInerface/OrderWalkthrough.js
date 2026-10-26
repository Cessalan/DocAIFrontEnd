import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LADDER_RUNGS, firstSlip, ladderState } from './orderWalkthroughModel';
import { clarityEvent } from '../../Services/ClarityService';
import './OrderWalkthrough.css';

/**
 * OrderWalkthrough — the replay behind "Watch how to order it" on a missed
 * ordering question.
 *
 * Plays like a short video, climbing the ladder on the question she just
 * missed: the chart's deciding details light up and are explained, each
 * action is labelled with what it does for this patient, the tutor thinks out
 * loud and places number 1, then every other action places itself in turn
 * with its rule and reason. Nothing to tap. It used to make her place number 2
 * onward herself, and students clicked straight through it (owner,
 * 2026-10-25); the rule for her first slip now also sits as one line on the
 * card itself (orderWalkthroughModel `slipRule`). The order comes from the
 * stored key; the words from NQBackEnd2/services/order_walkthrough.py.
 *
 * Tone (owner, 2026-10-10: "safe, premium, empathetic, easy to assimilate yet
 * clear"): one thing happens at a time, nothing is red, and the end names
 * exactly what she did earlier and why, once.
 *
 * Renders inside the case-study card and uses its --q-* tokens, so dark mode
 * is inherited. prefers-reduced-motion removes the pacing, never a step.
 */

const PACE = {
  read: 1000,        // a beat before the first detail lights up
  part: 1800,        // each detail of the chart, highlighted and explained
  label: 650,        // each action's label, in turn
  ready: 900,        // between one stage and the next
  dots: 900,         // "thinking" before each line of the demonstration
  line: 1700,        // reading one line of the demonstration
  hold: 2600,        // reading the reason for a placed action before the next
};
const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const Badge = ({ n }) => <span className="ow-badge" aria-hidden="true">{n + 1}</span>;

/** `text` with each part's quote wrapped and numbered, lit once its turn has
 *  come. `offset` keeps the numbering global across the chart and question. */
const highlight = (text, parts, litCount) => {
  const lower = text.toLowerCase();
  const spans = parts
    .map((p, n) => ({ n, at: lower.indexOf(String(p.quote || '').toLowerCase()), len: String(p.quote || '').length }))
    .filter((x) => x.at >= 0 && x.len > 0)
    .sort((a, b) => a.at - b.at)
    .filter((x, i, all) => i === 0 || x.at >= all[i - 1].at + all[i - 1].len);
  const out = [];
  let cursor = 0;
  spans.forEach((x) => {
    out.push(text.slice(cursor, x.at));
    out.push(
      <mark key={x.n} className={`ow-fact${x.n < litCount ? ' is-lit' : ''}`}>
        {x.n < litCount && <Badge n={x.n} />}
        {text.slice(x.at, x.at + x.len)}
      </mark>
    );
    cursor = x.at + x.len;
  });
  out.push(text.slice(cursor));
  return out;
};

/**
 * @param {string} question     the question text she saw
 * @param {string} chart        the chart notes as plain text (chartText)
 * @param {{id: string, text: string}[]} items  the actions, in the order shown on the card
 * @param {string[]} keyIds     the stored correct order
 * @param {string[]} herOrder   the order she submitted
 * @param {object} walkthrough  the validated backend response
 * @param {function} [onNext]   moves the card on; offered at the end when given
 * @param {string} [nextLabel]  the card's own label for moving on
 */
export default function OrderWalkthrough({ question, chart, items, keyIds, herOrder, walkthrough, onClose, onNext, nextLabel }) {
  const { t } = useTranslation();
  // The backend's items are in KEY order; index them by item id.
  const info = useMemo(() => Object.fromEntries(keyIds.map((id, k) => [id, walkthrough.items[k]])), [keyIds, walkthrough]);
  const textOf = useMemo(() => Object.fromEntries(items.map((it) => [it.id, it.text])), [items]);
  const parts = walkthrough.breakdown || [];
  const rungs = LADDER_RUNGS[walkthrough.ladder] || [];
  const slip = useMemo(() => firstSlip(keyIds, herOrder), [keyIds, herOrder]);

  // phase: breakdown → labels → steps → end. It starts playing as soon as it opens.
  const [phase, setPhase] = useState('breakdown');
  const [step, setStep] = useState(0);              // staged reveal counter within breakdown / labels
  const [placed, setPlaced] = useState([]);         // ids, in the order placed
  const [thinking, setThinking] = useState(null);   // { lines, pending } while number 1 is thought through
  const [noteId, setNoteId] = useState(null);       // the action whose rule and reason are shown
  const placedRef = useRef([]);                     // `placed`, readable from timers
  const timers = useRef([]);

  const later = (fn, ms) => { timers.current.push(setTimeout(fn, reducedMotion() ? 0 : ms)); };
  const position = placed.length;
  const ladder = ladderState(keyIds.map((id) => info[id]), position);

  /** Place the action that belongs at `pos`, show why, then the next. */
  const autoPlace = (pos) => {
    const id = keyIds[pos];
    placedRef.current = [...placedRef.current, id];
    setPlaced(placedRef.current);
    setNoteId(id);
    if (pos + 1 >= keyIds.length) {
      later(() => { setPhase('end'); clarityEvent('order_walkthrough_completed'); }, PACE.hold);
      return;
    }
    later(() => autoPlace(pos + 1), PACE.hold);
  };

  /** Number 1, thought through out loud line by line, then the climb. */
  const startSteps = () => {
    setPhase('steps');
    const lines = walkthrough.first_thinking || [];
    let at = 0;
    lines.forEach((_, n) => {
      later(() => setThinking({ lines: n, pending: true }), at);
      at += PACE.dots;
      later(() => setThinking({ lines: n + 1, pending: false }), at);
      at += PACE.line;
    });
    later(() => { setThinking(null); autoPlace(0); }, at);
  };

  const startLabels = () => {
    setPhase('labels');
    setStep(0);
    let at = PACE.read / 2;
    items.forEach((_, k) => { later(() => setStep(k + 1), at); at += PACE.label; });
    later(() => setStep(items.length + 1), at);
    later(startSteps, at + PACE.ready + PACE.read);
  };

  const play = () => {
    setPhase('breakdown');
    setStep(0);
    let at = PACE.read;
    for (let k = 1; k <= parts.length; k += 1) { later(() => setStep(k), at); at += PACE.part; }
    later(startLabels, at + PACE.ready);
  };

  const replay = () => {
    timers.current.splice(0).forEach(clearTimeout);
    placedRef.current = [];
    setPlaced([]);
    setThinking(null);
    setNoteId(null);
    play();
  };

  useEffect(() => {
    clarityEvent('order_walkthrough_opened');
    play();
    const pending = timers.current;
    return () => pending.splice(0).forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coach = (() => {
    if (phase === 'breakdown') return step === 0 ? t('orderWalkthrough.reading') : t('orderWalkthrough.breakdown');
    if (phase === 'labels') return step <= items.length ? t('orderWalkthrough.labelling') : t('orderWalkthrough.ladderIntro');
    if (phase === 'end') return t('orderWalkthrough.doneShort');
    if (position === 0) return t('orderWalkthrough.watch');
    if (position === keyIds.length) return t('orderWalkthrough.lastOne');
    return t('orderWalkthrough.autoNext', { n: position });
  })();

  const partsLit = phase === 'breakdown' ? Math.min(step, parts.length) : parts.length;
  const labelsShown = phase === 'breakdown' ? 0 : phase === 'labels' ? Math.min(step, items.length) : items.length;
  const ladderShown = phase === 'steps' || phase === 'end' || (phase === 'labels' && step > items.length);
  const noteInfo = noteId ? info[noteId] : null;

  return (
    <section className="ow" aria-label={t('orderWalkthrough.label')}>
      <div className="ow-top">
        <p className="ow-coach" aria-live="polite">{coach}</p>
        {/* Moving on never waits for the replay to finish: it takes the whole
            card, so without this the only way forward was to close it and find
            Next under the rationale (owner, 2026-10-13). The end screen has
            its own, larger Next. */}
        <div className="ow-top-actions">
          {onNext && phase !== 'end' && (
            <button type="button" className="ow-skip" onClick={onNext}>{nextLabel}</button>
          )}
          <button type="button" className="ow-close" onClick={onClose} aria-label={t('orderWalkthrough.closeLabel')}>×</button>
        </div>
      </div>

      <div className="ow-body">
      <div className="ow-left">
      <div className="ow-case">
        {chart && <p className="ow-chart">{highlight(chart, parts, partsLit)}</p>}
        <p className="ow-question">{highlight(question, parts, partsLit)}</p>
      </div>

      {parts.length > 0 && (
        <dl className="ow-parts">
          {parts.map((p, n) => (
            <div key={n} className={`ow-part${n < partsLit ? ' is-shown' : ''}`}>
              <dt><Badge n={n} />{t(`orderWalkthrough.role.${p.role}`)}</dt>
              <dd>{p.meaning}</dd>
            </div>
          ))}
        </dl>
      )}

      </div>

      <div className="ow-right">
      {ladderShown && (
        <div className="ow-ladder">
          <span className="ow-ladder-title">{t(`orderWalkthrough.ladderTitle.${walkthrough.ladder}`)}</span>
          <ol>
            {rungs.map((r, k) => (
              <li key={r} className={`${ladder.current === k && phase === 'steps' ? 'is-current' : ''}${ladder.climbed.has(k) ? ' is-climbed' : ''}`}>
                {t(`orderWalkthrough.rung.${r}`)}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Placed actions rise to the top in their order, so the answer builds
          from the top down as the ladder is climbed; the rest wait below in
          the order the card showed them. */}
      <ul className="ow-items">
        {[...placed.map((id) => items.find((it) => it.id === id)), ...items.filter((it) => !placed.includes(it.id))].map((it) => {
          const k = items.indexOf(it);
          const slot = placed.indexOf(it.id);
          return (
            <li key={it.id}>
              <div className={`ow-item${slot >= 0 ? ' is-placed' : ''}${slot === position - 1 && phase === 'steps' ? ' is-latest' : ''}`}>
                <span className="ow-slot" aria-hidden={slot < 0}>{slot >= 0 ? slot + 1 : ''}</span>
                <span className="ow-item-text">{it.text}</span>
                {k < labelsShown && <span className="ow-tag">{info[it.id]?.label}</span>}
              </div>
            </li>
          );
        })}
      </ul>

      {/* The thinking: number 1 worked out loud, then the rule and reason for
          each placement. One place, under the list, so her eyes know where
          the explanation lives. */}
      {phase === 'steps' && thinking && (
        <div className="ow-think" aria-live="polite">
          {(walkthrough.first_thinking || []).slice(0, thinking.lines).map((line, n) => <p key={n}>{line}</p>)}
          {thinking.pending && <span className="ow-dots" aria-hidden="true"><i /><i /><i /></span>}
        </div>
      )}
      {phase === 'steps' && noteInfo && (
        <div className="ow-think" aria-live="polite" key={`why-${noteId}`}>
          <span className="ow-rule">{t(`orderWalkthrough.rule.${noteInfo.rule}`)}</span>
          <p>{noteInfo.why_here}</p>
        </div>
      )}

      {phase === 'end' && (
        <div className="ow-end">
          {slip && (
            <p className="ow-then">
              <span className="ow-then-label">{t('orderWalkthrough.thenLabel')}</span>
              {t('orderWalkthrough.then', { hers: textOf[slip.hers], n: slip.position + 1 })}{' '}
              {info[slip.right]?.why_here}
            </p>
          )}
          <p className="ow-method">{walkthrough.method_line || t('orderWalkthrough.method')}</p>
          {/* Next question here, not only on the card underneath: closing
              brought back a long rationale with Next below it, and students
              finished the walkthrough and could not find the way on
              (owner, 2026-10-11). */}
          {onNext ? (
            <>
              <button type="button" className="ow-next is-primary" onClick={onNext}>{nextLabel}</button>
              <button type="button" className="ow-back" onClick={onClose}>{t('orderWalkthrough.close')}</button>
            </>
          ) : (
            <button type="button" className="ow-next" onClick={onClose}>{t('orderWalkthrough.close')}</button>
          )}
          <button type="button" className="mw-replay" onClick={replay}>{t('orderWalkthrough.replay')}</button>
        </div>
      )}
      </div>
      </div>
    </section>
  );
}
