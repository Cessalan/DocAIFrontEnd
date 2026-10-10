import { explanationLead, lettersOf, verdictDetail, LEAD_MAX } from './sataFeedbackModel';

const OPTIONS = ['A) Assess from across the room', 'B) Detailed airway exam', 'C) Reprioritize to C-ABC', 'D) Full vital signs first', 'E) Usual ABC sequence'];

describe('verdictDetail', () => {
  it('names the extra pick by letter', () => {
    expect(verdictDetail(OPTIONS, { incorrectSelections: ['D) Full vital signs first'], missedCorrect: [] }))
      .toEqual({ key: 'sata.verdict.extra', values: { letters: 'D', count: 1 } });
  });

  it('names missed options, matching with or without the letter prefix', () => {
    expect(verdictDetail(OPTIONS, { incorrectSelections: [], missedCorrect: ['Reprioritize to C-ABC', 'A) Assess from across the room'] }))
      .toEqual({ key: 'sata.verdict.missed', values: { letters: 'A, C', count: 2 } });
  });

  it('says both when there are extras and misses', () => {
    expect(verdictDetail(OPTIONS, { incorrectSelections: ['E) Usual ABC sequence'], missedCorrect: ['B) Detailed airway exam'] }))
      .toEqual({ key: 'sata.verdict.both', values: { extra: 'E', missed: 'B' } });
  });

  it('says nothing more when fully right', () => {
    expect(verdictDetail(OPTIONS, { incorrectSelections: [], missedCorrect: [] })).toBeNull();
    expect(lettersOf(OPTIONS, [])).toEqual([]);
  });
});

describe('explanationLead', () => {
  it('keeps whole sentences and drops markup', () => {
    const html = '<b>A and C are correct.</b> Severe bleeding moves circulation first. <br><br><b>B is incorrect</b> because the airway exam delays bleeding control and that costs time.';
    expect(explanationLead(html)).toBe('A and C are correct. Severe bleeding moves circulation first.');
  });

  it('cuts a single very long sentence at a word, with an ellipsis', () => {
    const long = 'word '.repeat(80).trim() + '.';
    const lead = explanationLead(long);
    expect(lead.length).toBeLessThanOrEqual(LEAD_MAX);
    expect(lead.endsWith('…')).toBe(true);
  });

  it('is empty for no explanation', () => {
    expect(explanationLead('')).toBe('');
    expect(explanationLead(null)).toBe('');
  });
});
