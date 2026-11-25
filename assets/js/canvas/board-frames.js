import { t, getLocale } from '../i18n/index.js';

const MIN_LABEL_ZOOM = 0.85; // Label stays at least this fraction of its normal on-screen size.
const MAX_LABEL_SCALE = 2.5;

/**
 * Read-only frames drawn behind the cards of the arranged Timeline overview, one per node that owns
 * a board. Frames live in session only (never exported); they use graph coordinates like group frames.
 */
export function createBoardFrames(adapter) {
  const layer = document.createElement('div');
  layer.id = 'board-frames-layer';
  const groupLayer = adapter.layer.parentElement?.querySelector('#group-frames-layer');
  (groupLayer || adapter.layer).before(layer);
  const elements = new Map();
  let lastFrames = null,
    lastProject = null,
    lastLocale = null,
    lastScale = null;
  // One delegated listener serves every frame (CC-33).
  layer.addEventListener('click', (e) => {
    const open = e.target.closest('.board-frame-open');
    if (open) adapter.callbacks.frameOpen?.(open.dataset.nodeId);
  });
  function clear() {
    for (const el of elements.values()) el.remove();
    elements.clear();
  }
  // Keeps the open label readable when zoomed out: counter-scale by the zoom, capped so it never
  // outgrows its frame header.
  function paint() {
    layer.style.transform = adapter.layer.style.transform;
    const scale = Math.min(MAX_LABEL_SCALE, Math.max(1, MIN_LABEL_ZOOM / adapter.cy.zoom()));
    if (scale === lastScale) return;
    lastScale = scale;
    layer.style.setProperty('--board-frame-scale', String(scale));
  }
  function sync(project, frames) {
    if (!frames) {
      lastFrames = lastProject = null;
      clear();
      return;
    }
    const locale = getLocale();
    if (frames === lastFrames && project === lastProject && locale === lastLocale) {
      paint();
      return;
    }
    lastFrames = frames;
    lastProject = project;
    lastLocale = locale;
    const titles = new Map(project.cards.map((c) => [c.id, c.title]));
    const ids = new Set(frames.map((f) => f.nodeId));
    for (const [id, el] of elements)
      if (!ids.has(id)) {
        el.remove();
        elements.delete(id);
      }
    for (const frame of frames) {
      let el = elements.get(frame.nodeId);
      if (!el) {
        el = document.createElement('section');
        el.className = 'board-frame';
        el.dataset.nodeId = frame.nodeId;
        el.style.pointerEvents = 'none';
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'board-frame-open';
        open.dataset.nodeId = frame.nodeId;
        open.style.pointerEvents = 'auto';
        el.append(open);
        layer.append(el);
        elements.set(frame.nodeId, el);
      }
      Object.assign(el.style, {
        left: frame.x + 'px',
        top: frame.y + 'px',
        width: frame.width + 'px',
        height: frame.height + 'px',
      });
      const title = titles.get(frame.nodeId) || '',
        count = frame.count,
        one = count === 1,
        open = el.firstElementChild;
      open.textContent =
        title + ' · ' + t(one ? 'timelineBoardCountOne' : 'timelineBoardCount', { count });
      const label = t(one ? 'timelineBoardOpenForOne' : 'timelineBoardOpenFor', { title, count });
      open.setAttribute('aria-label', label);
      open.title = label;
    }
    paint();
  }
  return {
    sync,
    paint, // The focusable target for a frame is its open button.
    element: (nodeId) => elements.get(nodeId)?.querySelector('.board-frame-open') || null,
  };
}
