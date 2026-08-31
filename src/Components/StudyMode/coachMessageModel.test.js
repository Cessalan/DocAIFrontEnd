import { buildCoachMessage, joinTopics } from './coachMessageModel';

const topic = (name) => ({ topic: name });

const keys = (msg) => msg.beats.map((b) => b.key);

describe('joinTopics', () => {
  it('reads like a sentence, not a comma list', () => {
    expect(joinTopics(['A'])).toBe('A');
    expect(joinTopics(['A', 'B'])).toBe('A and B');
    expect(joinTopics(['A', 'B', 'C'])).toBe('A, B and C');
  });

  it('drops empties and handles nothing at all', () => {
    expect(joinTopics([])).toBe('');
    expect(joinTopics([null, 'A', undefined])).toBe('A');
  });
});

describe('buildCoachMessage — the deadline sets the register', () => {
  const work = [topic('Fluid Balance'), topic('Cardiac')];

  it('has time when there is time', () => {
    const msg = buildCoachMessage({ daysToExam: 12, needsWork: work });
    expect(msg.phase).toBe('steady');
    expect(keys(msg)).toContain('coach.steady');
    expect(keys(msg)).toContain('coach.planSteady');
  });

  it('does not pretend two days is comfortable', () => {
    // The honesty rule: reassurance that ignores the calendar reads as
    // being handled, and she already knows what the date is.
    const msg = buildCoachMessage({ daysToExam: 2, needsWork: work });
    expect(msg.phase).toBe('final');
    expect(keys(msg)).toContain('coach.twoDays');
    expect(keys(msg)).toContain('coach.planFinal');
  });

  it('says tomorrow when it is tomorrow', () => {
    const msg = buildCoachMessage({ daysToExam: 1, needsWork: work });
    expect(keys(msg)).toContain('coach.tomorrow');
  });

  it('stops teaching on exam day', () => {
    const msg = buildCoachMessage({ daysToExam: 0, needsWork: work });
    expect(msg.phase).toBe('examDay');
    expect(keys(msg)).toContain('coach.planExamDay');
  });

  it('handles a date that has already passed', () => {
    const msg = buildCoachMessage({ daysToExam: -3, needsWork: work });
    expect(msg.phase).toBe('past');
    expect(keys(msg)).toContain('coach.past');
  });

  it('works with no date at all', () => {
    const msg = buildCoachMessage({ daysToExam: null, needsWork: work });
    expect(msg.phase).toBe('undated');
    expect(keys(msg)).toContain('coach.undated');
  });

  it('uses the phase boundaries the rest of the app uses', () => {
    // Shared with getExamPhase so the map and the dated plan can never
    // disagree about what kind of week she is having.
    expect(buildCoachMessage({ daysToExam: 7 }).phase).toBe('focus');
    expect(buildCoachMessage({ daysToExam: 8 }).phase).toBe('steady');
    expect(buildCoachMessage({ daysToExam: 3 }).phase).toBe('focus');
  });
});

describe('buildCoachMessage — content', () => {
  it('names at most two focus topics, weakest first', () => {
    const msg = buildCoachMessage({
      daysToExam: 10,
      needsWork: [topic('A'), topic('B'), topic('C')],
    });
    const plan = msg.beats.find((b) => b.key === 'coach.planSteady');
    expect(plan.params.topics).toBe('A and B');
  });

  it('mentions the refresh tail when she has strengths', () => {
    const msg = buildCoachMessage({
      daysToExam: 10,
      needsWork: [topic('A')],
      strong: [topic('Cardiac'), topic('Renal')],
    });
    const tail = msg.beats.find((b) => b.key === 'coach.tail');
    expect(tail.params.strong).toBe('Cardiac and Renal');
  });

  it('drops the tail on exam day — there is no "end" left to put it at', () => {
    const msg = buildCoachMessage({
      daysToExam: 0,
      needsWork: [topic('A')],
      strong: [topic('Cardiac')],
    });
    expect(keys(msg)).not.toContain('coach.tail');
  });

  it('says something different when nothing needs work', () => {
    const msg = buildCoachMessage({ daysToExam: 10, needsWork: [], strong: [topic('A')] });
    expect(keys(msg)).toContain('coach.planAllStrong');
    expect(keys(msg)).not.toContain('coach.tail');
  });

  it('carries the exam name through for the copy that uses it', () => {
    const msg = buildCoachMessage({ daysToExam: 0, examName: 'NCLEX' });
    expect(msg.beats[0].params.exam).toBe('NCLEX');
  });

  it('always produces at least two beats', () => {
    [null, -1, 0, 1, 2, 5, 12, 40].forEach((d) => {
      expect(buildCoachMessage({ daysToExam: d, needsWork: [topic('A')] }).beats.length)
        .toBeGreaterThanOrEqual(2);
    });
  });
});
