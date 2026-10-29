export function dialogSurface(element, { onRequestClose, fallback }) {
  let trigger = null,
    pending = false,
    startedOutside = false;
  const outside = (e) => {
    const r = element.getBoundingClientRect();
    return (
      e.target === element &&
      (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
    );
  };
  async function requestClose() {
    if (pending || !element.open) return;
    pending = true;
    try {
      await onRequestClose();
    } finally {
      pending = false;
    }
  }
  element.addEventListener('cancel', (e) => {
    e.preventDefault();
    e.stopPropagation();
    requestClose();
  });
  element.addEventListener('pointerdown', (e) => {
    startedOutside = outside(e);
  });
  element.addEventListener('click', (e) => {
    if (startedOutside && outside(e)) requestClose();
    startedOutside = false;
  });
  return {
    get open() {
      return element.open;
    },
    show(initial) {
      if (element.open) return;
      trigger = document.activeElement;
      if (element.closest('#format-inspector')) element.show();
      else element.showModal();
      initial?.focus({ preventScroll: true });
    },
    close() {
      if (!element.open) return;
      element.close();
      const target = trigger?.isConnected && !trigger.closest('[hidden]') ? trigger : fallback?.();
      target?.focus({ preventScroll: true });
    },
    requestClose,
  };
}

const anchorContexts = new WeakMap();
function positionDialog(element, state) {
  if (!element.open) return;
  const r = state.anchor.isConnected ? state.anchor.getBoundingClientRect() : state.rect;
  element.style.left =
    Math.max(12, Math.min(r.left, window.innerWidth - element.offsetWidth - 12)) + 'px';
  element.style.top =
    Math.max(12, Math.min(r.bottom + 8, window.innerHeight - element.offsetHeight - 12)) + 'px';
}
export function anchorDialog(element, anchor) {
  let state = anchorContexts.get(element);
  if (!state) {
    state = { anchor, rect: anchor.getBoundingClientRect() };
    anchorContexts.set(element, state);
    const observer = new window.ResizeObserver(() => positionDialog(element, state));
    observer.observe(element);
    window.addEventListener('resize', () => positionDialog(element, state));
  } else {
    state.anchor = anchor;
    state.rect = anchor.getBoundingClientRect();
  }
  positionDialog(element, state);
}
