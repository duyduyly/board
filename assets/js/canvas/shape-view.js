import { appearance } from '../detail/appearance.js';
import { shapes, shapePoints, safeArea, shapeAnchor } from '../graph/shape-registry.js';
const ns = 'http://www.w3.org/2000/svg';
export function applyShape(el, card, size) {
  el.querySelector('.shape-outline')?.remove();
  const previous = el.querySelector('.shape-content');
  if (previous) {
    previous.replaceWith(...previous.children);
  }
  const a = appearance(card),
    shape = a.shape;
  el.classList.toggle('shaped-node', Boolean(shape));
  if (!shape) {
    delete el.dataset.shape;
    return;
  }
  el.dataset.shape = shape;
  const points = shapePoints(shape, size, a.radius),
    area = safeArea(shape, size, 16, a.radius);
  if (el.classList.contains('paper-note')) {
    area.y += 24;
    area.height = Math.max(1, area.height - 24);
  }
  const content = document.createElement('div');
  content.className = 'shape-content';
  for (const child of [...el.children]) {
    const open = child.querySelector?.('.card-open');
    if (open) el.append(open);
    if (
      child.matches(
        '.connector,.card-open,.branch-toggle,.node-hierarchy-marker,.resize-handle,.card-status-strip',
      )
    )
      continue;
    if (shapes[shape].compact && child.matches('.card-kicker,.card-summary,.card-meta')) {
      child.remove();
      continue;
    }
    content.append(child);
  }
  Object.assign(content.style, {
    left: area.x + 'px',
    top: area.y + 'px',
    width: area.width + 'px',
    height: area.height + 'px',
  });
  const svg = document.createElementNS(ns, 'svg');
  svg.classList.add('shape-outline');
  svg.setAttribute('viewBox', '0 0 ' + size.width + ' ' + size.height);
  svg.setAttribute('aria-hidden', 'true');
  const polygon = document.createElementNS(ns, 'polygon');
  polygon.setAttribute('points', points.map((p) => p.x + ',' + p.y).join(' '));
  polygon.style.strokeWidth = a.borderWidth + 'px';
  svg.append(polygon);
  el.prepend(svg, content);
  const open = el.querySelector('.card-open');
  if (open) {
    const p = shapeAnchor(points, { x: size.width / 2, y: size.height / 2 }, { x: 1, y: -1 });
    Object.assign(open.style, { left: p.x - 8 + 'px', top: p.y - 24 + 'px', right: 'auto' });
  }
  const connector = el.querySelector('.connector');
  if (connector) {
    const p = shapeAnchor(points, { x: size.width / 2, y: size.height / 2 }, { x: 1, y: 0 });
    Object.assign(connector.style, { left: p.x - 9 + 'px', top: p.y - 9 + 'px', right: 'auto' });
  }
  const toggle = el.querySelector('.branch-toggle');
  if (toggle) {
    const p = shapeAnchor(points, { x: size.width / 2, y: size.height / 2 }, { x: -1, y: 0 });
    Object.assign(toggle.style, { left: p.x - 11 + 'px', top: p.y - 11 + 'px' });
  }
  return points;
}
