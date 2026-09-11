const esbuild = require('esbuild');
esbuild.buildSync({
  entryPoints: ['src/Components/ChatInerface/ChatInterface.js'], bundle: true, write: false,
  loader: { '.js': 'jsx', '.css': 'empty', '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl', '.mp3': 'dataurl', '.wav': 'dataurl', '.gif': 'dataurl' },
  external: ['pdfjs-dist/*'], logLevel: 'warning'
});
console.log('Focused practice and its chat integration bundle successfully.');
