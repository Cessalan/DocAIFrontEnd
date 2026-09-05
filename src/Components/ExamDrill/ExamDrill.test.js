import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExamDrill from './ExamDrill';
import { createDrillState } from './drillModel';

/**
 * Regression cover for the double-answer bug.
 *
 * The drill hands SATA and case study questions to the components the exam
 * node already uses, and those own their submitted state internally. When the
 * question body was keyed on `drillState.answered`, submitting an answer
 * incremented that counter and remounted the card — it came back blank, the
 * student answered again, and the second answer was dropped on the floor
 * because the drill had already recorded the first. The visible symptom was
 * "I have to answer twice before it saves".
 *
 * The stub below stands in for those cards: all it does is hold a scratch bit
 * of internal state, which is exactly what a remount destroys.
 */

const mockMounts = [];

jest.mock('./DrillQuestion', () => {
  const ReactLocal = require('react');
  return function StubDrillQuestion({ question, questionNumber, onAnswer, answered }) {
    const [touched, setTouched] = ReactLocal.useState(false);
    ReactLocal.useEffect(() => {
      mockMounts.push(question?.question);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return (
      <div>
        <span data-testid="q-text">{question?.question}</span>
        <span data-testid="q-number">{questionNumber}</span>
        <span data-testid="scratch">{touched ? 'touched' : 'clean'}</span>
        <span data-testid="revealed">{answered ? 'revealed' : 'open'}</span>
        <button type="button" data-testid="touch" onClick={() => setTouched(true)}>
          touch
        </button>
        <button
          type="button"
          data-testid="submit"
          onClick={() =>
            onAnswer({ format: 'mcq', isCorrect: true, score: 1, maxScore: 1, topic: 'Cardio' })
          }
        >
          submit
        </button>
      </div>
    );
  };
});

jest.mock('./DrillCheckpoint', () => () => <div data-testid="checkpoint" />);

const mockGenerate = jest.fn();
const mockLoad = jest.fn();
jest.mock('../../Services/ExamDrillService', () => ({
  generateDrillQuestion: (...args) => mockGenerate(...args),
  loadDrillState: (...args) => mockLoad(...args),
  saveDrillState: () => Promise.resolve(),
}));

jest.mock('../../Services/StudySessionService', () => ({
  updateStudyPerformance: () => Promise.resolve(),
}));

jest.mock('../../Contexts/UsageContext/UsageContext', () => ({
  useUsageLimit: () => ({
    isPro: true,
    remaining: Infinity,
    requireQuota: () => true,
    consume: () => {},
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback, opts) => {
      let out = typeof fallback === 'string' ? fallback : key;
      const vars = typeof fallback === 'object' && fallback !== null ? fallback : opts;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          out = out.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
        });
      }
      return out;
    },
  }),
}));

const question = (n) => ({
  question: `Question text ${n}`,
  questionType: 'mcq',
  options: ['A', 'B', 'C', 'D'],
  correctIndex: 0,
  topic: 'Cardio',
});

beforeEach(() => {
  mockMounts.length = 0;
  let n = 0;
  mockGenerate.mockImplementation(() => {
    n += 1;
    return Promise.resolve(question(n));
  });
  mockLoad.mockResolvedValue(null);
});

const renderDrill = () =>
  render(<ExamDrill chatId="chat-1" topics={['Cardio']} onExit={() => {}} />);

test('the answered card is not remounted, so its own state survives the submit', async () => {
  renderDrill();
  await screen.findByTestId('q-text');
  expect(mockMounts).toHaveLength(1);

  // Stand in for a half-filled SATA card: state only this instance holds.
  fireEvent.click(screen.getByTestId('touch'));
  expect(screen.getByTestId('scratch')).toHaveTextContent('touched');

  fireEvent.click(screen.getByTestId('submit'));

  await waitFor(() => expect(screen.getByTestId('revealed')).toHaveTextContent('revealed'));
  expect(mockMounts).toHaveLength(1);
  expect(screen.getByTestId('scratch')).toHaveTextContent('touched');
});

test('the question number holds still while she reads her feedback', async () => {
  renderDrill();
  await screen.findByTestId('q-text');
  expect(screen.getByText('Question 1')).toBeInTheDocument();
  expect(screen.getByTestId('q-number')).toHaveTextContent('1');

  fireEvent.click(screen.getByTestId('submit'));
  await waitFor(() => expect(screen.getByTestId('revealed')).toHaveTextContent('revealed'));

  expect(screen.getByText('Question 1')).toBeInTheDocument();
  expect(screen.getByTestId('q-number')).toHaveTextContent('1');
});

test('the next question does remount, and advances the count', async () => {
  renderDrill();
  await screen.findByTestId('q-text');

  fireEvent.click(screen.getByTestId('submit'));
  await waitFor(() => expect(screen.getByTestId('revealed')).toHaveTextContent('revealed'));

  fireEvent.click(screen.getByRole('button', { name: /next question/i }));

  await waitFor(() => expect(screen.getByTestId('q-text')).toHaveTextContent('Question text 2'));
  expect(mockMounts).toHaveLength(2);
  expect(screen.getByTestId('scratch')).toHaveTextContent('clean');
  expect(screen.getByText('Question 2')).toBeInTheDocument();
});

/**
 * The resume card in the chat says "18 questions answered so far". A header
 * that then reads "Question 4 of 10" — her position inside the third block —
 * reads as lost work. She counts questions answered; blocks are ours.
 */
test('resuming a drill counts from where she left off, not from the block', async () => {
  mockLoad.mockResolvedValue({
    ...createDrillState(['Cardio']),
    answered: 18,
    lastCheckpointAt: 15,
  });

  renderDrill();
  await screen.findByTestId('q-text');

  expect(screen.getByText('Question 19')).toBeInTheDocument();
  // Ten-question block that began at 15: this one plus six more.
  expect(screen.getByText('Checkpoint in 7')).toBeInTheDocument();

  fireEvent.click(screen.getByTestId('submit'));
  await waitFor(() => expect(screen.getByTestId('revealed')).toHaveTextContent('revealed'));

  // Both hold still through the feedback.
  expect(screen.getByText('Question 19')).toBeInTheDocument();
  expect(screen.getByText('Checkpoint in 7')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /next question/i }));
  await waitFor(() => expect(screen.getByText('Question 20')).toBeInTheDocument());
  expect(screen.getByText('Checkpoint in 6')).toBeInTheDocument();
});
