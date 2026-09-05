import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { fetchSignals } from '../../Services/SatisfactionQueries';
import {
  toConversations,
  filterConversations,
  conversationCounts,
  splitOnMatch
} from './conversationList';
import { PREPAREDNESS } from '../../Services/satisfactionEnums';
import './ConversationReader.css';

/**
 * ConversationReader — the satisfaction signals that are conversations, read as
 * conversations.
 *
 * WHY THIS EXISTS
 *
 * SatisfactionDashboard answers "what should we build next" and is right to:
 * it counts preparedness, difficulty, gap tags and topic mentions, because a
 * page of transcripts produces no decision. But the debrief is the only place
 * this product hears what happened in the exam room, and the counts are all
 * compressions of something a student actually wrote. Reading those is a
 * different job with a different shape, and it was reachable only through a
 * collapsed `<details>` on rows that happened to carry a comment.
 *
 * So: a list on the left, one full conversation on the right, and Claude's
 * structured read of it underneath — visibly derived from the text above it,
 * rather than presented as a fact of its own.
 *
 * DESIGN NOTES
 *
 *  - Dev-only route, like the dashboard, and it reads the window client-side.
 *    See SatisfactionQueries for why that is acceptable here and nowhere else.
 *
 *  - Dev-preview conversations are shown by default and badged. They are noise
 *    in a count and content in a reader; hiding them by default on a screen
 *    whose entire purpose is reading would make it look empty during exactly
 *    the work it is built for. The toggle says how many it would hide.
 *
 *  - Search hits are marked in the transcript, not merely filtered on. Finding
 *    the four conversations that mention "dosage" is half the job; the other
 *    half is seeing where in each one it comes up.
 *
 *  - Selection survives a filter change when the selected row is still in the
 *    results, and falls back to the first row when it is not. A reader that
 *    blanks the pane every time you type a character cannot be searched while
 *    reading.
 *
 *  - An empty result says which of the two empties it is — no signals at all,
 *    versus none matching the filters. They are opposite situations and the
 *    dashboard's own header comment explains why conflating them is how a
 *    broken pipeline stays broken.
 */

const WINDOWS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All time' }
];

const PREPAREDNESS_LABELS = {
  [PREPAREDNESS.WELL]: '😌 Well prepared',
  [PREPAREDNESS.MOSTLY]: '🙂 Mostly prepared',
  [PREPAREDNESS.SOMEWHAT_UNPREPARED]: '😬 Somewhat unprepared',
  [PREPAREDNESS.NOT_ENOUGH]: '😓 Not prepared enough'
};

/** Best first, matching the order the tutor's own scale runs in. */
const PREPAREDNESS_ORDER = [
  PREPAREDNESS.WELL,
  PREPAREDNESS.MOSTLY,
  PREPAREDNESS.SOMEWHAT_UNPREPARED,
  PREPAREDNESS.NOT_ENOUGH
];

const DIFFICULTY_LABELS = {
  harder_than_expected: 'Harder than expected',
  as_expected: 'About what she expected',
  easier_than_expected: 'Easier than expected'
};

const formatDateTime = (d) =>
  d
    ? d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'undated';

