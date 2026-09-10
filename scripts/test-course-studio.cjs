// These suites exercise DOM, stream lifecycle and ordering; none uses canvas.
// The optional native canvas in this checkout targets Node 20. Treat it as
// absent for this runner so bundled Node versions can run the same DOM tests.
const Module = require('module');
const load = Module._load;
Module._load = function (id, ...args) {
  if (id === 'canvas') return {};
  return load.call(this, id, ...args);
};
process.env.CI = 'true';
process.argv = [process.argv[0], require.resolve('react-scripts/scripts/test'),
  '--watchAll=false', '--runInBand', '--silent',
  'src/Components/CourseIntelligence',
  'src/Components/ChatInerface/PlanOnboarding.test.js',
  'src/Components/StudyMode/planPreviewModel.test.js',
  'src/Services/CourseIntelligenceService.test.js',
];
require('react-scripts/scripts/test');
