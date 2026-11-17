import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '../../i18n/i18n';
import { TopicHandoff, TopicJourneyPanel, TopicSwitcher } from './TopicJourney';
import { topicHandoff, topicJourney } from './topicJourneyModel';
import { switchOptions } from './topicSwitchModel';

const step = (id, topic, status = 'pending') => ({ id, type: 'quiz', label: `${topic} - Quick Check`, tags: [topic], status });
const nodes = [step('n1', 'Heart failure', 'done'), step('n2', 'Coronary artery disease', 'active'), step('n3', 'Angina'),
  step('n4', 'Acute coronary syndrome'), step('n5', 'Cardiogenic shock')];
const progress = { baseline: { 'heart failure': { correct: 1, answered: 3 } }, latest: { 'heart failure': { correct: 4, answered: 5 } } };

test('the overview shows where she is across her topics, with an honest before and after', () => {
  render(<TopicJourneyPanel journey={topicJourney({ nodes, topicProgress: progress, activeNodeId: 'n2' })} />);
  expect(screen.getByText('1 of 5 topics done')).toBeInTheDocument();
  expect(screen.getByText('Topic 2 of 5: Coronary artery disease')).toBeInTheDocument();
  expect(screen.getByText('Earlier 1 / 3')).toBeInTheDocument();
  expect(screen.getByText('You’re here')).toBeInTheDocument();
  expect(screen.getByText('1 more topic after these')).toBeInTheDocument();
});

test('with a switch handler, a topic she has not finished takes her there, and every topic can be reached', () => {
  const onSwitch = jest.fn();
  const options = switchOptions({ nodes, activeNodeId: 'n2' });
  render(<TopicJourneyPanel journey={topicJourney({ nodes, topicProgress: progress, activeNodeId: 'n2' })}
    options={options} onSwitch={onSwitch} />);
  expect(screen.getByText('Pick any step to study it now. What you leave stays in your plan.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cardiogenic shock' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show 1 more topic' }));
  // Tapping the row opens it; it does not change her plan.
  fireEvent.click(screen.getByRole('button', { name: 'Cardiogenic shock' }));
  expect(onSwitch).not.toHaveBeenCalled();
  expect(screen.getByText('1 step, not started')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Study Cardiogenic shock now' }));
  expect(onSwitch).toHaveBeenCalledWith('cardiogenic shock');
  // One row open at a time.
  fireEvent.click(screen.getByRole('button', { name: 'Angina' }));
  expect(screen.queryByRole('button', { name: 'Study Cardiogenic shock now' })).not.toBeInTheDocument();
  // The topic she is on and the one she finished are not switch targets.
  expect(screen.queryByRole('button', { name: 'Coronary artery disease' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Heart failure' })).not.toBeInTheDocument();
});

test('"Switch topic" opens her other topics and says how far she got on one she left', () => {
  const onSwitch = jest.fn();
  const left = [step('a1', 'Angina', 'done'), step('a2', 'Angina'), step('s1', 'Shock', 'active'), step('h1', 'Heart failure')];
  render(<TopicSwitcher options={switchOptions({ nodes: left, activeNodeId: 's1' })} onSwitch={onSwitch} />);
  expect(screen.queryByRole('button', { name: /Angina/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Switch topic' }));
  expect(screen.getByText(/^1 of 2 steps done · ~\d+ min left$/)).toBeInTheDocument();
  expect(screen.getByText(/^1 step · ~\d+ min$/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Heart failure' }));
  expect(onSwitch).not.toHaveBeenCalled();
  // Each step of the opened topic can be started by itself.
  const onStartStep = jest.fn();
  fireEvent.click(screen.getByRole('button', { name: 'Study now: Quiz, Heart failure' }));
  expect(onSwitch).toHaveBeenCalledWith('heart failure');
  expect(onStartStep).not.toHaveBeenCalled();
});

test('with a step handler, "Study now" starts that one step', () => {
  const onStartStep = jest.fn();
  const plan = [step('s1', 'Shock', 'active'), step('h1', 'Heart failure'), { ...step('h2', 'Heart failure'), type: 'exam' }];
  render(<TopicSwitcher options={switchOptions({ nodes: plan, activeNodeId: 's1' })} onSwitch={() => {}} onStartStep={onStartStep} />);
  fireEvent.click(screen.getByRole('button', { name: 'Switch topic' }));
  fireEvent.click(screen.getByRole('button', { name: 'Heart failure' }));
  // Each step is itself the control, at full strength: no hover-only button.
  expect(screen.getAllByRole('button', { name: /^Study now: / })).toHaveLength(2);
  expect(screen.queryByText('Study now')).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: /^Study now: / })[1]);
  expect(onStartStep).toHaveBeenCalledWith(expect.objectContaining({ id: 'h2' }));
});

test('"Switch topic" is not shown when there is nowhere to go', () => {
  const { container } = render(<TopicSwitcher options={[]} onSwitch={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});

test('a one-topic plan shows no journey', () => {
  const { container } = render(<TopicJourneyPanel journey={topicJourney({ nodes: [step('a', 'Only topic')] })} />);
  expect(container).toBeEmptyDOMElement();
});

test('finishing a topic says so and names the next one', () => {
  const finishing = nodes.map((n) => (n.id === 'n1' ? { ...n, status: 'active' } : n.id === 'n2' ? { ...n, status: 'pending' } : n));
  const journey = topicJourney({ nodes: finishing, topicProgress: progress, activeNodeId: 'n1', finishedNodeId: 'n1' });
  render(<TopicHandoff handoff={topicHandoff(journey, 'Heart failure', finishing[1], finishing)} />);
  expect(screen.getByText('Heart failure done')).toBeInTheDocument();
  expect(screen.getByText('Topic 2 of 5 next: Coronary artery disease')).toBeInTheDocument();
  expect(screen.getByText('now 4 / 5')).toBeInTheDocument();
});
