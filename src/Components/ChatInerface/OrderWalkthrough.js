import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LADDER_RUNGS, STAGE, stageAt, firstSlip, isRightPick, ladderState,
} from './orderWalkthroughModel';
import { clarityEvent } from '../../Services/ClarityService';
import './OrderWalkthrough.css';

/**
 * OrderWalkthrough — "Who first?" on a missed ordering question.
 *
 * Teaches the ladder by climbing it on the question she just missed: the
 * chart's deciding details light up and are explained, each action is
 * labelled with what it does for this patient, then the tutor places number 1
 * thinking out loud (watch), number 2 is hers with a nudge if she reaches too
 * early (together), and the rest are hers (your turn). The order and the
 * marking come from orderWalkthroughModel.js and the stored key; the words
 * from NQBackEnd2/services/order_walkthrough.py.
 *
 * Tone (owner, 2026-10-10: "safe, premium, empathetic, easy to assimilate yet
 * clear"): one thing happens at a time, nothing is red, a wrong tap is "not
 * yet" plus a question that points back, and the end names exactly what she
 * did earlier and why, once.
 *
 * Renders inside the case-study card and uses its --q-* tokens, so dark mode
 * is inherited. prefers-reduced-motion removes the pacing, never a step.
 */

const PACE = {
  read: 1000,        // a beat before the first detail lights up
  part: 1800,        // each detail of the chart, highlighted and explained
  label: 650,        // each action's label, in turn
  ready: 900,        // before the next button appears
  dots: 900,         // "thinking" before each line of the demonstration
  line: 1700,        // reading one line of the demonstration
  settle: 700,       // a placed action settling into its number
  last: 1300,        // before the final action places itself
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
 */
export default function OrderWalkthrough({ question, chart, items, keyIds, herOrder, walkthrough, onClose }) {
  const { t } = useTranslation();
  // The backend's items are in KEY order; index them by item id.
  const info = useMemo(() => Object.fromEntries(keyIds.map((id, k) => [id, walkthrough.items[k]])), [keyIds, walkthrough]);
  const textOf = useMemo(() => Object.fromEntries(items.map((it) => [it.id, it.text])), [items]);
  const parts = walkthrough.breakdown || [];
  const rungs = LADDER_RUNGS[walkthrough.ladder] || [];
  const slip = useMemo(() => firstSlip(keyIds, herOrder), [keyIds, herOrder]);

  // phase: intro → breakdown → labels → steps → end
  const [phase, setPhase] = useState('intro');
  const [step, setStep] = useState(0);              // staged reveal counter within breakdown / labels
  const [placed, setPlaced] = useState([]);         // ids, in the order placed
  const [thinking, setThinking] = useState(null);   // { lines, pending } while the demonstration plays
  const [note, setNote] = useState(null);           // { kind: 'why' | 'nudge', id }
  const [shake, setShake] = useState(null);
  const [busy, setBusy] = useState(false);
  const placedRef = useRef([]);                     // `placed`, readable from timers
  const firstTry = useRef({});
  const timers = useRef([]);

  useEffect(() => {
    clarityEvent('order_walkthrough_opened');
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, reducedMotion() ? 0 : ms)); };

  const position = placed.length;
  const stage = phase === 'steps' ? stageAt(Math.min(position, keyIds.length - 1)) : null;
  const ladder = ladderState(keyIds.map((id) => info[id]), position);

  const startBreakdown = () => {
    setPhase('breakdown');
    setStep(0);
    let at = PACE.read;
    for (let k = 1; k <= parts.length; k += 1) { later(() => setStep(k), at); at += PACE.part; }
    later(() => setStep(parts.length + 1), at - PACE.part + PACE.ready);
  };

  const startLabels = () => {
    setPhase('labels');
    setStep(0);
    let at = PACE.read / 2;
    items.forEach((_, k) => { later(() => setStep(k + 1), at); at += PACE.label; });
    later(() => setStep(items.length + 1), at + PACE.ready - PACE.label);
  };

  /** Place `id` in the next slot, then, if one action is left, let it place
   *  itself: choosing from one is not a choice. */
  const place = (id, after) => {
    const next = [...placedRef.current, id];
    placedRef.current = next;
    setPlaced(next);
    if (next.length === keyIds.length - 1) {
      const lastId = keyIds[keyIds.length - 1];
      setBusy(true);
      later(() => {
        placedRef.current = [...next, lastId];
        setPlaced(placedRef.current);
        setNote({ kind: 'why', id: lastId });
        later(() => { setBusy(false); setPhase('end'); clarityEvent('order_walkthrough_completed'); }, PACE.line);
      }, PACE.last);
      return;
    }
    after?.();
  };

  /** The demonstration: number 1, thought through out loud, line by line. */
  const startSteps = () => {
    setPhase('steps');
    setBusy(true);
    const lines = walkthrough.first_thinking || [];
    let at = 0;
    lines.forEach((_, n) => {
      later(() => setThinking({ lines: n, pending: true }), at);
      at += PACE.dots;
      later(() => setThinking({ lines: n + 1, pending: false }), at);
      at += PACE.line;
    });
    later(() => {
      place(keyIds[0]);
      setNote({ kind: 'why', id: keyIds[0] });
      later(() => setBusy(false), PACE.settle);
    }, at);
  };

  const pick = (id) => {
    if (phase !== 'steps' || busy || placed.includes(id) || position === 0) return;
    if (isRightPick(keyIds, position, id)) {
      if (firstTry.current[position] === undefined) firstTry.current[position] = true;
      setThinking(null);
      setNote({ kind: 'why', id });
      setBusy(true);
      place(id, () => later(() => setBusy(false), PACE.settle));
    } else {
      firstTry.current[position] = false;
      setShake(id);
      later(() => setShake(null), 450);
      setNote({ kind: 'nudge', id });
    }
  };

  // Her own placements: number 2 up to the second-to-last.
  const herSlots = Array.from({ length: Math.max(0, keyIds.length - 2) }, (_, k) => k + 1);
  const rightFirst = herSlots.filter((k) => firstTry.current[k]).length;

  const coach = (() => {
    if (phase === 'intro') return t('orderWalkthrough.intro');
    if (phase === 'breakdown') return step === 0 ? t('orderWalkthrough.reading') : t('orderWalkthrough.breakdown');
    if (phase === 'labels') return step <= items.length ? t('orderWalkthrough.labelling') : t('orderWalkthrough.ladderIntro');
    if (phase === 'end') {
      if (!herSlots.length) return t('orderWalkthrough.doneShort');
      return rightFirst === herSlots.length
        ? t('orderWalkthrough.doneAll')
        : t('orderWalkthrough.done', { right: rightFirst, total: herSlots.length });
    }
    if (position === 0) return t('orderWalkthrough.watch');
    if (note?.kind === 'nudge') return t('orderWalkthrough.notYet');
    if (position === keyIds.length - 1) return t('orderWalkthrough.lastOne');
    if (position === 1) return t('orderWalkthrough.together');
    return position === 2 ? t('orderWalkthrough.yours') : t('orderWalkthrough.keepGoing', { n: position + 1 });
  })();

  const partsLit = phase === 'intro' ? 0 : phase === 'breakdown' ? Math.min(step, parts.length) : parts.length;
  const labelsShown = phase === 'intro' || phase === 'breakdown' ? 0 : phase === 'labels' ? Math.min(step, items.length) : items.length;
  const ladderShown = phase === 'steps' || phase === 'end' || (phase === 'labels' && step > items.length);
  const picking = phase === 'steps' && position > 0 && position < keyIds.length - 1 && !busy;
  const noteInfo = note ? info[note.id] : null;

  return (
    <section className="ow" aria-label={t('orderWalkthrough.label')}>
      <div className="ow-top">
        <ol className="ow-stages" aria-hidden="true">
          {[STAGE.WATCH, STAGE.TOGETHER, STAGE.YOURS].map((s) => (
            <li key={s} className={(phase === 'end' ? s === STAGE.YOURS : s === stage) ? 'on' : ''}>{t(`orderWalkthrough.stage.${s}`)}</li>
          ))}
        </ol>
        <button type="button" className="ow-close" onClick={onClose} aria-label={t('orderWalkthrough.closeLabel')}>×</button>
      </div>

      <p className="ow-coach" aria-live="polite">{coach}</p>

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
          from the top down as she climbs; the rest wait below in the order
          the card showed them. */}
      <ul className="ow-items">
        {[...placed.map((id) => items.find((it) => it.id === id)), ...items.filter((it) => !placed.includes(it.id))].map((it) => {
          const k = items.indexOf(it);
          const slot = placed.indexOf(it.id);
          const canPick = picking && slot < 0;
          const Row = canPick ? 'button' : 'div';
          return (
            <li key={it.id}>
              <Row
                type={canPick ? 'button' : undefined}
                className={`ow-item${slot >= 0 ? ' is-placed' : ''}${canPick ? ' is-pickable' : ''}${shake === it.id ? ' is-shaking' : ''}${slot === position - 1 && phase === 'steps' ? ' is-latest' : ''}`}
                onClick={canPick ? () => pick(it.id) : undefined}
              >
                <span className="ow-slot" aria-hidden={slot < 0}>{slot >= 0 ? slot + 1 : ''}</span>
                <span className="ow-item-text">{it.text}</span>
                {k < labelsShown && <span className="ow-tag">{info[it.id]?.label}</span>}
              </Row>
            </li>
          );
        })}
      </ul>

      {/* The thinking: the demonstration as it happens, then the reason for
          each placement, or a nudge when she reaches too early. One place,
          under the list, so her eyes know where the explanation lives. */}
      {phase === 'steps' && position === 0 && thinking && (
        <div className="ow-think" aria-live="polite">
          {(walkthrough.first_thinking || []).slice(0, thinking.lines).map((line, n) => <p key={n}>{line}</p>)}
          {thinking.pending && <span className="ow-dots" aria-hidden="true"><i /><i /><i /></span>}
        </div>
      )}
      {(phase === 'steps' || phase === 'end') && noteInfo && !(position === 0) && (
        <div className={`ow-think${note.kind === 'nudge' ? ' is-nudge' : ''}`} aria-live="polite" key={`${note.kind}-${note.id}-${position}`}>
          {note.kind === 'why' && (
            <>
              <span className="ow-rule">{t(`orderWalkthrough.rule.${noteInfo.rule}`)}</span>
              <p>{noteInfo.why_here}</p>
            </>
          )}
          {note.kind === 'nudge' && <p>{noteInfo.nudge || t('orderWalkthrough.nudgeFallback')}</p>}
        </div>
      )}

      {phase === 'intro' && (
        <button type="button" className="ow-next" onClick={startBreakdown}>{t('orderWalkthrough.startBreakdown')}</button>
      )}
      {phase === 'breakdown' && step > parts.length && (
        <button type="button" className="ow-next" onClick={startLabels}>{t('orderWalkthrough.startLabels')}</button>
      )}
      {phase === 'labels' && step > items.length && (
        <button type="button" className="ow-next" onClick={startSteps}>{t('orderWalkthrough.startWatch')}</button>
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
          <button type="button" className="ow-next" onClick={onClose}>{t('orderWalkthrough.close')}</button>
        </div>
      )}
      </div>
      </div>
    </section>
  );
}
