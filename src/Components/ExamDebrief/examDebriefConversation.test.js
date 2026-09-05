import {
  normalizeInsights,
  preparednessOrdinal,
  buildDebriefWrite,
  toWireMessages,
  studentTurnCount,
  atTurnLimit,
  storableTranscript,
  MAX_STUDENT_TURNS,
  MAX_MESSAGE_CHARS
} from './examDebriefConversation';
import { SENTIMENT, PREPAREDNESS } from '../../Services/satisfactionEnums';

const RAW = {
  preparedness: 'somewhat_unprepared',
  difficulty: 'harder_than_expected',
  what_surprised: 'So many prioritization scenarios',
  different_from_prep: 'Case studies, not recall',
  missing_prep: 'Prioritising between patients',
  what_helped: 'The flashcards for drug names',
  what_did_not_help: 'The mindmaps, never opened them again',
  topics_missed: ['vasopressor titration', 'insulin onset times'],
  question_formats: ['multi-patient prioritization', 'drip rate calculations'],
  example_questions: [
    'Patient on noradrenaline at 8 mcg/min, MAP 58 — what rate do you go to?'
  ],
  exam_emphasis: 'About half the exam was multi-patient prioritization',
  biggest_improvement: 'Add multi-patient prioritization questions',
  gap_tags: ['more_case_scenarios', 'more_realistic_questions']
};

const CONVO = [
  { role: 'assistant', content: 'How did it go?' },
  { role: 'user', content: 'Harder than I expected.' },
  { role: 'assistant', content: 'What made it harder?' },
  { role: 'user', content: 'Lots of case scenarios.' }
];

describe('preparednessOrdinal', () => {
  it('maps the model vocabulary onto the stored 4..1 scale', () => {
    expect(preparednessOrdinal('well')).toBe(PREPAREDNESS.WELL);
    expect(preparednessOrdinal('mostly')).toBe(PREPAREDNESS.MOSTLY);
    expect(preparednessOrdinal('somewhat_unprepared')).toBe(PREPAREDNESS.SOMEWHAT_UNPREPARED);
    expect(preparednessOrdinal('not_prepared')).toBe(PREPAREDNESS.NOT_ENOUGH);
  });

  it('returns null for unknown rather than a middle value', () => {
    // She never said. A stand-in would drag the distribution toward a number
    // nobody reported.
    expect(preparednessOrdinal('unknown')).toBeNull();
    expect(preparednessOrdinal(undefined)).toBeNull();
    expect(preparednessOrdinal('somewhat')).toBeNull();
  });
});

