import {
  splitFirstBlock,
  buildFirstBlock,
  extendWithReserve,
  countRealNodes,
  FIRST_BLOCK_SIZE
} from './firstBlock';

const node = (id, type = 'quiz') => ({ id, type, label: `Node ${id}` });
const banner = (id) => ({ id, type: 'section_banner', label: `Section ${id}` });

/** A 17-node plan shaped like the ones the planner actually returns. */
const fullPath = () => ({
  nodes: [
    banner('b1'),
    node('n1', 'quiz'), node('n2', 'lesson'), node('n3', 'quiz'),
    banner('b2'),
    node('n4', 'lesson'), node('n5', 'quiz'), node('n6', 'flashcard'),
    banner('b3'),
    node('n7', 'quiz'), node('n8', 'lesson'), node('n9', 'audio'),
    node('n10', 'quiz'), node('n11', 'lesson'), node('n12', 'exam')
  ],
  total_nodes: 12,
  estimated_time_minutes: 58,
  topics: ['Heart failure', 'Dysrhythmias']
});

describe('splitFirstBlock', () => {
  test('takes six real nodes and leaves the rest', () => {
    const { block, reserve, blockCount, reserveCount } = splitFirstBlock(fullPath().nodes);

    expect(blockCount).toBe(6);
    expect(reserveCount).toBe(6);
    expect(block.map((n) => n.id)).toEqual(['b1', 'n1', 'n2', 'n3', 'b2', 'n4', 'n5', 'n6']);
    expect(reserve[0].id).toBe('b3');
  });

  test('banners do not count as work', () => {
    const { block } = splitFirstBlock(fullPath().nodes);
    expect(block.filter((n) => n.type === 'section_banner')).toHaveLength(2);
    expect(countRealNodes(block)).toBe(6);
  });

  test('a trailing banner goes back to the reserve so it keeps its section', () => {
    // Exactly 3 real nodes then a banner: the banner heads nodes we're not taking.
    const nodes = [node('n1'), node('n2'), node('n3'), banner('b2'), node('n4')];
    const { block, reserve } = splitFirstBlock(nodes, 3);

    expect(block.map((n) => n.id)).toEqual(['n1', 'n2', 'n3']);
    expect(reserve.map((n) => n.id)).toEqual(['b2', 'n4']);
  });

  test('a short plan is left whole', () => {
    const nodes = [node('n1'), node('n2'), node('n3')];
    const { block, reserve, reserveCount } = splitFirstBlock(nodes);

    expect(block).toHaveLength(3);
    expect(reserve).toHaveLength(0);
    expect(reserveCount).toBe(0);
  });

  test('handles nothing gracefully', () => {
    expect(splitFirstBlock([]).block).toEqual([]);
    expect(splitFirstBlock(undefined).blockCount).toBe(0);
    expect(splitFirstBlock(null).reserve).toEqual([]);
  });

  test('never returns an empty block for a non-empty plan', () => {
    const { block } = splitFirstBlock([banner('b1'), node('n1')], 1);
    expect(countRealNodes(block)).toBe(1);
  });
});

describe('buildFirstBlock', () => {
  test('quotes the block, not the whole plan', () => {
    const path = fullPath();
    const built = buildFirstBlock(path);

    expect(built.blockCount).toBe(6);
    expect(built.plannedTotal).toBe(12);
    expect(built.hasReserve).toBe(true);
    // 6 nodes of 3-6 min each — must be far under the whole plan's 58.
    expect(built.estimatedMinutes).toBeGreaterThan(0);
    expect(built.estimatedMinutes).toBeLessThan(path.estimated_time_minutes);
  });

  test('a plan already short enough has no reserve', () => {
    const built = buildFirstBlock({ nodes: [node('n1'), node('n2')] });

    expect(built.hasReserve).toBe(false);
    expect(built.reserveCount).toBe(0);
    expect(built.blockCount).toBe(2);
  });

  test('survives a malformed planner response', () => {
    expect(buildFirstBlock(null).blockCount).toBe(0);
    expect(buildFirstBlock({}).block).toEqual([]);
    expect(buildFirstBlock({ nodes: 'nope' }).blockCount).toBe(0);
  });
});

describe('extendWithReserve', () => {
  test('moves the next block onto the live plan', () => {
    const { block, reserve } = splitFirstBlock(fullPath().nodes);
    const next = extendWithReserve(block, reserve);

    expect(next.addedCount).toBe(6);
    expect(countRealNodes(next.nodes)).toBe(12);
    expect(next.reserveCount).toBe(0);
    // Order is preserved end to end.
    expect(next.nodes.filter((n) => n.type !== 'section_banner').map((n) => n.id))
      .toEqual(['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10', 'n11', 'n12']);
  });

  test('extending an empty reserve is a no-op', () => {
    const nodes = [node('n1')];
    const next = extendWithReserve(nodes, []);

    expect(next.nodes).toEqual(nodes);
    expect(next.addedCount).toBe(0);
  });

  test('a long reserve extends one block at a time', () => {
    const many = Array.from({ length: 20 }, (_, i) => node(`x${i}`));
    const first = extendWithReserve([], many);

    expect(first.addedCount).toBe(FIRST_BLOCK_SIZE);
    expect(first.reserveCount).toBe(20 - FIRST_BLOCK_SIZE);
  });
});
