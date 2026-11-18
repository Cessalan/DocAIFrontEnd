import React from 'react';
import { render, screen } from '@testing-library/react';
import '../../i18n/i18n';
import PeerLine from './PeerLine';
import { logFunnelStep } from '../../Services/FunnelService';

jest.mock('../../Services/FunnelService', () => ({
  FUNNEL: { PEER_COMPARISON_VIEWED: 'peer_comparison_viewed' }, logFunnelStep: jest.fn(),
}));

beforeEach(() => logFunnelStep.mockClear());

it('a right select-all answer says how few students get them right, and logs once', () => {
  const { rerender } = render(<PeerLine format="sata" correct surface="plan_quiz" />);
  expect(screen.getByText('Only 45% of students get select-all right.')).toBeInTheDocument();
  rerender(<PeerLine format="sata" correct surface="plan_quiz" />);
  expect(logFunnelStep).toHaveBeenCalledTimes(1);
  expect(logFunnelStep).toHaveBeenCalledWith('peer_comparison_viewed',
    { surface: 'plan_quiz', kind: 'right', format: 'sata', percent: 45 });
});

it('a miss says most students miss these', () => {
  render(<PeerLine format="matrix" correct={false} />);
  expect(screen.getByText('Most students miss these. 44% get matrix questions right.')).toBeInTheDocument();
});

it('says nothing on multiple choice or ordering', () => {
  const { container } = render(<><PeerLine format="mcq" correct={false} /><PeerLine correct /><PeerLine format="ordering" correct /></>);
  expect(container).toBeEmptyDOMElement();
  expect(logFunnelStep).not.toHaveBeenCalled();
});
