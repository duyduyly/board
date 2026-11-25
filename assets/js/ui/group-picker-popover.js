import { dialogSurface, anchorDialog } from './dialog-surface.js';
import { t } from '../i18n/index.js';

/**
 * One shared menu that lists the groups of the board as an indented tree. `groups()` returns the
 * outline ({ id, title, depth, count }); `onApply(groupId)` commits the choice.
 * @param {{ groups: () => { id: string, title: string, depth: number, count: number }[], onApply: (groupId: string) => void, fallback: () => HTMLElement | null | undefined }} ports
 */
export function createGroupPickerPopover({ groups, onApply, fallback }) {
  const element = document.createElement('dialog');
  element.className = 'group-picker-popover';
  element.id = 'group-picker-popover';
  const menu = document.createElement('div');
  menu.setAttribute('role', 'menu');
  menu.className = 'group-picker-menu';
  element.append(menu);
  document.body.append(element);
  const surface = dialogSurface(element, {
    onRequestClose: () => close(),
    fallback,
  });
  const options = () => [...menu.querySelectorAll('.group-picker-option')];
  function close() {
    surface.close();
  }
  function focusOption(index) {
    const list = options();
    list[(index + list.length) % list.length].focus({ preventScroll: true });
  }
  function fill() {
    menu.replaceChildren(
      ...groups().map(({ id, title, depth, count }) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'group-picker-option';
        option.dataset.groupId = id;
        option.setAttribute('role', 'menuitem');
        option.style.setProperty('--group-depth', String(depth - 1));
        const name = document.createElement('span');
        name.className = 'group-picker-option-title';
        name.textContent = title;
        const size = document.createElement('span');
        size.className = 'group-picker-option-count';
        size.textContent = t('groupNoteCount', { count });
        option.append(name, size);
        return option;
      }),
    );
  }
  menu.addEventListener('click', (e) => {
    const option = e.target.closest('.group-picker-option');
    if (!option) return;
    // Apply before closing: the commit re-renders, so focus must return to the new controls.
    onApply(option.dataset.groupId);
    close();
  });
  menu.addEventListener('keydown', (e) => {
    const index = options().indexOf(document.activeElement);
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (step) {
      e.preventDefault();
      focusOption(index + step);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      focusOption(e.key === 'Home' ? 0 : -1);
    }
  });
  // The menu is anchored to a button that can move with the layout, so a resize closes it.
  window.addEventListener('resize', () => element.open && close());
  function syncLocale() {
    element.setAttribute('aria-label', t('groupAddCardsTitle'));
    menu.setAttribute('aria-label', t('groupAddCardsTitle'));
    if (!element.open) return;
    for (const option of options()) {
      option.querySelector('.group-picker-option-count').textContent = t('groupNoteCount', {
        count: groups().find((g) => g.id === option.dataset.groupId)?.count ?? 0,
      });
    }
  }
  syncLocale();
  return {
    get open() {
      return element.open;
    },
    syncLocale,
    show(anchor) {
      if (element.open) return;
      syncLocale();
      fill();
      if (!options().length) return;
      surface.show(options()[0]);
      anchorDialog(element, anchor);
    },
    close,
  };
}
