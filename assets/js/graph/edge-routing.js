export const EDGE = 'card-atlas:edge';
export const routeTypes = ['curved', 'straight', 'orthogonal', 'zigzag'];
export const edgeRoute = (relation) => relation.extensions?.[EDGE]?.route || 'curved';
export const edgeMode = (relation, view) => relation.extensions?.[EDGE]?.modes?.[view] || 'manual';
export function setEdgeMode(relation, view, value) {
  relation.extensions ||= {};
  const config = (relation.extensions[EDGE] ||= { route: edgeRoute(relation) });
  config.modes ||= {};
  config.modes[view] = value;
}
export function setEdgeOffset(relation, view, value) {
  if (
    value === null &&
    relation.extensions?.[EDGE]?.adjustments?.[view] === undefined &&
    relation.extensions?.[EDGE]?.corners?.[view] === undefined
  )
    return;
  relation.extensions ||= {};
  const config = (relation.extensions[EDGE] ||= { route: edgeRoute(relation) });
  if (value === null) {
    if (config.corners) delete config.corners[view];
    if (config.corners && !Object.keys(config.corners).length) delete config.corners;
    if (config.adjustments) delete config.adjustments[view];
    if (config.adjustments && !Object.keys(config.adjustments).length) delete config.adjustments;
  } else {
    config.adjustments ||= {};
    config.adjustments[view] = value;
  }
}
export function setEdgeCorners(relation, view, value) {
  setEdgeOffset(relation, view, null);
  relation.extensions ||= {};
  const config = (relation.extensions[EDGE] ||= { route: edgeRoute(relation) });
  config.corners ||= {};
  config.corners[view] = structuredClone(value);
}
export function initialCorners(a, b, offset = 0) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? {
        axis: 'horizontal',
        source: { x: dx / 3, y: dy / 2 + offset },
        target: { x: -dx / 3, y: -dy / 2 + offset },
      }
    : {
        axis: 'vertical',
        source: { x: dx / 2 + offset, y: dy / 3 },
        target: { x: -dx / 2 + offset, y: -dy / 3 },
      };
}
export function orthogonalCorners(a, b, config) {
  const source = { x: a.x + config.source.x, y: a.y + config.source.y },
    target = { x: b.x + config.target.x, y: b.y + config.target.y };
  const h = config.axis === 'horizontal',
    mid = h ? (source.x + target.x) / 2 : (source.y + target.y) / 2;
  const raw = h
    ? [
        a,
        { x: source.x, y: a.y },
        source,
        { x: mid, y: source.y },
        { x: mid, y: target.y },
        target,
        { x: target.x, y: b.y },
        b,
      ]
    : [
        a,
        { x: a.x, y: source.y },
        source,
        { x: source.x, y: mid },
        { x: target.x, y: mid },
        target,
        { x: b.x, y: target.y },
        b,
      ];
  const clean = [];
  for (const p of raw) {
    if (clean.length && p.x === clean.at(-1).x && p.y === clean.at(-1).y) continue;
    while (clean.length >= 2) {
      const q = clean.at(-1),
        r = clean.at(-2);
      if (
        (r.x === q.x && q.x === p.x && (q.y - r.y) * (p.y - q.y) >= 0) ||
        (r.y === q.y && q.y === p.y && (q.x - r.x) * (p.x - q.x) >= 0)
      )
        clean.pop();
      else break;
    }
    clean.push(p);
  }
  const points = clean.slice(1, -1);
  if (!points.length) points.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy) || 1;
  return {
    source,
    target,
    handle: { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 },
    style: {
      'edge-distances': 'node-position',
      'curve-style': 'segments',
      'segment-weights': points.map(
        (p) => ((p.x - a.x) * dx + (p.y - a.y) * dy) / (length * length),
      ),
      'segment-distances': points.map((p) => ((p.x - a.x) * -dy + (p.y - a.y) * dx) / length),
    },
  };
}
const validCorner = (c) =>
  c &&
  typeof c === 'object' &&
  !Array.isArray(c) &&
  Object.keys(c).length === 3 &&
  ['horizontal', 'vertical'].includes(c.axis) &&
  ['source', 'target'].every(
    (k) =>
      c[k] &&
      typeof c[k] === 'object' &&
      !Array.isArray(c[k]) &&
      Object.keys(c[k]).length === 2 &&
      ['x', 'y'].every((n) => Number.isFinite(c[k][n]) && Math.abs(c[k][n]) <= 10000),
  );
export function edgePath(route, a, b, offset) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy) || 1;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (route === 'curved')
    return {
      handle: { x: mid.x - (dy / length) * offset, y: mid.y + (dx / length) * offset },
      style: {
        'edge-distances': 'node-position',
        'curve-style': 'unbundled-bezier',
        'control-point-distances': offset,
        'control-point-weights': 0.5,
      },
      offset: (p) => ((p.x - mid.x) * -dy + (p.y - mid.y) * dx) / length,
    };
  // Move the rail across the main direction so aligned endpoints can detour too.
  const horizontal = Math.abs(dx) < Math.abs(dy);
  const rail = (horizontal ? mid.x : mid.y) + offset;
  const points = horizontal
    ? [
        { x: rail, y: a.y },
        { x: rail, y: b.y },
      ]
    : [
        { x: a.x, y: rail },
        { x: b.x, y: rail },
      ];
  return {
    handle: horizontal ? { x: rail, y: mid.y } : { x: mid.x, y: rail },
    offset: (p) => (horizontal ? p.x - mid.x : p.y - mid.y),
    style: {
      'edge-distances': 'node-position',
      'curve-style': 'segments',
      'segment-weights': points.map(
        (p) => ((p.x - a.x) * dx + (p.y - a.y) * dy) / (length * length),
      ),
      'segment-distances': points.map((p) => ((p.x - a.x) * -dy + (p.y - a.y) * dx) / length),
    },
  };
}
export function routingIssues(project) {
  const issues = [];
  project.relations.forEach((r, i) => {
    const value = r.extensions?.[EDGE];
    if (
      value !== undefined &&
      (!value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value).some((k) => !['route', 'adjustments', 'corners', 'modes'].includes(k)) ||
        !routeTypes.includes(value.route) ||
        (value.modes !== undefined &&
          (!value.modes ||
            typeof value.modes !== 'object' ||
            Array.isArray(value.modes) ||
            Object.entries(value.modes).some(
              ([k, v]) => !['card', 'mind'].includes(k) || !['auto', 'manual'].includes(v),
            ))) ||
        (value.corners !== undefined &&
          (!value.corners ||
            typeof value.corners !== 'object' ||
            Array.isArray(value.corners) ||
            Object.entries(value.corners).some(
              ([k, v]) => !['card', 'mind'].includes(k) || !validCorner(v),
            ))) ||
        (value.adjustments !== undefined &&
          (!value.adjustments ||
            typeof value.adjustments !== 'object' ||
            Array.isArray(value.adjustments) ||
            Object.entries(value.adjustments).some(
              ([k, v]) =>
                !['card', 'mind'].includes(k) || !Number.isFinite(v) || Math.abs(v) > 2000,
            ))))
    )
      issues.push({ path: `relations[${i}].extensions.${EDGE}`, code: 'edgeRouting' });
  });
  return issues;
}
