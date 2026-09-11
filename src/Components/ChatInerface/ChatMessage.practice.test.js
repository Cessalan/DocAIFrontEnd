import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatMessage from './ChatMessage';

jest.mock('react-markdown', () => ({ __esModule: true, default: () => null }));
jest.mock('remark-gfm', () => ({ __esModule: true, default: () => {} }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' }, t: (key, fallback) => typeof fallback === 'string' ? fallback : fallback?.defaultValue || key }) }));
jest.mock('./ChatQuizStream', () => () => <div>Legacy inline quiz</div>);
jest.mock('./ChatFlashcard', () => () => null);
jest.mock('./FlashcardResults', () => () => null);
jest.mock('./ChatSummary', () => () => null);
jest.mock('./ChatScenario', () => () => null);
jest.mock('./ChatStudySheet', () => () => null);
jest.mock('./MessageRating', () => () => null);
jest.mock('./QuizLoading', () => () => null);
jest.mock('./StreamingLogo', () => () => null);
jest.mock('./StaticLogo', () => () => null);
jest.mock('../Mindmap/DiagramAwarePre', () => () => null);
jest.mock('./useArtifactEngagement', () => () => {});
jest.mock('../../Services/FastAPICalls', () => ({ rewrite_text: jest.fn() }));
jest.mock('../../Services/devLogger', () => ({ devLog: jest.fn() }));

test.each([false, true])('saved quizzes open focused practice, including admin view=%s', viewAllChatsMode => {
  const open = jest.fn();
  render(<ChatMessage message={{ id: 'saved-quiz', role: 'assistant', type: 'quiz', quizData: [{ question: 'Saved question' }] }}
    onOpenPractice={open} viewAllChatsMode={viewAllChatsMode} />);
  expect(screen.queryByText('Legacy inline quiz')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Start practice' }));
  expect(open).toHaveBeenCalledWith('saved-quiz', expect.objectContaining({ left: expect.any(Number), top: expect.any(Number), width: expect.any(Number), height: expect.any(Number) }));
});

test('legacy quizzes use their actual question topics as the launch title', () => {
  render(<ChatMessage message={{ id: 'legacy', role: 'assistant', type: 'quiz', quizTopic: 'Quiz practice', quizData: [{ question: 'A question', topic: 'Trauma care' }, { question: 'Another question', topic: 'Family support' }] }} onOpenPractice={jest.fn()} />);
  expect(screen.getByRole('heading', { name: 'Trauma care · Family support' })).toBeInTheDocument();
  expect(screen.queryByText('Tutor included')).not.toBeInTheDocument();
});
