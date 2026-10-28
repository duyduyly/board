import { resizeShape, shapes } from '../graph/shape-registry.js';
import { appearance } from '../detail/appearance.js';
import { applyShape } from './shape-view.js';
import { t } from '../i18n/index.js';
import { isPinned } from '../graph/card-metadata.js';
import { compactOverview } from './overview.js';
export function installResize(adapter, el, card, size) {
  if (isPinned(card)) return;
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'resize-handle';
  handle.title = t('resizeNode');
  handle.setAttribute('aria-label', t('resizeNode'));
  handle.addEventListener('keydown', (e) => e.stopPropagation());
  handle.addEventListener('dblclick', (e) => e.stopPropagation());
  handle.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (e.button !== 0 || adapter.callbacks.locked()) return;
    e.preventDefault();
    const node = adapter.cy.getElementById('c:' + card.id),
      position = { ...node.position() },
      start = adapter.graphPoint(e.clientX, e.clientY),
      zoom = adapter.cy.zoom();
    let next = size,
      moved = false,
      finished = false;
    handle.setPointerCapture(e.pointerId);
    el.classList.add('resizing');
    const paint = (s) => {
      el.classList.toggle('compact-summary', compactOverview(card, s));
      el.style.width = s.width + 'px';
      el.style.height = s.height + 'px';
      node.data({ width: s.width, height: s.height });
      node.position({ x: card.position.x + s.width / 2, y: card.position.y + s.height / 2 });
      const points = applyShape(el, card, s);
      if (points)
        node.data(
          'polygon',
          points.flatMap((p) => [(p.x / s.width) * 2 - 1, (p.y / s.height) * 2 - 1]),
        );
      adapter.groupFrames?.paint();
    };
    const cleanup = () => {
      if (finished) return;
      finished = true;
      adapter.cancelResize = null;
      adapter.resizing = false;
      el.classList.remove('resizing');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', cancel);
      handle.removeEventListener('lostpointercapture', cancel);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', cancel);
      if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
    };
    const cancel = () => {
      if (finished) return;
      paint(size);
      node.position(position);
      cleanup();
    };
    const key = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        cancel();
      }
    };
    const move = (event) => {
      const p = adapter.graphPoint(event.clientX, event.clientY),
        dx = p.x - start.x,
        dy = p.y - start.y;
      if ((Math.abs(dx) + Math.abs(dy)) * zoom > 3) moved = true;
      if (moved) {
        const shape = appearance(card).shape,
          ratio = shapes[shape]?.ratio || 1;
        next = resizeShape(
          shape,
          size.width + dx,
          size.height + dy,
          Math.abs(dx) >= Math.abs(dy * ratio) ? 'width' : 'height',
        );
        paint(next);
      }
    };
    const end = () => {
      if (finished) return;
      cleanup();
      if (moved && (next.width !== size.width || next.height !== size.height))
        adapter.callbacks.resize(card.id, next);
      else paint(size);
    };
    adapter.cancelResize = cancel;
    adapter.resizing = true;
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', cancel);
    handle.addEventListener('lostpointercapture', cancel);
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', cancel);
  });
  el.append(handle);
}
