import { normalizeRow } from './satisfactionRollup';

/**
 * conversationList — the reading view of `satisfactionSignals`.
 *
 * WHY THIS EXISTS
 *
 * Some satisfaction signals are not a thumb. The post-exam debrief is a real
 * conversation: Claude asks, the student answers in her own words, and what
 * lands in Firestore is a transcript plus a structured read of it. The
 * dashboard counts that read — preparedness, difficulty, gap tags — which is
 * the right shape for deciding what to build.
 *
 * It is the wrong shape for the other question, which is simply: what did she
 * say? Before this module the only way to reach a transcript was a `<details>`
 * nested under "What surprised them", and that section is filtered on `comment`
 * being present. A student who talked for six turns without ever naming a
 * surprise had a transcript nobody could open. Those are frequently the
 * interesting ones — an "it went fine" conversation is exactly where an
 * unprompted complaint hides.
 *
 * So this module selects on the thing that actually defines the set — a stored
 * transcript — and shapes each row for reading rather than for counting.
 *
 * DESIGN NOTES
 *
 *  - Pure, like every other derivation module here. Firestore shapes are
 *    normalised by `normalizeRow`, which this reuses rather than re-deriving:
 *    the reader and the dashboard must never disagree about what a row says.
 *
 *  - Dev-preview rows are KEPT, and flagged. `buildRollup` drops them because a
 *    developer's clicking must not be reported as student sentiment — but a
 *    dev-preview conversation is still real text somebody typed, and on a
 *    screen whose whole job is reading, hiding it by default is how you end up
 *    staring at an empty page wondering whether the query is broken. Every
 *    record carries `devPreview`, `conversationCounts` reports how many there
 *    are, and the caller can filter them out explicitly.
 *
 *  - The snippet is the student's FIRST message, never the tutor's opener. The
 *    opener is generated and near-identical every time; a list of those is a
 *    list of the same sentence.
 *
 *  - `INSIGHT_FIELDS` is asserted in the tests against what `normalizeInsights`
 *    produces. A new insight added to the conversation model that nobody wires
 *    in here would otherwise be written, counted, and never shown.
 */

/**
 * Every insight the debrief extracts, in reading order, with how to render it.
 *
 * The order is deliberate: what the exam was actually like first, then how our
 * prep held up against it, then the ask. That is the order the answers matter
 * in — the exam is ground truth, our prep is the thing under review.
 */
export const INSIGHT_FIELDS = [
  { key: 'exampleQuestions', kind: 'list', label: 'Questions she remembers from the exam' },
  { key: 'topicsMissed', kind: 'list', label: "Topics she wasn't ready for" },
  { key: 'questionFormats', kind: 'list', label: 'Formats that caught her out' },
  { key: 'examEmphasis', kind: 'text', label: 'What the exam leaned on' },
  { key: 'whatSurprised', kind: 'text', label: 'What surprised her' },
  { key: 'differentFromPrep', kind: 'text', label: 'How it differed from her prep' },
  { key: 'missingPrep', kind: 'text', label: 'What her prep was missing' },
  { key: 'whatHelped', kind: 'text', label: 'What helped' },
  { key: 'whatDidNotHelp', kind: 'text', label: "What didn't help" },
  { key: 'biggestImprovement', kind: 'text', label: 'The one thing she asked for' },
  { key: 'gapTags', kind: 'list', label: 'Gap tags' }
];

/** Carried on the record itself rather than rendered from the insights list. */
const STRUCTURED_INSIGHT_KEYS = ['preparedness', 'difficulty'];

/** Every insight key this module can show — the tests check for omissions. */
export const RENDERED_INSIGHT_KEYS = [
  ...INSIGHT_FIELDS.map((field) => field.key),
  ...STRUCTURED_INSIGHT_KEYS
];

/** Longest snippet shown in the list. Enough to recognise, short enough to scan. */
const SNIPPET_CHARS = 160;

const trim = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * The insights that actually have a value, ready to render.
 *
 * Empty strings and empty arrays are dropped rather than rendered blank: "she
 * didn't mention it" and "she mentioned nothing" look identical on screen, and
 * only one of them deserves a heading.
 */
export const presentInsights = (insights) => {
  if (!insights || typeof insights !== 'object') return [];

  return INSIGHT_FIELDS.map((field) => {
    if (field.kind === 'list') {
      const values = Array.isArray(insights[field.key])
        ? insights[field.key].map(trim).filter(Boolean)
        : [];
      return values.length > 0 ? { ...field, values } : null;
    }
    const value = trim(insights[field.key]);
    return value ? { ...field, value } : null;
  }).filter(Boolean);
};

