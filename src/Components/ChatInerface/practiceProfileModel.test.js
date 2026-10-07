import { describeProfile, effectiveFormats, settingsWithProfile, toggleFormat, setDifficulty } from './practiceProfileModel';

const noOrdering = { excludedFormats: ['casestudy'], formats: null, source: { kind: 'uploads', files: ['Cardiac 2.pdf'] }, difficulty: 'hard' };

test('an excluded format never comes back from a model guess', () => {
  expect(effectiveFormats(noOrdering, ['mcq', 'sata', 'casestudy'])).toEqual(['mcq', 'sata']);
  // A guess of only the excluded format falls back to the first allowed one.
  expect(effectiveFormats(noOrdering, ['casestudy'])).toEqual(['mcq']);
});

test('with nothing saved and no guess, ordering is not a default (mirrors the backend)', () => {
  expect(effectiveFormats({})).toEqual(['mcq', 'sata']);
  expect(effectiveFormats(null, ['mcq'])).toEqual(['mcq']);
});

test('excluding everything still leaves one format', () => {
  expect(effectiveFormats({ excludedFormats: ['mcq', 'sata', 'casestudy', 'true_false', 'matrix', 'unfoldingcase'] })).toEqual(['mcq']);
});

test('the summary says what was remembered, in reading order', () => {
  const keys = describeProfile(noOrdering).map(p => p.key);
  expect(keys).toEqual(['practiceProfile.fromFile', 'practiceProfile.formats', 'practiceProfile.noOrdering', 'practiceProfile.difficulty.hard']);
});

test('a chat with nothing remembered shows no line', () => {
  expect(describeProfile(null)).toEqual([]);
  expect(describeProfile({ source: { kind: 'general' } })).toEqual([]);
});

test('pasted notes are named as the source', () => {
  expect(describeProfile({ source: { kind: 'pasted' } })[0].key).toBe('practiceProfile.fromNotes');
});

test('switching ordering off by hand saves the list and the exclusion', () => {
  const profile = toggleFormat({}, 'casestudy', false, { now: new Date('2026-09-29T00:00:00Z') });
  expect(profile.formats).toEqual(['mcq', 'sata']);
  expect(profile.excludedFormats).toEqual(['casestudy', 'true_false', 'matrix', 'unfoldingcase']);
  expect(profile.updatedBy).toBe('student');
});

test('switching ordering back on re-enables it', () => {
  const profile = toggleFormat(noOrdering, 'casestudy', true);
  expect(profile.formats).toEqual(['mcq', 'sata', 'casestudy']);
  expect(profile.excludedFormats).toEqual(['true_false', 'matrix', 'unfoldingcase']);
});

test('a toggle starts from what the line shows, including the formats the quiz already uses', () => {
  expect(toggleFormat({}, 'sata', false, { guess: ['mcq', 'sata', 'casestudy'] }).formats).toEqual(['mcq', 'casestudy']);
});

test('the last remaining format cannot be switched off', () => {
  const only = { formats: ['mcq'], excludedFormats: ['sata', 'casestudy'] };
  expect(toggleFormat(only, 'mcq', false)).toBe(only);
});

test('quiz settings follow the profile for the next batch', () => {
  expect(settingsWithProfile({ question_types: ['mcq', 'sata', 'casestudy'], difficulty: 'medium', requested_total: 20 }, noOrdering))
    .toEqual({ question_types: ['mcq', 'sata'], difficulty: 'hard', requested_total: 20 });
  const settings = { question_types: ['mcq'] };
  expect(settingsWithProfile(settings, null)).toBe(settings);
});

test('difficulty edits accept only known levels', () => {
  expect(setDifficulty({}, 'hard').difficulty).toBe('hard');
  expect(setDifficulty({ difficulty: 'easy' }, 'extreme').difficulty).toBe('easy');
});
