import { cardFormatFields } from './card-format-fields.js';
import { DOCUMENT } from '../graph/html-document.js';
import { escapeHTML as esc } from '../common/html.js';
import { t } from '../i18n/index.js';
import { labelField } from '../ui/forms.js';
import { relationKind, MIND } from '../graph/mind-map.js';
import { edgeRoute, routeTypes, edgeMode } from '../graph/edge-routing.js';
import { formatPropertyIcon } from '../ui/format-property-icons.js';
const formatField = (key, name, value, options = {}) =>
  labelField(key, name, value, { ...options, icon: true });
export function editorFields({
  draft: d,
  kind,
  tab,
  activeView,
  mindSize,
  cards,
  writing,
}) {
  let fields = '';
  if (kind === 'card' && tab === 'format') {
    fields = cardFormatFields(d, activeView, mindSize);
  } else if (kind === 'card') {
    if (d.extensions?.[DOCUMENT])
      return (
        '<div class="writing-tools"><button type="button" class="editor-icon-action" id="html-writing-toggle" aria-label="' +
        esc(t(writing ? 'exitWriting' : 'writingMode')) +
        '" title="' + esc(t(writing ? 'exitWriting' : 'writingMode')) + '"><span aria-hidden="true">⛶</span></button><button type="button" class="editor-icon-action" id="download-html" aria-label="' +
        esc(t('downloadHTML')) +
        '" title="' + esc(t('downloadHTML')) + '"><span aria-hidden="true">⇩</span></button></div><div id="block-editor" aria-label="' +
        esc(t('blockEditor')) +
        '"></div>'
      );
    return '<p class="legacy-source-notice">' + esc(t('legacySourceNotice')) + '</p><pre class="legacy-source-text">' + esc(d.content || '') + '</pre>';
  } else if (kind === 'relation') {
    const section = (key) =>
      '<details class="format-section format-disclosure inspector-relation-section" data-format-group="' + key + '" open><summary>' + formatPropertyIcon(key) + esc(t(key)) + '</summary><div class="format-section-content">';
    const closeSection = '</div></details>';
    fields += section('inspectorRoutingGroup');
    if (d.source !== d.target && ['curved', 'orthogonal'].includes(edgeRoute(d)))
      fields +=
        '<button type="button" data-action="edge-adjust">' +
        esc(t('edgeAdjust')) +
        '</button><p class="muted">' +
        esc(t('edgeAdjustHelp')) +
        '</p>';
    fields += formatField('edgeRoute', 'edge-route', edgeRoute(d), {
      options: routeTypes.map((value) => ({ value, label: t('route' + value) })),
    });
    if (edgeRoute(d) === 'orthogonal')
      fields +=
        formatField('edgeMode', 'edge-mode', edgeMode(d, activeView), {
          options: ['manual', 'auto'].map((value) => ({ value, label: t('edgeMode' + value) })),
        }) +
        '<p class="muted">' +
        esc(t('edgeModeHelp')) +
        '</p>';
    fields += closeSection + section('inspectorLineGroup');
    fields += formatField('relationKind', 'mind-kind', relationKind(d), {
      options: ['reference', 'branch'].map((value) => ({ value, label: t(value) })),
    });
    fields += formatField('mindColor', 'mind-color', d.extensions?.[MIND]?.color || d.style.color, {
      color: true,
    });
    fields += formatField('color', 'color', d.style.color, { color: true });
    for (const [field, values] of [
      ['line', ['solid', 'dashed', 'dotted']],
      ['arrow', ['none', 'start', 'end', 'both']],
    ])
      fields += formatField(field, field, d.style[field], {
        options: values.map((v) => ({ value: v, label: t(v) })),
      });
    fields += closeSection + section('inspectorEndpointsGroup');
    for (const field of ['source', 'target'])
      fields += formatField(field, field, d[field], {
        options: cards.map((c) => ({ value: c.id, label: c.title })),
      });
    fields +=
      closeSection +
      section('inspectorInformationGroup') +
      formatField('label', 'label', d.label) +
      formatField('type', 'type', d.type) +
      formatField('description', 'description', d.description, { textarea: true }) +
      closeSection;
  } else
    fields =
      labelField('title', 'title', d.title) +
      labelField('description', 'description', d.description, { textarea: true });
  return fields;
}
