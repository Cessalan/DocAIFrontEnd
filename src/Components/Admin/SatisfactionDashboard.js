import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchSignals } from '../../Services/SatisfactionQueries';
import { buildRollup, DID_WELL_PERCENT } from './satisfactionRollup';
import './SatisfactionDashboard.css';

/**
 * SatisfactionDashboard — the thing that finally reads `satisfactionSignals`.
 *
 * WHY THIS EXISTS
 *
 * The collection was write-only from the day it shipped. Its predecessor's only
 * reader, `FeedbackViewer`, was never mounted anywhere, so no feedback this app
 * has ever collected has been looked at inside the app. Ratings you can't see
 * aren't feedback; they're storage.
 *
 * WHAT IT ANSWERS, IN ORDER
 *
 *   1. Are the negatives about the content, or about the score? — the headline.
 *      Everything else is context for this one.
 *   2. Which surface is worst?
 *   3. What's the most common complaint?
 *   4. What did people actually write?
 *
 * The order is deliberate. A flat list of comments (the old viewer's only
 * offering) reads as a stream of individual grievances and produces no
 * decision; the rates at the top are what say whether the thing is working.
 *
 * DESIGN NOTES
 *
 *  - Dev-only route, and it reads the whole window client-side. See
 *    SatisfactionQueries for why that's acceptable here and nowhere else.
 *
 *  - An empty result renders as "no signals yet", never as zeroes. A zero
 *    defect rate and no data at all are opposite situations and must not look
 *    alike — that confusion is exactly how the old path stayed broken.
 *
 *  - Errors are shown, not swallowed. On a read screen a silent empty state is
 *    the worst outcome: it reads as "nobody complained".
 */

const WINDOWS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All time' }
];

const SURFACE_LABELS = {
  chat_answer: 'Chat answers',
  quiz: 'Quizzes',
  flashcard: 'Flashcards',
  study_block: 'Lessons & blocks',
  app: 'App',
  exam_debrief: 'Exam debriefs',
  unknown: 'Unknown'
};

/* What students said would have helped, from the post-exam debrief. Kept apart
   from REASON_LABELS because these are not complaints about a piece of
   content — they are a work queue, written by people who have just sat the
   exam we are preparing them for. */
const GAP_LABELS = {
  more_realistic_questions: 'More realistic exam questions',
  harder_questions: 'Harder questions',
  more_case_scenarios: 'More case scenarios',
  better_explanations: 'Better explanations',
  more_topic_practice: 'More practice on specific topics',
  better_guidance: 'Better study guidance',
  other: 'Something else'
};

const DIFFICULTY_LABELS = {
  harder_than_expected: 'Harder than expected',
  as_expected: 'About what they expected',
  easier_than_expected: 'Easier than expected'
};

const PREPAREDNESS_LABELS = {
  4: '😌 Well prepared',
  3: '🙂 Mostly prepared',
  2: '😬 Somewhat unprepared',
  1: '😓 Not prepared enough'
};

const REASON_LABELS = {
  wrong_answer: 'Wrong answer marked correct',
  not_in_my_material: 'Not from my material',
  bad_explanation: "Explanation didn't help",
  confusing_wording: 'Confusing wording',
  too_hard: 'Too hard',
  too_easy: 'Too easy',
  not_exam_style: 'Not NCLEX-style',
  too_wordy: 'Too much text on the card',
  repetitive: 'Repetitive cards',
  nothing_new: "Didn't teach anything new",
  too_shallow: 'Too shallow',
  too_long: 'Too long',
  incorrect: 'Incorrect or incomplete',
  not_what_i_asked: 'Not what I asked for',
  confusing: 'Confusing explanation',
  slow_or_buggy: 'Slow or buggy',
  other: 'Other'
};

const labelFor = (map, key) => map[key] || key;

/* Comment chips are rendered from one map regardless of surface, so the gap
   slugs have to be reachable from there too — otherwise an exam debrief's
   chips render as raw slugs under its comment. */
const ALL_REASON_LABELS = { ...GAP_LABELS, ...REASON_LABELS };

const pct = (n) => (n === null || n === undefined ? '—' : `${n}%`);

const formatDate = (d) =>
  d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

