import {
  createDrillState,
  recordAnswer,
  classifyTopic,
  hasFormatEvidence,
  firstHardWinInBlock,
  formatDiagnosis,
  isStrugglingBroadly,
  topicTotals,
  overallAccuracy,
  repeatedMisconceptions,
  blockIndexAt,
  answeredInBlock,
  plannedBlockSize,
  requiredFormatsForBlock,
  shouldCheckpoint,
  questionsUntilCheckpoint,
  buildCheckpoint,
  selectNextSpec,
  blockFormatsUsed,
  nextDifficulty,
  normalizeFormat,
  caseStudyCap,
  FIRST_BLOCK_SIZE,
  BLOCK_SIZE,
} from './drillModel';

/** Answer n questions on one topic/format with a fixed correctness. */
const answerMany = (state, n, opts) => {
  let s = state;
  for (let i = 0; i < n; i += 1) s = recordAnswer(s, opts);
  return s;
};

describe('normalizeFormat', () => {
  it('buckets unfolding cases with case studies', () => {
    expect(normalizeFormat('unfoldingCase')).toBe('casestudy');
    expect(normalizeFormat('caseStudy')).toBe('casestudy');
  });

  it('falls back to mcq for anything unknown or absent', () => {
    expect(normalizeFormat(undefined)).toBe('mcq');
    expect(normalizeFormat('ordering')).toBe('mcq');
  });
});

describe('recordAnswer', () => {
  it('does not mutate the input state', () => {
    const s0 = createDrillState(['Cardio']);
    const s1 = recordAnswer(s0, { topic: 'Cardio', format: 'mcq', isCorrect: true });
    expect(s0.answered).toBe(0);
    expect(s1.answered).toBe(1);
  });

  it('grades partial credit as not correct', () => {
    // A SATA scored 3/4 is a miss: counting near-hits as knowledge rebuilds
    // exactly the false confidence the format gap exposes.
    const s = recordAnswer(createDrillState(), {
      topic: 'Cardio', format: 'sata', isCorrect: false, score: 3, maxScore: 4,
    });
    expect(s.formats.sata).toEqual({ correct: 0, total: 1 });
    expect(s.history[0].score).toBe(3);
  });

  it('skips the concept ledger when no conceptKey is supplied', () => {
    const s = recordAnswer(createDrillState(), { topic: 'Cardio', format: 'mcq', isCorrect: false });
    expect(s.concepts).toEqual({});
  });

  it('keys the ledger on conceptKey, not question text', () => {
    let s = recordAnswer(createDrillState(), {
      topic: 'Cardio', format: 'mcq', isCorrect: false,
      concept: 'Which lowers afterload?', conceptKey: 'preload vs afterload',
    });
    s = recordAnswer(s, {
      topic: 'Cardio', format: 'sata', isCorrect: false,
      concept: 'Select all that reduce afterload', conceptKey: 'preload vs afterload',
    });
    expect(Object.keys(s.concepts)).toEqual(['preload vs afterload']);
    expect(s.concepts['preload vs afterload'].total).toBe(2);
  });
});

describe('nextDifficulty', () => {
  it('climbs on three correct and falls on two wrong', () => {
    expect(nextDifficulty(1, 3)).toBe(2);
    expect(nextDifficulty(2, -2)).toBe(1);
  });

  it('holds inside the band and clamps at the ends', () => {
    expect(nextDifficulty(2, 1)).toBe(2);
    expect(nextDifficulty(3, 5)).toBe(3);
    expect(nextDifficulty(1, -9)).toBe(1);
  });
});