describe('normalizeInsights', () => {
  it('renames the wire fields and keeps every answer', () => {
    expect(normalizeInsights(RAW)).toEqual({
      preparedness: 2,
      difficulty: 'harder_than_expected',
      whatSurprised: 'So many prioritization scenarios',
      differentFromPrep: 'Case studies, not recall',
      missingPrep: 'Prioritising between patients',
      whatHelped: 'The flashcards for drug names',
      whatDidNotHelp: 'The mindmaps, never opened them again',
      topicsMissed: ['vasopressor titration', 'insulin onset times'],
      questionFormats: ['multi-patient prioritization', 'drip rate calculations'],
      exampleQuestions: [
        'Patient on noradrenaline at 8 mcg/min, MAP 58 — what rate do you go to?'
      ],
      examEmphasis: 'About half the exam was multi-patient prioritization',
      biggestImprovement: 'Add multi-patient prioritization questions',
      gapTags: ['more_case_scenarios', 'more_realistic_questions']
    });
  });

  it('turns the empty strings the model uses for "not said" into nulls', () => {
    const out = normalizeInsights({ ...RAW, what_helped: '', biggest_improvement: '   ' });
    expect(out.whatHelped).toBeNull();
    expect(out.biggestImprovement).toBeNull();
  });

  it('keeps the open-ended lists open — no vocabulary to validate against', () => {
    // The whole value of "vasopressor titration" is that nobody could have put
    // it in a closed set beforehand. These are what become content.
    const out = normalizeInsights({
      ...RAW,
      topics_missed: ['  anything at all  ', '', 42, 'x'.repeat(300)]
    });
    expect(out.topicsMissed[0]).toBe('anything at all');
    expect(out.topicsMissed).toHaveLength(2);
    expect(out.topicsMissed[1]).toHaveLength(120);
  });

  it('caps a runaway list rather than storing whatever arrives', () => {
    const many = Array.from({ length: 40 }, (_, i) => `topic ${i}`);
    expect(normalizeInsights({ ...RAW, question_formats: many }).questionFormats)
      .toHaveLength(10);
  });

  it('survives a response with nothing usable on it', () => {
    const out = normalizeInsights({});
    expect(out).toMatchObject({
      preparedness: null,
      difficulty: null,
      gapTags: [],
      topicsMissed: [],
      questionFormats: [],
      exampleQuestions: []
    });
    expect(normalizeInsights(null).gapTags).toEqual([]);
    expect(normalizeInsights(undefined).whatSurprised).toBeNull();
  });

  it('drops a difficulty value outside the closed set', () => {
    expect(normalizeInsights({ ...RAW, difficulty: 'brutal' }).difficulty).toBeNull();
  });

  it('coerces a non-array gap_tags rather than trusting it', () => {
    expect(normalizeInsights({ ...RAW, gap_tags: 'harder_questions' }).gapTags).toEqual([]);
  });
});

describe('turn counting', () => {
  it('counts only what the student said', () => {
    expect(studentTurnCount(CONVO)).toBe(2);
    expect(studentTurnCount([])).toBe(0);
  });

  it('closes the input once the budget is spent', () => {
    const long = Array.from({ length: MAX_STUDENT_TURNS }, () => ({
      role: 'user',
      content: 'x'
    }));
    expect(atTurnLimit(CONVO)).toBe(false);
    expect(atTurnLimit(long)).toBe(true);
  });
});

describe('toWireMessages', () => {
  it('sends role and content only, in order', () => {
    const wire = toWireMessages([
      { role: 'assistant', content: 'Hi', id: 'a1', pending: true },
      { role: 'user', content: 'Hey' }
    ]);
    expect(wire).toEqual([
      { role: 'assistant', content: 'Hi' },
      { role: 'user', content: 'Hey' }
    ]);
  });

  it('drops placeholders that have no content', () => {
    // The typing indicator is a message in local state with no text; sending it
    // would post an empty turn the API rejects.
    expect(toWireMessages([{ role: 'assistant', content: '' }, ...CONVO])).toHaveLength(4);
  });

  it('caps a single message rather than letting one paste run away', () => {
    const huge = 'x'.repeat(MAX_MESSAGE_CHARS + 500);
    expect(toWireMessages([{ role: 'user', content: huge }])[0].content).toHaveLength(
      MAX_MESSAGE_CHARS
    );
  });
});

describe('storableTranscript', () => {
  it('keeps the most recent exchanges when a conversation runs long', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 ? 'user' : 'assistant',
      content: `m${i}`
    }));
    const stored = storableTranscript(many);
    expect(stored).toHaveLength(20);
    expect(stored[stored.length - 1].content).toBe('m29');
  });
});

