import { buildRollup, normalizeRow, netSentiment, DID_WELL_PERCENT } from './satisfactionRollup';

const row = (over = {}) => ({
  id: Math.random().toString(36).slice(2),
  surface: 'quiz',
  sentiment: 1,
  reasons: [],
  comment: null,
  createdAt: new Date('2026-08-20T10:00:00Z'),
  context: { scored: true, scorePercent: 80, source: 'study_node' },
  ...over
});

describe('normalizeRow', () => {
  it('unwraps a Firestore Timestamp', () => {
    const d = new Date('2026-08-01T00:00:00Z');
    const r = normalizeRow({ timestamp: { toDate: () => d }, surface: 'quiz' });
    expect(r.at).toEqual(d);
  });

  it('falls back to createdAt when there is no server timestamp', () => {
    const r = normalizeRow({ createdAt: '2026-08-02T00:00:00Z' });
    expect(r.at.toISOString()).toBe('2026-08-02T00:00:00.000Z');
  });

  it('survives a row with nothing on it', () => {
    const r = normalizeRow({});
    expect(r.surface).toBe('unknown');
    expect(r.sentiment).toBeNull();
    expect(r.reasons).toEqual([]);
    expect(r.at).toBeNull();
  });

  it('treats a whitespace-only comment as no comment', () => {
    expect(normalizeRow({ comment: '   ' }).comment).toBeNull();
  });

  it('coerces a non-array reasons field rather than trusting it', () => {
    expect(normalizeRow({ reasons: 'wrong_answer' }).reasons).toEqual([]);
  });
});

describe('netSentiment', () => {
  it('runs -100 to +100', () => {
    expect(netSentiment({ positive: 10, negative: 0, rated: 10 })).toBe(100);
    expect(netSentiment({ positive: 0, negative: 10, rated: 10 })).toBe(-100);
    expect(netSentiment({ positive: 5, negative: 5, rated: 10 })).toBe(0);
  });

  it('is null rather than zero when nothing has been rated', () => {
    // Zero means "evenly split", not "no data" — conflating them would show a
    // brand-new surface as neutral instead of empty.
    expect(netSentiment({ positive: 0, negative: 0, rated: 0 })).toBeNull();
  });
});

describe('buildRollup — overall', () => {
  it('counts positives and negatives', () => {
    const { overall } = buildRollup([
      row({ sentiment: 1 }), row({ sentiment: 1 }), row({ sentiment: -1 })
    ]);
    expect(overall).toMatchObject({ total: 3, positive: 2, negative: 1, rated: 3, net: 33 });
  });

  it('counts a sentiment-less row in the total but not in the rate', () => {
    const { overall, malformed } = buildRollup([
      row({ sentiment: 1 }), row({ sentiment: undefined })
    ]);
    expect(overall.total).toBe(2);
    expect(overall.rated).toBe(1);
    expect(overall.net).toBe(100);
    expect(malformed).toBe(1);
  });

  it('returns an empty but well-formed rollup for no rows', () => {
    const r = buildRollup([]);
    expect(r.overall).toMatchObject({ total: 0, net: null });
    expect(r.bySurface).toEqual([]);
    expect(r.byReason).toEqual([]);
    expect(r.comments).toEqual([]);
  });
});

describe('buildRollup — by surface', () => {
  it('ranks the worst surface first, because the list exists to point at a fix', () => {
    const { bySurface } = buildRollup([
      row({ surface: 'quiz', sentiment: 1 }),
      row({ surface: 'quiz', sentiment: 1 }),
      row({ surface: 'study_block', sentiment: -1 }),
      row({ surface: 'study_block', sentiment: -1 }),
      row({ surface: 'flashcard', sentiment: 1 }),
      row({ surface: 'flashcard', sentiment: -1 })
    ]);
    expect(bySurface.map((s) => s.surface)).toEqual(['study_block', 'flashcard', 'quiz']);
    expect(bySurface[0].net).toBe(-100);
    expect(bySurface[2].net).toBe(100);
  });
});

describe('buildRollup — reasons', () => {
  it('counts every reason on a row, not just the first', () => {
    // A student reporting a wrong answer that is also confusing has two
    // complaints; a single-valued tally would discard one.
    const { byReason } = buildRollup([
      row({ sentiment: -1, reasons: ['wrong_answer', 'confusing_wording'] }),
      row({ sentiment: -1, reasons: ['wrong_answer'] })
    ]);
    expect(byReason).toEqual([
      { reason: 'wrong_answer', count: 2, shareOfNegative: 100 },
      { reason: 'confusing_wording', count: 1, shareOfNegative: 50 }
    ]);
  });

  it('ignores reasons attached to a positive row', () => {
    const { byReason } = buildRollup([row({ sentiment: 1, reasons: ['wrong_answer'] })]);
    expect(byReason).toEqual([]);
  });
});

