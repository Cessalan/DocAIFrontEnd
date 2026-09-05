import {
  toConversations,
  filterConversations,
  conversationCounts,
  presentInsights,
  splitOnMatch,
  RENDERED_INSIGHT_KEYS,
  INSIGHT_FIELDS
} from './conversationList';
import { normalizeInsights } from '../ExamDebrief/examDebriefConversation';
import { SURFACE, PREPAREDNESS } from '../../Services/satisfactionEnums';

/**
 * The reader's contract, in one sentence: every stored transcript is reachable,
 * and nothing a student said is silently dropped on the way to the screen.
 *
 * The load-bearing case is `keeps a conversation with no comment` — that is the
 * exact row the dashboard's `<details>` cannot reach, and the reason this
 * module exists.
 */

const day = (iso) => ({ toDate: () => new Date(iso) });

const signal = (overrides = {}) => ({
  id: 'sig-1',
  surface: SURFACE.EXAM_DEBRIEF,
  sentiment: 1,
  reasons: [],
  comment: 'The pharm questions were nothing like ours',
  userEmail: 'student@example.com',
  timestamp: day('2026-08-30T10:00:00Z'),
  ...overrides,
  context: {
    preparedness: PREPAREDNESS.MOSTLY,
    examLabel: 'NCLEX-RN',
    transcript: [
      { role: 'assistant', content: 'How did it go?' },
      { role: 'user', content: 'Rough. The pharm section destroyed me.' },
      { role: 'assistant', content: 'What kind of pharm questions?' },
      { role: 'user', content: 'Dosage calculations, six of them.' }
    ],
    insights: normalizeInsights({
      preparedness: 'mostly',
      difficulty: 'harder_than_expected',
      what_surprised: 'The pharm questions were nothing like ours',
      topics_missed: ['dosage calculation', 'vasopressor titration'],
      gap_tags: ['harder_questions']
    }),
    ...(overrides.context || {})
  }
});

describe('toConversations', () => {
  it('keeps only rows that stored a transcript', () => {
    const rows = [
      signal({ id: 'with' }),
      { id: 'thumbs-only', surface: SURFACE.QUIZ, sentiment: -1, context: { topic: 'Cardiac' } }
    ];

    expect(toConversations(rows).map((c) => c.id)).toEqual(['with']);
  });

  it('keeps a conversation that produced no comment', () => {
    // The row the dashboard cannot show: she talked, but never named a
    // surprise, so `comment` is null and the `<details>` is never rendered.
    const rows = [signal({ id: 'quiet', comment: null })];

    const [conversation] = toConversations(rows);
    expect(conversation.id).toBe('quiet');
    expect(conversation.turnCount).toBe(2);
  });

  it('keeps dev-preview rows and flags them', () => {
    const rows = [signal({ id: 'preview', context: { devPreview: true } })];

    expect(toConversations(rows)[0].devPreview).toBe(true);
  });

  it('snippets the student, not the tutor', () => {
    expect(toConversations([signal()])[0].snippet).toBe('Rough. The pharm section destroyed me.');
  });

  it('sorts newest first', () => {
    const rows = [
      signal({ id: 'older', timestamp: day('2026-08-01T10:00:00Z') }),
      signal({ id: 'newer', timestamp: day('2026-08-29T10:00:00Z') })
    ];

    expect(toConversations(rows).map((c) => c.id)).toEqual(['newer', 'older']);
  });

  it('drops transcript lines with no role or no content', () => {
    const rows = [
      signal({
        context: {
          transcript: [
            { role: 'user', content: 'Real' },
            { role: 'system', content: 'Injected' },
            { role: 'user', content: '' }
          ]
        }
      })
    ];

    expect(toConversations(rows)[0].transcript).toEqual([{ role: 'user', content: 'Real' }]);
  });

  it('measures the longest thing she wrote', () => {
    expect(toConversations([signal()])[0].longestStudentChars).toBe(
      'Rough. The pharm section destroyed me.'.length
    );
  });
});

