import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { planWalkthrough } from './walkthroughModel';
import { clarityEvent } from '../../Services/ClarityService';
import './MethodWalkthrough.css';

/**
 * MethodWalkthrough — the replay behind "Watch how to solve it" on a missed
 * select-all question.
 *
 * Plays like a short video: the question is broken down, becomes a single test
 * question, and every option is run through that test top to bottom, each
 * reasoning chain building link by link before its yes/no lands. Nothing to
 * tap. It used to make her answer each option herself (watch, together, your
 * turn), and students clicked straight through it (owner, 2026-10-25); the
 * method now also sits as one line on the card itself (walkthroughModel
 * `ruleLine`), so this is the optional longer look. Order comes from
 * walkthroughModel.js; the words from NQBackEnd2/services/quiz_walkthrough.py,
 * already checked there against the answer key.
 *
 * Renders inside the select-all card, so it uses that card's --q-* colour
 * tokens and inherits its dark mode. Motion is skipped under
 * prefers-reduced-motion: it lands straight on the finished replay.
 */

/* Pacing. The first option is slow on purpose: it is a worked example, and a
   worked example only teaches if she can watch the thinking happen (owner,
   2026-10-10: "there should be time to really see"). The rest keep the same
   rhythm a little faster, since the method is the same each time. */
const PACE = {
  demo: { think: 1100, focus: 1300, dots: 800, read: 1500, verdict: 700 },
  replay: { think: 0, focus: 0, dots: 450, read: 1100, verdict: 500 },
};
// The pause on a settled option before the next one starts.
const HOLD = { demo: 1600, replay: 900 };
// Breaking the question down: a beat of reading, then each part highlighted
// and explained in turn, then the test question, then the options.
const FACT_PACE = { read: 1000, part: 1800, ask: 1600, ready: 1000 };
const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* One badge for a part of the question, used everywhere it is referred to:
   in the highlighted question and in the breakdown rows. Unicode circled numerals rendered thin and tiny (owner,
   2026-10-10), and reasoning steps no longer carry numbers of their own, so
   there is only one numbering system on screen. */
const PartBadge = ({ n, title }) => (
  <span className="mw-badge" title={title} aria-label={title}>{n + 1}</span>
);
const LETTERS = 'ABCDEFGH';

/** The parts of the question the walkthrough breaks down: the v4 `breakdown`,
 *  or the single key fact of an older response. */
const partsOf = (walkthrough) => (Array.isArray(walkthrough.breakdown) && walkthrough.breakdown.length
  ? walkthrough.breakdown
  : walkthrough.key_fact ? [{ role: 'problem', quote: walkthrough.key_fact, meaning: walkthrough.fact_meaning }] : []);

/** The stem with each part's quote wrapped and numbered, lit once its turn
 *  has come. Quotes are literal substrings (checked server-side); overlaps
 *  are skipped rather than nested. */
const highlightStem = (question, parts, litCount) => {
  const lower = question.toLowerCase();
  const spans = parts
    .map((p, n) => ({ n, at: lower.indexOf(String(p.quote || '').toLowerCase()), len: String(p.quote || '').length }))
    .filter((x) => x.at >= 0 && x.len > 0)
    .sort((a, b) => a.at - b.at)
    .filter((x, i, all) => i === 0 || x.at >= all[i - 1].at + all[i - 1].len);
  const out = [];
  let cursor = 0;
  spans.forEach((x) => {
    out.push(question.slice(cursor, x.at));
    out.push(
      <mark key={x.n} className={`mw-fact${x.n < litCount ? ' is-lit' : ''}`}>
        <span className="mw-fact-n" aria-hidden="true"><PartBadge n={x.n} /></span>
        {question.slice(x.at, x.at + x.len)}
      </mark>
    );
    cursor = x.at + x.len;
  });
  out.push(question.slice(cursor));
  return out;
};

