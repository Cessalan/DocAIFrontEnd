import {
  buildShareDoc, canOfferShare, classSummary, cleanQuestion, combineSummaries, firstName, followUpPrompt,
  gradeSet, normalizeCorrectIndex, plainText, readSharedSet, shareableQuestions, shortenTopic, SHARE_SET_SIZE,
} from './shareSetModel';

const mcq = (n = 1, extra = {}) => ({
  question: `Question ${n}?`, options: ['a', 'b', 'c', 'd'], correctIndex: 1, rationale: 'Because b.', topic: 'Digoxin', ...extra,
});
const sata = {
  questionType: 'sata', question: 'Which apply?', options: ['one', 'two', 'three', 'four'], answer: ['one', 'three'],
  justification: 'One and three.', topic: 'Fluids',
};
const ordering = {
  questionType: 'casestudy', question: 'Order the actions.', options: ['x', 'y', 'z'], correctOrder: ['y', 'x', 'z'],
  caseStudy: { nursesNotes: 'Client is short of breath.' }, justification: 'Airway first.',
};
const matrix = {
  questionType: 'matrix', question: 'Expected or not?',
  columns: [{ id: 'e', label: 'Expected' }, { id: 'u', label: 'Unexpected' }],
  rows: [{ id: 1, text: 'r1', correctColumnId: 'e' }, { id: 2, text: 'r2', correctColumnId: 'u' }, { id: 3, text: 'r3', correctColumnId: 'e' }],
};

describe('cleanQuestion', () => {
  it('keeps only what a card needs, never her answers or sources', () => {
    const clean = cleanQuestion(mcq(1, { userSelection: 2, isCorrect: false, sourceQuote: 'slide 14', fileName: 'Week9.pptx' }));
    expect(Object.keys(clean).sort()).toEqual(['correctBlurb', 'correctIndex', 'options', 'question', 'questionType', 'rationale', 'topic']);
  });

  it('reads a letter or numeric-string key', () => {
    expect(normalizeCorrectIndex('C')).toBe(2);
    expect(normalizeCorrectIndex('3')).toBe(3);
    expect(normalizeCorrectIndex(undefined)).toBe(-1);
    expect(cleanQuestion(mcq(1, { correctIndex: 'd' })).correctIndex).toBe(3);
  });

  it('drops a question with no usable key', () => {
    expect(cleanQuestion(mcq(1, { correctIndex: 9 }))).toBeNull();
    expect(cleanQuestion(mcq(1, { options: ['only'] }))).toBeNull();
    expect(cleanQuestion({ ...sata, answer: ['not an option'] })).toBeNull();
    expect(cleanQuestion({ ...ordering, correctOrder: ['y'] })).toBeNull();
    expect(cleanQuestion({ ...matrix, rows: matrix.rows.slice(0, 2) })).toBeNull();
    expect(cleanQuestion({ question: '  ' })).toBeNull();
  });

  it('keeps every format the app asks', () => {
    expect(cleanQuestion(sata).questionType).toBe('sata');
    expect(cleanQuestion({ ...ordering, questionType: 'ordering' }).questionType).toBe('casestudy');
    expect(cleanQuestion(matrix).rows).toHaveLength(3);
  });
});

describe('shareableQuestions and the offer', () => {
  const twelve = Array.from({ length: 12 }, (_, i) => mcq(i + 1));

  it('caps a long round at ten, in order', () => {
    const list = shareableQuestions(twelve);
    expect(list).toHaveLength(SHARE_SET_SIZE);
    expect(list[0].question).toBe('Question 1?');
  });

  it('leaves out excluded and broken questions', () => {
    const list = shareableQuestions([mcq(1), mcq(2, { correctIndex: -1 }), mcq(3), mcq(4)], { excludeIndices: [0] });
    expect(list.map((q) => q.question)).toEqual(['Question 3?', 'Question 4?']);
  });

  it('is offered after every round, whatever the score or step', () => {
    expect(canOfferShare({ questions: twelve })).toBe(true);
    expect(canOfferShare({ questions: twelve, scorePercent: 0, stepsDone: 1 })).toBe(true);
  });

  it('is not offered in view-only mode or with too few usable questions', () => {
    expect(canOfferShare({ questions: twelve, viewOnly: true })).toBe(false);
    expect(canOfferShare({ questions: twelve.slice(0, 2) })).toBe(false);
    expect(canOfferShare({ questions: undefined })).toBe(false);
  });
});

describe('buildShareDoc', () => {
  const args = { shareId: 'abc', questions: [mcq(1), sata, ordering], topic: 'Heart failure', senderName: 'Maya Lopez', score: { got: 8, total: 10 } };

  it('shows her first name and hides her score by default', () => {
    const doc = buildShareDoc(args);
    expect(doc.senderName).toBe('Maya');
    expect(doc.senderScore).toBeNull();
    expect(doc).toMatchObject({ v: 2, totalQuestions: 3, starts: 0, completions: 0, misses: {}, flagged: [] });
  });

  it('follows her switches', () => {
    const doc = buildShareDoc({ ...args, showName: false, includeScore: true });
    expect(doc.senderName).toBeNull();
    expect(doc.senderScore).toEqual({ got: 8, total: 10 });
  });

  it('never carries an account id or an email', () => {
    const doc = buildShareDoc({ ...args, senderName: 'maya@school.edu' });
    expect(doc.senderName).toBeNull();
    expect(JSON.stringify(doc)).not.toMatch(/"(uid|ownerUid|userId|chatId|nodeId)"|@/);
    expect(firstName('  Jo  ')).toBe('Jo');
  });
});

