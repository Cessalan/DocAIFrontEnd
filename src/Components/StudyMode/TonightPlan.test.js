import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '../../i18n/i18n';
import { TonightPanel, TonightRoundView } from './TonightPlan';
import { initTonight, startRound, completeRound, currentRound, roundNodes, examEvidence, pickTarget, buildTonightPath } from './tonightPlanModel';

// A free student with questions left unless a test says otherwise. Mocked so
// the view can be rendered without the provider (and without Firebase).
const mockUsage = { isPro: true, remaining: Infinity, openUpgrade: jest.fn() };
jest.mock('../../Contexts/UsageContext/UsageContext', () => ({ useUsageLimit: () => mockUsage }));
jest.mock('../../Services/FunnelService', () => ({ logFunnelStep: jest.fn(), FUNNEL: { ROUND_OFFER_VIEWED: 'round_offer_viewed' } }));
const { logFunnelStep } = require('../../Services/FunnelService');
beforeEach(() => { Object.assign(mockUsage, { isPro: true, remaining: Infinity }); mockUsage.openUpgrade.mockClear(); logFunnelStep.mockClear(); });

const t = (key, opts) => key + (opts ? JSON.stringify(opts) : '');
const CHECK = [
  { format: 'mcq', topic: 'Cardiac meds', correct: true },
  { format: 'mcq', topic: 'Cardiac meds', correct: true },
  { format: 'sata', topic: 'Cardiac meds', correct: false },
  { format: 'sata', topic: 'Cardiac meds', correct: false },
  { format: 'sata', topic: 'Heart failure', correct: true },
  { format: 'mcq', kind: 'prioritization', topic: 'Heart failure', correct: false },
  { format: 'mcq', kind: 'prioritization', topic: 'Heart failure', correct: true },
];
const exam = (...ok) => Object.fromEntries(ok.map((c, i) => [i, { questionType: 'sata', isCorrect: c }]));

it('a sprint plan becomes round 1 of tonight, keeping the planner path for the record', () => {
  const path = buildTonightPath({ archetype: 'sprint', nodes: [{ type: 'quiz', label: 'Quick Check' }] }, CHECK, t);
  expect(path.nodes).toHaveLength(2);
  expect(path.plannerNodes).toHaveLength(1);
  expect(path.tonight.rounds[0]).toMatchObject({ n: 1, kind: 'skill', skill: 'sata', status: 'active' });
});

