import { cardFormatFields } from './card-format-fields.js';
import { escapeHTML as esc } from '../common/html.js';
import { t } from '../i18n/index.js';
import { labelField } from '../ui/forms.js';
import { IMAGE_NAMESPACE } from './attachments.js';
import { relationKind, MIND } from '../graph/mind-map.js';
import { edgeRoute, routeTypes, edgeMode } from '../graph/edge-routing.js';
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
    fields = cardFormatFields(d, activeView, mindSize);
  } else if (kind === 'card') {
    fields +=
      '<button type="button" id="edit-card-overview">' +
      esc(t('editCardOverview')) +
      '</button><p class="muted">' +
      esc(t('overviewHint')) +
      '</p>';
    fields +=
      '<div class="writing-tools"><button type="button" id="writing-toggle">' +
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
      '<details class="image-tools"' +
      (Object.keys(d.extensions?.[IMAGE_NAMESPACE] || {}).length ? ' open' : '') +
      '><summary>' +
      esc(t('imageSettings')) +
      '</summary><button type="button" id="insert-image"' +
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
      '</div></details>';
  } else if (kind === 'relation') {
    if (d.source !== d.target && ['curved', 'orthogonal'].includes(edgeRoute(d)))
      fields +=
        '<button type="button" data-action="edge-adjust">' +
        esc(t('edgeAdjust')) +
        '</button><p class="muted">' +
        esc(t('edgeAdjustHelp')) +
        '</p>';
    fields += labelField('edgeRoute', 'edge-route', edgeRoute(d), {
      options: routeTypes.map((value) => ({ value, label: t('route' + value) })),
    });
    if (edgeRoute(d) === 'orthogonal')
      fields +=
        labelField('edgeMode', 'edge-mode', edgeMode(d, activeView), {
          options: ['manual', 'auto'].map((value) => ({ value, label: t('edgeMode' + value) })),
        }) +
        '<p class="muted">' +
        esc(t('edgeModeHelp')) +
        '</p>';
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