describe('classifyTopic', () => {
  it('needs two answers before calling anything a strength', () => {
    const s = recordAnswer(createDrillState(), { topic: 'Cardio', format: 'sata', isCorrect: true });
    expect(classifyTopic(s, 'Cardio')).toBe('insufficient');
  });

  it('calls an MCQ-only run provisional, never strong', () => {
    // The whole product rests on this: 82% on MCQ says almost nothing about
    // readiness when the same students sit at ~22% on case studies.
    const s = answerMany(createDrillState(), 4, { topic: 'Cardio', format: 'mcq', isCorrect: true });
    expect(hasFormatEvidence(s, 'Cardio')).toBe(false);
    expect(classifyTopic(s, 'Cardio')).toBe('provisional');
  });

  it('promotes to strong once a hard format corroborates it', () => {
    let s = answerMany(createDrillState(), 3, { topic: 'Cardio', format: 'mcq', isCorrect: true });
    s = recordAnswer(s, { topic: 'Cardio', format: 'sata', isCorrect: true });
    expect(classifyTopic(s, 'Cardio')).toBe('strong');
  });

  it('separates weak from inconsistent', () => {
    let weak = answerMany(createDrillState(), 3, { topic: 'Renal', format: 'mcq', isCorrect: false });
    weak = recordAnswer(weak, { topic: 'Renal', format: 'mcq', isCorrect: true });
    expect(classifyTopic(weak, 'Renal')).toBe('weak'); // 1/4 = 25%

    let mixed = answerMany(createDrillState(), 3, { topic: 'Renal', format: 'mcq', isCorrect: true });
    mixed = answerMany(mixed, 2, { topic: 'Renal', format: 'mcq', isCorrect: false });
    expect(classifyTopic(mixed, 'Renal')).toBe('inconsistent'); // 3/5 = 60%
  });

  it('reports untested topics as untested', () => {
    expect(classifyTopic(createDrillState(['Cardio']), 'Cardio')).toBe('untested');
  });
});

describe('formatDiagnosis', () => {
  it('stays silent until both sides have real evidence', () => {
    const s = answerMany(createDrillState(), 5, { topic: 'Cardio', format: 'mcq', isCorrect: true });
    expect(formatDiagnosis(s)).toBeNull();
  });

  it('does not fire on a gap narrower than the threshold', () => {
    let s = answerMany(createDrillState(), 4, { topic: 'A', format: 'mcq', isCorrect: true });
    s = answerMany(s, 4, { topic: 'A', format: 'sata', isCorrect: true });
    s = recordAnswer(s, { topic: 'A', format: 'sata', isCorrect: false }); // 100% vs 80% = 20pp
    expect(formatDiagnosis(s)).toBeNull();
  });

  it('names the worst hard format when the gap is real', () => {
    let s = answerMany(createDrillState(), 4, { topic: 'A', format: 'mcq', isCorrect: true });
    s = answerMany(s, 2, { topic: 'A', format: 'sata', isCorrect: true });
    s = answerMany(s, 2, { topic: 'A', format: 'sata', isCorrect: false });   // sata 50%
    s = answerMany(s, 3, { topic: 'A', format: 'casestudy', isCorrect: false }); // case 0%
    const gap = formatDiagnosis(s);
    expect(gap).not.toBeNull();
    expect(gap.worst.format).toBe('casestudy');
    expect(gap.gapPp).toBeGreaterThanOrEqual(25);
  });

  it('refuses the diagnosis when multiple choice is failing too', () => {
    // The case from production: 33% on MCQ, 0% on the hard formats. That
    // clears the 25pp bar, but "you know this material" is not a claim two
    // failing scores can support — it is a knowledge gap, not a format one.
    let s = recordAnswer(createDrillState(), { topic: 'A', format: 'mcq', isCorrect: true });
    s = answerMany(s, 2, { topic: 'A', format: 'mcq', isCorrect: false });
    s = answerMany(s, 2, { topic: 'A', format: 'sata', isCorrect: false });

    const mcq = s.formats.mcq;
    expect(mcq.correct / mcq.total).toBeCloseTo(1 / 3);
    expect(formatDiagnosis(s)).toBeNull();
  });

  it('still fires when multiple choice is genuinely solid', () => {
    // 75% vs 0% — below the strength bar, but she really can do the material
    // in its easy form, so the format finding stands.
    let s = answerMany(createDrillState(), 3, { topic: 'A', format: 'mcq', isCorrect: true });
    s = recordAnswer(s, { topic: 'A', format: 'mcq', isCorrect: false });
    s = answerMany(s, 2, { topic: 'A', format: 'sata', isCorrect: false });
    expect(formatDiagnosis(s)).not.toBeNull();
  });

  it('breaks a tie toward the format we have more evidence on', () => {
    // Both hard formats at 0%. Sending her to drill the one seen once, on the
    // strength of that single answer, would be worse advice than the one we
    // have watched her fail four times.
    let s = answerMany(createDrillState(), 4, { topic: 'A', format: 'mcq', isCorrect: true });
    s = recordAnswer(s, { topic: 'A', format: 'sata', isCorrect: false });
    s = answerMany(s, 4, { topic: 'A', format: 'casestudy', isCorrect: false });
    expect(formatDiagnosis(s).worst.format).toBe('casestudy');
  });
});

