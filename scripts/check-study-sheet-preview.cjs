// Run against preview-study-sheet.cjs. All records are fictional and local.
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.STUDY_QA_PLAYWRIGHT || 'playwright');
const output = path.resolve(process.argv[2]);
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1050 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4188');
  await page.getByRole('button', { name: 'Download PDF' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  if (await page.locator('.study-sheet-simple-wrapper img').count()) throw new Error('Chat sheet should not contain a logo');
  if (await page.getByRole('navigation', { name: 'Study sheet sections' }).isVisible()) throw new Error('Contents should start collapsed');
  await page.screenshot({ path: path.join(output, 'chat-light.png'), fullPage: true });
  const pdf = await page.evaluate(() => window.makePDF());
  fs.writeFileSync(path.join(output, 'study-sheet.pdf'), Buffer.from(pdf));
  const stress = await page.evaluate(async () => {
    const sample = structuredClone(window.sampleSheet);
    sample.language = 'french'; sample.title = 'Évaluation rénale : μ, ≤ et ≥';
    sample.sections = [{ id: 'stress', title: 'Long tableau et continuité', blocks: [{ kind: 'table',
      columns: ['Concept', 'Explication détaillée', 'À retenir'],
      rows: Array.from({ length: 35 }, (_, i) => [`Élément ${i + 1}`, i === 4 ? 'Une explication longue qui continue sur plusieurs pages. '.repeat(90) : 'Une explication claire, avec des accents français et des symboles : μ ≤ ≥.', 'Révision ciblée.']) },
      { kind: 'callout', tone: 'takeaway', title: 'Longue explication', text: 'Une idée complète à comprendre et à expliquer. '.repeat(140) }]}];
    return window.makePDF(sample);
  });
  fs.writeFileSync(path.join(output, 'stress-french.pdf'), Buffer.from(stress));
  if (process.env.STUDY_QA_REAL_FIXTURES) {
    for (const name of ['focused-statistics', 'french-history']) {
      const sheet = JSON.parse(fs.readFileSync(path.join(process.env.STUDY_QA_REAL_FIXTURES, name + '.json'), 'utf8'));
      const bytes = await page.evaluate(async value => { window.renderSheet(value); return window.makePDF(value); }, sheet);
      await page.getByRole('heading', { name: sheet.title, exact: true }).waitFor();
      fs.writeFileSync(path.join(output, name + '.pdf'), Buffer.from(bytes));
      await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true });
    }
  }
  await page.goto('http://127.0.0.1:4188?dark');
  await page.getByRole('button', { name: 'Download PDF' }).waitFor();
  await page.screenshot({ path: path.join(output, 'chat-dark.png'), fullPage: true });
  await page.goto('http://127.0.0.1:4188?dark&legacy');
  await page.getByRole('button', { name: 'Download PDF' }).waitFor();
  await page.screenshot({ path: path.join(output, 'chat-legacy-dark.png'), fullPage: true });
  await page.locator('.sheet-contents > summary').click();
  const navigation = page.getByRole('navigation', { name: 'Study sheet sections' });
  if (await navigation.getByRole('link').count() !== 14) throw new Error('All legacy sections should remain accessible');
  await page.screenshot({ path: path.join(output, 'chat-legacy-contents.png') });
  await navigation.getByRole('link', { name: /Rapid progressive glomerulonephritis \(RPGN\)/ }).click();
  if (await navigation.isVisible()) throw new Error('Contents should collapse after navigation');
  const targetVisible = await page.getByRole('button', { name: /Rapid progressive glomerulonephritis \(RPGN\)/ }).evaluate(element => {
    const bounds = element.getBoundingClientRect(); return bounds.top >= 0 && bounds.top < window.innerHeight;
  });
  if (!targetVisible) throw new Error('Section navigation should scroll to the chosen heading');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4188?fr');
  await page.getByRole('button', { name: 'Télécharger le PDF' }).waitFor();
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  await page.screenshot({ path: path.join(output, 'chat-mobile.png'), fullPage: true });
  await browser.close();
  if (!fits || errors.length) throw new Error(JSON.stringify({ mobileFits: fits, errors }));
  console.log(JSON.stringify({ mobileFits: fits, browserErrors: errors, output }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
