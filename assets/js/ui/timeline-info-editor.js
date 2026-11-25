import { dialogSurface, anchorDialog } from './dialog-surface.js';
import { t, getLocale } from '../i18n/index.js';
import { TIMELINE_INFO_LIMITS } from '../graph/timeline.js';

/**
 * Small popup for the Timeline's own title and short purpose. `current()` returns the saved
 * `{ title, description }`, `onApply(value)` returns false when it could not be applied, and
 * `fallback(field)` names the element that takes focus back when the trigger is gone.
 */
export function createTimelineInfoEditor({ current, onApply, fallback }) {
  const element = document.createElement('dialog');
  element.className = 'card-date-editor timeline-info-editor';
  element.id = 'timeline-info-editor';
  element.innerHTML =
    '<form><div class="date-editor-heading"><h2></h2></div><label for="timeline-info-title" data-info-title-label></label><input id="timeline-info-title" type="text" autocomplete="off"><label for="timeline-info-description" data-info-description-label></label><textarea id="timeline-info-description" rows="4"></textarea><p class="date-editor-help"></p><p class="date-editor-error" role="alert" hidden></p><div class="date-editor-actions"><button type="button" data-info-cancel></button><button type="submit" class="primary" data-info-apply></button></div></form>';
  document.body.append(element);
  const title = element.querySelector('#timeline-info-title'),
    description = element.querySelector('#timeline-info-description'),
    error = element.querySelector('.date-editor-error');
  title.maxLength = TIMELINE_INFO_LIMITS.title;
  description.maxLength = TIMELINE_INFO_LIMITS.description;
  let field = 'title',
    initial = { title: '', description: '' },
    renderedLocale = null;
  const surface = dialogSurface(element, {
    onRequestClose: () => close(),
    fallback: () => fallback(field),
  });
  function close() {
    surface.close();
    error.hidden = true;
  }
  function syncLocale() {
    if (renderedLocale === getLocale()) return;
    renderedLocale = getLocale();
    element.querySelector('h2').textContent = t('timelineInfoEditTitle');
    element.querySelector('[data-info-title-label]').textContent = t('timelineInfoTitleLabel');
    element.querySelector('[data-info-description-label]').textContent = t(
      'timelineInfoDescriptionLabel',
    );
    element.querySelector('.date-editor-help').textContent = t('timelineInfoHelp');
    element.querySelector('[data-info-cancel]').textContent = t('cancel');
    element.querySelector('[data-info-apply]').textContent = t('apply');
    if (!error.hidden) error.textContent = t('timelineInfoApplyFailed');
  }
  element.querySelector('[data-info-cancel]').onclick = close;
  element.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    if (onApply({ title: title.value, description: description.value })) close();
    else {
      error.textContent = t('timelineInfoApplyFailed');
      error.hidden = false;
    }
  };
  syncLocale();
  return {
    get open() {
      return element.open;
    },
    get dirty() {
      return (
        element.open && (title.value !== initial.title || description.value !== initial.description)
      );
    },
    syncLocale,
    show(which, anchor) {
      if (element.open) return;
      field = which === 'description' ? 'description' : 'title';
      initial = current();
      title.value = initial.title;
      description.value = initial.description;
      error.hidden = true;
      syncLocale();
      surface.show(field === 'description' ? description : title);
      anchorDialog(element, anchor);
    },
  };
}
