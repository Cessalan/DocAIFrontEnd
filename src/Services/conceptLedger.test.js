import {
  applyConceptOutcome,
  selectResolvedConcepts,
  selectActiveStruggles,
  buildProgressStory,
  isResolved,
  isStruggling,
  conceptKey,
  CONCEPT_CAP,
  RESOLVE_STREAK,
} from './conceptLedger';

/** Answer a concept a number of times in sequence. */
const answer = (ledger, label, results, startDay = 1) =>
  results.reduce(
    (acc, correct, i) =>
      applyConceptOutcome(acc, {
        label,
        correct,
        at: `2026-08-${String(startDay + i).padStart(2, '0')}T10:00:00.000Z`,
      }),
    ledger
  );

describe('conceptKey', () => {
  it('normalises casing and whitespace so LLM drift lands on one entry', () => {
    expect(conceptKey('Preload vs Afterload')).toBe('preload vs afterload');
    expect(conceptKey('  preload   vs    afterload ')).toBe('preload vs afterload');
  });

  it('is empty for missing labels', () => {
    expect(conceptKey(undefined)).toBe('');
    expect(conceptKey('   ')).toBe('');
  });
});

describe('applyConceptOutcome', () => {
  it('never fabricates an entry when the label is missing', () => {
    // The important half of this: a coarse fallback key would let the ledger
    // claim a misconception was resolved on unrelated correct answers.
    expect(applyConceptOutcome({}, { label: undefined, correct: true })).toEqual({});
    expect(applyConceptOutcome({}, { label: '  ', correct: false })).toEqual({});
  });

  it('does not mutate the ledger it is given', () => {
    const before = {};
    const after = applyConceptOutcome(before, { label: 'x', correct: true });
    expect(before).toEqual({});
    expect(after).not.toBe(before);
  });

  it('merges variant questions on the same misconception', () => {
    let l = answer({}, 'Preload vs Afterload', [false]);
    l = answer(l, 'preload vs afterload', [true], 2);
    expect(Object.keys(l)).toHaveLength(1);
    expect(l['preload vs afterload'].seen).toBe(2);
  });

  it('keeps the first label seen, so a concept is never renamed mid-session', () => {
    let l = answer({}, 'Preload vs Afterload', [false]);
    l = answer(l, 'PRELOAD VS AFTERLOAD', [true], 2);
    expect(l['preload vs afterload'].label).toBe('Preload vs Afterload');
  });

  it('stamps firstMissedAt once and never moves it', () => {
    let l = answer({}, 'c', [false, true, false]);
    expect(l.c.firstMissedAt).toBe('2026-08-01T10:00:00.000Z');
  });

  it('resets the streak on a miss', () => {
    const l = answer({}, 'c', [false, true, true, false]);
    expect(l.c.consecutiveCorrect).toBe(0);
    expect(isResolved(l.c)).toBe(false);
  });

  it('counts correct answers after the miss — the "3 new scenarios" number', () => {
    const l = answer({}, 'c', [true, false, true, true, true]);
    expect(l.c.correctAfterMiss).toBe(3);
    expect(l.c.correct).toBe(4); // the pre-miss win is not part of the story
  });
});

describe('resolution rule', () => {
  it('needs a miss first — a concept never missed is not "resolved"', () => {
    const l = answer({}, 'c', [true, true, true]);
    expect(isResolved(l.c)).toBe(false);
    expect(isStruggling(l.c)).toBe(false);
    expect(selectResolvedConcepts(l)).toHaveLength(0);
  });

  it('needs RESOLVE_STREAK in a row — one lucky answer is not proof', () => {
    const one = answer({}, 'c', [false, true]);
    expect(isResolved(one.c)).toBe(false);
    expect(isStruggling(one.c)).toBe(true);

    const two = answer({}, 'c', [false, true, true]);
    expect(isResolved(two.c)).toBe(true);
    expect(isStruggling(two.c)).toBe(false);
    expect(RESOLVE_STREAK).toBe(2);
  });

  it('scopes to a window so today does not take credit for last week', () => {
    const l = answer({}, 'c', [false, true, true]); // last correct 2026-08-03
    expect(selectResolvedConcepts(l, '2026-08-03T00:00:00.000Z')).toHaveLength(1);
    expect(selectResolvedConcepts(l, '2026-08-04T00:00:00.000Z')).toHaveLength(0);
  });
});

describe('selectActiveStruggles', () => {
  it('ranks by miss count, not accuracy', () => {
    // 4 misses of 6 is more urgent to name than 1 miss of 1, though the
    // second has the worse percentage.
    // Note the trailing miss: ending on two correct answers would RESOLVE
    // this concept, and a resolved concept is no longer a struggle.
    let l = answer({}, 'many misses', [false, false, false, true, true, false]);
    l = applyConceptOutcome(l, { label: 'one miss', correct: false, at: '2026-08-09T10:00:00.000Z' });
    const out = selectActiveStruggles(l);
    expect(out[0].label).toBe('many misses');
  });

  it('drops a concept once it is resolved', () => {
    const l = answer({}, 'c', [false, true, true]);
    expect(selectActiveStruggles(l)).toHaveLength(0);
  });
});

describe('buildProgressStory', () => {
  it('returns null rather than dressing up a flat day', () => {
    expect(buildProgressStory({}, undefined)).toBeNull();
    expect(buildProgressStory(answer({}, 'c', [false, true]))).toBeNull();
  });

  it('names the concept and how many times she has since proven it', () => {
    const l = answer({}, 'Preload vs Afterload', [false, true, true, true]);
    const story = buildProgressStory(l);
    expect(story.label).toBe('Preload vs Afterload');
    expect(story.provenCount).toBe(3);
    expect(story.totalResolved).toBe(1);
  });

  it('leads with the most recent fix and lists the rest', () => {
    let l = answer({}, 'older', [false, true, true], 1);
    l = answer(l, 'newer', [false, true, true], 10);
    const story = buildProgressStory(l);
    expect(story.label).toBe('newer');
    expect(story.alsoResolved).toEqual(['older']);
  });
});

describe('eviction', () => {
  const fill = (n, correct) => {
    let l = {};
    for (let i = 0; i < n; i++) {
      l = applyConceptOutcome(l, {
        label: `c${i}`,
        correct,
        at: `2026-08-01T${String(i % 24).padStart(2, '0')}:00:00.000Z`,
      });
    }
    return l;
  };

  it('holds the ledger at the cap', () => {
    expect(Object.keys(fill(CONCEPT_CAP + 25, true))).toHaveLength(CONCEPT_CAP);
  });

  it('drops never-missed entries before ones carrying a miss', () => {
    // A miss is the raw material for the progress story, so it outlives a
    // clean entry even when it is older.
    let l = applyConceptOutcome({}, {
      label: 'struggled',
      correct: false,
      at: '2026-07-01T00:00:00.000Z', // oldest by far
    });
    for (let i = 0; i < CONCEPT_CAP + 5; i++) {
      l = applyConceptOutcome(l, {
        label: `clean${i}`,
        correct: true,
        at: `2026-08-02T${String(i % 24).padStart(2, '0')}:00:00.000Z`,
      });
    }
    expect(Object.keys(l)).toHaveLength(CONCEPT_CAP);
    expect(l.struggled).toBeDefined();
  });
});
