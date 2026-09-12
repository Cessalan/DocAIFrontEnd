/* ══════════════════════════════════════════════════════════════════════
   NCLEX HANDOFF — carrying a landing-page result into /nclex.

   THE SHAPE OF THE PROBLEM
   ────────────────────────
   A student finishes four pharmacology questions on a public landing page,
   presses "Practice my weak areas", signs up, and lands in the app. Three
   things have to survive that wall:

     1. what she did          → the arrival screen shows it back to her
     2. what it is evidence of → her answers go into the attempt log
     3. what to do about it    → the generator is told what she missed

   The intent object built by SeoPractice/seoToNclex.js carries all three.
   This file only moves it: browser storage on the way in, Firestore once
   there is a uid to attach it to.

   WHY DYNAMIC IMPORTS
   ───────────────────
   The landing pages are prerendered to static HTML and must stay small;
   pulling firebase into their bundle for the one student who presses the
   CTA would slow the page for everyone who did not. Same pattern as
   SeoMiniProductService.

   COMMIT IS IDEMPOTENT
   ────────────────────
   `commitIntent` can run twice for one visit — from continueSeo when she is
   already signed in, and again from the post-auth hook. `seedAttempts`
   writes deterministic ids and the meta write is a merge, so the second run
   changes nothing. The local record remembers which uid it was committed
   for so we do not even make the round trip.
   ══════════════════════════════════════════════════════════════════════ */

import { readLocal, writeLocal } from './SeoMiniProductService';

const KEY = 'nclexIntent';

/** How long a handoff stays actionable. After this the arrival screen
    redirects home rather than greeting her with last month's result. */
export const INTENT_TTL_MS = 14 * 86400000;

export const readIntent = () => {
  const intent = readLocal(KEY);
  if (!intent || !intent.at) return null;
  if (Date.now() - intent.at > INTENT_TTL_MS) return null;
  return intent;
};

export const writeIntent = (intent) => writeLocal(KEY, intent);

export const clearIntent = () => writeLocal(KEY, null);

/** The part of the intent worth persisting beside her profile. The raw
    attempts are already in the log, so they are not duplicated here. */
export const contextFromIntent = (intent) =>
  intent
    ? {
        at: intent.at,
        sourcePage: intent.sourcePage,
        cluster: intent.cluster,
        kind: intent.kind,
        examTrack: intent.examTrack || null,
        subject: intent.subject || null,
        area: intent.area || null,
        category: intent.category || null,
        missedConcepts: intent.missedConcepts || [],
        strongest: intent.strongest || null,
        score: intent.score || null,
        plan: intent.plan || null,
      }
    : null;

/**
 * Attach the pending intent to a signed-in user: seed her answers into the
 * attempt log and store the context the generator reads.
 *
 * Returns the intent it committed (or null). Never throws — a failed commit
 * must not stop her reaching the arrival screen, which can still render from
 * browser storage.
 */
export const commitIntent = async (uid) => {
  const intent = readIntent();
  if (!uid || !intent) return null;
  if (intent.committedFor === uid) return intent;

  try {
    const { seedAttempts, saveMeta } = await import('./NclexService');

    if (intent.attempts?.length) {
      await seedAttempts(uid, intent.attempts, `seo-${intent.sourcePage}-${intent.at}`, intent.at);
    }

    const patch = { seoContext: contextFromIntent(intent) };
    if (intent.plan) {
      if (intent.plan.examDate) patch.examDate = intent.plan.examDate;
      if (intent.examTrack) patch.examTrack = intent.examTrack;
      if (intent.plan.minutes) patch.dailyStudyMinutes = intent.plan.minutes;
    } else if (intent.examTrack) {
      patch.examTrack = intent.examTrack;
    }
    await saveMeta(uid, patch);

    writeIntent({ ...intent, committedFor: uid });
    return intent;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[nclex] commitIntent failed', err);
    return intent;
  }
};

/** Query string for the practice session an intent proposes. */
export const sessionParamsFor = (intent, count = 10) => {
  const params = new URLSearchParams();
  if (intent?.subject) params.set('subject', intent.subject);
  if (intent?.area) params.set('area', intent.area);
  params.set('count', String(count));
  params.set('from', intent?.kind === 'planner' ? 'plan' : 'seo');
  return params.toString();
};
