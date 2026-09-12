# SEO mini-products

Nine public routes are defined in `src/Components/SeoPractice/catalog.json`. They share the existing Outfit/Caveat typography, paper surfaces, coral light-theme and lavender dark-theme accents. Tools provide results before asking for an account.

## Build and verify

Run `npm run build`, then `node scripts/check-seo-html.cjs`. The final build step renders each route to `build/<slug>.html` with its real initial content, canonical URL, unique description, WebPage/Breadcrumb structured data, FAQs and normal anchor links. Firebase Hosting's existing `cleanUrls` setting serves these files ahead of the SPA fallback. The build sitemap includes all nine routes. Do not deploy a raw CRA build that skips the post-build generator.

Use `node scripts/preview-seo-build.cjs` for a local production preview on port 4185. Interactive checks: `npm test -- --watchAll=false --runInBand --testPathPattern=SeoPractice`.

## Product behavior

- Planner: RN/PN, dated or 2/4/8-week horizon, daily time, priority topics, dated schedule and checkoffs. Anonymous progress stays in browser storage; signed-in saves use `users/{uid}/seoMiniProducts/{slug}`. "Save my plan" and day-level practice hand off to `/nclex/start`, which writes the exam date and track to `nclexMeta/profile` and proposes today's session; `/nclex` then shows a "Today in your plan" card. Existing account limits remain authoritative.
- Diagnostics: small original MCQ/SATA samples, rationale after submission, factual results and missed concepts. A perfect result has no invented weakness; zero correct has no invented strength. Samples are not comprehensive exams or readiness predictions.
- Handoff to `/nclex` (NCLEX cluster and the nursing-school subject pages only; HESI pages keep the chat handoff): `SeoPractice/seoToNclex.js` maps each catalog question to a curriculum subject/area/client-needs category, builds a practice intent, and `Services/NclexHandoffService.js` commits it after auth — the landing answers are seeded into `nclexAttempts` as `source: 'seo-sample'` rows with deterministic ids, and the missed concepts are stored in `nclexMeta/profile.seoContext` and appended to the generator's instructions for 14 days or until the log has its own evidence (`Nclex/nclexHandoff.js`).
- A2 guide: topic review followed by a recall check, separate from nursing HESI practice.
- Learning references are stored beside the question bank. These are original sample items, not recalled exam questions. They have not undergone independent clinical editorial review.

## Measurement

`funnelEvents` contains `seo_page_viewed`, `seo_primary_cta_clicked`, `seo_mini_product_started`, `seo_mini_product_completed`, `seo_result_viewed`, `seo_nursequiz_cta_clicked` (with `destination: nclex|chat`), `seo_signup`, `seo_nclex_arrived` and `seo_nclex_session_started`. Rows carry first-touch `landingPage`, `keywordCluster`, `source`, `campaign`, and a 30-day browser `funnelId`; `productPage` identifies the current tool. Localhost analytics are suppressed. Count distinct funnel IDs per step so reloads/retries do not inflate conversion rates. First-touch attribution is approximate across devices or cleared storage.

At authentication, attribution is saved to `users/{uid}/seoAttribution/firstTouch` without creating a root user document or bypassing onboarding. Returning-user sign-ins preserve attribution without emitting a signup.

The backend Stripe logger adds `seoConversion` to paid, positive-value `checkout.session.completed` billing events. Existing event IDs provide deduplication; `amountTotal` and `currency` come from Stripe. This measures initial paid-checkout revenue, not renewal revenue or net revenue after refunds. Attribute only conversions whose funnel ID belongs to the selected organic landing cohort. Keep currencies separate and convert Stripe minor units using each currency's exponent.

For each landing page and keyword cluster, report distinct organic visitors, starts, completions, results, product clicks, signups and paid checkouts. Revenue per 1,000 organic visitors = cohort-attributed paid-checkout revenue / distinct organic funnel IDs with a page view × 1,000. Use a fixed acquisition-date cohort and allow a conversion window; otherwise recent cohorts will appear artificially weak.

Search impressions, actual query rankings and CTR require Search Console; browser attribution cannot provide those. After deployment, submit the sitemap and inspect these URLs in Search Console. Indexing and rankings are not guaranteed. No deployment, production payment, Search Console configuration or live conversion verification was performed as part of this local implementation.
