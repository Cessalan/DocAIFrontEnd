import { SURFACE, PREPAREDNESS } from '../../Services/satisfactionEnums';

/**
 * satisfactionRollup — turning satisfaction rows into the four things worth knowing.
 *
 * WHY THIS EXISTS
 *
 * `satisfactionSignals` was write-only for its entire existence. The one thing
 * that ever read the predecessor data was `FeedbackViewer`, which was never
 * mounted, and which rendered a flat list — so even if it had been reachable,
 * the only available question was "what did people say", one row at a time.
 *
 * A list is the wrong shape for this. The questions that change what gets built
 * are comparative: which surface is worst, which complaint is most common, and
 * — the one that matters most — whether the negatives are coming from students
 * who did badly or students who did well.
 *
 * THE LOAD-BEARING DISTINCTION
 *
 * A thumbs-down from someone who scored 2/10 is usually frustration at the
 * result. A thumbs-down from someone who scored 9/10 is a report about the
 * content, because they have no reason to be annoyed at themselves. Those need
 * opposite responses, and averaged together they produce a number that
 * justifies doing nothing. `defectRate` separates them: it counts only the
 * negatives from students who scored well.
 *
 * That split is the entire reason the score is stored in `context` at rating
 * time. If this module ever stops using it, the storage should go too.
 *
 * DESIGN NOTES
 *
 *  - Pure. Firestore shapes are normalised at the boundary (`normalizeRow`) so
 *    everything below operates on plain objects and is trivially testable.
 *
 *  - Rows with no sentiment are counted in `total` but excluded from rates. A
 *    malformed row should be visible as a discrepancy, not silently averaged as
 *    neutral.
 *
 *  - Reasons are counted per occurrence across an array field, so a row citing
 *    two problems contributes to both tallies. That means the reason counts sum
 *    to more than the negative count, which is correct and worth remembering
 *    when reading them as percentages.
 *
 *  - Net sentiment, not average. `(positive - negative) / rated` maps onto the
 *    -100..+100 range people already read NPS-style, and unlike a mean it does
 *    not hide a polarised surface behind a middling number.
 */

/** Sentiment threshold above which a complaint is about the content, not the score. */
export const DID_WELL_PERCENT = 70;

/** Firestore Timestamp | Date | string | null → Date | null. */
const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Flatten one Firestore document into the shape everything below expects.
 * Tolerant on purpose: rows predate several fields, and a missing one should
 * cost that row's contribution to one stat, never the whole rollup.
 */
export const normalizeRow = (raw = {}) => {
  const context = raw.context || {};
  const sentiment = typeof raw.sentiment === 'number' ? raw.sentiment : null;

  return {
    id: raw.id || null,
    surface: raw.surface || 'unknown',
    sentiment,
    reasons: Array.isArray(raw.reasons) ? raw.reasons : [],
    comment: typeof raw.comment === 'string' && raw.comment.trim() ? raw.comment.trim() : null,
    userId: raw.userId || null,
    subjectId: raw.subjectId || null,
    chatId: raw.chatId || null,
    topic: context.topic || null,
    source: context.source || null,
    nodeType: context.nodeType || null,
    scored: context.scored === true,
    scorePercent: typeof context.scorePercent === 'number' ? context.scorePercent : null,
    bucket: context.bucket || null,
    // Exam debrief only. Null everywhere else, which is what keeps
    // `buildExamDebrief` from having to guess which rows are its own.
    preparedness: typeof context.preparedness === 'number' ? context.preparedness : null,
    examLabel: context.examLabel || null,
    // The whole structured read of a debrief conversation, and the transcript
    // it came from. Null on every other surface.
    insights: context.insights && typeof context.insights === 'object' ? context.insights : null,
    transcript: Array.isArray(context.transcript) ? context.transcript : [],
    devPreview: context.devPreview === true,
    daysAfterExam: typeof context.daysAfterExam === 'number' ? context.daysAfterExam : null,
    at: toDate(raw.timestamp) || toDate(raw.createdAt)
  };
};

const emptyTally = () => ({ total: 0, positive: 0, negative: 0, rated: 0 });

const tally = (acc, row) => {
  acc.total += 1;
  if (row.sentiment > 0) { acc.positive += 1; acc.rated += 1; }
  else if (row.sentiment < 0) { acc.negative += 1; acc.rated += 1; }
  return acc;
};

/** (positive - negative) / rated, as a -100..+100 integer. Null when nothing is rated. */
export const netSentiment = ({ positive, negative, rated }) =>
  rated > 0 ? Math.round(((positive - negative) / rated) * 100) : null;

/** Preparedness ordinals, best first — the order the answers were offered in. */
const PREPAREDNESS_ORDER = [
  PREPAREDNESS.WELL,
  PREPAREDNESS.MOSTLY,
  PREPAREDNESS.SOMEWHAT_UNPREPARED,
  PREPAREDNESS.NOT_ENOUGH
];

