import {
  LANDING_SCHOOLS,
  LOGO_MIN_PX,
  MARQUEE_COPIES,
  MARQUEE_ROWS,
  SCHOOL_COUNT,
  logoUrl,
  marqueeDuration,
  marqueeTrack,
  monogram,
  rowDuration,
  rowReversed,
  rowsOf,
  tileColor
} from './schoolWall';

describe('monogram', () => {
  it('drops connective words so the initials read as a mark', () => {
    expect(monogram('University of Miami')).toBe('UM');
    expect(monogram('The College of New Jersey')).toBe('CNJ');
  });

  it('caps at three letters', () => {
    expect(monogram('Case Western Reserve University')).toBe('CWR');
  });

  it('handles punctuation, accents and dashes', () => {
    expect(monogram('St. Lawrence College')).toBe('SLC');
    expect(monogram('Xavier University – Ateneo de Cagayan')).toBe('XUA');
    expect(monogram('Université Laval')).toBe('UL');
  });

  it('treats French connectives as stopwords, accents included', () => {
    expect(monogram('Cégep de Saint-Hyacinthe')).toBe('CSH');
    expect(monogram('Université du Québec à Trois-Rivières')).toBe('UQT');
  });

  it('never returns an empty tile', () => {
    expect(monogram('')).toBe('?');
    expect(monogram('   ')).toBe('?');
    expect(monogram(undefined)).toBe('?');
  });
});

