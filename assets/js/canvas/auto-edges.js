import { autoRoutes } from '../graph/auto-routing.js';
import { edgeMode, edgeRoute } from '../graph/edge-routing.js';
import { t } from '../i18n/index.js';

export function createAutoEdges(adapter) {
  const status = document.createElement('div');
  status.id = 'auto-route-status';
  status.className = 'auto-route-status';
  status.setAttribute('role', 'status');
  status.hidden = true;
  adapter.region.append(status);
  let signature = null,
    paths = new Map(),
    failed = 0,
    lastProject = null,
    lastView = null,
    lastHidden = null;
  return {
    sync(project, view, hidden) {
      if (project === lastProject && view === lastView && hidden === lastHidden) {
        if (paths.size)
          status.textContent = t(failed ? 'autoRouteBlocked' : 'autoRouteStatus', {
            count: paths.size,
            failed,
          });
        return paths;
      }
      lastProject = project;
      lastView = view;
      lastHidden = hidden;
      const enabled = project.relations.filter(
        (r) =>
          view !== 'mind' &&
          edgeRoute(r) === 'orthogonal' &&
          edgeMode(r, view) === 'auto' &&
          !hidden.has(r.source) &&
          !hidden.has(r.target),
      );
      if (!enabled.length) {
        paths = new Map();
        signature = null;
        status.hidden = true;
        return paths;
      }
      const rects = new Map();
      for (const c of project.cards) {
        if (hidden.has(c.id)) continue;
        const n = adapter.cy.getElementById('c:' + c.id),
          width = n.data('width'),
          height = n.data('height'),
          pos = n.position(),
          poly = n.data('polygon');
        const points =
          n.data('nodeShape') === 'polygon'
            ? Array.from({ length: poly.length / 2 }, (_, i) => ({
                x: ((poly[i * 2] + 1) * width) / 2,
                y: ((poly[i * 2 + 1] + 1) * height) / 2,
              }))
            : undefined;
        rects.set(c.id, {
          id: c.id,
          x: pos.x - width / 2,
          y: pos.y - height / 2,
          width,
          height,
          points,
        });
      }
      const next = JSON.stringify([
        view,
        enabled.map((r) => [r.id, r.source, r.target]),
        [...rects.values()],
      ]);
      if (next !== signature) {
        paths = autoRoutes(project, rects, view);
        failed = [...paths.values()].filter((p) => p.failed).length;
        signature = next;
      }
      status.hidden = false;
      status.textContent = t(failed ? 'autoRouteBlocked' : 'autoRouteStatus', {
        count: enabled.length,
        failed,
      });
      status.classList.toggle('warning', Boolean(failed));
      return paths;
    },
  };
}
