import { studioQuestions } from '../../src/Components/CourseIntelligence/__fixtures__/courseStudio';
export const FUNNEL = { REPORT_VIEWED: 'report_viewed', REVEAL_VIEWED: 'reveal_viewed', DIAGNOSTIC_STARTED: 'diagnostic_started', DIAGNOSTIC_COMPLETED: 'diagnostic_completed' };
export const logFunnelStep = () => {};
export const logFunnelStepOnce = () => {};
export const updateStudyPerformance = async () => {};
export const plan_diagnostic_quiz = (_chat, _files, _language, _prefs, { signal } = {}) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => resolve(studioQuestions), 800);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});
