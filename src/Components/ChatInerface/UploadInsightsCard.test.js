import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '../../i18n/i18n';
import UploadInsightsCard from './UploadInsightsCard';

// The card writes a funnel row on mount. That's a Firestore call we neither
// need nor want in a render test.
jest.mock('../../Services/FunnelService', () => ({
  FUNNEL: { INSIGHTS_VIEWED: 'insights_viewed' },
  logFunnelStepOnce: jest.fn(),
}));

const insight = (topic, points) => ({
  topic,
  insight: `About ${topic}`,
  key_points: Array.from({ length: points }, (_, i) => `point ${i}`),
});

describe('UploadInsightsCard', () => {
  test('reports what was found and names one place to start', () => {
    render(
      <UploadInsightsCard
        topics={['Heart Failure', 'Pharmacology', 'Charting']}
        insights={[insight('Heart Failure', 5)]}
        fileCount={1}
        onContinue={() => {}}
      />
    );

    expect(screen.getByText('I found 3 topics in your material.')).toBeInTheDocument();
    expect(screen.getByText('Start here')).toBeInTheDocument();
    // The CTA commits to a specific topic — the lesson that follows must open
    // on the same one, so this string is a contract with FirstLessonPane.
    expect(screen.getByText('Start with Heart Failure')).toBeInTheDocument();
  });

  test('shows a defensible reason under every topic', () => {
    render(
      <UploadInsightsCard
        topics={['Heart Failure', 'Charting']}
        insights={[insight('Heart Failure', 5)]}
        onContinue={() => {}}
      />
    );
    expect(screen.getByText('Your notes go deepest here — 5 key points')).toBeInTheDocument();
    expect(screen.getByText('Covered in your notes')).toBeInTheDocument();
  });

  test('never quotes a percentage at her — see uploadPriority header', () => {
    // A stored score once reached this card through loose label matching and
    // printed one subject's percentage under another's name. No line on this
    // card may claim a number about the student.
    render(
      <UploadInsightsCard
        topics={['Acute Coronary Syndrome', 'Fluid & Electrolytes']}
        insights={[insight('Acute Coronary Syndrome', 3)]}
        onContinue={() => {}}
      />
    );
    expect(screen.queryByText(/you averaged/i)).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  test('never claims a topic is "solid" on a first upload', () => {
    // We have no evidence about a first-time student. The bands are a ranking
    // of her deck, and the copy has to stay a ranking.
    const topics = ['A', 'B', 'C', 'D', 'E', 'F'];
    render(
      <UploadInsightsCard
        topics={topics}
        insights={topics.map(t => insight(t, 3))}
        onContinue={() => {}}
      />
    );
    expect(screen.queryByText(/looking solid/i)).toBeNull();
    expect(screen.queryByText(/you know this/i)).toBeNull();
    expect(screen.getByText('Supporting material')).toBeInTheDocument();
  });

  test('shows a bare topic list when the extractor returned no coverage', () => {
    // The production case: 118 of 119 plan_onboarding messages carry an empty
    // insights array. With nothing countable to say, the card must not band,
    // must not subtitle, and must not recommend one topic over another.
    render(
      <UploadInsightsCard
        topics={['Post-Myocardial Infarction Complications', 'Coronary Artery Disease']}
        insights={[]}
        onContinue={() => {}}
      />
    );
    expect(screen.getByText('Post-Myocardial Infarction Complications')).toBeInTheDocument();
    expect(screen.getByText('Coronary Artery Disease')).toBeInTheDocument();

    expect(screen.queryByText('Start here')).toBeNull();
    expect(screen.queryByText('Worth reviewing')).toBeNull();
    expect(screen.queryByText(/Commonly missed/i)).toBeNull();
    expect(screen.queryByText(/Covered in your notes/i)).toBeNull();
    expect(screen.queryByText(/^Start with /)).toBeNull();
    expect(screen.getByText('Show me where to start')).toBeInTheDocument();
  });

  test('says so plainly when no topics could be extracted', () => {
    render(<UploadInsightsCard topics={[]} insights={[]} onContinue={() => {}} />);
    expect(screen.getByText('Your notes are in.')).toBeInTheDocument();
    expect(screen.getByText('Show me where to start')).toBeInTheDocument();
    // No empty band headings pretending to be a finding.
    expect(screen.queryByText('Start here')).toBeNull();
  });

  test('the CTA is the only way forward — there is no menu', () => {
    // The four-button menu this replaced is the thing 34% of uploads died on.
    const onContinue = jest.fn();
    render(
      <UploadInsightsCard topics={['Sepsis', 'Triage']} insights={[]} onContinue={onContinue} />
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button'));
    expect(onContinue).toHaveBeenCalled();
  });
});
