import {
  cardGroups,
  frameBounds,
  groupCardIds,
  groupDepth,
  groupTree,
} from '../graph/card-groups.js';
import { startGroupDrag } from './multi-selection.js';
import { t } from '../i18n/index.js';

const SVG = 'http://www.w3.org/2000/svg';
/** Point where a ray from the centre of `rect` towards `toward` leaves the rectangle. */
function exitPoint(rect, toward) {
  const cx = rect.x + rect.width / 2,
    cy = rect.y + rect.height / 2;
  const dx = toward.x - cx,
    dy = toward.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const scale = Math.min(
    dx ? rect.width / 2 / Math.abs(dx) : Infinity,
    dy ? rect.height / 2 / Math.abs(dy) : Infinity,
  );
  return { x: cx + dx * scale, y: cy + dy * scale };
}
const inside = (rect, point) =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

export function createGroupFrames(adapter) {
  const layer = document.createElement('div');
  layer.id = 'group-frames-layer';
  adapter.layer.before(layer);
  const elements = new Map();
  // Arrows from a card to a group frame are drawn here, under the cards like relation edges.
  const arrows = document.createElementNS(SVG, 'svg');
  arrows.classList.add('group-links');
  arrows.innerHTML =
    '<defs><marker id="group-link-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>';
  layer.append(arrows);
  const byId = new Map();
  let boundsList = [],
    project = null,
    hidden = new Set();
  function paint(positions) {
    boundsList = [];
    byId.clear();
    for (const path of arrows.querySelectorAll('path[data-link-id]')) path.remove();
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
    // Subgroups first, so each parent frame can enclose the frames inside it.
    const { children } = groupTree(project);
    const depth = new Map(cardGroups(project).map((g) => [g.id, groupDepth(project, g.id)]));
    const ordered = [...cardGroups(project)].sort((a, b) => depth.get(b.id) - depth.get(a.id));
    for (const group of ordered) {
      const el = elements.get(group.id);
      if (!el) continue;
      const bounds = frameBounds(
        rects,
        group.cardIds.filter((id) => !hidden.has(id)),
        (children.get(group.id) || []).map((id) => byId.get(id)).filter(Boolean),
      );
      // Deeper frames sit above their parents so their titles stay clickable.
      el.style.zIndex = String(depth.get(group.id));
      el.hidden = !bounds;
      if (bounds) boundsList.push(bounds);
      if (bounds) byId.set(group.id, bounds);
      if (bounds)
        Object.assign(el.style, {
          left: bounds.x + 'px',
          top: bounds.y + 'px',
          width: bounds.width + 'px',
          height: bounds.height + 'px',
        });
    }
    for (const group of cardGroups(project)) {
      const frame = byId.get(group.id);
      if (!frame) continue;
      for (const link of group.links || []) {
        const card = rects.get(link.source);
        if (!card || hidden.has(link.source)) continue;
        const cardRect = { ...card.position, ...card.size };
        const center = {
          x: cardRect.x + cardRect.width / 2,
          y: cardRect.y + cardRect.height / 2,
        };
        // A card lying on the frame has no visible gap to draw an arrow across.
        if (inside(frame, center)) continue;
        const frameCenter = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
        const start = exitPoint(cardRect, frameCenter);
        const end = exitPoint(frame, center);
        const path = document.createElementNS(SVG, 'path');
        path.dataset.linkId = link.id;
        path.dataset.groupId = group.id;
        path.dataset.source = link.source;
        path.setAttribute('d', 'M' + start.x + ' ' + start.y + 'L' + end.x + ' ' + end.y);
        path.setAttribute('marker-end', 'url(#group-link-arrow)');
        arrows.append(path);
      }
    }
  }
  return {
    bounds: () => boundsList,
    /** Group whose frame contains a graph point (the smallest one when frames overlap). */
    groupAt(point) {
      let found = null;
      for (const [id, rect] of byId)
        if (inside(rect, point) && (!found || rect.width * rect.height < found.area))
          found = { id, area: rect.width * rect.height };
      return found?.id || null;
    },
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
            const members = groupCardIds(project, group.id);
            const first =
              members.find((id) => !adapter.cards.get(id)?.classList.contains('pinned-card')) ||
              members[0];
            if (!first) return;
            startGroupDrag(adapter, e, first, { members, target: handle });
          };
          handle.onclick = (e) => {
            const source = adapter.callbacks.connectingFrom?.();
            if (!source) return;
            e.stopPropagation();
            adapter.callbacks.groupConnection(source, group.id);
          };
          handle.onkeydown = (e) => {
            const source = adapter.callbacks.connectingFrom?.();
            if ((e.key === 'Enter' || e.key === ' ') && source) {
              e.preventDefault();
              e.stopPropagation();
              adapter.callbacks.groupConnection(source, group.id);
              return;
            }
            if ((e.key === 'Enter' || e.key === ' ') && !adapter.callbacks.groupLocked()) {
              e.preventDefault();
              e.stopPropagation();
              adapter.callbacks.selectMany(groupCardIds(project, group.id));
            }
          };
          const top = document.createElement('div');
          top.className = 'group-frame-title-row';
          top.append(handle);
          header.append(top);
          const description = document.createElement('p');
          description.className = 'group-frame-description';
          for (const action of ['edit', 'ungroup']) {
            const b = document.createElement('button');
            b.type = 'button';
            b.dataset.groupAction = action;
            b.onpointerdown = (e) => e.stopPropagation();
            b.onclick = (e) => {
              e.stopPropagation();
              if (!adapter.callbacks.groupLocked()) adapter.callbacks.groupAction(group.id, action);
            };
            top.append(b);
          }
          header.append(description);
          el.append(header);
          layer.append(el);
          elements.set(group.id, el);
        }
        const handle = el.querySelector('.group-frame-handle');
        const count = groupCardIds(project, group.id).length;
        handle.textContent = group.title + ' · ' + count;
        handle.setAttribute('aria-label', t('groupMove', { title: group.title, count }));
        el.dataset.depth = String(groupDepth(project, group.id));
        handle.title = t('groupMoveHint');
        const description = el.querySelector('.group-frame-description');
        description.textContent = group.description || '';
        description.title = group.description || '';
        description.hidden = !group.description;
        for (const b of el.querySelectorAll('button'))
          b.textContent = t(b.dataset.groupAction === 'edit' ? 'groupEdit' : 'groupUngroup');
      }
      paint();
    },
  };
}
