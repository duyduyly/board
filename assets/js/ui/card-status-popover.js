import { dialogSurface, anchorDialog } from './dialog-surface.js';
import { t, statusLabel } from '../i18n/index.js';
import { STATUS_VALUES } from '../graph/card-status.js';

/**
 * One shared status menu for every note chip. `current(id)` returns the status shown for the
 * note (or null when it may not change); `onApply(id, value)` commits and returns whether it did.
 * @param {{ current: (id: string) => string | null, onApply: (id: string, value: string) => boolean, fallback: (id: string) => HTMLElement | null | undefined }} ports
 */
export function createCardStatusPopover({ current, onApply, fallback }) {
  const element = document.createElement('dialog');
  element.className = 'card-status-popover';
  element.id = 'card-status-popover';
  const menu = document.createElement('div');
  menu.setAttribute('role', 'menu');
  menu.className = 'card-status-menu';
  const options = STATUS_VALUES.map((value) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'card-status-option';
    option.dataset.status = value;
    option.setAttribute('role', 'menuitemradio');
    option.innerHTML = '<span class="card-status-option-label"></span>';
    menu.append(option);
    return option;
  });
  element.append(menu);
  document.body.append(element);
  let id = null;
  const surface = dialogSurface(element, {
    onRequestClose: () => close(),
    fallback: () => fallback(id),
  });
  function close() {
    surface.close();
    id = null;
  }
  function focusOption(index) {
    options[(index + options.length) % options.length].focus({ preventScroll: true });
  }
  function choose(option) {
    // Apply before closing: the commit re-renders the chip, so focus must return to the new one.
    if (option.dataset.status !== option.dataset.current) onApply(id, option.dataset.status);
    close();
  }
  menu.addEventListener('click', (e) => {
    const option = e.target.closest('.card-status-option');
    if (option) choose(option);
  });
  menu.addEventListener('keydown', (e) => {
    const index = options.indexOf(document.activeElement);
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (step) {
      e.preventDefault();
      focusOption(index + step);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      focusOption(e.key === 'Home' ? 0 : options.length - 1);
    }
  });
  // The menu is anchored to a card that moves with pan/zoom/resize, so any viewport change closes it.
  window.addEventListener('resize', () => element.open && close());
  function syncLocale() {
    element.setAttribute('aria-label', t('statusChange'));
    menu.setAttribute('aria-label', t('statusChange'));
    for (const option of options)
      option.querySelector('.card-status-option-label').textContent = statusLabel(
        option.dataset.status,
      );
  }
  syncLocale();
  return {
    get open() {
      return element.open;
    },
    syncLocale,
    show(cardId, anchor) {
      if (element.open) return;
      const status = current(cardId);
      if (!status) return;
      id = cardId;
      syncLocale();
      for (const option of options) {
        const selected = option.dataset.status === status;
        option.dataset.current = status;
        option.setAttribute('aria-checked', String(selected));
        option.tabIndex = selected ? 0 : -1;
      }
      surface.show(options[STATUS_VALUES.indexOf(status)]);
      anchorDialog(element, anchor);
    },
  };
}
