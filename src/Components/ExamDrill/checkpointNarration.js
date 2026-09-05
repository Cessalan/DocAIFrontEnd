/* ══════════════════════════════════════════════════════════════════════
   CHECKPOINT NARRATION — the drill's findings as a tutor talking.

   WHY THIS REPLACED THE GRID
   ──────────────────────────
   The first checkpoint was labelled sections with scores pinned to the
   right: WEAK SPOTS / Adult Sleep Recommendations / 0/2. Every number in
   it was true and the whole thing read as a dashboard, for the same
   structural reasons knowledgeNarration.js already documented for the
   knowledge map:

     1. Headed lists with figures are the shape of a REPORT. Someone who
        had just watched you answer five questions would not hand you a
        table of your own scores.
     2. "0/2" is the least useful true thing we know. It tells her she
        got them wrong, which she was there for. What she cannot see for
        herself is the PATTERN — and the pattern is the only reason to
        interrupt her drilling to say anything at all.
     3. Everything landing at once means nothing was noticed; it was
        simply already computed.

   So the checkpoint is one narration. The tutor speaks, and evidence
   appears as it is mentioned. Same model underneath — buildCheckpoint in
   drillModel.js is untouched — but delivered in the order a person would
   deliver it.

   THE ORDERING RULE differs from the knowledge map on purpose. The map
   opens on strengths because it follows a diagnostic the student was
   anxious about. The drill opens on strengths too WHEN THERE ARE ANY,
   but the format gap outranks everything else the moment it exists: it
   reframes every other finding on the screen, and a student who reads
   "weak on Cardio" without knowing the real problem is format will go
   and re-read her Cardio notes, which will not help her.

   Beats are {key, fallback, params, reveals} — the same contract
   useTypedBeats and revealedAt already consume, so the drill inherits
   the study plan's typing and reveal behaviour for free, and the copy
   stays in i18n where French can reach it.
   ══════════════════════════════════════════════════════════════════════ */

import { joinTopics } from '../StudyMode/coachMessageModel';

/** Topics named aloud in one beat. Past two it stops sounding like speech. */
const MAX_SPOKEN = 2;

/** Enough answers that the tutor stops hedging about how early it is. */
const CONFIDENT_AFTER = 10;

/**
 * A concept label we are willing to say out loud.
 *
 * The generator is asked for "the single concept being tested" and mostly
 * obliges, but it sometimes returns a whole sentence, which the backend then
 * truncates at 120 characters (quiztools.py). Reading one of those back to a
 * student — "you keep missing The American Academy of Sleep Medicine and
 * Sleep Research Society recommend 7-9 hours of sleep per night for healthy
 * adu" — is worse than saying nothing.
 *
 * Same doctrine as conceptLedger: never fabricate, and skip what we cannot
 * trust rather than dressing it up.
 */
export const MAX_CONCEPT_LABEL = 48;

export const isSpeakableConcept = (label) => {
  const text = String(label || '').trim();
  if (!text || text.length > MAX_CONCEPT_LABEL) return false;
  // A sentence, not a label: ends in a full stop, or reads as a clause.
  if (/[.!?]$/.test(text)) return false;
  return text.split(/\s+/).length <= 7;
};

const topicNames = (items = []) => items.slice(0, MAX_SPOKEN).map((i) => i.topic);

/**
 * Turn a checkpoint into what the tutor says.
 *
 * @param {Object} checkpoint  from buildCheckpoint()
 * @returns {Array<{key, fallback, params, reveals}>}
 */
