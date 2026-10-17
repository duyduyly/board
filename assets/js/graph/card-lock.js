import { clone } from '../common/data.js';
import { CARD_META, isPinned } from './card-metadata.js';
import { geometry, MIND } from './mind-map.js';

export function selectionLocked(project, selection) {
  if (selection?.kind === 'card') return isPinned(project.cards.find((c) => c.id === selection.id));
  if (selection?.kind !== 'relation') return false;
  const relation = project.relations.find((r) => r.id === selection.id);
  return Boolean(
    relation &&
    project.cards.some((c) => isPinned(c) && [relation.source, relation.target].includes(c.id)),
  );
}

// Committed-model invariant; renderer/draft/transfer cannot bypass the lock.
export function assertPinnedUnchanged(before, after) {
  const locked = before.cards.filter(isPinned);
  if (!locked.length) return;
  const ids = new Set(locked.map((c) => c.id));
  const cards = new Map(after.cards.map((c) => [c.id, c]));
  const relations = (project) => {
    const map = new Map([...ids].map((id) => [id, []]));
    for (const r of project.relations) {
      const signature = JSON.stringify(r);
      if (ids.has(r.source)) map.get(r.source).push(signature);
      if (ids.has(r.target)) map.get(r.target).push(signature);
    }
    for (const list of map.values()) list.sort();
    return map;
  };
  const oldRelations = relations(before),
    newRelations = relations(after);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const card of locked) {
    const candidate = cards.get(card.id);
    let contentSame = same(card, candidate);
    if (candidate && !isPinned(candidate)) {
      const unpinned = clone(card);
      unpinned.extensions[CARD_META].pinned = false;
      contentSame = same(unpinned, candidate);
    }
    const oldRoot = before.extensions?.[MIND]?.rootId === card.id;
    const newRoot = after.extensions?.[MIND]?.rootId === card.id;
    if (
      !candidate ||
      !contentSame ||
      oldRoot !== newRoot ||
      !same(geometry(before, card, 'mind'), geometry(after, candidate, 'mind')) ||
      !same(oldRelations.get(card.id), newRelations.get(card.id))
    ) {
      const error = new Error('pinnedCardLocked');
      error.cardId = card.id;
      throw error;
    }
  }
}
