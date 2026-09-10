import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '../../i18n/i18n';
import NodeTransition from './NodeTransition';
import { get_node_debrief } from '../../Services/FastAPICalls';

jest.mock('../../Services/FastAPICalls', () => ({
  get_node_debrief: jest.fn(),
}));

jest.mock('../../Services/StudyReminderService', () => ({
  isReminderSupported: () => false,
  getReminderState: () => 'off',
  enableReminder: jest.fn(),
  disableReminder: jest.fn(),
}));

// Keeps Firebase out of the render; nodeReadout only needs the topic matcher.
jest.mock('../../Services/StudySessionService', () => ({
  findMatchingTopicKey: (topic, keys) =>
    keys.find((k) => k.toLowerCase() === String(topic).toLowerCase()) || topic,
}));

const questions = Array.from({ length: 5 }, (_, i) => ({
  question: 'Question ' + (i + 1),
  questionType: i < 3 ? 'mcq' : 'casestudy',
}));

const setup = (props = {}) => {
  const handlers = {
    onContinue: jest.fn(),
    onPracticeMore: jest.fn(),
    onCustomRequest: jest.fn(),
    onExit: jest.fn(),
    onTestTheory: jest.fn(),
    onAnalytics: jest.fn(),
  };
  const utils = render(
    <NodeTransition
      chatId="chat-1"
      node={{ id: 'node-1', type: 'quiz', label: 'ABCDE Emergency Patient Assessment' }}
      content={{ questions }}
      quizProgress={{ questionStatuses: { 0: 'correct', 1: 'correct', 2: 'correct', 3: 'correct', 4: 'incorrect' } }}
      nextNode={{ type: 'lesson', label: 'Airway management' }}
      isAdvancing={false}
      isLoadingPractice={false}
      isLoadingCustom={false}
      {...handlers}
      {...props}
    />
  );
  return { ...handlers, ...utils };
};

const noPattern = (toPattern = 0, note = '', noteMode = '') => ({
  hasPattern: false,
  noticed: '',
  evidence: [],
  pattern: '',
  skill: '',
  toPattern,
  note,
  noteMode,
  stillLooking: 'unused',
});

const pattern = (evidenceCount) => ({
  hasPattern: true,
  noticed: "You're stronger on this content than your score suggests.",
  evidence: ['4 of 4 knowledge questions correct', '1 of 4 on prioritization']
    .concat(evidenceCount >= 3 ? ['2 of your 3 misses here involved prioritization'] : []),
  pattern: 'You pick the right problem, then act before ordering. That is a reasoning pattern.',
  skill: 'prioritization',
});