describe('buildRollup — defect vs frustration', () => {
  it('separates negatives from students who did well', () => {
    const { defect } = buildRollup([
      // Did well and still unhappy → a report about the content.
      row({ sentiment: -1, context: { scored: true, scorePercent: 90 } }),
      row({ sentiment: 1, context: { scored: true, scorePercent: 95 } }),
      // Did badly and unhappy → most likely frustration at the result.
      row({ sentiment: -1, context: { scored: true, scorePercent: 20 } }),
      row({ sentiment: -1, context: { scored: true, scorePercent: 30 } })
    ]);
    expect(defect).toMatchObject({
      wellNegative: 1, wellTotal: 2, wellRate: 50,
      badlyNegative: 2, badlyTotal: 2, badlyRate: 100
    });
  });

  it('puts the threshold score on the "did well" side', () => {
    const { defect } = buildRollup([
      row({ sentiment: -1, context: { scored: true, scorePercent: DID_WELL_PERCENT } })
    ]);
    expect(defect.wellTotal).toBe(1);
    expect(defect.badlyTotal).toBe(0);
  });

  it('excludes unscored content entirely — a lesson has no score to be frustrated by', () => {
    const { defect } = buildRollup([
      row({ sentiment: -1, surface: 'study_block', context: { scored: false, scorePercent: null } })
    ]);
    expect(defect.wellTotal).toBe(0);
    expect(defect.badlyTotal).toBe(0);
    expect(defect.wellRate).toBeNull();
  });
});

describe('buildRollup — comments', () => {
  it('returns newest first and does not truncate', () => {
    const long = 'x'.repeat(500);
    const { comments } = buildRollup([
      row({ sentiment: -1, comment: 'older', createdAt: new Date('2026-08-01') }),
      row({ sentiment: -1, comment: long, createdAt: new Date('2026-08-10') })
    ]);
    expect(comments).toHaveLength(2);
    expect(comments[0].comment).toBe(long);
    expect(comments[1].comment).toBe('older');
  });

  it('respects the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      row({ sentiment: -1, comment: `c${i}` }));
    expect(buildRollup(many, { commentLimit: 3 }).comments).toHaveLength(3);
  });
});

describe('buildRollup — by day', () => {
  it('groups by calendar day in ascending order', () => {
    const { byDay } = buildRollup([
      row({ createdAt: new Date('2026-08-20T23:00:00Z'), sentiment: 1 }),
      row({ createdAt: new Date('2026-08-20T01:00:00Z'), sentiment: -1 }),
      row({ createdAt: new Date('2026-08-19T12:00:00Z'), sentiment: 1 })
    ]);
    expect(byDay.map((d) => d.day)).toEqual(['2026-08-19', '2026-08-20']);
    expect(byDay[1]).toMatchObject({ total: 2, positive: 1, negative: 1, net: 0 });
  });

  it('skips rows with no usable date rather than bucketing them into today', () => {
    const { byDay } = buildRollup([row({ createdAt: null, timestamp: null })]);
    expect(byDay).toEqual([]);
  });
});

