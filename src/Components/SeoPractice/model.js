import catalog from './catalog.json';

export const subjects = ['Pharmacology', 'Fundamentals', 'Adult health', 'Pediatrics', 'Maternity', 'Mental health', 'Safety & infection control', 'Management of care'];
export function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  return dateKey(date) === value ? date : null;
}
export function createPlan(input, today = new Date()) {
  const start = parseDate(dateKey(today));
  const scheduled = !input.unscheduled;
  const exam = scheduled ? parseDate(input.examDate) : null;
  if (!scheduled && ![2, 4, 8].includes(Number(input.weeks || 4))) throw new Error('Choose a 2-, 4-, or 8-week planning horizon.');
  if (scheduled && (!exam || exam <= start)) throw new Error('Choose an exam date after today, or select “Not scheduled yet”.');
  const days = scheduled ? Math.round((exam - start) / 86400000) : Number(input.weeks || 4) * 7;
  if (days > 365) throw new Error('Choose a date within the next year. You can update your plan later.');
  const minutes = Number(input.minutes);
  if (![30, 60, 90, 120].includes(minutes)) throw new Error('Choose your available study time.');
  const track = input.track === 'PN' ? 'PN' : 'RN';
  const coverage = subjects.map(s => track === 'PN' && s === 'Management of care' ? 'Coordinated care' : s);
  const priorities = (input.weak || []).filter(s => coverage.includes(s));
  const focus = priorities.length ? priorities : coverage.slice(0, 3);
  const rows = Array.from({ length: days }, (_, i) => {
    const date = new Date(start); date.setDate(start.getDate() + i);
    const last = i === days - 1;
    const phase = i < days * .25 ? 'Find your gaps' : i < days * .75 ? 'Build on your weak spots' : 'Bring it together';
    const subject = i % 3 === 0 ? coverage[Math.floor(i / 3) % coverage.length] : focus[i % focus.length];
    const count = last ? Math.max(2, Math.floor(minutes / 12)) : Math.max(5, Math.floor(minutes / 5));
    return { date: dateKey(date), subject, phase, minutes, count,
      title: last ? 'Light review & test-day prep' : `${subject} · ${phase === 'Bring it together' ? 'mixed decisions' : i % 3 === 0 ? 'baseline check' : 'focused practice'}`,
      task: last ? 'Revisit your error notes. Prepare your documents and travel plan; protect your rest.' : `${count} questions, then explain each missed answer in your own words. ${i % 2 ? 'Include a select-all question.' : 'Work through one patient scenario.'}` };
  });
  return { version: 1, track, examDate: exam ? dateKey(exam) : null, days, minutes, priorities: focus, rows, createdAt: new Date().toISOString() };
}
export function bankFor(slug, sections = []) {
  const ids = catalog.banks[slug] || [];
  return catalog.questions.filter(q => ids.includes(q.id) && (!sections.length || sections.includes(q.section)));
}
function shuffle(list, random = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
// Each visit draws a fresh, section-balanced set from the bank. Questions the
// visitor has already seen (tracked per page in local storage) are used only
// when the unseen pool cannot fill the set, so refreshing or "keep going" gives
// new material for as long as the bank allows. Order within a set is random.
export function pickSet(questions, size, seen = [], random = Math.random) {
  if (!size || questions.length <= size) return shuffle(questions, random);
  const chosen = [];
  const roundRobin = list => {
    const bySection = {};
    shuffle(list, random).forEach(q => (bySection[q.section] || (bySection[q.section] = [])).push(q));
    const lanes = Object.values(bySection);
    while (chosen.length < size && lanes.some(lane => lane.length)) {
      for (const lane of lanes) { if (chosen.length < size && lane.length) chosen.push(lane.shift()); }
    }
  };
  roundRobin(questions.filter(q => !seen.includes(q.id)));
  roundRobin(questions.filter(q => seen.includes(q.id)));
  return shuffle(chosen, random);
}
export function unseenCount(questions, seen = []) {
  return questions.filter(q => !seen.includes(q.id)).length;
}
// Landing coverage is a topic map, not the item bank: extra questions that
// reuse a concept would otherwise dump a card (or the stem) for every id.
export function coverageTopics(questions) {
  const seen = new Set();
  return questions.filter(q => {
    const key = `${q.section}|${q.concept}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export function grade(question, selected) {
  return selected.length === question.answer.length && question.answer.every(i => selected.includes(i));
}
export function diagnostic(questions, answers) {
  const groups = {};
  const missed = [];
  let correct = 0;
  questions.forEach(q => {
    const answer = answers[q.id];
    if (!Array.isArray(answer)) return;
    const ok = grade(q, answer);
    const group = groups[q.section] || (groups[q.section] = { section: q.section, correct: 0, total: 0 });
    group.total += 1;
    if (ok) { correct += 1; group.correct += 1; } else missed.push(q.concept);
  });
  const areas = Object.values(groups).sort((a, b) => b.correct / b.total - a.correct / a.total);
  const total = areas.reduce((sum, g) => sum + g.total, 0);
  const needsWork = [...areas].reverse().find(g => g.correct < g.total)?.section || null;
  const percentage = total ? Math.round((correct / total) * 100) : 0;
  const band = percentage >= 80 ? 'Strong start' : percentage >= 60 ? 'Building' : 'Best next step found';
  return {
    correct,
    total,
    percentage,
    band,
    areas,
    missed: [...new Set(missed)],
    strongest: areas.find(g => g.correct > 0)?.section || null,
    needsWork
  };
}

export function faqs(page) {
  if (page.kind === 'planner') return [
    ['How long should I study for NCLEX?', 'Start with your exam date, a baseline practice session, and the time you can consistently protect. There is no single study duration that suits every candidate. Reassess your plan as you learn.'],
    ['Can I make a 2-week, 4-week, or 8-week NCLEX study plan?', 'Yes. Pick a horizon when your exam is not scheduled, or enter your actual date. Two weeks emphasizes prioritization; four weeks leaves more repetition; eight weeks gives more room for spaced review. A short plan is not a promise of readiness.'],
    ['How many hours per day should I study?', 'Choose 30, 60, 90, or 120 minutes. The planner budgets questions and time to review mistakes together. Consistency and understanding are more useful than chasing a daily question count.'],
    ['Does the planner support NCLEX-RN and NCLEX-PN?', 'Yes. Choose your exam track. RN plans include Management of Care; PN plans use Coordinated Care. Use the current official test plan for the full scope of your exam.'],
    ['Is my plan free?', 'Generating and reading the plan is free without an account. Sign in to save it across devices. Practice inside NurseQuiz follows your account’s usage limits.']
  ];
  const a2 = page.cluster === 'HESI A2';
  return [
    [a2 ? 'Is HESI A2 the same as a nursing HESI exam?' : 'Are these official exam questions?', a2 ? 'No. HESI A2 is admission preparation. Nursing HESI assessments relate to nursing-program coursework. This page focuses on admission skills.' : 'No. These are original NurseQuiz learning questions, not recalled exam items or official NCSBN or Elsevier questions.'],
    [a2 ? 'Which sections should I review?' : 'What does my result tell me?', a2 ? 'Check the sections required by your target school. This starter covers math, anatomy and physiology, reading, and vocabulary; it is not the complete HESI A2 exam.' : 'Your result reports this sample only. Missed concepts are useful review prompts, not a validated readiness score or a prediction of passing.'],
    ['Can I try this without signing up?', 'Yes. Review explanations and your result before deciding whether to continue in NurseQuiz. An account is only needed to save across devices or continue with personalized in-app practice.'],
    ['What happens after I finish?', 'You can continue with questions you have not seen yet, retry missed items, review the explanations, or continue with your chosen topic in NurseQuiz. Repeats help learning but do not count as new evidence of readiness.']
  ];
}