export const buildCheckpointNarration = (checkpoint) => {
  if (!checkpoint || !checkpoint.answered) return [];

  const {
    answered, strengths = [], provisional = [], inconsistent = [], weak = [],
    formatGap = null, struggling = false, firstHardWin = null,
    misconceptions = [], recommendation = null,
  } = checkpoint;

  const beats = [];

  /* Beat 1 — acknowledge the work before reporting on it. She answered
     these for us; opening straight into findings treats that as data
     collection rather than as effort. */
  beats.push(
    answered >= CONFIDENT_AFTER
      ? {
          key: 'drill.beatAckMany',
          fallback: "Right — {{count}} questions in. I have a clear picture now.",
          params: { count: answered },
          reveals: null,
        }
      : {
          key: 'drill.beatAck',
          fallback: "Okay — {{count}} questions in. That is already enough to see something.",
          params: { count: answered },
          reveals: null,
        }
  );

  /* Beat 2 — strengths, when they have been earned across more than one
     format. Said first because nobody hears a correction delivered cold. */
  if (strengths.length > 0) {
    beats.push({
      key: strengths.length === 1 ? 'drill.beatStrongOne' : 'drill.beatStrongMany',
      fallback:
        strengths.length === 1
          ? 'You have properly shown me {{topics}} — that one is yours.'
          : 'You have properly shown me these: {{topics}}.',
      params: { topics: joinTopics(topicNames(strengths)) },
      reveals: 'strong',
    });
  }

  /* Beat 3 — the format gap. The single most valuable thing this screen
     can say, so it gets its own beat and the numbers live inside the
     sentence rather than in a panel above it. It outranks the topic
     findings because it applies to all of them at once. */
  if (formatGap) {
    beats.push({
      key: 'drill.beatFormatGap',
      fallback:
        'Here is the thing, though. You know this material — it is the format catching you out. {{mcq}}% on multiple choice, {{hard}}% the moment it turns into select-all or a case study.',
      params: {
        mcq: Math.round(formatGap.mcq.accuracy * 100),
        hard: Math.round(formatGap.hard.accuracy * 100),
      },
      reveals: 'gap',
    });
  } else if (struggling) {
    /* The gap did not survive its own evidence test — either there is none,
       or multiple choice is failing too, which is what makes "you know this
       material" a thing we cannot say. Without this beat she fell through
       every finding and was told nothing had fallen over yet, on one correct
       answer out of five. Naming a format problem she does not have would
       send her off to practise the wrong skill entirely. */
    beats.push({
      key: 'drill.beatStruggling',
      fallback:
        'Here is the straight version, though. Too much of this is going wrong to blame the format — the material itself has not landed yet, and that is the part we work on.',
      params: {},
      reveals: null,
    });
  } else if (provisional.length > 0) {
    /* No gap proven yet, but she is running on multiple choice alone.
       Say so plainly instead of calling it a strength. */
    beats.push({
      key: 'drill.beatProvisional',
      fallback:
        'I would not call {{topics}} safe yet — you have only met that as multiple choice, which is the easy version.',
      params: { topics: joinTopics(topicNames(provisional)) },
      reveals: 'provisional',
    });
  }

  /* Beat 3b — the first select-all or case study she has ever got fully
     right, when it happened in the block just finished.

     Placed straight after the format sentence on purpose: that sentence has
     just read her hard-format accuracy out loud, and 8% with no context reads
     as "still hopeless" when what it actually records is her first one landing.
     Every other line on this screen is a cumulative snapshot, so without this
     the drill cannot see anything she does between checkpoints — which is the
     whole stretch she just spent working. Deliberately a fact and not a trend:
     see firstHardWinInBlock for why "you are improving" would be a lie here. */
  if (firstHardWin) {
    beats.push({
      key: 'drill.beatFirstHardWin',
      fallback:
        'One thing did change in there, though: your first {{format}} answered fully right. That is the first evidence these are doable for you at all.',
      params: { format: firstHardWin.format },
      reveals: null,
    });
  }

  /* Beat 4 — where it actually falls apart. Never a score, never a list
     of failures. */
  if (weak.length > 0) {
    beats.push({
      key: 'drill.beatWeak',
      fallback: 'Where it actually falls apart is {{topics}}.',
      params: { topics: joinTopics(topicNames(weak)) },
      reveals: 'weak',
    });
  }

  /* Beat 5 — inconsistency is a different problem from weakness and gets
     its own sentence, because the fix is different too. */
  if (inconsistent.length > 0) {
    beats.push({
      key: 'drill.beatInconsistent',
      fallback: '{{topics}} is not settled either — right sometimes, wrong sometimes.',
      params: { topics: joinTopics(topicNames(inconsistent)) },
      reveals: 'inconsistent',
    });
  }

  /* Beat 6 — a misconception she keeps walking back into. Only named when
     the label is something a person would actually say. */
  const speakable = misconceptions.filter((m) => isSpeakableConcept(m.label));
  if (speakable.length > 0) {
    beats.push({
      key: 'drill.beatMisconception',
      fallback: 'And you keep coming back to the same idea: {{concept}}.',
      params: { concept: speakable[0].label },
      reveals: 'misconception',
    });
  } else if (misconceptions.length > 0) {
    // We can see the repetition but cannot name it cleanly — say the true
    // part rather than reading a truncated sentence back to her.
    beats.push({
      key: 'drill.beatMisconceptionUnnamed',
      fallback: 'The same misunderstanding has caught you more than once now.',
      params: {},
      reveals: null,
    });
  }

  /* Nothing has broken yet. Say that honestly, without promoting it into
     a readiness claim we have not earned. */
  if (beats.length === 1) {
    beats.push({
      key: 'drill.beatNothingYet',
      fallback:
        'Nothing has fallen over yet — but that is not the same as being ready. Let us keep going until it tells us something.',
      params: {},
      reveals: null,
    });
  }

  /* Final beat — what we do about it. */
  const rec = recommendationBeat(recommendation);
  if (rec) beats.push(rec);

  return beats;
};

