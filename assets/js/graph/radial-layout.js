import { geometry, MIND, relationKind, setGeometry } from './mind-map.js';
const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export function branchTree(project) {
  const children = new Map(project.cards.map((c) => [c.id, []])),
    parent = new Map();
  for (const r of project.relations)
    if (relationKind(r) === 'branch') {
      children.get(r.source)?.push(r.target);
      parent.set(r.target, r.source);
    }
  for (const list of children.values()) list.sort(order);
  return { children, parent };
}
export function visibility(project, collapsed = new Set()) {
  const { children } = branchTree(project),
    hidden = new Set(),
    counts = new Map();
  const descendants = (id) => {
    const result = new Set(),
      pending = [...(children.get(id) || [])];
    while (pending.length) {
      const n = pending.pop();
      if (result.has(n)) continue;
      result.add(n);
      pending.push(...(children.get(n) || []));
    }
    return result;
  };
  for (const id of collapsed) {
    const nodes = descendants(id);
    counts.set(id, nodes.size);
    for (const n of nodes) hidden.add(n);
  }
  return { hidden, counts, children };
}
export function revealAncestors(project, id, collapsed) {
  const { parent } = branchTree(project),
    seen = new Set();
  let n = id,
    changed = false;
  while (parent.has(n) && !seen.has(n)) {
    seen.add(n);
    n = parent.get(n);
    if (collapsed.delete(n)) changed = true;
  }
  return changed;
}
export function overlapCount(project, positions, gap = 0) {
  const boxes = project.cards.map((c) => ({
    id: c.id,
    ...positions[c.id],
    ...geometry(project, c, 'mind').size,
  }));
  let count = 0;
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      if (
        a.x < b.x + b.width + gap &&
        b.x < a.x + a.width + gap &&
        a.y < b.y + b.height + gap &&
        b.y < a.y + a.height + gap
      )
        count++;
    }
  return count;
}
export function radialLayout(project, { gap = 60 } = {}) {
  const root = project.extensions?.[MIND]?.rootId;
  if (!root || !project.cards.some((c) => c.id === root)) throw Error('layoutNeedsRoot');
  const { children, parent } = branchTree(project),
    cards = new Map(project.cards.map((c) => [c.id, c])),
    sizes = new Map(project.cards.map((c) => [c.id, geometry(project, c, 'mind').size]));
  const positions = Object.create(null),
    assigned = new Set();
  const packTree = (start, anchor) => {
    const weight = new Map(),
      angles = new Map(),
      levels = [];
    const weigh = (id) => {
      const list = children.get(id) || [],
        size = sizes.get(id);
      const value = list.length
        ? list.reduce((sum, n) => sum + weigh(n), 0)
        : Math.hypot(size.width, size.height);
      weight.set(id, value);
      return value;
    };
    weigh(start);
    const visit = (id, depth, from, to) => {
      assigned.add(id);
      (levels[depth] ||= []).push(id);
      angles.set(id, (from + to) / 2);
      const list = children.get(id) || [],
        total = list.reduce((sum, n) => sum + weight.get(n), 0);
      let cursor = from;
      for (const n of list) {
        const end = cursor + ((to - from) * weight.get(n)) / total;
        visit(n, depth + 1, cursor, end);
        cursor = end;
      }
    };
    visit(start, 0, -Math.PI / 2, Math.PI * 1.5);
    let radius = 0,
      previous = 0;
    for (const [depth, ids] of levels.entries()) {
      const diagonal = Math.max(
        ...ids.map((id) => Math.hypot(sizes.get(id).width, sizes.get(id).height)),
      );
      if (depth) {
        radius += (previous + diagonal) / 2 + gap;
        const ring = [...ids].sort((a, b) => angles.get(a) - angles.get(b));
        if (ring.length > 1)
          for (let i = 0; i < ring.length; i++) {
            const a = ring[i],
              b = ring[(i + 1) % ring.length],
              delta =
                i === ring.length - 1
                  ? angles.get(b) + Math.PI * 2 - angles.get(a)
                  : angles.get(b) - angles.get(a);
            const sa = sizes.get(a),
              sb = sizes.get(b),
              distance =
                (Math.hypot(sa.width, sa.height) + Math.hypot(sb.width, sb.height)) / 2 + gap;
            radius = Math.max(radius, distance / (2 * Math.sin(delta / 2)));
          }
      }
      for (const id of ids) {
        const s = sizes.get(id),
          angle = angles.get(id);
        positions[id] = {
          x: anchor.x + Math.cos(angle) * radius - s.width / 2,
          y: anchor.y + Math.sin(angle) * radius - s.height / 2,
        };
      }
      previous = diagonal;
    }
  };
  const rootGeo = geometry(project, cards.get(root), 'mind');
  packTree(root, {
    x: rootGeo.position.x + rootGeo.size.width / 2,
    y: rootGeo.position.y + rootGeo.size.height / 2,
  });
  const bounds = (ids) => ({
    left: Math.min(...ids.map((id) => positions[id].x)),
    top: Math.min(...ids.map((id) => positions[id].y)),
    right: Math.max(...ids.map((id) => positions[id].x + sizes.get(id).width)),
    bottom: Math.max(...ids.map((id) => positions[id].y + sizes.get(id).height)),
  });
  const rootBounds = bounds([...assigned]);
  let cursorY = rootBounds.top,
    detached = 0;
  for (const id of [...cards.keys()].sort(order))
    if (!assigned.has(id) && !parent.has(id)) {
      const before = new Set(assigned);
      packTree(id, { x: 0, y: 0 });
      const ids = [...assigned].filter((n) => !before.has(n)),
        b = bounds(ids);
      const dx = rootBounds.right + gap * 2 - b.left,
        dy = cursorY - b.top;
      for (const n of ids) {
        positions[n].x += dx;
        positions[n].y += dy;
      }
      cursorY += b.bottom - b.top + gap;
      detached += ids.length;
    }
  const b = bounds([...assigned]),
    overlaps = overlapCount(project, positions);
  const warnings = [];
  if (detached) warnings.push({ code: 'layoutDetached', count: detached });
  if (overlaps) warnings.push({ code: 'layoutOverlap', count: overlaps });
  if (b.right - b.left > 20000 || b.bottom - b.top > 20000) warnings.push({ code: 'layoutSpread' });
  if (Object.values(positions).some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
    throw Error('layoutInvalid');
  return { positions, warnings, overlaps, bounds: b, detached };
}
export function applyLayout(project, result) {
  for (const [id, position] of Object.entries(result.positions))
    setGeometry(project, id, 'mind', 'position', position);
}
