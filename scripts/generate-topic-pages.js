/**
 * generate-topic-pages.js
 * Writes one static landing page per entry in scripts/seo-topics.js, plus a
 * hub page linking them all, and adds any missing URLs to public/sitemap.xml.
 *
 * Static HTML in public/, not React routes: the SPA-shell pages were never
 * indexed, the hand-authored ones were. The look is borrowed from the existing
 * sata-questions-nclex.html stylesheet so the pages read as one site.
 *
 *   node scripts/generate-topic-pages.js
 *
 * Re-running is safe: pages are overwritten and sitemap entries are only
 * added once.
 */
const fs = require('fs');
const path = require('path');
const topics = require('./seo-topics');

const PUBLIC = path.join(__dirname, '..', 'public');
const SITE = 'https://nursequizai.com';
const HUB_SLUG = 'nclex-practice-questions-by-topic';
const TODAY = new Date().toISOString().slice(0, 10);

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const baseCss = (() => {
  const src = fs.readFileSync(path.join(PUBLIC, 'sata-questions-nclex.html'), 'utf8');
  const m = src.match(/<style>([\s\S]*?)<\/style>/);
  return m ? m[1] : '';
})();

const extraCss = `
    .q { background: white; border: 1px solid rgba(0,0,0,0.06); border-radius: 16px; padding: 20px; margin: 16px 0; }
    .q-meta { font-size: 12px; font-weight: 600; color: var(--primary-coral); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
    .q-stem { font-weight: 600; margin-bottom: 10px; }
    .q ol { margin: 0 0 12px 22px; color: var(--text-secondary); font-size: 15px; }
    .q li { margin-bottom: 6px; }
    .q details summary { cursor: pointer; color: var(--primary-coral); font-weight: 600; font-size: 14px; }
    .q details[open] summary { margin-bottom: 10px; }
    .q .r { font-size: 14px; color: var(--text-secondary); margin: 6px 0; }
    .q .r.ok strong { color: #16a34a; }
    .topic-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin: 20px 0; }
    .topic-grid a { display: block; background: white; border: 1px solid rgba(0,0,0,0.06); border-radius: 16px; padding: 18px; color: var(--text-primary); }
    .topic-grid a:hover { border-color: var(--primary-coral); }
    .topic-grid span { display: block; font-size: 13px; color: var(--text-muted); margin-top: 4px; }`;

const letter = (i) => String.fromCharCode(65 + i);

const clarity = (slug) => `
  <script>
    if (!/^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname)) {
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "wjgn4x5pp6");
      clarity('set', 'landing_page', '${slug}');
      clarity('set', 'exam', 'NCLEX');
      clarity('set', 'page_kind', 'static_seo');
    }
  </script>`;

