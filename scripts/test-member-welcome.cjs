// DOM tests do not use the optional native canvas addon.
const Module = require('module'), original = Module._load;
Module._load = function (id, ...args) { return id === 'canvas' ? {} : original.call(this, id, ...args); };
process.env.CI = 'true';
process.argv = [process.argv[0], require.resolve('react-scripts/scripts/test'), '--watchAll=false', '--runInBand', '--runTestsByPath',
  'src/Components/Common/MemberWelcomeModal.test.js',
  'src/Components/Common/ProductAnnouncementModal.test.js',
  'src/Services/ProductAnnouncementService.test.js',
  'src/Contexts/UsageContext/useProductAnnouncement.test.js',
  'src/Services/MemberWelcomeService.test.js',
  'src/Contexts/UsageContext/useMemberWelcome.test.js',
  'src/Contexts/UsageContext/UsageContext.test.js',
  'src/Components/Common/UpgradeModal.test.js'];
require('react-scripts/scripts/test');
