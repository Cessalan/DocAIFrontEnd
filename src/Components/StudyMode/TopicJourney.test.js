import React from 'react';
import { render, screen } from '@testing-library/react';
import '../../i18n/i18n';
import { TopicHandoff, TopicJourneyPanel } from './TopicJourney';
import { topicHandoff, topicJourney } from './topicJourneyModel';

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