describe('NodeTransition — the post-node readout', () => {
  beforeEach(() => jest.clearAllMocks());

  test('the score is context for a sentence, not the headline', async () => {
    get_node_debrief.mockResolvedValue(noPattern(0));
    setup();

    expect(await screen.findByText('One thing to firm up.')).toBeInTheDocument();
    const score = document.querySelector('.nt2-score-line__score');
    expect(score.textContent.replace(/\s+/g, ' ').trim()).toBe('4 / 5');
    expect(screen.getByText("You're getting the hang of this.")).toBeInTheDocument();
  });

  test('the takeaway is one labelled line, and it is the only insight shown', async () => {
    get_node_debrief.mockResolvedValue(
      noPattern(2, 'Why high-flow oxygen and bag-mask ventilation are used.', 'single')
    );
    setup();

    expect(await screen.findByText('Focus on')).toBeInTheDocument();
    expect(
      screen.getByText('Why high-flow oxygen and bag-mask ventilation are used.')
    ).toBeInTheDocument();
    expect(screen.queryByText('I noticed something')).toBeNull();
    // The furniture the takeaway replaced: a heading, a handwritten note card
    // and a promise to have something specific later. Three pieces of framing
    // around one sentence, all competing with it.
    expect(screen.queryByText('What I wrote down')).toBeNull();
    expect(screen.queryByText(/more of these and I should have something specific/i)).toBeNull();
    expect(screen.queryByText("I'm learning how you think")).toBeNull();
  });

  test('the label follows the mode, because "focus on" is wrong for a clean run', async () => {
    get_node_debrief.mockResolvedValue(
      noPattern(0, 'Fast recall of the emergency airway steps.', 'clean')
    );
    setup();

    expect(await screen.findByText('Locked in')).toBeInTheDocument();
    expect(screen.queryByText('Focus on')).toBeNull();
  });

  test('with nothing worth saying, nothing is said — no block, no filler', async () => {
    // The old screen filled this silence with "I'm learning how you think" and
    // a promise, which was a claim to be observing her printed immediately
    // after five answers we could simply have read.
    get_node_debrief.mockResolvedValue(noPattern(2));
    setup();

    await screen.findByText('Keep building →');
    // The skeleton is up until the debrief resolves — an insight that popped
    // in late would read as a guess, so the space is held while it loads.
    // What must not survive is the block once we know there is nothing in it.
    await waitFor(() => expect(document.querySelector('.nt2-insight')).toBeNull());
    expect(document.querySelector('.nt4-takeaway')).toBeNull();
    expect(screen.queryByText(/still figuring out your pattern/i)).toBeNull();
  });

  test('an unsettled pattern is offered as a theory to test, not a verdict', async () => {
    get_node_debrief.mockResolvedValue(pattern(2));
    const { onTestTheory } = setup();

    expect(await screen.findByText('I noticed something')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Test my theory →'));
    expect(onTestTheory).toHaveBeenCalledWith('prioritization');
  });

  test('a corroborated pattern turns into a drill in that exact format', async () => {
    get_node_debrief.mockResolvedValue(pattern(3));
    const { onPracticeMore } = setup();

    expect(
      await screen.findByText('2 of your 3 misses here involved prioritization')
    ).toBeInTheDocument();
    // The recommendation's title and reasoning no longer render above the
    // button — the button's own label and subtitle carry it. The reasoning
    // still drives WHICH node is built, which is what the click asserts.
    expect(screen.queryByText('3 prioritization questions')).toBeNull();
    expect(screen.queryByText("Here's what I'd do next")).toBeNull();

    fireEvent.click(screen.getByText('Fix this →'));
    const node = onPracticeMore.mock.calls[0][0];
    expect(node.type).toBe('exam');
    expect(node.examConfig.questionTypes).toEqual(['casestudy']);
    expect(node.examConfig.questionCount).toBe(3);
  });

  test('with nothing to fix, the action is the planned next step', async () => {
    get_node_debrief.mockResolvedValue(noPattern(0));
    const { onContinue, onPracticeMore } = setup();

    fireEvent.click(await screen.findByText('Keep building →'));
    expect(onContinue).toHaveBeenCalled();
    expect(onPracticeMore).not.toHaveBeenCalled();
  });

  test('the recap is a real second action, kept out of the primary slot', async () => {
    get_node_debrief.mockResolvedValue(noPattern(0));
    const { onPracticeMore } = setup();

    // Offered as a sentence rather than a bordered card, so it stops reading
    // as a rival to the primary button — but it still does the same thing.
    fireEvent.click(await screen.findByText('Review · 4 min'));
    const node = onPracticeMore.mock.calls[0][0];
    expect(node.type).toBe('flashcard');
    expect(node.tags).toContain('recap');
  });

  test('a debrief that never arrives leaves the recommendation usable', async () => {
    get_node_debrief.mockResolvedValue(null);
    const { onContinue } = setup();

    await waitFor(() => expect(get_node_debrief).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Keep building →'));
    expect(onContinue).toHaveBeenCalled();
  });

  test('the generic workflow copy is gone', async () => {
    get_node_debrief.mockResolvedValue(noPattern(0));
    setup();

    await screen.findByText('Keep building →');
    expect(screen.queryByText('Solid session')).toBeNull();
    expect(screen.queryByText('Your next step is:')).toBeNull();
    expect(screen.queryByText('Your next recap is ready:')).toBeNull();
    expect(screen.queryByText('Or tell the coach what you want')).toBeNull();
  });
});

describe('readiness increase animation', () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    jest.restoreAllMocks();
  });

  test('counts through intermediate percentages and stops at the actual increase', () => {
    window.matchMedia = jest.fn(() => ({ matches: false }));
    let nextFrame;
    const request = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      nextFrame = callback;
      return 1;
    });
    const cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    get_node_debrief.mockReturnValue(new Promise(() => {}));
    const { unmount } = setup({ examDate: new Date('2030-01-01'), readinessDelta: 31 });
    const counter = screen.getByText('0', { selector: '.nt2-score-line__counter' });
    expect(counter).toHaveTextContent('0');
    act(() => nextFrame(0));
    act(() => nextFrame(550));
    expect(Number(counter.textContent)).toBeGreaterThan(0);
    expect(Number(counter.textContent)).toBeLessThan(31);
    act(() => nextFrame(1100));
    expect(counter).toHaveTextContent('31');
    expect(request).toHaveBeenCalledTimes(3);
    unmount();
    expect(cancel).toHaveBeenCalledWith(1);
  });

  test('shows the final percentage immediately when reduced motion is preferred', () => {
    window.matchMedia = jest.fn(() => ({ matches: true }));
    const request = jest.spyOn(window, 'requestAnimationFrame');
    get_node_debrief.mockReturnValue(new Promise(() => {}));
    const { unmount } = setup({ examDate: new Date('2030-01-01'), readinessDelta: 31 });
    expect(screen.getByText('31', { selector: '.nt2-score-line__counter' })).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
    unmount();
  });
});
