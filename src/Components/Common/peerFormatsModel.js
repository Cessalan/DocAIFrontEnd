/* ══════════════════════════════════════════════════════════════════════
   PEER FORMATS — how other students do on each question type.

   WHY THIS EXISTS (2026-11-15)
   ────────────────────────────
   A student who gets 2 of 5 select-all questions reads it as "I am bad at
   this". Measured over every student's saved plan answers, it is the normal
   result: multiple choice is answered right 84% of the time, select-all 45%,
   matrix 44%, priority and ordering 30%. Saying so is the one comparison the
   product can make truthfully today, and it is what the question banks nursing
   students already pay for put on every result.

   The numbers are a MEASURED SNAPSHOT, not live. They come from
   `users/{uid}/studyPerformance/{chatId}.formats`, summed over all students
   with the owner account excluded (scripts/peer_formats.py prints this block).
   Re-run it when the question generators change: a prompt change that makes
   select-all easier would leave this table quoting a difficulty that no
   longer exists.

   WHERE IT SHOWS
   ──────────────
   One line under the verdict of a question she just answered (PeerLine.js),
   rendered by the select-all and matrix cards themselves so every screen that
   shows one gets it, and nowhere else. A first version drew bars per type on the results
   screens; the owner's read was "too much cognitive overload", so it became
   something read in one second at the moment she cares.

   Rules:
    - A type is quoted only above MIN_ANSWERS and MIN_STUDENTS.
    - Only types students lose points on (average under HARD_BELOW). "84% get
      this right" under a missed multiple choice question only stings.
    - Never before she answers and never under exam conditions.
    - It shows every time a select-all or matrix verdict shows, retries
      included. Two earlier builds hid it (a miss once per type per quiz,
      then on retries); both times the owner answered a select-all, saw
      nothing and read the feature as broken. Predictable beats clever.
    - Priority and ordering (30%) is measured but NOT shown yet: ordering has
      had contested answer keys, and some of that 30% may be bad keys rather
      than difficulty. Add 'casestudy' to IN_QUIZ_FORMATS once the keys are
      audited.
   ══════════════════════════════════════════════════════════════════════ */

export const PEER_FORMATS = {
  measuredOn: '2026-11-15',
  formats: {
    mcq: { correct: 7819, total: 9267, students: 720 },
    sata: { correct: 1265, total: 2799, students: 574 },
    casestudy: { correct: 638, total: 2108, students: 455 },
    matrix: { correct: 358, total: 805, students: 273 },
  },
};

export const MIN_ANSWERS = 500;
export const MIN_STUDENTS = 100;
export const HARD_BELOW = 60;    // an average under this is a type students lose points on
export const IN_QUIZ_FORMATS = ['sata', 'matrix'];

// The chat exam names the ordering question by its shape; plans call it casestudy.
const ALIAS = { ordering: 'casestudy' };
export const peerKey = (format) => {
  const key = String(format || 'mcq').toLowerCase();
  return ALIAS[key] || key;
};

/** The average for one type, or null when it is unknown or too thin to quote. */
export const peerFormat = (format, table = PEER_FORMATS) => {
  const key = peerKey(format);
  const row = table?.formats?.[key];
  if (!row || row.total < MIN_ANSWERS || row.students < MIN_STUDENTS) return null;
  return { key, percent: Math.round((row.correct / row.total) * 100), answers: row.total, students: row.students };
};

/**
 * The line under the question she just answered, or null.
 *
 * @param {string}  format   the question's type
 * @param {boolean} correct  her answer, fully right or not
 * @returns {null | { kind: 'right' | 'missed', key, percent }}
 */
export const quizPeerLine = ({ format, correct } = {}, table = PEER_FORMATS) => {
  if (typeof correct !== 'boolean') return null;
  const key = peerKey(format);
  if (!IN_QUIZ_FORMATS.includes(key)) return null;
  const peer = peerFormat(key, table);
  if (!peer || peer.percent >= HARD_BELOW) return null;
  return { kind: correct ? 'right' : 'missed', key, percent: peer.percent };
};
