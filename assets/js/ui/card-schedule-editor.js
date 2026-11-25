import { dialogSurface, anchorDialog } from './dialog-surface.js';
import { t, getLocale } from '../i18n/index.js';
import { todayKey } from '../graph/timeline.js';
/** `suggest(id)` optionally proposes a start date for a card without schedule (default: today); `title(id)` names the note being edited. */
export function createCardScheduleEditor({ current, onApply, fallback, suggest, title }) {
  const element = document.createElement('dialog');
  element.className = 'card-date-editor card-schedule-editor';
  element.id = 'card-schedule-editor';
  element.innerHTML =
    '<form><div class="date-editor-heading"><h2></h2></div><p class="schedule-card-title"></p><label for="schedule-start" data-schedule-start-label></label><input id="schedule-start" type="date" min="0001-01-01" max="9999-12-31" required><label for="schedule-end" data-schedule-end-label></label><input id="schedule-end" type="date" min="0001-01-01" max="9999-12-31"><p class="date-editor-help"></p><p class="date-editor-error" role="alert" hidden></p><div class="date-editor-actions"><button type="button" data-schedule-clear></button><button type="button" data-schedule-cancel></button><button type="submit" class="primary" data-schedule-apply></button></div></form>';
  document.body.append(element);
  const start = element.querySelector('#schedule-start'),
    end = element.querySelector('#schedule-end'),
    error = element.querySelector('.date-editor-error'),
    clear = element.querySelector('[data-schedule-clear]');
  let id = null,
    initial = { start: '', end: '' },
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
  function showError(key) {
    error.textContent = t(key);
    error.hidden = false;
  }
  function syncLocale() {
    if (renderedLocale === getLocale()) return;
    renderedLocale = getLocale();
    element.querySelector('h2').textContent = t('scheduleTitle');
    element.querySelector('[data-schedule-start-label]').textContent = t('scheduleStart');
    element.querySelector('[data-schedule-end-label]').textContent = t('scheduleEnd');
    element.querySelector('.date-editor-help').textContent = t('scheduleHelp');
    clear.textContent = t('scheduleClear');
    element.querySelector('[data-schedule-cancel]').textContent = t('cancel');
    element.querySelector('[data-schedule-apply]').textContent = t('apply');
    if (!error.hidden) error.textContent = t(error.dataset.key);
  }
  function apply(value) {
    if (onApply(id, value)) close();
    else {
      error.dataset.key = 'scheduleApplyFailed';
      showError('scheduleApplyFailed');
    }
  }
  clear.onclick = () => apply(null);
  element.querySelector('[data-schedule-cancel]').onclick = close;
  element.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    if (!start.reportValidity() || !end.reportValidity()) return;
    if (end.value && end.value < start.value) {
      error.dataset.key = 'scheduleOrderError';
      showError('scheduleOrderError');
      end.focus();
      return;
    }
    apply(end.value ? { start: start.value, end: end.value } : { start: start.value });
  };
  syncLocale();
  return {
    get open() {
      return element.open;
    },
    get dirty() {
      return (
        element.open &&
        (start.value !== initial.start ||
          end.value !== initial.end ||
          start.validity.badInput ||
          end.validity.badInput)
      );
    },
    syncLocale,
    show(cardId, anchor) {
      if (element.open) return;
      const schedule = current(cardId);
      id = cardId;
      // Prefill is the baseline, so an untouched popup is not dirty and Cancel never creates a schedule.
      initial = {
        start: schedule?.start || suggest?.(cardId) || todayKey(),
        end: schedule?.end || '',
      };
      start.value = initial.start;
      end.value = initial.end;
      clear.hidden = !schedule;
      error.hidden = true;
      element.querySelector('.schedule-card-title').textContent = title?.(cardId) || '';
      syncLocale();
      surface.show(start);
      anchorDialog(element, anchor);
    },
  };
}
