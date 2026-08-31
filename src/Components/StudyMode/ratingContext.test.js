import {
  scoreBucket,
  ratingFromNodeResult,
  ratingFromChatQuiz,
  RATING_SOURCE
} from './ratingContext';
import { SURFACE } from '../../Services/satisfactionEnums';

describe('scoreBucket', () => {
  it('uses the same thresholds as the transition screen copy', () => {
    expect(scoreBucket(100)).toBe('mastered');
    expect(scoreBucket(99)).toBe('solid');
    expect(scoreBucket(70)).toBe('solid');
    expect(scoreBucket(69)).toBe('gaps');
    expect(scoreBucket(40)).toBe('gaps');
    expect(scoreBucket(39)).toBe('tough');
    expect(scoreBucket(0)).toBe('tough');
  });

  it('returns null rather than guessing when there is no score', () => {
    expect(scoreBucket(null)).toBeNull();
    expect(scoreBucket(undefined)).toBeNull();
    expect(scoreBucket(NaN)).toBeNull();
  });
});

describe('ratingFromNodeResult — quizzes', () => {
  const quizResult = {
    scored: true,
    type: 'quiz',
    total: 10,
    correct: 7,
    scorePercent: 70,
    topic: 'Cardiac Medications'
  };

  it('routes a quiz to the quiz surface with its score', () => {
    expect(ratingFromNodeResult(quizResult, { locale: 'en' })).toEqual({
      surface: SURFACE.QUIZ,
      context: {
        source: RATING_SOURCE.STUDY_NODE,
        scored: true,
        correct: 7,
        total: 10,
        scorePercent: 70,
        bucket: 'solid',
        topic: 'Cardiac Medications',
        nodeType: 'quiz',
        locale: 'en'
      }
    });
  });

  it('treats an exam as a quiz with more questions', () => {
    const r = ratingFromNodeResult({ ...quizResult, type: 'exam' });
    expect(r.surface).toBe(SURFACE.QUIZ);
    expect(r.context.nodeType).toBe('exam');
  });

  it('recomputes the percentage rather than trusting the one passed in', () => {
    // A stale scorePercent must not outrank the counts it disagrees with.
    expect(ratingFromNodeResult({ ...quizResult, scorePercent: 12 }).context.scorePercent).toBe(70);
  });
});

describe('ratingFromNodeResult — flashcards', () => {
  const cardResult = {
    scored: true,
    type: 'flashcard',
    total: 8,
    mastered: 6,
    scorePercent: 75,
    topic: 'Lab Values'
  };

  it('routes to the flashcard surface and scores on cards mastered', () => {
    const r = ratingFromNodeResult(cardResult);
    expect(r.surface).toBe(SURFACE.FLASHCARD);
    expect(r.context).toMatchObject({
      scored: true,
      correct: 6,
      total: 8,
      scorePercent: 75,
      bucket: 'solid',
      nodeType: 'flashcard'
    });
  });

  it('does not get filed under the quiz surface', () => {
    // "Mastered" is a self-report, not a marked answer; averaging the two
    // together produces a number that means neither.
    expect(ratingFromNodeResult(cardResult).surface).not.toBe(SURFACE.QUIZ);
  });
});

describe('ratingFromNodeResult — unscored content', () => {
  it.each(['lesson', 'audio', 'mindmap'])('routes a %s to the study-block surface', (type) => {
    const r = ratingFromNodeResult({ scored: false, type, topic: 'Sepsis' });
    expect(r.surface).toBe(SURFACE.STUDY_BLOCK);
    expect(r.context).toMatchObject({
      scored: false,
      nodeType: type,
      topic: 'Sepsis'
    });
  });

  it('reports no score at all rather than a stand-in zero', () => {
    // A zero would sink the average of every surface it was grouped with.
    const { context } = ratingFromNodeResult({ scored: false, type: 'lesson' });
    expect(context.scorePercent).toBeNull();
    expect(context.bucket).toBeNull();
    expect(context.correct).toBeNull();
    expect(context.total).toBeNull();
  });

  it('still produces a rating for a node type it has never seen', () => {
    // New node types must degrade to "rateable but unscored", not to silence.
    const r = ratingFromNodeResult({ scored: false, type: 'simulation' });
    expect(r.surface).toBe(SURFACE.STUDY_BLOCK);
    expect(r.context.nodeType).toBe('simulation');
  });

  it('returns null only when there is no result at all', () => {
    expect(ratingFromNodeResult(null)).toBeNull();
    expect(ratingFromNodeResult(undefined)).toBeNull();
  });
});

describe('ratingFromChatQuiz', () => {
  it('normalises the chat completion payload into the same shape', () => {
    expect(ratingFromChatQuiz(
      { correctCount: 3, totalQuestions: 4, topic: 'Sepsis' },
      { locale: 'fr' }
    )).toEqual({
      surface: SURFACE.QUIZ,
      context: {
        source: RATING_SOURCE.CHAT,
        scored: true,
        correct: 3,
        total: 4,
        scorePercent: 75,
        bucket: 'solid',
        topic: 'Sepsis',
        nodeType: 'quiz',
        locale: 'fr'
      }
    });
  });

  it('returns null for a missing completion payload', () => {
    expect(ratingFromChatQuiz(null)).toBeNull();
  });
});

describe('degenerate counts', () => {
  it('never writes NaN when the quiz has no questions', () => {
    const { context } = ratingFromChatQuiz({ correctCount: 0, totalQuestions: 0 });
    expect(context.total).toBe(0);
    expect(context.scorePercent).toBeNull();
    expect(context.bucket).toBeNull();
  });

  it('clamps a correct count that exceeds the total', () => {
    const { context } = ratingFromChatQuiz({ correctCount: 9, totalQuestions: 4 });
    expect(context.correct).toBe(4);
    expect(context.scorePercent).toBe(100);
  });

  it('floors negative and non-numeric counts to zero', () => {
    const { context } = ratingFromChatQuiz({ correctCount: -3, totalQuestions: 'five' });
    expect(context.correct).toBe(0);
    expect(context.total).toBe(0);
    expect(context.scorePercent).toBeNull();
  });

  it('omits topic and locale as null rather than undefined — Firestore rejects undefined', () => {
    const { context } = ratingFromChatQuiz({ correctCount: 1, totalQuestions: 2 });
    expect(context.topic).toBeNull();
    expect(context.locale).toBeNull();
    expect(Object.values(context).every((v) => v !== undefined)).toBe(true);
  });
});
