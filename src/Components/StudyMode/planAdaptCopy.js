/**
 * planAdaptCopy — the words for a plan change, from the data planAdaptModel
 * returns.
 *
 * planAdaptModel keeps every reason as data (counts, dates, her choice) so a
 * reason can never say more than the evidence. This module is the only place
 * that turns that data into a sentence, and it says one thing per changed
 * step, in her terms: what she chose, what she scored, when she last saw it.
 * A reason it can't phrase from the data returns null and the row shows none.
 *
 * Pure: PlanNextSteps and the plan overview call it, it reads nothing.
 */
import { CHANGE } from './planAdaptModel';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Longest quoted choice, so a long option can't push the row to three lines. */
export const CHOICE_SHOWN_MAX = 60;

const clip = (text) => {
  const clean = String(text || '').trim();
  return clean.length > CHOICE_SHOWN_MAX ? `${clean.slice(0, CHOICE_SHOWN_MAX - 1)}…` : clean;
};

const formatName = (format, t) => t(`planAdapt.format.${format}`, { defaultValue: format });

/** "Thursday" within the week, "Oct 28" beyond it. */
export const whenLabel = (iso, { language = 'en', now = new Date() } = {}) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.floor((now.getTime() - date.getTime()) / DAY_MS);
  const options = days < 7 ? { weekday: 'long' } : { month: 'short', day: 'numeric' };
  return new Intl.DateTimeFormat(language, options).format(date);
};

/**
 * One line for one change, or null.
 *
 * @param {Object} change   an entry of planAdaptModel's `changes`
 * @param {Object} opts     { t, language, now }
 */
export const changeReason = (change, { t, language = 'en', now = new Date() } = {}) => {
  const reason = change?.reason || {};
  switch (change?.kind) {
    case CHANGE.MIXUP: {
      const chosen = Array.isArray(reason.chosen) ? reason.chosen.map(clip).join(', ') : clip(reason.chosen);
      return chosen ? t('planAdapt.why.mixup', { chosen, defaultValue: 'You chose “{{chosen}}”' }) : null;
    }
    case CHANGE.FORMAT:
      if (!reason.total || !reason.bestTotal) return null;
      return t('planAdapt.why.format', {
        correct: reason.correct, total: reason.total, format: formatName(reason.format, t),
        bestCorrect: reason.bestCorrect, bestTotal: reason.bestTotal, best: formatName(reason.bestFormat, t),
        defaultValue: 'Now {{format}}: {{correct}} of {{total}} there, {{bestCorrect}} of {{bestTotal}} on {{best}}',
      });
    case CHANGE.SKIP:
      if (!reason.total) return null;
      return reason.source === 'check'
        ? t('planAdapt.why.skipCheck', { correct: reason.correct, total: reason.total,
          defaultValue: 'Skipped: {{correct}} of {{total}} in your readiness check' })
        : t('planAdapt.why.skipPractice', { correct: reason.correct, total: reason.total,
          defaultValue: 'Skipped: {{correct}} of {{total}} in practice' });
    case CHANGE.RETURN: {
      const day = whenLabel(reason.lastAt, { language, now });
      if (!day || !reason.total) return null;
      return t('planAdapt.why.return', { day, correct: reason.correct, total: reason.total,
        defaultValue: 'Last practised {{day}}: {{correct}} of {{total}}' });
    }
    case CHANGE.MOVED:
      if (!reason.total) return null;
      return reason.direction === 'up'
        ? t('planAdapt.why.movedUp', { correct: reason.correct, total: reason.total,
          defaultValue: 'Moved up: {{correct}} of {{total}} so far' })
        : t('planAdapt.why.movedDown', { correct: reason.correct, total: reason.total,
          defaultValue: 'Moved later: {{correct}} of {{total}} so far' });
    default:
      return null;
  }
};

/** { [nodeId]: line } for the changes that can be phrased. */
export const reasonsById = (changes = [], opts = {}) => {
  const out = {};
  (changes || []).forEach((change) => {
    const line = changeReason(change, opts);
    if (line && change.nodeId && !out[change.nodeId]) out[change.nodeId] = line;
  });
  return out;
};

/**
 * The one-line total under the list: what the change adds up to.
 * "2 steps added from your answers, 1 removed". Moves and switches are only
 * named when nothing was added or removed, so the line stays one line.
 */
export const changeSummary = (changes = [], t) => {
  const count = (kind) => (changes || []).filter((c) => c.kind === kind && !c.inReserve).length;
  const added = count(CHANGE.MIXUP) + count(CHANGE.RETURN);
  const removed = count(CHANGE.SKIP);
  const reshaped = count(CHANGE.MOVED) + count(CHANGE.FORMAT);
  if (added && removed) {
    return t('planAdapt.summary.addedRemoved', { count: added, removed,
      defaultValue: '{{count}} steps added from your answers, {{removed}} removed' });
  }
  if (added) return t('planAdapt.summary.added', { count: added, defaultValue: '{{count}} steps added from your answers' });
  if (removed) return t('planAdapt.summary.removed', { count: removed, defaultValue: '{{count}} steps removed: you already know them' });
  if (reshaped) return t('planAdapt.summary.reshaped', { count: reshaped, defaultValue: '{{count}} steps changed from your answers' });
  return null;
};
