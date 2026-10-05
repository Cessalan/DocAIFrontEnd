// The installed optional canvas addon targets an older Node ABI. These UI
// tests use jsdom only, and do not need canvas.
const Module = require('module'), load = Module._load;
Module._load = function (id, ...args) { return id === 'canvas' ? {} : load.call(this, id, ...args); };
process.env.CI = 'true';
process.argv = [process.argv[0], require.resolve('react-scripts/scripts/test'), '--watchAll=false', '--runInBand', '--runTestsByPath',
  'src/Components/ChatInerface/StudySheetSimple.test.js', 'src/Components/ChatInerface/ChatInterface.initialization.test.js'];
require('react-scripts/scripts/test');
