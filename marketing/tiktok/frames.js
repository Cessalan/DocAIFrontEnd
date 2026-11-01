/**
 * Pulls still frames out of a rendered video for review, without ffmpeg.
 *   node marketing/tiktok/frames.js 01-digoxin 1 6 11 15 19
 * Writes marketing/tiktok/out/frames/<id>-<sec>s.png
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

(async () => {
  const [id, ...secs] = process.argv.slice(2);
  const src = path.join(__dirname, 'out', `${id}.mp4`);
  const dir = path.join(__dirname, 'out', 'frames');
  fs.mkdirSync(dir, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 540, height: 960 });
  await page.goto(`file:///${src.replace(/\\/g, '/')}`);
  await page.waitForSelector('video');
  const duration = await page.evaluate(() => new Promise((r) => {
    const v = document.querySelector('video');
    const done = () => r(v.duration);
    if (v.readyState >= 1) done(); else v.addEventListener('loadedmetadata', done);
  }));
  console.log(`duration ${duration.toFixed(1)}s`);
  await page.addStyleTag({ content: 'body{margin:0;background:#000} video{width:540px;height:960px;object-fit:contain}' });
  for (const s of secs) {
    await page.evaluate((t) => new Promise((r) => {
      const v = document.querySelector('video');
      v.pause();
      v.addEventListener('seeked', () => setTimeout(r, 150), { once: true });
      v.currentTime = t;
    }), Number(s));
    const out = path.join(dir, `${id}-${s}s.png`);
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 540, height: 960 } });
    console.log(out);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
