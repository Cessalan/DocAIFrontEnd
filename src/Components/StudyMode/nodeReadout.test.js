import { buildNodeReadout, detectImprovement, isPatternEstablished, DRILL_QUESTIONS } from './nodeReadout';

/* Stand-in for i18next's `t`. Mirrors the two call shapes the app uses:
   t(key, 'Default') and t(key, { vars, defaultValue }). Interpolates so the
   assertions below read against real sentences, not keys. */
const t = (key, arg) => {
  if (typeof arg === 'string') return arg;
  if (arg && typeof arg === 'object') {
    let out = arg.defaultValue != null ? String(arg.defaultValue) : key;
    Object.entries(arg).forEach(([k, v]) => {
      if (k === 'defaultValue') return;
      out = out.replace(new RegExp('{{' + k + '}}', 'g'), String(v));
    });
    return out;
  }
  return key;
};

const quizResult = (correct, total, extra = {}) => ({
  scored: true,
  type: 'quiz',
  total,
  correct,
  incorrect: total - correct,
  scorePercent: Math.round((correct / total) * 100),
  missedQuestions: [],
  topic: 'ABCDE Emergency Patient Assessment',
  ...extra,
});

const readout = (over = {}) => buildNodeReadout({
  result: quizResult(4, 5),
  bucket: 'solid',
  debrief: null,
  experimentConfirmed: false,
  nextNode: { type: 'quiz', label: 'Airway management' },
  priorPerformance: null,
  canTestTheory: true,
  node: { id: 'node-1', type: 'quiz' },
  estimateMinutes: () => 4,
  t,
  ...over,
});

const patternDebrief = (evidenceCount, skill = 'prioritization') => ({
  hasPattern: true,
  noticed: "You're stronger on this content than your score suggests.",
  evidence: Array.from({ length: evidenceCount }, (_, i) => 'evidence ' + i),
  pattern: 'You identify the right problem but act before ordering.',
  skill,
});

describe('detectImprovement', () => {
  const prior = (total, correct) => ({
    topics: { 'ABCDE Emergency Patient Assessment': { questionsTotal: total, questionsCorrect: correct } },
  });

  it('claims improvement on a real jump off a real baseline', () => {
    expect(detectImprovement(quizResult(5, 5), prior(10, 5))).toEqual({
      priorPct: 50,
      nowPct: 100,
      priorTotal: 10,
    });
  });

  it('refuses to claim improvement off a thin baseline', () => {
    expect(detectImprovement(quizResult(5, 5), prior(3, 1))).toBeNull();
  });

  it('refuses when the jump is inside the noise band', () => {
    expect(detectImprovement(quizResult(4, 5), prior(10, 7))).toBeNull();
  });

  it('refuses when this node was not actually good', () => {
    expect(detectImprovement(quizResult(3, 5), prior(10, 2))).toBeNull();
  });

  it('survives a missing or empty snapshot', () => {
    expect(detectImprovement(quizResult(5, 5), null)).toBeNull();
    expect(detectImprovement(quizResult(5, 5), { topics: {} })).toBeNull();
  });

  it('matches the topic loosely, the way performance writes do', () => {
    const loose = { topics: { 'ABCDE Emergency Assessment': { questionsTotal: 12, questionsCorrect: 6 } } };
    expect(detectImprovement(quizResult(5, 5), loose)).not.toBeNull();
  });
});

describe('headline', () => {
  it('leads with the discovery when there is a pattern', () => {
    expect(readout({ debrief: patternDebrief(3) }).headline).toBe('I found something interesting.');
  });

  it('leads with the proof after the experiment lands', () => {
    const r = readout({ experimentConfirmed: true, debrief: { hasPattern: false, stillLooking: '' } });
    expect(r.tone).toBe('confirmed');
    expect(r.headline).toBe('You just proved it.');
  });

  it('names the improvement when there is measured improvement', () => {
    const r = readout({
      result: quizResult(5, 5),
      bucket: 'mastered',
      priorPerformance: { topics: { 'ABCDE Emergency Patient Assessment': { questionsTotal: 10, questionsCorrect: 5 } } },
    });
    expect(r.tone).toBe('improving');
    expect(r.headline).toContain('getting better at');
    expect(r.caption).toBe('Up from 50% on this topic before today.');
  });

  it('does not reuse one headline for every score', () => {
    const headlines = ['mastered', 'solid', 'gaps', 'tough'].map(
      (bucket) => readout({ bucket }).headline
    );
    expect(new Set(headlines).size).toBe(4);
  });
});

