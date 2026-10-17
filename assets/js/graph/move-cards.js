import { geometry, setGeometry, VIEWS } from './mind-map.js';
import { isPinned } from './card-metadata.js';

// Called inside one transaction. Resolve geometry from the candidate, never a cached index.
export function moveCards(project, ids, delta, view) {
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) throw Error('invalidProject');
  if (delta.x === 0 && delta.y === 0) return;
  const selected = new Set(ids);
  for (const card of project.cards) {
    if (!selected.has(card.id) || isPinned(card)) continue;
    const position = geometry(project, card, view).position;
    if (view === 'card' && !project.extensions?.[VIEWS]?.mindMap?.positions?.[card.id])
      setGeometry(project, card.id, 'mind', 'position', geometry(project, card, 'mind').position);
    setGeometry(project, card.id, view, 'position', {
      x: position.x + delta.x,
      y: position.y + delta.y,
    });
  }
}
