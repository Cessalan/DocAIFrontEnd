// The optional canvas addon in this checkout targets Node 20. These read-only
// admin UI tests need jsdom, not canvas, and also run with bundled Node 24.
const Module = require('module');
const load = Module._load;
Module._load = function (id, ...args) {
  if (id === 'canvas') return {};
  return load.call(this, id, ...args);
};
process.env.CI = 'true';
process.argv = [process.argv[0], require.resolve('react-scripts/scripts/test'),
  '--watchAll=false', '--runInBand', '--runTestsByPath',
  'src/Components/Admin/studyTimelineModel.test.js',
  'src/Components/Admin/StudyPlanInspector.test.js',
  'src/Components/Admin/AdminEmail.test.js',
];
require('react-scripts/scripts/test');
