import { clone } from '../common/data.js';
import { CARD_META, stampCreated } from './card-metadata.js';
import { VIEWS, setGeometry } from './mind-map.js';

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ cards: any[], relations: any[], mind: Record<string, { position?: Point, size?: any }> }} CardSnapshot
 */

/**
 * Snapshots the given cards, the relations that connect two of them and their Mind Map geometry.
 * The snapshot is detached from the project, so it stays valid after the originals change.
 * @param {any} project committed project snapshot (not mutated)
 * @param {Iterable<string>} ids
 * @returns {CardSnapshot}
 */
export function copyCards(project, ids) {
  const selected = new Set(ids);
  const mind = project.extensions?.[VIEWS]?.mindMap;
  /** @type {CardSnapshot['mind']} */
  const geometry = {};
  const cards = project.cards.filter((card) => selected.has(card.id)).map(clone);
  for (const card of cards) {
    const position = mind?.positions?.[card.id];
    const size = mind?.sizes?.[card.id];
    if (position || size) geometry[card.id] = clone({ position, size });
  }
  return {
    cards,
    relations: project.relations
      .filter((edge) => selected.has(edge.source) && selected.has(edge.target))
      .map(clone),
    mind: geometry,
  };
}

/**
 * Appends fresh copies of a snapshot to a mutable project draft (inside one store command).
 * Copies get new ids, a new creation stamp, are unpinned and shifted by `offset` in both views.
 * @param {any} p mutable project draft
 * @param {CardSnapshot} snapshot
 * @param {{ offset: number, newId: (kind: string) => string, now?: string }} options
 * @returns {string[]} ids of the new cards, in snapshot order
 */
export function pasteCards(p, snapshot, { offset, newId, now }) {
  const ids = new Map(snapshot.cards.map((card) => [card.id, newId('card')]));
  const shift = (/** @type {Point} */ point) => ({ x: point.x + offset, y: point.y + offset });
  for (const source of snapshot.cards) {
    const card = clone(source);
    card.id = ids.get(source.id);
    card.position = shift(source.position);
    stampCreated(card, now);
    delete card.extensions[CARD_META].pinned;
    p.cards.push(card);
    const mind = snapshot.mind[source.id];
    if (mind?.position) setGeometry(p, card.id, 'mind', 'position', shift(mind.position));
    if (mind?.size) setGeometry(p, card.id, 'mind', 'size', mind.size);
  }
  for (const source of snapshot.relations) {
    const relation = clone(source);
    relation.id = newId('relation');
    relation.source = ids.get(source.source);
    relation.target = ids.get(source.target);
    p.relations.push(relation);
  }
  return [...ids.values()];
}
