import { toDisplayText } from './flashcardText';

describe('toDisplayText', () => {
  it('passes a normal card straight through', () => {
    expect(toDisplayText('The **answer** is 42.')).toBe('The **answer** is 42.');
    expect(toDisplayText('line one\nline two')).toBe('line one\nline two');
  });

  it('joins a list of points into lines the formatter already understands', () => {
    // The reported crash: the generator returned bullets instead of a string.
    expect(toDisplayText(['First point', 'Second point'])).toBe('First point\nSecond point');
  });

  it('unwraps a card whose text arrived nested', () => {
    expect(toDisplayText({ text: 'Nested answer' })).toBe('Nested answer');
    expect(toDisplayText({ content: 'Wrapped answer' })).toBe('Wrapped answer');
  });

  it('renders a number rather than dropping it', () => {
    expect(toDisplayText(120)).toBe('120');
    expect(toDisplayText(0)).toBe('0');
  });

  it('returns empty rather than "[object Object]" for a shape it cannot read', () => {
    const out = toDisplayText({ mystery: { deeply: { nested: 1 } } });
    expect(out).toBe('');
    expect(out).not.toContain('object');
  });

  it('is empty for the values that were already handled as blank', () => {
    ['', null, undefined, false, true, NaN].forEach((v) => {
      expect(toDisplayText(v)).toBe('');
    });
  });

  it('does not recurse without bound', () => {
    const cyclic = { text: null };
    cyclic.content = cyclic;
    expect(() => toDisplayText(cyclic)).not.toThrow();
    expect(toDisplayText(cyclic)).toBe('');
  });

  it('drops empty entries when joining a list', () => {
    expect(toDisplayText(['A', '', null, 'B'])).toBe('A\nB');
  });
});
