import {
  ProjectStore,
  newId,
  newCard,
  newRelation,
  remove,
  search,
} from './store/project-store.js';
import { blank, stage, validate, serialize, filename } from './json/validator.js';
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
  theme = 'light';
function entity() {
  if (selection?.kind === 'project') return store.project.metadata;
  return selection
    ? store.project[selection.kind === 'card' ? 'cards' : 'relations'].find(
        (e) => e.id === selection.id,
      )
    : null;
}
function draftDirty() {
  return draft && JSON.stringify(draft) !== JSON.stringify(draftOriginal);
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
  move: (id, position) =>
    change((p) => {
      p.cards.find((c) => c.id === id).position = position;
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
  adapter.sync(store.project, selection);
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
    host.append(btn);
  }
}
function beginDraft() {
  draft = clone(entity());
  draftOriginal = clone(draft);
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
    for (const mode of ['overview', 'edit']) {
      const button = document.createElement('button');
      button.textContent = t(mode);
      button.className = tab === mode ? 'active' : '';
      button.onclick = async () => {
        if (mode === tab) return;
        if (!(await guardDraft())) return;
        tab = mode;
        draft = null;
        draftOriginal = null;
        if (mode === 'edit') beginDraft();
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
        isCurrent: () => version === panelVersion,
      }).catch(() => {
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
  if (selection.kind === 'card') {
    fields +=
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
    fields += labelField('content', 'content', d.content, { textarea: true });
  } else if (selection.kind === 'relation') {
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
  form.oninput = () => {
    for (const input of form.querySelectorAll('[name]')) {
      const name = input.name;
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
      else draft[name] = value;
    }
    updateStatus();
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
  if ($('#duplicate')) $('#duplicate').onclick = duplicate;
  if ($('#delete')) $('#delete').onclick = deleteSelected;
}
function applyDraft() {
  if (!draft) return true;
  const p = clone(store.project);
  if (selection.kind === 'project') p.metadata = clone(draft);
  else {
    const kind = selection.kind === 'card' ? 'cards' : 'relations';
    p[kind] = p[kind].map((e) => (e.id === selection.id ? clone(draft) : e));
  }
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
    b.disabled = disabled;
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
    card = newCard({ x: p.x - 130, y: p.y - 70 }, t('newCard'));
    target = card.id;
  }
  const r = newRelation(source, target);
  if (
    !change((p) => {
      if (card) p.cards.push(card);
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
    card = newCard({ x: pos.x - 130, y: pos.y - 70 }, t('newCard'));
  if (!change((p) => p.cards.push(card))) return;
  selection = { kind: 'card', id: card.id };
  tab = 'edit';
  beginDraft();
  render();
}
async function duplicate() {
  if (selection?.kind !== 'card' || !(await guardDraft())) return;
  const card = clone(entity());
  card.id = newId('card');
  card.position = { x: card.position.x + 36, y: card.position.y + 36 };
  if (!change((p) => p.cards.push(card))) return;
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
    download(serialize(store.project, store.viewport), filename(store.project.metadata.title));
    lastExport = true;
    store.exported();
    toast('exported');
    return true;
  } catch {
    toast('errorExport');
    return false;
  }
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
      '</button><button id="copy-ai">' +
      esc(t('copyInstructions')) +
      '</button></div><pre>' +
      esc(t('aiGuide')) +
      '</pre>';
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
$('#locale').onchange = (e) => {
  setLocale(e.target.value);
  render();
  if (modalState) renderModal();
};
const actions = {
  new: () => replaceProject(blank()),
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
  'english-example': () => loadExample('assets/data/english-endings-example.json'),
  format: formatGuide,
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
store.subscribe(render);
setLocale('vi');
render();
