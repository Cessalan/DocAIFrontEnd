import { buildCoverage, collectPracticeItems, missedQuestions, nextPractice } from './practiceCoverageModel';

const q = (question, topic, extra = {}) => ({ question, topic, options: ['A) a', 'B) b', 'C) c', 'D) d'], correctIndex: 1, ...extra });

const chatQuiz = {
  id: 'quiz-1', type: 'quiz',
  quizData: [q('Fluid 1?', 'Fluid balance'), q('Fluid 2?', 'Fluid Balance and Electrolytes'), q('Fluid 3?', 'Fluid balance')],
  practice: {
    questions: [q('Fluid 3?', 'Fluid balance'), q('Pain 1?', 'Pain assessment'), q('Never seen?', 'Pain assessment')],
    // first tries: two fluid questions missed, then fixed on the review round
    firstAnswers: { 0: { isCorrect: false }, 1: { isCorrect: false }, 2: { isCorrect: true }, 3: { isCorrect: true } },
    answers: { 0: { isCorrect: true }, 1: { isCorrect: true }, 2: { isCorrect: true }, 3: { isCorrect: true } }
  }
};

const planQuiz = {
  id: 'node-1', type: 'study_quiz',
  quizData: [{ questions: [q('Wound 1?', 'Wound healing phases'), q('Wound 2?', 'Wound healing phases')] }],
  quizProgress: { firstAttemptStatuses: { 0: 'incorrect', 1: 'correct' } }
};

test('generated, attempted and first-try correct are counted separately', () => {
  const coverage = buildCoverage(collectPracticeItems([chatQuiz]));
  const fluid = coverage.topics.find(t => t.label === 'Fluid balance');
  expect(fluid.generated).toBe(3); // variant labels merge into one topic
  expect(fluid.attempted).toBe(3);
  expect(fluid.correctFirst).toBe(1); // the review round does not rewrite first tries
  const pain = coverage.topics.find(t => t.label === 'Pain assessment');
  expect(pain.generated).toBe(2);
  expect(pain.attempted).toBe(1); // a loaded question nobody answered is not practice
});

test('duplicate stems across the first quiz and its batches count once', () => {
  expect(collectPracticeItems([chatQuiz]).filter(i => i.question.question === 'Fluid 3?')).toHaveLength(1);
});

test('plan answers count toward the same chat coverage', () => {
  const items = collectPracticeItems([chatQuiz, planQuiz]);
  expect(items.filter(i => i.origin === 'plan')).toHaveLength(2);
  const wound = buildCoverage(items).topics.find(t => t.label === 'Wound healing phases');
  expect(wound).toMatchObject({ attempted: 2, correctFirst: 1 });
});

test('source topics nobody has practised are listed as untested, in the material\'s order', () => {
  const coverage = buildCoverage(collectPracticeItems([chatQuiz]), ['Fluid balance', 'Wound care', 'Therapeutic relationship']);
  expect(coverage.untested).toEqual(['Wound care', 'Therapeutic relationship']);
});

test('next practice names the weakest topic and the first untested one', () => {
  const coverage = buildCoverage(collectPracticeItems([chatQuiz]), ['Fluid balance', 'Wound care']);
  const next = nextPractice(coverage);
  expect(next.review).toMatchObject({ topic: 'Fluid balance', missedCount: 2 });
  expect(next.review.questions.map(x => x.question)).toEqual(['Fluid 1?', 'Fluid 2?']);
  expect(next.fresh).toBe('Wound care');
});

test('nothing specific to say means no suggestion', () => {
  const perfect = { id: 'q', type: 'quiz', quizData: [q('X?', 'X')], practice: { firstAnswers: { 0: { isCorrect: true } } } };
  expect(nextPractice(buildCoverage(collectPracticeItems([perfect])))).toBeNull();
});

test('unlabelled questions are skipped, never bucketed under a made-up topic', () => {
  const unlabelled = { id: 'q', type: 'quiz', quizData: [{ question: 'Y?', options: [] }], practice: { firstAnswers: { 0: { isCorrect: false } } } };
  expect(buildCoverage(collectPracticeItems([unlabelled])).topics).toEqual([]);
});

test('mistakes replay exactly as stored, with the same key and without her old answer', () => {
  const withSelection = { ...chatQuiz, quizData: chatQuiz.quizData.map((x, i) => (i === 0 ? { ...x, userSelection: { selectedIndex: 3 } } : x)) };
  const replay = missedQuestions(collectPracticeItems([withSelection, planQuiz]));
  expect(replay.map(x => x.question)).toEqual(['Fluid 1?', 'Fluid 2?', 'Wound 1?']);
  expect(replay[0].correctIndex).toBe(1);
  expect(replay[0].userSelection).toBeUndefined();
});

test('streaming quizzes are not counted yet', () => {
  expect(collectPracticeItems([{ ...chatQuiz, isStreaming: true }])).toEqual([]);
});

test('a redone mistake answered correctly is no longer a mistake', () => {
  const redo = { id: 'redo', type: 'quiz', quizData: [q('Fluid 1?', 'Fluid balance'), q('Fluid 2?', 'Fluid balance')],
    practice: { firstAnswers: { 0: { isCorrect: true }, 1: { isCorrect: false } } } };
  const next = nextPractice(buildCoverage(collectPracticeItems([chatQuiz, redo])));
  expect(next.review.questions.map(x => x.question)).toEqual(['Fluid 2?']);
});

test('an unanswered repeat does not erase the answered original', () => {
  const repeat = { id: 'again', type: 'quiz', quizData: [q('Fluid 1?', 'Fluid balance')], practice: {} };
  const items = collectPracticeItems([chatQuiz, repeat]);
  expect(items.find(i => i.question.question === 'Fluid 1?').attempted).toBe(true);
});

// 2026-10-06: source topics became main topics while questions kept their
// subtopic tags. A quiz on Circulation then reported "you haven't practised
// Examen primaire", right after she practised it.
test('a question tagged with a subtopic counts toward its main topic', () => {
  const quiz = { id: 'quiz-abcde', type: 'quiz',
    quizData: [q('Pulse?', 'C — Circulation'), q('Bleed?', 'C — Circulation'), q('Airway?', 'A — Voies aériennes')],
    practice: { firstAnswers: { 0: { isCorrect: false }, 1: { isCorrect: false }, 2: { isCorrect: true } } } };
  const groups = [
    { title: 'Examen primaire', subtopics: ['C — Circulation', 'A — Voies aériennes'] },
    { title: 'Examen secondaire', subtopics: ['MIST', 'SAMPLE'] }];
  const coverage = buildCoverage(collectPracticeItems([quiz]), ['Examen primaire', 'Examen secondaire'], groups);
  const primary = coverage.topics.find(t => t.label === 'Examen primaire');
  expect(primary.attempted).toBe(3);
  expect(primary.missed).toHaveLength(2);
  expect(coverage.untested).toEqual(['Examen secondaire']);
  expect(coverage.topics.find(t => t.label === 'C — Circulation')).toBeUndefined();
  expect(nextPractice(coverage).fresh).toBe('Examen secondaire');
});

test('without groups, coverage behaves exactly as before', () => {
  const quiz = { id: 'quiz-x', type: 'quiz', quizData: [q('Pulse?', 'C — Circulation')], practice: { firstAnswers: { 0: { isCorrect: true } } } };
  const coverage = buildCoverage(collectPracticeItems([quiz]), ['Examen primaire']);
  expect(coverage.untested).toEqual(['Examen primaire']);
});
