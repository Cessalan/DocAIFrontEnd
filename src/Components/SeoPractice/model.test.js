import { bankFor, coverageTopics, createPlan, diagnostic, grade, parseDate, pickSet, unseenCount } from './model';
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
test('each set prefers unseen questions, balances sections, and every bank outgrows one set', () => {
  const bank = bankFor('hesi-a2-practice-test');
  const rng = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  const first = pickSet(bank, 12, [], rng);
  expect(first).toHaveLength(12);
  expect(new Set(first.map(q => q.id)).size).toBe(12);
  expect(new Set(first.map(q => q.section)).size).toBe(4);
  const seen = first.map(q => q.id);
  const second = pickSet(bank, 12, seen, rng);
  expect(second.filter(q => seen.includes(q.id))).toHaveLength(12 - unseenCount(bank, seen));
  expect(second.filter(q => !seen.includes(q.id))).toHaveLength(unseenCount(bank, seen));
  expect(pickSet(bank.slice(0, 3), 6, [], rng)).toHaveLength(3);
  expect(catalog.banks['hesi-a2-study-guide']).toHaveLength(12);
  expect(catalog.banks['hesi-a2-practice-test'].length).toBeGreaterThan(12);
  for (const page of catalog.pages.filter(p => p.kind === 'diagnostic')) {
    expect(page.sessionSize).toBeGreaterThan(0);
    expect(bankFor(page.slug).length).toBeGreaterThan(page.sessionSize);
    const topics = coverageTopics(bankFor(page.slug));
    expect(topics.length).toBeGreaterThan(0);
    expect(topics.length).toBeLessThanOrEqual(bankFor(page.slug).length);
    expect(new Set(topics.map(q => `${q.section}|${q.concept}`)).size).toBe(topics.length);
    expect(topics.every(q => !bankFor(page.slug).some(item => item.stem === q.concept))).toBe(true);
  }
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
