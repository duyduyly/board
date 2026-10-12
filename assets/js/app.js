import {
  NODE,
  MIND,
  nodeStyle,
  geometry,
  setGeometry,
  setRoot,
  relationKind,
} from './graph/mind-map.js';
import { APPEARANCE, appearance, applyAppearance } from './detail/appearance.js';
import {
  recoveryEnabled,
  readRecovery,
  saveRecovery,
  enableRecovery,
  disableRecovery,
} from './store/recovery.js';
import {
  captureEditor,
  restoreEditor,
  addContents,
  template,
  markdownDocument,
} from './detail/writing.js';
import { installImagePreview, closeImagePreview } from './detail/image-preview.js';
import {
  IMAGE_NAMESPACE,
  IMAGE_MIME_TYPES,
  validImageAttachment,
  imageReference,
} from './detail/attachments.js';
import {
  ProjectStore,
  newId,
  newCard,
  newRelation,
  remove,
  search,
  searchExcerpt,
} from './store/project-store.js';
import { blank, stage, validate, serialize, filename, LIMITS } from './json/validator.js';
import { t, setLocale, getLocale, issueMessage, number } from './i18n/index.js';
import { GraphAdapter } from './canvas/adapter.js';
import { renderMarkdown } from './detail/markdown.js';
const $ = (s) => document.querySelector(s);
const clone = (x) => structuredClone(x);
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const store = new ProjectStore();
let selection = null,
  tab = 'overview',
  draft = null,
  draftOriginal = null,
  connectSource = null,
  connectMode = false,
  query = '',
  allowImages = false,
  panelVersion = 0,
  modalState = null,
  toastTimer = null,
  expanded = false,
  lastExport = false,
  theme = 'light',
  imageUploadPending = false,
  writing = false,
  previewDraft = false,
  previousPanelKey = null,
  sourceEditorState = null,
  recoveryPending = recoveryEnabled(),
  recoveryTimer = null,
  recoveredSnapshot = null,
  draftMindSize = null,
  originalMindSize = null;
function entity() {
  if (selection?.kind === 'project') return store.project.metadata;
  return selection
    ? store.project[selection.kind === 'card' ? 'cards' : 'relations'].find(
        (e) => e.id === selection.id,
      )
    : null;
}
function draftDirty() {
  return (
    draft &&
    (JSON.stringify(draft) !== JSON.stringify(draftOriginal) ||
      JSON.stringify(draftMindSize) !== JSON.stringify(originalMindSize))
  );
}
function toast(key) {
  clearTimeout(toastTimer);
  $('#toast').textContent = t(key);
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => ($('#toast').hidden = true), 5000);
}
function translate(root = document) {
  document.title = t('pageTitle');
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle);
    el.setAttribute('aria-label', t(el.dataset.i18nTitle));
  }
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
    el.setAttribute('aria-label', t(el.dataset.i18nPlaceholder));
  }
}
function updateStatus() {
  const key = draftDirty()
    ? 'draftState'
    : store.dirty
      ? 'unsaved'
      : lastExport
        ? 'exported'
        : 'clean';
  $('#save-state').textContent = t(key) + (store.viewChanged ? ' · ' + t('viewChanged') : '');
  $('#save-state').classList.toggle('dirty', Boolean(store.dirty || draftDirty()));
  scheduleRecovery();
}
function errorLines(issues) {
  return issues.map((e) => e.path + ': ' + issueMessage(e)).join('\n');
}
function change(mutator) {
  try {
    const result = store.commit(mutator);
    lastExport = false;
    if (store.notice) toast('historyLimit');
    return result;
  } catch (e) {
    showMessage('invalid', () => errorLines(e.issues || [{ path: '$root', code: 'unknown' }]));
    return false;
  }
}
export const adapter = new GraphAdapter($('#canvas-region'), $('#cards-layer'), {
  select: (s, edit = false) => select(s, edit),
  open: async (s) => {
    if (!(await guardDraft())) return;
    connectMode = false;
    connectSource = null;
    if (!(await select(s))) return;
    tab = 'overview';
    draft = null;
    draftOriginal = null;
    render();
  },
  move: (id, position) =>
    change((p) => {
      setGeometry(p, id, store.activeView, 'position', position);
    }),
  connection: (source, target, pos) => connection(source, target, pos),
  viewport: (zoom, position) => {
    store.setView(zoom, position);
    updateStatus();
  },
  locked: () => Boolean(draftDirty() || modalState),
});
function render() {
  const themeButton = $('#theme-toggle');
  themeButton.dataset.i18nTitle = theme === 'dark' ? 'lightMode' : 'darkMode';
  themeButton.querySelector('[data-i18n]').dataset.i18n =
    theme === 'dark' ? 'darkTheme' : 'lightTheme';
  themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
  $('[data-action=focus]').disabled = !['card', 'relation'].includes(selection?.kind);
  if (selection && !entity()) {
    selection = null;
    draft = null;
    draftOriginal = null;
  }
  adapter.sync(store.project, selection, store.activeView);
  $('#map-view').value = store.activeView;
  $('#mind-map-hint').hidden =
    store.activeView !== 'mind' || Boolean(store.project.extensions?.[MIND]?.rootId);
  $('#mind-map-hint').textContent = t('mindHint');
  $('#project-name').textContent = store.project.metadata.title;
  $('#project-name').title = t('projectSettings');
  $('#project-name').setAttribute(
    'aria-label',
    t('projectSettings') + ': ' + store.project.metadata.title,
  );
  $('#welcome').hidden = store.project.cards.length > 0;
  $('#counts').textContent =
    number(store.project.cards.length) +
    ' ' +
    t('cards') +
    ' · ' +
    number(store.project.relations.length) +
    ' ' +
    t('relations');
  for (const key of ['undo', 'redo'])
    $('[data-action=' + key + ']').disabled =
      key === 'undo' ? !store.undoStack.length : !store.redoStack.length;
  $('[data-action=connect]').classList.toggle('primary', connectMode);
  $('#connect-hint').hidden = !connectMode;
  $('#connect-hint').textContent = t('chooseTarget');
  renderList();
  renderPanel();
  updateStatus();
  translate();
  scheduleRecovery();
}
let listProject = null,
  listQuery = null,
  listLocale = null,
  listSelection = null;
