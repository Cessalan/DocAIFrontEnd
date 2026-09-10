import {
  CONFIDENCE,
  STEP_IDS,
  initialTimeline,
  reduceTimeline,
  normalizeReport,
  cleanCitations,
  hasPublicFindings,
  emptyResearchReason,
  priorityRows,
  recommendedStart,
  rescorePriority,
  plannerTopics,
  leadTopics,
  revealStats,
  PRIORITY_WEIGHTS,
} from './courseIntelligenceModel';

const citation = (url = 'https://mcgill.ca/nursing/nurs234') => ({
  url,
  title: 'NURS 234 course page',
  snippet: 'Pharmacology for nursing practice.',
});

const rawReport = (overrides = {}) => ({
  course_information: {
    school: 'McGill University',
    courseCode: 'NURS 234',
    courseName: 'Pharmacology',
    professor: 'Dr. Jane Smith',
    examDescription: 'Midterm covering cardiovascular medications and diuretics.',
    examDate: '2026-10-14',
    public_profile: null,
  },
  uploaded_material_insights: {
    file_count: 3,
    topic_count: 2,
    concept_count: 24,
    document_types: ['lecture'],
    frameworks: [],
    topics: [
      { topic: 'Diuretics', emphasis: 88, file_count: 3, key_points: ['loop', 'thiazide'] },
      { topic: 'Cardiac output', emphasis: 40, file_count: 1, key_points: [] },
    ],
  },
  relevant_public_context: { instructor: null, resources: null, course: null },
  verified_public_information: null,
  exam_analysis: {
    exam_type: 'Midterm examination',
    coverage: ['Cardiovascular medications', 'Diuretics'],
    formats: ['Multiple-choice questions'],
    stated_emphasis: [],
    unstated: ['Number of questions'],
  },
  priority_topics: [
    {
      topic: 'Diuretics',
      score: 82,
      signals: {
        exam_relevance: 100, material_emphasis: 88, objective_alignment: 40,
        dependency: 70, clinical_importance: 80, complexity: 50,
      },
      evidence: [
        { text: 'Named in your exam description', source: 'exam_description', confidence: CONFIDENCE.VERIFIED },
        { text: 'Connects to electrolyte monitoring', source: 'inference', confidence: CONFIDENCE.INFERENCE },
      ],
      key_points: ['loop', 'thiazide'],
      file_count: 3,
    },
    {
      topic: 'Cardiac output',
      score: 44,
      signals: {
        exam_relevance: 30, material_emphasis: 40, objective_alignment: 10,
        dependency: 20, clinical_importance: 60, complexity: 40,
      },
      evidence: [],
      key_points: [],
      file_count: 1,
    },
  ],
  study_strategy: {
    ordered_topics: ['Diuretics', 'Cardiac output'],
    recommended_start: { topic: 'Diuretics', reasons: [{ key: 'exam', confidence: CONFIDENCE.VERIFIED }], score: 82 },
    connections: [],
    note: 'Your plan leads with diuretics.',
  },
  inferences: {},
  research_ran: false,
  research_enabled: true,
  elapsed_ms: 8100,
  ...overrides,
});

describe('timeline', () => {
  test('starts with every step pending and zero progress', () => {
    const state = initialTimeline();
    expect(state.steps).toHaveLength(STEP_IDS.length);
    expect(state.steps.every(s => s.state === 'pending')).toBe(true);
    expect(state.progress).toBe(0);
    expect(state.done).toBe(false);
  });

  test('marks a step running then done, carrying its detail', () => {
    let state = initialTimeline();
    state = reduceTimeline(state, {
      status: 'course_intelligence_progress', step: 'course_research', state: 'running', progress: 34,
    });
    expect(state.steps.find(s => s.id === 'course_research').state).toBe('running');

    state = reduceTimeline(state, {
      status: 'course_intelligence_progress',
      step: 'course_research',
      state: 'done',
      progress: 42,
      detail: { objective_count: 6 },
    });
    const step = state.steps.find(s => s.id === 'course_research');
    expect(step.state).toBe('done');
    expect(step.detail).toEqual({ objective_count: 6 });
    expect(state.progress).toBe(42);
  });

  // The four concurrent steps report out of order; a bar that slides backwards
  // reads as a bug in the exact moment this feature is asking to be trusted.
  test('progress never decreases when steps land out of order', () => {
    let state = initialTimeline();
    state = reduceTimeline(state, { status: 'course_intelligence_progress', step: 'exam_analysis', state: 'done', progress: 72 });
    state = reduceTimeline(state, { status: 'course_intelligence_progress', step: 'course_research', state: 'done', progress: 42 });
    expect(state.progress).toBe(72);
  });

  test('the ready event completes every unfinished step', () => {
    let state = initialTimeline();
    state = reduceTimeline(state, { status: 'course_intelligence_progress', step: 'course_research', state: 'running', progress: 34 });
    state = reduceTimeline(state, { status: 'course_intelligence_ready', report: {} });
    expect(state.steps.every(s => s.state === 'done')).toBe(true);
    expect(state.progress).toBe(100);
    expect(state.done).toBe(true);
  });

  test('an unknown step is ignored rather than appended', () => {
    const state = initialTimeline();
    const next = reduceTimeline(state, {
      status: 'course_intelligence_progress', step: 'reticulating_splines', state: 'done', progress: 50,
    });
    expect(next.steps).toHaveLength(STEP_IDS.length);
    expect(next.progress).toBe(0);
  });
});

