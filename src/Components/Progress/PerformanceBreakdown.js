import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getSessionInsights, BREAKDOWN_MIN_SAMPLE } from '../../Services/StudySessionService';
import './PerformanceBreakdown.css';

/**
 * PerformanceBreakdown — the study session's insights.
 *
 * Structured as a coach speaking, not a report printing:
 *
 *   1. One hero number — where you stand, said warmly.
 *   2. ONE area to review — singular. Not a ranked dump.
 *   3. One question to re-learn, with a way to act on it.
 *   4. Everything else, folded away behind "see full breakdown".
 *
 * The singular focus is the design. An earlier version listed every format,
 * every topic and every missed question at once; it was more informative and
 * far less useful, because a student the night before an exam needs one
 * instruction, not a leaderboard of her weaknesses.
 *
 * What "one area" means is chosen, not fixed: a weak QUESTION FORMAT outranks
 * a weak topic when the evidence supports it, because format weakness travels
 * to every future topic and to the NCLEX, while a topic gap stays put. That
 * choice is the whole intelligence of this panel.
 */

const FORMAT_LABELS = {
  mcq: ['performance.formatMcq', 'Multiple choice'],
  sata: ['performance.formatSata', 'Select all that apply'],
  casestudy: ['performance.formatCase', 'Priority & case study'],
};

/* Why the format is hard and what to do differently — shown only for the
   area actually being called out. */
const FORMAT_COACHING = {
  sata: [
    'performance.coachSata',
    'Every option is graded on its own, and one wrong pick loses the whole question. Go option by option and ask "true or false?" about each — never hunt for the single best answer.',
  ],
  casestudy: [
    'performance.coachCase',
    'These grade order, not recall. Work the nursing process: assess before you act, airway before circulation, safety before comfort.',
  ],
  mcq: [
    'performance.coachMcq',
    'Eliminate the two you know are wrong first, then decide between what is left.',
  ],
};

/* The two formats the NCLEX weights most heavily. A weakness here is exam
   risk, not just a low score, and gets picked as "the one area" ahead of a
   numerically worse topic. */
const HIGH_STAKES = new Set(['sata', 'casestudy']);

/* A face for the topic — warmth only, and only when the match is confident.
   No generic fallback: a stock book icon beside "ABCDE Emergency Patient
   Assessment" reads as filler rather than care, so an unmatched topic simply
   gets no icon and the name carries the row. */
const TOPIC_ICONS = [
  [/\b(respirat|oxygen|lung|pulmon|airway|breath)/i, '🫁'],
  [/\b(cardi|heart|circulat|vascular|blood pressure)/i, '❤️'],
  [/\b(bowel|gastro|digest|intestin|stool|elimination)/i, '🩺'],
  [/\b(neuro|brain|cognit|seizure|stroke)/i, '🧠'],
  [/\b(pharma|medicat|drug|dosage)/i, '💊'],
  [/\b(infect|microb|immun|sepsis|wound)/i, '🦠'],
  [/\b(matern|obstetr|newborn|pediatr|child)/i, '👶'],
  [/\b(mental|psych|anxiety|depress)/i, '🌱'],
  [/\b(nutrit|diet|fluid|electrolyte)/i, '🥗'],
];

const topicIcon = (name = '') => {
  for (const [pattern, icon] of TOPIC_ICONS) if (pattern.test(name)) return icon;
  return null;
};

const tone = (accuracy) => {
  if (accuracy == null) return 'unknown';
  if (accuracy >= 85) return 'strong';
  if (accuracy >= 60) return 'developing';
  return 'weak';
};

/** Compact ranked bar, used only inside the folded-away full breakdown. */
const Row = ({ label, accuracy, missed, seen, ranked, t }) => (
  <li className={`perf-row perf-row--${tone(accuracy)}`}>
    <div className="perf-row-head">
      <span className="perf-row-label" title={label}>{label}</span>
      <span className="perf-row-score">
        {accuracy}%
        <span className="perf-row-fraction">
          {t('performance.missedOf', 'missed {{missed}} of {{seen}}', { missed, seen })}
        </span>
      </span>
    </div>
    <div className="perf-bar" role="presentation">
      <div className="perf-bar-fill" style={{ width: `${Math.max(accuracy, 2)}%` }} />
    </div>
    {!ranked && (
      <span className="perf-row-thin">{t('performance.needsMore', 'Too few to be sure yet')}</span>
    )}
  </li>
);

