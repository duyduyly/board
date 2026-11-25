import { clone } from '../common/data.js';
import { selectionLocked } from './card-lock.js';
import { isPinned } from './card-metadata.js';
import { MIND, nodeStyle, setRoot, setGeometry, relationKind, mindRootOf } from './mind-map.js';
import { radialLayout, applyLayout } from './radial-layout.js';
import { ownerOf, projectScope } from './card-scope.js';
import { validate } from '../json/validator.js';

/** Converts the board of `board` (null: project board) to a Mind Map tree rooted at `rootId`. */
export function convertMind(project, rootId, board = null) {
  const next = clone(project);
  const root = next.cards.find((c) => c.id === rootId);
  if (!root || ownerOf(root) !== board || isPinned(root)) throw Error('mindConvertFailed');
  const previousRoot = next.cards.find((c) => c.id === mindRootOf(next, board));
  if (previousRoot && isPinned(previousRoot) && previousRoot.id !== rootId)
    throw Error('mindConvertFailed');
  const owners = new Map(next.cards.map((c) => [c.id, ownerOf(c)]));
  const outgoing = new Map(next.cards.map((c) => [c.id, []]));
  const lockedParents = new Set();
  for (const edge of next.relations) {
    if (owners.get(edge.source) !== board) continue;
    outgoing.get(edge.source).push(edge);
    if (selectionLocked(next, { kind: 'relation', id: edge.id })) {
      if (relationKind(edge) === 'branch') lockedParents.add(edge.target);
      continue;
    }
    if (relationKind(edge) === 'branch') edge.extensions[MIND].kind = 'reference';
  }
  setRoot(next, rootId, false, board);
  const seen = new Set([rootId]),
    queue = [rootId];
  for (let i = 0; i < queue.length; i++)
    for (const edge of outgoing.get(queue[i])) {
      if (
        seen.has(edge.target) ||
        lockedParents.has(edge.target) ||
        selectionLocked(next, { kind: 'relation', id: edge.id })
      )
        continue;
      seen.add(edge.target);
      queue.push(edge.target);
      edge.extensions ||= {};
      edge.extensions[MIND] = { ...edge.extensions[MIND], kind: 'branch' };
    }
  for (const card of next.cards) {
    if (isPinned(card) || ownerOf(card) !== board || nodeStyle(card).kind !== 'card') continue;
    setGeometry(
      next,
      card.id,
      'mind',
      'size',
      card.id === rootId ? { width: 320, height: 120 } : { width: 260, height: 100 },
    );
  }
  if (validate(next).errors.length) throw Error('mindConvertFailed');
  const layout = radialLayout(projectScope(next, board));
  applyLayout(next, layout);
  return { project: next, warnings: layout.warnings };
}
