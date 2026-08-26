/**
 * firstBlock — cuts a generated study path down to a first block the student
 * can actually finish, and keeps the rest on the shelf.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Measured over 26 Jul – 9 Aug 2026 (135 study sessions):
 *
 *   - the median plan is 15 nodes; the median student finishes 4
 *   - NOT ONE of the 108 plans longer than 14 nodes was ever completed
 *   - plans of 8 nodes or fewer completed at 25%
 *   - 80.7% of study sessions happen on a single day
 *
 * Against that same behaviour, a 6-node plan would have been finished by 37.8%
 * of sessions instead of 2.2%. Same students, same effort — the only thing that
 * changes is whether there is an ending in reach.
 *
 * WHAT THIS IS NOT
 * ────────────────
 * It is not a retention fix. Day-1 depth does not predict whether a student
 * comes back (flat at 27–44% across 1 to 10+ nodes on day one), so shrinking
 * the plan buys a completion moment and an upgrade trigger, not a second visit.
 * Day-2 return needs its own mechanism.
 *
 * DESIGN RULE: SPLIT, DON'T REGENERATE
 * ────────────────────────────────────
 * The backend still plans the whole path in one call. We persist the first
 * block as the live plan and park the remainder in `study.reserve`, so
 * "extend" is instant, costs no generation, and charges no quota. The student
 * never loses the plan they were given — they just aren't shown all of it at
 * once.
 */

import { estimateMinutes } from './planFormatting';

/** Nodes in the block a student is asked to commit to up front. */
export const FIRST_BLOCK_SIZE = 6;

/** Section banners are headers, not work — they never count toward the block. */
export const isRealNode = (node) => !!node && node.type !== 'section_banner';

/** How many actual learning nodes are in a list. */
export const countRealNodes = (nodes = []) => nodes.filter(isRealNode).length;

/**
 * Split a path into the first block and everything held back.
 *
 * Banners ride along with the nodes they introduce: we walk the list in order
 * and stop once the block holds `size` real nodes, so a header never gets
 * separated from its section.
 *
 * @param {Array} nodes  The full node list from the planner.
 * @param {number} [size]
 * @returns {{ block: Array, reserve: Array, blockCount: number, reserveCount: number }}
 */
export const splitFirstBlock = (nodes = [], size = FIRST_BLOCK_SIZE) => {
  const list = Array.isArray(nodes) ? nodes : [];
  const limit = Math.max(1, size);

  const block = [];
  let taken = 0;
  let i = 0;

  for (; i < list.length; i++) {
    if (taken >= limit) break;
    const node = list[i];
    block.push(node);
    if (isRealNode(node)) taken++;
  }

  // A banner at the tail of the block introduces a section that didn't make
  // the cut — hand it back so it heads its own nodes when the plan extends.
  while (block.length && !isRealNode(block[block.length - 1])) {
    block.pop();
    i--;
  }

  const reserve = list.slice(i);

  return {
    block,
    reserve,
    blockCount: countRealNodes(block),
    reserveCount: countRealNodes(reserve)
  };
};

/**
 * Everything the session needs to persist a capped plan.
 *
 * `estimatedMinutes` is recomputed from the block — quoting the whole plan's
 * time against six nodes would reintroduce exactly the commitment we removed.
 *
 * @param {Object} pathResult  The planner's response.
 * @param {number} [size]
 */
export const buildFirstBlock = (pathResult, size = FIRST_BLOCK_SIZE) => {
  const all = (pathResult && Array.isArray(pathResult.nodes)) ? pathResult.nodes : [];
  const { block, reserve, blockCount, reserveCount } = splitFirstBlock(all, size);

  return {
    block,
    reserve,
    blockCount,
    reserveCount,
    /** True when the planner gave us more than one block's worth. */
    hasReserve: reserveCount > 0,
    /** Real-node total of the whole generated path, for "6 of 17" style copy. */
    plannedTotal: countRealNodes(all),
    estimatedMinutes: estimateMinutes(block.filter(isRealNode))
  };
};

/**
 * Move the next block off the shelf. Returns the new node list and what's left.
 * Pure — the caller decides what to persist.
 *
 * @param {Array} nodes    The live path's nodes.
 * @param {Array} reserve  Nodes held back.
 * @param {number} [size]
 */
export const extendWithReserve = (nodes = [], reserve = [], size = FIRST_BLOCK_SIZE) => {
  const { block: next, reserve: rest } = splitFirstBlock(reserve, size);

  return {
    nodes: [...nodes, ...next],
    reserve: rest,
    addedCount: countRealNodes(next),
    reserveCount: countRealNodes(rest)
  };
};
