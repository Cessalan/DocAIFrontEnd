/* ══════════════════════════════════════════════════════════════════════
   QUIZ WAIT — what the quiz says while its questions are being made.

   WHY THIS EXISTS (2026-10-06)
   ────────────────────────────
   A source-backed quiz takes several seconds to tens of seconds before its
   first question: the backend reads the material, picks the concepts, then
   writes every question in parallel. The student saw a bare paper skeleton
   for all of it, and before that a typing dot in the chat, so the wait felt
   like a stall.

   THE RULE
   ────────
   Every line names work that is actually happening. The stage comes from the
   backend's own events, not a timer:
     material_analyzing → 'reading'
     quiz_planning      → 'choosing'
     quiz_generating    → 'writing'
   Time is used only to admit a stage is slow, never to advance a stage. The
   rotating detail line names subtopics from her own material that are in the
   scope of this quiz; with none, there is no detail line rather than filler.
   ══════════════════════════════════════════════════════════════════════ */

export const WAIT_STAGES = ['reading', 'choosing', 'writing'];
export const ROTATE_MS = 3200;
export const SLOW_MS = { reading: 20000, choosing: 20000, writing: 25000 };

const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The subtopics this quiz draws on, in her material's order.
 * `quizTopic` is the scope string the backend builds, a list joined by
 * commas or semicolons. A part that names a main topic expands to that
 * topic's subtopics; any other part is already a subtopic and is kept as is.
 */
export function scopeSubtopics(quizTopic, groups = [], limit = 8) {
  const parts = String(quizTopic || '').split(/[;,·]/).map(p => p.trim()).filter(Boolean);
  const byTitle = new Map((Array.isArray(groups) ? groups : [])
    .filter(g => g && g.title).map(g => [norm(g.title), (g.subtopics || []).filter(Boolean)]));
  const out = [];
  for (const part of parts) {
    const subs = byTitle.get(norm(part));
    for (const item of (subs && subs.length ? subs : [part])) {
      if (!out.some(existing => norm(existing) === norm(item))) out.push(item);
    }
  }
  return out.slice(0, limit);
}

/**
 * The two lines to show. Returns i18n keys with their variables, so the
 * component translates and this stays testable without i18next.
 *   headline: the stage, always present.
 *   detail:   a subtopic from her notes, rotating; or the slow-stage note.
 */
export function waitCopy({ stage = 'writing', elapsedMs = 0, total = 0, current = 0, subtopics = [] } = {}) {
  const known = WAIT_STAGES.includes(stage) ? stage : 'writing';
  let headline;
  if (known === 'reading') headline = { key: 'quizWait.reading' };
  else if (known === 'choosing') headline = { key: 'quizWait.choosing' };
  else if (current > 0 && total > 0) headline = { key: 'quizWait.writingOne', vars: { current, total } };
  else headline = { key: 'quizWait.writing', vars: { count: total > 0 ? total : 1 } };

  const slow = elapsedMs >= SLOW_MS[known];
  let detail = null;
  if (slow) {
    detail = { key: known === 'reading' ? 'quizWait.readingSlow' : 'quizWait.slow' };
  } else if (subtopics.length > 0) {
    const topic = subtopics[Math.floor(elapsedMs / ROTATE_MS) % subtopics.length];
    detail = { key: 'quizWait.fromNotes', vars: { topic } };
  }
  return { headline, detail, slow };
}
