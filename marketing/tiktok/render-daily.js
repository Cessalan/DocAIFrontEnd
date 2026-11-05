/**
 * Renders marketing/tiktok/daily.js into finished 1080x1920 MP4s: real footage
 * from out/stock/<clip>/clip.mp4 with the question as static text in the style
 * of TikTok's own text tool (white on dark rounded boxes). Deliberately plain:
 * the earlier designed cards looked generated, and the outliers that work are
 * raw phone footage with static text.
 *
 *   node marketing/tiktok/render-daily.js                    # all
 *   node marketing/tiktok/render-daily.js daily-001-heparin  # one
 *
 * Same recording approach as render.js: canvas + MediaRecorder in the system
 * Edge, which can encode MP4. Output: out/<id>.mp4. Text stays inside TikTok's
 * safe area (clear of the bottom caption and the right-hand button rail).
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const posts = require('./daily');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = path.join(__dirname, 'out');
const SECONDS = 9;

function draw() {
  /* Runs in the page; `spec` and `SECONDS` are injected. */
  const W = 1080, H = 1920, LEFT = 70, MAXW = 860;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const video = document.getElementById('v');

  function cover() {
    const vw = video.videoWidth, vh = video.videoHeight;
    const s = Math.max(W / vw, H / vh);
    const dw = vw * s, dh = vh * s;
    ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }
  function wrap(text, font, width) {
    ctx.font = font;
    const out = []; let line = '';
    for (const w of text.split(' ')) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > width && line) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
    return out;
  }
  // TikTok's "background" text style: each line sits on its own rounded box.
  function boxedLines(lines, font, y, lh) {
    ctx.font = font; ctx.textBaseline = 'middle';
    for (const l of lines) {
      const w = ctx.measureText(l).width;
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.beginPath(); ctx.roundRect(LEFT - 18, y - lh / 2, w + 36, lh, 14); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(l, LEFT, y + 2);
      y += lh + 6;
    }
    return y;
  }

  const stemFont = '700 58px "Helvetica Neue", Arial, sans-serif';
  const optFont = '600 50px "Helvetica Neue", Arial, sans-serif';
  const label = `Daily NCLEX Question ${spec.number}`;
  const stemLines = wrap(spec.stem, stemFont, MAXW);
  const optLines = spec.options.flatMap((o, i) => wrap(`${String.fromCharCode(65 + i)}. ${o}`, optFont, MAXW));

  function frame() {
    cover();
    // A light scrim so white text reads on any footage, like a phone filter.
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 0, W, H);
    let y = 300;
    y = boxedLines([label], '700 40px "Helvetica Neue", Arial, sans-serif', y, 62) + 24;
    y = boxedLines(stemLines, stemFont, y, 80) + 30;
    boxedLines(optLines, optFont, y, 72);
  }

  return new Promise((resolve) => {
    const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: 'video/mp4;codecs=avc1.640028', videoBitsPerSecond: 9_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      resolve(btoa(bin));
    };
    video.currentTime = 0;
    video.play();
    frame();
    rec.start();
    const start = performance.now();
    const timer = setInterval(() => {
      frame();
      if ((performance.now() - start) / 1000 >= SECONDS) { clearInterval(timer); video.pause(); rec.stop(); }
    }, 1000 / 30);
  });
}

async function main() {
  const only = process.argv[2];
  const list = only ? posts.filter((p) => p.id === only) : posts;
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true,
    args: ['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
  for (const spec of list) {
    const clip = path.join(OUT, 'stock', spec.clip, 'clip.mp4');
    const html = path.join(OUT, `_${spec.id}.html`);
    fs.writeFileSync(html, `<!doctype html><body style="margin:0"><video id="v" src="${path.relative(OUT, clip).replace(/\\/g, '/')}" muted playsinline loop></video><canvas id="c" width="1080" height="1920"></canvas></body>`);
    const page = await browser.newPage();
    await page.goto(`file:///${html.replace(/\\/g, '/')}`);
    await page.evaluate(() => new Promise((r) => { const v = document.getElementById('v'); if (v.readyState >= 2) r(); else v.addEventListener('loadeddata', r, { once: true }); }));
    const b64 = await page.evaluate(`window.spec = ${JSON.stringify(spec)}; window.SECONDS = ${SECONDS}; (${draw.toString()})()`);
    const file = path.join(OUT, `${spec.id}.mp4`);
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    fs.unlinkSync(html);
    console.log(`${spec.id}.mp4  ${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
    await page.close();
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