function renderList() {
  const host = $('#card-list');
  if (listProject === store.project && listQuery === query && listLocale === getLocale()) {
    if (listSelection)
      host
        .querySelector('[data-card-id="' + CSS.escape(listSelection) + '"]')
        ?.classList.remove('active');
    if (selection?.kind === 'card')
      host
        .querySelector('[data-card-id="' + CSS.escape(selection.id) + '"]')
        ?.classList.add('active');
    listSelection = selection?.kind === 'card' ? selection.id : null;
    return;
  }
  listProject = store.project;
  listQuery = query;
  listLocale = getLocale();
  listSelection = selection?.kind === 'card' ? selection.id : null;
  const degrees = new Map();
  for (const r of store.project.relations) {
    degrees.set(r.source, (degrees.get(r.source) || 0) + 1);
    degrees.set(r.target, (degrees.get(r.target) || 0) + 1);
  }
  host.replaceChildren();
  const cards = search(store.project.cards, query);
  if (!cards.length && query) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = t('noResults');
    host.append(p);
  }
  for (const c of cards) {
    const btn = document.createElement('button');
    btn.className =
      'card-row' + (selection?.kind === 'card' && selection.id === c.id ? ' active' : '');
    btn.dataset.cardId = c.id;
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = c.style.backgroundColor;
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = c.title;
    const degree = document.createElement('span');
    degree.className = 'degree';
    degree.textContent = number(degrees.get(c.id) || 0);
    btn.append(dot, name, degree);
    btn.onclick = async () => {
      if (await select({ kind: 'card', id: c.id })) adapter.focus(c.id);
    };
    const excerpt = query && searchExcerpt(c, query);
    if (excerpt) {
      const snippet = document.createElement('small');
      snippet.className = 'search-excerpt';
      const q = query.trim();
      const index = excerpt.toLocaleLowerCase().indexOf(q.toLocaleLowerCase());
      snippet.append(document.createTextNode(excerpt.slice(0, index)));
      const mark = document.createElement('mark');
      mark.textContent = excerpt.slice(index, index + q.length);
      snippet.append(mark, document.createTextNode(excerpt.slice(index + q.length)));
      btn.append(snippet);
      btn.classList.add('has-excerpt');
    }
    host.append(btn);
  }
}
function beginDraft() {
  draft = clone(entity());
  draftOriginal = clone(draft);
  draftMindSize =
    selection?.kind === 'card' ? clone(geometry(store.project, entity(), 'mind').size) : null;
  originalMindSize = clone(draftMindSize);
}
async function select(next, edit = false) {
  if (modalState) return false;
  if (connectMode && next?.kind === 'card') {
    if (!connectSource) {
      connectSource = next.id;
      return true;
    }
    await connection(connectSource, next.id);
    return true;
  }
  if (JSON.stringify(selection) === JSON.stringify(next) && !edit) return true;
  if (!(await guardDraft())) return false;
  selection = next;
  tab = next?.kind === 'relation' || edit || next?.kind === 'project' ? 'edit' : 'overview';
  draft = null;
  draftOriginal = null;
  if (tab === 'edit' && entity()) beginDraft();
  render();
  return true;
}
function labelField(key, name, value, { textarea = false, color = false, options = null } = {}) {
  let control;
  if (options)
    control =
      '<select name="' +
      name +
      '">' +
      options
        .map(
          (o) =>
            '<option value="' +
            esc(o.value) +
            '"' +
            (o.value === value ? ' selected' : '') +
            '>' +
            esc(o.label) +
            '</option>',
        )
        .join('') +
      '</select>';
  else if (textarea) control = '<textarea name="' + name + '">' + esc(value) + '</textarea>';
  else
    control =
      '<input type="' +
      (color ? 'color' : 'text') +
      '" name="' +
      name +
      '" value="' +
      esc(value) +
      '">';
  return '<label>' + esc(t(key)) + control + '</label>';
}
function renderPanel() {
  const body = $('#panel-body');
  const key = selection?.kind + ':' + selection?.id + ':' + tab;
  const state = previousPanelKey === key ? captureEditor(body) : null;
  if (previousPanelKey !== key) {
    previewDraft = false;
    sourceEditorState = null;
  }
  if (state && body.querySelector('.writing-source[hidden]') && sourceEditorState)
    state.fields = sourceEditorState.fields;
  else if (state && body.querySelector('.writing-source')) sourceEditorState = state;
  previousPanelKey = key;
  renderPanelContent();
  restoreEditor(body, state);
  $('#writing-exit').hidden = !(writing && selection?.kind === 'card');
  document.documentElement.classList.toggle('writing-mode', writing && selection?.kind === 'card');
}
function renderPanelContent() {
  closeImagePreview();
  const version = ++panelVersion,
    panel = $('#detail-panel'),
    body = $('#panel-body'),
    e = entity();
  panel.hidden = !e;
  if (!e) {
    body.replaceChildren();
    return;
  }
  $('#panel-title').textContent =
    selection.kind === 'project'
      ? t('projectSettings')
      : selection.kind === 'card'
        ? e.title
        : t('relation');
  const tabs = $('#panel-tabs');
  tabs.replaceChildren();
  if (selection.kind === 'card')
    for (const mode of ['overview', 'edit', 'format']) {
      const button = document.createElement('button');
      button.textContent = t(mode === 'format' ? 'appearanceTab' : mode);
      button.className = tab === mode ? 'active' : '';
      button.onclick = async () => {
        if (mode === tab) return;
        const editing = ['edit', 'format'].includes(tab) && ['edit', 'format'].includes(mode);
        if (!editing && !(await guardDraft())) return;
        tab = mode;
        if (!editing) {
          draft = null;
          draftOriginal = null;
          if (mode !== 'overview') beginDraft();
        }
        renderPanel();
        updateStatus();
      };
      tabs.append(button);
    }
  if (tab === 'overview' && selection.kind === 'card') {
    body.innerHTML =
      '<p class="summary">' +
      esc(e.summary) +
      '</p><div class="type-tags">' +
      [...new Set([e.type, ...e.tags])]
        .filter(Boolean)
        .map((v) => '<span>' + esc(v) + '</span>')
        .join('') +
      '</div><div class="markdown"></div><div class="image-opt"><p class="muted">' +
      esc(t('imageNotice')) +
      '</p><button id="allow-images">' +
      esc(t('loadImages')) +
      '</button></div><div id="relations-list" class="relations-section"></div>';
    const host = body.querySelector('.markdown');
    if (e.content)
      renderMarkdown(host, e.content, {
        allowImages,
        images: e.extensions?.[IMAGE_NAMESPACE] || {},
        isCurrent: () => version === panelVersion,
      })
        .then(() => {
          if (version === panelVersion) addContents(host);
        })
        .catch(() => {
          if (version === panelVersion) host.textContent = t('errorDiagram');
        });
    else host.innerHTML = '<p class="muted">' + esc(t('noContent')) + '</p>';
    body.querySelector('#allow-images').hidden = allowImages;
    body.querySelector('#allow-images').onclick = () => {
      allowImages = true;
      renderPanel();
    };
    const list = body.querySelector('#relations-list');
    for (const dir of ['incoming', 'outgoing']) {
      const edges = store.project.relations.filter(
        (r) => r[dir === 'incoming' ? 'target' : 'source'] === e.id,
      );
      const h = document.createElement('h3');
      h.textContent = t(dir) + ' (' + number(edges.length) + ')';
      list.append(h);
      if (!edges.length) {
        const p = document.createElement('p');
        p.className = 'muted';
        p.textContent = t('noRelations');
        list.append(p);
      }
      for (const r of edges) {
        const peer = r[dir === 'incoming' ? 'source' : 'target'],
          c = store.project.cards.find((c) => c.id === peer),
          btn = document.createElement('button');
        btn.className = 'relation-link';
        btn.innerHTML =
          '<span>' + esc(c.title) + '</span><span>' + esc(r.label || r.type) + '</span>';
        btn.onclick = async () => {
          if (await select({ kind: 'card', id: peer })) adapter.focus(peer);
        };
        list.append(btn);
      }
    }
    return;
  }
  if (!draft) beginDraft();
  const d = draft;
  let fields = '';
  if (selection.kind === 'card' && tab === 'format') {
    const a = appearance(d);
    const config = nodeStyle(d);
    const activeSize = store.activeView === 'mind' ? draftMindSize : d.size;
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
      ['backgroundColor', 'textColor', 'borderColor']
        .map((k) => labelField(k, k, d.style[k], { color: true }))
        .join('') +
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
  } else if (selection.kind === 'card') {
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
      ['backgroundColor', 'textColor', 'borderColor']
        .map((k) => labelField(k, k, d.style[k], { color: true }))
        .join('') +
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
  } else if (selection.kind === 'relation') {
    fields += labelField('relationKind', 'mind-kind', relationKind(d), {
      options: ['reference', 'branch'].map((value) => ({ value, label: t(value) })),
    });
    fields += labelField('mindColor', 'mind-color', d.extensions?.[MIND]?.color || d.style.color, {
      color: true,
    });
    for (const field of ['source', 'target'])
      fields += labelField(field, field, d[field], {
        options: store.project.cards.map((c) => ({ value: c.id, label: c.title })),
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
  body.innerHTML =
    '<form class="editor">' +
    fields +
    '<div class="form-errors" role="alert"></div><div class="editor-actions"><button class="primary" type="submit">' +
    esc(t('apply')) +
    '</button><button type="button" id="cancel-draft">' +
    esc(t('cancel')) +
    '</button></div>' +
    (selection.kind === 'project'
      ? ''
      : '<div class="editor-actions">' +
        (selection.kind === 'card'
          ? '<button type="button" id="duplicate">' + esc(t('duplicate')) + '</button>'
          : '') +
        '<button type="button" id="delete" class="danger">' +
        esc(t('delete')) +
        '</button></div>') +
    '</form>';
  const form = body.querySelector('form');
  form.oninput = (event) => {
    for (const input of form.querySelectorAll('[name]')) {
      const name = input.name;
      if ((name.startsWith('node-') || name.startsWith('mind-')) && event.target !== input)
        continue;
      const value = input.value;
      if (name === 'tags')
        draft.tags = value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
      else if (
        ['backgroundColor', 'textColor', 'borderColor', 'color', 'line', 'arrow'].includes(name)
      )
        draft.style[name] = value;
      else if (['width', 'height'].includes(name)) {
        if (store.activeView === 'mind') draftMindSize[name] = Number(value);
        else draft.size[name] = Number(value);
      } else if (name.startsWith('node-')) {
        const key = name.slice(5);
        draft.extensions ||= {};
        draft.extensions[NODE] ||= { ...nodeStyle(draft) };
        if (key === 'coverImageId' && !value) delete draft.extensions[NODE][key];
        else draft.extensions[NODE][key] = value;
      } else if (name.startsWith('mind-')) {
        draft.extensions ||= {};
        draft.extensions[MIND] ||= { kind: 'reference' };
        draft.extensions[MIND][name.slice(5)] = value;
      } else if (name.startsWith('appearance-')) {
        const key = name.slice(11);
        draft.extensions ||= {};
        draft.extensions[APPEARANCE] ||= {};
        draft.extensions[APPEARANCE][key] = ['align', 'shadow'].includes(key)
          ? value
          : Number(value);
      } else draft[name] = value;
    }
    updateFormatPreview();
    updateStatus();
    scheduleRecovery();
  };
  form.onsubmit = (ev) => {
    ev.preventDefault();
    applyDraft();
  };
  $('#cancel-draft').onclick = () => {
    beginDraft();
    renderPanel();
    updateStatus();
  };
  function updateFormatPreview() {
    const host = $('#format-card-preview');
    if (!host) return;
    host.innerHTML =
      '<article class="graph-card"><div class="card-kicker"><span class="card-badge type-badge">' +
      esc(draft.type) +
      '</span></div><h3>' +
      esc(draft.title) +
      '</h3><p class="card-summary">' +
      esc(draft.summary) +
      '</p><div class="card-meta">' +
      draft.tags
        .slice(0, 2)
        .map((tag) => '<span class="card-badge tag-badge">' + esc(tag) + '</span>')
        .join('') +
      '</div></article>';
    const card = host.firstElementChild;
    const config = nodeStyle(draft),
      simple = store.activeView === 'mind' || config.kind !== 'card';
    if (simple) {
      card.replaceChildren();
      card.classList.add('simple-node');
      if (['image', 'image-text'].includes(config.kind)) {
        const frame = document.createElement('div');
        frame.className = 'node-image-frame';
        const img = document.createElement('img');
        img.alt = config.imageAlt || draft.title;
        img.style.objectFit = config.imageFit;
        const attachment = draft.extensions?.[IMAGE_NAMESPACE]?.[config.coverImageId];
        if (attachment) img.src = 'data:' + attachment.mimeType + ';base64,' + attachment.data;
        frame.append(img);
        card.append(frame);
      }
      if (config.kind !== 'image') {
        const title = document.createElement('h3');
        title.textContent = draft.title;
        card.append(title);
      }
    }
    const previewSize = store.activeView === 'mind' ? draftMindSize : draft.size;
    card.style.width = Math.min(10000, Math.max(1, previewSize.width)) + 'px';
    card.style.height = Math.min(10000, Math.max(1, previewSize.height)) + 'px';
    applyAppearance(card, draft);
    card.style.setProperty('--card-background', draft.style.backgroundColor);
    card.style.setProperty('--card-ink', draft.style.textColor);
    card.style.setProperty('--card-border', draft.style.borderColor);
  }
  updateFormatPreview();
  if ($('#set-root'))
    $('#set-root').onclick = async () => {
      if (!(await guardDraft())) return;
      const id = selection?.id;
      if (!id) return;
      const hasParent = store.project.relations.some(
        (r) => relationKind(r) === 'branch' && r.target === id,
      );
      if (
        hasParent &&
        (await dialog('rootDetachTitle', () => '<p>' + esc(t('rootDetachBody')) + '</p>', [
          ['cancel', 'cancel'],
          ['detachRoot', 'detach', true],
        ])) !== 'detach'
      )
        return;
      change((p) => setRoot(p, id, true));
    };
  if ($('#clear-root')) {
    $('#clear-root').disabled = !store.project.extensions?.[MIND]?.rootId;
    $('#clear-root').onclick = async () => {
      if (await guardDraft()) change((p) => setRoot(p, null));
    };
  }
  if ($('#reset-appearance')) {
    $('#reset-appearance').onclick = () => {
      if (draft.extensions) delete draft.extensions[APPEARANCE];
      renderPanel();
      updateStatus();
    };
    for (const button of body.querySelectorAll('[data-shape]'))
      button.onclick = () => {
        draft.extensions ||= {};
        draft.extensions[APPEARANCE] = {
          ...appearance(draft),
          radius: button.dataset.shape === 'rectangle' ? 0 : 24,
        };
        renderPanel();
        updateStatus();
      };
  }
  for (const button of body.querySelectorAll('[data-text-format]')) {
    button.onpointerdown = (event) => event.preventDefault();
    button.onclick = () => {
      const input = body.querySelector('textarea[name=content]');
      if (!input) return;
      const start = input.selectionStart,
        end = input.selectionEnd;
      const selected = input.value.slice(start, end) || t('content');
      const mode = button.dataset.textFormat;
      const pair =
        mode === 'bold'
          ? ['**', '**']
          : mode === 'italic'
            ? ['*', '*']
            : mode === 'inlineCode'
              ? [String.fromCharCode(96), String.fromCharCode(96)]
              : ['[', ']{color:' + $('#inline-text-color').value + '}'];
      input.setRangeText(pair[0] + selected + pair[1], start, end, 'select');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    };
  }
  if ($('#writing-toggle')) {
    $('#writing-toggle').onclick = () => {
      writing = !writing;
      renderPanel();
      body.querySelector('.editor-metadata').open = !writing;
      body.scrollTop = 0;
      adapter.cy.resize();
    };
    $('#draft-preview-toggle').onclick = () => {
      previewDraft = !previewDraft;
      renderPanel();
    };
    $('#download-markdown').onclick = () => {
      try {
        download(
          markdownDocument(draft),
          filename(draft.title).replace(/\.json$/, '.md'),
          'text/markdown;charset=utf-8',
        );
      } catch {
        toast('errorExport');
      }
    };
    $('#template-select').onchange = (event) => {
      if (!event.target.value) return;
      draft.content += template(event.target.value);
      renderPanel();
      updateStatus();
      scheduleRecovery();
    };
    if (previewDraft) {
      const host = body.querySelector('.draft-preview .markdown');
      renderMarkdown(host, draft.content, {
        allowImages,
        images: draft.extensions?.[IMAGE_NAMESPACE] || {},
        isCurrent: () => version === panelVersion,
      })
        .then(() => {
          if (version === panelVersion) addContents(host);
        })
        .catch(() => {
          if (version === panelVersion) host.textContent = t('errorDiagram');
        });
    }
  }
  if ($('#insert-image')) {
    $('#insert-image').onclick = () => $('#embedded-image-input').click();
    $('#embedded-image-input').onchange = (event) => {
      const file = event.target.files[0];
      event.target.value = '';
      insertImage(file);
    };
    for (const button of form.querySelectorAll('[data-remove-image]'))
      button.onclick = () => {
        const id = button.dataset.removeImage;
        const image = draft.extensions?.[IMAGE_NAMESPACE]?.[id];
        if (!image) return;
        if (nodeStyle(draft).coverImageId === id) {
          toast('coverDeleteGuard');
          return;
        }
        draft.content = draft.content.split(imageReference(id, image.name)).join('');
        delete draft.extensions[IMAGE_NAMESPACE][id];
        if (!Object.keys(draft.extensions[IMAGE_NAMESPACE]).length)
          delete draft.extensions[IMAGE_NAMESPACE];
        if (!Object.keys(draft.extensions).length) delete draft.extensions;
        renderPanel();
        updateStatus();
      };
  }
  if ($('#duplicate')) $('#duplicate').onclick = duplicate;
  if ($('#delete')) $('#delete').onclick = deleteSelected;
}
async function insertImage(file) {
  if (!file || imageUploadPending || selection?.kind !== 'card' || !draft) return;
  if (!IMAGE_MIME_TYPES.includes(file.type)) {
    toast('errorImageAttachment');
    return;
  }
  if (file.size > LIMITS.file) {
    toast('errorFileLimit');
    return;
  }
  const target = draft;
  const cardId = selection.id;
  const textarea = $('textarea[name=content]');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const originalContent = target.content;
  imageUploadPending = true;
  $('#insert-image').disabled = true;
  try {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('read'));
      reader.readAsDataURL(file);
    });
    const image = { name: file.name, mimeType: file.type, data };
    if (!validImageAttachment(image)) throw new Error('image');
    const decoded = new Image();
    decoded.src = 'data:' + image.mimeType + ';base64,' + image.data;
    await decoded.decode();
    if (draft !== target || selection?.id !== cardId || selection?.kind !== 'card') return;
    const candidate = clone(target);
    const id = newId('image');
    candidate.extensions = {
      ...candidate.extensions,
      [IMAGE_NAMESPACE]: { ...candidate.extensions?.[IMAGE_NAMESPACE], [id]: image },
    };
    const reference = '\n\n' + imageReference(id, image.name) + '\n\n';
    candidate.content =
      target.content === originalContent
        ? target.content.slice(0, start) + reference + target.content.slice(end)
        : target.content + reference;
    const project = clone(store.project);
    project.cards = project.cards.map((card) => (card.id === cardId ? candidate : card));
    const result = validate(project);
    if (result.errors.length) {
      $('#panel-body .form-errors').textContent = errorLines(result.errors);
      return;
    }
    draft = candidate;
    renderPanel();
    updateStatus();
    toast('imageInserted');
  } catch {
    if (draft === target && selection?.id === cardId) toast('errorImageAttachment');
  } finally {
    imageUploadPending = false;
    const button = $('#insert-image');
    if (button) button.disabled = false;
  }
}
function applyDraft() {
  if (!draft) return true;
  const p = clone(store.project);
  if (selection.kind === 'project') p.metadata = clone(draft);
  else {
    const kind = selection.kind === 'card' ? 'cards' : 'relations';
    p[kind] = p[kind].map((e) => (e.id === selection.id ? clone(draft) : e));
  }
  if (
    selection.kind === 'card' &&
    JSON.stringify(draftMindSize) !== JSON.stringify(originalMindSize)
  )
    setGeometry(p, selection.id, 'mind', 'size', draftMindSize);
  const result = validate(p);
  if (result.errors.length) {
    $('#panel-body .form-errors').textContent = errorLines(result.errors);
    return false;
  }
  const d = clone(draft),
    s = clone(selection);
  draftOriginal = clone(draft);
  change((project) => {
    if (s.kind === 'project') project.metadata = d;
    else {
      const kind = s.kind === 'card' ? 'cards' : 'relations';
      project[kind] = project[kind].map((e) => (e.id === s.id ? d : e));
      if (s.kind === 'card' && JSON.stringify(draftMindSize) !== JSON.stringify(originalMindSize))
        setGeometry(project, s.id, 'mind', 'size', draftMindSize);
    }
  });
  beginDraft();
  renderPanel();
  updateStatus();
  return true;
}
function dialog(titleKey, body, buttons) {
  if (modalState) throw Error('dialog already open');
  return new Promise((resolve) => {
    modalState = { titleKey, body, buttons, resolve };
    renderModal();
    $('#modal').showModal();
  });
}
function renderModal() {
  if (!modalState) return;
  const { titleKey, body, buttons } = modalState;
  $('#modal-content').innerHTML =
    '<div class="modal-inner"><h2>' +
    esc(t(titleKey)) +
    '</h2><select id="modal-locale" aria-label="Tiếng Việt / English"><option value="vi">Tiếng Việt</option><option value="en">English</option></select><div class="modal-body"></div><div class="modal-actions"></div></div>';
  $('#modal-locale').value = getLocale();
  $('#modal-locale').onchange = (e) => {
    $('#locale').value = e.target.value;
    setLocale(e.target.value);
    render();
    renderModal();
  };
  const result = body();
  const host = $('.modal-body');
  if (typeof result === 'string') host.innerHTML = result;
  else host.append(result);
  for (const [key, value, primary = false, disabled = false] of buttons) {
    const b = document.createElement('button');
    b.textContent = t(key);
    b.disabled = typeof disabled === 'function' ? disabled() : disabled;
    b.className = primary ? 'primary' : '';
    b.dataset.choice = value;
    b.onclick = () => finishDialog(value);
    $('.modal-actions').append(b);
  }
}
function finishDialog(value) {
  const state = modalState;
  if (!state) return;
  modalState = null;
  $('#modal').close();
  state.resolve(value);
}
$('#modal').addEventListener('cancel', (e) => {
  e.preventDefault();
  finishDialog('cancel');
});
async function showMessage(titleKey, message) {
  if (modalState) return;
  return dialog(titleKey, () => '<pre>' + esc(message()) + '</pre>', [['close', 'cancel']]);
}
async function guardDraft() {
  if (!draftDirty()) return true;
  const choice = await dialog('draftTitle', () => '<p>' + esc(t('draftBody')) + '</p>', [
    ['cancel', 'cancel'],
    ['discard', 'discard'],
    ['apply', 'apply', true],
  ]);
  if (choice === 'cancel') return false;
  if (choice === 'apply' && !applyDraft()) return false;
  draft = null;
  draftOriginal = null;
  return true;
}
async function connection(source, target, position) {
  if (!(await guardDraft())) return;
  connectMode = false;
  connectSource = null;
  if (target === source) {
    toast('errorSelfLoop');
    render();
    return;
  }
  let card;
  if (!target) {
    const p = position || adapter.center();
    card = newCard({ x: p.x - 130, y: p.y - 95 }, t('newCard'));
    target = card.id;
  }
  const r = newRelation(source, target);
  if (
    !change((p) => {
      if (card) {
        p.cards.push(card);
        if (store.activeView === 'mind') setGeometry(p, card.id, 'mind', 'position', card.position);
      }
      p.relations.push(r);
    })
  )
    return;
  if (card) {
    selection = { kind: 'card', id: card.id };
    tab = 'edit';
    beginDraft();
  }
  render();
}
async function addCard() {
  if (!(await guardDraft())) return;
  const pos = adapter.center(),
    card = newCard({ x: pos.x - 130, y: pos.y - 95 }, t('newCard'));
  if (
    !change((p) => {
      p.cards.push(card);
      if (store.activeView === 'mind') setGeometry(p, card.id, 'mind', 'position', card.position);
    })
  )
    return;
  selection = { kind: 'card', id: card.id };
  tab = 'edit';
  beginDraft();
  render();
}
async function duplicate() {
  if (selection?.kind !== 'card' || !(await guardDraft())) return;
  const original = entity();
  const card = clone(original);
  card.id = newId('card');
  card.position = { x: card.position.x + 36, y: card.position.y + 36 };
  if (
    !change((p) => {
      p.cards.push(card);
      const mind = geometry(p, original, 'mind');
      if (store.activeView === 'mind' || p.extensions?.['card-atlas:views']?.mindMap) {
        setGeometry(p, card.id, 'mind', 'position', {
          x: mind.position.x + 36,
          y: mind.position.y + 36,
        });
        setGeometry(p, card.id, 'mind', 'size', mind.size);
      }
    })
  )
    return;
  selection = { kind: 'card', id: card.id };
  tab = 'edit';
  beginDraft();
  render();
}
async function deleteSelected() {
  if (!selection || selection.kind === 'project' || !(await guardDraft())) return;
  const s = clone(selection);
  selection = null;
  draft = null;
  draftOriginal = null;
  change((p) => remove(p, s));
  render();
}