describe('readSharedSet', () => {
  it('strips markup from everything before a card renders it', () => {
    const set = readSharedSet({
      shareId: 'abc', topic: '<b>Heart</b> failure', senderName: '<img src=x onerror=alert(1)>Maya',
      questions: [{ ...ordering, justification: '<script>alert(1)</script>Airway <b>first</b>.<br>Then breathing.' }, mcq(2), mcq(3)],
    });
    expect(set.topic).toBe('Heart failure');
    expect(set.senderName).toBe('Maya');
    expect(set.questions[0].justification).toBe('alert(1)Airway first.\nThen breathing.');
    expect(JSON.stringify(set)).not.toMatch(/<[a-z/!]/i);
  });

  it('carries saved walkthroughs, stripped of markup, and ignores junk', () => {
    const set = readSharedSet({
      shareId: 'abc', questions: [mcq(1), sata, ordering],
      walkthroughs: { 1: { method_line: '<b>One</b> fact', options: [{ index: 0, chain: ['<i>a</i>'] }] }, 2: 'nope', x: { a: 1 }, 3: [1] },
    });
    expect(set.walkthroughs).toEqual({ 1: { method_line: 'One fact', options: [{ index: 0, chain: ['a'] }] } });
    expect(readSharedSet({ shareId: 'abc', questions: [mcq(1)] }).walkthroughs).toEqual({});
  });

  it('starts a new set with no walkthroughs saved', () => {
    expect(buildShareDoc({ shareId: 'abc', questions: [mcq(1)] }).walkthroughs).toEqual({});
  });

  it('leaves flagged questions out and keeps stored positions', () => {
    const set = readSharedSet({ shareId: 'abc', questions: [mcq(1), mcq(2), mcq(3)], flagged: [1] });
    expect(set.questions.map((q) => q.index)).toEqual([0, 2]);
  });

  it('still opens a 2025 link', () => {
    const set = readSharedSet({
      shareId: 'old', topic: 'Nursing Quiz',
      quizzes: [{ question: 'Old one?', options: ['A) left', 'B) right'], answer: 'B) right', justification: 'Right.' }],
    });
    expect(set.questions[0]).toMatchObject({ questionType: 'mcq', correctIndex: 1, rationale: 'Right.' });
  });

  it('is null when nothing usable is left', () => {
    expect(readSharedSet(null)).toBeNull();
    expect(readSharedSet({ questions: [mcq(1)], flagged: [0] })).toBeNull();
  });
});

describe('grading and what comes next', () => {
  const questions = [mcq(1), { ...mcq(2), topic: 'Fluids' }, { ...mcq(3), topic: 'Daily weights' }, mcq(4)].map((q, index) => ({ ...q, index }));

  it('counts right answers and names at most two weak topics', () => {
    const result = gradeSet(questions, { 0: { isCorrect: true }, 1: { isCorrect: false }, 2: { isCorrect: false } });
    expect(result).toMatchObject({ total: 4, correct: 1, percent: 25, missedIndices: [1, 2, 3], weakTopics: ['Fluids', 'Daily weights'] });
  });

  it('asks for practice on the weak topics, or the set topic', () => {
    expect(followUpPrompt({ topic: 'Heart failure', weakTopics: ['Fluids', 'Digoxin'] })).toMatch(/Fluids and Digoxin/);
    expect(followUpPrompt({ topic: 'Heart failure' })).toMatch(/Heart failure/);
    expect(followUpPrompt({ topic: 'Insuffisance cardiaque', language: 'fr-CA' })).toMatch(/^Donne-moi/);
    expect(followUpPrompt({})).toBe('');
  });
});

describe('classSummary', () => {
  const raw = { topic: 'Heart failure', questions: [mcq(1), mcq(2), mcq(3)], completions: 3, misses: { 0: 1, 2: 3 } };

  it('is nothing until a classmate finishes', () => {
    expect(classSummary({ ...raw, completions: 0 })).toBeNull();
    expect(classSummary(undefined)).toBeNull();
  });

  it('names the question the group missed most', () => {
    expect(classSummary(raw)).toMatchObject({ completions: 3, hardest: { index: 2, count: 3, question: 'Question 3?' } });
  });

  it('does not call a question hard from one classmate or one miss', () => {
    expect(classSummary({ ...raw, completions: 1 }).hardest).toBeNull();
    expect(classSummary({ ...raw, misses: { 0: 1 } }).hardest).toBeNull();
  });

  it('adds several sets into one line', () => {
    const combined = combineSummaries([classSummary(raw), null, classSummary({ ...raw, topic: 'Shock', completions: 2, misses: {} })]);
    expect(combined).toMatchObject({ completions: 5, topic: null, hardest: { count: 3 } });
    expect(combineSummaries([null])).toBeNull();
  });
});

describe('shortenTopic', () => {
  it('keeps a short topic and cuts a long one at a word', () => {
    expect(shortenTopic('Heart failure')).toBe('Heart failure');
    expect(shortenTopic('Systematic Patient Evaluation in Emergency Care')).toBe('Systematic Patient Evaluation');
    expect(shortenTopic('')).toBe('');
  });
});

describe('plainText', () => {
  it('keeps comparison signs a question really uses', () => {
    expect(plainText('K+ &lt; 3.5 &amp; HR &gt; 100')).toBe('K+ < 3.5 & HR > 100');
    expect(plainText('SpO2 <90% or RR >24')).toBe('SpO2 <90% or RR >24');
  });

  it('removes escaped and unclosed tags too', () => {
    expect(plainText('&lt;script&gt;x&lt;/script&gt;safe')).toBe('xsafe');
    expect(plainText('hello <img src=x onerror=alert(1)')).toBe('hello ‹img src=x onerror=alert(1)');
  });
});