describe('citations', () => {
  test('drops anything without an http(s) url', () => {
    const cleaned = cleanCitations([
      citation(),
      { url: 'not-a-url', title: 'x', snippet: 'y' },
      { title: 'no url at all' },
      null,
    ]);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].host).toBe('mcgill.ca');
  });
});

describe('normalizeReport — sections survive only with support', () => {
  test('keeps her own materials and exam description as verified', () => {
    const report = normalizeReport(rawReport());
    expect(report.materials.confidence).toBe(CONFIDENCE.VERIFIED);
    expect(report.exam.confidence).toBe(CONFIDENCE.VERIFIED);
    expect(report.exam.coverage).toEqual(['Cardiovascular medications', 'Diuretics']);
  });

  // The rule the whole feature rests on: a claimed find with nothing to link
  // to is dropped, not softened.
  test('drops a researched section that cites nothing', () => {
    const report = normalizeReport(rawReport({
      relevant_public_context: {
        instructor: { found: true, title: 'Associate Professor', citations: [] },
        course: { found: true, official_name: 'Pharmacology', citations: [] },
        resources: null,
      },
    }));
    expect(report.instructor).toBeNull();
    expect(report.course).toBeNull();
    expect(hasPublicFindings(report)).toBe(false);
  });

  test('drops an instructor with a citation but no professional substance', () => {
    const report = normalizeReport(rawReport({
      relevant_public_context: {
        instructor: { found: true, display_name: 'Jane Smith', citations: [citation()] },
        course: null,
        resources: null,
      },
    }));
    expect(report.instructor).toBeNull();
  });

  test('keeps an instructor with a title and a citation, as public context', () => {
    const report = normalizeReport(rawReport({
      relevant_public_context: {
        instructor: {
          found: true,
          display_name: 'Dr. Jane Smith',
          title: 'Associate Professor',
          clinical_specialties: ['critical care'],
          citations: [citation('https://mcgill.ca/faculty/jsmith')],
        },
        course: null,
        resources: null,
      },
    }));
    expect(report.instructor.title).toBe('Associate Professor');
    expect(report.instructor.confidence).toBe(CONFIDENCE.PUBLIC);
    expect(report.instructor.citations[0].host).toBe('mcgill.ca');
  });

  // Nothing in this file may promote a claim. An official university page is
  // the one thing allowed to reach `verified`, and only via official_source.
  test('an official course page reaches verified; an unofficial one stays public', () => {
    const official = normalizeReport(rawReport({
      verified_public_information: {
        found: true, official_name: 'Pharmacology', official_source: true, citations: [citation()],
      },
    }));
    expect(official.course.confidence).toBe(CONFIDENCE.VERIFIED);

    const unofficial = normalizeReport(rawReport({
      verified_public_information: {
        found: true, official_name: 'Pharmacology', official_source: false, citations: [citation('https://coursehero.com/x')],
      },
    }));
    expect(unofficial.course.confidence).toBe(CONFIDENCE.PUBLIC);
  });

  test('returns null for a report with nothing in it', () => {
    expect(normalizeReport(null)).toBeNull();
    expect(normalizeReport({ priority_topics: [], uploaded_material_insights: {} })).toBeNull();
  });

  test('a found=false section never renders', () => {
    const report = normalizeReport(rawReport({
      relevant_public_context: {
        instructor: { found: false, title: 'Professor', citations: [citation()] },
        course: null,
        resources: null,
      },
    }));
    expect(report.instructor).toBeNull();
  });
});

