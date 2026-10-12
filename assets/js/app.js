import { dialogSurface } from './ui/dialog-surface.js';
import { createTemplateGallery } from './ui/template-gallery.js';
import { createDocumentTransfer } from './ui/document-transfer.js';
import { addNodeProject } from './json/node-transfer.js';
import { createCardList } from './ui/card-list.js';
import { projectIndex } from './graph/project-index.js';
import { query as $ } from './common/dom.js';
import { escapeHTML as esc } from './common/html.js';
import { clone } from './common/data.js';
import { download } from './common/download.js';
import { editorFields } from './detail/editor-fields.js';
import { createFormatGuide } from './ui/format-guide.js';
import { createFeedback } from './ui/feedback.js';
import { radialLayout, applyLayout, visibility, revealAncestors } from './graph/radial-layout.js';
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
import { ProjectStore, newId, newCard, newRelation, remove } from './store/project-store.js';
import { blank, stage, validate, serialize, filename, LIMITS } from './json/validator.js';
import { t, setLocale, issueMessage, number } from './i18n/index.js';
import { GraphAdapter } from './canvas/adapter.js';
import { renderMarkdown } from './detail/markdown.js';
export const store = new ProjectStore();
export let layoutPreview = null;
let selection = null,
  tab = 'overview',
  draft = null,
  draftOriginal = null,
  connectSource = null,
  connectMode = false,
  query = '',
  allowImages = false,
  panelVersion = 0,
  detailOpen = false,
  home = true,
  hasSession = false,
  loadingTemplate = false,
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
const feedback = createFeedback({ onLocaleChange: () => render() });
const { toast, dialog, renderModal, finishDialog, showMessage } = feedback;
const formatGuide = createFormatGuide({ dialog, toast });
const detailSurface = dialogSurface($('#detail-panel'), {
  onRequestClose: async () => {
    if (feedback.state || !(await guardDraft())) return;
    detailOpen = false;
    closeImagePreview();
    detailSurface.close();
    render();
  },
  fallback: () =>
    selection?.kind === 'card'
      ? adapter.cards.get(selection.id) || $('[data-action=add]')
      : $('#project-name'),
});
const gallery = createTemplateGallery({
  host: $('#template-gallery'),
  onOpen: (path) => loadExample(path),
  onError: () => toast('errorRead'),
});
const documentTransfer = createDocumentTransfer({
  context: transferContext,
  isCurrent: (ctx) =>
    selection?.kind === 'card' &&
    selection.id === ctx.id &&
    store.project === ctx.snapshot &&
    JSON.stringify(draft || entity()) === ctx.revision,
  useDraft: (card, formatSource) => {
    if (!draft) beginDraft();
    draft = clone(card);
    if (formatSource) {
      const size = geometry(formatSource, formatSource.cards[0], store.activeView).size;
      if (store.activeView === 'mind') draftMindSize = clone(size);
      else draft.size = clone(size);
    }
    tab = 'edit';
    renderPanel();
    $('textarea[name=content]')?.focus({ preventScroll: true });
    updateStatus();
    scheduleRecovery();
  },
  addNode: async (source) => {
    if (!(await guardDraft())) return;
    const size = geometry(source, source.cards[0], store.activeView).size;
    const rect = $('#canvas-region').getBoundingClientRect();
    const center = adapter.graphPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const id = newId('card');
    const next = addNodeProject(store.project, source, id, store.activeView, {
      x: center.x - size.width / 2,
      y: center.y - size.height / 2,
    });
    if (
      !change((p) => {
        p.cards = next.cards;
        if (next.extensions) p.extensions = next.extensions;
      })
    )
      return;
    selection = { kind: 'card', id };
    detailOpen = true;
    tab = 'overview';
    draft = null;
    draftOriginal = null;
    render();
    $('#panel-title').focus({ preventScroll: true });
    toast('transferNodeAdded');
  },
  dialog,
  toast,
});
function transferContext() {
  if (selection?.kind !== 'card' || !entity() || layoutPreview || feedback.state) return null;
  const project = JSON.parse(serialize(store.project, store.viewport, store.viewports));
  const draftProject = clone(project);
  const current = clone(draft || entity());
  draftProject.cards = draftProject.cards.map((c) => (c.id === selection.id ? current : c));
  if (draft && JSON.stringify(draftMindSize) !== JSON.stringify(originalMindSize))
    setGeometry(draftProject, selection.id, 'mind', 'size', draftMindSize);
  return {
    id: selection.id,
    project,
    draftProject,
    current,
    view: store.activeView,
    snapshot: store.project,
    revision: JSON.stringify(draft || entity()),
  };
}

