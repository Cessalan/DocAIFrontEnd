/* Render the real initial product UI into each public route. Firebase Hosting
 * serves these files before its SPA fallback; React takes over on load. */
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { pages } = require('../src/Components/SeoPractice/catalog.json');
const root = path.resolve(__dirname, '..');
const build = path.join(root, 'build');
const cache = path.join(root, 'node_modules/.cache/seo-products');
const esc = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function main() {
  if (!fs.existsSync(path.join(build, 'index.html'))) throw new Error('Build the React app before generating SEO pages.');
  fs.mkdirSync(cache, { recursive: true });
  await esbuild.build({ entryPoints: [path.join(__dirname, 'render-seo-products.jsx')], outfile: path.join(cache, 'render.cjs'), bundle: true, platform: 'node', format: 'cjs', packages: 'external', loader: { '.js': 'jsx', '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"production"' } });
  const { renderPage } = require(path.join(cache, 'render.cjs'));
  // Link the product stylesheet before JS paints so the crawlable HTML is also
  // readable on a slow connection or with scripting disabled.
  const css = fs.readFileSync(path.join(root, 'src/Components/SeoPractice/SeoMiniProduct.css'), 'utf8');
  const base = fs.readFileSync(path.join(build, 'index.html'), 'utf8')
    .replace(/og-image-main\.jpg/g, 'LogoSimple.png')
    .replace(/\/NQWarmLogo\.png/g, '/LogoSimple.png')
    .replace(/href="\/favicon\.svg"/g, 'href="/seo-heart.svg"')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<body\b[^>]*>[\s\S]*?<\/body>/i, '<body><div id="root"></div></body>')
    .replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<meta\b[^>]*(?:name=["'](?:description|keywords|twitter:title|twitter:description)["']|property=["']og:(?:title|description|url)["'])[^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '');
  for (const page of pages) {
    const url = `https://nursequizai.com/${page.slug}`;
    const html = base.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(page.title)} | NurseQuiz</title>`)
      .replace('</head>', `<meta name="description" content="${esc(page.description)}"><link rel="canonical" href="${url}"><meta property="og:title" content="${esc(page.title)}"><meta property="og:description" content="${esc(page.description)}"><meta property="og:url" content="${url}"><meta name="twitter:title" content="${esc(page.title)}"><meta name="twitter:description" content="${esc(page.description)}"><style>${css}</style></head>`)
      .replace(/<div id="root"><\/div>/, () => `<div id="root">${renderPage(page.slug)}</div>`);
    if (!html.includes('<h1>') || !html.includes('id="mini-product"') || /id=["']seo-fallback["']/.test(html) || !html.includes('/static/js/main.')) throw new Error(`Invalid rendered product: ${page.slug}`);
    fs.writeFileSync(path.join(build, `${page.slug}.html`), html);
  }
  const sitemapPath = path.join(build, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const missing = pages.filter(page => !sitemap.includes(`https://nursequizai.com/${page.slug}</loc>`));
  sitemap = sitemap.replace('</urlset>', `${missing.map(page => `<url><loc>https://nursequizai.com/${page.slug}</loc></url>`).join('\n')}\n</urlset>`);
  fs.writeFileSync(sitemapPath, sitemap);
  console.log(`Rendered ${pages.length} crawlable SEO mini-products with canonical metadata and internal links.`);
}
main().catch(error => { console.error(error); process.exit(1); });
