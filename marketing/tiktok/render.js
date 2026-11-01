/**
 * Renders marketing/tiktok/videos.js into 1080x1920 MP4s (9:16, H.264).
 *
 *   node marketing/tiktok/render.js            # all videos
 *   node marketing/tiktok/render.js 03-cdiff   # one video
 *
 * No ffmpeg: each video is drawn on a canvas and recorded in real time by
 * MediaRecorder inside the system Edge, which (unlike puppeteer's bundled
 * Chrome 78) can encode MP4. Output goes to marketing/tiktok/out/.
 *
 * Layout keeps text inside TikTok's safe area: the bottom ~380px and the
 * right ~140px are covered by the caption and the like/comment rail.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const videos = require('./videos');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = path.join(__dirname, 'out');
const logo = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'favicon.svg'), 'utf8');

// Scene timings in seconds.
// ~14s total: in DarkUGC's education data, under-30s videos had the best median views.
const T = { hook: 2.2, question: 4.6, countdown: 2.0, reveal: 3.4, end: 2.0 };

function draw() {
  /* Runs in the page. `spec` and `T` are injected as globals. */
  const W = 1080, H = 1920, X = 90, CW = 830;
  const C = { coral: '#e88d7d', ink: '#3d3d3d', soft: '#6b6b6b', line: 'rgba(0,0,0,0.08)', green: '#16a34a', greenBg: '#e7f6ec' };
  // An 'avoid' question's answer is the harmful action, so it reveals red with a cross.
  const hit = spec.avoid ? { fg: '#dc2626', bg: '#fdecec', mark: '✗' } : { fg: C.green, bg: C.greenBg, mark: '✓' };
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const total = T.hook + T.question + T.countdown + T.reveal + T.end;
  const ease = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

  function wrap(text, font, width) {
    ctx.font = font;
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > width && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  function text(lines, font, x, y, lh, color, align = 'left', alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
    ctx.restore();
    return y + lines.length * lh;
  }
  function rrect(x, y, w, h, r, fill, stroke, lw = 3) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function background() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#fffef9'); g.addColorStop(0.55, '#fff5eb'); g.addColorStop(1, '#fde9df');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function brand() {
    ctx.drawImage(logoImg, X, 150, 64, 64);
    text(['NurseQuizAI'], '700 46px Kalam', X + 80, 158, 50, C.coral);
    ctx.font = '600 28px Outfit';
    const label = `${spec.topic.toUpperCase()} · NCLEX`;
    const w = ctx.measureText(label).width + 44;
    rrect(W - 140 - w, 160, w, 52, 26, 'rgba(232,141,125,0.14)');
    text([label], '600 28px Outfit', W - 140 - w / 2, 172, 30, C.coral, 'center');
  }

  // Pre-measure the question layout once.
  const stemFont = '700 58px Outfit';
  const optFont = '500 44px Outfit';
  const stemLines = wrap(spec.stem, stemFont, CW);
  const opts = spec.options.map((o) => wrap(o, optFont, CW - 150));
  const stemBottom = 300 + stemLines.length * 72 + 40;
  let y = stemBottom;
  const boxes = opts.map((lines) => { const h = 50 + lines.length * 54; const b = { y, h, lines }; y += h + 22; return b; });
  const optsBottom = y;

  function question(t, phase) {
    const tIn = t - T.hook;
    text(stemLines, stemFont, X, 300, 72, C.ink, 'left', ease(tIn / 0.4));
    boxes.forEach((b, i) => {
      const a = ease((tIn - 0.3 - i * 0.25) / 0.3);
      if (a <= 0) return;
      const isRight = i === spec.correct;
      const revealA = phase === 'reveal' ? ease((t - T.hook - T.question - T.countdown) / 0.4) : 0;
      ctx.save(); ctx.globalAlpha = a * (phase === 'reveal' && !isRight ? 1 - 0.6 * revealA : 1);
      const dy = (1 - a) * 30;
      rrect(X, b.y + dy, CW, b.h, 26, isRight && revealA ? hit.bg : '#ffffff', isRight && revealA ? hit.fg : C.line, isRight && revealA ? 5 : 3);
      ctx.beginPath(); ctx.arc(X + 58, b.y + dy + b.h / 2, 30, 0, Math.PI * 2);
      ctx.fillStyle = isRight && revealA ? hit.fg : C.coral; ctx.fill();
      text([isRight && revealA ? hit.mark : String.fromCharCode(65 + i)], '700 34px Outfit', X + 58, b.y + dy + b.h / 2 - 20, 40, '#fff', 'center');
      text(b.lines, optFont, X + 115, b.y + dy + 25, 54, C.ink);
      ctx.restore();
    });
  }

  function frame(t) {
    background();
    brand();
    if (t < T.hook) {
      const a = ease(t / 0.5);
      const lines = wrap(spec.hook, '800 84px Outfit', CW);
      const top = 760 - (lines.length * 100) / 2;
      ctx.save(); ctx.translate(0, (1 - a) * 40);
      text(lines, '800 84px Outfit', W / 2 - 25, top, 100, C.ink, 'center', a);
      ctx.restore();
      text(['Answer before the reveal 👇'], '500 40px Outfit', W / 2 - 25, top + lines.length * 100 + 40, 48, C.coral, 'center', ease((t - 0.6) / 0.5));
      return;
    }
    const tq = t - T.hook;
    if (tq < T.question + T.countdown) {
      question(t, 'ask');
      if (tq >= T.question) {
        const tc = tq - T.question;
        const n = Math.ceil(T.countdown - tc);
        const cy = Math.min(optsBottom + 40, 1380);
        rrect(X, cy, CW, 16, 8, 'rgba(0,0,0,0.06)');
        rrect(X, cy, CW * (1 - tc / T.countdown), 16, 8, C.coral);
        text([String(n)], '800 110px Outfit', W / 2 - 25, cy + 40, 120, C.coral, 'center');
      }
      return;
    }
    const tr = tq - T.question - T.countdown;
    if (tr < T.reveal) {
      question(t, 'reveal');
      const a = ease((tr - 0.5) / 0.5);
      const wy = Math.min(optsBottom + 20, 1250);
      const whyLines = wrap(spec.why, '500 42px Outfit', CW - 60);
      ctx.save(); ctx.globalAlpha = a;
      rrect(X, wy, CW, 90 + whyLines.length * 54, 26, 'rgba(255,243,205,0.9)');
      ctx.restore();
      text(['Why'], '700 34px Outfit', X + 30, wy + 24, 40, C.coral, 'left', a);
      text(whyLines, '500 42px Outfit', X + 30, wy + 70, 54, C.ink, 'left', a);
      return;
    }
    const te = tr - T.reveal;
    const a = ease(te / 0.5);
    text(['Want questions from', 'YOUR lecture notes?'], '800 84px Outfit', W / 2 - 25, 560, 100, C.ink, 'center', a);
    text(['Upload your slides. Get NCLEX-style', 'questions with rationales in seconds.'], '500 42px Outfit', W / 2 - 25, 800, 56, C.soft, 'center', ease((te - 0.3) / 0.5));
    ctx.save(); ctx.globalAlpha = ease((te - 0.6) / 0.5);
    rrect(W / 2 - 25 - 340, 990, 680, 120, 60, C.coral);
    ctx.restore();
    text(['nursequizai.com'], '700 56px Outfit', W / 2 - 25, 1020, 60, '#fff', 'center', ease((te - 0.6) / 0.5));
    text(['Free to start'], '500 36px Outfit', W / 2 - 25, 1140, 44, C.soft, 'center', ease((te - 0.9) / 0.5));
  }

  return new Promise((resolve) => {
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: 'video/mp4;codecs=avc1.640028', videoBitsPerSecond: 10_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      const buf = await new Blob(chunks, { type: 'video/mp4' }).arrayBuffer();
      let bin = ''; const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      resolve(btoa(bin));
    };
    const start = performance.now();
    frame(0);
    rec.start();
    const timer = setInterval(() => {
      const t = (performance.now() - start) / 1000;
      frame(Math.min(t, total));
      if (t >= total + 0.2) { clearInterval(timer); rec.stop(); }
    }, 1000 / 30);
  });
}

async function main() {
  const only = process.argv[2];
  const list = only ? videos.filter((v) => v.id === only) : videos;
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const spec of list) {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html><head>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Kalam:wght@700&display=block" rel="stylesheet">
      </head><body style="margin:0"><canvas id="c" width="1080" height="1920"></canvas></body></html>`, { waitUntil: 'networkidle0' });
    await page.evaluate(async (svg) => {
      await Promise.all(['800 92px Outfit', '700 58px Outfit', '600 28px Outfit', '500 44px Outfit', '700 46px Kalam'].map((f) => document.fonts.load(f)));
      window.logoImg = new Image();
      window.logoImg.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
      await window.logoImg.decode();
    }, logo);
    const b64 = await page.evaluate(`window.spec = ${JSON.stringify(spec)}; window.T = ${JSON.stringify(T)}; (${draw.toString()})()`);
    const file = path.join(OUT, `${spec.id}.mp4`);
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    console.log(`${spec.id}.mp4  ${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
    await page.close();
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