/**
 * The post-exam debrief, rolled up on its own.
 *
 * WHY IT IS NOT JUST ANOTHER SURFACE
 *
 * Every other row rates a piece of content while the student is looking at it.
 * These rate the exam — the outcome the whole product is pointed at — and they
 * carry a four-point answer that the shared -1/0/+1 column flattens away. Read
 * through `bySurface` alone, a debrief is one more thumb.
 *
 * Two things here deliberately differ from the general rollup:
 *
 *  - Gaps are counted across ALL respondents, not just the negative ones.
 *    "What would have helped?" is asked of everyone, and a student who felt
 *    well prepared and still wanted harder questions is telling us something
 *    the negatives-only tally in `byReason` would silently drop.
 *
 *  - `preparedRate` is the top TWO answers, matching the 2/2 split used to
 *    derive sentiment. Reporting only "well prepared" would make a good week
 *    look like a bad one.
 *
 * @param {Array} rows  Normalised rows (all surfaces; this filters its own).
 */
export const buildExamDebrief = (rows = []) => {
  const debriefs = rows.filter((r) => r.surface === SURFACE.EXAM_DEBRIEF);

  const counts = new Map(PREPAREDNESS_ORDER.map((value) => [value, 0]));
  let answered = 0;
  debriefs.forEach((row) => {
    if (!counts.has(row.preparedness)) return;
    counts.set(row.preparedness, counts.get(row.preparedness) + 1);
    answered += 1;
  });

  const distribution = PREPAREDNESS_ORDER.map((value) => ({
    value,
    count: counts.get(value),
    share: answered > 0 ? Math.round((counts.get(value) / answered) * 100) : null
  }));

  const preparedCount = counts.get(PREPAREDNESS.WELL) + counts.get(PREPAREDNESS.MOSTLY);

  const gapMap = new Map();
  debriefs.forEach((row) => {
    row.reasons.forEach((reason) => {
      gapMap.set(reason, (gapMap.get(reason) || 0) + 1);
    });
  });
  const byGap = [...gapMap.entries()]
    .map(([reason, count]) => ({
      reason,
      count,
      // Share of everyone who answered, not of everyone who cited something —
      // "3 of 12 students wanted harder questions" is the sentence this needs
      // to support. Sums past 100%: one student can ask for several things.
      share: debriefs.length > 0 ? Math.round((count / debriefs.length) * 100) : null
    }))
    .sort((a, b) => b.count - a.count);

  // How the exam compared with what she expected — a separate axis from how
  // prepared she felt. A student can feel well prepared and still be blindsided
  // by the format, and that pair is the most actionable thing on this page.
  const difficulty = { harder_than_expected: 0, as_expected: 0, easier_than_expected: 0 };
  debriefs.forEach((row) => {
    const value = row.insights?.difficulty;
    if (value && Object.prototype.hasOwnProperty.call(difficulty, value)) {
      difficulty[value] += 1;
    }
  });

  /**
   * The two open-ended lists, tallied by exact label.
   *
   * Deliberately NOT normalised, clustered or stemmed: "SATA" and "select all
   * that apply" stay two rows. A fuzzy merge here would be a guess presented as
   * a count, and the list is short enough to read with human eyes — which is
   * also the only thing that can tell whether those two are the same complaint.
   */
  const tallyLabels = (field) => {
    const counts = new Map();
    debriefs.forEach((row) => {
      (row.insights?.[field] || []).forEach((label) => {
        const key = String(label).trim();
        if (!key) return;
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  };

  return {
    total: debriefs.length,
    answered,
    preparedCount,
    // What the real exam tested that they were not ready for. The most directly
    // actionable output of the whole feature: each of these is a lesson or a
    // question set somebody could go and build this week.
    topicsMissed: tallyLabels('topicsMissed'),
    // Formats that caught them out — what our generator should be producing
    // more of, as opposed to what it should be producing more ABOUT.
    questionFormats: tallyLabels('questionFormats'),
    // Real questions students sat, each with the exam it came from. Not tallied
    // — no two are the same, and the value is in reading them, not counting
    // them. This is the closest thing we have to seeing the exam paper.
    examples: debriefs
      .filter((r) => (r.insights?.exampleQuestions || []).length > 0)
      .sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0))
      .flatMap((r) =>
        r.insights.exampleQuestions.map((text, index) => ({
          id: `${r.id}-${index}`,
          text,
          examLabel: r.examLabel,
          at: r.at
        }))
      ),
    preparedRate: answered > 0 ? Math.round((preparedCount / answered) * 100) : null,
    distribution,
    difficulty,
    // What she said we could change, newest first. Free text, so it is the only
    // place something we never thought to ask about can show up.
    asks: debriefs
      .filter((r) => r.insights?.biggestImprovement)
      .sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0)),
    byGap,
    // What the exam threw at them that we never covered. The only field in the
    // whole collection that can name something we did not think to ask about.
    surprises: debriefs
      .filter((r) => r.comment)
      .sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0))
  };
};