describe('buildDebriefWrite', () => {
  const exam = {
    label: 'Pharmacology',
    day: '2026-08-29',
    daysAgo: 2,
    key: 'exam:a1'
  };

  it('derives sentiment from preparedness, not from tone', () => {
    const write = buildDebriefWrite({ insights: RAW, messages: CONVO, exam, locale: 'en' });
    expect(write.sentiment).toBe(SENTIMENT.NEGATIVE);
    expect(write.context.preparedness).toBe(2);
  });

  it('leaves sentiment null when she never said how prepared she felt', () => {
    // Null, not zero: an unrated row is excluded from the rate, a neutral one
    // is averaged into it.
    const write = buildDebriefWrite({
      insights: { ...RAW, preparedness: 'unknown' },
      messages: CONVO,
      exam
    });
    expect(write.sentiment).toBeNull();
  });

  it('files the gap tags as reasons so the existing tally keeps working', () => {
    const write = buildDebriefWrite({ insights: RAW, messages: CONVO, exam });
    expect(write.reasons).toEqual(['more_case_scenarios', 'more_realistic_questions']);
  });

  it('puts what surprised her in comment, and keeps the rest addressable', () => {
    const write = buildDebriefWrite({ insights: RAW, messages: CONVO, exam });
    expect(write.comment).toBe('So many prioritization scenarios');
    expect(write.context.insights.biggestImprovement).toBe(
      'Add multi-patient prioritization questions'
    );
    expect(write.context.insights.whatHelped).toBe('The flashcards for drug names');
    expect(write.context.insights.whatDidNotHelp).toBe('The mindmaps, never opened them again');
  });

  it('keeps a recalled exam question at full length, not label length', () => {
    // One real question carries topic, format, difficulty and phrasing at once.
    // Truncating it to a tag's 120 chars would cost the half that makes it
    // reproducible.
    const long = 'Q: ' + 'x'.repeat(400);
    const out = normalizeInsights({ ...RAW, example_questions: [long] });
    expect(out.exampleQuestions[0]).toHaveLength(403);
  });

  it('stores the specifics that become content', () => {
    // The point of digging: a topic label we can build a lesson from, and a
    // format we can generate questions in.
    const write = buildDebriefWrite({ insights: RAW, messages: CONVO, exam });
    expect(write.context.insights.topicsMissed).toEqual([
      'vasopressor titration',
      'insulin onset times'
    ]);
    expect(write.context.insights.questionFormats).toEqual([
      'multi-patient prioritization',
      'drip rate calculations'
    ]);
    expect(write.context.insights.exampleQuestions).toHaveLength(1);
    expect(write.context.insights.examEmphasis).toBe(
      'About half the exam was multi-patient prioritization'
    );
  });

  it('stores the transcript, so a surprising tally can be read back', () => {
    const write = buildDebriefWrite({ insights: RAW, messages: CONVO, exam });
    expect(write.context.transcript).toEqual([
      { role: 'assistant', content: 'How did it go?' },
      { role: 'user', content: 'Harder than I expected.' },
      { role: 'assistant', content: 'What made it harder?' },
      { role: 'user', content: 'Lots of case scenarios.' }
    ]);
    expect(write.context.turns).toBe(2);
  });

  it('carries the exam identity for slicing later', () => {
    const write = buildDebriefWrite({ insights: RAW, messages: CONVO, exam, locale: 'fr' });
    expect(write.context).toMatchObject({
      examLabel: 'Pharmacology',
      examDay: '2026-08-29',
      daysAfterExam: 2,
      locale: 'fr'
    });
  });

  it('flags a dev-preview conversation so the rollup can drop it', () => {
    const write = buildDebriefWrite({
      insights: RAW,
      messages: CONVO,
      exam: { ...exam, devPreview: true }
    });
    expect(write.context.devPreview).toBe(true);
  });

  it('writes a usable row from a conversation that produced almost nothing', () => {
    // One "it was fine" and a closed tab. Still a row, still countable.
    const write = buildDebriefWrite({
      insights: { preparedness: 'mostly', difficulty: 'unknown', gap_tags: [] },
      messages: [
        { role: 'assistant', content: 'How did it go?' },
        { role: 'user', content: 'Fine' }
      ],
      exam
    });
    expect(write.sentiment).toBe(SENTIMENT.POSITIVE);
    expect(write.comment).toBeNull();
    expect(write.reasons).toEqual([]);
    expect(write.context.turns).toBe(1);
  });
});