describe('isStrugglingBroadly', () => {
  it('waits for enough answers before characterising the whole drill', () => {
    const s = answerMany(createDrillState(), 2, { topic: 'A', format: 'mcq', isCorrect: false });
    expect(isStrugglingBroadly(s)).toBe(false);
  });

  it('sees one right out of five for what it is', () => {
    let s = recordAnswer(createDrillState(), { topic: 'A', format: 'mcq', isCorrect: true });
    s = answerMany(s, 2, { topic: 'A', format: 'mcq', isCorrect: false });
    s = answerMany(s, 2, { topic: 'B', format: 'sata', isCorrect: false });
    expect(overallAccuracy(s)).toMatchObject({ correct: 1, total: 5 });
    expect(isStrugglingBroadly(s)).toBe(true);
  });

  it('leaves a middling run alone', () => {
    let s = answerMany(createDrillState(), 3, { topic: 'A', format: 'mcq', isCorrect: true });
    s = answerMany(s, 2, { topic: 'A', format: 'sata', isCorrect: false });
    expect(isStrugglingBroadly(s)).toBe(false);
  });

  it('does not send a struggling student off to a brand new topic', () => {
    // Every topic is still under the evidence bar, so nothing reaches the weak
    // bucket and the old fallback was "nothing left to prove here — we move to
    // B", said to someone who had got one question right.
    let s = recordAnswer(createDrillState(['A', 'B', 'C', 'D', 'E']), { topic: 'A', format: 'mcq', isCorrect: true });
    s = recordAnswer(s, { topic: 'B', format: 'mcq', isCorrect: false });
    s = recordAnswer(s, { topic: 'C', format: 'mcq', isCorrect: false });
    s = recordAnswer(s, { topic: 'D', format: 'sata', isCorrect: false });
    s = recordAnswer(s, { topic: 'E', format: 'casestudy', isCorrect: false });

    const cp = buildCheckpoint(s);
    expect(cp.struggling).toBe(true);
    expect(cp.formatGap).toBeNull();
    expect(cp.recommendation.kind).toBe('foundations');
  });
});