const PRACTICE_COUNT = 5;

const PerformanceBreakdown = ({ chatId, userId = null, onPractice = null, onReviewConcept = null }) => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!chatId) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    (async () => {
      const result = await getSessionInsights(chatId, userId);
      if (alive) { setData(result); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [chatId, userId]);

  const formats = useMemo(() => data?.formats || [], [data]);
  const missedMix = useMemo(() => data?.missedMix || [], [data]);
  const topics = useMemo(() => data?.topics || [], [data]);
  const missed = useMemo(() => data?.missed || [], [data]);

  const nameFormat = (key) => {
    const entry = FORMAT_LABELS[key];
    return entry ? t(entry[0], entry[1]) : key;
  };

  /* ── Hero: the whole session in one fraction ── */
  const overall = useMemo(() => {
    const total = topics.reduce((s, tp) => s + tp.total, 0);
    const correct = topics.reduce((s, tp) => s + tp.correct, 0);
    if (!total) return null;
    return { correct, total, accuracy: Math.round((correct / total) * 100) };
  }, [topics]);

  /* ── The one area to review ──────────────────────────────────────────
     A high-stakes FORMAT wins when there's real evidence and a real gap,
     because that weakness follows her everywhere. Otherwise the weakest
     topic. Nothing below threshold → no review section at all; inventing a
     weakness to fill the slot would make every future callout worth less. */
  const focus = useMemo(() => {
    const rankedFormats = formats.filter((f) => f.ranked);
    const riskFormat = rankedFormats.find(
      (f) => HIGH_STAKES.has(f.key) && f.accuracy < 70
    );
    if (riskFormat) {
      return {
        kind: 'format',
        key: riskFormat.key,
        icon: null,
        name: nameFormat(riskFormat.key),
        correct: riskFormat.seen - riskFormat.missed,
        total: riskFormat.seen,
        accuracy: riskFormat.accuracy,
        coaching: t(...(FORMAT_COACHING[riskFormat.key] || FORMAT_COACHING.mcq)),
      };
    }
    /* No per-answer counter for this session, so there is no honest accuracy
       per format — but the MIX of mistakes is exact. A high-stakes format
       owning most of the errors is the same finding, stated without a
       denominator it cannot support. */
    const dominant = missedMix[0];
    if (dominant && dominant.share >= 40 && HIGH_STAKES.has(dominant.key)) {
      return {
        kind: 'mix',
        key: dominant.key,
        icon: null,
        name: nameFormat(dominant.key),
        count: dominant.count,
        share: dominant.share,
        totalMistakes: missedMix.reduce((sum, m) => sum + m.count, 0),
        coaching: t(...(FORMAT_COACHING[dominant.key] || FORMAT_COACHING.mcq)),
      };
    }

    const weakTopic = topics.find((tp) => tp.accuracy < 85);
    if (weakTopic) {
      return {
        kind: 'topic',
        key: weakTopic.key,
        icon: topicIcon(weakTopic.label),
        name: weakTopic.label,
        correct: weakTopic.correct,
        total: weakTopic.total,
        accuracy: weakTopic.accuracy,
        coaching: null,
        thin: !weakTopic.ranked,
      };
    }
    const weakFormat = rankedFormats.find((f) => f.accuracy < 80);
    if (weakFormat) {
      return {
        kind: 'format',
        key: weakFormat.key,
        icon: null,
        name: nameFormat(weakFormat.key),
        correct: weakFormat.seen - weakFormat.missed,
        total: weakFormat.seen,
        accuracy: weakFormat.accuracy,
        coaching: t(...(FORMAT_COACHING[weakFormat.key] || FORMAT_COACHING.mcq)),
      };
    }
    return null;
  }, [formats, missedMix, topics, t]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The question to re-learn: one drawn from the focus area, so the card
     below the bar is about the thing the bar just named. */
  const spotlight = useMemo(() => {
    if (!missed.length) return null;
    if (focus?.kind === 'format' || focus?.kind === 'mix') {
      return missed.find((m) => m.format === focus.key) || missed[0];
    }
    if (focus?.kind === 'topic') {
      return missed.find((m) => m.topic === focus.key) || missed[0];
    }
    return missed[0];
  }, [missed, focus]);

  const heroLine = (acc) => {
    if (acc >= 90) return t('performance.heroExcellent', "Excellent — you've got this cold.");
    if (acc >= 80) return t('performance.heroGood', "Nice work — you're building a strong foundation.");
    if (acc >= 65) return t('performance.heroSolid', 'Solid start. A little more practice and this will click.');
    if (acc >= 50) return t('performance.heroFinding', "You're finding the gaps — that's exactly what this is for.");
    return t('performance.heroEarly', "Early days. Let's turn this around one topic at a time.");
  };

  const focusLine = (acc) => {
    if (acc >= 75) return t('performance.focusAlmost', 'Almost there — a little more practice.');
    if (acc >= 50) return t('performance.focusBuilding', 'Still building confidence here.');
    return t('performance.focusAttention', 'This one needs real attention.');
  };

  if (loading) {
    return (
      <div className="perf-panel perf-panel--loading">
        {t('performance.loading', 'Reading your results…')}
      </div>
    );
  }

  if (!data || data.totalAnswered === 0 || !overall) {
    return (
      <div className="perf-panel perf-panel--empty">
        <p className="perf-empty-copy">
          {t('performance.empty', 'Answer some questions and this will show you exactly what to work on.')}
        </p>
      </div>
    );
  }

  return (
    <div className="perf-panel">

      {/* ── 1. Hero ── */}
      <div className={`perf-hero perf-hero--${tone(overall.accuracy)}`}>
        <div className="perf-hero-fraction">
          <span className="perf-hero-correct">{overall.correct}</span>
          <span className="perf-hero-slash">/</span>
          <span className="perf-hero-total">{overall.total}</span>
        </div>
        <div className="perf-hero-label">{t('performance.correct', 'correct')}</div>
        <div className="perf-hero-accuracy">
          {t('performance.accuracy', '{{pct}}% accuracy', { pct: overall.accuracy })}
        </div>
        <p className="perf-hero-line">{heroLine(overall.accuracy)}</p>
      </div>

      {/* ── 2. One area to review ── */}
      {focus && (
        <section className="perf-focus">
          <h4 className="perf-eyebrow">
            {(focus.kind === 'format' || focus.kind === 'mix') && HIGH_STAKES.has(focus.key)
              ? t('performance.focusExamRisk', 'Your biggest exam risk')
              : t('performance.focusOne', 'One area to review')}
          </h4>

          <div className="perf-focus-head">
            {focus.icon && (
              <span className="perf-focus-icon" aria-hidden="true">{focus.icon}</span>
            )}
            <span className="perf-focus-name" title={focus.name}>{focus.name}</span>
          </div>

          {/* Two different bars. For an accuracy focus the fill IS the score.
              For a mistake-mix focus there is no honest accuracy, so the fill
              is the SHARE of mistakes landing here — which is why it's always
              painted as a warning rather than a scale. */}
          {focus.kind === 'mix' ? (
            <>
              <div className="perf-bar perf-bar--lg perf-row--weak">
                <div className="perf-bar-fill" style={{ width: `${Math.max(focus.share, 2)}%` }} />
              </div>
              <div className="perf-focus-meta">
                <span className="perf-focus-count">
                  {t('performance.ofMistakes', '{{count}} of your {{total}} mistakes', {
                    count: focus.count, total: focus.totalMistakes,
                  })}
                </span>
                <span className="perf-focus-pct perf-focus-pct--warn">{focus.share}%</span>
              </div>
              <p className="perf-focus-line">
                {t('performance.focusMix', 'This is where most of your mistakes are landing.')}
              </p>
            </>
          ) : (
            <>
              <div className={`perf-bar perf-bar--lg perf-row--${tone(focus.accuracy)}`}>
                <div className="perf-bar-fill" style={{ width: `${Math.max(focus.accuracy, 2)}%` }} />
              </div>
              <div className="perf-focus-meta">
                <span className="perf-focus-count">
                  {t('performance.ofCorrect', '{{correct}} of {{total}} correct', {
                    correct: focus.correct, total: focus.total,
                  })}
                </span>
                <span className="perf-focus-pct">{focus.accuracy}%</span>
              </div>
              <p className="perf-focus-line">{focusLine(focus.accuracy)}</p>
            </>
          )}
          {focus.coaching && <p className="perf-focus-coaching">{focus.coaching}</p>}
          {focus.thin && (
            <p className="perf-focus-thin">
              {t('performance.thinNote', 'Based on only {{n}} questions so far.', { n: focus.total })}
            </p>
          )}

          {/* ── 3. One question to re-learn ── */}
          {spotlight && (
            <div className="perf-strengthen">
              <h5 className="perf-strengthen-title">
                {t('performance.strengthen', "Let's strengthen this")}
              </h5>
              <p className="perf-strengthen-q">{spotlight.text}</p>
              {onReviewConcept && (
                <button
                  type="button"
                  className="perf-cta perf-cta--ghost"
                  onClick={() => onReviewConcept(spotlight, focus)}
                >
                  {t('performance.reviewConcept', 'Review this concept')}
                  <span aria-hidden="true"> →</span>
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Nothing weak enough to call out — say so rather than manufacture one. */}
      {!focus && (
        <p className="perf-allclear">
          {t('performance.allClear', "No weak spots in this plan yet — everything you've answered is holding up.")}
        </p>
      )}

      {onPractice && (
        <button
          type="button"
          className="perf-cta perf-cta--primary"
          onClick={() => onPractice(focus, PRACTICE_COUNT)}
        >
          {t('performance.practiceMore', 'Practice {{n}} more questions', { n: PRACTICE_COUNT })}
        </button>
      )}

      {/* ── 4. Everything else, folded away ── */}
      {(formats.length > 0 || topics.length > 0 || missed.length > 1) && (
        <div className="perf-more-wrap">
          <button
            type="button"
            className="perf-disclose"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
          >
            {showAll
              ? t('performance.hideAll', 'Hide full breakdown')
              : t('performance.seeAll', 'See full breakdown')}
          </button>

          {showAll && (
            <div className="perf-all">
              {formats.length === 0 && missedMix.length > 0 && (
                <section className="perf-section">
                  <h4 className="perf-section-title">
                    {t('performance.mistakeMix', 'Where your mistakes come from')}
                  </h4>
                  <ul className="perf-list">
                    {missedMix.map((m) => (
                      <li key={m.key} className="perf-row perf-row--weak">
                        <div className="perf-row-head">
                          <span className="perf-row-label">{nameFormat(m.key)}</span>
                          <span className="perf-row-score">
                            {m.count}
                            <span className="perf-row-fraction">
                              {t('performance.mistakes', 'mistakes')}
                            </span>
                          </span>
                        </div>
                        <div className="perf-bar"><div className="perf-bar-fill" style={{ width: `${Math.max(m.share, 2)}%` }} /></div>
                      </li>
                    ))}
                  </ul>
                  <p className="perf-foot">
                    {t('performance.mixNote', 'Accuracy per question type starts tracking from your next answer.')}
                  </p>
                </section>
              )}

              {formats.length > 0 && (
                <section className="perf-section">
                  <h4 className="perf-section-title">{t('performance.byFormat', 'By question type')}</h4>
                  <ul className="perf-list">
                    {formats.map((f) => (
                      <Row key={f.key} label={nameFormat(f.key)} {...f} t={t} />
                    ))}
                  </ul>
                  {data.derived && (
                    <p className="perf-foot">
                      {t('performance.derivedNote', 'Counted from the questions in this plan.')}
                    </p>
                  )}
                </section>
              )}

              {topics.length > 0 && (
                <section className="perf-section">
                  <h4 className="perf-section-title">{t('performance.byTopic', 'By topic')}</h4>
                  <ul className="perf-list">
                    {topics.map((tp) => (
                      <Row
                        key={tp.key}
                        label={tp.label}
                        accuracy={tp.accuracy}
                        missed={tp.total - tp.correct}
                        seen={tp.total}
                        ranked={tp.ranked}
                        t={t}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {missed.length > 0 && (
                <section className="perf-section perf-section--full">
                  <h4 className="perf-section-title">
                    {t('performance.workOn', 'Everything you missed')}
                    <span className="perf-section-count">{missed.length}</span>
                  </h4>
                  <ul className="perf-missed-list">
                    {missed.map((m, i) => (
                      <li key={`${m.text.slice(0, 40)}-${i}`} className="perf-missed">
                        {m.format && (
                          <span className={`perf-missed-tag perf-missed-tag--${m.format}`}>
                            {nameFormat(m.format)}
                          </span>
                        )}
                        <p className="perf-missed-text">{m.text}</p>
                        <span className="perf-missed-topic">{m.topic}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {formats.length > 0 && formats.every((f) => !f.ranked) && (
                <p className="perf-foot">
                  {t('performance.thinAll', 'Answer at least {{n}} of a question type before we call it a pattern.', { n: BREAKDOWN_MIN_SAMPLE })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PerformanceBreakdown;
