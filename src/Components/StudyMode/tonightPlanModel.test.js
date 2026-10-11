import {
  KIND, OUTCOME, ROLE, isTonightPlan, isTonightByDays, checkEvidence, examEvidence, tally, pickTarget,
  initTonight, startRound, currentRound, completeRound, outcomeOf, isComparable, roundNodes, tonightRole,
  MAX_ATTEMPTS,
} from './tonightPlanModel';

const t = (key, opts) => (opts ? `${key} ${JSON.stringify(opts)}` : key);

// The pattern almost every payer shows: content fine, select-all and who-first not.
const answer = (format, correct, topic = 'Cardiac meds', kind = null) => ({ format, kind, topic, correct });
const CHECK = [
  answer('mcq', true), answer('mcq', true), answer('mcq', true, 'Heart failure'),
  answer('sata', false), answer('sata', false, 'Heart failure'), answer('sata', true),
  answer('mcq', false, 'Heart failure', 'prioritization'), answer('mcq', true, 'Cardiac meds', 'prioritization'),
];
const fresh = () => initTonight(CHECK);
const exam = (...results) => Object.fromEntries(results.map(([questionType, isCorrect], i) => [i, { questionType, isCorrect }]));

describe('which plans are tonight plans', () => {
  it('is the sprint plan, by archetype or by days', () => {
    expect(isTonightPlan({ archetype: 'sprint' })).toBe(true);
    expect(isTonightPlan({ archetype: 'focus' })).toBe(false);
    expect([0, 1, 2, 3, null].map(isTonightByDays)).toEqual([true, true, true, false, false]);
  });
});

describe('evidence', () => {
  it('reads prioritization from the check by kind, not by its single-answer format', () => {
    const ev = checkEvidence(CHECK);
    expect(tally(ev, (e) => e.skill === 'priority')).toEqual({ correct: 1, total: 2 });
    expect(tally(ev, (e) => e.skill === 'sata')).toEqual({ correct: 1, total: 3 });
  });
  it('skips "not sure" answers rather than counting them wrong', () => {
    expect(checkEvidence([{ format: 'sata', correct: false, unsure: true }])).toEqual([]);
  });
  it('reads ordering questions in exam steps as prioritization', () => {
    expect(examEvidence(exam(['casestudy', true], ['sata', false]), 'X').map((e) => e.skill)).toEqual(['priority', 'sata']);
  });
});

describe('choosing the round', () => {
  it('with no check, the first round finds out', () => {
    expect(pickTarget(initTonight([])).kind).toBe(KIND.FIND);
  });
  it('starts on the weakest TEACHABLE skill, aimed at the topic she misses it on', () => {
    const target = pickTarget(fresh());
    expect(target).toMatchObject({ kind: KIND.SKILL, skill: 'sata', attempt: 1 });
    expect(['Cardiac meds', 'Heart failure']).toContain(target.topic);
  });
  it('freezes "before" at the start of the round', () => {
    expect(currentRound(startRound(fresh())).before).toEqual({ correct: 1, total: 3 });
  });
  it('a fixed skill moves on to the next weakest', () => {
    let tn = startRound(fresh());
    tn = completeRound(tn, examEvidence(exam(['sata', true], ['sata', true], ['sata', true], ['sata', true], ['sata', false])));
    expect(tn.rounds[0].outcome).toBe(OUTCOME.FIXED);
    expect(pickTarget(tn)).toMatchObject({ kind: KIND.SKILL, skill: 'priority' });
  });
  it('a round that did not land comes back once, easier, then is left for the morning', () => {
    let tn = startRound(fresh());
    tn = completeRound(tn, examEvidence(exam(['sata', false], ['sata', false], ['sata', true], ['sata', false], ['sata', false])));
    expect(tn.rounds[0].outcome).toBe(OUTCOME.NOT_YET);
    const again = pickTarget(tn);
    expect(again).toMatchObject({ kind: KIND.SKILL, skill: 'sata', attempt: 2, easier: true });
    tn = completeRound(startRound(tn, again), examEvidence(exam(['sata', false], ['sata', false], ['sata', false])));
    expect(tn.rounds).toHaveLength(MAX_ATTEMPTS);
    expect(pickTarget(tn).skill).not.toBe('sata');
  });
  it('then weak topics, then mixed review that never runs dry and gets harder', () => {
    const allGood = initTonight([answer('mcq', false, 'ABGs'), answer('mcq', false, 'ABGs'), answer('sata', true), answer('sata', true)]);
    const topic = pickTarget(allGood);
    expect(topic).toEqual({ kind: KIND.TOPIC, topic: 'ABGs', attempt: 1 });
    let tn = completeRound(startRound(allGood, topic), examEvidence(exam(['mcq', true], ['mcq', true], ['sata', true]), 'ABGs'));
    expect(pickTarget(tn)).toMatchObject({ kind: KIND.MIXED, level: 1 });
    tn = completeRound(startRound(tn), examEvidence(exam(['mcq', true], ['sata', true], ['mcq', true])));
    expect(pickTarget(tn)).toMatchObject({ kind: KIND.MIXED, level: 2 });
  });
});

