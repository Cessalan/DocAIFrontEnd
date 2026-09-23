/**
 * seo-attribution — first-touch capture for the hand-authored landing pages.
 *
 * The React SEO pages (src/Components/SeoPractice) already call `acquisition()`
 * in Services/SeoMiniProductService.js on arrival, which is what lets
 * `recordSeoSignup` later write users/{uid}/seoAttribution/firstTouch and log a
 * `seo_signup` funnel row. The static pages in public/ never ran any of that, so
 * every signup arriving through them — which is most of the organic traffic —
 * landed with `readLocal('acquisition')` null and `recordSeoSignup` returning
 * early. The pages were invisible to the funnel they feed.
 *
 * This writes the SAME localStorage record, under the same key, in the same
 * shape, so nothing downstream needs to change: the React app picks it up at
 * signup exactly as if she had arrived on a React page.
 *
 * The shape is a contract with `acquisition()` in SeoMiniProductService.js.
 * Change one and you change both: a missing `funnelId` or a renamed
 * `keywordCluster` silently drops these pages back out of the funnel.
 *
 * Usage, once per page, near the end of <body>:
 *   <script src="/js/seo-attribution.js" data-slug="nclex-quiz" data-cluster="NCLEX" defer></script>
 *
 * Deliberately NOT on index.html. `seo_signup` currently means "signed up after
 * arriving on an SEO landing page"; the homepage is where roughly half the
 * clicks land on brand terms, and tagging it would quietly redefine the metric.
 */
(function () {
  var PREFIX = 'nq-seo-v1:';
  var KEY = PREFIX + 'acquisition';
  var THIRTY_DAYS = 30 * 86400000;

  var script = document.currentScript;
  if (!script) return;
  var slug = script.getAttribute('data-slug');
  var cluster = script.getAttribute('data-cluster');
  if (!slug) return;

  var prior = null;
  try {
    prior = JSON.parse(localStorage.getItem(KEY));
  } catch (e) {
    // Private mode, blocked site data, or a value we did not write. Treat as absent.
  }

  // First touch wins for 30 days, matching acquisition(). A student who reads
  // three of these pages before signing up is credited to the one that found her.
  if (prior && prior.at && Date.now() - prior.at < THIRTY_DAYS) return;

  var params = new URLSearchParams(window.location.search);
  var host = '';
  try {
    host = new URL(document.referrer).hostname;
  } catch (e) {
    // Direct visit, or a referrer the browser withheld.
  }

  var utmSource = params.get('utm_source');
  var utmCampaign = params.get('utm_campaign');

  var value = {
    landingPage: slug,
    keywordCluster: cluster || null,
    at: Date.now(),
    funnelId: 'seo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10),
    source: (utmSource && utmSource.slice(0, 80)) ||
      (/google|bing|duckduckgo|yahoo/.test(host) ? 'organic_search' : (host ? 'referral' : 'direct')),
    campaign: (utmCampaign && utmCampaign.slice(0, 80)) || null
  };

  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch (e) {
    // Storage unavailable. Attribution is never worth breaking the page for.
  }
})();
