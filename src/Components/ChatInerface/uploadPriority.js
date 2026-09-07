/* ══════════════════════════════════════════════════════════════════════
   UPLOAD PRIORITY — presenting the topics in a fresh upload.

   WHY THIS EXISTS
   ───────────────
   The old post-upload card asked "which of these feels hardest?" as its
   second question. That is the product asking the student to do the
   product's job. We already hold her material; the first thing she sees
   should be evidence that we read it.

   THE ONE RULE
   ────────────
   Every line built here has to be something we can point at IN HER
   DOCUMENT. The card's whole effect — "it actually read my notes" — is
   worth precisely as much as its least true line. Two signals have already
   been removed for failing that test; both are written up below, because
   both looked reasonable in review and were false in production.

   WHAT IS LEFT
   ────────────
   Exactly one signal: coverage. How many teaching points the extractor
   pulled for a topic, and whether it appeared in more than one uploaded
   file. When we have that, topics are ranked by it and each carries a
   reason quoting it.

   When we DON'T have it — see the pipeline note below, this is the common
   case — `hasEvidence` comes back false and there is no ranking, no band
   and no reason. The card then shows the topics and nothing else. An
   unadorned list is the honest rendering of "we extracted these topics and
   know nothing more about them"; a confident-looking one is not.

   REMOVED 1 — PAST SCORES  (2026-09-06)
   ─────────────────────────────────────
   This module used to read `users/{uid}/studyPerformance` through
   findMatchingTopicKey and say "You averaged 56% here before".

   On a real cardiology upload that rendered under **Acute Coronary
   Syndrome**, having matched the stored bucket **"Definition and
   Characteristics of Acute Respiratory Distress Syndrome (ARDS)"** — the
   labels share "acute" and "syndrome", and findMatchingTopicKey matches at
   `overlap >= min(newWords, existingWords) * 0.5`, i.e. 2 >= 1.5. In the
   same render "Management of STEMI including Thrombolytic Therapy and PCI"
   matched "collection or management" on the single word "management".

   That matcher is deliberately over-eager and says so in its own header:
   over-merging is the ACCEPTED failure there, because pooling evidence into
   one bucket is what makes the drill's checkpoint work. Pooling is
   survivable when you are counting answers. It is not survivable when the
   output is a sentence quoting a percentage back to the student about a
   subject she has never studied. So the signal is gone rather than fenced
   behind a tighter threshold — there is no threshold at which "quote her a
   number" is safe on top of a matcher built to over-merge.

   REMOVED 2 — THE NCLEX RISK TABLE  (2026-09-06)
   ──────────────────────────────────────────────
   There was a hard-coded HIGH_RISK / MEDIUM_RISK list of nursing words
   ('pharmacolog', 'myocardial', 'airway', …) matched as substrings against
   the topic label. A hit rendered "Commonly missed on the NCLEX" and added
   2 to the topic's score.

   We have no NCLEX item analysis. The line asserted a fact about national
   exam performance on the strength of a word someone typed into an array,
   and it read as a finding about the student's document sitting in the same
   slot as the coverage lines, which are real.

   It also mattered far more than it looked. Across 119 persisted
   `plan_onboarding` messages in production, 118 carried an EMPTY insights
   array — so coverage was 0 for every topic and `score` was the risk
   keyword alone. The table was not one input among several; it was the
   entire ranking, and "Commonly missed on the NCLEX" was the default
   subtitle. Deleting the caption but keeping the table would have left an
   invented prior silently choosing the lead topic — which is the first
   lesson and the planner's diagnostic (see PlanOnboarding).

   UPSTREAM: WHY COVERAGE IS USUALLY EMPTY
   ───────────────────────────────────────
   `insights` reaches the card from the backend's `post_upload_message`
   event, built in NQBackEnd2/main.py from `session.file_insights[...]
   ["insights"]`. In production that array is almost always empty, so
   coverageFor finds nothing. Note also that when it IS populated,
   coverageFor matches `topics[]` against `insights[].topic` by exact
   lowercased equality — two different fields of the same LLM response, with
   nothing forcing them to agree on wording.

   Both are backend-side problems. Until they are fixed the card runs in its
   no-evidence mode, which is the correct behaviour, not a degradation to
   paper over here.
   ══════════════════════════════════════════════════════════════════════ */

// Bands, most urgent first. Exported so consumers can order groups without
// re-deriving the sequence (the card renders them in this order). Only used
// when there is evidence to band ON — see `hasEvidence`.
export const PRIORITY_BANDS = ['high', 'review', 'foundation'];

/**
 * How much of her upload is about this topic.
 *
 * Two things count, and both come from the document rather than from us:
 * the number of teaching points the extractor pulled for it, and whether
 * it turned up in more than one of the files she uploaded. A topic her
 * lecturer spent a whole deck on is a topic her lecturer will test.
 */
const coverageFor = (topic, insights) => {
  const matches = insights.filter(
    i => String(i?.topic || '').toLowerCase() === String(topic).toLowerCase()
  );
  if (matches.length === 0) return { points: 0, files: 0 };
  const points = matches.reduce(
    (sum, i) => sum + (Array.isArray(i.key_points) ? i.key_points.length : 0),
    0
  );
  return { points, files: matches.length };
};

