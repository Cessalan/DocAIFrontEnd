import { studioQuestions } from '../../src/Components/CourseIntelligence/__fixtures__/courseStudio';
export const FUNNEL = { REPORT_VIEWED: 'report_viewed', REVEAL_VIEWED: 'reveal_viewed', DIAGNOSTIC_STARTED: 'diagnostic_started', DIAGNOSTIC_COMPLETED: 'diagnostic_completed' };
export const logFunnelStep = () => {};
export const logFunnelStepOnce = () => {};
export const updateStudyPerformance = async () => {};
export const saveQuickCheckRecord = async () => {};
export const waitForQuickCheckSave = async () => {};
export const plan_diagnostic_quiz = (_chat, _files, _language, _prefs, { signal } = {}) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => resolve(studioQuestions), 800);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});
export const logPaywall = () => {};
export const fetchGlossaryTerm = async () => ({ definition: 'Illustrative glossary explanation.' });
export const fetchQuizRationale = async () => ({ explanation: 'Illustrative rationale.' });
export const useUsageLimit = () => ({ consume: async () => {} });
export const generate_study_item_stream = async (_chat, type, topic) => {
  if (type !== 'lesson') throw new Error('The onboarding preview only generates an illustrative lesson.');
  return { content: { title: topic, pages: [{ title: 'A short explanation',
    content: 'Cardiac output is the volume pumped in one minute: heart rate multiplied by stroke volume. Stroke volume is the amount pumped with each beat.',
    highlight: 'Illustrative course data for this local preview.' }] } };
};
