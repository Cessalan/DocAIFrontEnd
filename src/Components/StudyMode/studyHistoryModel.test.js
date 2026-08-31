import {
  buildTopicTrend,
  buildHistoryFeedback,
  sessionsFor,
  alreadySaid,
  TREND_MIN_JUMP,
} from './studyHistoryModel';
import { applyConceptOutcome } from '../../Services/conceptLedger';

const run = (topic, correct, total, day, extra = {}) => ({
  at: `2026-08-${String(day).padStart(2, '0')}T10:00:00.000Z`,
  nodeId: `n${day}`,
  type: 'quiz',
  topic,
  correct,
  total,
  pct: Math.round((correct / total) * 100),
  missed: [],
  conclusion: null,
  ...extra,
});

const ledger = (label, results, startDay = 1) =>
  results.reduce(
    (acc, correct, i) =>
      applyConceptOutcome(acc, {
        label,
        correct,
        at: `2026-08-${String(startDay + i).padStart(2, '0')}T10:00:00.000Z`,
      }),
    {}
  );

describe('sessionsFor', () => {
  it('returns only qualifying sessions on that topic, oldest first', () => {
    const history = [
      run('Cardiac', 4, 5, 9),
      run('Renal', 1, 5, 2),
      run('Cardiac', 2, 5, 1),
      run('Cardiac', 1, 2, 5), // too few items to anchor a trend
    ];
    expect(sessionsFor(history, 'Cardiac').map((h) => h.at)).toEqual([
      '2026-08-01T10:00:00.000Z',
      '2026-08-09T10:00:00.000Z',
    ]);
  });

  it('matches topics case-insensitively', () => {
    expect(sessionsFor([run('cardiac', 4, 5, 1)], 'Cardiac')).toHaveLength(1);
  });
});

describe('buildTopicTrend', () => {
  it('needs more than one session', () => {
    expect(buildTopicTrend([run('Cardiac', 2, 5, 1)], 'Cardiac')).toBeNull();
  });

  it('reports a real climb against her FIRST attempt', () => {
    // The first attempt is the one she remembers being bad at, so it is the
    // comparison that lands — not a rolling average.
    const t = buildTopicTrend(
      [run('Cardiac', 1, 5, 1), run('Cardiac', 3, 5, 5), run('Cardiac', 5, 5, 9)],
      'Cardiac'
    );
    expect(t.firstCorrect).toBe(1);
    expect(t.latestCorrect).toBe(5);
    expect(t.delta).toBe(80);
  });

  it('stays quiet about a climb too small to mean anything', () => {
    // 60% -> 70% is movement, but not the kind worth interrupting her for.
    const t = buildTopicTrend([run('Cardiac', 6, 10, 1), run('Cardiac', 7, 10, 5)], 'Cardiac');
    expect(t).toBeNull();
  });

  it('counts exactly TREND_MIN_JUMP as enough', () => {
    // Inclusive at the bar, matching nodeReadout's IMPROVEMENT_MIN_JUMP.
    expect(TREND_MIN_JUMP).toBe(20);
    const t = buildTopicTrend([run('Cardiac', 3, 5, 1), run('Cardiac', 4, 5, 5)], 'Cardiac');
    expect(t.delta).toBe(20);
  });

  it('never reports a decline', () => {
    // True, and useless as a nudge. Same rule the readiness projection follows.
    expect(
      buildTopicTrend([run('Cardiac', 5, 5, 1), run('Cardiac', 1, 5, 5)], 'Cardiac')
    ).toBeNull();
  });
});

describe('buildHistoryFeedback — priority order', () => {
  it('returns null when there is genuinely nothing to say', () => {
    // The most important behaviour in the file. A sentence after every node
    // is decoration, and students work that out fast.
    expect(buildHistoryFeedback({ history: [], concepts: {}, topic: 'Cardiac' })).toBeNull();
  });

  it('leads with a named misconception she has fixed', () => {
    const concepts = ledger('preload vs afterload', [false, true, true]);
    const out = buildHistoryFeedback({ history: [], concepts, topic: 'Cardiac' });
    expect(out.key).toBe('history.fixedConcept');
    expect(out.params.concept).toBe('preload vs afterload');
  });

  it('falls back to a topic climb when no concept is resolved', () => {
    const out = buildHistoryFeedback({
      history: [run('Cardiac', 1, 5, 1), run('Cardiac', 5, 5, 9)],
      concepts: {},
      topic: 'Cardiac',
    });
    expect(out.key).toBe('history.topicClimb');
    expect(out.params.firstCorrect).toBe(1);
    expect(out.params.latestCorrect).toBe(5);
  });

  it('names something that keeps catching her when there is no good news', () => {
    // Feedback based on history, not praise based on history.
    const concepts = ledger('third spacing', [false, false, true]);
    const out = buildHistoryFeedback({ history: [], concepts, topic: 'Renal' });
    expect(out.key).toBe('history.persistentConcept');
    expect(out.params.count).toBe(2);
  });

  it('will not name a struggle off a single miss', () => {
    const concepts = ledger('third spacing', [false]);
    expect(buildHistoryFeedback({ history: [], concepts, topic: 'Renal' })).toBeNull();
  });
});

describe('not repeating itself', () => {
  it('alreadySaid finds a stored conclusion', () => {
    const history = [run('Cardiac', 4, 5, 1, { conclusion: 'fixed:preload vs afterload' })];
    expect(alreadySaid(history, 'fixed:preload vs afterload')).toBe(true);
    expect(alreadySaid(history, 'fixed:something else')).toBe(false);
    expect(alreadySaid(history, null)).toBe(false);
  });

  it('does not deliver the same insight twice as if it were new', () => {
    const concepts = ledger('preload vs afterload', [false, true, true]);
    const history = [
      run('Cardiac', 4, 5, 9, { conclusion: 'fixed:preload vs afterload' }),
    ];
    const out = buildHistoryFeedback({ history, concepts, topic: 'Cardiac' });
    // Falls through past the already-said fix rather than repeating it.
    expect(out?.key).not.toBe('history.fixedConcept');
  });
});

describe('scoping a fix to this session', () => {
  it('does not claim credit today for a fix proven last week', () => {
    const concepts = ledger('preload vs afterload', [false, true, true], 1);
    const stale = buildHistoryFeedback({
      history: [],
      concepts,
      topic: 'Cardiac',
      since: '2026-08-20T00:00:00.000Z',
    });
    expect(stale?.key).not.toBe('history.fixedConcept');
  });
});