describe('resolveTopic', () => {
  /* The labels below are the ones the generator actually produced in two
     production drills — one subject each time, arriving under a new name
     almost every question. */
  it('merges the generator\'s synonyms into one subject', () => {
    let s = recordAnswer(createDrillState(), { topic: 'Sleep and Testosterone', format: 'mcq', isCorrect: true });
    s = recordAnswer(s, { topic: 'Testosterone and Sleep', format: 'sata', isCorrect: false });
    s = recordAnswer(s, { topic: 'Sleep Restriction and Testosterone', format: 'mcq', isCorrect: false });

    expect(Object.keys(s.topics)).toEqual(['Sleep and Testosterone']);
    expect(topicTotals(s, 'Sleep and Testosterone')).toEqual({ correct: 1, total: 3 });
  });

  it('gives a fragmented drill enough evidence to say anything at all', () => {
    // 14 answers under the labels from the reported drill. Split by raw label
    // nothing reaches MIN_EVIDENCE_STRONG, so classifyTopic can only ever
    // return 'insufficient' and the checkpoint has no findings to report.
    const labels = [
      'Trauma Hypothermia Prevention', 'Personal Protective Equipment',
      'Hypothermia Prevention', 'Trauma Hypothermia Prevention',
      'Personal Protective Equipment', 'Decontamination Essentials',
      'Hypothermia Prevention', 'Chemical Exposure Decontamination',
      'Personal Protective Equipment', 'Decontamination Essentials',
      'Trauma Hypothermia Prevention', 'Hypothermia Prevention',
      'Chemical Exposure Decontamination', 'Personal Protective Equipment',
    ];
    let s = createDrillState();
    labels.forEach((topic, i) => {
      s = recordAnswer(s, { topic, format: 'mcq', isCorrect: i % 4 === 0 });
    });

    const keys = Object.keys(s.topics);
    expect(keys.length).toBeLessThan(new Set(labels).size);

    const classifiable = keys.filter((k) => classifyTopic(s, k) !== 'insufficient');
    expect(classifiable.length).toBeGreaterThan(0);
  });

  it('snaps a new subject onto the name the plan already uses', () => {
    const s = recordAnswer(createDrillState(['Fluid and Electrolytes']), {
      topic: 'Electrolytes', format: 'mcq', isCorrect: true,
    });
    expect(Object.keys(s.topics)).toEqual(['Fluid and Electrolytes']);
  });

  it('prefers a bucket that already holds answers over an empty planned name', () => {
    let s = recordAnswer(createDrillState(['Sleep Hygiene', 'Renal']), {
      topic: 'Sleep Hygiene', format: 'mcq', isCorrect: true,
    });
    s = recordAnswer(s, { topic: 'Sleep Hygiene Basics', format: 'sata', isCorrect: false });
    expect(Object.keys(s.topics)).toEqual(['Sleep Hygiene']);
  });

  it('keeps genuinely different subjects apart', () => {
    let s = recordAnswer(createDrillState(), { topic: 'Renal Failure', format: 'mcq', isCorrect: true });
    s = recordAnswer(s, { topic: 'Personal Protective Equipment', format: 'mcq', isCorrect: true });
    expect(Object.keys(s.topics)).toHaveLength(2);
  });

  it('falls back to General rather than an empty key', () => {
    const s = recordAnswer(createDrillState(), { topic: '   ', format: 'mcq', isCorrect: true });
    expect(Object.keys(s.topics)).toEqual(['General']);
  });
});

describe('the answer log', () => {
  it('records what it took to answer, not just whether it was right', () => {
    const s = recordAnswer(createDrillState(['Sleep']), {
      topic: 'Sleep',
      format: 'sata',
      isCorrect: false,
      score: 3,
      maxScore: 5,
      seconds: 62,
    });

    expect(s.history[0]).toMatchObject({
      topic: 'Sleep',
      format: 'sata',
      score: 3,
      maxScore: 5,
      seconds: 62,
    });
    expect(Date.parse(s.history[0].at)).not.toBeNaN();
  });

  it('leaves seconds null rather than inventing a duration', () => {
    // Rows written before timing existed, and any caller that cannot measure.
    const s = recordAnswer(createDrillState(), { topic: 'A', format: 'mcq', isCorrect: true });
    expect(s.history[0].seconds).toBeNull();
  });

  it('keeps a supplied timestamp so a row can be replayed', () => {
    const at = '2026-09-01T10:00:00.000Z';
    const s = recordAnswer(createDrillState(), { topic: 'A', format: 'mcq', isCorrect: true, at });
    expect(s.history[0].at).toBe(at);
  });

  it('rounds a fractional clock reading', () => {
    const s = recordAnswer(createDrillState(), {
      topic: 'A', format: 'mcq', isCorrect: true, seconds: 12.7,
    });
    expect(s.history[0].seconds).toBe(13);
  });
});

