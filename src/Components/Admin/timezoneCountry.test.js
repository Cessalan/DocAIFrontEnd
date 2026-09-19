import { countryCodeForTimeZone, countryName, placeLabel } from './timezoneCountry';

describe('countryCodeForTimeZone', () => {
  it('maps the zones this app actually sees', () => {
    expect(countryCodeForTimeZone('America/New_York')).toBe('US');
    expect(countryCodeForTimeZone('America/Toronto')).toBe('CA');
    expect(countryCodeForTimeZone('Asia/Manila')).toBe('PH');
    expect(countryCodeForTimeZone('America/St_Lucia')).toBe('LC');
  });

  it('accepts the legacy aliases browsers still emit', () => {
    expect(countryCodeForTimeZone('US/Eastern')).toBe('US');
    expect(countryCodeForTimeZone('Asia/Calcutta')).toBe('IN');
  });

  it('returns null rather than guessing at an unmapped zone', () => {
    expect(countryCodeForTimeZone('Antarctica/Troll')).toBeNull();
    expect(countryCodeForTimeZone('')).toBeNull();
    expect(countryCodeForTimeZone(undefined)).toBeNull();
  });
});

describe('countryName', () => {
  it('names a country from its code', () => {
    expect(countryName('US')).toBe('United States');
    expect(countryName('PH')).toBe('Philippines');
  });

  it('is null for no code', () => {
    expect(countryName(null)).toBeNull();
  });
});

describe('placeLabel', () => {
  it('shows the country when the zone is known', () => {
    expect(placeLabel('America/Chicago')).toBe('United States');
  });

  it('shows the raw zone when it is not, so an unmapped zone is visible', () => {
    expect(placeLabel('Antarctica/Troll')).toBe('Antarctica/Troll');
  });

  it('is null for a row written before the capture existed', () => {
    expect(placeLabel(null)).toBeNull();
  });
});
