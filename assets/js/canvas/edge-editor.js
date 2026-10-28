import { EDGE, edgeRoute, edgePath } from '../graph/edge-routing.js';
import { isPinned } from '../graph/card-metadata.js';
import { t } from '../i18n/index.js';

export function applyEdgePath(edge, relation, view) {
  if (edge.scratch('manualAdjusted')) {
    edge.removeStyle(
      'curve-style edge-distances control-point-distances control-point-weights segment-distances segment-weights',
    );
    edge.scratch('manualAdjusted', false);
  }
  const offset = relation.extensions?.[EDGE]?.adjustments?.[view];
  if (offset !== undefined && ['curved', 'orthogonal'].includes(edgeRoute(relation))) {
    edge.scratch('manualAdjusted', true);
    edge.style(
      edgePath(edgeRoute(relation), edge.source().position(), edge.target().position(), offset)
        .style,
    );
  }
}
export function createEdgeEditor(adapter) {
  const host = document.createElement('div');
  host.className = 'edge-adjust-tools';
  host.hidden = true;
  const hint = document.createElement('span'),
    reset = document.createElement('button'),
    done = document.createElement('button');
  reset.type = done.type = 'button';
  reset.dataset.edgeAction = 'reset';
  done.dataset.edgeAction = 'done';
  host.append(hint, reset, done);
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'edge-adjust-handle';
  handle.hidden = true;
  adapter.region.append(host, handle);
  let id = null,
    project = null,
    drag = null;
  function context() {
    const r = project?.relations.find((r) => r.id === id),
      edge = adapter.cy.getElementById('r:' + id);
    if (
      !r ||
      r.source === r.target ||
      edge.empty() ||
      edge.style('display') === 'none' ||
      !['curved', 'orthogonal'].includes(edgeRoute(r))
    )
      return null;
    if ([r.source, r.target].some((id) => isPinned(project.cards.find((c) => c.id === id))))
      return null;
    const value =
      r.extensions?.[EDGE]?.adjustments?.[adapter.activeView] ??
      (edgeRoute(r) === 'curved' ? 55 : 0);
    return {
      r,
      edge,
      value,
      path: edgePath(
        edgeRoute(r),
        edge.source().position(),
        edge.target().position(),
        drag?.value ?? value,
      ),
    };
  }
  function paint() {
    const c = context(),
      visible = Boolean(c && (drag || !adapter.callbacks.groupLocked()));
    host.hidden = handle.hidden = !visible;
    if (!visible) return;
    const p = adapter.cy.pan(),
      z = adapter.cy.zoom();
    Object.assign(handle.style, {
      left: c.path.handle.x * z + p.x + 'px',
      top: c.path.handle.y * z + p.y + 'px',
    });
    hint.textContent = t('edgeAdjustHint');
    reset.textContent = t('edgeReset');
    done.textContent = t('done');
    handle.title = t('edgeHandle');
    handle.setAttribute('aria-label', t('edgeHandle'));
  }
  function cancel() {
    if (!drag) return;
    const c = context();
    drag = null;
    adapter.edgeDragging = false;
    if (c) applyEdgePath(c.edge, c.r, adapter.activeView);
    paint();
  }
  function finish(commit) {
    if (!drag) return;
    const value = drag.value,
      original = drag.original;
    cancel();
    if (commit && Math.abs(value - original) > 0.01) adapter.callbacks.edgeOffset(id, value);
  }
  handle.onpointerdown = (e) => {
    if (e.button !== 0 || adapter.callbacks.groupLocked()) return;
    const c = context();
    if (!c) return;
    e.preventDefault();
    e.stopPropagation();
    drag = { pointer: e.pointerId, original: c.value, value: c.value };
    adapter.edgeDragging = true;
    handle.setPointerCapture(e.pointerId);
  };
  handle.onpointermove = (e) => {
    if (!drag) return;
    e.preventDefault();
    const c = context(),
      b = adapter.region.getBoundingClientRect(),
      p = adapter.cy.pan(),
      z = adapter.cy.zoom();
    drag.value = Math.round(
      Math.max(
        -2000,
        Math.min(
          2000,
          c.path.offset({ x: (e.clientX - b.left - p.x) / z, y: (e.clientY - b.top - p.y) / z }),
        ),
      ),
    );
    c.edge.scratch('manualAdjusted', true);
    c.edge.style(
      edgePath(edgeRoute(c.r), c.edge.source().position(), c.edge.target().position(), drag.value)
        .style,
    );
    paint();
  };
  handle.onpointerup = () => finish(true);
  handle.onpointercancel = cancel;
  handle.onlostpointercapture = cancel;
  handle.onkeydown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (drag) cancel();
      else {
        id = null;
        paint();
      }
      return;
    }
    if (
      !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) ||
      adapter.callbacks.groupLocked()
    )
      return;
    e.preventDefault();
    e.stopPropagation();
    const c = context();
    if (c)
      adapter.callbacks.edgeOffset(
        id,
        Math.max(
          -2000,
          Math.min(
            2000,
            c.value + (['ArrowUp', 'ArrowLeft'].includes(e.key) ? -1 : 1) * (e.shiftKey ? 10 : 1),
          ),
        ),
      );
  };
  host.onpointerdown = (e) => e.stopPropagation();
  reset.onclick = () => {
    if (!adapter.callbacks.groupLocked()) adapter.callbacks.edgeOffset(id, null);
  };
  done.onclick = () => {
    cancel();
    id = null;
    paint();
  };
  window.addEventListener('blur', cancel);
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && drag) {
        e.preventDefault();
        e.stopImmediatePropagation();
        cancel();
      }
    },
    true,
  );
  return {
    paint,
    cancel,
    start(next) {
      cancel();
      id = next;
      paint();
      handle.focus({ preventScroll: true });
    },
    sync(next, selection) {
      cancel();
      if (selection?.kind !== 'relation' || selection.id !== id) id = null;
      project = next;
      paint();
    },
  };
}