function entity() {
  if (selection?.kind === 'project') return store.project.metadata;
  return selection
    ? projectIndex(store.project)[selection.kind === 'card' ? 'cards' : 'relations'].get(
        selection.id,
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
  if (layoutPreview) return false;
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
    if (!(await select(s, false, true))) return;
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
  collapse: (id) => toggleBranch(id),
  locked: () => Boolean(detailOpen || draftDirty() || feedback.state || layoutPreview),
});
function render() {
  $('#app').classList.toggle('home-mode', home);
  $('#home-page').hidden = !home;
  $('.workspace').hidden = home;
  $('[data-action=continue]').hidden = !hasSession;
  if (home) gallery.render();
  $('#detail-locale').value = document.documentElement.lang || 'vi';
  $('#detail-theme').dataset.i18nTitle = theme === 'dark' ? 'lightMode' : 'darkMode';
  $('[data-action=expand]').dataset.i18nTitle = expanded ? 'restoreDetail' : 'fullDetail';

  const existing = new Set(store.project.cards.map((c) => c.id));
  if ([...store.collapsed].some((id) => !existing.has(id)))
    store.collapsed = new Set([...store.collapsed].filter((id) => existing.has(id)));
  if (layoutPreview && layoutPreview.project !== store.project) {
    cancelLayout();
    return;
  }

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
  if (!layoutPreview) revealSelection(selection);
  adapter.sync(store.project, selection, store.activeView, {
    positions: layoutPreview?.result.positions,
    collapsed: store.collapsed,
  });
  $('#mind-map-tools').hidden = store.activeView !== 'mind';
  $('#layout-preview-bar').hidden = !layoutPreview;
  $('#panel-body').inert = Boolean(layoutPreview);
  $('#layout-warnings').textContent =
    layoutPreview?.result.warnings.map((w) => t(w.code, { count: w.count })).join(' ') || '';
  $('[data-action=layout]').disabled = Boolean(layoutPreview) || !store.project.cards.length;
  $('[data-action=expand-all]').disabled = Boolean(layoutPreview) || !store.collapsed.size;
  for (const action of ['new', 'add', 'connect', 'import', 'export', 'recovery'])
    for (const el of document.querySelectorAll('[data-action="' + action + '"]'))
      el.disabled = Boolean(layoutPreview);

  $('#map-view').value = store.activeView;
  $('#detail-map-view').value = store.activeView;
  $('[data-panel-action=layout]').hidden = store.activeView !== 'mind';
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
    for (const el of document.querySelectorAll(
      '[data-action=' + key + '],[data-panel-action=' + key + ']',
    ))
      el.disabled =
        Boolean(layoutPreview) ||
        (key === 'undo' ? !store.undoStack.length : !store.redoStack.length);
  $('[data-action=connect]').classList.toggle('primary', connectMode);
  $('#connect-hint').hidden = !connectMode;
  $('#connect-hint').textContent = t('chooseTarget');
  renderList();
  renderPanel();
  updateStatus();
  translate();
  scheduleRecovery();
}
const renderCardList = createCardList({
  host: $('#card-list'),
  onSelect: async (id) => {
    if (await select({ kind: 'card', id }, false, true)) adapter.focus(id);
  },
});
function renderList() {
  renderCardList({ project: store.project, query, selection });
}
function beginDraft() {
  draft = clone(entity());
  draftOriginal = clone(draft);
  draftMindSize =
    selection?.kind === 'card' ? clone(geometry(store.project, entity(), 'mind').size) : null;
  originalMindSize = clone(draftMindSize);
}
async function select(next, edit = false, open = false) {
  if (feedback.state || layoutPreview) return false;
  if (connectMode && next?.kind === 'card') {
    if (!connectSource) {
      connectSource = next.id;
      return true;
    }
    await connection(connectSource, next.id);
    return true;
  }
  if (JSON.stringify(selection) === JSON.stringify(next) && !edit) {
    if (open) {
      detailOpen = true;
      renderPanel();
    }
    return true;
  }
  if (!(await guardDraft())) return false;
  revealSelection(next);
  selection = next;
  detailOpen = Boolean(next && (open || edit || next.kind === 'relation' || detailOpen));
  tab = next?.kind === 'relation' || edit || next?.kind === 'project' ? 'edit' : 'overview';
  draft = null;
  draftOriginal = null;
  if (tab === 'edit' && entity()) beginDraft();
  render();
  return true;
}
function renderPanel() {
  const body = $('#panel-body');
  const key = selection?.kind + ':' + selection?.id + ':' + tab;
  const state = previousPanelKey === key ? captureEditor(body) : null;
  const transferToolsOpen = Boolean(state && body.querySelector('.node-transfer-tools')?.open);
  if (previousPanelKey !== key) {
    previewDraft = false;
    sourceEditorState = null;
  }
  if (state && body.querySelector('.writing-source[hidden]') && sourceEditorState)
    state.fields = sourceEditorState.fields;
  else if (state && body.querySelector('.writing-source')) sourceEditorState = state;
  previousPanelKey = key;
  renderPanelContent();
  if (detailOpen && !home && selection?.kind === 'card' && entity()) documentTransfer.mount(body);
  if (body.querySelector('.node-transfer-tools'))
    body.querySelector('.node-transfer-tools').open = transferToolsOpen;
  restoreEditor(body, state);
  $('#writing-exit').hidden = !(writing && selection?.kind === 'card');
  document.documentElement.classList.toggle(
    'writing-mode',
    detailOpen && writing && selection?.kind === 'card',
  );
}
function renderPanelContent() {
  closeImagePreview();
  const version = ++panelVersion,
    panel = $('#detail-panel'),
    body = $('#panel-body'),
    e = detailOpen && !home ? entity() : null;
  if (!e) detailSurface.close();
  if (!e) {
    body.replaceChildren();
    return;
  }
  panel.classList.toggle('detail-full', expanded);
  $('#panel-title').textContent =
    selection.kind === 'project'
      ? t('projectSettings')
      : selection.kind === 'card'
        ? e.title
        : t('relation');
  detailSurface.show($('#panel-title'));
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
      const edges = projectIndex(store.project)[dir].get(e.id) || [];
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
          c = projectIndex(store.project).cards.get(peer),
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
  const fields = editorFields({
    draft: d,
    kind: selection.kind,
    tab,
    activeView: store.activeView,
    mindSize: draftMindSize,
    cards: store.project.cards,
    writing,
    previewDraft,
    imageUploadPending,
  });
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
      if (input.type === 'checkbox' && event.target !== input) continue;
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
        draft.extensions[APPEARANCE][key] =
          input.type === 'checkbox'
            ? input.checked
            : ['align', 'shadow'].includes(key)
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
async function guardDraft() {
  if (layoutPreview) return false;
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
    detailOpen = true;
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
  detailOpen = true;
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
  detailOpen = true;
  tab = 'edit';
  beginDraft();
  render();
}
async function deleteSelected() {
  if (!selection || selection.kind === 'project' || !(await guardDraft())) return;
  const s = clone(selection);
  selection = null;
  detailOpen = false;
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
  if (!recoveryEnabled() || recoveryPending || layoutPreview) return;
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
  home = false;
  hasSession = true;
  selection = snapshot.selection;
  detailOpen = Boolean(selection);
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
  if (layoutPreview) return false;
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
  home = false;
  hasSession = true;
  detailOpen = false;
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
  if (loadingTemplate || feedback.state) return;
  loadingTemplate = true;
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
  } finally {
    loadingTemplate = false;
  }
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
  if (feedback.state) {
    $('#map-view').value = store.activeView;
    return;
  }
  const targetView = $('#map-view').value;
  if (layoutPreview) {
    cancelLayout();
    toast('previewCancelledSwitch');
  }
  store.switchView(targetView);
  previousPanelKey = null;
  render();
  adapter.setViewport(store.viewport);
};
$('#detail-locale').onchange = (e) => {
  $('#locale').value = e.target.value;
  setLocale(e.target.value);
  render();
};
$('#detail-map-view').onchange = (e) => {
  $('#map-view').value = e.target.value;
  $('#map-view').onchange();
};
$('#locale').onchange = (e) => {
  setLocale(e.target.value);
  render();
  if (feedback.state) renderModal();
};
function revealSelection(s) {
  if (store.activeView !== 'mind' || !s) return false;
  const collapsed = new Set(store.collapsed);
  let changed = false;
  const ids =
    s.kind === 'card'
      ? [s.id]
      : s.kind === 'relation'
        ? (() => {
            const r = store.project.relations.find((r) => r.id === s.id);
            return r ? [r.source, r.target] : [];
          })()
        : [];
  for (const id of ids) changed = revealAncestors(store.project, id, collapsed) || changed;
  if (changed) store.collapsed = collapsed;
  return changed;
}
async function toggleBranch(id) {
  if (layoutPreview || feedback.state || !(await guardDraft())) return;
  const collapsed = new Set(store.collapsed);
  if (collapsed.has(id)) collapsed.delete(id);
  else collapsed.add(id);
  const { hidden } = visibility(store.project, collapsed);
  store.collapsed = collapsed;
  const r = selection?.kind === 'relation' ? entity() : null;
  if (
    (selection?.kind === 'card' && hidden.has(selection.id)) ||
    (r && (hidden.has(r.source) || hidden.has(r.target)))
  ) {
    selection = { kind: 'card', id };
    tab = 'overview';
    draft = null;
    draftOriginal = null;
  }
  render();
}
async function startLayout() {
  if (store.activeView !== 'mind' || feedback.state || layoutPreview) return;
  if (!store.project.extensions?.[MIND]?.rootId) {
    toast('layoutNeedsRoot');
    return;
  }
  if (!(await guardDraft())) return;
  detailOpen = false;
  detailSurface.close();
  try {
    const result = radialLayout(store.project);
    layoutPreview = {
      result,
      project: store.project,
      viewport: clone(store.viewport),
      collapsed: store.collapsed,
    };
    store.collapsed = new Set();
    connectMode = false;
    connectSource = null;
    clearTimeout(recoveryTimer);
    render();
    adapter.fit();
    $('[data-action=layout-cancel]').focus();
  } catch {
    toast('layoutInvalid');
  }
}
function cancelLayout() {
  if (!layoutPreview) return;
  const previous = layoutPreview;
  layoutPreview = null;
  store.collapsed = previous.collapsed;
  render();
  adapter.setViewport(previous.viewport);
  if (store.activeView === 'mind') $('[data-action=layout]').focus();
}
function acceptLayout() {
  if (!layoutPreview) return;
  const previous = layoutPreview;
  if (previous.project !== store.project) {
    cancelLayout();
    toast('layoutInvalid');
    return;
  }
  layoutPreview = null;
  store.collapsed = previous.collapsed;
  const existing = store.project.extensions?.['card-atlas:views']?.mindMap?.positions || {};
  const unchanged = Object.entries(previous.result.positions).every(
    ([id, pos]) => JSON.stringify(existing[id]) === JSON.stringify(pos),
  );
  if (unchanged || change((p) => applyLayout(p, previous.result))) {
    render();
    adapter.fit();
    toast('layoutApplied');
  } else {
    layoutPreview = previous;
    store.collapsed = new Set();
    render();
  }
}
const actions = {
  home: async () => {
    if (layoutPreview) cancelLayout();
    if (feedback.state || !(await guardDraft())) return;
    detailOpen = false;
    home = true;
    render();
  },
  continue: () => {
    home = false;
    render();
    adapter.cy.resize();
    adapter.setViewport(store.viewport);
  },

  layout: startLayout,
  'layout-cancel': cancelLayout,
  'layout-reset': () => {
    if (layoutPreview) {
      try {
        layoutPreview.result = radialLayout(store.project);
        render();
        adapter.fit();
      } catch {
        toast('layoutInvalid');
      }
    }
  },
  'layout-apply': acceptLayout,
  'expand-all': () => {
    if (!layoutPreview) {
      store.collapsed = new Set();
      render();
    }
  },

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
  close: () => detailSurface.requestClose(),
  expand: () => {
    expanded = !expanded;
    $('#detail-panel').classList.toggle('detail-full', expanded);
    $('[data-action=expand]').dataset.i18nTitle = expanded ? 'restoreDetail' : 'fullDetail';
    translate();
  },
  'zoom-in': () => adapter.zoom(1.2),
  'zoom-out': () => adapter.zoom(1 / 1.2),
  'zoom-reset': () => adapter.resetZoom(),
  fit: () => adapter.fit(),
  focus: () => {
    if (revealSelection(selection)) render();
    if (selection?.kind === 'card') adapter.focus(selection.id);
    if (selection?.kind === 'relation') adapter.focusRelation(selection.id);
  },
  'detail-theme': () => actions.theme(),
  theme: () => {
    theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    adapter.setTheme(theme);
    render();
  },
};
document.addEventListener('click', (e) => {
  const button = e.target.closest('[data-action],[data-panel-action]');
  if (button && !button.disabled && !feedback.state)
    actions[button.dataset.action || button.dataset.panelAction]?.();
});
document.addEventListener('keydown', (e) => {
  if (layoutPreview && e.key === 'Escape' && !feedback.state) {
    e.preventDefault();
    cancelLayout();
    return;
  }
  if (
    e.target.closest('input,textarea,select,[contenteditable=true]') ||
    feedback.state ||
    home ||
    document.querySelector('.image-preview[open]')
  )
    return;
  if (detailOpen && e.key === 'Escape') return;
  if (detailOpen && e.code === 'Space') return;
  if (e.code === 'Space') {
    e.preventDefault();
    adapter.space = true;
  }
  if (e.key === 'Escape') {
    if (layoutPreview) {
      e.preventDefault();
      cancelLayout();
      return;
    }
    connectMode = false;
    connectSource = null;
    render();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    actions[e.shiftKey ? 'redo' : 'undo']();
  }
  if (!detailOpen && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
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
installImagePreview($('#panel-body'));
store.subscribe(render);
setLocale('vi');
render();
gallery.load();

initializeRecovery();
