// Normalized app-owned outlines. JSON never supplies CSS, SVG or polygon points.
export const shapes = Object.freeze({
  rectangle: { area: [0, 0, 1, 1] },
  rounded: { area: [0, 0, 1, 1] },
  square: { area: [0, 0, 1, 1], ratio: 1 },
  circle: { area: [0.15, 0.15, 0.7, 0.7], ratio: 1, compact: true },
  ellipse: { area: [0.15, 0.15, 0.7, 0.7], compact: true },
  diamond: { area: [0.25, 0.25, 0.5, 0.5], compact: true },
  triangle: { area: [0.3, 0.48, 0.4, 0.36], ratio: 2 / Math.sqrt(3), compact: true },
  hexagon: { area: [0.25, 0.08, 0.5, 0.84], compact: true },
});
export const SHAPE_LIMITS = Object.freeze({
  minWidth: 96,
  minHeight: 64,
  maxWidth: 1200,
  maxHeight: 1000,
});
export function shapeFrame(shape, size) {
  const ratio = shapes[shape]?.ratio;
  let { width, height } = size;
  if (ratio) {
    width = Math.min(width, height * ratio);
    height = width / ratio;
  }
  return { x: (size.width - width) / 2, y: (size.height - height) / 2, width, height };
}
export function resizeShape(shape, width, height, axis) {
  const ratio = shapes[shape]?.ratio;
  const b = SHAPE_LIMITS;
  if (ratio) {
    width =
      axis === 'width'
        ? width
        : axis === 'height'
          ? height * ratio
          : Math.max(width, height * ratio);
    width = Math.min(
      Math.min(b.maxWidth, b.maxHeight * ratio),
      Math.max(Math.max(b.minWidth, b.minHeight * ratio), width),
    );
    return { width, height: width / ratio };
  }
  return {
    width: Math.max(b.minWidth, Math.min(b.maxWidth, width)),
    height: Math.max(b.minHeight, Math.min(b.maxHeight, height)),
  };
}
export function shapePoints(shape, size, radius = 10) {
  const f = shapeFrame(shape, size);
  let points;
  if (shape === 'circle' || shape === 'ellipse') {
    points = Array.from({ length: 64 }, (_, i) => {
      const a = (i * Math.PI) / 32;
      return [(1 + Math.cos(a)) / 2, (1 + Math.sin(a)) / 2];
    });
  } else if (shape === 'diamond')
    points = [
      [0.5, 0],
      [1, 0.5],
      [0.5, 1],
      [0, 0.5],
    ];
  else if (shape === 'triangle')
    points = [
      [0.5, 0],
      [1, 1],
      [0, 1],
    ];
  else if (shape === 'hexagon')
    points = [
      [0.25, 0],
      [0.75, 0],
      [1, 0.5],
      [0.75, 1],
      [0.25, 1],
      [0, 0.5],
    ];
  else if (shape === 'rounded' && radius > 0) {
    const r = Math.min(radius, f.width / 2, f.height / 2);
    points = [];
    for (const [x, y, start] of [
      [f.width - r, r, -Math.PI / 2],
      [f.width - r, f.height - r, 0],
      [r, f.height - r, Math.PI / 2],
      [r, r, Math.PI],
    ])
      for (let i = 0; i <= 8; i++) {
        const a = start + (i * Math.PI) / 16;
        points.push([(x + r * Math.cos(a)) / f.width, (y + r * Math.sin(a)) / f.height]);
      }
  } else
    points = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
  return points.map(([x, y]) => ({ x: f.x + x * f.width, y: f.y + y * f.height }));
}
export function safeArea(shape, size, padding = 16, radius = 10) {
  const f = shapeFrame(shape, size),
    [x, y, w, h] = shapes[shape].area;
  if (shape === 'rounded')
    padding = Math.max(
      padding,
      Math.min(radius, f.width / 2, f.height / 2) * (1 - Math.SQRT1_2) + 2,
    );
  return {
    x: f.x + x * f.width + padding,
    y: f.y + y * f.height + padding,
    width: Math.max(1, w * f.width - 2 * padding),
    height: Math.max(1, h * f.height - 2 * padding),
  };
}
export function hitShape(points, point) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
export function shapeAnchor(points, center, direction) {
  let best = Infinity;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      edge = { x: b.x - a.x, y: b.y - a.y },
      offset = { x: a.x - center.x, y: a.y - center.y };
    const denominator = cross(direction, edge);
    if (Math.abs(denominator) < 1e-9) continue;
    const t = cross(offset, edge) / denominator,
      u = cross(offset, direction) / denominator;
    if (t >= 0 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  return Number.isFinite(best)
    ? { x: center.x + direction.x * best, y: center.y + direction.y * best }
    : center;
}
