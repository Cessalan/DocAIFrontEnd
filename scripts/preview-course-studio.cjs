// Local visual review. Uses the real components with explicitly illustrative data.
// No Firebase, API requests, or plan charges are made by this preview.
const esbuild = require('esbuild');
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'node_modules/.cache/course-studio-preview');
async function start() {
  const context = await esbuild.context({
    entryPoints: [path.join(__dirname, 'course-studio-preview/Preview.jsx')],
    bundle: true, outdir: output, loader: { '.js': 'jsx' }, sourcemap: true,
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'illustrative-services', setup(build) {
      build.onResolve({ filter: /Services\/(FastAPICalls|FunnelService|StudySessionService)$/ }, () => ({ path: path.join(__dirname, 'course-studio-preview/services.js') }));
    } }],
  });
  await context.watch();
  const files = { '/': path.join(__dirname, 'course-studio-preview/index.html'),
    '/Preview.js': path.join(output, 'Preview.js'), '/Preview.css': path.join(output, 'Preview.css') };
  const server = http.createServer((request, response) => {
    const file = files[new URL(request.url, 'http://localhost').pathname];
    if (!file) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
    fs.createReadStream(file).on('error', () => { response.statusCode = 503; response.end('Building preview; refresh in a moment.'); }).pipe(response);
  });
  server.listen(4178, '127.0.0.1', () => process.stdout.write('Course studio preview: http://127.0.0.1:4178\n'));
}
start().catch(error => { process.stderr.write(String(error)); process.exitCode = 1; });
