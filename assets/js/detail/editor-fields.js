import { escapeHTML as esc } from '../common/html.js';
import { t } from '../i18n/index.js';
import { labelField, cardColorField } from '../ui/forms.js';
import { appearance } from './appearance.js';
import { IMAGE_NAMESPACE } from './attachments.js';
import { nodeStyle, relationKind, MIND } from '../graph/mind-map.js';
export function editorFields({
  draft: d,
  kind,
  tab,
  activeView,
  mindSize,
  cards,
  writing,
  previewDraft,
  imageUploadPending,
}) {
  let fields = '';
  if (kind === 'card' && tab === 'format') {
    const a = appearance(d);
    const config = nodeStyle(d);
    const activeSize = activeView === 'mind' ? mindSize : d.size;
    fields =
      '<h3>' +
      esc(t('cardShape')) +
      '</h3><div class="format-grid">' +
      ['width', 'height']
        .map(
          (k) =>
            '<label>' +
            esc(t(k)) +
            '<input type="number" name="' +
            k +
            '" min="1" step="1" value="' +
            activeSize[k] +
            '"></label>',
        )
        .join('') +
      '</div>';
    fields +=
      labelField('nodeKind', 'node-kind', config.kind, {
        options: ['card', 'text', 'image', 'image-text'].map((value) => ({
          value,
          label: t(
            {
              card: 'kindCard',
              text: 'kindText',
              image: 'kindImage',
              'image-text': 'kindImageText',
            }[value],
          ),
        })),
      }) +
      labelField('coverImage', 'node-coverImageId', config.coverImageId || '', {
        options: [
          { value: '', label: t('noCover') },
          ...Object.entries(d.extensions?.[IMAGE_NAMESPACE] || {}).map(([value, img]) => ({
            value,
            label: img.name,
          })),
        ],
      }) +
      labelField('imageFit', 'node-imageFit', config.imageFit, {
        options: ['contain', 'cover'].map((value) => ({ value, label: t(value) })),
      }) +
      labelField('imageAlt', 'node-imageAlt', config.imageAlt || '') +
      '<p class="node-format-hint">' +
      esc(t('nodeFormatHint')) +
      '</p><button type="button" id="set-root">' +
      esc(t('setRoot')) +
      '</button><button type="button" id="clear-root">' +
      esc(t('clearRoot')) +
      '</button>';
    fields +=
      '<div class="colors">' +
      ['backgroundColor', 'textColor', 'borderColor'].map((k) => cardColorField(d, k)).join('') +
      '</div><div class="format-grid">' +
      [
        ['radius', 0, 100],
        ['borderWidth', 0, 8],
        ['titleFontSize', 12, 24],
      ]
        .map(
          ([k, min, max]) =>
            '<label>' +
            esc(t(k)) +
            '<input name="appearance-' +
            k +
            '" type="number" min="' +
            min +
            '" max="' +
            max +
            '" step="0.5" value="' +
            a[k] +
            '"></label>',
        )
        .join('') +
      '</div>';
    fields +=
      labelField('align', 'appearance-align', a.align, {
        options: ['left', 'center', 'right'].map((value) => ({ value, label: t(value) })),
      }) +
      labelField('shadow', 'appearance-shadow', a.shadow, {
        options: ['none', 'soft'].map((value) => ({ value, label: t(value) })),
      });
    fields +=
      '<div class="shape-presets"><button type="button" data-shape="rectangle">' +
      esc(t('rectangle')) +
      '</button><button type="button" data-shape="rounded">' +
      esc(t('rounded')) +
      '</button><button type="button" id="reset-appearance">' +
      esc(t('resetAppearance')) +
      '</button></div><p class="muted">' +
      esc(t('formatPreview')) +
      '</p><div id="format-card-preview" class="format-card-preview"></div>';
  } else if (kind === 'card') {
    fields +=
      '<details class="editor-metadata" open><summary>' +
      esc(t('metadata')) +
      '</summary>' +
      labelField('title', 'title', d.title) +
      labelField('summary', 'summary', d.summary, { textarea: true }) +
      labelField('type', 'type', d.type) +
      labelField('tags', 'tags', d.tags.join(', '));
    fields +=
      '<div class="colors">' +
      ['backgroundColor', 'textColor', 'borderColor'].map((k) => cardColorField(d, k)).join('') +
      '</div>';
    fields +=
      '</details><div class="writing-tools"><button type="button" id="writing-toggle">' +
      esc(t(writing ? 'exitWriting' : 'writingMode')) +
      '</button><button type="button" id="draft-preview-toggle" aria-pressed="' +
      previewDraft +
      '">' +
      esc(t(previewDraft ? 'writeDraft' : 'previewDraft')) +
      '</button><button type="button" id="download-markdown">' +
      esc(t('downloadMarkdown')) +
      '</button><select id="template-select" aria-label="' +
      esc(t('templateLabel')) +
      '"><option value="">' +
      esc(t('templateLabel')) +
      '</option>' +
      ['guide', 'api', 'note']
        .map(
          (k) =>
            '<option value="' +
            k +
            '">' +
            esc(t('template' + k[0].toUpperCase() + k.slice(1))) +
            '</option>',
        )
        .join('') +
      '</select></div>';
    fields +=
      '<div class="draft-preview"' +
      (previewDraft ? '' : ' hidden') +
      '><p class="muted">' +
      esc(t('draftPreviewHint')) +
      '</p><div class="markdown"></div></div><div class="writing-source"' +
      (previewDraft ? ' hidden' : '') +
      '>' +
      '<div class="text-format-tools" role="group" aria-label="' +
      esc(t('formatText')) +
      '">' +
      ['bold', 'italic', 'inlineCode']
        .map(
          (k) =>
            '<button type="button" data-text-format="' +
            k +
            '" title="' +
            esc(t(k)) +
            '" aria-label="' +
            esc(t(k)) +
            '">' +
            { bold: 'B', italic: 'I', inlineCode: '&lt;/&gt;' }[k] +
            '</button>',
        )
        .join('') +
      '<input type="color" id="inline-text-color" value="#d34f45" aria-label="' +
      esc(t('textColorInline')) +
      '"><button type="button" data-text-format="color">' +
      esc(t('applyTextColor')) +
      '</button></div>' +
      labelField('content', 'content', d.content, { textarea: true }) +
      '</div>';
    fields +=
      '<div class="image-tools"><button type="button" id="insert-image"' +
      (imageUploadPending ? ' disabled' : '') +
      '>' +
      esc(t('insertImage')) +
      '</button><input type="file" id="embedded-image-input" accept="image/png,image/jpeg,image/webp,image/gif" hidden><p class="muted">' +
      esc(t('embeddedImageHint')) +
      '</p><div class="attachment-list">' +
      Object.entries(d.extensions?.[IMAGE_NAMESPACE] || {})
        .map(
          ([id, image]) =>
            '<div class="attachment-row"><span>' +
            esc(image.name) +
            '</span><button type="button" data-remove-image="' +
            esc(id) +
            '" aria-label="' +
            esc(t('removeImage') + ': ' + image.name) +
            '">' +
            esc(t('removeImage')) +
            '</button></div>',
        )
        .join('') +
      '</div></div>';
  } else if (kind === 'relation') {
    fields += labelField('relationKind', 'mind-kind', relationKind(d), {
      options: ['reference', 'branch'].map((value) => ({ value, label: t(value) })),
    });
    fields += labelField('mindColor', 'mind-color', d.extensions?.[MIND]?.color || d.style.color, {
      color: true,
    });
    for (const field of ['source', 'target'])
      fields += labelField(field, field, d[field], {
        options: cards.map((c) => ({ value: c.id, label: c.title })),
      });
    fields +=
      labelField('label', 'label', d.label) +
      labelField('type', 'type', d.type) +
      labelField('description', 'description', d.description, { textarea: true }) +
      labelField('color', 'color', d.style.color, { color: true });
    for (const [field, values] of [
      ['line', ['solid', 'dashed', 'dotted']],
      ['arrow', ['none', 'start', 'end', 'both']],
    ])
      fields += labelField(field, field, d.style[field], {
        options: values.map((v) => ({ value: v, label: t(v) })),
      });
  } else
    fields =
      labelField('title', 'title', d.title) +
      labelField('description', 'description', d.description, { textarea: true });
  return fields;
}
