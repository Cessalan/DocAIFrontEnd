import {
  calibrationQuestions, calibrationScores, calibrationPlan,
  gradeAnswer, answerKey, isKeyOption, formatTally, questionFormatCounts,
} from './courseCalibrationModel';
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

describe('readiness formats', () => {
  const valid = studioQuestions.questions[0];
  const sata = { ...valid, question: 'sata item', format: 'sata', options: ['a', 'b', 'c', 'd', 'e'], correctIndices: [3, 0] };
  const kase = { ...valid, question: 'case item', format: 'casestudy', scenario: 'A patient scenario.' };

  it('accepts each format on its own terms and refuses doubtful keys', () => {
    const result = calibrationQuestions({ questions: [valid, sata, kase,
      { ...sata, question: 'one key', correctIndices: [1] },
      { ...sata, question: 'every key', correctIndices: [0, 1, 2, 3, 4] },
      { ...sata, question: 'bool key', correctIndices: [true, 1] },
      { ...sata, question: 'repeated key', correctIndices: [1, 1] },
      { ...sata, question: 'no key', correctIndices: undefined },
      { ...kase, question: 'no scenario', scenario: '   ' },
      { ...valid, question: 'essay', format: 'essay' },
    ] }, topics);
    expect(result.map(q => q.format)).toEqual(['mcq', 'sata', 'casestudy']);
    expect(result[1].correctIndices).toEqual([0, 3]);
    expect(result[2].scenario).toBe('A patient scenario.');
  });

  it('caps the check at eight questions', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...valid, question: `question ${i}` }));
    expect(calibrationQuestions({ questions: many }, topics)).toHaveLength(8);
  });

  it('grades select-all as all-or-nothing but remembers a partial answer', () => {
    const q = { format: 'sata', correctIndices: [0, 2] };
    expect(gradeAnswer(q, [2, 0])).toEqual({ correct: true, partial: false });
    expect(gradeAnswer(q, [0, 1])).toEqual({ correct: false, partial: true });
    expect(gradeAnswer(q, [0, 2, 3])).toEqual({ correct: false, partial: true });
    expect(gradeAnswer(q, [1, 3])).toEqual({ correct: false, partial: false });
    expect(gradeAnswer(q, [])).toEqual({ correct: false, partial: false });
    expect(gradeAnswer(q, 'unsure')).toEqual({ correct: false, partial: false });
    expect(answerKey(q)).toEqual([0, 2]);
    expect(isKeyOption(q, 2)).toBe(true);
  });

  it('grades single-answer formats by index', () => {
    expect(gradeAnswer({ format: 'mcq', correctIndex: 1 }, 1)).toEqual({ correct: true, partial: false });
    expect(gradeAnswer({ correctIndex: 1 }, 2)).toEqual({ correct: false, partial: false });
    expect(gradeAnswer({ format: 'casestudy', correctIndex: 0 }, null)).toEqual({ correct: false, partial: false });
    expect(answerKey({ correctIndex: 3 })).toEqual([3]);
  });

  it('tallies answers and questions by format for the funnel', () => {
    expect(formatTally([
      { format: 'mcq', correct: true }, { format: 'sata', correct: false, partial: true },
      { format: 'casestudy', correct: false }, { correct: true },
    ])).toEqual({
      mcqAnswered: 2, mcqCorrect: 2, sataAnswered: 1, sataCorrect: 0, sataPartial: 1,
      casestudyAnswered: 1, casestudyCorrect: 0,
    });
    expect(questionFormatCounts([{ format: 'sata' }, {}, { format: 'casestudy' }]))
      .toEqual({ mcqCount: 1, sataCount: 1, casestudyCount: 1 });
  });
});
