import {
  buildPlanPreview,
  planArchetype,
  tierForScore,
  PLAN_BUDGETS,
  SPRINT_MAX_DAYS,
  FOCUS_MAX_DAYS,
  GAP_MAX_PCT,
  SOLID_MIN_PCT,
} from './planPreviewModel';

describe('planArchetype', () => {
  it('mirrors the backend thresholds', () => {
    expect(planArchetype(0)).toBe('sprint');
    expect(planArchetype(SPRINT_MAX_DAYS)).toBe('sprint');
    expect(planArchetype(SPRINT_MAX_DAYS + 1)).toBe('focus');
    expect(planArchetype(FOCUS_MAX_DAYS)).toBe('focus');
    expect(planArchetype(FOCUS_MAX_DAYS + 1)).toBe('master');
  });

  it('treats an unknown exam date as master, like the planner does', () => {
    // She skipped the date. The plan must not silently become a sprint.
    expect(planArchetype(null)).toBe('master');
    expect(planArchetype(undefined)).toBe('master');
  });
});

describe('tierForScore', () => {
  it('mirrors the backend buckets, boundaries included', () => {
    expect(tierForScore(null)).toBe('untested');
    expect(tierForScore(GAP_MAX_PCT - 1)).toBe('gap');
    expect(tierForScore(GAP_MAX_PCT)).toBe('shaky');
    expect(tierForScore(SOLID_MIN_PCT - 1)).toBe('shaky');
    expect(tierForScore(SOLID_MIN_PCT)).toBe('solid');
  });

  it('does not turn a garbage score into a confident tier', () => {
    expect(tierForScore('not a number')).toBe('untested');
    expect(tierForScore(undefined)).toBe('untested');
  });
});

describe('buildPlanPreview', () => {
  const topics = ['Heart Failure', 'Fluid & Electrolytes', 'Pharmacology', 'Infection Control'];

  it('returns an empty, non-throwing preview when there are no topics', () => {
    const preview = buildPlanPreview({ topics: [] });
    expect(preview.sessionCount).toBe(0);
    expect(preview.rows).toEqual([]);
  });

  it('accepts plain strings or ranked topic objects', () => {
    const fromStrings = buildPlanPreview({ topics: ['A', 'B'] });
    const fromObjects = buildPlanPreview({ topics: [{ topic: 'A' }, { topic: 'B' }] });
    expect(fromObjects.sessionCount).toBe(fromStrings.sessionCount);
  });

  it('counts an untested plan at two nodes per topic', () => {
    // No diagnostic: every topic is `untested`, whose unit is [lesson, quiz].
    const preview = buildPlanPreview({ topics, diagnostic: null, daysToExam: 20 });
    expect(preview.sessionCount).toBe(topics.length * 2);
  });

  it('gives a weak topic the full five-node unit', () => {
    const preview = buildPlanPreview({
      topics: ['Heart Failure'],
      diagnostic: { 'Heart Failure': 20 },
      daysToExam: 20,
    });
    expect(preview.rows[0].tier).toBe('gap');
    expect(preview.sessionCount).toBe(5);
  });

  it('puts her weakest topic first and her strongest last', () => {
    const preview = buildPlanPreview({
      topics,
      diagnostic: {
        'Heart Failure': 90,
        'Fluid & Electrolytes': 20,
        Pharmacology: 55,
        'Infection Control': 35,
      },
      daysToExam: 20,
    });
    expect(preview.rows[0].topic).toBe('Fluid & Electrolytes'); // 20 — worst gap
    expect(preview.rows[1].topic).toBe('Infection Control');    // 35 — other gap
    expect(preview.rows[preview.rows.length - 1].topic).toBe('Heart Failure'); // solid, last
  });

  it('matches diagnostic labels loosely, so a near-miss is not scored as untested', () => {
    // An unmatched topic silently becomes `untested`, which changes its unit
    // size and therefore the number printed on the card.
    const preview = buildPlanPreview({
      topics: ['Heart Failure'],
      diagnostic: { 'Heart Failure Management': 20 },
      daysToExam: 20,
    });
    expect(preview.rows[0].tier).toBe('gap');
  });

  describe('fitting the plan to the calendar', () => {
    const many = Array.from({ length: 10 }, (_, i) => `Topic ${i}`);

    it('never exceeds the archetype budget', () => {
      [0, 5, 30].forEach((days) => {
        const preview = buildPlanPreview({ topics: many, daysToExam: days });
        const budget = PLAN_BUDGETS[preview.archetype];
        expect(preview.sessionCount).toBeLessThanOrEqual(budget);
      });
    });

    it('collapses the whole tail into one review node for a sprint', () => {
      const preview = buildPlanPreview({
        topics: ['A', 'B', 'C'],
        diagnostic: { A: 20, B: 95, C: 90 },
        daysToExam: 1,
      });
      const review = preview.rows.find(r => r.isCollapsedReview);
      expect(review).toBeTruthy();
      expect(review.nodeCount).toBe(1);
      expect(review.topic).toContain('B');
      expect(review.topic).toContain('C');
    });

    it('drops whole topics rather than truncating a weak one', () => {
      // Truncating loses the closing quiz — the node that carries momentum
      // into the next topic. Half a unit is worth less than no unit.
      const preview = buildPlanPreview({
        topics: many,
        diagnostic: many.reduce((acc, t) => ({ ...acc, [t]: 10 }), {}),
        daysToExam: 1,
      });
      preview.rows.forEach((row) => {
        if (row.tier === 'gap') expect(row.nodeCount).toBe(5);
      });
    });

    it('reports how many topics the calendar squeezed out', () => {
      const preview = buildPlanPreview({ topics: many, daysToExam: 0 });
      expect(preview.trimmed).toBeGreaterThan(0);
      expect(preview.rows.length + preview.trimmed).toBe(many.length);
    });

    it('keeps at least one topic even when a single unit blows the budget', () => {
      const preview = buildPlanPreview({
        topics: many,
        diagnostic: many.reduce((acc, t) => ({ ...acc, [t]: 5 }), {}),
        daysToExam: 0,
      });
      expect(preview.rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('estimates minutes at the same 3-per-node the backend reports', () => {
    const preview = buildPlanPreview({ topics, daysToExam: 20 });
    expect(preview.estimatedMinutes).toBe(preview.sessionCount * 3);
  });

  it('deduplicates topics before counting sessions', () => {
    const preview = buildPlanPreview({ topics: ['Sepsis', 'Sepsis', ' Sepsis '], daysToExam: 20 });
    expect(preview.rows).toHaveLength(1);
  });

  it('is deterministic — the number she is quoted does not move between renders', () => {
    const args = { topics, diagnostic: { Pharmacology: 30 }, daysToExam: 7 };
    expect(buildPlanPreview(args)).toEqual(buildPlanPreview(args));
  });
});
