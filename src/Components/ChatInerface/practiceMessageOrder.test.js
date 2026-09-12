import { placePracticeDebriefs } from './practiceMessageOrder';

test('places a new review directly after its older source quiz', () => {
  const messages = [
    { id: 'quiz', type: 'quiz' },
    { id: 'later-user', role: 'user' },
    { id: 'later-answer', role: 'assistant' },
    { id: 'review', type: 'practice_debrief', sourceQuizId: 'quiz' },
  ];
  expect(placePracticeDebriefs(messages).map(message => message.id)).toEqual([
    'quiz', 'review', 'later-user', 'later-answer',
  ]);
});

test('keeps a review in chronological order when its quiz is unavailable', () => {
  const messages = [
    { id: 'first' },
    { id: 'review', type: 'practice_debrief', sourceQuizId: 'missing' },
    { id: 'last' },
  ];
  expect(placePracticeDebriefs(messages).map(message => message.id)).toEqual(['first', 'review', 'last']);
});

test('preserves the order of reviews for an extended quiz', () => {
  const messages = [
    { id: 'quiz', type: 'quiz' },
    { id: 'review-5', type: 'practice_debrief', sourceQuizId: 'quiz', questionCount: 5 },
    { id: 'other' },
    { id: 'review-10', type: 'practice_debrief', sourceQuizId: 'quiz', questionCount: 10 },
  ];
  expect(placePracticeDebriefs(messages).map(message => message.id)).toEqual([
    'quiz', 'review-5', 'review-10', 'other',
  ]);
});