export default function MethodWalkthrough({ question, options, correctIndices, selectedIndices, walkthrough, onClose }) {
  const { t } = useTranslation();
  const plan = useMemo(
    () => planWalkthrough(options.length, correctIndices, selectedIndices),
    [options.length, correctIndices, selectedIndices]
  );
  // phase: fact → steps → end. It starts playing as soon as it opens.
  const [phase, setPhase] = useState('fact');
  const [position, setPosition] = useState(0);
  const [settled, setSettled] = useState({});      // option index → true once its chain has played
  const [playing, setPlaying] = useState(null);     // { index, links } while a chain builds
  const [factStep, setFactStep] = useState(0);      // 0 reading, 1..n parts shown, n+1 test question
  const [demoNote, setDemoNote] = useState(null);   // thinking | apply | verdict, on the first option
  const timers = useRef([]);

  const later = (fn, ms) => { timers.current.push(setTimeout(fn, reducedMotion() ? 0 : ms)); };
  const parts = useMemo(() => partsOf(walkthrough), [walkthrough]);
  const current = plan.order[position];
  const info = (i) => walkthrough.options[i] || { chain: [] };

  /** Build option i's reasoning step by step, each step preceded by
   *  "thinking" dots, then land its verdict. `pace` is 'demo' or 'replay'. */
  const playChain = (i, then, pace) => {
    const p = PACE[pace];
    const links = info(i).chain.length;
    let at = 0;
    setPlaying({ index: i, links: 0, pending: false });
    setDemoNote(null);
    if (pace === 'demo') {
      setDemoNote('thinking');
      at += p.think;
      later(() => setDemoNote('apply'), at);
      at += p.focus;
    }
    for (let n = 1; n <= links; n += 1) {
      later(() => setPlaying({ index: i, links: n - 1, pending: true }), at);
      at += p.dots;
      later(() => setPlaying({ index: i, links: n, pending: false }), at);
      at += p.read;
    }
    at += p.verdict - p.read;
    later(() => {
      setSettled((s) => ({ ...s, [i]: true }));
      setPlaying(null);
      if (pace === 'demo') setDemoNote('verdict');
      then?.();
    }, Math.max(at, 0));
  };

  /** Every option, top to bottom, the first one slowest. */
  const playFrom = (pos) => {
    setPosition(pos);
    const pace = pos === 0 ? 'demo' : 'replay';
    playChain(plan.order[pos], () => later(() => {
      if (pos + 1 >= plan.order.length) {
        setPhase('end');
        clarityEvent('walkthrough_completed');
      } else {
        playFrom(pos + 1);
      }
    }, HOLD[pace]), pace);
  };

  /** Break the question down, staged: read, then each part in turn (its
   *  highlight and its meaning together), then the test question, then
   *  every option. */
  const play = () => {
    setPhase('fact');
    setFactStep(0);
    let at = FACT_PACE.read;
    for (let k = 1; k <= parts.length; k += 1) {
      later(() => setFactStep(k), at);
      at += FACT_PACE.part;
    }
    later(() => setFactStep(parts.length + 1), at);
    at += FACT_PACE.ask + FACT_PACE.ready;
    later(() => {
      setPhase('steps');
      if (plan.order.length) playFrom(0);
      else setPhase('end');
    }, at);
  };

  const replay = () => {
    timers.current.splice(0).forEach(clearTimeout);
    setSettled({});
    setPlaying(null);
    setDemoNote(null);
    setPosition(0);
    play();
  };

  useEffect(() => {
    clarityEvent('walkthrough_opened');
    play();
    const pending = timers.current;
    return () => pending.splice(0).forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const letter = LETTERS[current] || '';
  const coach = (() => {
    if (phase === 'fact') {
      if (factStep === 0) return t('walkthrough.factFind');
      if (factStep <= parts.length) return t('walkthrough.breakingDown');
      return t('walkthrough.fact');
    }
    if (phase === 'end') return t('walkthrough.replayDone');
    if (position === 0) {
      if (demoNote === 'thinking') return t('walkthrough.thinking');
      if (demoNote === 'apply') return t('walkthrough.apply');
      if (demoNote === 'verdict') {
        return t('walkthrough.demoVerdict', { verdict: correctIndices.includes(current) ? t('walkthrough.yes') : t('walkthrough.no') });
      }
    }
    return plan.missed.includes(current)
      ? t('walkthrough.replayMissed', { letter })
      : t('walkthrough.replayOption', { letter });
  })();

  // How many breakdown parts are on screen, and whether the test question is.
  const partsShown = phase === 'fact' ? Math.min(factStep, parts.length) : parts.length;
  const lensShown = phase !== 'fact' || factStep > parts.length;

  return (
    <section className="mw" aria-label={t('walkthrough.label')}>
      <div className="mw-top">
        <p className="mw-coach" aria-live="polite">{coach}</p>
        <button type="button" className="mw-close" onClick={onClose} aria-label={t('walkthrough.closeLabel')}>×</button>
      </div>

      <p className="mw-stem">{highlightStem(question, parts, partsShown)}</p>

      {/* The reasoning drawn from the highlighted detail, as labelled steps
          under the question, revealed one at a time: what it means, then the
          question to ask of every option. The question stays in full above
          so she reads the detail in context; it was the reasoning taken from
          it that was hard to follow (owner, 2026-10-10). */}
      <dl className="mw-premise">
        {parts.map((p, n) => (
          <div key={n} className={`mw-premise-row${n < partsShown ? ' is-shown' : ''}`}>
            <dt><PartBadge n={n} />{t(`walkthrough.role.${p.role}`)}</dt>
            <dd>{p.meaning}</dd>
          </div>
        ))}
        <div className={`mw-premise-row is-ask${lensShown ? ' is-shown' : ''}`}>
          <dt><span className="mw-premise-hook" aria-hidden="true">↳</span>{t('walkthrough.premise.ask')}</dt>
          <dd><strong>{walkthrough.test_question}</strong></dd>
        </div>
      </dl>

      <ul className="mw-options">
        {options.map((text, i) => {
          const done = settled[i];
          const building = playing?.index === i;
          // During "let me think" the option is not singled out yet.
          const active = phase === 'steps' && i === current && !(position === 0 && demoNote === 'thinking');
          const chain = info(i).chain;
          const shown = done ? chain.length : building ? playing.links : 0;
          return (
            <li key={i} className={`mw-opt${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}>
              <div className="mw-opt-row">
                <span className="mw-opt-letter" aria-hidden="true">{LETTERS[i]}</span>
                <span>{text}</span>
                <span className={`mw-verdict ${correctIndices.includes(i) ? 'is-yes' : 'is-no'}${done ? ' is-in' : ''}`}>
                  {correctIndices.includes(i) ? t('walkthrough.yes') : t('walkthrough.no')}
                </span>
              </div>
              {(building || done) && (
                <div className="mw-chain">
                  {chain.slice(0, Math.max(shown, 0)).map((link, n) => (
                    <React.Fragment key={n}>
                      {n > 0 && <span className="mw-arrow" aria-hidden="true">→</span>}
                      <span className="mw-link">{link}</span>
                    </React.Fragment>
                  ))}
                  {building && playing.pending && (
                    <>
                      {shown > 0 && <span className="mw-arrow" aria-hidden="true">→</span>}
                      <span className="mw-thinking" aria-hidden="true"><i /><i /><i /></span>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {phase === 'end' && (
        <>
          <p className="mw-method">{walkthrough.method_line || t('walkthrough.method')}</p>
          <div className="mw-end-actions">
            <button type="button" className="mw-next" onClick={onClose}>{t('walkthrough.close')}</button>
            <button type="button" className="mw-replay" onClick={replay}>{t('walkthrough.replay')}</button>
          </div>
        </>
      )}
    </section>
  );
}
