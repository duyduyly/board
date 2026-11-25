import { GROUPS, cardGroups, cleanupGroups } from './card-groups.js';
import { MIND, mindRootOf } from './mind-map.js';

export const OWNER = 'card-atlas:owner';

/** @typedef {{ path: string, code: string, params?: Record<string, unknown> }} ScopeIssue */

/** Node that owns the card's board, or null for a card on the project board. */
export const ownerOf = (card) => card.extensions?.[OWNER]?.nodeId ?? null;

/**
 * Sets or clears (nodeId null) the owner; empty `extensions` are removed.
 * @returns {boolean} whether the card changed
 */
export function setOwner(card, nodeId) {
  if (ownerOf(card) === nodeId) return false;
  if (nodeId) {
    card.extensions ||= {};
    card.extensions[OWNER] = { nodeId };
  } else {
    delete card.extensions?.[OWNER];
    if (card.extensions && !Object.keys(card.extensions).length) delete card.extensions;
  }
  return true;
}

/** Ids of the cards on the board of `nodeId`. */
export const ownedIds = (project, nodeId) =>
  project.cards.filter((c) => ownerOf(c) === nodeId).map((c) => c.id);

export const hasOwnedCards = (project) => project.cards.some((c) => ownerOf(c) !== null);

const countCache = new WeakMap();
const scopeCache = new WeakMap();

/** Owned card count per node id; cached per committed snapshot, never mutate the result. */
export function ownedCounts(project) {
  let counts = countCache.get(project);
  if (!counts) {
    counts = new Map();
    for (const card of project.cards) {
      const owner = ownerOf(card);
      if (owner) counts.set(owner, (counts.get(owner) || 0) + 1);
    }
    countCache.set(project, counts);
  }
  return counts;
}

/** Projection holding only the cards of `ownerId` (null: project board) and what connects them. */
export function projectScope(project, ownerId) {
  const cards = project.cards.filter((c) => ownerOf(c) === ownerId);
  const ids = new Set(cards.map((c) => c.id));
  const next = {
    ...project,
    cards,
    relations: project.relations.filter((r) => ids.has(r.source) && ids.has(r.target)),
  };
  if (!project.extensions) return next;
  next.extensions = { ...project.extensions };
  if (project.extensions[GROUPS]) {
    next.extensions[GROUPS] = { ...project.extensions[GROUPS] };
    cleanupGroups(next);
    if (!cardGroups(next).length) delete next.extensions[GROUPS];
  }
  const mind = project.extensions[MIND];
  if (mind === undefined) return next;
  // A board keeps its own root: the project-level rootId belongs to the project board only.
  const rootId = ownerId === null ? mind.rootId : mindRootOf(project, ownerId);
  next.extensions[MIND] = rootId !== undefined && ids.has(rootId) ? { rootId } : {};
  return next;
}

/** Cached projectScope for committed snapshots; the project itself when nothing is owned. */
export function scopedProject(project, ownerId) {
  if (ownerId === null && !hasOwnedCards(project)) return project;
  let byOwner = scopeCache.get(project);
  if (!byOwner) scopeCache.set(project, (byOwner = new Map()));
  if (!byOwner.has(ownerId)) byOwner.set(ownerId, projectScope(project, ownerId));
  return byOwner.get(ownerId);
}

/**
 * Gives the cards added since `beforeIds` the owner (or none when ownerId is null).
 * @returns {number} cards changed
 */
export function adoptNewCards(project, beforeIds, ownerId) {
  let changed = 0;
  for (const card of project.cards)
    if (!beforeIds.has(card.id) && setOwner(card, ownerId)) changed += 1;
  return changed;
}

/** Removes every owner. @returns {number} cards changed */
export function clearOwners(project) {
  const mind = project.extensions?.[MIND];
  if (mind) delete mind.boardRoots;
  let changed = 0;
  for (const card of project.cards) if (setOwner(card, null)) changed += 1;
  return changed;
}

/** Consistency problems of owners against the rest of the project. */
export function scopeIssues(project, { timeline }) {
  /** @type {ScopeIssue[]} */
  const issues = [];
  const byId = new Map(project.cards.map((c) => [c.id, c]));
  project.cards.forEach((card, i) => {
    const nodeId = ownerOf(card);
    if (nodeId === null) return;
    const path = `cards[${i}].extensions.${OWNER}.nodeId`;
    const node = byId.get(nodeId);
    if (!node) issues.push({ path, code: 'ownerMissing', params: { nodeId } });
    else if (node === card || ownerOf(node) !== null)
      issues.push({ path, code: 'ownerNested', params: { nodeId } });
    if (!timeline) issues.push({ path, code: 'ownerWithoutTimeline' });
  });
  const owner = (id) => (byId.has(id) ? ownerOf(byId.get(id)) : null);
  project.relations.forEach((relation, i) => {
    if (owner(relation.source) !== owner(relation.target))
      issues.push({ path: `relations[${i}].target`, code: 'relationScope' });
  });
  const groups = cardGroups(project);
  const groupOwner = (g) => (g.cardIds.length ? owner(g.cardIds[0]) : undefined);
  const parents = new Map(groups.map((g) => [g.id, g]));
  const mixed = groups.some((g) => {
    const scope = groupOwner(g);
    const parentScope = parents.has(g.parentId) ? groupOwner(parents.get(g.parentId)) : undefined;
    return (
      g.cardIds.some((id) => owner(id) !== scope) ||
      (g.links || []).some((l) => scope !== undefined && owner(l.source) !== scope) ||
      (scope !== undefined && parentScope !== undefined && scope !== parentScope)
    );
  });
  if (mixed) issues.push({ path: 'extensions.' + GROUPS, code: 'groupScope' });
  const boardRoots = project.extensions?.[MIND]?.boardRoots;
  if (boardRoots && typeof boardRoots === 'object')
    for (const [nodeId, rootId] of Object.entries(boardRoots)) {
      const node = byId.get(nodeId);
      if (!node || ownerOf(node) !== null || (byId.has(rootId) && owner(rootId) !== nodeId))
        issues.push({
          path: `extensions.${MIND}.boardRoots.${nodeId}`,
          code: 'mindBoardRootScope',
          params: { nodeId },
        });
    }
  const root = project.extensions?.[MIND]?.rootId;
  if (root !== undefined && owner(root) !== null)
    issues.push({ path: `extensions.${MIND}.rootId`, code: 'mindRootScope' });
  return issues;
}