/**
 * Everything in a conversation that free-text search should reach.
 *
 * Deliberately includes the insights as well as the transcript. Those are
 * Claude's words, not the student's, but they are what the dashboard reports —
 * so "which conversation produced this tag?" has to be answerable from here,
 * and it is the most common reason to come looking.
 */
export const searchableText = (record) =>
  [
    record.examLabel,
    record.userEmail,
    ...record.transcript.map((line) => line.content),
    ...record.insightList.flatMap((item) => (item.kind === 'list' ? item.values : [item.value]))
  ]
    .filter(Boolean)
    .join('   ')
    .toLowerCase();

/**
 * Firestore documents to conversations, newest first.
 *
 * Selection is on the transcript, not on the surface: any signal that stored
 * one is a conversation worth reading, and keying on `exam_debrief` would mean
 * a second conversational surface silently never appears here.
 *
 * @param {Array} rawRows  Documents with `id` attached, as `fetchSignals` returns.
 * @returns {Array} Records shaped for reading.
 */
export const toConversations = (rawRows = []) =>
  rawRows
    .map((raw) => {
      const row = normalizeRow(raw);
      const transcript = row.transcript
        .filter(
          (line) => line && (line.role === 'user' || line.role === 'assistant') && line.content
        )
        .map((line) => ({ role: line.role, content: String(line.content) }));

      if (transcript.length === 0) return null;

      const studentLines = transcript.filter((line) => line.role === 'user');

      const record = {
        ...row,
        userEmail: raw.userEmail || null,
        transcript,
        turnCount: studentLines.length,
        messageCount: transcript.length,
        // Her first words. See the header: the tutor's opener is boilerplate.
        snippet: studentLines.length > 0 ? studentLines[0].content.slice(0, SNIPPET_CHARS) : '',
        // The longest thing she wrote — the nearest thing to "where the
        // substance is" without opening it, and what makes a list scannable by
        // weight rather than only by date.
        longestStudentChars: studentLines.reduce(
          (max, line) => Math.max(max, line.content.length),
          0
        ),
        insightList: presentInsights(row.insights)
      };

      return { ...record, searchText: searchableText(record) };
    })
    .filter(Boolean)
    .sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0));

/**
 * Narrow the list.
 *
 * Every filter is opt-in and absent means "everything": an admin screen that
 * silently hides rows is how you conclude nobody said anything.
 *
 * @param {Array}   conversations            From `toConversations`.
 * @param {Object}  [options]
 * @param {string}  [options.query]           Case-insensitive substring.
 * @param {number}  [options.preparedness]    Ordinal 4..1.
 * @param {boolean} [options.includeDevPreview] Defaults to true — see header.
 */
export const filterConversations = (conversations = [], options = {}) => {
  const { query = '', preparedness = null, includeDevPreview = true } = options;
  const needle = trim(query).toLowerCase();

  return conversations.filter((c) => {
    if (!includeDevPreview && c.devPreview) return false;
    if (preparedness !== null && preparedness !== undefined && c.preparedness !== preparedness) {
      return false;
    }
    if (needle && !c.searchText.includes(needle)) return false;
    return true;
  });
};

/**
 * The counts the header needs to say what is on screen and what isn't.
 *
 * `withoutPreparedness` is called out because it is the honest reading of a
 * conversation where she never said how prepared she felt — not a broken row,
 * and not a neutral one.
 */
export const conversationCounts = (conversations = []) => ({
  total: conversations.length,
  devPreview: conversations.filter((c) => c.devPreview).length,
  studentTurns: conversations.reduce((sum, c) => sum + c.turnCount, 0),
  withoutPreparedness: conversations.filter((c) => c.preparedness === null).length
});

/**
 * Split text on a search term so the match can be marked up.
 *
 * Returns segments rather than HTML — the caller renders them — because a
 * transcript is student-written text, and building a string with markup in it
 * is how that text ends up interpreted instead of shown.
 *
 * @returns {Array<{text: string, hit: boolean}>}
 */
export const splitOnMatch = (text = '', query = '') => {
  const source = String(text);
  const needle = trim(query).toLowerCase();
  if (!needle) return [{ text: source, hit: false }];

  const segments = [];
  const haystack = source.toLowerCase();
  let cursor = 0;

  for (;;) {
    const found = haystack.indexOf(needle, cursor);
    if (found === -1) break;
    if (found > cursor) segments.push({ text: source.slice(cursor, found), hit: false });
    segments.push({ text: source.slice(found, found + needle.length), hit: true });
    cursor = found + needle.length;
  }

  if (cursor < source.length) segments.push({ text: source.slice(cursor), hit: false });
  return segments.length > 0 ? segments : [{ text: source, hit: false }];
};