/**
 * Build the whole rollup.
 *
 * @param {Array} rawRows   Firestore documents (with `id` attached).
 * @param {Object} [options]
 * @param {number} [options.commentLimit=50]
 * @returns {Object}
 */
export const buildRollup = (rawRows = [], { commentLimit = 50 } = {}) => {
  // Dev-preview rows are dropped before anything is counted. They are written
  // for real — dev and production share a Firebase project — and a dashboard
  // that reports a developer's clicking as student sentiment is worse than one
  // with no data on it at all.
  const rows = rawRows.map(normalizeRow).filter((r) => !r.devPreview);

  const overall = rows.reduce(tally, emptyTally());

  // ── Per surface ──────────────────────────────────────────────────────
  const surfaceMap = new Map();
  rows.forEach((row) => {
    if (!surfaceMap.has(row.surface)) surfaceMap.set(row.surface, emptyTally());
    tally(surfaceMap.get(row.surface), row);
  });
  const bySurface = [...surfaceMap.entries()]
    .map(([surface, t]) => ({ surface, ...t, net: netSentiment(t) }))
    // Worst first — this list exists to point at what to fix.
    .sort((a, b) => (a.net ?? 999) - (b.net ?? 999) || b.total - a.total);

  // ── Why people are unhappy ───────────────────────────────────────────
  // Only negatives carry reasons; counting them from positives would be
  // counting nothing, since the 👍 path never opens the modal.
  const reasonMap = new Map();
  rows.forEach((row) => {
    if (row.sentiment >= 0) return;
    row.reasons.forEach((reason) => {
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
    });
  });
  const byReason = [...reasonMap.entries()]
    .map(([reason, count]) => ({
      reason,
      count,
      // Share of negatives that cited this. Sums past 100% — a row can cite two.
      shareOfNegative: overall.negative > 0
        ? Math.round((count / overall.negative) * 100)
        : null
    }))
    .sort((a, b) => b.count - a.count);

  // ── Content defects vs frustration ───────────────────────────────────
  // The distinction the whole score-in-context design exists to enable.
  const scoredRows = rows.filter((r) => r.scored && r.scorePercent !== null);
  const didWell = scoredRows.filter((r) => r.scorePercent >= DID_WELL_PERCENT);
  const didBadly = scoredRows.filter((r) => r.scorePercent < DID_WELL_PERCENT);

  const negativesFrom = (list) => list.filter((r) => r.sentiment < 0).length;

  const defect = {
    // Negatives from students who did well — the ones reporting the content,
    // not their own result. Weight these heaviest.
    wellNegative: negativesFrom(didWell),
    wellTotal: didWell.length,
    badlyNegative: negativesFrom(didBadly),
    badlyTotal: didBadly.length
  };
  defect.wellRate = defect.wellTotal > 0
    ? Math.round((defect.wellNegative / defect.wellTotal) * 100)
    : null;
  defect.badlyRate = defect.badlyTotal > 0
    ? Math.round((defect.badlyNegative / defect.badlyTotal) * 100)
    : null;

  // ── What they actually wrote ─────────────────────────────────────────
  // Newest first. Free text is the only part that can say something we didn't
  // think to offer as a chip, so it is never truncated here.
  const comments = rows
    .filter((r) => r.comment)
    .sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0))
    .slice(0, commentLimit);

  // ── Volume per day ───────────────────────────────────────────────────
  const dayMap = new Map();
  rows.forEach((row) => {
    if (!row.at) return;
    const key = row.at.toISOString().slice(0, 10);
    if (!dayMap.has(key)) dayMap.set(key, emptyTally());
    tally(dayMap.get(key), row);
  });
  const byDay = [...dayMap.entries()]
    .map(([day, t]) => ({ day, ...t, net: netSentiment(t) }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return {
    overall: { ...overall, net: netSentiment(overall) },
    bySurface,
    byReason,
    defect,
    examDebrief: buildExamDebrief(rows),
    comments,
    byDay,
    // Rows that arrived without a usable sentiment. Surfaced rather than
    // dropped: a rising count here means the writer is broken.
    //
    // Exam debriefs are exempt. A conversation where the student never said how
    // prepared she felt legitimately has no sentiment — that is the honest
    // reading, not a broken write — and counting those here would make this
    // number climb every week the feature works as designed.
    malformed: rows.filter(
      (r) => r.sentiment === null && r.surface !== SURFACE.EXAM_DEBRIEF
    ).length
  };
};
