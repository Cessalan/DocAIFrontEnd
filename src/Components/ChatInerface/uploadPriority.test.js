import { rankUploadTopics } from './uploadPriority';

const insight = (topic, points, extra = {}) => ({
  topic,
  insight: `About ${topic}`,
  key_points: Array.from({ length: points }, (_, i) => `point ${i}`),
  context: 'clinical',
  ...extra,
});

describe('rankUploadTopics', () => {
  it('returns nothing to render when the upload produced no topics', () => {
    const result = rankUploadTopics({ topics: [], insights: [] });
    expect(result.topics).toEqual([]);
    expect(result.top).toBeNull();
    expect(result.hasEvidence).toBe(false);
  });

  it('deduplicates and trims the topic labels it is handed', () => {
    const result = rankUploadTopics({
      topics: ['Sepsis', ' Sepsis ', '', null, 'Triage'],
      insights: [],
    });
    expect(result.topics.map(t => t.topic)).toEqual(['Sepsis', 'Triage']);
  });

  it('caps the list at `max`', () => {
    const topics = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const result = rankUploadTopics({ topics, insights: [], max: 4 });
    expect(result.topics).toHaveLength(4);
  });

  /* ────────────────────────────────────────────────────────────────
     The common case in production: the backend sent no insights, so
     there is no coverage to rank on. 118 of 119 persisted
     plan_onboarding messages looked like this.
     ──────────────────────────────────────────────────────────────── */
  describe('with no coverage from the document', () => {
    const noEvidence = () => rankUploadTopics({
      topics: ['Post-Myocardial Infarction Complications', 'Acute Coronary Syndrome', 'Charting'],
      insights: [],
    });

    it('reports that it has no evidence', () => {
      expect(noEvidence().hasEvidence).toBe(false);
    });

    it('assigns no band and no reason', () => {
      noEvidence().topics.forEach((t) => {
        expect(t.band).toBeNull();
        expect(t.reason).toBeNull();
      });
    });

    it('keeps the extractor order rather than inventing one', () => {
      // Alphabetical would put "Acute Coronary Syndrome" first and look like
      // a judgement. There is none to make.
      expect(noEvidence().topics.map(t => t.topic)).toEqual([
        'Post-Myocardial Infarction Complications',
        'Acute Coronary Syndrome',
        'Charting',
      ]);
    });

    it('still offers a head of the list for the lesson that follows', () => {
      expect(noEvidence().top.topic).toBe('Post-Myocardial Infarction Complications');
    });

    it('counts nothing into the bands', () => {
      expect(noEvidence().counts).toEqual({ high: 0, review: 0, foundation: 0 });
    });
  });

  /* ────────────────────────────────────────────────────────────────
     REGRESSION — the NCLEX risk table, removed 2026-09-06.

     A hard-coded word list ('myocardial', 'insulin', 'airway', …) added 2
     to a topic's score and rendered "Commonly missed on the NCLEX". We
     have no NCLEX item analysis; the line asserted a fact about national
     exam performance from a substring match on a label. Because coverage
     is empty in production, that table WAS the whole ranking.
     ──────────────────────────────────────────────────────────────── */
  describe('no NCLEX risk table', () => {
    it('does not promote a topic for containing a scary word', () => {
      const result = rankUploadTopics({
        topics: ['Hospital History', 'Insulin Administration'],
        insights: [],
      });
      expect(result.top.topic).toBe('Hospital History');
      expect(result.hasEvidence).toBe(false);
    });

    it('never emits a reason claiming anything about the NCLEX', () => {
      const result = rankUploadTopics({
        topics: ['Post-Myocardial Infarction Complications and Management'],
        insights: [insight('Post-Myocardial Infarction Complications and Management', 2)],
      });
      expect(result.top.reason.key).toBe('uploadInsights.reasonCoverage');
    });

    it('orders identically whether or not labels contain risk words', () => {
      // Same coverage, different vocabulary: the wording must not move them.
      const scary = rankUploadTopics({
        topics: ['Cardiac Arrest', 'Charting'],
        insights: [insight('Cardiac Arrest', 2), insight('Charting', 2)],
      });
      const bland = rankUploadTopics({
        topics: ['Aardvark Care', 'Charting'],
        insights: [insight('Aardvark Care', 2), insight('Charting', 2)],
      });
      expect(scary.topics.map(t => t.score)).toEqual(bland.topics.map(t => t.score));
    });
  });

  /* ────────────────────────────────────────────────────────────────
     REGRESSION — stored past scores, removed 2026-09-06.

     findMatchingTopicKey paired "Acute Coronary Syndrome" with the bucket
     "Definition and Characteristics of Acute Respiratory Distress Syndrome
     (ARDS)" on the shared words "acute" and "syndrome" (2 >= min(3,8)*0.5)
     and told the student she had averaged 56% on cardiology.

     rankUploadTopics no longer takes a performance argument. These pass one
     anyway: reinstating the parameter fails them.
     ──────────────────────────────────────────────────────────────── */
  describe('no past-score signal', () => {
    const ARDS = {
      'Definition and Characteristics of Acute Respiratory Distress Syndrome (ARDS)':
        { correct: 14, total: 25 },
    };

    it('does not put an ARDS score on Acute Coronary Syndrome', () => {
      const result = rankUploadTopics({
        topics: ['Acute Coronary Syndrome'],
        insights: [insight('Acute Coronary Syndrome', 2)],
        performance: ARDS,
      });
      expect(result.top.reason.vars.percent).toBeUndefined();
      expect(result.top.percent).toBeUndefined();
    });

    it('ranks identically whether or not a performance map is passed', () => {
      const args = {
        topics: ['Acute Coronary Syndrome', 'Management of STEMI'],
        insights: [insight('Management of STEMI', 4), insight('Acute Coronary Syndrome', 1)],
      };
      const withHistory = rankUploadTopics({
        ...args,
        performance: { ...ARDS, 'collection or management': { correct: 7, total: 10 } },
      });
      expect(withHistory).toEqual(rankUploadTopics(args));
    });
  });

  /* ────────────────────────────────────────────────────────────────
     When the extractor DOES return coverage, the card earns its ranking.
     ──────────────────────────────────────────────────────────────── */
  describe('with coverage from the document', () => {
    it('ranks the topic her notes go deepest on first', () => {
      const result = rankUploadTopics({
        topics: ['Cardiac Assessment', 'Documentation'],
        insights: [insight('Cardiac Assessment', 1), insight('Documentation', 5)],
      });
      expect(result.hasEvidence).toBe(true);
      expect(result.top.topic).toBe('Documentation');
      expect(result.top.reason.key).toBe('uploadInsights.reasonHeavyCoverage');
      expect(result.top.reason.vars.count).toBe(5);
    });

    it('counts a topic that spans two files above one that does not', () => {
      const result = rankUploadTopics({
        topics: ['Cardiac Assessment', 'Documentation'],
        insights: [
          insight('Cardiac Assessment', 4),
          insight('Documentation', 3),
          insight('Documentation', 2), // second file covers it too
        ],
      });
      expect(result.top.topic).toBe('Documentation');
      expect(result.top.reason.key).toBe('uploadInsights.reasonMultiFile');
      expect(result.top.reason.vars.count).toBe(2);
    });

    it('gives an uncovered topic the claim-free line, not an invented one', () => {
      const result = rankUploadTopics({
        topics: ['Sepsis', 'Charting'],
        insights: [insight('Sepsis', 3)],
      });
      const charting = result.topics.find(t => t.topic === 'Charting');
      expect(charting.reason.key).toBe('uploadInsights.reasonPresent');
      expect(charting.reason.vars).toEqual({});
    });

    it('never marks more than two topics as "start here"', () => {
      // Three red flags is not a priority list, it is a wall.
      const topics = Array.from({ length: 8 }, (_, i) => `Topic ${i}`);
      const result = rankUploadTopics({
        topics,
        insights: topics.map(t => insight(t, 3)),
        max: 8,
      });
      expect(result.counts.high).toBeLessThanOrEqual(2);
      expect(result.counts.high + result.counts.review + result.counts.foundation)
        .toBe(result.topics.length);
    });

    it('carries the teaching points through for the lesson that follows', () => {
      const result = rankUploadTopics({
        topics: ['Sepsis'],
        insights: [insight('Sepsis', 3)],
      });
      expect(result.top.keyPoints).toHaveLength(3);
      expect(result.top.insight).toBe('About Sepsis');
    });
  });

  describe('reasons', () => {
    it('every reason is a countable fact, never an assertion', () => {
      const result = rankUploadTopics({
        topics: ['Sepsis', 'Charting', 'Triage'],
        insights: [insight('Sepsis', 5), insight('Charting', 2)],
      });
      result.topics.forEach((topic) => {
        // Only coverage-derived keys survive.
        expect([
          'uploadInsights.reasonMultiFile',
          'uploadInsights.reasonHeavyCoverage',
          'uploadInsights.reasonCoverage',
          'uploadInsights.reasonPresent',
        ]).toContain(topic.reason.key);
      });
    });
  });

  it('is stable — the same upload ranks the same way twice', () => {
    const args = {
      topics: ['Heart Failure', 'Charting', 'Sepsis', 'Ethics'],
      insights: [insight('Sepsis', 2)],
    };
    expect(rankUploadTopics(args)).toEqual(rankUploadTopics(args));
  });
});
