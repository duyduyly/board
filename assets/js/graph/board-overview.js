import { ownerOf } from './card-scope.js';
import { GROUPS, cardGroups, cleanupGroups } from './card-groups.js';
import { hasTimeline, timelineEntries } from './timeline.js';

/**
 * @typedef {{ nodeId: string, count: number, x: number, y: number, width: number, height: number }} OverviewFrame
 * @typedef {{ project: any, frames: OverviewFrame[] }} OverviewLayout
 */

/** Spacing of the virtual "all notes" layout, in graph units. */
export const OVERVIEW_GAP = Object.freeze({
  pad: 24,
  header: 40,
  inner: 64,
  frame: 48,
  section: 96,
  minRow: 2400,
});

/** @type {WeakMap<object, OverviewLayout>} */
const layoutCache = new WeakMap();

/** @param {{ position: { x: number, y: number }, size: { width: number, height: number } }[]} cards */
function boundsOf(cards) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { position, size } of cards) {
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + size.width);
    maxY = Math.max(maxY, position.y + size.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Cards per owning node, only for owners that exist as cards. @param {any} project */
function childrenByNode(project) {
  const ids = new Set(project.cards.map((/** @type {any} */ c) => c.id));
  /** @type {Map<string, any[]>} */
  const children = new Map();
  for (const card of project.cards) {
    const owner = ownerOf(card);
    if (!owner || !ids.has(owner)) continue;
    const list = children.get(owner);
    if (list) list.push(card);
    else children.set(owner, [card]);
  }
  return children;
}

/**
 * Groups that stay wholly inside one board (a node frame or the shared notes) are kept; a group
 * spanning boards, or whose parent was dropped, would no longer enclose its members.
 * @param {any} next projection under construction (extensions already copied)
 * @param {(id: string) => string | null} boardOf
 */
function keepBoardGroups(next, boardOf) {
  if (!next.extensions?.[GROUPS]) return;
  next.extensions[GROUPS] = { ...next.extensions[GROUPS] };
  const groups = cardGroups(next);
  let kept = groups.filter((g) => {
    const boards = new Set([
      ...g.cardIds.map(boardOf),
      ...(g.links || []).map((/** @type {any} */ l) => boardOf(l.source)),
    ]);
    return boards.size <= 1;
  });
  for (let changed = true; changed;) {
    const ids = new Set(kept.map((g) => g.id));
    const rest = kept.filter((g) => !g.parentId || ids.has(g.parentId));
    changed = rest.length !== kept.length;
    kept = rest;
  }
  next.extensions[GROUPS].groups = kept;
  cleanupGroups(next);
  if (!cardGroups(next).length) delete next.extensions[GROUPS];
}

/**
 * Virtual "all notes" layout: cards without a board keep their place, every node that owns a
 * board becomes a frame (node on top, its cards below) placed below them in Timeline order.
 * Never mutates `project`; cached per committed snapshot, callers must not mutate the result.
 * @param {any} project
 * @returns {OverviewLayout}
 */
export function overviewLayout(project) {
  const cached = layoutCache.get(project);
  if (cached) return cached;
  const result = computeLayout(project);
  layoutCache.set(project, result);
  return result;
}

/** @param {any} project @returns {OverviewLayout} */
function computeLayout(project) {
  const children = hasTimeline(project) ? childrenByNode(project) : new Map();
  if (!children.size) return { project, frames: [] };

  const model = timelineEntries(project);
  const order = [...model.entries.map((e) => e.id), ...model.unscheduled].filter((id) =>
    children.has(id),
  );
  const byId = new Map(project.cards.map((/** @type {any} */ c) => [c.id, c]));
  const moved = new Set(order);
  for (const id of order) for (const card of children.get(id)) moved.add(card.id);
  const shared = project.cards.filter((/** @type {any} */ c) => !moved.has(c.id));

  const sharedBounds = shared.length ? boundsOf(shared) : null;
  const originX = sharedBounds ? sharedBounds.x : 0;
  const rowWidth = Math.max(OVERVIEW_GAP.minRow, sharedBounds ? sharedBounds.width : 0);
  let cursorY = sharedBounds ? sharedBounds.y + sharedBounds.height + OVERVIEW_GAP.section : 0;

  /** @type {Map<string, { x: number, y: number }>} */
  const positions = new Map();
  /** @type {OverviewFrame[]} */
  const frames = [];
  let cursorX = originX;
  let rowHeight = 0;
  for (const nodeId of order) {
    const node = byId.get(nodeId);
    const kids = children.get(nodeId);
    const kidBounds = boundsOf(kids);
    const width = OVERVIEW_GAP.pad * 2 + Math.max(node.size.width, kidBounds.width);
    const height =
      OVERVIEW_GAP.header +
      OVERVIEW_GAP.pad * 2 +
      node.size.height +
      OVERVIEW_GAP.inner +
      kidBounds.height;
    if (cursorX > originX && cursorX + width > originX + rowWidth) {
      cursorX = originX;
      cursorY += rowHeight + OVERVIEW_GAP.frame;
      rowHeight = 0;
    }
    const contentX = cursorX + OVERVIEW_GAP.pad;
    const nodeY = cursorY + OVERVIEW_GAP.header + OVERVIEW_GAP.pad;
    positions.set(nodeId, { x: contentX, y: nodeY });
    const dx = contentX - kidBounds.x;
    const dy = nodeY + node.size.height + OVERVIEW_GAP.inner - kidBounds.y;
    for (const kid of kids)
      positions.set(kid.id, { x: kid.position.x + dx, y: kid.position.y + dy });
    frames.push({ nodeId, count: kids.length, x: cursorX, y: cursorY, width, height });
    cursorX += width + OVERVIEW_GAP.frame;
    rowHeight = Math.max(rowHeight, height);
  }

  /** @type {any} */
  const next = {
    ...project,
    cards: project.cards.map((/** @type {any} */ c) =>
      positions.has(c.id) ? { ...c, position: positions.get(c.id) } : c,
    ),
  };
  if (project.extensions) {
    next.extensions = { ...project.extensions };
    const boardOf = (/** @type {string} */ id) => {
      const card = byId.get(id);
      const owner = card ? ownerOf(card) : null;
      return owner && children.has(owner) ? owner : children.has(id) ? id : null;
    };
    keepBoardGroups(next, boardOf);
  }
  return { project: next, frames };
}