function recoverySnapshot() {
  return {
    project: clone(store.project),
    viewport: clone(store.viewport),
    activeView: store.activeView,
    viewports: clone(store.viewports),
    draftMindSize: clone(draftMindSize),
    originalMindSize: clone(originalMindSize),
    selection: clone(selection),
    draft: clone(draft),
    draftOriginal: clone(draftOriginal),
    tab,
    time: Date.now(),
  };
}
function scheduleRecovery() {
  clearTimeout(recoveryTimer);
  if (!recoveryEnabled() || recoveryPending) return;
  recoveryTimer = setTimeout(async () => {
    try {
      await saveRecovery(recoverySnapshot());
      $('#recovery-status').textContent = t('recoverySaved');
    } catch {
      $('#recovery-status').textContent = t('recoveryError');
      toast('recoveryError');
    }
  }, 500);
}
async function recoveryDialog() {
  const enabled = recoveryEnabled();
  const choice = await dialog(
    'recovery',
    () =>
      '<p>' +
      esc(t('recoveryInfo')) +
      '</p><p>' +
      esc(t(enabled ? 'recoveryOn' : 'session')) +
      '</p>' +
      (recoveredSnapshot ? '<p>' + esc(t('recoveryReady')) + '</p>' : ''),
    [
      ['cancel', 'cancel'],
      ...(recoveredSnapshot
        ? [
            ['restoreRecovery', 'restore'],
            ['keepSession', 'keep'],
          ]
        : []),
      [enabled ? 'recoveryDisable' : 'recoveryEnable', enabled ? 'disable' : 'enable', true],
    ],
  );
  if (choice === 'cancel') return;
  try {
    if (choice === 'disable') {
      clearTimeout(recoveryTimer);
      await disableRecovery();
      recoveredSnapshot = null;
      recoveryPending = false;
      $('#recovery-status').textContent = '';
      toast('recoveryDeleted');
    }
    if (choice === 'enable') {
      enableRecovery();
      recoveryPending = false;
      scheduleRecovery();
    }
    if (choice === 'restore') await restoreRecovery();
    if (choice === 'keep') {
      recoveredSnapshot = null;
      recoveryPending = false;
      scheduleRecovery();
    }
  } catch {
    toast('recoveryError');
  }
}
async function restoreRecovery() {
  if (!recoveredSnapshot) return;
  const snapshot = recoveredSnapshot;
  const staged = stage(JSON.stringify(snapshot.project));
  if (staged.errors.length) {
    toast('recoveryError');
    return;
  }
  if (!(await replaceProject(staged.project, true))) return;
  if (snapshot.viewports) store.viewports = clone(snapshot.viewports);
  store.switchView(snapshot.activeView === 'mind' ? 'mind' : 'card');
  if (snapshot.viewport) store.setView(snapshot.viewport.zoom, snapshot.viewport.position);
  selection = snapshot.selection;
  tab = ['edit', 'format'].includes(snapshot.tab) ? snapshot.tab : 'overview';
  draft = snapshot.draft;
  draftOriginal = snapshot.draftOriginal;
  draftMindSize =
    snapshot.draftMindSize ||
    (selection?.kind === 'card' && entity()
      ? clone(geometry(store.project, entity(), 'mind').size)
      : null);
  originalMindSize = snapshot.originalMindSize || clone(draftMindSize);
  if (!entity()) {
    selection = null;
    draft = null;
    draftOriginal = null;
    tab = 'overview';
  }
  lastExport = false;
  store.adjusted = true;
  recoveryPending = false;
  recoveredSnapshot = null;
  render();
  adapter.setViewport(store.viewport);
  toast('recoveryRestored');
}
async function initializeRecovery() {
  if (!recoveryEnabled()) return;
  recoveryPending = true;
  try {
    recoveredSnapshot = await readRecovery();
    if (recoveredSnapshot) {
      $('#recovery-status').textContent = t('recoveryReady');
      await recoveryDialog();
    } else {
      recoveryPending = false;
      scheduleRecovery();
    }
  } catch {
    toast('recoveryError');
  }
}

