import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '../../i18n/i18n';
import PlanOnboarding from './PlanOnboarding';

jest.mock('../../Services/FastAPICalls', () => ({
  clear_in_flight_study_journey: jest.fn(),
}));

jest.mock('../../Services/FunnelService', () => ({
  FUNNEL: {
    EXAM_DATE_STARTED: 'exam_date_started',
    EXAM_DATE_COMPLETED: 'exam_date_completed',
    DIAGNOSTIC_COMPLETED: 'diagnostic_completed',
  },
  logFunnelStep: jest.fn(),
  logFunnelStepOnce: jest.fn(),
  enrichFunnel: jest.fn(),
}));

// The lesson step streams from the backend; stub it to hand straight on so a
// test can walk the whole flow with real topics. The payload mirrors what
// FirstLessonPane really reports: a first-attempt score for its topic.
let mockQuickCheck = { topic: 'Insulin Administration', correct: 1, total: 2, percent: 50 };
jest.mock('./FirstLessonPane', () => (props) => (
  <button onClick={() => props.onDone(mockQuickCheck)}>stub-finish-lesson</button>
));

// No topics => the insights step has nothing to teach from, so its CTA goes
// straight to the exam-date question. That is the shortest path to the screen
// under test and is itself the documented behaviour.
const renderAtExamDate = (props = {}) => {
  const onConfirm = jest.fn();
  render(<PlanOnboarding topics={[]} insights={[]} chatId="chat-1" onConfirm={onConfirm} {...props} />);
  fireEvent.click(screen.getByText('Show me where to start'));
  return onConfirm;
};

