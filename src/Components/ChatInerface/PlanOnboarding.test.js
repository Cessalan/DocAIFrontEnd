import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '../../i18n/i18n';
import PlanOnboarding from './PlanOnboarding';
import { run_course_intelligence } from '../../Services/CourseIntelligenceService';
import { plan_diagnostic_quiz } from '../../Services/FastAPICalls';

jest.mock('../../Services/FastAPICalls', () => ({
  clear_in_flight_study_journey: jest.fn(),
  plan_diagnostic_quiz: jest.fn().mockResolvedValue({ questions: [] }),
}));

jest.mock('../../Services/StudySessionService', () => ({ updateStudyPerformance: jest.fn().mockResolvedValue({}) }));

jest.mock('../../Services/FunnelService', () => ({
  FUNNEL: {
    EXAM_DATE_STARTED: 'exam_date_started',
    EXAM_DATE_COMPLETED: 'exam_date_completed',
    DIAGNOSTIC_COMPLETED: 'diagnostic_completed',
    COURSE_CONTEXT_SHOWN: 'course_context_shown',
    COURSE_CONTEXT_SUBMITTED: 'course_context_submitted',
    COURSE_CONTEXT_SKIPPED: 'course_context_skipped',
    INTELLIGENCE_STARTED: 'intelligence_started',
    INTELLIGENCE_COMPLETED: 'intelligence_completed',
    INTELLIGENCE_FAILED: 'intelligence_failed',
    REPORT_VIEWED: 'report_viewed',
    REVEAL_VIEWED: 'reveal_viewed',
  },
  logFunnelStep: jest.fn(),
  logFunnelStepOnce: jest.fn(),
  enrichFunnel: jest.fn(),
}));

jest.mock('../../Services/CourseIntelligenceService', () => ({
  run_course_intelligence: jest.fn(),
}));

// The context form is a controlled surface of its own with its own tests. Here
// it is a pair of buttons so a test can choose to answer or to skip, and the
// payload matches what the real form emits.
jest.mock('../CourseIntelligence/CourseContextForm', () => (props) => (
  <div>
    <button onClick={() => props.onSubmit({
      school: 'McGill University',
      courseCode: 'NURS 234',
      courseName: 'Pharmacology',
      professor: 'Dr. Jane Smith',
      examDescription: 'Midterm on diuretics.',
      examDate: null,
    })}>stub-submit-context</button>
    <button onClick={() => props.onSkip({
      school: '', courseCode: '', courseName: '', professor: '', examDescription: '', examDate: null,
    })}>stub-skip-context</button>
  </div>
));

// The lesson step streams from the backend; stub it to hand straight on so a
// test can walk the whole flow with real topics. The payload mirrors what
// FirstLessonPane really reports: a first-attempt score for its topic.
let mockQuickCheck = { topic: 'Insulin Administration', correct: 1, total: 2, percent: 50 };
jest.mock('./FirstLessonPane', () => (props) => (
  <button onClick={() => props.onDone(mockQuickCheck)}>stub-finish-lesson</button>
));

const REPORT = {
  course_information: {
    school: 'McGill University',
    courseCode: 'NURS 234',
    courseName: 'Pharmacology',
    professor: 'Dr. Jane Smith',
    examDescription: 'Midterm on diuretics.',
    examDate: null,
  },
  uploaded_material_insights: {
    file_count: 2, topic_count: 2, concept_count: 9, document_types: [], frameworks: [],
    topics: [
      { topic: 'Diuretics', emphasis: 90, file_count: 2, key_points: ['loop'] },
      { topic: 'Charting', emphasis: 30, file_count: 1, key_points: [] },
    ],
  },
  relevant_public_context: { instructor: null, resources: null, course: null },
  verified_public_information: null,
  exam_analysis: {
    exam_type: 'Midterm examination',
    coverage: ['Diuretics'],
    formats: ['Multiple-choice questions'],
    stated_emphasis: [], unstated: [],
  },
  priority_topics: [
    {
      topic: 'Diuretics', score: 84,
      signals: { exam_relevance: 100, material_emphasis: 90, objective_alignment: 0, dependency: 70, clinical_importance: 80, complexity: 40 },
      evidence: [{ text: 'Named in your exam description', source: 'exam_description', confidence: 'verified' }],
      key_points: ['loop'], file_count: 2,
    },
    {
      topic: 'Charting', score: 30,
      signals: { exam_relevance: 10, material_emphasis: 30, objective_alignment: 0, dependency: 10, clinical_importance: 40, complexity: 20 },
      evidence: [], key_points: [], file_count: 1,
    },
  ],
  study_strategy: {
    ordered_topics: ['Diuretics', 'Charting'],
    recommended_start: { topic: 'Diuretics', reasons: [{ key: 'exam', confidence: 'verified' }], score: 84 },
    connections: [], note: 'Leading with diuretics.',
  },
  research_ran: false,
  research_enabled: true,
  elapsed_ms: 4200,
};

