const esbuild = require('esbuild');
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'node_modules/.cache/flashcard-practice-preview');
async function start() {
  const context = await esbuild.context({ absWorkingDir: root, entryPoints: ['scripts/flashcard-practice-preview.jsx'],
    outdir: output, bundle: true, loader: { '.js': 'jsx', '.svg': 'dataurl', '.png': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{ name: 'visual-fixtures', setup(build) {
      build.onResolve({ filter: /FlashcardPracticeService$/ }, () => ({ path: 'fixture', namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export async function saveFlashcardReview() {} export async function askFlashcardTutor() { return {reply:'Try naming the kind of information you need to remember. What would a complete response include?'}; }` }));
      build.onResolve({ filter: /^react-i18next$/ }, () => ({ path: 'translations', namespace: 'translations' }));
      build.onLoad({ filter: /.*/, namespace: 'translations' }, () => ({ contents: `export function useTranslation() {return {i18n:{language:new URLSearchParams(location.search).get('lang') || 'en'}};}` }));
    }}] });
  await context.watch();
  http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/app.js' || pathname === '/app.css') {
      res.setHeader('Content-Type', pathname.endsWith('.js') ? 'text/javascript' : 'text/css');
      return fs.createReadStream(path.join(output, 'flashcard-practice-preview' + path.extname(pathname))).on('error', () => { res.statusCode = 503; res.end('Building'); }).pipe(res);
    }
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>Flashcards · visual fixture</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  }).listen(4183, '127.0.0.1', () => console.log('Flashcard visual fixture: http://127.0.0.1:4183'));
}
start().catch(err => { console.error(err); process.exitCode = 1; });
