/**
 * Renders a "printed question on a desk" photo-like still (720x1280) for
 * image-to-video generation. The question text must be exact, so we draw it
 * ourselves and let the video model only animate the hand.
 *   node marketing/tiktok/sheet.js daily-001-heparin
 * Output: out/sheets/<id>.png
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const posts = require('./daily');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

(async () => {
  const spec = posts.find((p) => p.id === process.argv[2]);
  if (!spec) throw new Error('unknown id');
  const dir = path.join(__dirname, 'out', 'sheets');
  fs.mkdirSync(dir, { recursive: true });
  const opts = spec.options.map((o, i) => `<li><b>${String.fromCharCode(65 + i)}.</b> ${o}</li>`).join('');
  const html = `<!doctype html><html><body style="margin:0;width:720px;height:1280px;overflow:hidden;
    background:radial-gradient(ellipse at 40% 35%, #c8a27a 0%, #a77b52 55%, #7d5636 100%);">
    <div style="position:absolute;inset:0;background:repeating-linear-gradient(97deg,rgba(0,0,0,0.04) 0 3px,transparent 3px 11px);"></div>
    <div style="position:absolute;left:70px;top:150px;width:580px;height:860px;background:#fbfaf6;transform:rotate(-2.2deg);
      box-shadow:0 18px 40px rgba(0,0,0,0.35);padding:56px 50px;box-sizing:border-box;font-family:'Times New Roman',Georgia,serif;color:#1d1d1d;">
      <div style="font-size:19px;letter-spacing:1px;color:#555;border-bottom:1px solid #999;padding-bottom:10px;margin-bottom:34px;">
        NUR 2210 · Pharmacology · Unit 4 Practice</div>
      <div style="font-size:31px;line-height:1.35;margin-bottom:34px;"><b>12.</b> ${spec.stem}</div>
      <ol style="list-style:none;padding:0;margin:0;font-size:30px;line-height:2.05;">${opts}</ol>
    </div>
    <div style="position:absolute;left:520px;top:1040px;width:230px;height:16px;background:linear-gradient(#2b4fa0,#1c3576);
      border-radius:8px;transform:rotate(-28deg);box-shadow:0 6px 10px rgba(0,0,0,0.3);"></div>
  </body></html>`;
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 720, height: 1280 });
  await page.setContent(html);
  const out = path.join(dir, `${spec.id}.png`);
  await page.screenshot({ path: out });
  await browser.close();
  console.log(out);
})().catch((e) => { console.error(e); process.exit(1); });
