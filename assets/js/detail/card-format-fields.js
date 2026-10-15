import { shapes } from '../graph/shape-registry.js';
import { escapeHTML as esc } from '../common/html.js';
import { t } from '../i18n/index.js';
import { labelField, cardColorField } from '../ui/forms.js';
import { appearance } from './appearance.js';
import { IMAGE_NAMESPACE } from './attachments.js';
import { nodeStyle } from '../graph/mind-map.js';
const group = (key, content, attrs = '') =>
  '<section class="format-section" ' +
  attrs +
  '><h3>' +
  esc(t(key)) +
  '</h3>' +
  content +
  '</section>';
const numberField = (key, name, value, min, max) =>
  '<label>' +
  esc(t(key)) +
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
    labelField('nodeKind', 'node-kind', config.kind, {
      options: ['card', 'text', 'image', 'image-text'].map((value) => ({
        value,
        label: t(
          { card: 'kindCard', text: 'kindText', image: 'kindImage', 'image-text': 'kindImageText' }[
            value
          ],
        ),
      })),
    }) +
    labelField('cardShape', 'appearance-shape', a.shape || '', {
      options: [
        { value: '', label: t('legacyShape') },
        ...Object.keys(shapes).map((value) => ({ value, label: t(value) })),
      ],
    }) +
    '<p class="muted">' +
    esc(t('shapeHint')) +
    '</p>';
  const images =
    labelField('coverImage', 'node-coverImageId', config.coverImageId || '', {
      options: [
        { value: '', label: t('noCover') },
        ...Object.entries(card.extensions?.[IMAGE_NAMESPACE] || {}).map(([value, img]) => ({
          value,
          label: img.name,
        })),
      ],
    }) +
    labelField('imageFit', 'node-imageFit', config.imageFit, {
      options: ['contain', 'cover'].map((value) => ({ value, label: t(value) })),
    }) +
    labelField('imageAlt', 'node-imageAlt', config.imageAlt || '');
  const sizing =
    labelField('sizeMode', 'appearance-sizeMode', a.sizeMode, {
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
    ['backgroundColor', 'borderColor'].map((k) => cardColorField(card, k)).join('') +
    '</div><div class="format-grid"><div data-radius-field>' +
    numberField('radius', 'appearance-radius', a.radius, 0, 100) +
    '</div>' +
    numberField('borderWidth', 'appearance-borderWidth', a.borderWidth, 0, 8) +
    '</div>' +
    labelField('align', 'appearance-align', a.align, {
      options: ['left', 'center', 'right'].map((value) => ({ value, label: t(value) })),
    }) +
    labelField('shadow', 'appearance-shadow', a.shadow, {
      options: ['none', 'soft'].map((value) => ({ value, label: t(value) })),
    });
  const advanced =
    '<details class="format-advanced"><summary>' +
    esc(t('legacyDefaults')) +
    '</summary><p class="muted">' +
    esc(t('legacyColorHint')) +
    '</p>' +
    cardColorField(card, 'textColor') +
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
    '</p></div><aside class="format-preview-pane"><h3>' +
    esc(t('formatPreviewTitle')) +
    '</h3><p class="muted">' +
    esc(t('formatPreview')) +
    '</p><div id="format-card-preview" class="format-card-preview"></div><button type="button" id="edit-card-overview">' +
    esc(t('editCardOverview')) +
    '</button><p class="muted">' +
    esc(t('overviewHint')) +
    '</p></aside></div>'
  );
}