describe('empty research is a normal outcome, with a true reason', () => {
  test('names the reason when nothing was found', () => {
    expect(emptyResearchReason(normalizeReport(rawReport()))).toBe('not_found');
  });

  test('says disabled when the backend never searched', () => {
    const report = normalizeReport(rawReport({ research_enabled: false }));
    expect(emptyResearchReason(report)).toBe('disabled');
  });

  test('says no course named when she gave us nothing to search for', () => {
    const report = normalizeReport(rawReport({
      course_information: { school: '', courseCode: '', courseName: '', professor: '', examDescription: 'Midterm' },
    }));
    expect(emptyResearchReason(report)).toBe('no_course_named');
  });

  test('returns null once anything was found', () => {
    const report = normalizeReport(rawReport({
      verified_public_information: { found: true, official_name: 'Pharmacology', official_source: true, citations: [citation()] },
    }));
    expect(emptyResearchReason(report)).toBeNull();
  });
});

describe('priority', () => {
  test('ranks and bands, leading with the verifiable reason', () => {
    const rows = priorityRows(normalizeReport(rawReport()));
    expect(rows[0].topic).toBe('Diuretics');
    expect(rows[0].band).toBe('focus');
    // Verified evidence must lead even when an inference is listed first.
    expect(rows[0].lead.confidence).toBe(CONFIDENCE.VERIFIED);
    expect(rows[1].band).toBe('strong');
  });

  test('recommendedStart uses the backend choice and carries its reasons', () => {
    const start = recommendedStart(normalizeReport(rawReport()));
    expect(start.topic).toBe('Diuretics');
    expect(start.reasons[0].key).toBe('exam');
  });

  test('recommendedStart falls back to the top row when none was named', () => {
    const report = normalizeReport(rawReport({
      study_strategy: { ordered_topics: ['Diuretics'], recommended_start: null, connections: [], note: '' },
    }));
    expect(recommendedStart(report).topic).toBe('Diuretics');
  });

  test('recommendedStart is null when there are no topics at all', () => {
    const report = normalizeReport(rawReport({
      priority_topics: [],
      uploaded_material_insights: { file_count: 1, topic_count: 0, topics: [] },
      study_strategy: { ordered_topics: [], recommended_start: null },
    }));
    expect(recommendedStart(report)).toBeNull();
  });

  // ⚠️ Guards the cross-repo contract: these weights are mirrored in
  // NQBackEnd2/services/course_intelligence.py.
  test('the weights sum to one', () => {
    const sum = Object.values(PRIORITY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });

  test('rescorePriority reproduces the backend score', () => {
    const rows = normalizeReport(rawReport()).priorityTopics;
    const rescored = rescorePriority(rows);
    // 34 + 21.12 + 6.4 + 8.4 + 8 + 2 = 79.92 -> 80, and the Python side rounds
    // the same sum the same way. This assertion is the contract's tripwire.
    expect(rescored[0].topic).toBe('Diuretics');
    expect(rescored[0].score).toBe(80);
    expect(rescored[1].topic).toBe('Cardiac output');
  });

  test('rescorePriority breaks ties on material emphasis, then alphabetically', () => {
    const flat = (topic, emphasis) => ({
      topic,
      signals: {
        exam_relevance: 50, material_emphasis: emphasis, objective_alignment: 0,
        dependency: 0, clinical_importance: 0, complexity: 0,
      },
    });
    const out = rescorePriority([flat('Zeta', 10), flat('Alpha', 90)]);
    expect(out[0].topic).toBe('Alpha');
  });
});

describe('planner hand-off', () => {
  test('hands over the priority order, not the upload order', () => {
    const report = normalizeReport(rawReport());
    expect(plannerTopics(report, ['Cardiac output', 'Diuretics'])).toEqual(['Diuretics', 'Cardiac output']);
  });

  test('falls back to the caller list when there is no report', () => {
    expect(plannerTopics(null, ['A', 'B'])).toEqual(['A', 'B']);
  });

  test('leadTopics gives the plan its two focus topics', () => {
    expect(leadTopics(normalizeReport(rawReport()))).toEqual(['Diuretics', 'Cardiac output']);
  });
});

describe('reveal stats', () => {
  // The numbers on the reveal are the numbers the plan delivers. Nothing here
  // may invent its own arithmetic — see the note on revealStats.
  test('counts sessions from the same rules the plan is built by', () => {
    const stats = revealStats({ report: normalizeReport(rawReport()), daysToExam: 20 });
    expect(stats.topicCount).toBe(2);
    expect(stats.archetype).toBe('master');
    expect(stats.sessionCount).toBeGreaterThan(0);
    expect(stats.estimatedMinutes).toBeGreaterThan(0);
  });

  test('a near exam produces the sprint shape', () => {
    const stats = revealStats({ report: normalizeReport(rawReport()), daysToExam: 1 });
    expect(stats.archetype).toBe('sprint');
  });

  test('an empty report yields zeroes rather than a guess', () => {
    const stats = revealStats({ report: null, daysToExam: 5 });
    expect(stats.topicCount).toBe(0);
    expect(stats.sessionCount).toBe(0);
  });
});
