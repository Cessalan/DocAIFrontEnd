import { bankFor, createPlan, diagnostic, grade, parseDate } from './model';
import catalog from './catalog.json';
const input = { track: 'RN', unscheduled: false, examDate: '2026-09-25', minutes: 60, weak: ['Pharmacology'] };
const today = new Date(2026, 8, 11, 12);
test('dates every study day before the exam and budgets time, including rationale review', () => {
  const plan = createPlan(input, today);
  expect(plan.days).toBe(14);
  expect(plan.rows[0].date).toBe('2026-09-11');
  expect(plan.rows.at(-1).date).toBe('2026-09-24');
  expect(plan.rows.filter(r => r.subject === 'Pharmacology').length).toBeGreaterThan(5);
  expect(plan.rows.every(r => r.count <= r.minutes / 5)).toBe(true);
});
test('supports PN, unscheduled horizons, and leap dates without accepting invalid dates', () => {
  const plan = createPlan({ ...input, track: 'PN', unscheduled: true, weeks: 8, weak: ['Coordinated care'] }, today);
  expect(plan.days).toBe(56);
  expect(plan.examDate).toBeNull();
  expect(plan.priorities).toEqual(['Coordinated care']);
  expect(plan.rows.some(r => r.subject === 'Management of care')).toBe(false);
  expect(parseDate('2025-02-29')).toBeNull();
  expect(parseDate('2024-02-29')).not.toBeNull();
  expect(() => createPlan({ ...input, examDate: '2026-09-11' }, today)).toThrow();
  expect(() => createPlan({ ...input, examDate: '2030-01-01' }, today)).toThrow();
});
test('no strengths at zero; all-correct has no invented weaknesses; unattempted areas are excluded', () => {
  const questions = bankFor('hesi-a2-practice-test', ['Math']);
  const wrong = Object.fromEntries(questions.map(q => [q.id, [(q.answer[0] + 1) % q.options.length]]));
  expect(diagnostic(questions, wrong).strongest).toBeNull();
  expect(diagnostic(questions, wrong).needsWork).toBe('Math');
  expect(diagnostic(questions, wrong).band).toBe('Best next step found');
  const right = Object.fromEntries(questions.map(q => [q.id, q.answer]));
  expect(diagnostic(questions, right).missed).toEqual([]);
  expect(diagnostic(questions, right).needsWork).toBeNull();
  expect(diagnostic(questions, right).percentage).toBe(100);
  expect(diagnostic(questions, {}).total).toBe(0);
});
test('select-all requires the exact set and every public bank has valid source-backed items', () => {
  const sata = catalog.questions.find(q => q.type === 'sata');
  expect(grade(sata, sata.answer)).toBe(true);
  expect(grade(sata, sata.answer.slice(1))).toBe(false);
  expect(grade(sata, sata.options.map((_, i) => i))).toBe(false);
  expect(new Set(catalog.questions.map(q => q.id)).size).toBe(catalog.questions.length);
  for (const page of catalog.pages.filter(p => p.kind !== 'planner')) {
    expect(bankFor(page.slug).length).toBeGreaterThan(0);
    for (const q of bankFor(page.slug)) {
      expect(q.answer.every(i => Number.isInteger(i) && i >= 0 && i < q.options.length)).toBe(true);
      expect(catalog.sources[q.source].url).toMatch(/^https:\/\//);
    }
  }
});
