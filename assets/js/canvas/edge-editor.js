import {
  EDGE,
  edgeRoute,
  edgePath,
  initialCorners,
  orthogonalCorners,
  edgeMode,
} from '../graph/edge-routing.js';
import { autoRouteStyle } from '../graph/auto-routing.js';
import { isPinned } from '../graph/card-metadata.js';
import { t } from '../i18n/index.js';

function storedPath(relation, view, a, b) {
  const config = relation.extensions?.[EDGE],
    corners = config?.corners?.[view];
  if (edgeRoute(relation) === 'orthogonal' && corners) return orthogonalCorners(a, b, corners);
  const offset = config?.adjustments?.[view];
  return offset !== undefined && ['curved', 'orthogonal'].includes(edgeRoute(relation))
    ? edgePath(edgeRoute(relation), a, b, offset)
    : null;
}
export function applyEdgePath(edge, relation, view, automatic) {
  if (edge.scratch('manualAdjusted')) {
    edge.removeStyle(
      'curve-style edge-distances control-point-distances control-point-weights segment-distances segment-weights source-endpoint target-endpoint line-opacity line-style',
    );
    edge.scratch('manualAdjusted', false);
  }
  const path = automatic
    ? { style: autoRouteStyle(automatic, edge.source().position(), edge.target().position()) }
    : storedPath(relation, view, edge.source().position(), edge.target().position());
  if (path) {
    edge.scratch('manualAdjusted', true);
    edge.style(path.style);
  }
}
const clamp = (v) => Math.round(Math.max(-10000, Math.min(10000, v)));
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
  const handles = ['rail', 'source', 'target'].map((key, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = i ? 'edge-corner-handle' : 'edge-adjust-handle';
    el.dataset.edgeHandle = key;
    el.hidden = true;
    if (i) el.textContent = String(i);
    adapter.region.append(el);
    return el;
  });
  adapter.region.append(host);
  let id = null,
    project = null,
    drag = null;
  function context() {
    if (!id) return null;
    const r = project?.relations.find((r) => r.id === id),
      edge = adapter.cy.getElementById('r:' + id);
    if (
      !r ||
      r.source === r.target ||
      (edgeRoute(r) === 'orthogonal' && edgeMode(r, adapter.activeView) === 'auto') ||
      edge.empty() ||
      edge.style('display') === 'none' ||
      !['curved', 'orthogonal'].includes(edgeRoute(r))
    )
      return null;
    if ([r.source, r.target].some((id) => isPinned(project.cards.find((c) => c.id === id))))
      return null;
    const a = edge.source().position(),
      b = edge.target().position(),
      route = edgeRoute(r),
      config = r.extensions?.[EDGE],
      value = config?.adjustments?.[adapter.activeView] ?? (route === 'curved' ? 55 : 0),
      stored = config?.corners?.[adapter.activeView];
    const corners = drag?.corners ?? stored;
    const path =
      corners && route === 'orthogonal'
        ? orthogonalCorners(a, b, corners)
        : edgePath(route, a, b, drag?.value ?? value);
    const controls = corners ?? initialCorners(a, b, value);
    const points = orthogonalCorners(a, b, controls);
    return { r, edge, a, b, route, value, stored, corners, controls, path, points };
  }
  function paint() {
    const c = context(),
      visible = Boolean(c && (drag || !adapter.callbacks.groupLocked()));
    host.hidden = !visible;
    if (!visible) {
      for (const handle of handles) handle.hidden = true;
      return;
    }
    const pan = adapter.cy.pan(),
      z = adapter.cy.zoom();
    handles.forEach((el, i) => {
      el.hidden = !visible || (i > 0 && c?.route !== 'orthogonal');
      if (el.hidden) return;
      const p = i === 0 ? c.path.handle : i === 1 ? c.points.source : c.points.target;
      Object.assign(el.style, { left: p.x * z + pan.x + 'px', top: p.y * z + pan.y + 'px' });
      el.title = t(i ? 'edgeCorner' + i : 'edgeHandle');
      el.setAttribute('aria-label', el.title);
    });
    hint.textContent = t(c?.route === 'orthogonal' ? 'edgeCornerHint' : 'edgeAdjustHint');
    reset.textContent = t('edgeReset');
    done.textContent = t('done');
  }
  function cancel() {
    if (!drag) return;
    const c = context();
    drag = null;
    adapter.edgeDragging = false;
    if (c) applyEdgePath(c.edge, c.r, adapter.activeView);
    paint();
  }
  function commit(corners, value) {
    if (corners) adapter.callbacks.edgeCorners(id, corners);
    else adapter.callbacks.edgeOffset(id, value);
  }
  function finish() {
    if (!drag) return;
    const d = drag;
    cancel();
    if (d.changed) commit(d.corners, d.value);
  }
  function point(e) {
    const b = adapter.region.getBoundingClientRect(),
      p = adapter.cy.pan(),
      z = adapter.cy.zoom();
    return { x: (e.clientX - b.left - p.x) / z, y: (e.clientY - b.top - p.y) / z };
  }
  function shifted(c, kind, dx, dy) {
    const result = structuredClone(c);
    for (const key of kind === 'rail' ? ['source', 'target'] : [kind]) {
      result[key].x = clamp(result[key].x + dx);
      result[key].y = clamp(result[key].y + dy);
    }
    return result;
  }
  for (const handle of handles) {
    const kind = handle.dataset.edgeHandle;
    handle.onpointerdown = (e) => {
      if (e.button !== 0 || adapter.callbacks.groupLocked()) return;
      const c = context();
      if (!c) return;
      e.preventDefault();
      e.stopPropagation();
      drag = {
        kind,
        initial: c,
        start: point(e),
        value: c.value,
        corners: c.stored ? structuredClone(c.stored) : null,
        changed: false,
      };
      adapter.edgeDragging = true;
      handle.setPointerCapture(e.pointerId);
    };
    handle.onpointermove = (e) => {
      if (!drag || drag.kind !== kind) return;
      e.preventDefault();
      const p = point(e),
        c = drag.initial,
        dx = p.x - drag.start.x,
        dy = p.y - drag.start.y;
      drag.changed = Math.abs(dx) + Math.abs(dy) > 1;
      if (kind !== 'rail' || c.stored) drag.corners = shifted(c.controls, kind, dx, dy);
      else drag.value = Math.round(Math.max(-2000, Math.min(2000, c.path.offset(p))));
      const next = context();
      next.edge.scratch('manualAdjusted', true);
      next.edge.style(next.path.style);
      paint();
    };
    handle.onpointerup = finish;
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
      if (!c) return;
      const step = e.shiftKey ? 10 : 1;
      if (kind !== 'rail' || c.stored) {
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0,
          dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        commit(shifted(c.controls, kind, dx, dy));
      } else
        commit(
          null,
          Math.max(
            -2000,
            Math.min(2000, c.value + (['ArrowUp', 'ArrowLeft'].includes(e.key) ? -step : step)),
          ),
        );
    };
  }
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
      handles[0].focus({ preventScroll: true });
    },
    sync(next, selection) {
      cancel();
      if (selection?.kind !== 'relation' || selection.id !== id) id = null;
      project = next;
      paint();
    },
  };
}
