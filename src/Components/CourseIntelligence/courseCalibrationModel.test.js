import { calibrationQuestions, calibrationScores, calibrationPlan } from './courseCalibrationModel';
import { normalizeReport } from './courseIntelligenceModel';
import { studioReport, studioQuestions } from './__fixtures__/courseStudio';

const report = normalizeReport(studioReport);
const topics = report.strategy.orderedTopics;

it('rejects malformed keys, duplicate questions and unrelated topics before scoring', () => {
  const valid = studioQuestions.questions[0];
  const result = calibrationQuestions({ questions: [valid, valid,
    { ...valid, question: 'bad key', correctIndex: '0' },
    { ...valid, question: 'out of range', correctIndex: 4 },
    { ...valid, question: 'wrong topic', topic: 'Cardiomyopathy' },
    { ...valid, question: 'bad options', options: ['a', 'a', 'b', 'c'] }, null,
  ] }, topics);
  expect(result).toHaveLength(1);
  expect(result[0].topic).toBe(topics[0]);
});

it('normalizes spelling case but does not merge distinct clinical topics', () => {
  const valid = studioQuestions.questions[0];
  expect(calibrationQuestions({ questions: [{ ...valid, topic: topics[0].toUpperCase() }] }, topics)[0].topic).toBe(topics[0]);
  expect(calibrationQuestions({ questions: [{ ...valid, topic: 'Cardiovascular' }] }, topics)).toEqual([]);
});

it('only scores observed answers and keeps a skipped diagnostic null', () => {
  expect(calibrationScores([])).toBeNull();
  expect(calibrationScores([{ topic: topics[1], correct: false, unsure: true }])).toEqual({ [topics[1]]: 0 });
});

it('moves a sampled gap ahead of the original course priority, keeping untested topics', () => {
  const answers = [
    { topic: topics[0], correct: true }, { topic: topics[0], correct: true },
    { topic: topics[1], correct: false, concept: 'Fluid balance' }, { topic: topics[1], correct: false },
  ];
  const plan = calibrationPlan(report, answers, 14);
  expect(plan.rows.map(row => row.topic)).toEqual([topics[1], topics[2], topics[3], topics[0]]);
  expect(plan.rows[0].revisit).toEqual(['Fluid balance']);
  expect(plan.rows[1].tier).toBe('untested');
  expect(plan.scores).not.toHaveProperty(topics[2]);
  expect(plan.changed).toBe(true);
  expect(report.strategy.orderedTopics[0]).toBe(topics[0]);
});

it('keeps course order when diagnostic results tie', () => {
  const answers = topics.slice(0, 3).reverse().map(topic => ({ topic, correct: false }));
  expect(calibrationPlan(report, answers).rows.slice(0, 3).map(r => r.topic)).toEqual(topics.slice(0, 3));
});

it('labels a correct single sample as one observation without claiming mastery', () => {
  const row = calibrationPlan(report, [{ topic: topics[0], correct: true }]).rows.find(r => r.topic === topics[0]);
  expect(row.tested).toBe(1);
  expect(row.correct).toBe(1);
});
