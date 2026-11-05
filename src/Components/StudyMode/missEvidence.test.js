import { collectMisses, firstChoices, MISS_CAP, CHOICE_MAX } from './missEvidence';

const question = (overrides = {}) => ({
  question: 'Which order is a priority for a client with diabetes insipidus?',
  options: ['Restrict fluids', 'Give desmopressin', 'Weigh weekly', 'Limit sodium'],
  correctIndex: 1,
  concept: 'DI vs SIADH',
  ...overrides,
});

describe('collectMisses', () => {
  it('keeps her chosen option text for a missed question', () => {
    expect(collectMisses([question()], { 0: 'incorrect' }, { 0: 0 })).toEqual([
      { index: 0, concept: 'DI vs SIADH', format: 'mcq', chosen: 'Restrict fluids' },
    ]);
  });

  it('skips correct answers', () => {
    expect(collectMisses([question(), question()], { 0: 'correct', 1: 'incorrect' }, { 0: 1, 1: 2 }))
      .toEqual([expect.objectContaining({ index: 1, chosen: 'Weigh weekly' })]);
  });

  it('never guesses a choice that was not recorded', () => {
    expect(collectMisses([question()], { 0: 'incorrect' }, {})[0].chosen).toBeNull();
    expect(collectMisses([question()], { 0: 'incorrect' })[0].chosen).toBeNull();
  });

  it('treats "I don\'t know" as no choice', () => {
    expect(collectMisses([question()], { 0: 'incorrect' }, { 0: -1 })[0].chosen).toBeNull();
  });

  it('reads letter choices', () => {
    expect(collectMisses([question()], { 0: 'incorrect' }, { 0: 'C' })[0].chosen).toBe('Weigh weekly');
  });

  it('keeps every selected option for select-all', () => {
    const sata = question({ questionType: 'sata' });
    expect(collectMisses([sata], { 0: 'incorrect' }, { 0: [0, 3] })[0]).toEqual(
      expect.objectContaining({ format: 'sata', chosen: ['Restrict fluids', 'Limit sodium'] }));
  });

  it('reads the format from metadata on older payloads', () => {
    const old = question({ metadata: { questionType: 'casestudy' } });
    expect(collectMisses([old], { 0: 'incorrect' }, {})[0].format).toBe('casestudy');
  });

  it('leaves the concept empty rather than inventing one', () => {
    expect(collectMisses([question({ concept: undefined })], { 0: 'incorrect' }, {})[0].concept).toBeNull();
    expect(collectMisses([question({ concept: '  ' })], { 0: 'incorrect' }, {})[0].concept).toBeNull();
  });

  it('ignores a choice index outside the options', () => {
    expect(collectMisses([question()], { 0: 'incorrect' }, { 0: 9 })[0].chosen).toBeNull();
  });

  it('caps the misses kept, in question order', () => {
    const questions = Array.from({ length: 8 }, () => question());
    const statuses = Object.fromEntries(questions.map((_, i) => [7 - i, 'incorrect']));
    const misses = collectMisses(questions, statuses, {});
    expect(misses).toHaveLength(MISS_CAP);
    expect(misses.map(m => m.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it('shortens a very long option', () => {
    const long = question({ options: ['x'.repeat(400)] });
    expect(collectMisses([long], { 0: 'incorrect' }, { 0: 0 })[0].chosen).toHaveLength(CHOICE_MAX);
  });

  it('survives missing input', () => {
    expect(collectMisses(undefined, undefined, undefined)).toEqual([]);
    expect(collectMisses([], null)).toEqual([]);
  });
});

describe('choices as saved', () => {
  it('reads select-all choices saved as option texts', () => {
    const sata = { question: 'Which?', options: ['A. Restrict fluids', 'B. Weigh daily', 'C. Weigh weekly', 'D. Limit sodium'], questionType: 'sata' };
    expect(collectMisses([sata], { 0: 'incorrect' }, { 0: ['A. Restrict fluids', 'Limit sodium'] })[0].chosen)
      .toEqual(['Restrict fluids', 'Limit sodium']);
  });

  it('falls back to the older first-answer selection, and the new record wins', () => {
    expect(firstChoices({ firstAttemptAnswers: { 0: { selection: 2 }, 1: { selection: null }, 2: { selection: 1 } }, firstAttemptChoices: { 2: 3 } }))
      .toEqual({ 0: 2, 2: 3 });
    expect(firstChoices(undefined)).toEqual({});
  });
});
