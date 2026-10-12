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
      element.showModal();
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