function download(text, name, type = 'application/json') {
  const blob = new Blob([text], { type }),
    url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
async function exportProject() {
  if (draftDirty()) {
    const choice = await dialog('exportDraftTitle', () => '<p>' + esc(t('draftBody')) + '</p>', [
      ['cancel', 'cancel'],
      ['exportApplied', 'applied'],
      ['applyExport', 'apply', true],
    ]);
    if (choice === 'cancel') return false;
    if (choice === 'apply' && !applyDraft()) return false;
  }
  try {
    const text = serialize(store.project, store.viewport, store.viewports);
    if (new TextEncoder().encode(text).length > LIMITS.file) throw Error('fileLimit');
    download(text, filename(store.project.metadata.title));
    lastExport = true;
    store.exported();
    toast('exportHint');
    return true;
  } catch {
    toast('errorExport');
    return false;
  }
}
async function createProject() {
  if (!(await guardDraft())) return;
  let title = t('untitledProject');
  const body = () => {
    const container = document.createElement('div');
    const label = document.createElement('label');
    label.className = 'new-project-label';
    label.textContent = t('projectName');
    const input = document.createElement('input');
    input.id = 'new-project-title';
    input.value = title;
    input.autocomplete = 'off';
    input.setAttribute('aria-label', t('projectName'));
    input.oninput = () => {
      title = input.value;
      $('[data-choice=create]').disabled = !title.trim();
    };
    input.onkeydown = (event) => {
      if (event.key === 'Enter' && title.trim()) {
        event.preventDefault();
        finishDialog('create');
      }
    };
    label.append(input);
    const hint = document.createElement('p');
    hint.textContent = t('newProjectHint');
    container.append(label, hint);
    return container;
  };
  const choice = dialog('newProject', body, [
    ['cancel', 'cancel'],
    ['createProject', 'create', true, () => !title.trim()],
  ]);
  $('#new-project-title').focus();
  $('#new-project-title').select();
  if ((await choice) !== 'create') return;
  const project = blank();
  project.metadata.title = title.trim();
  if (await replaceProject(project)) toast('projectCreated');
}
async function replaceProject(p, adjusted = false) {
  if (!(await guardDraft())) return false;
  if (store.dirty) {
    const choice = await dialog('replaceTitle', () => '<p>' + esc(t('replaceBody')) + '</p>', [
      ['cancel', 'cancel'],
      ['replaceWithout', 'replace'],
      ['exportCurrent', 'export', true],
    ]);
    if (choice === 'cancel') return false;
    if (choice === 'export' && !(await exportProject())) return false;
  }
  selection = null;
  draft = null;
  draftOriginal = null;
  connectMode = false;
  connectSource = null;
  query = '';
  $('#search').value = '';
  lastExport = false;
  store.replace(p, adjusted);
  adapter.setViewport(store.viewport);
  return true;
}
async function importFile(file) {
  if (!file) return;
  let result;
  try {
    result =
      file.size > 10 * 1024 * 1024 ? stage('', file.size) : stage(await file.text(), file.size);
  } catch {
    toast('errorRead');
    return;
  }
  const body = () => {
    let html = result.project
      ? '<p>' +
        esc(result.project.metadata.title) +
        ' · ' +
        number(result.project.cards.length) +
        ' ' +
        t('cards') +
        ' · ' +
        number(result.project.relations.length) +
        ' ' +
        t('relations') +
        '</p>'
      : '';
    for (const [key, issues] of [
      ['errors', result.errors],
      ['warnings', result.warnings],
      ['adjustments', result.adjustments],
    ])
      if (issues?.length)
        html +=
          '<h3>' +
          esc(t(key)) +
          ' (' +
          number(issues.length) +
          ')</h3><ul class="issues">' +
          issues
            .map((e) => '<li><code>' + esc(e.path) + '</code> — ' + esc(issueMessage(e)) + '</li>')
            .join('') +
          '</ul>';
    return html;
  };
  const choice = await dialog('importPreview', body, [
    ['cancel', 'cancel'],
    ['applyImport', 'apply', true, result.errors.length > 0],
  ]);
  if (choice === 'apply') await replaceProject(result.project, result.adjustments.length > 0);
}
async function loadExample(path = 'assets/data/example.json') {
  try {
    const response = await fetch(path);
    if (!response.ok) throw Error();
    const result = stage(await response.text());
    if (result.errors.length) throw Error();
    if (await replaceProject(result.project, false)) {
      adapter.fit();
    }
  } catch {
    toast('errorRead');
  }
}
async function formatGuide() {
  const body = () => {
    const div = document.createElement('div');
    div.innerHTML =
      '<p>' +
      esc(t('formatBody')) +
      '</p><div class="guide-actions"><button id="schema-download">' +
      esc(t('downloadSchema')) +
      '</button><button id="example-download">' +
      esc(t('downloadExample')) +
      '</button><button id="mind-example-download">' +
      esc(t('mindExample')) +
      '</button><button id="copy-ai">' +
      esc(t('copyInstructions')) +
      '</button></div><pre>' +
      esc(t('aiGuide')) +
      '</pre><p>' +
      esc(t('mindGuide')) +
      '</p>';
    div.querySelector('#mind-example-download').onclick = async () => {
      try {
        const res = await fetch('assets/data/mind-map-example.json');
        if (!res.ok) throw Error();
        download(await res.text(), 'mind-map-example.json');
      } catch {
        toast('errorRead');
      }
    };
    div.querySelector('#schema-download').onclick = async () => {
      try {
        const res = await fetch('assets/data/project.schema.json');
        if (!res.ok) throw Error();
        download(await res.text(), 'card-atlas.schema.json');
      } catch {
        toast('errorRead');
      }
    };
    div.querySelector('#example-download').onclick = async () => {
      try {
        const res = await fetch('assets/data/example.json');
        if (!res.ok) throw Error();
        download(await res.text(), 'example-project.json');
      } catch {
        toast('errorRead');
      }
    };
    div.querySelector('#copy-ai').onclick = async () => {
      try {
        await navigator.clipboard.writeText(t('aiGuide'));
        toast('copied');
      } catch {
        toast('copyFailed');
      }
    };
    return div;
  };
  await dialog('format', body, [['close', 'cancel']]);
}
$('#file-input').onchange = () => {
  const file = $('#file-input').files[0];
  $('#file-input').value = '';
  importFile(file);
};
$('#search').oninput = (e) => {
  query = e.target.value;
  renderList();
};
$('#project-name').onclick = () => select({ kind: 'project', id: 'metadata' }, true);
$('#map-view').onchange = () => {
  if (modalState) {
    $('#map-view').value = store.activeView;
    return;
  }
  store.switchView($('#map-view').value);
  previousPanelKey = null;
  render();
  adapter.setViewport(store.viewport);
};
$('#locale').onchange = (e) => {
  setLocale(e.target.value);
  render();
  if (modalState) renderModal();
};
const actions = {
  new: createProject,
  add: addCard,
  connect: async () => {
    if (!(await guardDraft())) return;
    connectMode = !connectMode;
    connectSource = connectMode && selection?.kind === 'card' ? selection.id : null;
    render();
  },
  undo: async () => {
    if (!(await guardDraft())) return;
    draft = null;
    draftOriginal = null;
    store.undo();
  },
  redo: async () => {
    if (!(await guardDraft())) return;
    draft = null;
    draftOriginal = null;
    store.redo();
  },
  import: () => $('#file-input').click(),
  export: exportProject,
  example: () => loadExample(),
  'mind-example': () => loadExample('assets/data/mind-map-example.json'),
  'english-example': () => loadExample('assets/data/english-endings-example.json'),
  format: formatGuide,
  recovery: recoveryDialog,
  'writing-exit': () => {
    writing = false;
    renderPanel();
    adapter.cy.resize();
  },
  close: () => select(null),
  expand: () => {
    expanded = !expanded;
    document.documentElement.style.setProperty(
      '--panel-width',
      expanded ? 'min(65vw, 850px)' : '360px',
    );
    adapter.cy.resize();
  },
  'zoom-in': () => adapter.zoom(1.2),
  'zoom-out': () => adapter.zoom(1 / 1.2),
  'zoom-reset': () => adapter.resetZoom(),
  fit: () => adapter.fit(),
  focus: () => {
    if (selection?.kind === 'card') adapter.focus(selection.id);
    if (selection?.kind === 'relation') adapter.focusRelation(selection.id);
  },
  theme: () => {
    theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    adapter.setTheme(theme);
    render();
  },
};
document.addEventListener('click', (e) => {
  const button = e.target.closest('[data-action]');
  if (button && !button.disabled && !modalState) actions[button.dataset.action]?.();
});
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input,textarea,select,[contenteditable=true]') || modalState) return;
  if (e.code === 'Space') {
    e.preventDefault();
    adapter.space = true;
  }
  if (e.key === 'Escape') {
    connectMode = false;
    connectSource = null;
    render();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    actions[e.shiftKey ? 'redo' : 'undo']();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    $('#search').focus();
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    deleteSelected();
  }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') adapter.space = false;
});
window.addEventListener('blur', () => (adapter.space = false));
window.addEventListener('beforeunload', (e) => {
  if (store.dirty || draftDirty()) {
    e.preventDefault();
    e.returnValue = '';
  }
});
const divider = $('#panel-divider');
divider.onpointerdown = (e) => {
  e.preventDefault();
  divider.setPointerCapture(e.pointerId);
  const move = (ev) => {
    const width = Math.min(window.innerWidth * 0.7, Math.max(280, window.innerWidth - ev.clientX));
    document.documentElement.style.setProperty('--panel-width', width + 'px');
    adapter.cy.resize();
  };
  const end = () => {
    divider.removeEventListener('pointermove', move);
    divider.removeEventListener('pointerup', end);
  };
  divider.addEventListener('pointermove', move);
  divider.addEventListener('pointerup', end, { once: true });
};
divider.onkeydown = (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const width =
      $('#detail-panel').getBoundingClientRect().width + (e.key === 'ArrowLeft' ? 20 : -20);
    document.documentElement.style.setProperty(
      '--panel-width',
      Math.min(window.innerWidth * 0.7, Math.max(280, width)) + 'px',
    );
    adapter.cy.resize();
  }
};
installImagePreview($('#panel-body'));
store.subscribe(render);
setLocale('vi');
render();

initializeRecovery();
