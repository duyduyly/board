import { clone } from '../common/data.js';
import { selectionLocked } from './card-lock.js';
import { isPinned } from './card-metadata.js';
import { MIND, nodeStyle, setRoot, setGeometry, relationKind } from './mind-map.js';
import { radialLayout, applyLayout } from './radial-layout.js';
import { validate } from '../json/validator.js';

export function convertMind(project, rootId) {
  const next = clone(project);
  const root = next.cards.find((c) => c.id === rootId);
  if (!root || isPinned(root)) throw Error('mindConvertFailed');
  const previousRoot = next.cards.find((c) => c.id === next.extensions?.[MIND]?.rootId);
  if (previousRoot && isPinned(previousRoot) && previousRoot.id !== rootId)
    throw Error('mindConvertFailed');
  const outgoing = new Map(next.cards.map((c) => [c.id, []]));
  const lockedParents = new Set();
  for (const edge of next.relations) {
    outgoing.get(edge.source).push(edge);
    if (selectionLocked(next, { kind: 'relation', id: edge.id })) {
      if (relationKind(edge) === 'branch') lockedParents.add(edge.target);
      continue;
    }
    if (relationKind(edge) === 'branch') edge.extensions[MIND].kind = 'reference';
  }
  setRoot(next, rootId);
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
    if (isPinned(card) || nodeStyle(card).kind !== 'card') continue;
    setGeometry(
      next,
      card.id,
      'mind',
      'size',
      card.id === rootId ? { width: 320, height: 120 } : { width: 260, height: 100 },
    );
  }
  if (validate(next).errors.length) throw Error('mindConvertFailed');
  const layout = radialLayout(next);
  applyLayout(next, layout);
  return { project: next, warnings: layout.warnings };
}
