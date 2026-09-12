const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { pages } = require('../src/Components/SeoPractice/catalog.json');
const root = path.resolve(__dirname, '../build');
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
for (const page of pages) {
  const html = fs.readFileSync(path.join(root, `${page.slug}.html`), 'utf8');
  const canonical = `https://nursequizai.com/${page.slug}`;
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${page.slug}: one H1`);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1, `${page.slug}: one canonical`);
  assert(html.includes(`rel="canonical" href="${canonical}"`));
  assert(html.includes('id="mini-product"'));
  assert(html.includes('class="seo-faq"'));
  assert(!/id=["']seo-fallback["']/.test(html));
  assert(!html.includes('NQWarmLogo.png'));
  assert(!/name="robots" content="noindex/.test(html));
  assert(sitemap.includes(canonical));
  const schema = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
  assert(schema.some(value => value['@type'] === 'WebPage' && value.url === canonical));
  const links = [...html.matchAll(/href="\/([^"?#]+)"/g)].map(m => m[1]);
  assert(links.some(link => pages.some(p => p.slug === link && p.slug !== page.slug)));
}
console.log(`All ${pages.length} pages have unique canonicals, one H1, visible product HTML, valid schema, FAQs, sitemap entries, and related links.`);