const mockRun = (behaviour) => {
  run_course_intelligence.mockImplementation(() => ({
    promise: behaviour(),
    abort: jest.fn(),
  }));
};

/** Let a resolved/rejected promise chain settle inside React's act(). */
const flush = async () => {
  await act(async () => { await Promise.resolve(); });
};

describe('PlanOnboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuickCheck = { topic: 'Insulin Administration', correct: 1, total: 2, percent: 50 };
    // Default: the investigation fails, which is the FALLBACK path — the old
    // insights -> lesson -> exam-date flow, unchanged. Most assertions below
    // are about that path and predate the intelligence feature.
    mockRun(() => Promise.reject(new Error('offline')));
  });

  const tapAndFlush = (label) => {
    fireEvent.click(screen.getByText(label));
    act(() => { jest.advanceTimersByTime(300); });
  };

  it('greets during upload and prepares the quick check without asking for a date', async () => {
    mockRun(() => new Promise(() => {}));
    const props = { autoInvestigate: true, chatId: 'upload-chat', filenames: ['Lecture.pdf'], onConfirm: jest.fn() };
    const { rerender } = render(<PlanOnboarding {...props} materialsReady={false} />);
    expect(screen.getByRole('heading', { name: 'Let’s get you ready for the exam.' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Pick a date' })).toBeNull();
    expect(screen.queryByText('stub-submit-context')).toBeNull();
    expect(run_course_intelligence).not.toHaveBeenCalled();
    rerender(<PlanOnboarding {...props} materialsReady />);
    await flush();
    expect(run_course_intelligence).toHaveBeenCalledTimes(1);
    expect(run_course_intelligence).toHaveBeenCalledWith(expect.objectContaining({ materialsOnly: true }));
  });

  it('allows optional context during upload without starting research early', async () => {
    const onCourseContext = jest.fn();
    render(<PlanOnboarding chatId="upload-chat" materialsReady={false} onCourseContext={onCourseContext} />);
    fireEvent.click(screen.getByText('stub-submit-context'));
    await flush();
    expect(onCourseContext).toHaveBeenCalledWith(expect.objectContaining({ courseName: 'Pharmacology' }));
    expect(screen.getByRole('heading', { name: 'Your notes. Your exam-style quiz.' })).toBeTruthy();
    expect(run_course_intelligence).not.toHaveBeenCalled();
  });

  it('keeps a failed automatic investigation on the transformation and can retry without reuploading', async () => {
    render(<PlanOnboarding autoInvestigate chatId="upload-chat" filenames={['Lecture.pdf']} />);
    await flush();
    expect(screen.getByRole('heading', { name: 'Let’s get you ready for the exam.' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    mockRun(() => new Promise(() => {}));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await flush();
    expect(run_course_intelligence).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('goes from answers directly to the recommendation and date, then builds with that date', async () => {
    let emit;
    run_course_intelligence.mockImplementation(({ onEvent }) => {
      emit = onEvent;
      return { promise: new Promise(() => {}), abort: jest.fn() };
    });
    const onCourseContext = jest.fn();
    const onConfirm = jest.fn();
    render(<PlanOnboarding autoInvestigate chatId="upload-chat" onCourseContext={onCourseContext} onConfirm={onConfirm} />);
    act(() => emit({ status: 'course_question_ready', report: REPORT, questions: [0, 1].map(i => ({
      question: `Question ${i + 1}?`, topic: 'Diuretics', options: ['A', 'B', 'C', 'D'], correctIndex: 0,
    })) }));
    expect(screen.getByRole('heading', { name: 'Your quick check' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Pick a date' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'A A' }));
    fireEvent.click(screen.getByRole('button', { name: /Next question/ }));
    fireEvent.click(screen.getByRole('button', { name: 'A A' }));
    fireEvent.click(screen.getByRole('button', { name: /See my starting point/ }));
    expect(screen.getByRole('heading', { name: /We analyzed your answers\. Let’s start with/ })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Web sources/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Build my study plan/ })).toBeNull();
    const today = new Date();
    fireEvent.click(screen.getByRole('gridcell', { name: today.toDateString() }));
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await waitFor(() => expect(onCourseContext).toHaveBeenCalledWith({ examDate: expected, examDatePromptAnswered: true }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].userPreferences.examDaysAway).toBe(0);
    expect(onConfirm.mock.calls[0][0].courseContext.examDate).toBe(expected);
    expect(onConfirm.mock.calls[0][0].diagnostic).toEqual({ Diuretics: 100 });
  });

  it('does not repeat the welcome after a saved skip', async () => {
    mockRun(() => new Promise(() => {}));
    render(<PlanOnboarding autoInvestigate chatId="upload-chat" materialsReady={false}
      savedCourseContext={{ examDate: null, examDatePromptAnswered: true }} />);
    expect(screen.queryByRole('button', { name: 'I don’t know yet' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Let’s get you ready for the exam.' })).toBeTruthy();
    await flush();
  });

  const withFakeTimers = (fn) => async (...args) => {
    jest.useFakeTimers();
    try {
      return await fn(...args);
    } finally {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // THE FALLBACK PATH — what happens when the investigation cannot run.
  // Everything here is the behaviour that shipped before course
  // intelligence existed, and it must survive the feature failing.
  // ══════════════════════════════════════════════════════════════════

  /**
   * No topics => the insights step has nothing to teach from, so its CTA goes
   * straight to the exam-date question. That is the shortest path to the
   * screen under test and is itself the documented behaviour.
   */
  const renderAtExamDate = async (props = {}) => {
    const onConfirm = jest.fn();
    render(<PlanOnboarding topics={[]} insights={[]} chatId="chat-1" onConfirm={onConfirm} {...props} />);
    fireEvent.click(screen.getByText('stub-skip-context'));
    await flush();
    fireEvent.click(screen.getByText('Show me where to start'));
    return onConfirm;
  };

  it('falls back to the old flow when the investigation fails', async () => {
    await renderAtExamDate();
    expect(screen.getByText("When's the exam?")).toBeInTheDocument();
  });

  it('asks for the exam date and nothing else', async () => {
    await renderAtExamDate();
    expect(screen.getByText("When's the exam?")).toBeInTheDocument();
    // The three steps that were cut for length must not reappear.
    expect(screen.queryByText(/where are you in your prep/i)).toBeNull();
    expect(screen.queryByText(/Anything you'd add/i)).toBeNull();
    expect(screen.queryByText(/Here's what I'll build/i)).toBeNull();
  });

  it('hands off straight from the date tap — no confirm step', withFakeTimers(async () => {
    const onConfirm = await renderAtExamDate();
    tapAndFlush('Today');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  }));

  describe('the tapped date, not the stale one', () => {
    // setExamKey has not flushed when the handler runs, so reading derived
    // state there built preferences from the PREVIOUS selection — null on the
    // first tap. That shipped an examDate of null to the pre-fired diagnostic.
    it('resolves the date from the key that was tapped', withFakeTimers(async () => {
      const onConfirm = await renderAtExamDate();
      tapAndFlush('Today');
      const { userPreferences } = onConfirm.mock.calls[0][0];
      expect(userPreferences.examChoiceKey).toBe('today');
      expect(userPreferences.examDaysAway).toBe(0);
      expect(userPreferences.examDate).toEqual(expect.any(String));
    }));

    it('carries the right offset for a later choice', withFakeTimers(async () => {
      const onConfirm = await renderAtExamDate();
      tapAndFlush('Next week');
      expect(onConfirm.mock.calls[0][0].userPreferences.examDaysAway).toBe(10);
    }));

    it('hands the resolved date to the plan, not null', withFakeTimers(async () => {
      const onConfirm = await renderAtExamDate();
      tapAndFlush('Tomorrow');
      const { userPreferences } = onConfirm.mock.calls[0][0];
      expect(userPreferences.examDate).toEqual(expect.any(String));
      expect(userPreferences.examDaysAway).toBe(1);
    }));
  });

  describe('hardestTopics, derived instead of asked', () => {
    const topics = ['Insulin Administration', 'Charting', 'Sepsis'];

    // Walk the real path: skip context -> insights CTA -> lesson (stubbed).
    const walkToDate = async (props = {}) => {
      const onConfirm = jest.fn();
      render(
        <PlanOnboarding topics={topics} insights={[]} chatId="chat-1" onConfirm={onConfirm} {...props} />
      );
      fireEvent.click(screen.getByText('stub-skip-context'));
      await flush();
      fireEvent.click(screen.getByText(/^Start with |^Show me where to start$/));
      fireEvent.click(screen.getByText('stub-finish-lesson'));
      return onConfirm;
    };

    it('opens the lesson on the topic the insights card named', async () => {
      // The CTA is a promise about what happens next; the lesson has to honour
      // it, so both sides read the same ranking. Needs real coverage: without
      // it the card has no basis to name a topic and says so instead.
      const covered = [
        { topic: 'Insulin Administration', insight: 'x', key_points: ['a', 'b', 'c', 'd'], context: 'c' },
      ];
      render(<PlanOnboarding topics={topics} insights={covered} chatId="c" onConfirm={jest.fn()} />);
      fireEvent.click(screen.getByText('stub-skip-context'));
      await flush();
      expect(screen.getByText('Start with Insulin Administration')).toBeInTheDocument();
    });

    it('does not name a topic in the CTA when nothing was extracted', async () => {
      render(<PlanOnboarding topics={topics} insights={[]} chatId="c" onConfirm={jest.fn()} />);
      fireEvent.click(screen.getByText('stub-skip-context'));
      await flush();
      expect(screen.queryByText(/^Start with /)).toBeNull();
      expect(screen.getByText('Show me where to start')).toBeInTheDocument();
    });

    it('sends the top-ranked topics as focus, without ever asking', withFakeTimers(async () => {
      const onConfirm = await walkToDate();
      tapAndFlush('This week');
      const { userPreferences } = onConfirm.mock.calls[0][0];
      expect(userPreferences.hardestTopics).toContain('Insulin Administration');
    }));

    it('caps focus at two, matching the question it replaced', withFakeTimers(async () => {
      const onConfirm = await walkToDate();
      tapAndFlush('This week');
      expect(onConfirm.mock.calls[0][0].userPreferences.hardestTopics.length)
        .toBeLessThanOrEqual(2);
    }));

    it('carries the quick-check result through to the hand-off', withFakeTimers(async () => {
      const onConfirm = await walkToDate();
      tapAndFlush('Today');
      expect(onConfirm.mock.calls[0][0].quickCheckResult).toEqual(mockQuickCheck);
    }));
  });

  describe('the diagnostic, derived instead of asked', () => {
    const topics = ['Insulin Administration', 'Charting', 'Sepsis'];

    const walkToDate = async (props = {}) => {
      const onConfirm = jest.fn();
      render(
        <PlanOnboarding topics={topics} insights={[]} chatId="c" onConfirm={onConfirm} {...props} />
      );
      fireEvent.click(screen.getByText('stub-skip-context'));
      await flush();
      fireEvent.click(screen.getByText(/^Start with |^Show me where to start$/));
      fireEvent.click(screen.getByText('stub-finish-lesson'));
      return onConfirm;
    };

    it('scores the topic the quick check actually covered', withFakeTimers(async () => {
      const onConfirm = await walkToDate();
      tapAndFlush('Today');
      expect(onConfirm.mock.calls[0][0].diagnostic).toEqual({ 'Insulin Administration': 50 });
    }));

    it('leaves untested topics ABSENT rather than scoring them zero', withFakeTimers(async () => {
      // A fabricated 0 tiers as `gap` — 5 nodes at the front of her plan — and
      // would rearrange everything around a subject nobody ever tested her on.
      const onConfirm = await walkToDate();
      tapAndFlush('Today');
      const diagnostic = onConfirm.mock.calls[0][0].diagnostic;
      expect(diagnostic).not.toHaveProperty('Charting');
      expect(diagnostic).not.toHaveProperty('Sepsis');
    }));

    it('carries ONLY the quick check — stored scores are not folded in', withFakeTimers(async () => {
      // They used to be. The label matching behind them put an ARDS score on
      // Acute Coronary Syndrome, so a plan could be tiered on a percentage
      // belonging to a different subject. See uploadPriority.js.
      const onConfirm = await walkToDate();
      tapAndFlush('Today');
      const diagnostic = onConfirm.mock.calls[0][0].diagnostic;
      expect(Object.keys(diagnostic)).toEqual(['Insulin Administration']);
    }));

    it('takes the percentage straight from the quick check', withFakeTimers(async () => {
      const onConfirm = await walkToDate();
      tapAndFlush('Today');
      expect(onConfirm.mock.calls[0][0].diagnostic['Insulin Administration']).toBe(50);
    }));

    it('is null when nothing at all is known — the uniform-plan path', withFakeTimers(async () => {
      mockQuickCheck = { topic: 'Insulin Administration', correct: 0, total: 0, percent: null };
      const onConfirm = await walkToDate();
      tapAndFlush('Today');
      expect(onConfirm.mock.calls[0][0].diagnostic).toBeNull();
    }));
  });

  it('passes the ranked topics through for the locked plan preview', withFakeTimers(async () => {
    const onConfirm = await renderAtExamDate();
    tapAndFlush('Today');
    expect(onConfirm.mock.calls[0][0]).toHaveProperty('rankedTopics');
  }));

  // ══════════════════════════════════════════════════════════════════
  // THE INTELLIGENCE PATH
  // ══════════════════════════════════════════════════════════════════

  describe('course intelligence', () => {
    const renderFlow = (props = {}) => {
      const onConfirm = jest.fn();
      const onCourseContext = jest.fn();
      render(
        <PlanOnboarding
          topics={['Diuretics', 'Charting']}
          insights={[]}
          chatId="chat-ci"
          onConfirm={onConfirm}
          onCourseContext={onCourseContext}
          {...props}
        />
      );
      return { onConfirm, onCourseContext };
    };

    it('opens on the context form, not on a question about her prep', () => {
      renderFlow();
      expect(screen.getByText('stub-submit-context')).toBeInTheDocument();
    });

    it('persists the answers upward so a reload does not re-ask', () => {
      const { onCourseContext } = renderFlow();
      fireEvent.click(screen.getByText('stub-submit-context'));
      expect(onCourseContext).toHaveBeenCalledWith(
        expect.objectContaining({ school: 'McGill University', courseCode: 'NURS 234' })
      );
    });

    // The backend reads her file insights from the session, so a run fired
    // while the upload is still streaming would investigate an empty upload.
    it('holds the run until the upload has finished', async () => {
      renderFlow({ materialsReady: false });
      fireEvent.click(screen.getByText('stub-submit-context'));
      await flush();
      expect(run_course_intelligence).not.toHaveBeenCalled();
    });

    it('starts exactly one run once materials are ready', async () => {
      mockRun(() => new Promise(() => {}));
      const { rerender } = render(
        <PlanOnboarding
          topics={['Diuretics']} insights={[]} chatId="chat-ci"
          materialsReady={false} onConfirm={jest.fn()}
        />
      );
      fireEvent.click(screen.getByText('stub-submit-context'));
      await flush();

      rerender(
        <PlanOnboarding
          topics={['Diuretics']} insights={[]} chatId="chat-ci"
          materialsReady onConfirm={jest.fn()}
        />
      );
      await flush();
      rerender(
        <PlanOnboarding
          topics={['Diuretics']} insights={[]} chatId="chat-ci"
          materialsReady onConfirm={jest.fn()}
        />
      );
      await flush();
      // Three web searches billed twice for one upload is the bug this guards.
      expect(run_course_intelligence).toHaveBeenCalledTimes(1);
    });

    it('shows the report once the run lands', withFakeTimers(async () => {
      mockRun(() => Promise.resolve(REPORT));
      renderFlow();
      fireEvent.click(screen.getByText('stub-submit-context'));
      await flush();
      act(() => { jest.advanceTimersByTime(600); });
      expect(screen.getAllByText('NURS 234 · Pharmacology').length).toBeGreaterThan(0);
      // The recommendation remains visible above the compact source tabs.
      expect(screen.getAllByText('Diuretics').length).toBeGreaterThan(0);
      expect(screen.getByRole('tab', { name: /Your documents/ })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Midterm examination')).toBeInTheDocument();
    }));

    it('opens the streamed question early and preserves the answer when research completes', withFakeTimers(async () => {
      let emit, resolve;
      run_course_intelligence.mockImplementation(({ onEvent }) => {
        emit = onEvent;
        return { promise: new Promise(r => { resolve = r; }), abort: jest.fn() };
      });
      const questions = [0, 1].map(i => ({ question: `Source question ${i + 1}?`,
        topic: 'Diuretics', options: ['A', 'B', 'C', 'D'], correctIndex: 0,
        rationale: 'Explanation from the passage.', source: { filename: 'lecture.pdf', excerpt: 'A supporting passage from the uploaded lecture.' } }));
      const { onConfirm } = renderFlow();
      fireEvent.click(screen.getByText('stub-submit-context'));
      act(() => emit({ status: 'course_question_ready', questions, report: REPORT, source: questions[0].source }));
      expect(screen.getByText('Source question 1?')).toBeInTheDocument();
      expect(plan_diagnostic_quiz).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'A A' }));
      await act(async () => { resolve(REPORT); });
      act(() => jest.advanceTimersByTime(600));
      expect(screen.getByText('Correct', { exact: true })).toBeInTheDocument();
      fireEvent.click(screen.getByText('Continue with what you know about me'));
      fireEvent.click(screen.getByText('Build my study plan'));
      expect(onConfirm.mock.calls[0][0].diagnostic).toEqual({ Diuretics: 100 });
      expect(onConfirm.mock.calls[0][0].courseIntelligence).toBe(REPORT);
    }));

    it('keeps a source-backed quiz usable if the research stream fails later', async () => {
      let emit, reject;
      run_course_intelligence.mockImplementation(({ onEvent }) => {
        emit = onEvent;
        return { promise: new Promise((_, r) => { reject = r; }), abort: jest.fn() };
      });
      renderFlow();
      fireEvent.click(screen.getByText('stub-submit-context'));
      const questions = [0, 1].map(i => ({ question: `Question ${i}?`, topic: 'Diuretics',
        options: ['A', 'B', 'C', 'D'], correctIndex: 0 }));
      act(() => emit({ status: 'course_question_ready', questions, report: REPORT }));
      await act(async () => reject(new Error('Research disconnected')));
      expect(screen.getByText('Question 0?')).toBeInTheDocument();
      expect(plan_diagnostic_quiz).not.toHaveBeenCalled();
    });

    it('lets a student continue without a date or another question screen', withFakeTimers(async () => {
      mockRun(() => Promise.resolve(REPORT));
      renderFlow();
      fireEvent.click(screen.getByText('stub-submit-context'));
      await flush();
      act(() => { jest.advanceTimersByTime(600); });
      fireEvent.click(screen.getByText('Build a plan without the check'));
      expect(screen.queryByText("When's the exam?")).toBeNull();
      expect(screen.getByText('Add a date')).toBeInTheDocument();
    }));

    it.each([null, undefined])('does not inherit a profile deadline when this course date is %s', withFakeTimers(async (examDate) => {
      mockRun(() => Promise.resolve(REPORT));
      const { onConfirm } = renderFlow({
        savedCourseContext: { courseName: 'Pharmacology', examDate },
        userOnboarding: { examDate: '2030-01-01', examDaysAway: 1, examChoiceKey: 'tomorrow' },
      });
      await flush();
      act(() => { jest.advanceTimersByTime(600); });
      fireEvent.click(screen.getByText('Build a plan without the check'));
      expect(screen.getByText('Add a date')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Build my study plan'));
      expect(onConfirm.mock.calls[0][0].userPreferences).toEqual(expect.objectContaining({
        examDate: null, examDaysAway: null, examChoiceKey: null,
      }));
    }));

    it('skips the date question when the form already gave one', withFakeTimers(async () => {
      mockRun(() => Promise.resolve(REPORT));
      const iso = new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10);
      renderFlow({ savedCourseContext: { school: 'McGill', courseCode: 'NURS 234', examDate: iso } });
      await flush();
      act(() => { jest.advanceTimersByTime(600); });
      fireEvent.click(screen.getByText('Build a plan without the check'));
      expect(screen.queryByText("When's the exam?")).toBeNull();
      expect(screen.getByText('A clear place to begin.')).toBeInTheDocument();
    }));

    it('hands the backend its own payload back, in priority order', withFakeTimers(async () => {
      mockRun(() => Promise.resolve(REPORT));
      const iso = new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10);
      const { onConfirm } = renderFlow({
        savedCourseContext: { school: 'McGill', courseCode: 'NURS 234', examDate: iso },
      });
      await flush();
      act(() => { jest.advanceTimersByTime(600); });
      fireEvent.click(screen.getByText('Build a plan without the check'));
      fireEvent.click(screen.getByText('Build my study plan'));

      const payload = onConfirm.mock.calls[0][0];
      // The RAW report, not the normalized one: /study/start reads
      // study_strategy.ordered_topics in its original shape.
      expect(payload.courseIntelligence).toBe(REPORT);
      expect(payload.courseIntelligence.study_strategy.ordered_topics[0]).toBe('Diuretics');
    }));

    it('leads the plan on the topics the report ranked, not the upload order', withFakeTimers(async () => {
      mockRun(() => Promise.resolve(REPORT));
      const iso = new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10);
      const { onConfirm } = renderFlow({
        savedCourseContext: { school: 'McGill', courseCode: 'NURS 234', examDate: iso },
      });
      await flush();
      act(() => { jest.advanceTimersByTime(600); });
      fireEvent.click(screen.getByText('Build a plan without the check'));
      fireEvent.click(screen.getByText('Build my study plan'));
      expect(onConfirm.mock.calls[0][0].rankedTopics[0].topic).toBe('Diuretics');
      expect(onConfirm.mock.calls[0][0].userPreferences.hardestTopics).toEqual([]);
    }));

    // No quick check on this path, so no diagnostic. The planner's documented
    // null input is what lets the priority ordering apply instead.
    it('sends a null diagnostic so the priority ordering can apply', withFakeTimers(async () => {
      mockRun(() => Promise.resolve(REPORT));
      const iso = new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10);
      const { onConfirm } = renderFlow({
        savedCourseContext: { school: 'McGill', courseCode: 'NURS 234', examDate: iso },
      });
      await flush();
      act(() => { jest.advanceTimersByTime(600); });
      fireEvent.click(screen.getByText('Build a plan without the check'));
      fireEvent.click(screen.getByText('Build my study plan'));
      expect(onConfirm.mock.calls[0][0].diagnostic).toBeNull();
    }));

    it('falls back rather than showing an empty report', async () => {
      mockRun(() => Promise.resolve({ priority_topics: [], uploaded_material_insights: {} }));
      renderFlow();
      fireEvent.click(screen.getByText('stub-submit-context'));
      await flush();
      expect(screen.getByText(/Start with |Show me where to start/)).toBeInTheDocument();
    });

    it('a failed upload goes straight to the date, with nothing to investigate', async () => {
      renderFlow({ uploadFailed: true });
      await flush();
      expect(screen.getByText("When's the exam?")).toBeInTheDocument();
    });
  });
});