const formatDate = (d) => (d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—');

/** Text with the search term marked. Segments, never markup — see splitOnMatch. */
const Marked = ({ text, query }) => (
  <>
    {splitOnMatch(text, query).map((segment, index) =>
      segment.hit ? (
        <mark key={index} className="conv-mark">
          {segment.text}
        </mark>
      ) : (
        <React.Fragment key={index}>{segment.text}</React.Fragment>
      )
    )}
  </>
);

const ConversationReader = () => {
  const [rows, setRows] = useState(null);
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState('');
  const [preparedness, setPreparedness] = useState(null);
  const [includeDevPreview, setIncludeDevPreview] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [copied, setCopied] = useState(false);

  const transcriptRef = useRef(null);

  const load = useCallback(async (windowDays) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchSignals({ days: windowDays }));
    } catch (err) {
      console.error('Failed to load satisfaction conversations:', err);
      setError(err?.message || 'Failed to load');
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  const conversations = useMemo(() => (rows ? toConversations(rows) : []), [rows]);
  const counts = useMemo(() => conversationCounts(conversations), [conversations]);

  const visible = useMemo(
    () => filterConversations(conversations, { query, preparedness, includeDevPreview }),
    [conversations, query, preparedness, includeDevPreview]
  );

  /* Keep the open conversation open while the filters move around it; fall back
     to the first result only once it genuinely drops out. */
  const selected = useMemo(
    () => visible.find((c) => c.id === selectedId) || visible[0] || null,
    [visible, selectedId]
  );

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  /* A new conversation starts at its beginning, not wherever the last one was
     scrolled to. */
  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = 0;
    setCopied(false);
  }, [selected?.id]);

  /* ↑/↓ move through the list from anywhere on the page except a text field —
     this screen is read one conversation after another. */
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (visible.length === 0) return;

      const index = visible.findIndex((c) => c.id === selectedId);
      const next = event.key === 'ArrowDown'
        ? Math.min(visible.length - 1, index + 1)
        : Math.max(0, index - 1);

      if (next !== index) {
        event.preventDefault();
        setSelectedId(visible[next].id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, selectedId]);

  const copyTranscript = useCallback(() => {
    if (!selected) return;
    const text = selected.transcript
      .map((line) => `${line.role === 'user' ? 'Student' : 'Tutor'}: ${line.content}`)
      .join('\n\n');

    navigator.clipboard?.writeText(text).then(
      () => setCopied(true),
      () => setCopied(false)
    );
  }, [selected]);

  const filtersActive = Boolean(query.trim()) || preparedness !== null || !includeDevPreview;

  return (
    <div className="conv">
      <header className="conv__header">
        <div>
          <h1 className="conv__title">Conversations</h1>
          <p className="conv__sub">
            Post-exam debriefs from <code>satisfactionSignals</code> · dev only ·{' '}
            <Link to="/admin/satisfaction" className="conv__link">
              the counts are on the dashboard
            </Link>
          </p>
        </div>
        <div className="conv__windows">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              type="button"
              className={`conv__window ${days === w.days ? 'is-active' : ''}`}
              onClick={() => setDays(w.days)}
            >
              {w.label}
            </button>
          ))}
          <button type="button" className="conv__refresh" onClick={() => load(days)}>
            Refresh
          </button>
        </div>
      </header>

      {loading && <p className="conv__state">Loading…</p>}

      {error && (
        <p className="conv__state conv__state--error">Couldn’t load conversations: {error}</p>
      )}

      {!loading && !error && counts.total === 0 && (
        <p className="conv__state">
          No conversations in this window. Debriefs are asked the day after an exam and stored
          from the first exchange, so this is an absence of exams — not of answers.
        </p>
      )}

      {!loading && !error && counts.total > 0 && (
        <>
          <div className="conv__controls">
            <input
              type="search"
              className="conv__search"
              placeholder="Search what they said, and what Claude read into it…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <div className="conv__chips">
              <button
                type="button"
                className={`conv__chip ${preparedness === null ? 'is-active' : ''}`}
                onClick={() => setPreparedness(null)}
              >
                Any
              </button>
              {PREPAREDNESS_ORDER.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`conv__chip ${preparedness === value ? 'is-active' : ''}`}
                  onClick={() => setPreparedness(preparedness === value ? null : value)}
                >
                  {PREPAREDNESS_LABELS[value]}
                </button>
              ))}
            </div>

            {counts.devPreview > 0 && (
              <label className="conv__toggle">
                <input
                  type="checkbox"
                  checked={includeDevPreview}
                  onChange={(e) => setIncludeDevPreview(e.target.checked)}
                />
                Include {counts.devPreview} dev preview
                {counts.devPreview === 1 ? '' : 's'}
              </label>
            )}
          </div>

          <p className="conv__note">
            {visible.length} of {counts.total} conversation
            {counts.total === 1 ? '' : 's'} · {counts.studentTurns} student message
            {counts.studentTurns === 1 ? '' : 's'} in the window
            {counts.withoutPreparedness > 0 && (
              <>
                {' '}· {counts.withoutPreparedness} never said how prepared they felt, which is an
                answer rather than a gap
              </>
            )}
          </p>

          <div className="conv__body">
            <ol className="conv__list">
              {visible.length === 0 && (
                <li className="conv__state conv__state--inline">
                  Nothing matches these filters. {counts.total} conversation
                  {counts.total === 1 ? ' is' : 's are'} in the window.
                </li>
              )}
              {visible.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`conv__item ${selected?.id === c.id ? 'is-selected' : ''}`}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <span className="conv__item-head">
                      <span className="conv__item-prep">
                        {PREPAREDNESS_LABELS[c.preparedness] || '· not stated'}
                      </span>
                      <span className="conv__item-date">{formatDate(c.at)}</span>
                    </span>
                    <span className="conv__item-snippet">
                      <Marked text={c.snippet || '(she opened without writing anything)'} query={query} />
                    </span>
                    <span className="conv__item-meta">
                      {c.examLabel && <span className="conv__pill">{c.examLabel}</span>}
                      <span className="conv__item-turns">
                        {c.turnCount} message{c.turnCount === 1 ? '' : 's'}
                      </span>
                      {c.devPreview && <span className="conv__pill conv__pill--dev">dev</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            <article className="conv__detail">
              {!selected && (
                <p className="conv__state">Pick a conversation on the left, or use ↑ and ↓.</p>
              )}

              {selected && (
                <>
                  <div className="conv__detail-head">
                    <div>
                      <h2 className="conv__detail-title">
                        {selected.examLabel || 'Exam'}
                        {selected.devPreview && (
                          <span className="conv__pill conv__pill--dev">dev preview</span>
                        )}
                      </h2>
                      <p className="conv__detail-meta">
                        {formatDateTime(selected.at)}
                        {typeof selected.daysAfterExam === 'number' && (
                          <>
                            {' · '}
                            {selected.daysAfterExam === 1
                              ? 'the day after'
                              : `${selected.daysAfterExam} days after`}{' '}
                            the exam
                          </>
                        )}
                        {selected.userEmail && <> · {selected.userEmail}</>}
                      </p>
                    </div>
                    <button type="button" className="conv__copy" onClick={copyTranscript}>
                      {copied ? 'Copied' : 'Copy transcript'}
                    </button>
                  </div>

                  <div className="conv__badges">
                    <span className="conv__badge">
                      {PREPAREDNESS_LABELS[selected.preparedness] || 'Preparedness never came up'}
                    </span>
                    {selected.insights?.difficulty && (
                      <span className="conv__badge">
                        {DIFFICULTY_LABELS[selected.insights.difficulty] ||
                          selected.insights.difficulty}
                      </span>
                    )}
                    <span className="conv__badge conv__badge--quiet">
                      {selected.turnCount} student message
                      {selected.turnCount === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="conv__transcript" ref={transcriptRef}>
                    {selected.transcript.map((line, index) => (
                      <div
                        key={index}
                        className={`conv__line conv__line--${line.role}`}
                      >
                        <span className="conv__speaker">
                          {line.role === 'user' ? 'Student' : 'Tutor'}
                        </span>
                        <p className="conv__bubble">
                          <Marked text={line.content} query={query} />
                        </p>
                      </div>
                    ))}
                  </div>

                  <section className="conv__insights">
                    <h3 className="conv__insights-title">What Claude read into it</h3>
                    <p className="conv__note">
                      Extracted from the transcript above, and re-derived on every turn — these
                      are the fields the dashboard counts, shown next to the words they came from.
                    </p>
                    {selected.insightList.length === 0 ? (
                      <p className="conv__state conv__state--inline">
                        Nothing structured came out of this one. Usually it ended after the
                        opener.
                      </p>
                    ) : (
                      <dl className="conv__fields">
                        {selected.insightList.map((item) => (
                          <div key={item.key} className="conv__field">
                            <dt>{item.label}</dt>
                            <dd>
                              {item.kind === 'list' ? (
                                <ul className="conv__values">
                                  {item.values.map((value, index) => (
                                    <li key={index}>
                                      <Marked text={value} query={query} />
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <Marked text={item.value} query={query} />
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </section>
                </>
              )}
            </article>
          </div>

          {filtersActive && visible.length > 0 && (
            <p className="conv__note conv__note--foot">
              Filters are on. {counts.total - visible.length} conversation
              {counts.total - visible.length === 1 ? ' is' : 's are'} hidden.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default ConversationReader;
