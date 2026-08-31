import { collectCovered, wasSkipped, COVERED_CAP, MINDMAP_SKIM_RATIO } from './lightReadout';

/* What these protect: the note on an unscored node claims to know what she
   just studied. Every test here is a way that claim could be generously
   wrong — crediting her with concepts she never reached — which is the one
   failure that makes the whole feature read as automated flattery. */

describe('collectCovered — lessons', () => {
  it('uses page titles for a multi-page lesson, one concept per page', () => {
    const covered = collectCovered({
      node: { type: 'lesson', label: 'Cardiac Output' },
      content: {
        title: 'Cardiac Output',
        pages: [
          { title: 'Preload', content: '…' },
          { title: 'Afterload', content: '…' },
          { title: 'Contractility', content: '…' },
        ],
      },
    });
    expect(covered).toEqual(['Preload', 'Afterload', 'Contractility']);
  });

  it('falls back to keyPoints for the legacy lesson shape', () => {
    const covered = collectCovered({
      node: { type: 'lesson', label: 'Insulin' },
      content: { title: 'Insulin', body: '…', keyPoints: ['Onset times', 'Peak windows'] },
    });
    expect(covered).toEqual(['Onset times', 'Peak windows']);
  });

  it('falls back to the title when a streaming lesson has untitled pages', () => {
    // Pages arrive one at a time and an early one can be title-less. Sending
    // [] would tell the backend we don't know what the lesson was about, when
    // in fact we do.
    const covered = collectCovered({
      node: { type: 'lesson', label: 'Shock' },
      content: { title: 'Types of Shock', pages: [{ content: '…' }, { content: '…' }] },
    });
    expect(covered).toEqual(['Types of Shock', 'Shock']);
  });

  it('survives missing content entirely', () => {
    expect(collectCovered({ node: { type: 'lesson', label: 'Sepsis' }, content: null }))
      .toEqual(['Sepsis']);
  });
});

describe('collectCovered — concept maps', () => {
  const nodes = [
    { id: 'a', label: 'Preload' },
    { id: 'b', label: 'Afterload' },
    { id: 'c', label: 'Contractility' },
    { id: 'd', label: 'Ejection fraction' },
  ];

  it('reports only the nodes she actually opened', () => {
    const covered = collectCovered({
      node: { type: 'mindmap', label: 'Cardiac Output' },
      content: { nodes },
      mindmapProgress: { visitedNodeIds: ['a', 'b'], totalNodes: 4 },
    });
    // NOT Contractility or Ejection fraction — she never reached them.
    expect(covered).toEqual(['Preload', 'Afterload']);
  });

  it('reads nodes nested under mindmapData too', () => {
    const covered = collectCovered({
      node: { type: 'mindmap', label: 'Cardiac Output' },
      content: { mindmapData: { nodes } },
      mindmapProgress: { visitedNodeIds: ['c'], totalNodes: 4 },
    });
    expect(covered).toEqual(['Contractility']);
  });

  it('falls back to the topic when ids cannot be resolved to labels', () => {
    const covered = collectCovered({
      node: { type: 'mindmap', label: 'Cardiac Output' },
      content: { nodes: [] },
      mindmapProgress: { visitedNodeIds: ['a', 'b'], totalNodes: 4 },
    });
    expect(covered).toEqual(['Cardiac Output']);
  });

  it('does not invent coverage when she visited nothing', () => {
    const covered = collectCovered({
      node: { type: 'mindmap', label: 'Cardiac Output' },
      content: { nodes },
      mindmapProgress: { visitedNodeIds: [], totalNodes: 4 },
    });
    expect(covered).toEqual(['Cardiac Output']);
  });
});

describe('collectCovered — audio and shaping', () => {
  it('prefers the audio topic over the node label', () => {
    expect(collectCovered({
      node: { type: 'audio', label: 'Node 3' },
      content: { topic: 'Beta blockers in heart failure' },
    })).toEqual(['Beta blockers in heart failure', 'Node 3']);
  });

  it('dedupes case-insensitively', () => {
    expect(collectCovered({
      node: { type: 'lesson', label: 'ABG' },
      content: { keyPoints: ['Respiratory acidosis', 'RESPIRATORY ACIDOSIS'] },
    })).toEqual(['Respiratory acidosis']);
  });

  it('caps the list', () => {
    const covered = collectCovered({
      node: { type: 'lesson', label: 'Everything' },
      content: { keyPoints: Array.from({ length: 20 }, (_, i) => `Point ${i}`) },
    });
    expect(covered).toHaveLength(COVERED_CAP);
  });

  it('truncates a page title long enough to be prose', () => {
    const long = 'x'.repeat(400);
    const [only] = collectCovered({
      node: { type: 'lesson', label: 'L' },
      content: { keyPoints: [long] },
    });
    expect(only.length).toBeLessThanOrEqual(120);
  });
});

describe('wasSkipped', () => {
  it('trusts the audio skip flag', () => {
    expect(wasSkipped({ node: { type: 'audio' }, audioSkipped: true })).toBe(true);
    expect(wasSkipped({ node: { type: 'audio' }, audioSkipped: false })).toBe(false);
  });

  it('treats a barely-opened concept map as skipped', () => {
    expect(wasSkipped({
      node: { type: 'mindmap' },
      mindmapProgress: { visitedNodeIds: ['a'], totalNodes: 12 },
    })).toBe(true);
  });

  it('does not treat normal partial browsing as a skip', () => {
    // Leaving a map before the last node is ordinary, not an opt-out.
    expect(wasSkipped({
      node: { type: 'mindmap' },
      mindmapProgress: { visitedNodeIds: ['a', 'b', 'c', 'd', 'e'], totalNodes: 12 },
    })).toBe(false);
  });

  it('is not a skip when the map size is unknown', () => {
    expect(wasSkipped({
      node: { type: 'mindmap' },
      mindmapProgress: { visitedNodeIds: [], totalNodes: 0 },
    })).toBe(false);
  });

  it('holds the threshold the copy depends on', () => {
    expect(MINDMAP_SKIM_RATIO).toBe(0.25);
  });

  it('a lesson is never a skip — finishing it is the only way to leave', () => {
    expect(wasSkipped({ node: { type: 'lesson' } })).toBe(false);
  });
});
