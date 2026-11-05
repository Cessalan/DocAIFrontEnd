#!/usr/bin/env node
/**
 * Pip's Daily NCLEX Question: builds one episode from a small JSON file.
 *
 *   node make-episode.js episodes/002
 *
 * The episode folder holds episode.json and voice.mp3 (the only paid input: one
 * Runway speech call, about 1 credit). Everything else is reused from assets/:
 * the Pip desk loop (60 credits, made once), the music bed, Outfit, the logo.
 *
 * Caption timing is measured, not typed: the script finds the pauses in
 * voice.mp3 and each card line appears when the phrase it names is spoken
 * ("at": phrase index, 0-based). A phrase break is a pause of 0.3s or more:
 * in Pip's voice a sentence end (. ? !) pauses ~0.4-0.5s, a comma ~0.2s, so
 * end each phrase that starts a card line with a full stop or question mark. If the voice has fewer phrases than the card
 * asks for, it stops and prints what it heard rather than guessing.
 *
 * Output: out/nursequizai-daily-nclex-<number>.mp4 plus out/<number>-check.png
 * (final card frame with the platform UI zones drawn on, for a quick look).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const FFDIR = process.env.FFMPEG_DIR ||
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin');
const bin = (name) => {
  const p = path.join(FFDIR, `${name}.exe`);
  return fs.existsSync(p) ? p : name; // fall back to PATH
};

// Layout, in 1080x1920 pixels. Text must stay out of the platform UI:
// top 220px, bottom 480px, and the right button rail (x > 940 from y = 760).
const W = 1080;
// Pip's head starts ~930 and the face ~1150: a long card may cover the top of
// the heart, never the face.
const CARD_X = 60, CARD_Y = 340, CARD_W = 960, CARD_MAX_BOTTOM = 1050;
const PAD_TOP = 40, PAD_BOTTOM = 36;
const TEXT_MAX_W = 840; // keeps the widest line inside x 120..960
const COLORS = { dark: '0x3D3D3D', coral: '0xD4736A', muted: '0xA89A94' };
const BRAND_TAG_H = 40; // room at the foot of the card for "nursequizai.com"
const STYLES = {
  // size: font px, adv: vertical space the line takes, before: extra gap above
  intro:    { font: 'outfit-600.ttf', size: 46, color: 'coral', adv: 98,  before: 0 },
  body:     { font: 'outfit-800.ttf', size: 54, color: 'dark',  adv: 95,  before: 0 },
  question: { font: 'outfit-800.ttf', size: 62, color: 'coral', adv: 105, before: 30 },
  option:   { font: 'outfit-600.ttf', size: 46, color: 'dark',  adv: 72,  before: 0, align: 'left' },
  cta:      { font: 'outfit-600.ttf', size: 40, color: 'dark',  adv: 60,  before: 22 },
};
const VOICE_DELAY = 0.3;   // voice starts this far in
const LEAD = 0.05;         // captions start fading in just before the words
const HOLD_AFTER_VOICE = 2.7, END_CARD = 2.0;

function run(cmd, args, { capture = false } = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) {
    throw new Error(`${path.basename(cmd)} failed:\n${(r.stderr || '').split('\n').slice(-15).join('\n')}`);
  }
  return capture ? `${r.stdout}${r.stderr}` : '';
}

function phrases(voiceFile) {
  const dur = parseFloat(run(bin('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voiceFile], { capture: true }));
  const log = run(bin('ffmpeg'), ['-hide_banner', '-i', voiceFile, '-af', 'silencedetect=noise=-35dB:d=0.3', '-f', 'null', '-'], { capture: true });
  const starts = [0];
  for (const m of log.matchAll(/silence_end: ([\d.]+)/g)) {
    const t = parseFloat(m[1]);
    if (t < dur - 0.2) starts.push(t);
  }
  return { starts, dur };
}

// Rough Outfit width per character at 1px; good enough to shrink long lines.
const approxWidth = (text, size) => text.length * size * 0.53;

function layout(lines) {
  // Scale everything down together if the card would run into Pip.
  const natural = lines.reduce((h, l, i) => h + (i ? STYLES[l.style].before : 0) + STYLES[l.style].adv, 0);
  const room = CARD_MAX_BOTTOM - CARD_Y - PAD_TOP - PAD_BOTTOM - BRAND_TAG_H;
  const k = Math.min(1, room / natural);
  let y = CARD_Y + PAD_TOP;
  const placed = lines.map((l, i) => {
    const s = STYLES[l.style];
    if (!s) throw new Error(`Unknown style "${l.style}" (use ${Object.keys(STYLES).join(', ')})`);
    if (i) y += s.before * k;
    let size = Math.round(s.size * k);
    while (approxWidth(l.text, size) > TEXT_MAX_W && size > 28) size -= 2;
    const out = { ...l, s, size, y: Math.round(y + (s.adv * k - size) / 2 - 8) };
    y += s.adv * k;
    return out;
  });
  return { placed, cardH: Math.round(y - CARD_Y + PAD_BOTTOM + BRAND_TAG_H) };
}

function roundedRect(w, h, r, color, alpha, out) {
  const a = `if(gt(abs(X-W/2),W/2-${r})*gt(abs(Y-H/2),H/2-${r}),if(lte(hypot(abs(X-W/2)-(W/2-${r}),abs(Y-H/2)-(H/2-${r})),${r}),${alpha},0),${alpha})`;
  run(bin('ffmpeg'), ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=${color}:s=${w}x${h},format=rgba`, '-frames:v', '1',
    '-vf', `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${a}'`, out]);
}

function main() {
  const epDir = process.argv[2];
  if (!epDir) { console.error('usage: node make-episode.js episodes/<number>'); process.exit(1); }
  const epAbs = path.resolve(process.cwd(), epDir);
  const ep = JSON.parse(fs.readFileSync(path.join(epAbs, 'episode.json'), 'utf8'));
  const num = String(ep.number).padStart(3, '0');
  const voice = path.relative(ROOT, path.join(epAbs, 'voice.mp3')).replace(/\\/g, '/');
  if (!fs.existsSync(path.join(ROOT, voice))) throw new Error(`Missing ${voice}: generate the voice line first.`);

  const work = `out/work-${num}`;
  fs.mkdirSync(path.join(ROOT, work), { recursive: true });

  // 1. Timing from the voice itself.
  const { starts, dur } = phrases(path.join(ROOT, voice));
  console.log(`voice ${dur.toFixed(2)}s, ${starts.length} phrases at ${starts.map((t) => t.toFixed(2)).join(', ')}`);
  const need = Math.max(...ep.card.filter((l) => Number.isInteger(l.at)).map((l) => l.at));
  if (need >= starts.length) {
    throw new Error(`episode.json uses phrase ${need}, but only ${starts.length} phrases were heard (0..${starts.length - 1}). ` +
      'Adjust the "at" values (lines can share a phrase) or add pauses to the voice line.');
  }
  const voiceEnd = VOICE_DELAY + dur;
  const ctaAt = voiceEnd + 0.5;
  const endAt = voiceEnd + HOLD_AFTER_VOICE;
  // No full-screen end card by default: it breaks the loop (the replay is what
  // the format runs on) and reads as an ad. Set "endCard": true to add one.
  const showEnd = ep.endCard === true;
  // A looping clip must end on a whole number of Pip cycles, or Pip jumps
  // mid-move on the replay. Keep the CTA up at least 1.3s.
  const loopLen = parseFloat(run(bin('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 'assets/loop.mp4'], { capture: true }));
  const total = +(showEnd ? endAt + END_CARD
    : Math.ceil((ctaAt + 1.3) / loopLen) * loopLen).toFixed(3);
  const lines = [...ep.card, { text: ep.cta || 'Comment your answer below', style: 'cta', at: 'after' }];

  // 2. Card + badge shapes sized to this episode.
  const { placed, cardH } = layout(lines);
  roundedRect(CARD_W, cardH, 44, 'white', 238, `${work}/card.png`);
  roundedRect(760, 92, 46, '0xE88D7D', 255, `${work}/badge.png`);

  // 3. Text goes through files so quotes, colons and % never need escaping.
  const tf = (name, text) => { fs.writeFileSync(path.join(ROOT, work, name), text); return `${work}/${name}`; };
  // Lines on the first phrase are on screen from frame 1: that frame is the
  // feed thumbnail and has to show the question, not an empty card.
  const fadeIn = (t) => (t <= VOICE_DELAY + 0.1 ? 'alpha=1'
    : `alpha='if(lt(t,${t.toFixed(2)}),0,min(1,(t-${t.toFixed(2)})/0.25))'`);
  const draws = [
    `drawtext=fontfile=assets/outfit-800.ttf:textfile=${tf('badge.txt', ep.badge || `PIP'S DAILY NCLEX QUESTION #${num}`)}:fontcolor=white:fontsize=40:x=(w-tw)/2:y=230+(92-th)/2-4`,
    // Quiet brand tag at the foot of the card, on screen the whole time.
    `drawtext=fontfile=assets/outfit-600.ttf:textfile=${tf('tag.txt', 'nursequizai.com')}:fontcolor=${COLORS.muted}:fontsize=28:x=(w-tw)/2:y=${CARD_Y + cardH - BRAND_TAG_H - 6}`,
    ...placed.map((l, i) => {
      const t = l.at === 'after' ? ctaAt : Math.max(0, VOICE_DELAY + starts[l.at] - LEAD);
      const x = l.s.align === 'left' ? 120 : '(w-tw)/2';
      return `drawtext=fontfile=assets/${l.s.font}:textfile=${tf(`l${i}.txt`, l.text)}:fontcolor=${COLORS[l.s.color]}:fontsize=${l.size}:x=${x}:y=${l.y}:${fadeIn(t)}`;
    }),
  ];
  const endText = [
    ['outfit-800.ttf', 'brand.txt', 'NurseQuizAI', 'dark', 84, 900],
    ['outfit-600.ttf', 'cta1.txt', ep.endLine || 'Free NCLEX practice at nursequizai.com', 'coral', 46, 1020],
    ['outfit-600.ttf', 'cta2.txt', ep.endLine2 || 'Answer pinned tomorrow', 'dark', 40, 1090],
  ].map(([f, n, txt, c, s, y]) => `drawtext=fontfile=assets/${f}:textfile=${tf(n, txt)}:fontcolor=${COLORS[c]}:fontsize=${s}:x=(w-tw)/2:y=${y}`);

  const vf = [
    `[0:v][1:v]overlay=${CARD_X}:${CARD_Y}[c1]`,
    `[c1][2:v]overlay=160:230[c2]`,
    ...(showEnd ? [
      `[c2]${draws.join(',')}[main]`,
      `[3:v]format=rgba[logo]`,
      `color=c=0xFDF8F3:s=${W}x1920:d=${total},format=rgba[endbg]`,
      `[endbg][logo]overlay=(W-w)/2:560[e1]`,
      `[e1]${endText.join(',')}[end]`,
      `[main][end]overlay=0:0:enable='gte(t,${endAt.toFixed(2)})'[v]`,
    ] : [`[c2]${draws.join(',')}[v]`]),
  ].join(';');
  const ms = Math.round(VOICE_DELAY * 1000);
  // Without an end card the clip loops, so the bed only gets short edge fades.
  const fin = showEnd ? 0.6 : 0.15, fout = showEnd ? 0.8 : 0.3;
  const af = [
    `[4:a]adelay=${ms}|${ms}[vo]`,
    `[5:a]volume=0.16,afade=t=in:d=${fin},afade=t=out:st=${(total - fout).toFixed(2)}:d=${fout}[bed]`,
    `[vo][bed]amix=inputs=2:duration=longest:normalize=0,atrim=0:${total},loudnorm=I=-14:TP=-1.5:LRA=11[a]`,
  ].join(';');

  const out = `out/nursequizai-daily-nclex-${num}.mp4`;
  run(bin('ffmpeg'), ['-y', '-v', 'error',
    '-stream_loop', '-1', '-i', 'assets/loop.mp4',
    '-i', `${work}/card.png`, '-i', `${work}/badge.png`, '-i', 'assets/logo.png',
    '-i', voice, '-stream_loop', '-1', '-i', 'assets/music-bed.mp3',
    '-filter_complex', `${vf};${af}`, '-map', '[v]', '-map', '[a]', '-t', String(total),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', out]);

  // 4. Check frame: the full card with the platform UI zones shaded red.
  run(bin('ffmpeg'), ['-y', '-v', 'error', '-ss', (endAt - 0.4).toFixed(2), '-i', out, '-frames:v', '1', '-vf',
    'drawbox=x=0:y=0:w=1080:h=220:color=red@0.35:t=fill,drawbox=x=0:y=1440:w=1080:h=480:color=red@0.35:t=fill,' +
    'drawbox=x=940:y=760:w=140:h=680:color=red@0.35:t=fill,scale=432:-1', `out/${num}-check.png`]);

  const scaled = placed.filter((l) => l.size < Math.round(l.s.size * 0.85)).map((l) => `"${l.text}" at ${l.size}px`);
  console.log(`wrote ${out} (${total}s), card ${cardH}px tall`);
  if (scaled.length) console.log(`note: shrunk to fit: ${scaled.join('; ')}`);
  if (ep.answer) console.log(`pin this answer: ${ep.answer}`);
}

try { main(); } catch (e) { console.error(e.message); process.exit(1); }