const EMPTY = { topics: [], counts: { high: 0, review: 0, foundation: 0 }, top: null, hasEvidence: false };

/**
 * Order the topics from one upload, when there is anything to order them by.
 *
 * @param {object}   input
 * @param {string[]} input.topics    - topic labels from the upload stream
 * @param {object[]} input.insights  - [{topic, insight, key_points[], context}]
 * @param {number}   input.max       - how many to return (the card shows a short list)
 * @returns {{topics: object[], counts: object, top: object|null, hasEvidence: boolean}}
 *
 * Each returned topic is
 *   { topic, band, score, rank, reason, insight, keyPoints[] }
 * `band` and `reason` are NULL when hasEvidence is false — the caller must
 * render a plain list in that case rather than inventing a heading. When
 * present, `reason` is {key, vars}: an i18n key and its interpolation values,
 * so this module stays free of copy and can be tested without i18n.
 */
export const rankUploadTopics = ({
  topics = [],
  insights = [],
  max = 6,
} = {}) => {
  const clean = [...new Set(
    (topics || []).map(t => String(t || '').trim()).filter(Boolean)
  )];

  if (clean.length === 0) return EMPTY;

  const safeInsights = Array.isArray(insights) ? insights : [];

  // ── Pass 1: measure coverage ───────────────────────────────────────
  const scored = clean.map((topic) => {
    const coverage = coverageFor(topic, safeInsights);
    const match = safeInsights.find(
      i => String(i?.topic || '').toLowerCase() === topic.toLowerCase()
    );

    const coverageScore =
      coverage.points >= 4 ? 2 :
      coverage.points >= 2 ? 1 : 0;
    const multiFile = coverage.files > 1 ? 1 : 0;

    return {
      topic,
      coverage,
      score: coverageScore + multiFile,
      insight: match?.insight || null,
      keyPoints: match?.key_points || [],
    };
  });

  // Did the document tell us anything at all? If not, we are not entitled to
  // an order, a band or a reason — only to the list of topics we extracted.
  const hasEvidence = scored.some(s => s.coverage.points > 0 || s.coverage.files > 1);

  if (!hasEvidence) {
    // Input order, not alphabetical: the extractor's own ordering is at least
    // its sense of what the document leads with, and sorting by name would
    // impose a ranking we explicitly do not have.
    const plain = scored.slice(0, Math.max(1, max)).map((item, index) => ({
      topic: item.topic,
      band: null,
      rank: index,
      score: 0,
      insight: item.insight,
      keyPoints: item.keyPoints,
      reason: null,
    }));
    return {
      topics: plain,
      counts: { high: 0, review: 0, foundation: 0 },
      top: plain[0] || null,
      hasEvidence: false,
    };
  }

  // ── Pass 2: order ──────────────────────────────────────────────────
  // Coverage breaks a score tie ahead of the alphabet: between two equally
  // scored topics, the one her lecturer wrote more about is the better bet.
  const ordered = [...scored].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.coverage.points !== a.coverage.points) return b.coverage.points - a.coverage.points;
    return a.topic.localeCompare(b.topic);
  });

  const shown = ordered.slice(0, Math.max(1, max));

  // ── Pass 3: band + reason ──────────────────────────────────────────
  // Bands are assigned by RANK within this upload, not by absolute score.
  // That is the honest reading: we are telling her which of these her notes
  // cover most, not grading them against all of nursing.
  // One "start here", or two only once the list is long enough that a single
  // flag stops being a shortlist. Never three: at that point the card has
  // stopped prioritising and gone back to being the wall of topics it replaced.
  const highCount = shown.length <= 4 ? 1 : 2;
  const reviewCount = Math.ceil((shown.length - highCount) * 0.6);

  const ranked = shown.map((item, index) => {
    let band;
    if (index < highCount) band = 'high';
    else if (index < highCount + reviewCount) band = 'review';
    else band = 'foundation';

    return {
      topic: item.topic,
      band,
      rank: index,
      score: item.score,
      insight: item.insight,
      keyPoints: item.keyPoints,
      reason: buildReason(item),
    };
  });

  const counts = ranked.reduce(
    (acc, r) => ({ ...acc, [r.band]: acc[r.band] + 1 }),
    { high: 0, review: 0, foundation: 0 }
  );

  return {
    topics: ranked,
    counts,
    // The topic the first lesson is built on. Always the head of the list —
    // the card promises "start here" and the next screen has to honour it.
    top: ranked[0] || null,
    hasEvidence: true,
  };
};

/**
 * The one line under a topic that justifies its band.
 *
 * Every branch quotes something countable from her document. There is no
 * fallback branch that fills the slot with an assertion — a topic we found
 * nothing about gets the claim-free line, and if we found nothing about ANY
 * topic the caller never gets here at all.
 */
function buildReason(item) {
  if (item.coverage.files > 1) {
    return { key: 'uploadInsights.reasonMultiFile', vars: { count: item.coverage.files } };
  }
  if (item.coverage.points >= 4) {
    return { key: 'uploadInsights.reasonHeavyCoverage', vars: { count: item.coverage.points } };
  }
  if (item.coverage.points > 0) {
    return { key: 'uploadInsights.reasonCoverage', vars: { count: item.coverage.points } };
  }
  return { key: 'uploadInsights.reasonPresent', vars: {} };
}

export default rankUploadTopics;