describe('firstHardWinInBlock', () => {
  /* The reported case: five questions to the first checkpoint, then ten more
     in which one select-all finally lands. The aggregate moves 0% -> 8% and
     every other reading on the checkpoint is unchanged, so this is the only
     thing that can notice it. */
  const upToFirstWin = () => {
    let s = answerMany(createDrillState(['A']), 3, { topic: 'A', format: 'mcq', isCorrect: true });
    s = answerMany(s, 2, { topic: 'A', format: 'sata', isCorrect: false });
    s = { ...s, lastCheckpointAt: 5 };                    // first checkpoint shown
    s = answerMany(s, 9, { topic: 'A', format: 'sata', isCorrect: false });
    return recordAnswer(s, { topic: 'A', format: 'sata', isCorrect: true });
  };

  it('finds the first hard-format answer she has ever got right', () => {
    const s = upToFirstWin();
    expect(firstHardWinInBlock(s)).toMatchObject({ format: 'sata' });
    // And it really is the 0% -> 8% the student is looking at.
    const hard = s.formats.sata.correct / s.formats.sata.total;
    expect(Math.round(hard * 100)).toBe(8);
  });

  it('says nothing once she has landed more than one', () => {
    let s = upToFirstWin();
    s = recordAnswer(s, { topic: 'A', format: 'sata', isCorrect: true });
    expect(firstHardWinInBlock(s)).toBeNull();
  });

  it('does not re-announce a win from an earlier block', () => {
    const s = { ...upToFirstWin(), lastCheckpointAt: 15 };
    expect(firstHardWinInBlock(s)).toBeNull();
  });

  it('stays silent while every hard answer is still wrong', () => {
    const s = answerMany(createDrillState(['A']), 4, { topic: 'A', format: 'sata', isCorrect: false });
    expect(firstHardWinInBlock(s)).toBeNull();
  });
});

describe('repeatedMisconceptions', () => {
  it('needs two misses before calling it a pattern', () => {
    let s = recordAnswer(createDrillState(), {
      topic: 'Cardio', format: 'mcq', isCorrect: false, conceptKey: 'afterload',
    });
    expect(repeatedMisconceptions(s)).toHaveLength(0);
    s = recordAnswer(s, { topic: 'Cardio', format: 'sata', isCorrect: false, conceptKey: 'afterload' });
    expect(repeatedMisconceptions(s).map((m) => m.key)).toEqual(['afterload']);
  });

  it('ignores a concept that was missed once then learned', () => {
    let s = recordAnswer(createDrillState(), { topic: 'C', format: 'mcq', isCorrect: false, conceptKey: 'k' });
    s = answerMany(s, 3, { topic: 'C', format: 'mcq', isCorrect: true, conceptKey: 'k' });
    expect(repeatedMisconceptions(s)).toHaveLength(0);
  });
});

describe('block geometry', () => {
  it('runs a short opening block then settles at ten', () => {
    expect(blockIndexAt(0)).toBe(0);
    expect(blockIndexAt(FIRST_BLOCK_SIZE - 1)).toBe(0);
    expect(blockIndexAt(FIRST_BLOCK_SIZE)).toBe(1);
    expect(blockIndexAt(FIRST_BLOCK_SIZE + BLOCK_SIZE - 1)).toBe(1);
    expect(blockIndexAt(FIRST_BLOCK_SIZE + BLOCK_SIZE)).toBe(2);
  });

  it('counts position inside the current block', () => {
    expect(answeredInBlock(0)).toBe(0);
    expect(answeredInBlock(4)).toBe(4);
    expect(answeredInBlock(5)).toBe(0);
    expect(answeredInBlock(14)).toBe(9);
    expect(answeredInBlock(15)).toBe(0);
  });

  it('shortens a block to the remaining budget rather than cutting it off', () => {
    expect(plannedBlockSize(1, Infinity)).toBe(BLOCK_SIZE);
    expect(plannedBlockSize(1, 4)).toBe(4);
    expect(plannedBlockSize(0, 2)).toBe(2);
    expect(plannedBlockSize(1, 0)).toBe(1);
  });

  it('caps case studies so block length stays a promise', () => {
    expect(caseStudyCap(0)).toBe(1);
    expect(caseStudyCap(3)).toBe(2);
  });
});

describe('requiredFormatsForBlock', () => {
  it('owes the opening block a SATA and a case study', () => {
    expect(requiredFormatsForBlock(0, FIRST_BLOCK_SIZE).sort()).toEqual(['casestudy', 'sata']);
  });

  it('requires nothing of later blocks', () => {
    expect(requiredFormatsForBlock(1, BLOCK_SIZE)).toEqual([]);
  });

  it('keeps the hardest format when the budget shortens the opener', () => {
    // Two questions of budget: one MCQ on-ramp, one case study. The student
    // still meets the format that actually discriminates.
    expect(requiredFormatsForBlock(0, 2)).toEqual(['casestudy']);
    expect(requiredFormatsForBlock(0, 1)).toEqual([]);
  });
});