const SatisfactionDashboard = () => {
  const [rows, setRows] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (windowDays) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchSignals({ days: windowDays }));
    } catch (err) {
      console.error('Failed to load satisfaction signals:', err);
      setError(err?.message || 'Failed to load');
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  const rollup = useMemo(() => (rows ? buildRollup(rows) : null), [rows]);

  const maxDayTotal = useMemo(
    () => (rollup ? Math.max(1, ...rollup.byDay.map((d) => d.total)) : 1),
    [rollup]
  );

  return (
    <div className="sat-dash">
      <header className="sat-dash__header">
        <div>
          <h1 className="sat-dash__title">Satisfaction</h1>
          <p className="sat-dash__sub">
            <code>satisfactionSignals</code> · dev only ·{' '}
            {/* The counts below are compressions of conversations. This is the
                way back to the words they came from — including the debriefs
                that produced no comment, which nothing on this page can show. */}
            <Link to="/admin/conversations" className="sat-dash__link">
              read the conversations
            </Link>
          </p>
        </div>
        <div className="sat-dash__windows">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              type="button"
              className={`sat-dash__window ${days === w.days ? 'is-active' : ''}`}
              onClick={() => setDays(w.days)}
            >
              {w.label}
            </button>
          ))}
          <button type="button" className="sat-dash__refresh" onClick={() => load(days)}>
            Refresh
          </button>
        </div>
      </header>

      {loading && <p className="sat-dash__state">Loading…</p>}

      {error && (
        <p className="sat-dash__state sat-dash__state--error">
          Couldn’t load signals: {error}
        </p>
      )}

      {!loading && !error && rollup && rollup.overall.total === 0 && (
        <p className="sat-dash__state">
          No signals in this window yet. That’s an absence of data, not a score of zero.
        </p>
      )}

      {!loading && !error && rollup && rollup.overall.total > 0 && (
        <>
          {/* ── 1. The headline: content defect vs frustration ── */}
          <section className="sat-dash__section">
            <h2 className="sat-dash__h2">Is it the content, or the score?</h2>
            <p className="sat-dash__note">
              A thumbs-down from someone who scored well is a report about the content.
              The same tap from someone who scored badly is usually frustration at the
              result. Scored surfaces only.
            </p>
            <div className="sat-dash__cards">
              <div className="sat-card sat-card--primary">
                <span className="sat-card__label">
                  Unhappy after scoring ≥{DID_WELL_PERCENT}%
                </span>
                <span className="sat-card__value">{pct(rollup.defect.wellRate)}</span>
                <span className="sat-card__meta">
                  {rollup.defect.wellNegative} of {rollup.defect.wellTotal} · likely real defects
                </span>
              </div>
              <div className="sat-card">
                <span className="sat-card__label">
                  Unhappy after scoring &lt;{DID_WELL_PERCENT}%
                </span>
                <span className="sat-card__value">{pct(rollup.defect.badlyRate)}</span>
                <span className="sat-card__meta">
                  {rollup.defect.badlyNegative} of {rollup.defect.badlyTotal} · likely frustration
                </span>
              </div>
              <div className="sat-card">
                <span className="sat-card__label">Net sentiment</span>
                <span className="sat-card__value">{pct(rollup.overall.net)}</span>
                <span className="sat-card__meta">
                  {rollup.overall.positive} 👍 · {rollup.overall.negative} 👎 ·{' '}
                  {rollup.overall.total} rows
                </span>
              </div>
            </div>
            {rollup.malformed > 0 && (
              <p className="sat-dash__warn">
                {rollup.malformed} row{rollup.malformed === 1 ? '' : 's'} arrived with no
                sentiment — check the writer.
              </p>
            )}
          </section>

          {/* ── 1b. How the exams themselves went ── */}
          {rollup.examDebrief.total > 0 && (
            <section className="sat-dash__section">
              <h2 className="sat-dash__h2">
                After the exam{' '}
                <span className="sat-dash__count">{rollup.examDebrief.total}</span>
              </h2>
              <p className="sat-dash__note">
                A short conversation, once, after an exam. This is the only place the
                product hears what happened in the room it is preparing people for —
                everything else on this page rates our own content. The tutor follows
                whatever the student raises, so the counts below are extracted from what
                she actually said rather than from options she picked.
              </p>

              <div className="sat-dash__cards">
                <div className="sat-card sat-card--primary">
                  <span className="sat-card__label">Walked in prepared</span>
                  <span className="sat-card__value">{pct(rollup.examDebrief.preparedRate)}</span>
                  <span className="sat-card__meta">
                    {rollup.examDebrief.preparedCount} of {rollup.examDebrief.answered}{' '}
                    · well or mostly
                  </span>
                </div>
                {rollup.examDebrief.distribution.map((d) => (
                  <div key={d.value} className="sat-card">
                    <span className="sat-card__label">
                      {labelFor(PREPAREDNESS_LABELS, d.value)}
                    </span>
                    <span className="sat-card__value">{d.count}</span>
                    <span className="sat-card__meta">{pct(d.share)} of answers</span>
                  </div>
                ))}
              </div>

              {rollup.examDebrief.examples.length > 0 && (
                <>
                  <h3 className="sat-dash__h3">Actual questions from their exams</h3>
                  <p className="sat-dash__note">
                    Recalled by students who just sat the paper — the closest thing we get to
                    seeing it. Each one carries a topic, a format and a difficulty at once, so
                    these are what the generator should be pointed at first.
                  </p>
                  <ul className="sat-comments">
                    {rollup.examDebrief.examples.map((example) => (
                      <li key={example.id} className="sat-comment">
                        <div className="sat-comment__head">
                          {example.examLabel && (
                            <span className="sat-comment__topic">{example.examLabel}</span>
                          )}
                          <span className="sat-comment__date">{formatDate(example.at)}</span>
                        </div>
                        <p className="sat-comment__text">{example.text}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {rollup.examDebrief.topicsMissed.length > 0 && (
                <>
                  <h3 className="sat-dash__h3">Topics the exam tested that they weren't ready for</h3>
                  <p className="sat-dash__note">
                    In their own words, not normalised — "SATA" and "select all that apply"
                    stay separate rows, because merging them would be a guess shown as a
                    count. This is the build list.
                  </p>
                  <ul className="sat-tags">
                    {rollup.examDebrief.topicsMissed.map((topic) => (
                      <li key={topic.label} className="sat-tag">
                        {topic.label}
                        {topic.count > 1 && <span className="sat-tag__count">{topic.count}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {rollup.examDebrief.questionFormats.length > 0 && (
                <>
                  <h3 className="sat-dash__h3">Question formats that caught them out</h3>
                  <ul className="sat-tags">
                    {rollup.examDebrief.questionFormats.map((format) => (
                      <li key={format.label} className="sat-tag">
                        {format.label}
                        {format.count > 1 && <span className="sat-tag__count">{format.count}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <h3 className="sat-dash__h3">The exam vs what they expected</h3>
              <p className="sat-dash__note">
                A separate question from how prepared they felt — someone can walk in
                ready and still be blindsided by the format.
              </p>
              <div className="sat-dash__cards">
                {Object.entries(rollup.examDebrief.difficulty).map(([key, count]) => (
                  <div key={key} className="sat-card">
                    <span className="sat-card__label">{labelFor(DIFFICULTY_LABELS, key)}</span>
                    <span className="sat-card__value">{count}</span>
                  </div>
                ))}
              </div>

              <h3 className="sat-dash__h3">What would have helped</h3>
              {rollup.examDebrief.byGap.length === 0 ? (
                <p className="sat-dash__state">
                  Nobody has picked a gap yet — the question is optional and comes after
                  the one that matters most.
                </p>
              ) : (
                <>
                  <p className="sat-dash__note">
                    Counted across every respondent, not just the unhappy ones: a student
                    who felt well prepared and still wants harder questions is telling us
                    something. Shares sum past 100%.
                  </p>
                  <ul className="sat-bars">
                    {rollup.examDebrief.byGap.map((g) => (
                      <li key={g.reason} className="sat-bar">
                        <span className="sat-bar__label">{labelFor(GAP_LABELS, g.reason)}</span>
                        <span className="sat-bar__track">
                          <span
                            className="sat-bar__fill"
                            style={{ width: `${Math.min(100, g.share || 0)}%` }}
                          />
                        </span>
                        <span className="sat-bar__count">
                          {g.count} · {pct(g.share)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {rollup.examDebrief.asks.length > 0 && (
                <>
                  <h3 className="sat-dash__h3">The one thing they asked for</h3>
                  <ul className="sat-comments">
                    {rollup.examDebrief.asks.map((c) => (
                      <li key={`ask-${c.id}`} className="sat-comment">
                        <div className="sat-comment__head">
                          {c.examLabel && (
                            <span className="sat-comment__topic">{c.examLabel}</span>
                          )}
                          <span className="sat-comment__date">{formatDate(c.at)}</span>
                        </div>
                        <p className="sat-comment__text">{c.insights.biggestImprovement}</p>
                        {c.insights.whatHelped && (
                          <p className="sat-comment__aside">
                            Helped: {c.insights.whatHelped}
                          </p>
                        )}
                        {c.insights.whatDidNotHelp && (
                          <p className="sat-comment__aside">
                            Didn't help: {c.insights.whatDidNotHelp}
                          </p>
                        )}
                        {c.insights.examEmphasis && (
                          <p className="sat-comment__aside">
                            The exam leaned on: {c.insights.examEmphasis}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {rollup.examDebrief.surprises.length > 0 && (
                <>
                  <h3 className="sat-dash__h3">What surprised them</h3>
                  <ul className="sat-comments">
                    {rollup.examDebrief.surprises.map((c) => (
                      <li key={c.id} className="sat-comment">
                        <div className="sat-comment__head">
                          <span className="sat-comment__surface">
                            {labelFor(PREPAREDNESS_LABELS, c.preparedness)}
                          </span>
                          {c.examLabel && (
                            <span className="sat-comment__topic">{c.examLabel}</span>
                          )}
                          <span className="sat-comment__date">{formatDate(c.at)}</span>
                        </div>
                        <p className="sat-comment__text">{c.comment}</p>
                        {c.insights?.missingPrep && (
                          <p className="sat-comment__aside">
                            Missing from her prep: {c.insights.missingPrep}
                          </p>
                        )}
                        {/* The transcript is what every number here compresses.
                            Collapsed by default: it is the answer to "really?",
                            not something to read down a list of. */}
                        {c.transcript.length > 0 && (
                          <details className="sat-transcript">
                            <summary>Read the conversation</summary>
                            {c.transcript.map((line, index) => (
                              <p
                                key={index}
                                className={`sat-transcript__line sat-transcript__line--${line.role}`}
                              >
                                <b>{line.role === 'user' ? 'Student' : 'Tutor'}:</b> {line.content}
                              </p>
                            ))}
                          </details>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {/* ── 2. Which surface is worst ── */}
          <section className="sat-dash__section">
            <h2 className="sat-dash__h2">By surface</h2>
            <table className="sat-table">
              <thead>
                <tr>
                  <th>Surface</th><th>Net</th><th>👍</th><th>👎</th><th>Rows</th>
                </tr>
              </thead>
              <tbody>
                {rollup.bySurface.map((s) => (
                  <tr key={s.surface}>
                    <td>{labelFor(SURFACE_LABELS, s.surface)}</td>
                    <td>
                      <span className={`sat-net ${s.net < 0 ? 'is-bad' : s.net > 50 ? 'is-good' : ''}`}>
                        {pct(s.net)}
                      </span>
                    </td>
                    <td>{s.positive}</td>
                    <td>{s.negative}</td>
                    <td>{s.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ── 3. Why ── */}
          <section className="sat-dash__section">
            <h2 className="sat-dash__h2">Most common complaints</h2>
            {rollup.byReason.length === 0 ? (
              <p className="sat-dash__state">
                No reasons given yet — students can leave a 👎 without opening the modal,
                and most do.
              </p>
            ) : (
              <>
                <p className="sat-dash__note">
                  Shares sum past 100%: one report can cite several problems.
                </p>
                <ul className="sat-bars">
                  {rollup.byReason.map((r) => (
                    <li key={r.reason} className="sat-bar">
                      <span className="sat-bar__label">{labelFor(REASON_LABELS, r.reason)}</span>
                      <span className="sat-bar__track">
                        <span
                          className="sat-bar__fill"
                          style={{ width: `${Math.min(100, r.shareOfNegative || 0)}%` }}
                        />
                      </span>
                      <span className="sat-bar__count">
                        {r.count} · {pct(r.shareOfNegative)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* ── Volume ── */}
          {rollup.byDay.length > 1 && (
            <section className="sat-dash__section">
              <h2 className="sat-dash__h2">Volume</h2>
              <div className="sat-spark">
                {rollup.byDay.map((d) => (
                  <div key={d.day} className="sat-spark__col" title={`${d.day}: ${d.total}`}>
                    <div
                      className="sat-spark__neg"
                      style={{ height: `${(d.negative / maxDayTotal) * 100}%` }}
                    />
                    <div
                      className="sat-spark__pos"
                      style={{ height: `${(d.positive / maxDayTotal) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
              <p className="sat-dash__note">
                {rollup.byDay[0].day} → {rollup.byDay[rollup.byDay.length - 1].day}
              </p>
            </section>
          )}

          {/* ── 4. What they wrote ── */}
          <section className="sat-dash__section">
            <h2 className="sat-dash__h2">
              Comments <span className="sat-dash__count">{rollup.comments.length}</span>
            </h2>
            {rollup.comments.length === 0 ? (
              <p className="sat-dash__state">Nobody has typed anything yet.</p>
            ) : (
              <ul className="sat-comments">
                {rollup.comments.map((c) => (
                  <li key={c.id} className="sat-comment">
                    <div className="sat-comment__head">
                      <span className={`sat-comment__sentiment ${c.sentiment < 0 ? 'is-neg' : 'is-pos'}`}>
                        {c.sentiment < 0 ? '👎' : '👍'}
                      </span>
                      <span className="sat-comment__surface">
                        {labelFor(SURFACE_LABELS, c.surface)}
                      </span>
                      {c.scored && c.scorePercent !== null && (
                        <span className="sat-comment__score">scored {c.scorePercent}%</span>
                      )}
                      {c.topic && <span className="sat-comment__topic">{c.topic}</span>}
                      <span className="sat-comment__date">{formatDate(c.at)}</span>
                    </div>
                    <p className="sat-comment__text">{c.comment}</p>
                    {c.reasons.length > 0 && (
                      <div className="sat-comment__reasons">
                        {c.reasons.map((r) => (
                          <span key={r} className="sat-comment__chip">
                            {labelFor(ALL_REASON_LABELS, r)}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default SatisfactionDashboard;
