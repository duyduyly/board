import { cardGroups, frameBounds } from '../graph/card-groups.js';
import { startGroupDrag } from './multi-selection.js';
import { t } from '../i18n/index.js';

export function createGroupFrames(adapter) {
  const layer = document.createElement('div');
  layer.id = 'group-frames-layer';
  adapter.layer.before(layer);
  const elements = new Map();
  let boundsList = [],
    project = null,
    hidden = new Set();
  const current = (id) => cardGroups(project).find((g) => g.id === id);
  function paint(positions) {
    boundsList = [];
    if (!project || !elements.size) return;
    layer.style.transform = adapter.layer.style.transform;
    const rects = new Map();
    for (const card of project.cards) {
      const n = adapter.cy.getElementById('c:' + card.id);
      if (n.empty()) continue;
      rects.set(card.id, {
        position: positions?.get(card.id) || {
          x: n.position('x') - n.data('width') / 2,
          y: n.position('y') - n.data('height') / 2,
        },
        size: { width: n.data('width'), height: n.data('height') },
      });
    }
    for (const group of cardGroups(project)) {
      const el = elements.get(group.id);
      if (!el) continue;
      const bounds = frameBounds(
        rects,
        group.cardIds.filter((id) => !hidden.has(id)),
      );
      el.hidden = !bounds;
      if (bounds) boundsList.push(bounds);
      if (bounds)
        Object.assign(el.style, {
          left: bounds.x + 'px',
          top: bounds.y + 'px',
          width: bounds.width + 'px',
          height: bounds.height + 'px',
        });
    }
  }
  return {
    bounds: () => boundsList,
    paint,
    sync(next, viewHidden) {
      project = next;
      hidden = viewHidden;
      const ids = new Set(cardGroups(project).map((g) => g.id));
      for (const [id, el] of elements)
        if (!ids.has(id)) {
          el.remove();
          elements.delete(id);
        }
      for (const group of cardGroups(project)) {
        let el = elements.get(group.id);
        if (!el) {
          el = document.createElement('section');
          el.className = 'group-frame';
          el.dataset.groupId = group.id;
          const header = document.createElement('div');
          header.className = 'group-frame-header';
          const handle = document.createElement('div');
          handle.className = 'group-frame-handle';
          handle.tabIndex = 0;
          handle.setAttribute('role', 'button');
          handle.onpointerdown = (e) => {
            if (e.button !== 0 || adapter.space || adapter.callbacks.groupLocked()) return;
            const g = current(group.id);
            const first =
              g.cardIds.find((id) => !adapter.cards.get(id)?.classList.contains('pinned-card')) ||
              g.cardIds[0];
            startGroupDrag(adapter, e, first, { members: g.cardIds, target: handle });
          };
          handle.onkeydown = (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !adapter.callbacks.groupLocked()) {
              e.preventDefault();
              e.stopPropagation();
              adapter.callbacks.selectMany(current(group.id).cardIds);
            }
          };
          header.append(handle);
          for (const action of ['edit', 'ungroup']) {
            const b = document.createElement('button');
            b.type = 'button';
            b.dataset.groupAction = action;
            b.onpointerdown = (e) => e.stopPropagation();
            b.onclick = (e) => {
              e.stopPropagation();
              if (!adapter.callbacks.groupLocked()) adapter.callbacks.groupAction(group.id, action);
            };
            header.append(b);
          }
          el.append(header);
          layer.append(el);
          elements.set(group.id, el);
        }
        const handle = el.querySelector('.group-frame-handle');
        handle.textContent = group.title + ' · ' + group.cardIds.length;
        handle.setAttribute(
          'aria-label',
          t('groupMove', { title: group.title, count: group.cardIds.length }),
        );
        handle.title = t('groupMoveHint');
        for (const b of el.querySelectorAll('button'))
          b.textContent = t(b.dataset.groupAction === 'edit' ? 'groupEdit' : 'groupUngroup');
      }
      paint();
    },
  };
}
