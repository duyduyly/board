import { appearance } from '../detail/appearance.js';
import { dialogSurface, anchorDialog } from './dialog-surface.js';
import { t } from '../i18n/index.js';
import { textFields, textStyle, fontFamilies } from '../graph/card-typography.js';
import { escapeHTML as esc } from '../common/html.js';
import { formatPropertyIcon } from './format-property-icons.js';
export function createCardOverviewEditor({
  current,
  onApply,
  fallback,
  isShared = () => false,
  context = () => ({ draft: false, count: 0 }),
  onClose = () => {},
}) {
  const element = document.createElement('dialog');
  element.id = 'card-overview-editor';
  element.className = 'card-date-editor card-overview-editor';
  element.setAttribute('aria-labelledby', 'overview-editor-title');
  element.innerHTML =
    '<form><div class="date-editor-heading"><h2 id="overview-editor-title"></h2></div><label data-label="field" for="overview-field"></label><select id="overview-field"></select><label data-label="text" for="overview-text"></label><textarea id="overview-text" rows="3"></textarea><div class="overview-style-grid"><div><label data-label="fontSize" for="overview-size"></label><input id="overview-size" type="number" min="8" max="72" step="any"></div><div><label data-label="fontFamily" for="overview-font"></label><select id="overview-font"></select></div><div><label data-label="textColor" for="overview-color"></label><input id="overview-color" type="color"></div></div><button type="button" data-overview-reset></button><label for="overview-tags" data-tags-label></label><input id="overview-tags" type="text"><p class="overview-preview"></p><label class="uniform-style-option"><input id="overview-uniform" type="checkbox"><span data-uniform-label></span></label><p class="date-editor-help" data-uniform-hint></p><p class="date-editor-error" role="alert" hidden></p><p class="date-editor-help" data-overview-scope aria-live="polite"></p><div class="date-editor-actions"><button type="button" data-overview-cancel></button><button type="submit" class="primary" data-overview-apply></button></div></form>';
  const group = (key, first, selectors) => {
    const section = document.createElement('section');
    section.className = 'overview-editor-section';
    const heading = document.createElement('h3');
    heading.dataset.overviewSection = key;
    section.append(heading);
    element.querySelector(first).before(section);
    for (const selector of selectors) section.append(element.querySelector(selector));
  };
  group('metadata', '[data-label=field]', ['[data-label=field]', '#overview-field', '[data-label=text]', '#overview-text', '[data-tags-label]', '#overview-tags']);
  group('inspectorTypographySection', '.overview-style-grid', ['.overview-style-grid', '[data-overview-reset]']);
  group('inspectorTextPreview', '.overview-preview', ['.overview-preview']);
  document.body.append(element);
  const shared = element.querySelector('#overview-uniform');
  const tags = element.querySelector('#overview-tags');
  const field = element.querySelector('#overview-field'),
    text = element.querySelector('#overview-text'),
    size = element.querySelector('#overview-size'),
    font = element.querySelector('#overview-font'),
    color = element.querySelector('#overview-color'),
    error = element.querySelector('[role=alert]'),
    preview = element.querySelector('.overview-preview');
  let id = null,
    values = {},
    styles = {},
    initial = '',
    active = 'title',
    baseColor = '#202925',
    defaultTitleSize = 14.5;
  const snapshot = () => JSON.stringify({ values, styles, shared: shared.checked });
  function updateApply() {
    const button = element.querySelector('[data-overview-apply]');
    button.disabled = Boolean(element.closest('#format-inspector')) &&
      (snapshot() === initial || !String(values.title || '').trim() || !element.querySelector('form').checkValidity());
  }
  const surface = dialogSurface(element, {
    onRequestClose: () => close(),
    fallback: () => fallback(id, active),
  });
  function close() {
    const wasOpen = element.open;
    surface.close();
    id = null;
    error.hidden = true;
    if (wasOpen) onClose();
  }
  function updatePreview() {
    const s = styles[active];
    preview.textContent = values[active] || t(active);
    preview.style.fontSize =
      (s.fontSize || { title: defaultTitleSize, summary: 11, type: 9 }[active]) + 'px';
    preview.style.fontFamily = s.fontFamily ? fontFamilies[s.fontFamily] : '';
    preview.style.color = s.color || 'var(--ink)';
    updateApply();
  }
  function saveText() {
    values[active] = text.value;
    updatePreview();
  }
  function showField() {
    field.value = active;
    tags.value = Array.isArray(values.tags) ? values.tags.join(', ') : values.tags || '';
    text.value = values[active];
    text.required = active === 'title';
    size.value = styles[active].fontSize ?? '';
    font.value = styles[active].fontFamily || '';
    color.value = styles[active].color || baseColor;
    updatePreview();
  }
  function syncLocale() {
    element.querySelector('h2').textContent = t('editCardOverview');
    const decorate = (node, key, text) => {
      if (element.closest('#format-inspector')) {
        node.title = text;
        node.innerHTML = formatPropertyIcon(key) + (node.tagName === 'LABEL'
          ? '<span class="format-property-name">' + esc(text) + '</span>'
          : esc(text));
      } else {
        node.removeAttribute('title');
        node.textContent = text;
      }
    };
    for (const heading of element.querySelectorAll('[data-overview-section]'))
      decorate(heading, heading.dataset.overviewSection, t(heading.dataset.overviewSection));
    element.querySelector('[data-uniform-label]').textContent = t('uniformStylesCount', {
      count: context().count,
    });
    decorate(element.querySelector('[data-tags-label]'), 'tags', t('tags'));
    element.querySelector('[data-uniform-hint]').textContent = t('uniformStylesHint');
    for (const label of element.querySelectorAll('[data-label]'))
      decorate(label, label.dataset.label === 'field' ? 'overviewField' : label.dataset.label === 'text' ? 'overviewText' : label.dataset.label, t(
        label.dataset.label === 'field'
          ? 'overviewField'
          : label.dataset.label === 'text'
            ? 'overviewText'
            : label.dataset.label,
      ));
    field.replaceChildren(
      ...textFields.map((f) => new window.Option(t(f === 'type' ? 'contentType' : f), f)),
    );
    font.replaceChildren(
      new window.Option(t('defaultStyle'), ''),
      ...Object.keys(fontFamilies).map((f) => new window.Option(t('font' + f), f)),
    );
    size.placeholder = t('defaultStyle');
    element.querySelector('[data-overview-reset]').textContent = t('resetTextStyle');
    element.querySelector('[data-overview-cancel]').textContent = t('cancel');
    syncScope();
    error.textContent = t('overviewApplyFailed');
    if (id) showField();
  }
  function syncScope() {
    const ctx = context();
    element.querySelector('[data-overview-apply]').textContent = t(
      ctx.combined ? 'inspectorApplyCombined' : ctx.draft ? 'updateOverviewDraft' : shared.checked ? 'applyUniformCount' : 'applyThisCard',
      { count: ctx.count },
    );
    element.querySelector('[data-overview-scope]').textContent = t(
      ctx.combined ? 'inspectorCombinedScope' : ctx.draft ? 'overviewDraftScope' : shared.checked ? 'overviewBulkScope' : 'overviewCardScope',
      { count: ctx.count },
    );
    updateApply();
  }
  shared.onchange = syncScope;
  tags.oninput = () => {
    values.tags = tags.value;
    updateApply();
  };
  field.onchange = () => {
    saveText();
    active = field.value;
    showField();
  };
  text.oninput = saveText;
  size.oninput = () => {
    if (size.value) styles[active].fontSize = Number(size.value);
    else delete styles[active].fontSize;
    updatePreview();
  };
  font.onchange = () => {
    if (font.value) styles[active].fontFamily = font.value;
    else delete styles[active].fontFamily;
    updatePreview();
  };
  color.oninput = () => {
    styles[active].color = color.value;
    updatePreview();
  };
  element.querySelector('[data-overview-reset]').onclick = () => {
    styles[active] = {};
    showField();
  };
  element.querySelector('[data-overview-cancel]').onclick = close;
  element.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    saveText();
    if (!values.title.trim() || !element.querySelector('form').reportValidity()) {
      error.hidden = false;
      return;
    }
    if (onApply(id, values, styles, shared.checked)) close();
    else error.hidden = false;
  };
  syncLocale();
  return {
    close,
    get open() {
      return element.open;
    },
    get dirty() {
      return element.open && (snapshot() !== initial || size.validity.badInput);
    },
    syncLocale,
    show(cardId, anchor, target = 'title') {
      if (element.open) return;
      const card = current(cardId);
      if (!card) return;
      id = cardId;
      active = textFields.includes(target) ? target : 'title';
      values = Object.fromEntries(textFields.map((f) => [f, card[f] || '']));
      values.tags = [...(card.tags || [])];
      styles = Object.fromEntries(textFields.map((f) => [f, { ...textStyle(card, f) }]));
      baseColor = card.style.textColor;
      defaultTitleSize = appearance(card).titleFontSize;
      shared.checked = isShared();
      initial = snapshot();
      error.hidden = true;
      syncLocale();
      surface.show(text);
      if (!element.closest('#format-inspector')) anchorDialog(element, anchor);
    },
  };
}
