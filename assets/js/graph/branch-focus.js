import { projectIndex } from './project-index.js';

/**
 * @typedef {import('./types.js').Project} Project
 * @typedef {import('./types.js').Relation} Relation
 */
// Pure query over a committed snapshot: the outgoing index is read-only and never mutated here.
/**
 * Root card plus every card reachable through outgoing relations accepted by `follow`.
 * @param {Project} project
 * @param {string} rootId
 * @param {(relation: Relation) => boolean} [follow] default: every relation
 * @returns {Set<string>}
 */
export function branchCards(project, rootId, follow = () => true) {
  const { cards, outgoing } = projectIndex(project);
  /** @type {Set<string>} */
  const seen = new Set();
  if (!cards.has(rootId)) return seen;
  seen.add(rootId);
  const queue = [rootId];
  for (let head = 0; head < queue.length; head += 1) {
    for (const relation of outgoing.get(queue[head]) || []) {
      if (seen.has(relation.target) || !follow(relation)) continue;
      seen.add(relation.target);
      queue.push(relation.target);
    }
  }
  return seen;
}
