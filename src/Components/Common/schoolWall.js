/**
 * schoolWall — data and derivations for the landing page's "schools our students
 * come from" marquee.
 *
 * WHERE THE NUMBER COMES FROM
 *
 * An Admin-SDK read of production `users` on 2026-09-06 (2,004 docs, 1,954 with an
 * email) found 209 accounts on a school domain, resolving to 186 distinct
 * institutions once student-mail subdomains are folded into their parent
 * (`scholar.yc.edu` and `yc.edu` are one college, not two). SCHOOL_COUNT is
 * deliberately rounded *down* to 180 — the claim on the page has to stay true as
 * the tail of one-off domains gets re-audited, and a round floor survives that.
 * Re-run the audit before raising it.
 *
 * WHERE THE LOGOS COME FROM
 *
 * Each school's official mark is pulled at render time from Google's favicon
 * service, keyed on the school's own web domain — that returns the icon the school
 * itself publishes, so nothing here is a redrawn or approximated crest.
 *
 * The service does not have a high-resolution icon for every school. Measured
 * across these 42 domains on 2026-09-06: 22 come back at 128px, 11 at 32-48px, and
 * 9 only at 16px, which is Google's generic-globe fallback as often as it is a real
 * icon. A 16px globe stretched across a 34px tile looks broken in a way a monogram
 * never does, so LOGO_MIN_PX gates it: the component measures naturalWidth on load
 * and reverts to the monogram below the threshold. Load failures revert the same
 * way. The row therefore degrades to the old behaviour school by school rather than
 * all at once.
 *
 * Setting `logo` to a self-hosted path under `public/schools/` overrides the remote
 * lookup entirely and skips the gate — that is the upgrade path for the schools the
 * favicon service serves badly, and it drops the third-party request too.
 *
 * TRADEMARK NOTE: these are real marks belonging to the schools, shown to identify
 * where our students study. The row carries a "no affiliation or endorsement"
 * line for exactly that reason. Some schools' brand guidelines ask to be asked;
 * `logo`/`domain` are per-school so any one of them can be pulled on request.
 *
 * Entries are a hand-picked subset of the audit, not the whole tail: the point of
 * the row is recognition, so it favours names a nursing student will know, then
 * the domains with the most signups (ECPI 4, Miami Dade / Fatima / Rogers State 3).
 *
 * TWO ENTRIES DO NOT COME FROM THE EMAIL AUDIT THE SAME WAY.
 *
 * UQTR is in the data but was invisible to the domain scan: its one student signed
 * up as @uqtr.com, a typo for the real @uqtr.ca, so it fell outside the .edu/.ca
 * pattern. Cégep de Saint-Hyacinthe appears nowhere in `users` at all — not by
 * domain, not by display name — and is here on the operator's direct knowledge of
 * who is using the product. That is a fair basis for the row, which claims only
 * that students from these schools use it; it is not a basis for SCHOOL_COUNT,
 * which stays tied to what the audit could actually count. Most CEGEP students
 * sign up with personal mail, so email domains will always undercount Quebec.
 */

/** Distinct institutions seen in the 2026-09-06 audit, rounded down. */
export const SCHOOL_COUNT = 180;

/**
 * Words that carry no identity, so they never contribute a monogram letter.
 * "University of Miami" is UM, not UOM.
 */
const MONOGRAM_STOPWORDS = new Set([
  'of', 'the', 'at', 'and', 'for', 'de', 'du', 'la', 'le', 'les', 'des', 'à'
]);

/**
 * Initials for the tile. Capped at three letters because a four-letter monogram
 * stops reading as a mark and starts reading as an acronym the student has to
 * decode — the full name is right next to it anyway.
 */
export const monogram = (name = '') => {
  const letters = String(name)
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)
    .filter((word) => !MONOGRAM_STOPWORDS.has(word.toLowerCase()))
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return letters.slice(0, 3) || '?';
};

/**
 * Tile colours. Six warm/lavender hues drawn from the app palette rather than any
 * school's real brand colour — using the actual colours would push the row back
 * toward looking like an endorsement, and a coherent set reads better as a wall.
 */
const TILE_COLORS = ['#e88d7d', '#c4907f', '#b8a5d4', '#8fa8b8', '#d4a373', '#a3b18a'];

/**
 * Stable colour per school. Index-based assignment would reshuffle the whole row
 * whenever a school is inserted mid-list, so hash the name instead: an entry keeps
 * its colour for as long as its name does.
 */