describe('PlanOnboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const tapAndFlush = (label) => {
    fireEvent.click(screen.getByText(label));
    act(() => { jest.advanceTimersByTime(300); });
  };

  it('asks for the exam date and nothing else', () => {
    renderAtExamDate();
    expect(screen.getByText("When's the exam?")).toBeInTheDocument();
    // The three steps that were cut for length must not reappear.
    expect(screen.queryByText(/where are you in your prep/i)).toBeNull();
    expect(screen.queryByText(/Anything you'd add/i)).toBeNull();
    expect(screen.queryByText(/Here's what I'll build/i)).toBeNull();
  });

  it('hands off straight from the date tap — no confirm step', () => {
    const onConfirm = renderAtExamDate();
    tapAndFlush('Today');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  describe('the tapped date, not the stale one', () => {
    // setExamKey has not flushed when the handler runs, so reading derived
    // state there built preferences from the PREVIOUS selection — null on the
    // first tap. That shipped an examDate of null to the pre-fired diagnostic.
    it('resolves the date from the key that was tapped', () => {
      const onConfirm = renderAtExamDate();
      tapAndFlush('Today');
      const { userPreferences } = onConfirm.mock.calls[0][0];
      expect(userPreferences.examChoiceKey).toBe('today');
      expect(userPreferences.examDaysAway).toBe(0);
      expect(userPreferences.examDate).toEqual(expect.any(String));
    });

    it('carries the right offset for a later choice', () => {
      const onConfirm = renderAtExamDate();
      tapAndFlush('Next week');
      expect(onConfirm.mock.calls[0][0].userPreferences.examDaysAway).toBe(10);
    });

    it('hands the resolved date to the plan, not null', () => {
      const onConfirm = renderAtExamDate();
      tapAndFlush('Tomorrow');
      const { userPreferences } = onConfirm.mock.calls[0][0];
      expect(userPreferences.examDate).toEqual(expect.any(String));
      expect(userPreferences.examDaysAway).toBe(1);
    });
  });

  describe('hardestTopics, derived instead of asked', () => {
    const topics = ['Insulin Administration', 'Charting', 'Sepsis'];

    // Walk the real path: insights CTA -> lesson (stubbed) -> exam date.
    const walkToDate = () => {
      const onConfirm = jest.fn();
      render(
        <PlanOnboarding topics={topics} insights={[]} chatId="chat-1" onConfirm={onConfirm} />
      );
      fireEvent.click(screen.getByText(/^Start with |^Show me where to start$/));
      fireEvent.click(screen.getByText('stub-finish-lesson'));
      return onConfirm;
    };

    it('opens the lesson on the topic the insights card named', () => {
      // The CTA is a promise about what happens next; the lesson has to honour
      // it, so both sides read the same ranking. Needs real coverage: without
      // it the card has no basis to name a topic and says so instead.
      const covered = [
        { topic: 'Insulin Administration', insight: 'x', key_points: ['a', 'b', 'c', 'd'], context: 'c' },
      ];
      render(<PlanOnboarding topics={topics} insights={covered} chatId="c" onConfirm={jest.fn()} />);
      expect(screen.getByText('Start with Insulin Administration')).toBeInTheDocument();
    });

    it('does not name a topic in the CTA when nothing was extracted', () => {
      render(<PlanOnboarding topics={topics} insights={[]} chatId="c" onConfirm={jest.fn()} />);
      expect(screen.queryByText(/^Start with /)).toBeNull();
      expect(screen.getByText('Show me where to start')).toBeInTheDocument();
    });

    it('sends the top-ranked topics as focus, without ever asking', () => {
      const onConfirm = walkToDate();
      tapAndFlush('This week');
      const { userPreferences } = onConfirm.mock.calls[0][0];
      expect(userPreferences.hardestTopics).toContain('Insulin Administration');
    });

    it('caps focus at two, matching the question it replaced', () => {
      const onConfirm = walkToDate();
      tapAndFlush('This week');
      expect(onConfirm.mock.calls[0][0].userPreferences.hardestTopics.length)
        .toBeLessThanOrEqual(2);
    });

    it('carries the quick-check result through to the hand-off', () => {
      const onConfirm = walkToDate();
      tapAndFlush('Today');
      expect(onConfirm.mock.calls[0][0].quickCheckResult).toEqual(mockQuickCheck);
    });
  });

  describe('the diagnostic, derived instead of asked', () => {
    const topics = ['Insulin Administration', 'Charting', 'Sepsis'];

    const walkToDate = (props = {}) => {
      const onConfirm = jest.fn();
      render(
        <PlanOnboarding topics={topics} insights={[]} chatId="c" onConfirm={onConfirm} {...props} />
      );
      fireEvent.click(screen.getByText(/^Start with |^Show me where to start$/));
      fireEvent.click(screen.getByText('stub-finish-lesson'));
      return onConfirm;
    };

    afterEach(() => {
      mockQuickCheck = { topic: 'Insulin Administration', correct: 1, total: 2, percent: 50 };
    });

    it('scores the topic the quick check actually covered', () => {
      const onConfirm = walkToDate();
      tapAndFlush('Today');
      expect(onConfirm.mock.calls[0][0].diagnostic).toEqual({ 'Insulin Administration': 50 });
    });

    it('leaves untested topics ABSENT rather than scoring them zero', () => {
      // A fabricated 0 tiers as `gap` — 5 nodes at the front of her plan — and
      // would rearrange everything around a subject nobody ever tested her on.
      const onConfirm = walkToDate();
      tapAndFlush('Today');
      const diagnostic = onConfirm.mock.calls[0][0].diagnostic;
      expect(diagnostic).not.toHaveProperty('Charting');
      expect(diagnostic).not.toHaveProperty('Sepsis');
    });

    it('carries ONLY the quick check — stored scores are not folded in', () => {
      // They used to be. The label matching behind them put an ARDS score on
      // Acute Coronary Syndrome, so a plan could be tiered on a percentage
      // belonging to a different subject. See uploadPriority.js.
      const onConfirm = walkToDate();
      tapAndFlush('Today');
      const diagnostic = onConfirm.mock.calls[0][0].diagnostic;
      expect(Object.keys(diagnostic)).toEqual(['Insulin Administration']);
    });

    it('takes the percentage straight from the quick check', () => {
      const onConfirm = walkToDate();
      tapAndFlush('Today');
      expect(onConfirm.mock.calls[0][0].diagnostic['Insulin Administration']).toBe(50);
    });

    it('is null when nothing at all is known — the uniform-plan path', () => {
      mockQuickCheck = { topic: 'Insulin Administration', correct: 0, total: 0, percent: null };
      const onConfirm = walkToDate();
      tapAndFlush('Today');
      expect(onConfirm.mock.calls[0][0].diagnostic).toBeNull();
    });
  });

  it('passes the ranked topics through for the locked plan preview', () => {
    const onConfirm = renderAtExamDate();
    tapAndFlush('Today');
    expect(onConfirm.mock.calls[0][0]).toHaveProperty('rankedTopics');
  });
});