describe('buildRollup — exam debriefs', () => {
  const debrief = (over = {}) =>
    row({
      surface: 'exam_debrief',
      sentiment: 1,
      context: { preparedness: 4, examLabel: 'Pharmacology', daysAfterExam: 1 },
      ...over
    });

  it('is empty, not absent, when nobody has been asked yet', () => {
    const { examDebrief } = buildRollup([row()]);
    expect(examDebrief.total).toBe(0);
    expect(examDebrief.preparedRate).toBeNull();
    expect(examDebrief.byGap).toEqual([]);
  });

  it('counts the top two answers as prepared', () => {
    const { examDebrief } = buildRollup([
      debrief({ context: { preparedness: 4 } }),
      debrief({ context: { preparedness: 3 } }),
      debrief({ context: { preparedness: 2 }, sentiment: -1 }),
      debrief({ context: { preparedness: 1 }, sentiment: -1 })
    ]);
    expect(examDebrief.answered).toBe(4);
    expect(examDebrief.preparedCount).toBe(2);
    expect(examDebrief.preparedRate).toBe(50);
    expect(examDebrief.distribution.map((d) => d.count)).toEqual([1, 1, 1, 1]);
  });

  it('reports the distribution best-first regardless of arrival order', () => {
    const { examDebrief } = buildRollup([
      debrief({ context: { preparedness: 1 }, sentiment: -1 }),
      debrief({ context: { preparedness: 4 } })
    ]);
    expect(examDebrief.distribution.map((d) => d.value)).toEqual([4, 3, 2, 1]);
  });

  it('counts gaps from happy respondents too, unlike byReason', () => {
    // The whole reason this section exists separately: a student who felt well
    // prepared and still wants harder questions is a real signal, and the
    // negatives-only tally in byReason drops it on the floor.
    const rows = [
      debrief({ sentiment: 1, context: { preparedness: 4 }, reasons: ['harder_questions'] })
    ];
    expect(buildRollup(rows).byReason).toEqual([]);
    expect(buildRollup(rows).examDebrief.byGap).toEqual([
      { reason: 'harder_questions', count: 1, share: 100 }
    ]);
  });

  it('shares gaps against everyone asked, and sorts by demand', () => {
    const { examDebrief } = buildRollup([
      debrief({ reasons: ['harder_questions', 'more_case_scenarios'] }),
      debrief({ reasons: ['harder_questions'] }),
      debrief({ reasons: [] })
    ]);
    expect(examDebrief.byGap).toEqual([
      { reason: 'harder_questions', count: 2, share: 67 },
      { reason: 'more_case_scenarios', count: 1, share: 33 }
    ]);
  });

  it('keeps a debrief that was skipped after question one out of the answers', () => {
    // A row can exist with no preparedness if the write is ever changed to
    // create it earlier; it must not be counted as an answer of zero.
    const { examDebrief } = buildRollup([
      debrief({ context: {}, sentiment: null }),
      debrief({ context: { preparedness: 4 } })
    ]);
    expect(examDebrief.total).toBe(2);
    expect(examDebrief.answered).toBe(1);
    expect(examDebrief.preparedRate).toBe(100);
  });

  it('drops dev-preview rows before counting anything', () => {
    // Dev and production share a Firebase project, so a developer opening the
    // preview writes real rows. Counting those as student sentiment would be a
    // quiet lie on every number on the page.
    const rollup = buildRollup([
      debrief({ context: { preparedness: 1, devPreview: true }, sentiment: -1 }),
      debrief({ context: { preparedness: 4 } })
    ]);
    expect(rollup.examDebrief.total).toBe(1);
    expect(rollup.examDebrief.preparedRate).toBe(100);
    expect(rollup.overall.total).toBe(1);
  });

  it('tallies the exam against expectations, separately from preparedness', () => {
    // A student can walk in ready and still be blindsided by the format; the
    // two axes have to be readable apart or that case disappears.
    const { examDebrief } = buildRollup([
      debrief({ context: { preparedness: 4, insights: { difficulty: 'harder_than_expected' } } }),
      debrief({ context: { preparedness: 3, insights: { difficulty: 'harder_than_expected' } } }),
      debrief({ context: { preparedness: 4, insights: { difficulty: 'as_expected' } } }),
      debrief({ context: { preparedness: 4 } })
    ]);
    expect(examDebrief.difficulty).toEqual({
      harder_than_expected: 2,
      as_expected: 1,
      easier_than_expected: 0
    });
    expect(examDebrief.preparedRate).toBe(100);
  });

  it('lists what they asked for, newest first, skipping conversations with no ask', () => {
    const { examDebrief } = buildRollup([
      debrief({
        createdAt: new Date('2026-08-20T10:00:00Z'),
        context: { preparedness: 3, insights: { biggestImprovement: 'More SATA practice' } }
      }),
      debrief({
        createdAt: new Date('2026-08-24T10:00:00Z'),
        context: { preparedness: 2, insights: { biggestImprovement: 'Multi-patient scenarios' } }
      }),
      debrief({ context: { preparedness: 4, insights: { biggestImprovement: '' } } })
    ]);
    expect(examDebrief.asks.map((a) => a.insights.biggestImprovement)).toEqual([
      'Multi-patient scenarios',
      'More SATA practice'
    ]);
  });

  it('keeps the transcript on the row, so a tally can be read back to source', () => {
    const transcript = [
      { role: 'assistant', content: 'How did it go?' },
      { role: 'user', content: 'Rough' }
    ];
    const { examDebrief } = buildRollup([
      debrief({ comment: 'Rough', context: { preparedness: 1, transcript } })
    ]);
    expect(examDebrief.surprises[0].transcript).toEqual(transcript);
  });

  it('does not count an unstated preparedness as a malformed row', () => {
    // A conversation where she never said how prepared she felt has no
    // sentiment, honestly. Counting it as malformed would make that number
    // climb every week the feature works as designed.
    const rollup = buildRollup([
      debrief({ sentiment: null, context: { insights: { difficulty: 'as_expected' } } }),
      row({ sentiment: null })
    ]);
    expect(rollup.malformed).toBe(1);
  });

  it('lists surprises newest first, with the exam and how prepared they felt', () => {
    const { examDebrief } = buildRollup([
      debrief({
        comment: 'Half the paper was on delegation.',
        createdAt: new Date('2026-08-20T10:00:00Z')
      }),
      debrief({
        comment: 'Way more math than expected.',
        createdAt: new Date('2026-08-22T10:00:00Z'),
        context: { preparedness: 2, examLabel: 'Med-Surg' },
        sentiment: -1
      }),
      debrief({ comment: null })
    ]);
    expect(examDebrief.surprises.map((c) => c.comment)).toEqual([
      'Way more math than expected.',
      'Half the paper was on delegation.'
    ]);
    expect(examDebrief.surprises[0]).toMatchObject({ examLabel: 'Med-Surg', preparedness: 2 });
  });
});
