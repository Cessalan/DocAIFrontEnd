// DOM tests do not use the optional native canvas addon.
const Module = require('module'), original = Module._load;
Module._load = function (id, ...args) { return id === 'canvas' ? {} : original.call(this, id, ...args); };
process.env.CI = 'true';
process.argv = [process.argv[0], require.resolve('react-scripts/scripts/test'), '--watchAll=false', '--runInBand', '--runTestsByPath',
  'src/Components/ChatInerface/streamErrorMessage.test.js',
  'src/Components/ChatInerface/ChatMessage.practice.test.js',
  'src/Components/ChatInerface/PracticePlanSummary.test.js',
  'src/Services/fileMetadata.test.js'];
require('react-scripts/scripts/test');