/**
 * The closing instruction. Has to FOLLOW from what was just said — a
 * recommendation that ignores the finding teaches her the finding was
 * decoration (the rule nodeReadout.js is built around).
 */
export const recommendationBeat = (recommendation) => {
  if (!recommendation) return null;

  switch (recommendation.kind) {
    case 'format':
      return {
        key: 'drill.beatRecFormat',
        fallback: 'So that is what we fix. More {{format}} next — that is where the marks are going.',
        params: { format: recommendation.format },
        reveals: 'rec',
      };
    case 'weakTopic':
      return {
        key: 'drill.beatRecWeak',
        fallback: 'Next we stay on {{topic}} until it holds. This is a real gap, not a bad run.',
        params: { topic: recommendation.topic },
        reveals: 'rec',
      };
    case 'misconception':
      return {
        key: 'drill.beatRecMisconception',
        fallback: 'Next few are aimed straight at that.',
        params: {},
        reveals: 'rec',
      };
    case 'inconsistentTopic':
      return {
        key: 'drill.beatRecInconsistent',
        fallback: 'Let us settle {{topic}} one way or the other.',
        params: { topic: recommendation.topic },
        reveals: 'rec',
      };
    case 'proveIt':
      return {
        key: 'drill.beatRecProveIt',
        fallback: 'Next I test {{topic}} properly, the way your exam will.',
        params: { topic: recommendation.topic },
        reveals: 'rec',
      };
    case 'foundations':
      return {
        key: 'drill.beatRecFoundations',
        fallback:
          'So we go back to the base of it — plainer questions, one idea at a time, until I can see which parts are actually missing.',
        params: {},
        reveals: 'rec',
      };
    case 'newTopic':
      return {
        key: 'drill.beatRecNewTopic',
        fallback: 'Nothing left to prove here — we move to {{topic}}.',
        params: { topic: recommendation.topic },
        reveals: 'rec',
      };
    default:
      return {
        key: 'drill.beatRecBroaden',
        fallback: 'We widen out across the rest of your material.',
        params: {},
        reveals: 'rec',
      };
  }
};

/** Which evidence sections are visible once `stage` beats have started. */
export const revealedAt = (beats, stage) => {
  const shown = new Set();
  beats.slice(0, stage + 1).forEach((b) => {
    if (b.reveals) shown.add(b.reveals);
  });
  return shown;
};
