import catalog from './catalog.json';
import { SUBJECTS, CLIENT_NEEDS } from '../Nclex/nclexCurriculum';
import {
  QUESTION_TARGETS,
  PAGE_TARGETS,
  PLANNER_SUBJECTS,
  attemptsFromDiagnostic,
  focusFor,
  buildIntent,
  handsOffToNclex,
} from './seoToNclex';

const page = (slug) => catalog.pages.find((p) => p.slug === slug);
const q = (id) => catalog.questions.find((x) => x.id === id);

describe('the mapping only points at things that exist', () => {
  it('every target subject, area and category is in the curriculum', () => {
    Object.values(QUESTION_TARGETS).forEach(({ subject, area, category }) => {
      const s = SUBJECTS.find((x) => x.id === subject);
      expect(s).toBeTruthy();
      expect(s.areas).toContain(area);
      expect(CLIENT_NEEDS.map((c) => c.code)).toContain(category);
    });
  });

  it('covers every question in the NCLEX-bound banks and none of HESI A2', () => {
    Object.keys(PAGE_TARGETS)
      .filter((slug) => catalog.banks[slug])
      .forEach((slug) => {
        catalog.banks[slug].forEach((id) => expect(QUESTION_TARGETS[id]).toBeTruthy());
      });
    catalog.banks['hesi-a2-practice-test'].forEach((id) =>
      expect(QUESTION_TARGETS[id]).toBeUndefined()
    );
  });

  it('planner labels resolve to real subjects', () => {
    Object.values(PLANNER_SUBJECTS).forEach((id) =>
      expect(SUBJECTS.find((s) => s.id === id)).toBeTruthy()
    );
  });

  it('HESI pages do not hand off to /nclex', () => {
    expect(handsOffToNclex(page('hesi-a2-practice-test'))).toBe(false);
    expect(handsOffToNclex(page('hesi-practice-questions'))).toBe(false);
    expect(handsOffToNclex(page('pharmacology-nclex-questions'))).toBe(true);
  });
});

describe('attemptsFromDiagnostic', () => {
  it('grades from the catalog and skips unknown ids', () => {
    const rows = attemptsFromDiagnostic({
      questionIds: ['p-1', 'p-3', 'a-math-1'],
      answers: { 'p-1': q('p-1').answer, 'p-3': [99], 'a-math-1': [0] },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      questionId: 'p-1',
      subject: 'pharmacology',
      category: 'PHAR',
      correct: true,
      format: 'mcq',
    });
    expect(rows[1].correct).toBe(false);
    expect(rows[1].concept).toBe('Diuretic adverse effects');
  });

  it('keeps the SATA format so the format gap can see it', () => {
    const rows = attemptsFromDiagnostic({ questionIds: ['p-2'], answers: { 'p-2': [0] } });
    expect(rows[0].format).toBe('sata');
  });

  it('produces nothing for an unanswered question', () => {
    expect(attemptsFromDiagnostic({ questionIds: ['p-1'], answers: {} })).toEqual([]);
  });
});

describe('focusFor — where the first session opens', () => {
  it('opens on the area she missed most', () => {
    const focus = focusFor(page('pharmacology-nclex-questions'), {
      questionIds: ['p-1', 'p-3', 'p-4'],
      answers: { 'p-1': q('p-1').answer, 'p-3': [99], 'p-4': [99] },
    });
    expect(focus).toEqual({
      subject: 'pharmacology',
      area: 'Adverse effects & interactions',
      category: 'PHAR',
    });
  });

  it('widens to the page subject when she missed nothing', () => {
    const focus = focusFor(page('pediatric-nclex-questions'), {
      questionIds: ['ped-1'],
      answers: { 'ped-1': q('ped-1').answer },
    });
    expect(focus).toEqual({ subject: 'pediatrics', area: null, category: null });
  });
});

describe('buildIntent', () => {
  it('returns null for pages that stay on the chat path', () => {
    expect(buildIntent(page('hesi-a2-practice-test'), {})).toBeNull();
  });

  it('describes a diagnostic with score and missed concepts', () => {
    const intent = buildIntent(page('cardiac-nclex-questions'), {
      result: { strongest: 'Cardiac' },
      questionIds: ['c-1', 'c-3'],
      answers: { 'c-1': q('c-1').answer, 'c-3': [99] },
    });
    expect(intent.kind).toBe('diagnostic');
    expect(intent.score).toEqual({ correct: 1, total: 2, percentage: 50 });
    expect(intent.missedConcepts).toEqual(['Cardiac medication safety']);
    expect(intent.subject).toBe('pharmacology');
    expect(intent.area).toBe('Cardiovascular drugs');
    expect(intent.attempts).toHaveLength(2);
  });

  it('describes a plan with its priority subjects and the day topic', () => {
    const intent = buildIntent(
      page('nclex-study-plan'),
      {
        plan: {
          track: 'PN',
          examDate: '2026-10-20',
          days: 28,
          minutes: 60,
          priorities: ['Pediatrics', 'Coordinated care'],
        },
      },
      { topic: 'Coordinated care' }
    );
    expect(intent.kind).toBe('planner');
    expect(intent.examTrack).toBe('PN');
    expect(intent.subject).toBe('leadership');
    expect(intent.plan.prioritySubjects).toEqual(['pediatrics', 'leadership']);
  });
});