describe('checkpoints', () => {
  it('never fires before a question is answered', () => {
    expect(shouldCheckpoint(createDrillState())).toBe(false);
  });

  it('fires at the end of the opening block', () => {
    const s = answerMany(createDrillState(), FIRST_BLOCK_SIZE, { topic: 'A', format: 'mcq', isCorrect: true });
    expect(shouldCheckpoint(s)).toBe(true);
  });

  it('does not fire mid-block', () => {
    const s = answerMany(createDrillState(), FIRST_BLOCK_SIZE - 1, { topic: 'A', format: 'mcq', isCorrect: true });
    expect(shouldCheckpoint(s)).toBe(false);
  });

  it('fires again at the end of the next ten', () => {
    const s = answerMany(createDrillState(), FIRST_BLOCK_SIZE + BLOCK_SIZE, {
      topic: 'A', format: 'mcq', isCorrect: true,
    });
    expect(shouldCheckpoint({ ...s, lastCheckpointAt: FIRST_BLOCK_SIZE })).toBe(true);
  });

  it('does not repeat a checkpoint already delivered', () => {
    const s = answerMany(createDrillState(), FIRST_BLOCK_SIZE, { topic: 'A', format: 'mcq', isCorrect: true });
    expect(shouldCheckpoint({ ...s, lastCheckpointAt: FIRST_BLOCK_SIZE })).toBe(false);
  });

  it('still delivers a checkpoint when the budget cut the block short', () => {
    // Three questions of budget on a ten-block: the checkpoint lands at 3,
    // so she is told where she stands before she ever meets the paywall.
    const s = answerMany(createDrillState(), FIRST_BLOCK_SIZE + 3, { topic: 'A', format: 'mcq', isCorrect: true });
    expect(shouldCheckpoint({ ...s, lastCheckpointAt: FIRST_BLOCK_SIZE }, 3)).toBe(true);
  });

  it('counts down to the next checkpoint', () => {
    const s = answerMany(createDrillState(), 2, { topic: 'A', format: 'mcq', isCorrect: true });
    expect(questionsUntilCheckpoint(s)).toBe(FIRST_BLOCK_SIZE - 2);
    expect(questionsUntilCheckpoint(s, 1)).toBe(0);
  });
});

describe('buildCheckpoint', () => {
  it('reports a strong MCQ run as provisional, not as a strength', () => {
    const s = answerMany(createDrillState(), 5, { topic: 'Cardio', format: 'mcq', isCorrect: true });
    const cp = buildCheckpoint(s);
    expect(cp.strengths).toHaveLength(0);
    expect(cp.provisional.map((p) => p.topic)).toEqual(['Cardio']);
  });

  it('leads the recommendation with the format gap over a weak topic', () => {
    // A format gap costs marks on every topic at once; a weak topic only costs
    // the questions on that topic.
    let s = answerMany(createDrillState(), 8, { topic: 'A', format: 'mcq', isCorrect: true });
    s = answerMany(s, 4, { topic: 'A', format: 'casestudy', isCorrect: false });
    s = answerMany(s, 3, { topic: 'B', format: 'mcq', isCorrect: false });
    const cp = buildCheckpoint(s);
    expect(cp.weak.map((w) => w.topic)).toContain('B');
    expect(cp.recommendation.kind).toBe('format');
    expect(cp.recommendation.format).toBe('casestudy');
  });

  it('recommends drilling the weakest topic when formats are even', () => {
    // Both formats sit at 50%, so no format gap can fire and the weak topic
    // is genuinely the most useful thing to send her back to.
    let s = answerMany(createDrillState(), 2, { topic: 'A', format: 'mcq', isCorrect: true });
    s = answerMany(s, 2, { topic: 'A', format: 'sata', isCorrect: true });
    s = answerMany(s, 2, { topic: 'B', format: 'mcq', isCorrect: false });
    s = answerMany(s, 2, { topic: 'B', format: 'sata', isCorrect: false });
    expect(formatDiagnosis(s)).toBeNull();
    const cp = buildCheckpoint(s);
    expect(cp.recommendation).toMatchObject({ kind: 'weakTopic', topic: 'B' });
  });

  it('sorts weak topics weakest first', () => {
    let s = answerMany(createDrillState(), 4, { topic: 'Bad', format: 'mcq', isCorrect: false });
    s = answerMany(s, 3, { topic: 'Worse', format: 'mcq', isCorrect: false });
    s = recordAnswer(s, { topic: 'Bad', format: 'mcq', isCorrect: true });
    const cp = buildCheckpoint(s);
    expect(cp.weak[0].topic).toBe('Worse');
  });
});

