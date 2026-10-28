export const EDGE = 'card-atlas:edge';
export const routeTypes = ['curved', 'straight', 'orthogonal', 'zigzag'];
export const edgeRoute = (relation) => relation.extensions?.[EDGE]?.route || 'curved';
export function setEdgeOffset(relation, view, value) {
  if (value === null && relation.extensions?.[EDGE]?.adjustments?.[view] === undefined) return;
  relation.extensions ||= {};
  const config = (relation.extensions[EDGE] ||= { route: edgeRoute(relation) });
  if (value === null) {
    if (config.adjustments) delete config.adjustments[view];
    if (config.adjustments && !Object.keys(config.adjustments).length) delete config.adjustments;
  } else {
    config.adjustments ||= {};
    config.adjustments[view] = value;
  }
}
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
        Object.keys(value).some((k) => !['route', 'adjustments'].includes(k)) ||
        !routeTypes.includes(value.route) ||
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
