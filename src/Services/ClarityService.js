/**
 * ClarityService — custom events and tags for Microsoft Clarity.
 *
 * WHY THIS EXISTS
 *
 * Clarity records every session but, out of the box, can only filter them by
 * URL and by clicks. "Show me the students who started an NCLEX session and
 * left after three questions" is not a URL. Clarity's custom events and tags
 * make it one: each shows up under Filters → Custom events / Custom tags in
 * the dashboard, and a recording can be found by them.
 *
 * Funnel steps reach Clarity through FunnelService.logFunnelStep, so every
 * row already written to `funnelEvents` is also a Clarity event of the same
 * name. Call this directly only for things that are NOT funnel steps.
 *
 * Clarity is only initialised in production builds (index.js). In dev,
 * `window.clarity` does not exist and the npm wrapper would throw on it, so
 * every call checks first and swallows failure — analytics must never break
 * a study session.
 */

const ready = () => typeof window !== 'undefined' && typeof window.clarity === 'function';

/** Clarity caps tag values at 255 chars; trim rather than drop. */
const clip = (value) => String(value).slice(0, 255);

/** Record a named moment in the session. Filter: Custom events. */
export const clarityEvent = (name) => {
  try {
    if (ready() && name) window.clarity('event', name);
  } catch { /* Analytics must never interrupt learning. */ }
};

/**
 * Label the whole session. Filter: Custom tags. A tag set later in the
 * session still labels it, and setting the same key twice keeps both values.
 */
export const clarityTag = (key, value) => {
  try {
    if (!ready() || !key || value === null || value === undefined || value === '') return;
    window.clarity('set', key, Array.isArray(value) ? value.map(clip) : clip(value));
  } catch { /* Analytics must never interrupt learning. */ }
};

/**
 * The funnel fields worth filtering on, promoted to tags. Kept to a short,
 * low-cardinality list: a tag per uid or per funnelId would make the filter
 * dropdown useless.
 */
const FUNNEL_TAGS = {
  keywordCluster: 'exam',
  landingPage: 'landing_page',
  source: 'traffic_source',
  entryPoint: 'entry_point',
  paywallReason: 'paywall_reason',
};

export const clarityFunnelStep = (step, props = {}) => {
  clarityEvent(step);
  Object.entries(FUNNEL_TAGS).forEach(([field, tag]) => clarityTag(tag, props[field]));
};