describe('recommendation', () => {
  it('tests the theory while the pattern is still thin', () => {
    const rec = readout({ debrief: patternDebrief(2) }).recommendation;
    expect(rec.kind).toBe('test');
    expect(rec.cta).toBe('Test my theory →');
    expect(rec.testSkill).toBe('prioritization');
    expect(rec.node).toBeNull();
  });

  it('fixes the pattern once the evidence corroborates it', () => {
    const rec = readout({ debrief: patternDebrief(3) }).recommendation;
    expect(rec.kind).toBe('fix');
    expect(rec.cta).toBe('Fix this →');
    expect(rec.title).toBe(DRILL_QUESTIONS + ' prioritization questions');
  });

  it('builds the drill in the format the insight named', () => {
    const priority = readout({ debrief: patternDebrief(3, 'prioritization') }).recommendation;
    expect(priority.node.type).toBe('exam');
    expect(priority.node.examConfig.questionTypes).toEqual(['casestudy']);
    expect(priority.node.examConfig.questionCount).toBe(DRILL_QUESTIONS);

    const sata = readout({ debrief: patternDebrief(3, 'select-all-that-apply') }).recommendation;
    expect(sata.node.examConfig.questionTypes).toEqual(['sata']);
  });

  it('falls back to testing when the container cannot run the experiment', () => {
    const rec = readout({ debrief: patternDebrief(2), canTestTheory: false }).recommendation;
    expect(rec.kind).toBe('fix');
  });

  it('re-teaches instead of retesting when she is under water', () => {
    const rec = readout({ result: quizResult(1, 5), bucket: 'tough' }).recommendation;
    expect(rec.kind).toBe('walkthrough');
    expect(rec.node.type).toBe('lesson');
  });

  it('targets the missed concepts when there are gaps but no pattern', () => {
    const rec = readout({
      result: quizResult(2, 5, { missedQuestions: ['Which action first?', 'What is the priority?'] }),
      bucket: 'gaps',
    }).recommendation;
    expect(rec.kind).toBe('fix');
    expect(rec.node.examConfig.customInstructions).toContain('Which action first?');
  });

  it('escalates a clean run into a scenario rather than repeating it', () => {
    const rec = readout({ result: quizResult(5, 5), bucket: 'mastered' }).recommendation;
    expect(rec.kind).toBe('harder');
    expect(rec.cta).toBe('Challenge me →');
    expect(rec.node.examConfig.questionTypes).toEqual(['casestudy']);
  });

  it('continues the plan when nothing warrants a detour', () => {
    const rec = readout().recommendation;
    expect(rec.kind).toBe('continue');
    expect(rec.node).toBeNull();
    expect(rec.title).toBe('Airway management');
  });

  it('never dead-ends when the plan has nothing queued', () => {
    const rec = readout({ nextNode: null }).recommendation;
    expect(rec.node).not.toBeNull();
    expect(rec.cta).not.toBe('Keep building →');
  });

  it('gives every state a CTA that says what it will do', () => {
    const ctas = [
      readout({ debrief: patternDebrief(2) }),
      readout({ debrief: patternDebrief(3) }),
      readout({ result: quizResult(1, 5), bucket: 'tough' }),
      readout({ result: quizResult(5, 5), bucket: 'mastered' }),
      readout(),
    ].map((r) => r.recommendation.cta);
    expect(new Set(ctas).size).toBe(ctas.length);
  });
});

describe('isPatternEstablished', () => {
  it('is false without a pattern at all', () => {
    expect(isPatternEstablished({ hasPattern: false, evidence: [] })).toBe(false);
    expect(isPatternEstablished(null)).toBe(false);
  });

  it('needs the corroborating third evidence line', () => {
    expect(isPatternEstablished(patternDebrief(2))).toBe(false);
    expect(isPatternEstablished(patternDebrief(3))).toBe(true);
  });
});
