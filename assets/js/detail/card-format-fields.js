import { shapes } from '../graph/shape-registry.js';
import { escapeHTML as esc } from '../common/html.js';
import { t } from '../i18n/index.js';
import { labelField, cardColorField } from '../ui/forms.js';
import { appearance } from './appearance.js';
import { IMAGE_NAMESPACE } from './attachments.js';
import { nodeStyle } from '../graph/mind-map.js';
import { formatPropertyIcon } from '../ui/format-property-icons.js';
const formatField = (key, name, value, options = {}) =>
  labelField(key, name, value, { ...options, icon: true });
const group = (key, content, attrs = '') =>
  '<details class="format-section format-disclosure" data-format-group="' + key + '" open ' +
  attrs +
  '><summary>' +
  formatPropertyIcon(key) + esc(t(key)) +
  '</summary><div class="format-section-content">' +
  content +
  '</div></details>';
const numberField = (key, name, value, min, max) =>
  '<label title="' + esc(t(key)) + '">' +
  formatPropertyIcon(key) + '<span class="format-property-name">' + esc(t(key)) + '</span>' +
  '<input type="number" name="' +
  name +
  '" value="' +
  value +
  '" min="' +
  min +
  '"' +
  (max ? ' max="' + max + '"' : '') +
  ' step="any"></label>';
export function cardFormatFields(card, view, mindSize) {
  const a = appearance(card),
    config = nodeStyle(card),
    size = view === 'mind' ? mindSize : card.size;
  const display =
    formatField('nodeKind', 'node-kind', config.kind, {
      options: ['card', 'text', 'image', 'image-text'].map((value) => ({
        value,
        label: t(
          { card: 'kindCard', text: 'kindText', image: 'kindImage', 'image-text': 'kindImageText' }[
            value
          ],
        ),
      })),
    }) +
    formatField('cardShape', 'appearance-shape', a.shape || '', {
      options: [
        { value: '', label: t('legacyShape') },
        ...Object.keys(shapes).map((value) => ({ value, label: t(value) })),
      ],
    }) +
    '<p class="muted">' +
    esc(t('shapeHint')) +
    '</p>';
  const images =
    formatField('coverImage', 'node-coverImageId', config.coverImageId || '', {
      options: [
        { value: '', label: t('noCover') },
        ...Object.entries(card.extensions?.[IMAGE_NAMESPACE] || {}).map(([value, img]) => ({
          value,
          label: img.name,
        })),
      ],
    }) +
    formatField('imageFit', 'node-imageFit', config.imageFit, {
      options: ['contain', 'cover'].map((value) => ({ value, label: t(value) })),
    }) +
    formatField('imageAlt', 'node-imageAlt', config.imageAlt || '');
  const sizing =
    formatField('sizeMode', 'appearance-sizeMode', a.sizeMode, {
      options: [
        { value: 'manual', label: t('manual') },
        { value: 'fit', label: t('fitSizing') },
      ],
    }) +
    '<div class="format-grid">' +
    numberField('width', 'width', size.width, 1) +
    numberField('height', 'height', size.height, 1) +
    '</div><p class="muted">' +
    esc(t('manualSizeHint')) +
    '</p><p id="fit-warning" class="form-errors" role="status"></p>';
  const surface =
    '<div class="colors">' +
    ['backgroundColor', 'borderColor'].map((k) => cardColorField(card, k, { icon: true })).join('') +
    '</div><div class="format-grid"><div data-radius-field>' +
    numberField('radius', 'appearance-radius', a.radius, 0, 100) +
    '</div>' +
    numberField('borderWidth', 'appearance-borderWidth', a.borderWidth, 0, 8) +
    '</div>' +
    formatField('align', 'appearance-align', a.align, {
      options: ['left', 'center', 'right'].map((value) => ({ value, label: t(value) })),
    }) +
    formatField('shadow', 'appearance-shadow', a.shadow, {
      options: ['none', 'soft'].map((value) => ({ value, label: t(value) })),
    });
  const advanced =
    '<details class="format-advanced"><summary>' +
    esc(t('legacyDefaults')) +
    '</summary><p class="muted">' +
    esc(t('legacyColorHint')) +
    '</p>' +
    cardColorField(card, 'textColor', { icon: true }) +
    '</details>';
  const mind =
    view === 'mind'
      ? group(
          'mindTools',
          '<div class="format-buttons"><button type="button" id="set-root">' +
            esc(t('setRoot')) +
            '</button><button type="button" id="clear-root">' +
            esc(t('clearRoot')) +
            '</button></div>',
        )
      : '';
  return (
    '<div class="format-layout"><div class="format-controls">' +
    group('displaySettings', display) +
    group('imageSettings', images, 'data-image-fields') +
    group('sizeSettings', sizing) +
    group('surfaceSettings', surface) +
    advanced +
    mind +
    '<button type="button" id="reset-appearance">' +
    esc(t('resetFrame')) +
    '</button><p class="muted">' +
    esc(t('resetFrameHint')) +
    '</p></div><details class="format-preview-pane" data-format-group="preview" open><summary>' +
    esc(t('formatPreviewTitle')) +
    '</summary><p class="muted">' +
    esc(t('formatPreview')) +
    '</p><div id="format-card-preview" class="format-card-preview"></div><button type="button" id="edit-card-overview">' +
    esc(t('editCardOverview')) +
    '</button><p class="muted">' +
    esc(t('overviewHint')) +
    '</p></details></div>'
  );
}
