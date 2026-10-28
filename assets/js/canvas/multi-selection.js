const controls = 'button, input, select, textarea, .card-created-date, .resize-handle';

// All gesture geometry is transient. The host alone selects and commits project changes.
export function installMultiSelection(adapter) {
  const { region, callbacks } = adapter;
  region.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0 || !event.shiftKey || adapter.space || callbacks.groupLocked()) return;
      const card = event.target.closest('.graph-card');
      if (event.target.closest(controls) || (!card && !event.target.closest('#graph'))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (card) {
        const ids = new Set(adapter.selectedCards);
        if (!ids.delete(card.dataset.id)) ids.add(card.dataset.id);
        callbacks.selectMany([...ids]);
      } else startMarquee(adapter, event);
    },
    true,
  );
  for (const type of ['click', 'dblclick'])
    region.addEventListener(
      type,
      (event) => {
        if (
          event.shiftKey &&
          event.target.closest('.graph-card') &&
          !event.target.closest(controls)
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true,
    );
  region.addEventListener(
    'keydown',
    (event) => {
      if (
        event.shiftKey &&
        event.code === 'Space' &&
        event.target.matches('.graph-card') &&
        !callbacks.groupLocked()
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const ids = new Set(adapter.selectedCards);
        if (!ids.delete(event.target.dataset.id)) ids.add(event.target.dataset.id);
        callbacks.selectMany([...ids]);
      }
    },
    true,
  );
}

function gesture(adapter, event, { move, finish, restore, target = adapter.region }) {
  const panning = adapter.cy.userPanningEnabled();
  let active = true;
  adapter.gesturing = true;
  adapter.cy.userPanningEnabled(false);
  target.setPointerCapture(event.pointerId);
  const cleanup = () => {
    active = false;
    adapter.cancelGesture = null;
    adapter.gesturing = false;
    target.removeEventListener('pointermove', onMove);
    target.removeEventListener('pointerup', end);
    target.removeEventListener('pointercancel', cancel);
    target.removeEventListener('lostpointercapture', cancel);
    window.removeEventListener('keydown', key, true);
    window.removeEventListener('blur', cancel);
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
    adapter.cy.userPanningEnabled(panning);
  };
  const onMove = (e) => {
    if (e.pointerId === event.pointerId) move(e);
  };
  const cancel = () => {
    if (!active) return;
    cleanup();
    restore();
  };
  const end = (e) => {
    if (!active || e.pointerId !== event.pointerId) return;
    move(e);
    cleanup();
    finish();
  };
  const key = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      cancel();
    } else if (!['Shift', 'Control', 'Meta', 'Alt'].includes(e.key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };
  adapter.cancelGesture = cancel;
  target.addEventListener('pointermove', onMove);
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', cancel);
  target.addEventListener('lostpointercapture', cancel);
  window.addEventListener('keydown', key, true);
  window.addEventListener('blur', cancel);
}

export function startGroupDrag(
  adapter,
  event,
  id,
  { members, target = adapter.cards.get(id) } = {},
) {
  const { callbacks } = adapter;
  if (callbacks.groupLocked()) return false;
  event.preventDefault();
  event.stopPropagation();
  if (members) callbacks.selectMany(members);
  else if (!adapter.selectedCards.has(id)) callbacks.selectMany([id]);
  if (adapter.cards.get(id).classList.contains('pinned-card')) return true;
  const items = [...new Set(members || adapter.selectedCards)]
    .filter((key) => members || !adapter.hiddenNodes.has(key))
    .map((key) => {
      const el = adapter.cards.get(key);
      const node = adapter.cy.getElementById('c:' + key);
      return { id: key, el, node, position: { ...node.position() } };
    })
    .filter(({ el }) => !el.classList.contains('pinned-card'));
  const start = adapter.graphPoint(event.clientX, event.clientY);
  const zoom = adapter.cy.zoom();
  // Transform one overlay for groups; keep live edge geometry for a single card.
  // Moving every Cytoscape node and laying out hundreds of overlays each frame
  // is expensive. Incident curves return after the atomic commit/cancel.
  const group = items.length > 1 ? document.createElement('div') : null;
  const slots = [];
  const ids = new Set(items.map((item) => item.id));
  const edges = group
    ? adapter.cy
        .edges()
        .filter(
          (edge) => ids.has(edge.source().data('appId')) || ids.has(edge.target().data('appId')),
        )
    : null;
  if (group) {
    group.className = 'group-drag-layer';
    adapter.layer.append(group);
    for (const { el } of items) {
      const slot = document.createComment('drag');
      el.before(slot);
      slots.push({
        el,
        slot,
        focused: el.contains(document.activeElement) ? document.activeElement : null,
      });
      group.append(el);
    }
  }
  const restore = () => {
    if (!group) {
      paint({ x: 0, y: 0 });
      return;
    }
    for (const { el, slot, focused } of slots) {
      slot.replaceWith(el);
      focused?.focus({ preventScroll: true });
    }
    group.remove();
    edges.removeClass('group-preview');
    adapter.groupFrames?.paint();
  };
  let delta = { x: 0, y: 0 },
    moved = false;
  const paint = (d) =>
    adapter.cy.batch(() => {
      for (const { el, node, position } of items) {
        node.position({ x: position.x + d.x, y: position.y + d.y });
        el.style.left = position.x + d.x - node.data('width') / 2 + 'px';
        el.style.top = position.y + d.y - node.data('height') / 2 + 'px';
      }
      adapter.groupFrames?.paint();
    });
  gesture(adapter, event, {
    target,
    move(e) {
      const p = adapter.graphPoint(e.clientX, e.clientY);
      const next = { x: p.x - start.x, y: p.y - start.y };
      if (Math.hypot(next.x, next.y) * zoom > 3) moved = true;
      if (moved) {
        delta = next;
        if (group) {
          if (!group.style.transform) edges.addClass('group-preview');
          group.style.transform = `translate(${delta.x}px, ${delta.y}px)`;
          adapter.groupFrames?.paint(
            new Map(
              items.map((item) => [
                item.id,
                {
                  x: item.position.x + delta.x - item.node.data('width') / 2,
                  y: item.position.y + delta.y - item.node.data('height') / 2,
                },
              ]),
            ),
          );
        } else {
          adapter.deferEdges();
          paint(delta);
        }
      }
    },
    restore,
    finish() {
      restore();
      if (moved)
        callbacks.moveMany(
          items.map((item) => item.id),
          delta,
        );
    },
  });
  return true;
}

function startMarquee(adapter, event) {
  const rect = adapter.region.getBoundingClientRect();
  const start = adapter.graphPoint(event.clientX, event.clientY);
  const original = new Set(adapter.selectedCards);
  const box = document.createElement('div');
  box.className = 'selection-marquee';
  box.setAttribute('aria-hidden', 'true');
  adapter.region.append(box);
  let ids = [...original],
    moved = false;
  gesture(adapter, event, {
    move(e) {
      if (Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) > 3) moved = true;
      if (!moved) return;
      const end = adapter.graphPoint(e.clientX, e.clientY);
      const left = Math.min(start.x, end.x),
        right = Math.max(start.x, end.x);
      const top = Math.min(start.y, end.y),
        bottom = Math.max(start.y, end.y);
      box.style.left = Math.min(event.clientX, e.clientX) - rect.left + 'px';
      box.style.top = Math.min(event.clientY, e.clientY) - rect.top + 'px';
      box.style.width = Math.abs(e.clientX - event.clientX) + 'px';
      box.style.height = Math.abs(e.clientY - event.clientY) + 'px';
      const selected = new Set(original);
      for (const [id, el] of adapter.cards) {
        if (el.hidden) continue;
        const n = adapter.cy.getElementById('c:' + id),
          p = n.position(),
          w = n.data('width') / 2,
          h = n.data('height') / 2;
        if (p.x + w >= left && p.x - w <= right && p.y + h >= top && p.y - h <= bottom)
          selected.add(id);
      }
      ids = [...selected];
      adapter.paintSelection(selected);
    },
    restore() {
      box.remove();
      adapter.paintSelection(original);
    },
    finish() {
      box.remove();
      if (moved) adapter.callbacks.selectMany(ids);
    },
  });
}