export const tileColor = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return TILE_COLORS[hash % TILE_COLORS.length];
};

/**
 * Below this pixel width an icon is either Google's generic globe or a 16px .ico
 * that turns to mush on a 34px tile. Measured, not guessed: every domain in the
 * list that came back under 32px was one of those two cases.
 */
export const LOGO_MIN_PX = 32;

/**
 * Where to fetch a school's mark. A self-hosted `logo` always wins; otherwise the
 * school's own favicon, requested at 128px so high-resolution icons arrive at full
 * quality rather than upscaled from the 16px default.
 */
export const logoUrl = (school = {}) => {
  if (school.logo) return school.logo;
  if (!school.domain) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(school.domain)}&sz=128`;
};

/**
 * @typedef {Object} School
 * @property {string}  name   Full name, shown beside the tile.
 * @property {string}  short  Name used in the row (some full names are too long to scan).
 * @property {string} [mark]  Monogram override, used verbatim — so it may run past three
 *                            letters where four are the school's own mark (TCNJ, CWRU).
 * @property {string}  domain The school's own web domain — the key the favicon
 *                            lookup uses, and not always the email domain students
 *                            sign up with (Miami Dade mails from mymdc.net, but the
 *                            site is mdc.edu).
 * @property {string} [logo]  Self-hosted path under /schools/. Overrides `domain`.
 */

/** @type {School[]} */
export const LANDING_SCHOOLS = [
  { name: 'Johns Hopkins University', domain: 'jhu.edu', short: 'Johns Hopkins' },
  { name: 'Northeastern University', domain: 'northeastern.edu', short: 'Northeastern' },
  { name: 'Rutgers University', domain: 'rutgers.edu', short: 'Rutgers' },
  { name: 'Drexel University', domain: 'drexel.edu', short: 'Drexel' },
  { name: 'Tulane University', domain: 'tulane.edu', short: 'Tulane' },
  { name: 'University of Miami', domain: 'miami.edu', short: 'Miami' },
  { name: 'Clemson University', domain: 'clemson.edu', short: 'Clemson' },
  { name: 'University of Washington', domain: 'uw.edu', short: 'Washington' },
  { name: 'Boston College', domain: 'bc.edu', short: 'Boston College' },
  { name: 'Case Western Reserve University', domain: 'case.edu', short: 'Case Western', mark: 'CWRU' },
  { name: 'Arizona State University', domain: 'asu.edu', short: 'Arizona State' },
  { name: 'University of Arizona', domain: 'arizona.edu', short: 'Arizona' },
  { name: 'Kent State University', domain: 'kent.edu', short: 'Kent State' },
  { name: 'University of Houston', domain: 'uh.edu', short: 'Houston' },
  { name: 'Oklahoma State University', domain: 'okstate.edu', short: 'Oklahoma State' },
  { name: 'Appalachian State University', domain: 'appstate.edu', short: 'Appalachian State' },
  { name: 'Montclair State University', domain: 'montclair.edu', short: 'Montclair State' },
  { name: 'Rowan University', domain: 'rowan.edu', short: 'Rowan' },
  { name: 'Duquesne University', domain: 'duq.edu', short: 'Duquesne' },
  { name: 'Simmons University', domain: 'simmons.edu', short: 'Simmons' },
  { name: 'The College of New Jersey', domain: 'tcnj.edu', short: 'College of New Jersey', mark: 'TCNJ' },
  { name: 'University of South Florida', domain: 'usf.edu', short: 'South Florida' },
  { name: 'University of Kentucky', domain: 'uky.edu', short: 'Kentucky' },
  { name: 'UNC Charlotte', domain: 'charlotte.edu', short: 'UNC Charlotte', mark: 'UNC' },
  { name: 'Western Governors University', domain: 'wgu.edu', short: 'Western Governors' },
  { name: 'Purdue University Global', domain: 'purdueglobal.edu', short: 'Purdue Global', mark: 'PG' },
  { name: 'ECPI University', domain: 'ecpi.edu', short: 'ECPI', mark: 'ECPI' },
  { name: 'Keiser University', domain: 'keiseruniversity.edu', short: 'Keiser' },
  { name: 'Herzing University', domain: 'herzing.edu', short: 'Herzing' },
  { name: 'Grand Canyon University', domain: 'gcu.edu', short: 'Grand Canyon' },
  { name: 'Ivy Tech Community College', domain: 'ivytech.edu', short: 'Ivy Tech' },
  { name: 'Austin Community College', domain: 'austincc.edu', short: 'Austin CC' },
  { name: 'Miami Dade College', domain: 'mdc.edu', short: 'Miami Dade' },
  { name: 'Rogers State University', domain: 'rsu.edu', short: 'Rogers State' },
  { name: 'Utica University', domain: 'utica.edu', short: 'Utica' },
  { name: 'York University', domain: 'yorku.ca', short: 'York' },
  { name: 'St. Lawrence College', domain: 'stlawrencecollege.ca', short: 'St. Lawrence' },
  { name: 'University of Windsor', domain: 'uwindsor.ca', short: 'Windsor' },
  { name: 'Université du Québec à Trois-Rivières', domain: 'uqtr.ca', short: 'UQTR', mark: 'UQTR' },
  { name: 'Cégep de Saint-Hyacinthe', domain: 'cegepsth.qc.ca', short: 'Cégep Saint-Hyacinthe' },
  { name: 'Birmingham City University', domain: 'bcu.ac.uk', short: 'Birmingham City' },
  { name: 'Our Lady of Fatima University', domain: 'fatima.edu.ph', short: 'Our Lady of Fatima' },
  { name: 'Adamson University', domain: 'adamson.edu.ph', short: 'Adamson' },
  { name: 'Xavier University – Ateneo de Cagayan', domain: 'xu.edu.ph', short: 'Xavier University', mark: 'XU' }
];

/** How many rows the wall is split across. */
export const MARQUEE_ROWS = 3;

/**
 * How many times each row's schools are repeated inside its track.
 *
 * The loop works by translating the track left by exactly one copy's width, which
 * only looks seamless while the remaining copies still cover the viewport. Two
 * copies were enough when all 42 schools shared one row (~7,000px a copy); split
 * three ways a copy is nearer 2,500px, which a wide monitor would out-run and
 * expose the gap. Three copies buys back the margin. Keep in step with the
 * translate distance in SchoolMarquee.css — one copy is 100/3%.
 */
export const MARQUEE_COPIES = 3;

/**
 * Deal the schools across the rows round-robin rather than slicing them into
 * blocks. A sliced list would stack the big-name universities at the top of the
 * wall and the community colleges at the bottom, which reads like a ranking;
 * dealing keeps every row a mix, which is the honest picture of who uses this.
 */
export const rowsOf = (schools = LANDING_SCHOOLS, rowCount = MARQUEE_ROWS) => {
  const rows = Array.from({ length: Math.max(1, rowCount) }, () => []);
  schools.forEach((school, i) => rows[i % rows.length].push(school));
  return rows.filter((row) => row.length > 0);
};

/**
 * Seconds for one full pass. Derived from the item count so the row moves at a
 * constant *pixels per second* no matter how many schools are in the list —
 * a fixed duration would make the loop sprint every time a school is added.
 */
export const marqueeDuration = (count, secondsPerItem = 3.6) =>
  Math.max(20, Math.round(count * secondsPerItem));

/**
 * Per-row speed trim. Rows of equal length moving at an identical rate stay in
 * lockstep forever, and the eye reads three synchronised rows as one grid sliding
 * sideways rather than as a wall. Detuning each row slightly breaks the alignment
 * up without any row looking obviously fast or slow.
 */
const ROW_SPEED_FACTORS = [1, 1.18, 0.88];

export const rowDuration = (count, rowIndex = 0) =>
  Math.max(20, Math.round(marqueeDuration(count) * ROW_SPEED_FACTORS[rowIndex % ROW_SPEED_FACTORS.length]));

/**
 * Rows alternate direction. Everything drifting the same way looks like a single
 * sheet on the move; opposing rows read as separate bands and hold the eye longer.
 */
export const rowReversed = (rowIndex = 0) => rowIndex % 2 === 1;

/**
 * The track repeats its schools MARQUEE_COPIES times so a copy is always in frame
 * when the previous one scrolls out. Only the first copy is announced; the rest are
 * decorative repeats of the same names.
 */
export const marqueeTrack = (schools = LANDING_SCHOOLS, copies = MARQUEE_COPIES) => {
  const out = [];
  for (let copy = 0; copy < Math.max(1, copies); copy += 1) {
    schools.forEach((school, i) => {
      out.push({ ...school, key: `${copy}-${i}`, duplicate: copy > 0 });
    });
  }
  return out;
};
