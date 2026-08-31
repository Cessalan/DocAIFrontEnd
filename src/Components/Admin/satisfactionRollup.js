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

/**
 * Build the whole rollup.
 *
 * @param {Array} rawRows   Firestore documents (with `id` attached).
 * @param {Object} [options]
 * @param {number} [options.commentLimit=50]
 * @returns {Object}
 */
export const buildRollup = (rawRows = [], { commentLimit = 50 } = {}) => {
  const rows = rawRows.map(normalizeRow);

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
    comments,
    byDay,
    // Rows that arrived without a usable sentiment. Surfaced rather than
    // dropped: a rising count here means the writer is broken.
    malformed: rows.filter((r) => r.sentiment === null).length
  };
};