const head = ({ slug, title, description, jsonLd }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="/favicon.svg">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${SITE}/${slug}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Kalam:wght@400;700&display=swap" rel="stylesheet">
${jsonLd.map((j) => `  <script type="application/ld+json">\n${JSON.stringify(j, null, 2)}\n  </script>`).join('\n')}
  <style>${baseCss}${extraCss}
  </style>${clarity(slug)}
</head>`;

const cta = (t, headline, sub) => `
    <div class="cta-section">
      <div class="cta-headline">${esc(headline)}</div>
      <div class="cta-subtext">${esc(sub)}</div>
      <a href="/signup?returnTo=${encodeURIComponent(t.ctaPath || `/nclex/practice?subject=${t.subject}`)}" class="btn-primary">Practise ${esc(t.topic)} Free</a>
      <div class="no-cc">No credit card required. 50 free questions every 30 days.</div>
    </div>`;

const question = (q, i) => {
  const isSata = q.type === 'sata';
  return `
      <div class="q">
        <div class="q-meta">Question ${i + 1} · ${isSata ? 'Select all that apply' : 'Multiple choice'}</div>
        <div class="q-stem">${esc(q.stem)}</div>
        <ol type="A">
${q.options.map((o) => `          <li>${esc(o)}</li>`).join('\n')}
        </ol>
        <details>
          <summary>Show answer and rationale</summary>
          <p class="r"><strong>Answer: ${q.correct.map(letter).join(', ')}</strong></p>
${q.rationale.map((r, j) => `          <p class="r${q.correct.includes(j) ? ' ok' : ''}"><strong>${letter(j)}.</strong> ${esc(r)}</p>`).join('\n')}
        </details>
      </div>`;
};

function topicPage(t) {
  const others = topics.filter((o) => o.slug !== t.slug);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: t.title,
      description: t.description,
      author: { '@type': 'Organization', name: 'NurseQuizAI' },
      publisher: { '@type': 'Organization', name: 'NurseQuizAI', logo: { '@type': 'ImageObject', url: `${SITE}/favicon.svg` } },
      datePublished: TODAY,
      dateModified: TODAY,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: t.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ];
  return `${head({ ...t, jsonLd })}
<body>
  <div class="card">
    <div class="header">
      <img src="/favicon.svg" alt="NurseQuizAI logo" class="logo">
      <span class="brand-name">NurseQuizAI</span>
    </div>

    <div class="eyebrow">${esc(t.eyebrow || `Free NCLEX practice · ${t.topic}`)}</div>
    <h1>${t.h1 ? esc(t.h1) : `NCLEX <span class="highlight">${esc(t.topic)}</span> Practice Questions`}</h1>
${t.intro.map((p) => `    <p class="lead">${p}</p>`).join('\n')}
${cta(t, `Want more ${t.topic.toLowerCase()} questions?`, 'Upload your lecture slides or notes and get NCLEX-style questions written from them, with rationales.')}

    <div class="content-section">
      <h2>${esc(t.testsHeading || `What the NCLEX tests in ${t.topic.toLowerCase()}`)}</h2>
      <ul>
${t.tests.map((x) => `        <li>${esc(x)}</li>`).join('\n')}
      </ul>
    </div>

    <div class="content-section">
      <h2>${t.questions.length} ${esc(t.topic.toLowerCase())} practice questions with rationales</h2>
      <p>Answer each one before opening the rationale. Every option is explained, including the wrong ones.</p>
${t.questions.map(question).join('\n')}
    </div>

    <div class="content-section">
      <h2>${esc(t.tipsHeading || `How to study ${t.topic.toLowerCase()} for the NCLEX`)}</h2>
      <div class="tips-list">
        <ol>
${t.tips.map((x) => `          <li>${esc(x)}</li>`).join('\n')}
        </ol>
      </div>
    </div>

    <div class="faq">
      <h3>Frequently asked questions</h3>
${t.faq.map(([q, a]) => `      <div class="faq-item">\n        <strong>${esc(q)}</strong>\n        <p>${esc(a)}</p>\n      </div>`).join('\n')}
    </div>
${cta(t, `Practise ${t.topic.toLowerCase()} on your own material`, 'NurseQuizAI turns your nursing notes into NCLEX-style questions, including select all that apply, and tracks what you keep missing.')}

    <div class="links">
      <a href="/${HUB_SLUG}">All NCLEX topics</a>
${others.map((o) => `      <a href="/${o.slug}">${esc(o.topic)} questions</a>`).join('\n')}
      <a href="/sata-questions-nclex">SATA strategy guide</a>
    </div>
  </div>
<script src="/js/seo-attribution.js" data-slug="${t.slug}" data-cluster="NCLEX" defer></script>
</body>
</html>
`;
}

function hubPage() {
  const title = 'Free NCLEX Practice Questions by Topic (With Rationales)';
  const description = 'Free NCLEX practice questions organised by topic: pharmacology, cardiac, respiratory, electrolytes, diabetes, maternity, pediatrics, mental health, prioritization and infection control.';
  const jsonLd = [{
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    hasPart: topics.map((t) => ({ '@type': 'WebPage', name: t.title, url: `${SITE}/${t.slug}` })),
  }];
  const hubCta = { subject: 'pharmacology', topic: 'NCLEX' };
  return `${head({ slug: HUB_SLUG, title, description, jsonLd })}
<body>
  <div class="card">
    <div class="header">
      <img src="/favicon.svg" alt="NurseQuizAI logo" class="logo">
      <span class="brand-name">NurseQuizAI</span>
    </div>

    <div class="eyebrow">Free NCLEX practice</div>
    <h1>NCLEX Practice Questions <span class="highlight">by Topic</span></h1>
    <p class="lead">Pick a topic. Each page has five worked NCLEX-style questions, multiple choice and select all that apply, with a rationale for every option.</p>

    <div class="topic-grid">
${topics.map((t) => `      <a href="/${t.slug}">${esc(t.topic)}<span>${esc(t.tests.slice(0, 2).join(' · '))}</span></a>`).join('\n')}
    </div>
${cta(hubCta, 'Questions from your own notes', 'Upload your lecture slides and NurseQuizAI writes NCLEX-style questions on exactly what your exam covers.')}

    <div class="links">
      <a href="/sata-questions-nclex">SATA strategy guide</a>
      <a href="/nclex-next-gen-guide">Next Gen NCLEX guide</a>
      <a href="/clinical-judgment-nclex">Clinical judgment on NCLEX</a>
    </div>
  </div>
<script src="/js/seo-attribution.js" data-slug="${HUB_SLUG}" data-cluster="NCLEX" defer></script>
</body>
</html>
`;
}

for (const t of topics) {
  fs.writeFileSync(path.join(PUBLIC, `${t.slug}.html`), topicPage(t));
}
fs.writeFileSync(path.join(PUBLIC, `${HUB_SLUG}.html`), hubPage());

/* The SATA guide ranks around position 25 for "nclex sata questions" but had
   one example question. Fill its marked slot with the select-all questions
   from the topic pages, one per topic, so the page answers the search. */
const sataPath = path.join(PUBLIC, 'sata-questions-nclex.html');
let sata = fs.readFileSync(sataPath, 'utf8');
const sataQs = topics
  .map((t) => ({ t, q: t.questions.find((q) => q.type === 'sata') }))
  .filter((x) => x.q);
const sataBlock = `<!-- sata-practice:start -->
    <div class="content-section">
      <h2>${sataQs.length} free NCLEX SATA practice questions</h2>
      <p>Use the true/false method on every option, then open the rationale. Each question links to more practice on its topic.</p>
${sataQs.map(({ t, q }, i) => question(q, i).replace('</details>', `</details>\n        <p class="r"><a href="/${t.slug}">More ${esc(t.topic.toLowerCase())} questions →</a></p>`)).join('\n')}
    </div>
    <!-- sata-practice:end -->`;
sata = sata.replace(/<!-- sata-practice:start -->[\s\S]*?<!-- sata-practice:end -->/, sataBlock);
sata = sata.replace(/\/\* sata-practice-css \*\/[\s\S]*?(?=\n  <\/style>)/, `/* sata-practice-css */${extraCss}`);
fs.writeFileSync(sataPath, sata);

const sitemapPath = path.join(PUBLIC, 'sitemap.xml');
let sitemap = fs.readFileSync(sitemapPath, 'utf8');
const added = [];
for (const slug of [HUB_SLUG, ...topics.map((t) => t.slug)]) {
  const loc = `${SITE}/${slug}`;
  if (sitemap.includes(`<loc>${loc}</loc>`)) continue;
  added.push(`  <url>\n    <loc>${loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`);
}
if (added.length) {
  sitemap = sitemap.replace('</urlset>', `  <!-- NCLEX topic practice pages (scripts/generate-topic-pages.js) -->\n${added.join('\n')}\n</urlset>`);
  fs.writeFileSync(sitemapPath, sitemap);
}
console.log(`Wrote ${topics.length + 1} pages, added ${added.length} sitemap entries.`);
