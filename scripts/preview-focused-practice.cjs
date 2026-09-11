// Render the real chat launch card and focused quiz with inert API fixtures.
const esbuild = require('esbuild');
const http = require('http');
const path = require('path');
const root = path.resolve(__dirname, '..');
const mocks = path.join(__dirname, 'focused-practice-preview/mocks.jsx');
async function main() {
  const result = await esbuild.build({
    absWorkingDir: root, entryPoints: ['scripts/focused-practice-preview/Preview.jsx'], bundle: true, write: false,
    outdir: 'preview-output', define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.js': 'jsx', '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl', '.mp3': 'dataurl', '.wav': 'dataurl', '.gif': 'dataurl' },
    plugins: [{ name: 'inert-preview', setup(build) {
      build.onResolve({ filter: /(?:react-i18next|UsageContext\/UsageContext|Services\/(?:PracticeService|FastAPICalls|devLogger)|utils\/soundEffects)$/ }, () => ({ path: mocks }));
      build.onResolve({ filter: /(?:ChatFlashcard|FlashcardResults|ChatSummary|ChatScenario|ChatStudySheet|MessageRating|QuizLoading|StreamingLogo|StaticLogo|DiagramAwarePre|useArtifactEngagement)$/ }, () => ({ path: mocks }));
      build.onResolve({ filter: /Glossary\/useGlossary$/ }, () => ({ path: 'glossary', namespace: 'mock-glossary' }));
      build.onLoad({ filter: /.*/, namespace: 'mock-glossary' }, () => ({ contents: `export { useGlossary as default } from ${JSON.stringify(mocks)};`, resolveDir: root }));
    }}]
  });
  const js = result.outputFiles.find(f => f.path.endsWith('.js')).contents;
  const css = result.outputFiles.find(f => f.path.endsWith('.css')).contents;
  http.createServer((req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(js); }
    if (req.url === '/app.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css); }
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Focused practice UI check</title><link rel="stylesheet" href="/app.css"><style>body{margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  }).listen(4182, '127.0.0.1', () => console.log('Focused practice preview: http://127.0.0.1:4182'));
}
main().catch(error => { console.error(error); process.exit(1); });
