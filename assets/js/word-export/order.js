import { MAX_GROUP_DEPTH, cardGroups, groupTree } from '../graph/card-groups.js';
import { geometry, MIND } from '../graph/mind-map.js';
import { branchTree } from '../graph/radial-layout.js';

/**
 * @typedef {import('../graph/types.js').Project} Project
 * @typedef {import('../graph/types.js').Card} Card
 * @typedef {object} OutlineGroup
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {number} depth 1..MAX_GROUP_DEPTH
 * @property {string} bookmark
 * @property {string[]} cardIds cards placed directly in the group, in reading order
 * @property {OutlineGroup[]} children
 */

/** @param {Project} project @param {Card} card @param {'card' | 'mind'} view */
const position = (project, card, view) => geometry(project, card, view).position;

/** Reading order of cards by position: top to bottom, then left to right, then id. */
function byGeometry(project, cards, view) {
  return [...cards].sort((a, b) => {
    const pa = position(project, a, view),
      pb = position(project, b, view);
    return pa.y - pb.y || pa.x - pb.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}

/** Card ids reachable from the Mind Map root, parents before children. */
function branchOrder(project, rootId) {
  const { children } = branchTree(project);
  const result = [],
    seen = new Set();
  const visit = (id) => {
    if (seen.has(id)) return;
    seen.add(id);
    result.push(id);
    for (const child of children.get(id) || []) visit(child);
  };
  visit(rootId);
  return result;
}

/**
 * Reading rank of every card for the active view: Mind Map follows the branch tree from the root
 * (cards outside it come last); Note Board and a Mind Map without a root follow position.
 * @param {Project} project
 * @param {'card' | 'mind'} view
 * @returns {Map<string, number>}
 */
export function cardRank(project, view) {
  const rootId = project.extensions?.[MIND]?.rootId;
  const mind = view === 'mind';
  const known = new Set(project.cards.map((c) => c.id));
  const tree = mind && known.has(rootId) ? branchOrder(project, rootId) : [];
  const placed = new Set(tree);
  const rest = byGeometry(
    project,
    project.cards.filter((c) => !placed.has(c.id)),
    mind ? 'mind' : 'card',
  ).map((c) => c.id);
  return new Map([...tree, ...rest].map((id, index) => [id, index]));
}

/**
 * Group tree with directly placed cards in reading order, plus cards that belong to no group.
 * A card counts for the first group that lists it; groups unreachable from a top level (parent
 * cycle) are skipped and their cards fall back to `ungrouped`.
 * @param {Project} project
 * @param {'card' | 'mind'} view
 * @returns {{ groups: OutlineGroup[], ungrouped: string[] }}
 */
export function outline(project, view) {
  const rank = cardRank(project, view);
  const { byId, children } = groupTree(project);
  const placed = new Set(),
    visited = new Set();
  let counter = 0;
  const claim = (ids) => {
    const fresh = ids.filter((id) => rank.has(id) && !placed.has(id));
    for (const id of fresh) placed.add(id);
    return fresh;
  };
  const byRank = (ids) => ids.sort((a, b) => rank.get(a) - rank.get(b));
  /** @returns {OutlineGroup} */
  const build = (group, depth) => {
    visited.add(group.id);
    const node = {
      id: group.id,
      title: group.title,
      description: group.description || '',
      depth,
      bookmark: 'g' + ++counter,
      cardIds: byRank(claim(group.cardIds)),
      children: [],
    };
    for (const childId of children.get(group.id) || [])
      if (!visited.has(childId))
        node.children.push(build(byId.get(childId), Math.min(depth + 1, MAX_GROUP_DEPTH)));
    return node;
  };
  const groups = cardGroups(project)
    .filter((g) => !(g.parentId && byId.has(g.parentId)))
    .map((g) => build(g, 1));
  const ungrouped = byRank(project.cards.map((c) => c.id).filter((id) => !placed.has(id)));
  return { groups, ungrouped };
}
