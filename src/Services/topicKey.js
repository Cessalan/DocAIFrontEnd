/* ══════════════════════════════════════════════════════════════════════
   TOPIC KEY — one name per subject.

   WHY THIS IS ITS OWN FILE
   ────────────────────────
   Every subject label in the app comes back from the question generator,
   and the generator has no memory of what it called things last time. Left
   alone it produces "Sleep and Testosterone", "Testosterone and Sleep" and
   "Sleep Restriction and Testosterone" for one subject, and every store
   that keys on the raw label splits one student's evidence three ways.

   That is not cosmetic. A drill topic needs MIN_EVIDENCE_STRONG answers
   before classifyTopic will say anything about it, so a subject fragmented
   across three keys can be answered nine times and still be invisible to
   the checkpoint — which is exactly how a student ends up being told
   nothing has fallen over yet.

   The matcher used to live in StudySessionService, which meant reaching it
   dragged in Firebase: nodeReadout imports it and NodeTransition.test has
   to mock it out to test pure arithmetic. drillModel.js has no imports at
   all by design, and would have had to give that up to normalise its own
   buckets. So the function moves here — same implementation, no I/O — and
   StudySessionService re-exports it so existing callers are unaffected.

   OVER-MERGING IS THE ACCEPTED FAILURE
   ────────────────────────────────────
   Containment is deliberately aggressive: "Sleep" will absorb "Sleep
   Apnea". That can pool two subjects that a nurse would keep apart. It is
   the right trade anyway, because this is already the rule deciding the
   buckets in users/{uid}/studyPerformance — so the alternative is not
   "finer buckets", it is the SAME answer landing in a merged bucket in one
   store and a split bucket in another, with the two disagreeing about what
   the student knows. One wrong-but-shared key beats two right-but-rival
   ones.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Find the best matching existing topic key, or return the input as-is.
 * Prevents near-duplicate entries like "Testostérone" vs "Sleep and Testosterone".
 *
 * `existingKeys` is searched in order, so callers should pass the keys that
 * already carry evidence first — merging into a bucket with history beats
 * merging into an empty one from a plan.
 */
export const findMatchingTopicKey = (newTopic, existingKeys = []) => {
  if (!newTopic || existingKeys.length === 0) return newTopic;

  // Exact match (case-insensitive)
  const exact = existingKeys.find(k => k.toLowerCase() === newTopic.toLowerCase());
  if (exact) return exact;

  // Strip accents for comparison
  const strip = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const strippedNew = strip(newTopic);

  // Check if one contains the other (after accent stripping)
  for (const existing of existingKeys) {
    const strippedExisting = strip(existing);
    if (strippedExisting.includes(strippedNew) || strippedNew.includes(strippedExisting)) {
      return existing;
    }
  }

  // Check significant word overlap (words > 2 chars)
  const words = (s) => new Set(strip(s).split(/\s+/).filter(w => w.length > 2));
  const newWords = words(newTopic);
  if (newWords.size === 0) return newTopic;

  for (const existing of existingKeys) {
    const existingWords = words(existing);
    const overlap = [...newWords].filter(w => existingWords.has(w)).length;
    const threshold = Math.min(newWords.size, existingWords.size) * 0.5;
    if (overlap > 0 && overlap >= threshold) {
      return existing;
    }
  }

  return newTopic;
};
