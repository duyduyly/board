import { dialogSurface, anchorDialog } from './dialog-surface.js';
import { t } from '../i18n/index.js';
import { DEFAULT_BACKGROUND_ID, QUICK_BACKGROUNDS } from '../graph/card-quick-color.js';

const COLOR_IDS = [DEFAULT_BACKGROUND_ID, ...QUICK_BACKGROUNDS.map((c) => c.id)];
const CUSTOM = 'custom';
const colorNameKey = (id) => 'quickColor' + id[0].toUpperCase() + id.slice(1);

/**
 * One shared background-colour menu for every note. `current(id)` returns `{ selected, swatches }`
 * (the marked swatch id or null for a custom colour, the id -> CSS colour map, and the current colour) or null when the note may not
 * change; `onApply(id, swatch)` commits and returns whether it did.
 * @param {{ current: (id: string) => ({ selected: string | null, swatches: Record<string, string>, background: string }) | null, onApply: (id: string, swatch: string) => boolean, fallback: (id: string) => HTMLElement | null | undefined }} ports
 */
export function createCardColorPopover({ current, onApply, fallback }) {
  const element = document.createElement('dialog');
  element.className = 'card-color-popover';
  element.id = 'card-color-popover';
  const menu = document.createElement('div');
  menu.setAttribute('role', 'menu');
  menu.className = 'card-color-menu';
  const options = COLOR_IDS.map((swatch) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'card-color-option';
    option.dataset.swatch = swatch;
    option.setAttribute('role', 'menuitemradio');
    option.innerHTML =
      '<span class="card-color-chip"></span><span class="card-color-label"></span>';
    menu.append(option);
    return option;
  });
  // The native colour input covers the whole row (invisible) so the row stays one focusable control.
  const custom = document.createElement('label');
  custom.className = 'card-color-option card-color-custom';
  custom.dataset.swatch = CUSTOM;
  custom.innerHTML =
    '<span class="card-color-chip card-color-rainbow"><span class="card-color-current"></span></span><span class="card-color-label"></span><input type="color" class="card-color-input">';
  const input = custom.querySelector('input');
  options.push(input);
  menu.append(custom);
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
  menu.addEventListener('click', (e) => {
    const option = e.target.closest('button.card-color-option');
    if (!option) return;
    // Apply before closing: the commit re-renders the card, so focus must return to the new button.
    onApply(id, option.dataset.swatch);
    close();
  });
  // Only the final change (picker closed) commits: one colour choice is one Undo step.
  input.addEventListener('change', () => {
    onApply(id, input.value);
    close();
  });
  menu.addEventListener('keydown', (e) => {
    const index = options.indexOf(document.activeElement);
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
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
    element.setAttribute('aria-label', t('quickColor'));
    menu.setAttribute('aria-label', t('quickColor'));
    for (const option of [...options.slice(0, -1), custom]) {
      const name = t(colorNameKey(option.dataset.swatch));
      option.querySelector('.card-color-label').textContent = name;
      if (option !== custom) option.setAttribute('aria-label', name);
    }
    input.setAttribute('aria-label', t('quickColorCustom'));
  }
  syncLocale();
  return {
    get open() {
      return element.open;
    },
    syncLocale,
    show(cardId, anchor) {
      if (element.open) return;
      const state = current(cardId);
      if (!state) return;
      id = cardId;
      syncLocale();
      const selectedId = state.selected ?? CUSTOM;
      for (const option of options.slice(0, -1)) {
        const selected = option.dataset.swatch === selectedId;
        option.setAttribute('aria-checked', String(selected));
        option.tabIndex = selected ? 0 : -1;
        option.style.setProperty('--swatch', state.swatches[option.dataset.swatch]);
      }
      const isCustom = selectedId === CUSTOM;
      custom.dataset.checked = String(isCustom);
      custom.style.setProperty('--swatch', state.background);
      input.value = state.background.toLowerCase();
      input.tabIndex = isCustom ? 0 : -1;
      if (isCustom) input.setAttribute('aria-description', t('quickColorCurrent'));
      else input.removeAttribute('aria-description');
      surface.show(isCustom ? input : options[Math.max(0, COLOR_IDS.indexOf(selectedId))]);
      anchorDialog(element, anchor);
    },
  };
}