it('the panel names the round in progress and continues it', () => {
  const tonight = startRound(initTonight(CHECK));
  const nodes = roundNodes(currentRound(tonight), t).map((n, i) => ({ ...n, id: `n${i}`, status: i === 0 ? 'active' : 'locked' }));
  const onOpenNode = jest.fn();
  render(<TonightPanel tonight={tonight} nodes={nodes} activeNodeId="n0" daysToExam={1} onOpenNode={onOpenNode} />);
  expect(screen.getByText('Exam tomorrow')).toBeInTheDocument();
  expect(screen.getByText("Tonight's plan")).toBeInTheDocument();
  expect(screen.getByText('Round 1 · Select-all questions')).toBeInTheDocument();
  expect(screen.getByText('Learn and practise')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Continue round 1'));
  expect(onOpenNode).toHaveBeenCalledWith(nodes[0]);
});

it('a fixed round shows before and after, the caveat once, and offers the next round', () => {
  let tonight = startRound(initTonight(CHECK));
  tonight = completeRound(tonight, examEvidence(exam(true, true, true, true, false)));
  const round = tonight.rounds[0];
  const onNextRound = jest.fn();
  const onStop = jest.fn();
  render(<TonightRoundView mode="result" round={round} nextTarget={pickTarget(tonight)} evidence={tonight.evidence}
    onNextRound={onNextRound} onStop={onStop} />);
  expect(screen.getByText('That got better tonight.')).toBeInTheDocument();
  expect(screen.getByText('Earlier 1 / 3')).toBeInTheDocument();
  expect(screen.getByText('now 4 / 5')).toBeInTheDocument();
  expect(screen.getAllByText('Small numbers, so this shows a direction, not a guarantee.')).toHaveLength(1);
  expect(screen.getByText('Next: round 2 · Who goes first')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Start round 2'));
  expect(onNextRound).toHaveBeenCalled();
  fireEvent.click(screen.getByText('Stop for tonight'));
  expect(onStop).toHaveBeenCalled();
});

it('a round that did not land says "not yet" and that the next round is easier', () => {
  let tonight = startRound(initTonight(CHECK));
  tonight = completeRound(tonight, examEvidence(exam(false, false, true, false, false)));
  render(<TonightRoundView mode="result" round={tonight.rounds[0]} nextTarget={pickTarget(tonight)} evidence={tonight.evidence}
    onNextRound={() => {}} onStop={() => {}} />);
  expect(screen.getByText('Not yet.')).toBeInTheDocument();
  expect(screen.getByText('Same thing again, a little easier, with the method first.')).toBeInTheDocument();
});

it('between steps, the practice score is shown but kept apart from the check', () => {
  const tonight = startRound(initTonight(CHECK));
  const onContinue = jest.fn();
  render(<TonightRoundView mode="between" round={currentRound(tonight)} fixTally={{ correct: 3, total: 5 }} onContinue={onContinue} />);
  expect(screen.getByText('Practice done: 3 / 5 right.')).toBeInTheDocument();
  expect(screen.getByText(/doesn't count toward this/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Check it worked'));
  expect(onContinue).toHaveBeenCalled();
});

it('after she stops, the panel offers the next round from the evidence', () => {
  let tonight = startRound(initTonight(CHECK));
  tonight = completeRound(tonight, examEvidence(exam(true, true, true, true, true)));
  const onNextRound = jest.fn();
  render(<TonightPanel tonight={tonight} nodes={[]} daysToExam={0} nextTarget={pickTarget(tonight)} onNextRound={onNextRound} />);
  expect(screen.getByText('Exam today')).toBeInTheDocument();
  expect(screen.getByText('Round 1 · Select-all questions')).toBeInTheDocument();
  expect(screen.getByText('Fixed')).toBeInTheDocument();
  expect(screen.getByText('Round 2 · Who goes first')).toBeInTheDocument();
  expect(screen.getByText('Your next weakest: 1 of 2 right so far.')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Start round 2'));
  expect(onNextRound).toHaveBeenCalled();
});

it('a free student sees one line about Pro under a round that improved, and it opens the offer with her numbers', () => {
  Object.assign(mockUsage, { isPro: false, remaining: 13 });
  let tonight = startRound(initTonight(CHECK));
  tonight = completeRound(tonight, examEvidence(exam(true, true, true, true, false)));
  render(<TonightRoundView mode="result" round={tonight.rounds[0]} nextTarget={pickTarget(tonight)} evidence={tonight.evidence}
    onNextRound={() => {}} onStop={() => {}} />);
  expect(screen.getByText(/You are down to 13 free questions\./)).toBeInTheDocument();
  expect(logFunnelStep).toHaveBeenCalledTimes(1);
  expect(logFunnelStep).toHaveBeenCalledWith('round_offer_viewed', { round: 1, questionsRemaining: 13, low: true });
  fireEvent.click(screen.getByText('Keep going without a limit'));
  expect(mockUsage.openUpgrade).toHaveBeenCalledWith('round', {
    trigger: 'round_offer', reachedStep: 'tonight_round',
    round: { name: 'Select-all questions', before: '1 / 3', after: '4 / 5' },
  });
});

it('no line about Pro for a Pro student, or under a round that did not improve', () => {
  let fixed = startRound(initTonight(CHECK));
  fixed = completeRound(fixed, examEvidence(exam(true, true, true, true, false)));
  const { unmount } = render(<TonightRoundView mode="result" round={fixed.rounds[0]} onNextRound={() => {}} onStop={() => {}} />);
  expect(screen.queryByText('Keep going without a limit')).toBeNull();
  unmount();

  Object.assign(mockUsage, { isPro: false, remaining: 40 });
  let missed = startRound(initTonight(CHECK));
  missed = completeRound(missed, examEvidence(exam(false, false, true, false, false)));
  render(<TonightRoundView mode="result" round={missed.rounds[0]} onNextRound={() => {}} onStop={() => {}} />);
  expect(screen.queryByText('Keep going without a limit')).toBeNull();
  expect(logFunnelStep).not.toHaveBeenCalled();
});
