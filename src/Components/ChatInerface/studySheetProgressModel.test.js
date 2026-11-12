import { sheetProgress, checkIsSourced, STEP_ORDER } from './studySheetProgressModel';
import { updateStudySheetMessage } from '../../Services/studySheetEvents';

const states = message => sheetProgress(message).steps.map(step => step.state);
const play = (events, start = { id: 's1', content: '', isStreaming: true }) =>
  events.reduce(updateStudySheetMessage, start);
const step = (id, state, facts = {}) => ({ status: 'study_sheet_step', step: id, state, ...facts });
const header = { status: 'study_sheet_header', studySheet: { title: 'Kidneys', sections: [] } };
const section = (id, title) => ({ status: 'study_sheet_section', section: { id, title, blocks: [] } });

describe('study sheet checklist', () => {
  test('nothing is ticked before anything has happened', () => {
    expect(states({ isStreaming: true })).toEqual(['active', 'pending', 'pending', 'pending']);
  });

  test('each box is ticked by the event that ends its step, in order', () => {
    const events = [step('materials', 'active'), step('materials', 'done', { files: 2, notes: false }),
      step('plan', 'active'), step('plan', 'done', { topics: ['Filtration'], priorities: 1, quizzes: 0 }),
      step('write', 'active', { attempt: 1 }), header, section('section-1', 'Filtration'),
      step('check', 'active', { sourced: true })];
    const seen = [];
    events.reduce((message, event) => {
      const next = updateStudySheetMessage(message, event);
      seen.push(states(next).join(' '));
      return next;
    }, { id: 's1', content: '', isStreaming: true });
    expect(seen).toEqual([
      'active pending pending pending',
      'done active pending pending',
      'done active pending pending',
      'done done active pending',
      'done done active pending',
      'done done active pending',
      'done done active pending',
      'done done done active',
    ]);
  });

  test('exactly one step is active for as long as the sheet is being prepared', () => {
    const events = [step('materials', 'active'), step('materials', 'done'), step('plan', 'active'),
      step('plan', 'done'), step('write', 'active'), header, section('section-1', 'A'), step('check', 'active')];
    let message = { id: 's1', content: '', isStreaming: true };
    events.forEach(event => {
      message = updateStudySheetMessage(message, event);
      expect(states(message).filter(s => s === 'active')).toHaveLength(1);
    });
  });

  test('facts are the ones the backend reported, and absent when it reported none', () => {
    const message = play([step('materials', 'done', { files: 3, notes: true }),
      step('plan', 'done', { topics: ['Preload', 'Afterload'], priorities: 0, quizzes: 2 })]);
    const [materials, plan, write] = sheetProgress(message).steps;
    expect(materials.facts).toEqual({ files: 3, notes: true });
    expect(plan.facts).toEqual({ topics: ['Preload', 'Afterload'], priorities: 0, quizzes: 2 });
    expect(write.facts).toEqual({});
  });

  test('finished sections are listed by the titles that actually arrived', () => {
    const message = play([header, section('section-1', 'Filtration'), section('section-2', '  '),
      section('section-3', 'Reabsorption')]);
    expect(sheetProgress(message).steps[2].sections).toEqual(['Filtration', 'Reabsorption']);
  });

  test('an older backend that sends no step events still gets an honest list', () => {
    // No events at all: only the first box can be claimed.
    expect(states({ isStreaming: true })).toEqual(['active', 'pending', 'pending', 'pending']);
    // A header cannot exist without the reading and planning before it.
    expect(states(play([header]))).toEqual(['done', 'done', 'active', 'pending']);
  });

  test('a thrown-away first draft keeps the reading and planning ticks, and says so', () => {
    const message = play([step('materials', 'done', { files: 1 }), step('plan', 'done', { topics: [] }),
      step('write', 'active', { attempt: 1 }), header, section('section-1', 'Draft'),
      { status: 'study_sheet_reset' }, step('write', 'active', { attempt: 2 })]);
    const progress = sheetProgress(message);
    expect(progress.steps.map(s => s.state)).toEqual(['done', 'done', 'active', 'pending']);
    expect(progress.steps[2].sections).toEqual([]);
    expect(progress.restarted).toBe(true);
  });

  test('a failure marks the step it happened in, and nothing after it', () => {
    const message = play([step('materials', 'done'), step('plan', 'active'),
      { status: 'study_sheet_error', message: 'Your study request could not be prepared.' }]);
    const progress = sheetProgress(message);
    expect(progress.failed).toBe(true);
    expect(progress.steps.map(s => s.state)).toEqual(['done', 'failed', 'pending', 'pending']);
  });

  test('a completed sheet has every box ticked', () => {
    const message = play([header, section('section-1', 'A'),
      { status: 'study_sheet_complete', studySheet: { title: 'Kidneys', sections: [] }, content: 'x' }]);
    expect(states(message)).toEqual(['done', 'done', 'done', 'done']);
    expect(sheetProgress(message).restarted).toBe(false);
  });

  test('a step this build does not know is ignored', () => {
    const message = play([step('translate', 'done'), step('materials', 'done')]);
    expect(sheetProgress(message).steps.map(s => s.id)).toEqual(STEP_ORDER);
    expect(states(message)).toEqual(['done', 'active', 'pending', 'pending']);
  });

  test('the final check only claims to use her files when there are some', () => {
    const steps = message => sheetProgress(message).steps;
    expect(checkIsSourced(steps(play([step('check', 'active', { sourced: false })])))).toBe(false);
    expect(checkIsSourced(steps(play([step('materials', 'done', { files: 2, notes: false })])))).toBe(true);
    expect(checkIsSourced(steps(play([step('materials', 'done', { files: 0, notes: false })])))).toBe(false);
    expect(checkIsSourced(steps({ isStreaming: true }))).toBeNull();
  });
});
