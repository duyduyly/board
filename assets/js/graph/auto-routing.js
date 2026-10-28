import { EDGE, edgeMode, edgeRoute, setEdgeMode } from './edge-routing.js';
import { isPinned } from './card-metadata.js';
import { shapeAnchor } from './shape-registry.js';

const GAP = 16,
  EPS = 0.001;
export function enableAutoRoutes(project, view) {
  const pins = new Set(project.cards.filter(isPinned).map((c) => c.id));
  let changed = 0,
    skipped = 0;
  for (const r of project.relations) {
    if (edgeRoute(r) !== 'orthogonal' || r.source === r.target) continue;
    const config = r.extensions?.[EDGE];
    if (
      pins.has(r.source) ||
      pins.has(r.target) ||
      config?.modes?.[view] === 'manual' ||
      config?.corners?.[view] ||
      config?.adjustments?.[view] !== undefined
    ) {
      skipped++;
      continue;
    }
    if (edgeMode(r, view) !== 'auto') {
      setEdgeMode(r, view, 'auto');
      changed++;
    }
  }
  return { changed, skipped };
}
export function segmentBlocked(a, b, rects) {
  return rects.some((r) =>
    Math.abs(a.x - b.x) < EPS
      ? a.x > r.x1 + EPS &&
        a.x < r.x2 - EPS &&
        Math.max(a.y, b.y) > r.y1 + EPS &&
        Math.min(a.y, b.y) < r.y2 - EPS
      : a.y > r.y1 + EPS &&
        a.y < r.y2 - EPS &&
        Math.max(a.x, b.x) > r.x1 + EPS &&
        Math.min(a.x, b.x) < r.x2 - EPS,
  );
}
function simplify(points) {
  const out = [];
  for (const p of points) {
    if (out.length && Math.abs(out.at(-1).x - p.x) < EPS && Math.abs(out.at(-1).y - p.y) < EPS)
      continue;
    while (out.length > 1) {
      const a = out.at(-2),
        b = out.at(-1);
      if (
        (a.x === b.x && b.x === p.x && (b.y - a.y) * (p.y - b.y) >= 0) ||
        (a.y === b.y && b.y === p.y && (b.x - a.x) * (p.x - b.x) >= 0)
      )
        out.pop();
      else break;
    }
    out.push(p);
  }
  return out;
}
function port(rect, side, index, count) {
  const vertical = side === 'left' || side === 'right',
    span = vertical ? rect.height : rect.width;
  const offset = (index - (count - 1) / 2) * Math.min(16, (span * 0.7) / Math.max(1, count - 1));
  const horizontal = vertical ? rect.height / 2 + offset : rect.width / 2 + offset;
  let local = vertical
    ? { x: side === 'right' ? rect.width : 0, y: horizontal }
    : { x: horizontal, y: side === 'bottom' ? rect.height : 0 };
  if (rect.points) {
    const values = [];
    for (let i = 0; i < rect.points.length; i++) {
      const a = rect.points[i],
        b = rect.points[(i + 1) % rect.points.length],
        u = vertical ? a.y : a.x,
        v = vertical ? b.y : b.x;
      if ((u <= horizontal && v > horizontal) || (v <= horizontal && u > horizontal)) {
        const t = (horizontal - u) / (v - u);
        values.push(vertical ? a.x + t * (b.x - a.x) : a.y + t * (b.y - a.y));
      }
    }
    if (values.length) {
      const coordinate = ['right', 'bottom'].includes(side)
        ? Math.max(...values)
        : Math.min(...values);
      if (vertical) local.x = coordinate;
      else local.y = coordinate;
    } else
      local = shapeAnchor(
        rect.points,
        { x: rect.width / 2, y: rect.height / 2 },
        {
          x: vertical ? (side === 'right' ? 1 : -1) : 0,
          y: vertical ? 0 : side === 'bottom' ? 1 : -1,
        },
      );
  }
  const point = { x: rect.x + local.x, y: rect.y + local.y };
  const stub = vertical
    ? { x: side === 'right' ? rect.x + rect.width + GAP : rect.x - GAP, y: point.y }
    : { x: point.x, y: side === 'bottom' ? rect.y + rect.height + GAP : rect.y - GAP };
  return { point, stub };
}
class Heap {
  data = [];
  push(v) {
    let i = this.data.length;
    this.data.push(v);
    while (i) {
      const p = (i - 1) >> 1;
      if (this.data[p].score <= v.score) break;
      this.data[i] = this.data[p];
      i = p;
    }
    this.data[i] = v;
  }
  pop() {
    const top = this.data[0],
      last = this.data.pop();
    if (this.data.length) {
      let i = 0;
      while (i * 2 + 1 < this.data.length) {
        let k = i * 2 + 1;
        if (k + 1 < this.data.length && this.data[k + 1].score < this.data[k].score) k++;
        if (last.score <= this.data[k].score) break;
        this.data[i] = this.data[k];
        i = k;
      }
      this.data[i] = last;
    }
    return top;
  }
}
function gridSearch(start, end, obstacles, budget) {
  if (budget.left <= 0) return null;
  const distance = (r) =>
    Math.abs((r.x1 + r.x2) / 2 - (start.x + end.x) / 2) +
    Math.abs((r.y1 + r.y2) / 2 - (start.y + end.y) / 2);
  const near = [...obstacles].sort((a, b) => distance(a) - distance(b)).slice(0, 48);
  const unique = (a) => [...new Set(a)].sort((a, b) => a - b);
  const xs = unique([
    start.x,
    end.x,
    ...near.flatMap((r) => [r.x1, r.x2]),
    Math.min(...obstacles.map((r) => r.x1)) - GAP,
    Math.max(...obstacles.map((r) => r.x2)) + GAP,
  ]);
  const ys = unique([
    start.y,
    end.y,
    ...near.flatMap((r) => [r.y1, r.y2]),
    Math.min(...obstacles.map((r) => r.y1)) - GAP,
    Math.max(...obstacles.map((r) => r.y2)) + GAP,
  ]);
  const width = xs.length,
    source = ys.indexOf(start.y) * width + xs.indexOf(start.x),
    target = ys.indexOf(end.y) * width + xs.indexOf(end.x),
    size = width * ys.length * 2;
  const cost = new Float64Array(size).fill(Infinity),
    parent = new Int32Array(size).fill(-1),
    heap = new Heap();
  const xy = (n) => ({ x: xs[n % width], y: ys[Math.floor(n / width)] });
  for (let dir = 0; dir < 2; dir++) {
    cost[source * 2 + dir] = 0;
    heap.push({ key: source * 2 + dir, g: 0, score: 0 });
  }
  let steps = 0;
  while (heap.data.length && steps++ < 4000 && budget.left-- > 0) {
    const cur = heap.pop();
    if (cur.g !== cost[cur.key]) continue;
    const n = cur.key >> 1,
      dir = cur.key % 2,
      a = xy(n);
    if (n === target) {
      const out = [];
      for (let k = cur.key; k !== -1; k = parent[k]) out.push(xy(k >> 1));
      return simplify(out.reverse());
    }
    const x = n % width,
      y = Math.floor(n / width);
    for (const [nx, ny, nd] of [
      [x - 1, y, 0],
      [x + 1, y, 0],
      [x, y - 1, 1],
      [x, y + 1, 1],
    ]) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= ys.length) continue;
      const next = ny * width + nx,
        b = xy(next);
      if (segmentBlocked(a, b, obstacles)) continue;
      const key = next * 2 + nd,
        g = cur.g + Math.abs(b.x - a.x) + Math.abs(b.y - a.y) + (dir === nd ? 0 : 24);
      if (g >= cost[key]) continue;
      cost[key] = g;
      parent[key] = cur.key;
      heap.push({ key, g, score: g + Math.abs(b.x - end.x) + Math.abs(b.y - end.y) });
    }
  }
  return null;
}
function candidate(start, end, obstacles, tracks, lane, budget, sourcePort, targetPort) {
  const used = (a, b) => {
    const vertical = Math.abs(a.x - b.x) < EPS,
      key = Math.round((vertical ? a.x : a.y) / 8),
      map = tracks[vertical ? 0 : 1];
    let penalty = 0;
    for (let k = key - 1; k <= key + 1; k++)
      for (const r of (map.get(k) || []).slice(-300)) {
        if (Math.abs(r.coordinate - (vertical ? a.x : a.y)) >= 10) continue;
        const overlap =
          Math.min(Math.max(vertical ? a.y : a.x, vertical ? b.y : b.x), r.hi) -
          Math.max(Math.min(vertical ? a.y : a.x, vertical ? b.y : b.x), r.lo);
        if (overlap > 0) penalty += overlap * 2;
      }
    return penalty;
  };
  const candidates = [];
  const signX = Math.sign(end.x - start.x) || 1,
    signY = Math.sign(end.y - start.y) || 1;
  const xs = [
    start.x + signX * (24 + lane * 14),
    end.x - signX * (24 + lane * 14),
    (start.x + end.x) / 2,
    budget.bounds.x1 - lane * 14,
    budget.bounds.x2 + lane * 14,
  ];
  const ys = [
    start.y + signY * (24 + lane * 14),
    end.y - signY * (24 + lane * 14),
    (start.y + end.y) / 2,
    budget.bounds.y1 - lane * 14,
    budget.bounds.y2 + lane * 14,
  ];
  for (const x of xs) candidates.push([start, { x, y: start.y }, { x, y: end.y }, end]);
  for (const y of ys) candidates.push([start, { x: start.x, y }, { x: end.x, y }, end]);
  candidates.push([start, { x: end.x, y: start.y }, end], [start, { x: start.x, y: end.y }, end]);
  let best = null,
    bestCost = Infinity;
  for (const raw of candidates) {
    const path = simplify(raw);
    let score = (simplify([sourcePort, ...path, targetPort]).length - 2) * 24,
      blocked = false;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1],
        b = path[i];
      if (segmentBlocked(a, b, obstacles)) {
        blocked = true;
        break;
      }
      score += Math.abs(b.x - a.x) + Math.abs(b.y - a.y) + used(a, b);
    }
    if (!blocked && score < bestCost - EPS) {
      best = path;
      bestCost = score;
    }
  }
  return best || gridSearch(start, end, obstacles, budget);
}
export function autoRoutes(project, rects, view) {
  const enabled = project.relations.filter(
    (r) =>
      edgeRoute(r) === 'orthogonal' &&
      edgeMode(r, view) === 'auto' &&
      rects.has(r.source) &&
      rects.has(r.target),
  );
  const result = new Map();
  if (!enabled.length) return result;
  const obstacles = [...rects.values()].map((r) => ({
    id: r.id,
    x1: r.x - GAP,
    y1: r.y - GAP,
    x2: r.x + r.width + GAP,
    y2: r.y + r.height + GAP,
  }));
  const center = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 }),
    preferred = new Map(),
    groups = new Map();
  for (const r of enabled) {
    const a = center(rects.get(r.source)),
      b = center(rects.get(r.target)),
      horizontal = Math.abs(b.x - a.x) > rects.get(r.source).width;
    const x = b.x >= a.x ? ['right', 'left'] : ['left', 'right'],
      y = b.y >= a.y ? ['bottom', 'top'] : ['top', 'bottom'];
    preferred.set(r.id, horizontal ? [x, y] : [y, x]);
    for (const [kind, id, side, peer] of [
      ['s', r.source, preferred.get(r.id)[0][0], b],
      ['t', r.target, preferred.get(r.id)[0][1], a],
    ]) {
      const key = kind + id + side;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ id: r.id, value: ['left', 'right'].includes(side) ? peer.y : peer.x });
    }
  }
  for (const list of groups.values())
    list.sort((a, b) => a.value - b.value || a.id.localeCompare(b.id));
  const tracks = [new Map(), new Map()],
    budget = {
      left: 50000,
      bounds: {
        x1: Math.min(...obstacles.map((r) => r.x1)) - GAP,
        x2: Math.max(...obstacles.map((r) => r.x2)) + GAP,
        y1: Math.min(...obstacles.map((r) => r.y1)) - GAP,
        y2: Math.max(...obstacles.map((r) => r.y2)) + GAP,
      },
    };
  for (const r of [...enabled].sort((a, b) => a.id.localeCompare(b.id))) {
    const a = rects.get(r.source),
      b = rects.get(r.target);
    let found = null;
    if (r.source !== r.target)
      for (const [ss, ts] of [
        ...preferred.get(r.id),
        ...preferred.get(r.id).map(([s, t]) => [t, s]),
      ]) {
        const sr = groups.get('s' + r.source + ss) || [{ id: r.id }],
          tr = groups.get('t' + r.target + ts) || [{ id: r.id }],
          si = Math.max(
            0,
            sr.findIndex((v) => v.id === r.id),
          ),
          ti = Math.max(
            0,
            tr.findIndex((v) => v.id === r.id),
          );
        const source = port(a, ss, si, sr.length),
          target = port(b, ts, ti, tr.length);
        if (
          segmentBlocked(
            source.point,
            source.stub,
            obstacles.filter((o) => o.id !== r.source),
          ) ||
          segmentBlocked(
            target.stub,
            target.point,
            obstacles.filter((o) => o.id !== r.target),
          )
        )
          continue;
        const path = candidate(
          source.stub,
          target.stub,
          obstacles,
          tracks,
          si,
          budget,
          source.point,
          target.point,
        );
        if (!path) continue;
        found = {
          points: simplify([source.point, ...path, target.point]),
          source: source.point,
          target: target.point,
        };
        break;
      }
    result.set(r.id, found || { failed: true });
    if (found)
      for (let i = 1; i < found.points.length; i++) {
        const p = found.points[i - 1],
          q = found.points[i],
          vertical = Math.abs(p.x - q.x) < EPS,
          map = tracks[vertical ? 0 : 1],
          key = Math.round((vertical ? p.x : p.y) / 8);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push({
          coordinate: vertical ? p.x : p.y,
          lo: Math.min(vertical ? p.y : p.x, vertical ? q.y : q.x),
          hi: Math.max(vertical ? p.y : p.x, vertical ? q.y : q.x),
        });
      }
  }
  return result;
}
export function autoRouteStyle(path, a, b) {
  if (path.failed) return { 'line-opacity': 0.18, 'line-style': 'dotted' };
  const dx = b.x - a.x,
    dy = b.y - a.y,
    L = Math.hypot(dx, dy) || 1,
    points = path.points.slice(1, -1);
  if (!points.length)
    points.push({ x: (path.source.x + path.target.x) / 2, y: (path.source.y + path.target.y) / 2 });
  return {
    'curve-style': 'segments',
    'edge-distances': 'node-position',
    'source-endpoint': `${path.source.x - a.x}px ${path.source.y - a.y}px`,
    'target-endpoint': `${path.target.x - b.x}px ${path.target.y - b.y}px`,
    'segment-weights': points.map((p) => ((p.x - a.x) * dx + (p.y - a.y) * dy) / (L * L)),
    'segment-distances': points.map((p) => ((p.x - a.x) * -dy + (p.y - a.y) * dx) / L),
  };
}