describe('presentInsights', () => {
  it('covers every field normalizeInsights produces', () => {
    // The guard that stops a new insight being written, counted, and never
    // shown. If this fails, add the field to INSIGHT_FIELDS.
    const produced = Object.keys(normalizeInsights({}));

    expect(produced.filter((key) => !RENDERED_INSIGHT_KEYS.includes(key))).toEqual([]);
  });

  it('omits fields with no value rather than rendering them blank', () => {
    const items = presentInsights(normalizeInsights({ what_surprised: 'Timing' }));

    expect(items.map((i) => i.key)).toEqual(['whatSurprised']);
  });

  it('keeps the declared reading order', () => {
    const items = presentInsights(
      normalizeInsights({
        biggest_improvement: 'harder practice',
        example_questions: ['A 62-year-old presents with...']
      })
    );

    expect(items.map((i) => i.key)).toEqual(['exampleQuestions', 'biggestImprovement']);
    expect(INSIGHT_FIELDS.findIndex((f) => f.key === 'exampleQuestions')).toBeLessThan(
      INSIGHT_FIELDS.findIndex((f) => f.key === 'biggestImprovement')
    );
  });

  it('survives a row written before insights existed', () => {
    expect(presentInsights(null)).toEqual([]);
  });
});

describe('filterConversations', () => {
  const conversations = toConversations([
    signal({ id: 'a' }),
    signal({
      id: 'b',
      context: {
        preparedness: PREPAREDNESS.NOT_ENOUGH,
        transcript: [{ role: 'user', content: 'I ran out of time on the maths' }],
        insights: normalizeInsights({ topics_missed: ['IV drip rates'] })
      }
    }),
    signal({ id: 'c', context: { devPreview: true } })
  ]);

  it('returns everything by default, dev previews included', () => {
    expect(filterConversations(conversations)).toHaveLength(3);
  });

  it('excludes dev previews on request', () => {
    const kept = filterConversations(conversations, { includeDevPreview: false });

    expect(kept.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('searches the transcript case-insensitively', () => {
    expect(filterConversations(conversations, { query: 'PHARM' }).map((c) => c.id)).toEqual([
      'a',
      'c'
    ]);
  });

  it('searches the extracted insights too', () => {
    // "IV drip rates" was never typed by the student; it is Claude's reading.
    expect(filterConversations(conversations, { query: 'drip' }).map((c) => c.id)).toEqual(['b']);
  });

  it('filters by preparedness ordinal', () => {
    expect(
      filterConversations(conversations, { preparedness: PREPAREDNESS.NOT_ENOUGH }).map((c) => c.id)
    ).toEqual(['b']);
  });

  it('treats a blank query as no filter', () => {
    expect(filterConversations(conversations, { query: '   ' })).toHaveLength(3);
  });
});

describe('conversationCounts', () => {
  it('reports what is hidden and what is unanswered', () => {
    const conversations = toConversations([
      signal({ id: 'a' }),
      signal({ id: 'b', context: { devPreview: true } }),
      signal({ id: 'c', context: { preparedness: null } })
    ]);

    expect(conversationCounts(conversations)).toEqual({
      total: 3,
      devPreview: 1,
      studentTurns: 6,
      withoutPreparedness: 1
    });
  });

  it('is zeroed, not undefined, on an empty list', () => {
    expect(conversationCounts([])).toEqual({
      total: 0,
      devPreview: 0,
      studentTurns: 0,
      withoutPreparedness: 0
    });
  });
});

describe('splitOnMatch', () => {
  it('marks every occurrence', () => {
    expect(splitOnMatch('pharm and more pharm', 'pharm')).toEqual([
      { text: 'pharm', hit: true },
      { text: ' and more ', hit: false },
      { text: 'pharm', hit: true }
    ]);
  });

  it('preserves the original casing of a match', () => {
    expect(splitOnMatch('Pharm', 'pharm')).toEqual([{ text: 'Pharm', hit: true }]);
  });

  it('returns the whole text unmarked with no query', () => {
    expect(splitOnMatch('anything', '')).toEqual([{ text: 'anything', hit: false }]);
  });

  it('does not loop forever on an empty match', () => {
    expect(splitOnMatch('text', '   ')).toEqual([{ text: 'text', hit: false }]);
  });
});