describe('honest outcomes', () => {
  it('"fixed" needs a strong re-check, not just a better one', () => {
    expect(outcomeOf({ correct: 0, total: 3 }, { correct: 2, total: 5 })).toBe(OUTCOME.BETTER);
    expect(outcomeOf({ correct: 0, total: 3 }, { correct: 4, total: 5 })).toBe(OUTCOME.FIXED);
  });
  it('makes no claim from too few answers', () => {
    expect(outcomeOf({ correct: 0, total: 3 }, { correct: 2, total: 2 })).toBe(OUTCOME.TOO_FEW);
  });
  it('only compares when both sides have answers', () => {
    expect(isComparable({ before: { correct: 0, total: 1 }, after: { correct: 4, total: 5 } })).toBe(false);
    expect(isComparable({ before: { correct: 1, total: 3 }, after: { correct: 4, total: 5 } })).toBe(true);
  });
  it('the taught fix step feeds the evidence but never the result', () => {
    let tn = startRound(fresh());
    const fix = examEvidence(exam(['sata', true], ['sata', true], ['sata', true], ['sata', true], ['sata', true]));
    tn = completeRound(tn, examEvidence(exam(['sata', false], ['sata', false], ['sata', true])), fix);
    expect(tn.rounds[0].after).toEqual({ correct: 1, total: 3 });
    expect(tn.evidence.length).toBe(CHECK.length + 8);
  });
});

describe('round steps', () => {
  it('a skill round is a taught fix step then a check, both forcing the format', () => {
    const round = currentRound(startRound(fresh()));
    const nodes = roundNodes(round, t);
    expect(nodes.map((n) => tonightRole(n))).toEqual([{ role: ROLE.FIX, round: 1 }, { role: ROLE.CHECK, round: 1 }]);
    expect(nodes.every((n) => n.type === 'exam' && n.examConfig.questionTypes[0] === 'sata')).toBe(true);
    expect(nodes[1].examConfig.customInstructions).toMatch(/Brand-new questions/);
  });
  it('who-first rounds are ordering questions, which carry the walkthrough', () => {
    const nodes = roundNodes({ n: 2, kind: KIND.SKILL, skill: 'priority', attempt: 1 }, t);
    expect(nodes[0].examConfig.questionTypes).toEqual(['casestudy']);
  });
  it('a topic round teaches with a lesson, then checks', () => {
    expect(roundNodes({ n: 3, kind: KIND.TOPIC, topic: 'ABGs' }, t).map((n) => n.type)).toEqual(['lesson', 'exam']);
  });
  it('other nodes are not tonight nodes', () => {
    expect(tonightRole({ tags: ['weak_area'] })).toBeNull();
  });
});