describe('tileColor', () => {
  it('is stable for a given name', () => {
    expect(tileColor('Rutgers University')).toBe(tileColor('Rutgers University'));
  });

  it('does not depend on position in the list, so inserting a school is safe', () => {
    const before = LANDING_SCHOOLS.map((s) => tileColor(s.name));
    const after = [{ name: 'New School', short: 'New' }, ...LANDING_SCHOOLS]
      .slice(1)
      .map((s) => tileColor(s.name));
    expect(after).toEqual(before);
  });

  it('always returns a hex colour', () => {
    LANDING_SCHOOLS.forEach((school) => {
      expect(tileColor(school.name)).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});

describe('marqueeDuration', () => {
  it('scales with the item count so pixels-per-second stays constant', () => {
    expect(marqueeDuration(20)).toBe(72);
    expect(marqueeDuration(40)).toBe(144);
  });

  it('floors short lists so a handful of schools do not blur past', () => {
    expect(marqueeDuration(1)).toBe(20);
    expect(marqueeDuration(0)).toBe(20);
  });
});

describe('marqueeTrack', () => {
  it('repeats the list MARQUEE_COPIES times for the seamless loop', () => {
    const track = marqueeTrack(LANDING_SCHOOLS);
    expect(track).toHaveLength(LANDING_SCHOOLS.length * MARQUEE_COPIES);
  });

  it('gives every entry a unique key across every copy', () => {
    const keys = marqueeTrack(LANDING_SCHOOLS).map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('announces the first copy only, and marks the rest decorative', () => {
    const track = marqueeTrack(LANDING_SCHOOLS);
    const first = track.slice(0, LANDING_SCHOOLS.length);
    expect(first.every((s) => s.duplicate === false)).toBe(true);
    expect(track.filter((s) => s.duplicate))
      .toHaveLength(LANDING_SCHOOLS.length * (MARQUEE_COPIES - 1));
  });
});

describe('rowsOf', () => {
  it('splits the list across MARQUEE_ROWS rows', () => {
    expect(rowsOf(LANDING_SCHOOLS)).toHaveLength(MARQUEE_ROWS);
  });

  it('loses no school and duplicates none', () => {
    const flat = rowsOf(LANDING_SCHOOLS).flat().map((s) => s.name);
    expect(flat).toHaveLength(LANDING_SCHOOLS.length);
    expect(new Set(flat).size).toBe(LANDING_SCHOOLS.length);
  });

  it('keeps rows within one school of each other', () => {
    const lengths = rowsOf(LANDING_SCHOOLS).map((r) => r.length);
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(1);
  });

  it('deals round-robin so no row is a block of the list', () => {
    const [first] = rowsOf(['a', 'b', 'c', 'd', 'e', 'f'], 3);
    expect(first).toEqual(['a', 'd']);
  });

  it('drops empty rows when there are fewer schools than rows', () => {
    expect(rowsOf([{ name: 'Only' }], 3)).toHaveLength(1);
  });

  it('never returns zero rows', () => {
    expect(rowsOf(LANDING_SCHOOLS, 0).length).toBeGreaterThan(0);
  });
});

describe('row motion', () => {
  it('alternates direction so the rows do not read as one sliding sheet', () => {
    expect([0, 1, 2].map(rowReversed)).toEqual([false, true, false]);
  });

  it('detunes each row so equal-length rows do not stay in lockstep', () => {
    const durations = [0, 1, 2].map((i) => rowDuration(14, i));
    expect(new Set(durations).size).toBe(3);
  });

  it('keeps every row within a sane speed range', () => {
    [0, 1, 2].forEach((i) => {
      expect(rowDuration(14, i)).toBeGreaterThanOrEqual(20);
      expect(rowDuration(14, i)).toBeLessThan(marqueeDuration(14) * 1.5);
    });
  });
});

describe('logoUrl', () => {
  it('asks the favicon service for the school domain at 128px', () => {
    expect(logoUrl({ domain: 'jhu.edu' }))
      .toBe('https://www.google.com/s2/favicons?domain=jhu.edu&sz=128');
  });

  it('prefers a self-hosted file over the remote lookup', () => {
    expect(logoUrl({ domain: 'jhu.edu', logo: '/schools/jhu.svg' })).toBe('/schools/jhu.svg');
  });

  it('encodes the domain rather than pasting it into the query raw', () => {
    expect(logoUrl({ domain: 'a b&c.edu' })).toContain('a%20b%26c.edu');
  });

  it('returns null when there is nothing to fetch, so the chip stays on its monogram', () => {
    expect(logoUrl({})).toBeNull();
    expect(logoUrl()).toBeNull();
  });

  it('resolves for every school in the list', () => {
    LANDING_SCHOOLS.forEach((school) => {
      expect(logoUrl(school)).toBeTruthy();
    });
  });
});

describe('LOGO_MIN_PX', () => {
  it('rejects the 16px generic-globe fallback and accepts a 32px icon', () => {
    expect(16 >= LOGO_MIN_PX).toBe(false);
    expect(32 >= LOGO_MIN_PX).toBe(true);
  });
});

describe('LANDING_SCHOOLS', () => {
  it('carries the Quebec schools, which the email audit could not see', () => {
    const names = LANDING_SCHOOLS.map((school) => school.name);
    expect(names).toContain('Université du Québec à Trois-Rivières');
    expect(names).toContain('Cégep de Saint-Hyacinthe');
  });

  it('spells UQTR out rather than taking the derived three letters', () => {
    const uqtr = LANDING_SCHOOLS.find((s) => s.short === 'UQTR');
    expect(uqtr.mark).toBe('UQTR');
  });

  it('gives every school a domain to look its logo up by', () => {
    LANDING_SCHOOLS.forEach((school) => {
      expect(school.domain).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
    });
  });

  it('has no duplicate domains', () => {
    const domains = LANDING_SCHOOLS.map((s) => s.domain);
    expect(new Set(domains).size).toBe(domains.length);
  });

  it('keeps a monogram available for every school as the logo fallback', () => {
    LANDING_SCHOOLS.forEach((school) => {
      expect(school.mark || monogram(school.name)).toMatch(/^[A-Z]{1,4}$/);
    });
  });

  it('never claims more schools than the audit found', () => {
    expect(LANDING_SCHOOLS.length).toBeLessThanOrEqual(SCHOOL_COUNT);
  });

  it('has no duplicate schools', () => {
    const names = LANDING_SCHOOLS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every school a display name', () => {
    LANDING_SCHOOLS.forEach((school) => {
      expect(school.short || school.name).toBeTruthy();
    });
  });
});