describe('selectNextSpec', () => {
  it('opens on MCQ as an on-ramp', () => {
    const s = createDrillState(['Cardio', 'Renal']);
    expect(selectNextSpec(s, { blockFormatsUsed: {} }).format).toBe('mcq');
  });

  it('pays the block format debt before the opening block can end', () => {
    // Three MCQs in, two slots left, two formats owed — stop choosing, start paying.
    const s = answerMany(createDrillState(['A']), 3, { topic: 'A', format: 'mcq', isCorrect: true });
    const spec = selectNextSpec(s, { blockFormatsUsed: blockFormatsUsed(s) });
    expect(spec.reason).toBe('blockFormatQuota');
    expect(['sata', 'casestudy']).toContain(spec.format);
  });

  it('probes an MCQ-only strength with a hard format instead of praising it', () => {
    const s = answerMany(createDrillState(['A']), 4, { topic: 'A', format: 'mcq', isCorrect: true });
    const spec = selectNextSpec(s, { remaining: Infinity, blockFormatsUsed: { mcq: 4, sata: 1, casestudy: 1 } });
    expect(spec.reason).toBe('proveStrength');
    expect(['sata', 'casestudy']).toContain(spec.format);
  });

  it('drills a weak topic in a hard format, never back in MCQ', () => {
    const s = answerMany(createDrillState(['A']), 4, { topic: 'A', format: 'mcq', isCorrect: false });
    const spec = selectNextSpec(s, { blockFormatsUsed: { mcq: 4, sata: 1, casestudy: 1 } });
    expect(spec.reason).toBe('drillWeak');
    expect(spec.topic).toBe('A');
    expect(['sata', 'casestudy']).toContain(spec.format);
  });

  it('eases difficulty while drilling a weakness', () => {
    let s = answerMany(createDrillState(['A']), 4, { topic: 'A', format: 'mcq', isCorrect: false });
    s = { ...s, difficulty: 3 };
    const spec = selectNextSpec(s, { blockFormatsUsed: { mcq: 4, sata: 1, casestudy: 1 } });
    expect(spec.reason).toBe('drillWeak');
    expect(spec.difficulty).toBe(2);
  });

  it('respects the case-study cap once it is reached', () => {
    const s = answerMany(createDrillState(['A']), 4, { topic: 'A', format: 'mcq', isCorrect: false });
    const spec = selectNextSpec(s, {
      blockFormatsUsed: { mcq: 4, sata: 1, casestudy: caseStudyCap(0) },
    });
    expect(spec.format).not.toBe('casestudy');
  });

  it('moves to a fresh topic when nothing is owing', () => {
    let s = answerMany(createDrillState(['A', 'B']), 2, { topic: 'A', format: 'mcq', isCorrect: true });
    s = answerMany(s, 2, { topic: 'A', format: 'sata', isCorrect: true });
    const spec = selectNextSpec(s, { blockFormatsUsed: { mcq: 2, sata: 2, casestudy: 1 } });
    expect(spec.reason).toBe('newTopic');
    expect(spec.topic).toBe('B');
  });
});

describe('blockFormatsUsed', () => {
  it('only counts the current block', () => {
    let s = answerMany(createDrillState(['A']), FIRST_BLOCK_SIZE, { topic: 'A', format: 'mcq', isCorrect: true });
    s = recordAnswer(s, { topic: 'A', format: 'sata', isCorrect: true });
    expect(blockFormatsUsed(s)).toEqual({ sata: 1 });
  });
});
