import { PREPAREDNESS } from '../../Services/satisfactionEnums';
import { sentimentFromPreparedness } from './examDebriefModel';

/**
 * examDebriefConversation — turning the post-exam conversation into a row.
 *
 * WHY THIS EXISTS
 *
 * The debrief is a real conversation now: Claude reads what the student says
 * and decides what to ask next, so no two transcripts have the same shape. That
 * is the point — but a dashboard cannot count prose, and "we asked everyone and
 * learned things" is not a finding anyone can act on.
 *
 * So every turn the backend returns structured insights alongside the reply,
 * and this module is the single place that decides what those insights become
 * in Firestore. Keeping it here rather than in the component means the write
 * shape is testable without a chat UI, a network call, or a model.
 *
 * DESIGN NOTES
 *
 *  - `preparedness` arrives as a WORD from the model and is stored as the same
 *    4..1 ordinal the survey version wrote. The dashboard, the sentiment
 *    mapping and every row written before this rewrite all speak that scale;
 *    changing the vocabulary at the storage layer would silently split the
 *    metric in two at the moment we started measuring it properly.
 *
 *  - `unknown` maps to null, never to a middle value. A student who never
 *    mentioned how prepared she felt has not told us she felt average, and a
 *    stand-in would drag the distribution towards a number nobody said.
 *
 *  - The transcript is stored with the row. The insights are what gets counted,
 *    but every one of them is a compression of something a student actually
 *    said, and the first question anyone asks about a surprising tally is "what
 *    did they actually write?". Trimmed to a sane ceiling so one long answer
 *    cannot approach Firestore's document limit.
 *
 *  - `comment` is set to what surprised her, because that is the field the
 *    dashboard already renders as free text. `biggest_improvement` and the rest
 *    ride along in `context.insights` rather than being flattened into it —
 *    they are separate answers, and concatenating them would make both
 *    unquotable.
 */

/**
 * Mirrors MAX_STUDENT_TURNS in NQBackEnd2/services/exam_debrief.py. Drift here
 * shows up as an input that closes while the tutor is still asking questions.
 */
export const MAX_STUDENT_TURNS = 8;

/** Longest single message we will send or store. Generous for a chat reply. */
export const MAX_MESSAGE_CHARS = 1500;

/** Ceiling on stored turns. A capped conversation cannot exceed this anyway. */
export const MAX_STORED_MESSAGES = 20;

/**
 * The model's vocabulary → the ordinal every reader of this data already uses.
 * An unrecognised value returns null rather than guessing at the middle.
 */
export const PREPAREDNESS_BY_WORD = {
  well: PREPAREDNESS.WELL,
  mostly: PREPAREDNESS.MOSTLY,
  somewhat_unprepared: PREPAREDNESS.SOMEWHAT_UNPREPARED,
  not_prepared: PREPAREDNESS.NOT_ENOUGH
};

export const preparednessOrdinal = (word) => PREPAREDNESS_BY_WORD[word] ?? null;

/** Difficulty is stored as the model's word — a closed set, no ordinal needed. */
export const DIFFICULTY_VALUES = [
  'harder_than_expected',
  'as_expected',
  'easier_than_expected'
];

const cleanText = (value) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, MAX_MESSAGE_CHARS) : null;

/** Free-text lists — trimmed, capped, and never validated against a vocabulary. */
const cleanList = (value, maxChars = 120) =>
  Array.isArray(value)
    ? value
        .filter((item) => typeof item === 'string' && item.trim())
        .map((item) => item.trim().slice(0, maxChars))
        .slice(0, 10)
    : [];

/**
 * Normalise whatever the backend returned. It normalises too; this is the
 * second guard, because a transport hiccup or an older deployed backend should
 * degrade one field rather than write junk into a collection we analyse.
 */
export const normalizeInsights = (raw = {}) => {
  const insights = raw && typeof raw === 'object' ? raw : {};
  const difficulty = DIFFICULTY_VALUES.includes(insights.difficulty) ? insights.difficulty : null;

  return {
    preparedness: preparednessOrdinal(insights.preparedness),
    difficulty,
    whatSurprised: cleanText(insights.what_surprised),
    differentFromPrep: cleanText(insights.different_from_prep),
    missingPrep: cleanText(insights.missing_prep),
    whatHelped: cleanText(insights.what_helped),
    whatDidNotHelp: cleanText(insights.what_did_not_help),
    // Open-ended, unlike gapTags: the value of "vasopressor titration" is
    // precisely that nobody could have listed it in advance. These are what
    // turn a debrief into content we can actually go and build.
    topicsMissed: cleanList(insights.topics_missed),
    questionFormats: cleanList(insights.question_formats),
    // The highest-value field in the whole feature: a real question she sat.
    // One of these carries topic, format, difficulty and phrasing at once, and
    // is something the generator can be pointed at directly. Given a longer cap
    // than the label lists because it is a question, not a tag.
    exampleQuestions: cleanList(insights.example_questions, 600),
    examEmphasis: cleanText(insights.exam_emphasis),
    biggestImprovement: cleanText(insights.biggest_improvement),
    gapTags: Array.isArray(insights.gap_tags)
      ? insights.gap_tags.filter((t) => typeof t === 'string' && t).slice(0, 8)
      : []
  };
};

/** Wire shape for the backend: role + content, oldest first, nothing else. */
export const toWireMessages = (messages = []) =>
  messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, MAX_MESSAGE_CHARS) }));

/** How many times the student has spoken — what the turn cap counts. */
export const studentTurnCount = (messages = []) =>
  messages.filter((m) => m?.role === 'user').length;

/**
 * True when the student has used up the exchange budget. The backend enforces
 * the same ceiling; this one exists so the input can be closed the moment the
 * final reply lands, rather than inviting a message that would be refused.
 */
export const atTurnLimit = (messages = []) => studentTurnCount(messages) >= MAX_STUDENT_TURNS;

/** Stored transcript: capped, trimmed, and stripped of anything not said. */
export const storableTranscript = (messages = []) =>
  toWireMessages(messages).slice(-MAX_STORED_MESSAGES);

/**
 * Everything the signal row needs, derived from the conversation so far.
 *
 * Called after every turn, not once at the end: a student who answers one
 * question and closes the tab is the common case, and her answer is worth the
 * same as anyone else's.
 *
 * @param {Object} params
 * @param {Object} params.insights   Raw insights from the backend.
 * @param {Array}  params.messages   The conversation so far.
 * @param {Object} params.exam       From findPendingExamDebrief.
 * @param {string} [params.locale]
 * @returns {{sentiment: ?number, reasons: string[], comment: ?string, context: Object}}
 */
export const buildDebriefWrite = ({ insights, messages = [], exam = {}, locale } = {}) => {
  const normalized = normalizeInsights(insights);

  return {
    sentiment: sentimentFromPreparedness(normalized.preparedness),
    reasons: normalized.gapTags,
    // The dashboard renders `comment` as free text under "what surprised them",
    // so that is the insight that belongs there. The others stay addressable.
    comment: normalized.whatSurprised,
    context: {
      preparedness: normalized.preparedness,
      insights: normalized,
      transcript: storableTranscript(messages),
      turns: studentTurnCount(messages),
      examLabel: exam.label || null,
      examDay: exam.day || null,
      daysAfterExam: typeof exam.daysAgo === 'number' ? exam.daysAgo : null,
      locale: locale || null,
      devPreview: exam.devPreview === true ? true : null
    }
  };
};
