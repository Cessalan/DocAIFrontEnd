import React from 'react';
import { render, screen } from '@testing-library/react';
import DrillCheckpoint from './DrillCheckpoint';
import { createDrillState, recordAnswer, buildCheckpoint } from './drillModel';

/**
 * i18n stand-in: returns the inline English fallback with {{vars}} filled, so
 * these tests assert on the copy the student actually reads rather than on key
 * names.
 */
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

/**
 * Reduced motion makes useTypedBeats render every beat immediately, so these
 * tests assert on the finished narration rather than racing the typewriter.
 * It is also the code path a real student with the OS setting on will see.
 */
// A plain function, not jest.fn(): CRA sets `resetMocks: true`, which strips
// the implementation off a jest mock between tests and would leave
// matchMedia returning undefined from the second test onwards.
beforeAll(() => {
  window.matchMedia = (query) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
});

const answerMany = (state, n, opts) => {
  let s = state;
  for (let i = 0; i < n; i += 1) s = recordAnswer(s, opts);
  return s;
};

/** Aces MCQ, falls apart on case studies. */
const gapped = () => {
  let s = answerMany(createDrillState(['Cardio']), 4, { topic: 'Cardio', format: 'mcq', isCorrect: true });
  s = answerMany(s, 4, { topic: 'Cardio', format: 'casestudy', isCorrect: false });
  return buildCheckpoint(s);
};

describe('DrillCheckpoint', () => {
  it('speaks in sentences rather than headed sections', () => {
    render(<DrillCheckpoint checkpoint={gapped()} onContinue={() => {}} onExit={() => {}} />);

    expect(screen.getByText(/Okay — 8 questions in/)).toBeInTheDocument();
    expect(
      screen.getByText(/it is the format catching you out/)
    ).toBeInTheDocument();

    // The old dashboard headings are gone for good.
    expect(screen.queryByText('WEAK SPOTS')).toBeNull();
    expect(screen.queryByText('Weak spots')).toBeNull();
    expect(screen.queryByText('Unproven')).toBeNull();
    expect(screen.queryByText('Solid')).toBeNull();
  });

  it('never shows a per-topic fraction', () => {
    // "0/2" tells her she got them wrong, which she was there for.
    const { container } = render(
      <DrillCheckpoint checkpoint={gapped()} onContinue={() => {}} onExit={() => {}} />
    );
    expect(container.textContent).not.toMatch(/\b\d+\/\d+\b/);
  });

  it('shows the gap strip only when there is a gap to corroborate', () => {
    const withGap = render(
      <DrillCheckpoint checkpoint={gapped()} onContinue={() => {}} onExit={() => {}} />
    );
    expect(withGap.container.querySelector('.drill-cp__gap')).not.toBeNull();
    withGap.unmount();

    let s = answerMany(createDrillState(['A']), 3, { topic: 'A', format: 'mcq', isCorrect: true });
    s = answerMany(s, 3, { topic: 'A', format: 'sata', isCorrect: true });
    const noGap = render(
      <DrillCheckpoint checkpoint={buildCheckpoint(s)} onContinue={() => {}} onExit={() => {}} />
    );
    expect(noGap.container.querySelector('.drill-cp__gap')).toBeNull();
  });

  it('closes on what happens next, in the tutor voice', () => {
    render(<DrillCheckpoint checkpoint={gapped()} onContinue={() => {}} onExit={() => {}} />);
    expect(screen.getByText(/So that is what we fix/)).toBeInTheDocument();
    // The raw format key is swapped for its translated name.
    expect(screen.queryByText(/More casestudy next/)).toBeNull();
    expect(screen.getByText(/More Case Study next/)).toBeInTheDocument();
  });

  it('calls an MCQ-only run unproven instead of solid', () => {
    const s = answerMany(createDrillState(['Cardio']), 5, { topic: 'Cardio', format: 'mcq', isCorrect: true });
    render(<DrillCheckpoint checkpoint={buildCheckpoint(s)} onContinue={() => {}} onExit={() => {}} />);
    expect(screen.getByText(/I would not call Cardio safe yet/)).toBeInTheDocument();
  });

  it('offers the upgrade instead of more questions once the allowance is spent', () => {
    render(
      <DrillCheckpoint checkpoint={gapped()} onContinue={() => {}} onExit={() => {}} canContinue={false} />
    );
    expect(screen.getByText('You have used your free questions for this week.')).toBeInTheDocument();
    expect(screen.getByText('Unlock unlimited drilling')).toBeInTheDocument();
    expect(screen.queryByText('Keep drilling')).toBeNull();
  });

  it('shows the remaining allowance only when it is finite', () => {
    const cp = gapped();
    const free = render(
      <DrillCheckpoint checkpoint={cp} onContinue={() => {}} onExit={() => {}} remaining={12} />
    );
    expect(screen.getByText('12 questions left this week')).toBeInTheDocument();
    free.unmount();

    render(<DrillCheckpoint checkpoint={cp} onContinue={() => {}} onExit={() => {}} remaining={Infinity} />);
    expect(screen.queryByText(/questions left this week/)).toBeNull();
  });

  it('renders nothing without a checkpoint', () => {
    const { container } = render(
      <DrillCheckpoint checkpoint={null} onContinue={() => {}} onExit={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
