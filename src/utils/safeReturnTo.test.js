import { safeReturnTo } from './safeReturnTo';

describe('safeReturnTo', () => {
  it('accepts the paths the NCLEX landing pages send', () => {
    expect(safeReturnTo('/nclex')).toBe('/nclex');
    expect(safeReturnTo('/nclex/practice')).toBe('/nclex/practice');
    expect(safeReturnTo('/nclex/subject/pharmacology')).toBe('/nclex/subject/pharmacology');
    expect(safeReturnTo('/nclex-question-generator')).toBe('/nclex-question-generator');
  });

  it('keeps query strings and fragments on an otherwise safe path', () => {
    expect(safeReturnTo('/nclex/practice?subject=leadership')).toBe('/nclex/practice?subject=leadership');
    expect(safeReturnTo('/nclex#readiness')).toBe('/nclex#readiness');
  });

  it('rejects absolute URLs (open redirect)', () => {
    expect(safeReturnTo('https://evil.example')).toBeNull();
    expect(safeReturnTo('http://evil.example/nclex')).toBeNull();
    expect(safeReturnTo('javascript:alert(1)')).toBeNull();
  });

  it('rejects protocol-relative URLs', () => {
    expect(safeReturnTo('//evil.example')).toBeNull();
    expect(safeReturnTo('//evil.example/nclex')).toBeNull();
  });

  it('rejects backslash and control-character normalisation tricks', () => {
    expect(safeReturnTo('/\\evil.example')).toBeNull();
    expect(safeReturnTo('/\\/evil.example')).toBeNull();
    expect(safeReturnTo('/nclex\nSet-Cookie: x')).toBeNull();
    expect(safeReturnTo('/nclex practice')).toBeNull();
  });

  it('rejects a scheme smuggled after the leading slash', () => {
    expect(safeReturnTo('/javascript:alert(1)')).toBeNull();
    expect(safeReturnTo('/https://evil.example')).toBeNull();
  });

  it('rejects relative paths and junk', () => {
    expect(safeReturnTo('nclex')).toBeNull();
    expect(safeReturnTo('')).toBeNull();
    expect(safeReturnTo('   ')).toBeNull();
    expect(safeReturnTo(null)).toBeNull();
    expect(safeReturnTo(undefined)).toBeNull();
    expect(safeReturnTo({ toString: () => '/nclex' })).toBeNull();
  });
});
