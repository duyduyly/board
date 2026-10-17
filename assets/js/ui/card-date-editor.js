import { dialogSurface, anchorDialog } from './dialog-surface.js';
import { t, getLocale } from '../i18n/index.js';
import { cardDateValue } from '../graph/card-metadata.js';
export function createCardDateEditor({ current, onApply, fallback }) {
  const element = document.createElement('dialog');
  element.className = 'card-date-editor';
  element.id = 'card-date-editor';
  element.innerHTML =
    '<form><div class="date-editor-heading"><h2></h2></div><label for="card-date-input"></label><input id="card-date-input" type="date" min="0001-01-01" max="9999-12-31"><p class="date-editor-help"></p><p class="date-editor-error" role="alert" hidden></p><div class="date-editor-actions"><button type="button" data-date-cancel></button><button type="submit" class="primary" data-date-apply></button></div></form>';
  document.body.append(element);
  const input = element.querySelector('input'),
    error = element.querySelector('.date-editor-error');
  let id = null,
    initial = '',
    renderedLocale = null;
  const surface = dialogSurface(element, {
    onRequestClose: () => close(),
    fallback: () => fallback(id),
  });
  function close() {
    surface.close();
    id = null;
    error.hidden = true;
  }
  function syncLocale() {
    if (renderedLocale === getLocale()) return;
    renderedLocale = getLocale();
    element.querySelector('h2').textContent = t('cardDate');
    element.querySelector('label').textContent = t('cardDate');
    input.setAttribute('aria-label', t('cardDate'));
    element.querySelector('.date-editor-help').textContent = t('dateHelp');
    element.querySelector('[data-date-cancel]').textContent = t('cancel');
    element.querySelector('[data-date-apply]').textContent = t('apply');
    error.textContent = t('dateApplyFailed');
  }
  element.querySelector('[data-date-cancel]').onclick = close;
  element.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    if (!input.reportValidity()) return;
    if (onApply(id, input.value)) close();
    else error.hidden = false;
  };
  syncLocale();
  return {
    get open() {
      return element.open;
    },
    get dirty() {
      return element.open && (input.value !== initial || input.validity.badInput);
    },
    syncLocale,
    show(cardId, anchor) {
      if (element.open) return;
      const card = current(cardId);
      if (!card) return;
      id = cardId;
      initial = cardDateValue(card);
      input.value = initial;
      error.hidden = true;
      syncLocale();
      surface.show(input);
      anchorDialog(element, anchor);
    },
  };
}
