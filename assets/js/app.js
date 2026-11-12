import { createFormatInspector } from './ui/format-inspector.js';
import { installFormatChoiceIcons } from './ui/format-choice-icons.js';
import { convertMind } from './graph/convert-mind.js';
import { installChatGPTLauncher } from './ui/chatgpt-launcher.js';
import { createPetController, resolvePet } from './ui/pixel-cat.js';
import { createPetChat } from './ui/pet-chat.js';
import { quickHelpBody } from './ui/quick-help.js';
import {
  EDGE,
  setEdgeOffset,
  setEdgeCorners,
  edgeMode,
  setEdgeMode,
} from './graph/edge-routing.js';
import { enableAutoRoutes } from './graph/auto-routing.js';
import { createGroupEditor } from './ui/group-editor.js';
import { removeGroup, createGroup, cardGroups, GROUPS } from './graph/card-groups.js';
import { selectionLocked } from './graph/card-lock.js';
import { moveCards } from './graph/move-cards.js';
import { createCardOverviewEditor } from './ui/card-overview-editor.js';
import { setOverview, uniformProfile, applyUniformStyles } from './graph/card-typography.js';
import { createCardDateEditor } from './ui/card-date-editor.js';
import {
  stampCreated,
  togglePinned,
  setCreatedDate,
  cardDateValue,
  cardMetadata,
  isPinned,
} from './graph/card-metadata.js';
import { overviewElement } from './canvas/overview.js';
import { createShapePalette } from './ui/shape-palette.js';
import { readImageFile } from './detail/image-file.js';
import { measureOverview } from './canvas/text-measure.js';
import { resizeShape } from './graph/shape-registry.js';
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
import { APPEARANCE, appearance, appearanceWith } from './detail/appearance.js';
import {
  recoveryEnabled,
  readRecovery,
  saveRecovery,
  enableRecovery,
  disableRecovery,
} from './store/recovery.js';
import { captureEditor, restoreEditor } from './detail/writing.js';
import { mountReadingContents } from './detail/reading-contents.js';
import { installImagePreview, closeImagePreview } from './detail/image-preview.js';
import { IMAGE_NAMESPACE } from './detail/attachments.js';
import {
  ProjectStore,
  newId,
  newCard,
  newRelation,
  remove,
  DEFAULT_CARD_SIZE,
} from './store/project-store.js';
import { blank, stage, validate, serialize, filename, LIMITS } from './json/validator.js';
import { selectionFile } from './json/selection-export.js';
import { t, setLocale, issueMessage, number } from './i18n/index.js';
import { GraphAdapter } from './canvas/adapter.js';
import { renderLegacySource } from './detail/legacy-source.js';
import { DOCUMENT, documentText } from './graph/html-document.js';
import { mountBlockEditor } from './detail/block-editor.js';
import {
  renderHTMLDocument,
  setDocumentScale,
  standaloneHTMLDocument,
} from './detail/html-content.js';
// Reading text sizes in percent of the browser default; session-only, never exported.
const READING_SCALES = [100, 112.5, 125, 140];
let blockEditor = null;
let blockEditorDraft = null;
let pendingEditorRecovery = null;
const uniformDrafts = new WeakMap();
export const store = new ProjectStore();
export let layoutPreview = null;
let selection = null,
  focusBranch = false,
  selectedCards = new Set(),
  singleMarqueeId = null,
  tab = 'overview',
  draft = null,
  draftOriginal = null,
  connectSource = null,
  connectMode = false,
  query = '',
  allowImages = true,
  panelVersion = 0,
  detailOpen = false,
  home = true,
  hasSession = false,
  loadingTemplate = false,
  expanded = false,
  readingScale = 1,
  disposeReadingContents = null,
  lastExport = false,
  theme = 'light',
  themeSwitchFrame = 0,
  writing = false,
  previousPanelKey = null,
  sourceEditorState = null,
  recoveryPending = recoveryEnabled(),
  recoveryTimer = null,
  recoveredSnapshot = null,
  draftMindSize = null,
  originalMindSize = null;
const feedback = createFeedback();
const { toast, dialog, renderModal, finishDialog, showMessage } = feedback;
const formatGuide = createFormatGuide({ dialog, toast });
const editGroup = createGroupEditor({
  dialog,
  toast,
  project: () => store.project,
  onApply: (id, title, cardIds) =>
    change((p) => {
      if (id)
        Object.assign(
          p.extensions[GROUPS].groups.find((g) => g.id === id),
          { title, cardIds },
        );
      else createGroup(p, { id: newId('group'), title, cardIds });
    }),
});
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
      ? adapter.cards.get(selection.id) || $('[data-palette-kind=card]')
      : $('#project-name'),
});
const inspector = createFormatInspector({
  dirty: () => overviewEditor.dirty || draftDirty(),
  guardGlobal: async () =>
    (await dialog('draftTitle', () => '<p>' + esc(t('draftBody')) + '</p>', [
      ['cancel', 'cancel'],
      ['discard', 'discard'],
    ])) === 'discard',
  onSwitch: async () => {
    if (
      feedback.state ||
      layoutPreview ||
      adapter.resizing ||
      adapter.gesturing ||
      adapter.edgeDragging
    )
      return false;
    if (blockEditor && !(await guardDraft())) return false;
    return true;
  },
  canDismiss: () =>
    !feedback.state &&
    !layoutPreview &&
    !adapter.resizing &&
    !adapter.gesturing &&
    !adapter.edgeDragging,
  context: () => ({
    kind: selection?.kind,
    view: store.activeView,
    locked: selectionLocked(store.project, selection),
    eligibleCards: store.project.cards.filter((card) => !isPinned(card)).length,
    eligibleEdges: store.project.relations.filter(
      (relation) => !selectionLocked(store.project, { kind: 'relation', id: relation.id }),
    ).length,
    eligibleRoutes:
      store.activeView === 'mind'
        ? 0
        : store.project.relations.filter(
            (relation) =>
              relation.extensions?.[EDGE]?.route === 'orthogonal' &&
              !selectionLocked(store.project, { kind: 'relation', id: relation.id }),
          ).length,
  }),
  guard: async () => {
    if (overviewEditor.dirty) {
      const choice = await dialog('draftTitle', () => '<p>' + esc(t('draftBody')) + '</p>', [
        ['cancel', 'cancel'],
        ['discard', 'discard'],
      ]);
      if (choice !== 'discard') return false;
    }
    overviewEditor.close();
    return guardDraft();
  },
  onTab: async (key) => {
    const keepFormatDraft =
      key !== 'closed' &&
      detailOpen &&
      draft &&
      ((selection?.kind === 'card' && tab === 'format') ||
        (selection?.kind === 'relation' && tab === 'edit'));
    if (keepFormatDraft) {
      if (key === 'text' && selection?.kind === 'card' && !isPinned(entity())) {
        $('#inspector-text').append($('#card-overview-editor'));
        overviewEditor.show(selection.id, $('#inspector-tabs'));
        overviewEditor.syncLocale();
      }
      updateStatus();
      return;
    }
    blockEditor?.destroy();
    blockEditor = null;
    blockEditorDraft = null;
    if (key === 'closed') overviewEditor.close();
    detailSurface.close();
    detailOpen = false;
    if (key === 'text') {
      $('#inspector-text').append($('#card-overview-editor'));
      if (selection?.kind === 'card' && !isPinned(entity()))
        overviewEditor.show(selection.id, $('#inspector-tabs'));
      if (overviewEditor.open) overviewEditor.syncLocale();
    } else if (key === 'card' || key === 'edge') {
      if (selection?.kind !== (key === 'card' ? 'card' : 'relation')) return;
      if (selectionLocked(store.project, selection)) return;
      detailOpen = true;
      tab = key === 'card' ? 'format' : 'edit';
      beginDraft();
      renderPanel();
    }
  },
  onGlobal: async (options, typographyProfile) => {
    if (overviewEditor.dirty) {
      toast('inspectorResolveTextDraft');
      return false;
    }
    if (overviewEditor.open) overviewEditor.close();
    if (home || !(await guardDraft())) return;
    const source = selection?.kind === 'card' ? entity() : null;
    const edgeSource = selection?.kind === 'relation' ? entity() : null;
    if (options.surface && !source) {
      toast('inspectorSelectCard');
      return;
    }
    if (!Object.values(options).some(Boolean)) return;
    const affectedCards =
      options.surface || options.typography
        ? store.project.cards.filter((card) => !isPinned(card)).length
        : 0;
    const affectedEdges =
      options.routes || options.arrows
        ? store.project.relations.filter(
            (relation) =>
              !selectionLocked(store.project, { kind: 'relation', id: relation.id }) &&
              (options.arrows ||
                (store.activeView !== 'mind' &&
                  relation.extensions?.[EDGE]?.route === 'orthogonal')),
          ).length
        : 0;
    if (
      (await dialog(
        'inspectorBulkConfirmTitle',
        () =>
          '<p>' +
          esc(t('inspectorBulkConfirmBody')) +
          '</p><p>' +
          esc(t('inspectorEligibleCards').replace('{count}', number(affectedCards))) +
          '<br>' +
          esc(t('inspectorEligibleEdges').replace('{count}', number(affectedEdges))) +
          '</p>',
        [
          ['cancel', 'cancel'],
          ['apply', 'apply', true],
        ],
      )) !== 'apply'
    )
      return;
    if (
      change((p) => {
        if (options.routes)
          for (const relation of p.relations) {
            if (
              relation.extensions?.[EDGE]?.route === 'orthogonal' &&
              !selectionLocked(p, { kind: 'relation', id: relation.id })
            )
              setEdgeMode(relation, store.activeView, 'auto');
          }
        if (options.surface)
          for (const card of p.cards) {
            if (!isPinned(card)) card.style = clone(source.style);
          }
        if (options.arrows && edgeSource)
          for (const relation of p.relations) {
            if (!selectionLocked(p, { kind: 'relation', id: relation.id }))
              relation.style = clone(edgeSource.style);
          }
        if (options.typography)
          applyUniformStyles(p, typographyProfile, store.activeView, (card) =>
            measureOverview(
              { ...card, size: geometry(p, card, store.activeView).size },
              null,
              store.activeView,
            ),
          );
      })
    ) {
      render();
      announceApplied(true);
      return true;
    }
    return false;
  },
});
const gallery = createTemplateGallery({
  host: $('#template-gallery'),
  onOpen: (path, view) => loadExample(path, view),
  onError: () => toast('errorRead'),
});
const palette = createShapePalette({
  host: $('#shape-library'),
  region: $('#canvas-region'),
  onCreate: createPaletteNode,
  locked: () => Boolean(home || detailOpen || layoutPreview || feedback.state),
});
const documentTransfer = createDocumentTransfer({
  context: transferContext,
  isCurrent: (ctx) =>
    selection?.kind === 'card' &&
    selection.id === ctx.id &&
    store.project === ctx.snapshot &&
    JSON.stringify(draft || entity()) === ctx.revision,
  useDraft: (card, formatSource) => {
    if (selectionLocked(store.project, selection)) return;
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
    (blockEditor?.hasPending() ||
      Boolean(document.querySelector('#panel-body [data-hex-for]:invalid')) ||
      uniformDrafts.has(draftOriginal) ||
      JSON.stringify(draft) !== JSON.stringify(draftOriginal) ||
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
  for (const el of root.querySelectorAll('[data-i18n-aria]'))
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
    el.setAttribute('aria-label', t(el.dataset.i18nPlaceholder));
  }
}
function updateStatus() {
  const editingContent =
    detailOpen &&
    selection?.kind === 'card' &&
    tab === 'edit' &&
    Boolean(draft?.extensions?.[DOCUMENT]);
  const panelStatus = $('#panel-save-status');
  panelStatus.hidden = !editingContent;
  if (editingContent) {
    const changed = Boolean(draftDirty());
    panelStatus.textContent = t(changed ? 'editorUnsaved' : 'editorSaved');
    const save = $('#panel-body form button[type=submit]');
    if (save) save.disabled = !changed || blockEditor?.canSave() === false;
  }
  const formatting = detailOpen && (tab === 'format' || selection?.kind === 'relation');
  const formatStatus = $('#format-draft-status');
  if (formatStatus && formatting) {
    const changed = Boolean(draftDirty());
    formatStatus.textContent = t(changed ? 'editorUnsaved' : 'editorSaved');
    const form = $('#panel-body form');
    const save = form?.querySelector('button[type=submit]');
    if (save) {
      const pendingText = overviewEditor.dirty && inspector.active !== 'text';
      save.disabled = !changed || !form.checkValidity() || pendingText;
      save.title = pendingText ? t('inspectorResolveTextDraft') : '';
    }
  }
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
    if (e.message === 'pinnedCardLocked') {
      toast('pinnedCardLocked');
      return false;
    }
    showMessage('invalid', () => errorLines(e.issues || [{ path: '$root', code: 'unknown' }]));
    return false;
  }
}
function announceApplied(success) {
  if (success)
    toast('formatUpdated', { position: 'top', detail: store.notice ? 'historyLimit' : null });
  return success;
}
const dateEditor = createCardDateEditor({
  current: (id) => {
    const card = projectIndex(store.project).cards.get(id);
    return isPinned(card) ? null : card;
  },
  fallback: (id) => adapter.cards.get(id)?.querySelector('.card-created-date'),
  onApply: (id, value) => {
    if (detailOpen || draftDirty() || feedback.state || layoutPreview) return false;
    const c = projectIndex(store.project).cards.get(id);
    if (!c || isPinned(c)) return false;
    if (value === cardDateValue(c) || (!value && !cardMetadata(c).createdDate))
      return announceApplied(true);
    return announceApplied(
      change((p) =>
        setCreatedDate(
          p.cards.find((c) => c.id === id),
          value,
        ),
      ),
    );
  },
});
const overviewEditor = createCardOverviewEditor({
  onClose: () => updateStatus(),
  context: () => ({
    draft: Boolean(detailOpen && draft),
    combined: Boolean(
      detailOpen &&
      draft &&
      tab === 'format' &&
      !$('#format-inspector').hidden &&
      inspector.active === 'text',
    ),
    count: store.project.cards.filter((c) => !isPinned(c)).length,
  }),
  isShared: () => Boolean(draftOriginal && uniformDrafts.has(draftOriginal)),
  current: (id) =>
    isPinned(projectIndex(store.project).cards.get(id))
      ? null
      : detailOpen && selection?.kind === 'card' && selection.id === id && draft
        ? draft
        : projectIndex(store.project).cards.get(id),
  fallback: (id, field) =>
    detailOpen
      ? document.querySelector('#edit-card-overview')
      : adapter.cards.get(id)?.querySelector('[data-overview-field="' + field + '"]') ||
        adapter.cards.get(id)?.querySelector('h3'),
  onApply: (id, values, styles, shared) => {
    if (feedback.state || layoutPreview || dateEditor.open) return false;
    const editing = detailOpen && selection?.kind === 'card' && selection.id === id && draft;
    if (detailOpen && !editing) return false;
    const source = editing ? draft : projectIndex(store.project).cards.get(id);
    if (!source || isPinned(source)) return false;
    const candidate = clone(source);
    const profile = shared ? uniformProfile(source, styles) : null;
    setOverview(candidate, values, profile || styles);
    let fitted = null;
    if (appearance(candidate).sizeMode === 'fit') {
      fitted = measureOverview(candidate, null, store.activeView);
      if (!fitted && !editing) return false;
    }
    const project = clone(store.project);
    const index = project.cards.findIndex((c) => c.id === id);
    project.cards[index] = candidate;
    if (editing && store.activeView === 'mind')
      setGeometry(project, id, 'mind', 'size', draftMindSize);
    if (fitted) setGeometry(project, id, store.activeView, 'size', fitted);
    if (shared && !editing) {
      try {
        applyUniformStyles(project, profile, store.activeView, (card) =>
          measureOverview(
            { ...card, size: geometry(project, card, store.activeView).size },
            null,
            store.activeView,
          ),
        );
      } catch {
        return false;
      }
    }
    if (validate(project).errors.length) return false;
    if (editing) {
      const previousDraft = draft;
      const previousMindSize = clone(draftMindSize);
      const previousProfile = uniformDrafts.get(draftOriginal);
      const hadProfile = uniformDrafts.has(draftOriginal);
      if (shared) uniformDrafts.set(draftOriginal, profile);
      else uniformDrafts.delete(draftOriginal);
      draft = project.cards[index];
      if (store.activeView === 'mind') draftMindSize = clone(geometry(project, draft, 'mind').size);
      const combined =
        tab === 'format' && !$('#format-inspector').hidden && inspector.active === 'text';
      if (combined) {
        if (applyDraft()) return announceApplied(true);
        draft = previousDraft;
        draftMindSize = previousMindSize;
        if (hadProfile) uniformDrafts.set(draftOriginal, previousProfile);
        else uniformDrafts.delete(draftOriginal);
        updateStatus();
        return false;
      }
      renderPanel();
      updateStatus();
      scheduleRecovery();
      return true;
    }
    if (JSON.stringify(project) === JSON.stringify(store.project)) return announceApplied(true);
    return announceApplied(
      change((p) => {
        p.cards = project.cards;
        if (project.extensions) p.extensions = project.extensions;
        else delete p.extensions;
      }),
    );
  },
});
export const adapter = new GraphAdapter($('#canvas-region'), $('#cards-layer'), {
  edgeCorners: (id, value) =>
    change((p) =>
      setEdgeCorners(
        p.relations.find((r) => r.id === id),
        store.activeView,
        value,
      ),
    ),
  edgeOffset: (id, value) =>
    change((p) =>
      setEdgeOffset(
        p.relations.find((r) => r.id === id),
        store.activeView,
        value,
      ),
    ),
  select: (s, edit = false, open = false) => select(s, edit, open),
  selectMany: (ids, options) => selectMany(ids, options),
  groupAction: (id, action) =>
    action === 'edit' ? editGroup(id) : change((p) => removeGroup(p, id)),
  groupLocked: () => adapter.callbacks.locked() || connectMode || home,
  date: (id, anchor) => {
    if (inspector.hasPending()) {
      void inspector.close();
      return;
    }
    selectMany([id]);
    dateEditor.show(id, anchor);
  },
  overview: (id, anchor, field) => {
    if (inspector.hasPending()) {
      void inspector.close();
      return;
    }
    selectMany([id]);
    inspector.show('text');
    $('#inspector-text').append($('#card-overview-editor'));
    overviewEditor.show(id, anchor, field);
  },
  connectFrom: async (id) => {
    if (selectionLocked(store.project, { kind: 'card', id })) {
      toast('pinnedCardLocked');
      return;
    }
    if (feedback.state || layoutPreview) return;
    if (!(await guardDraft())) return;
    connectMode = true;
    connectSource = id;
    selectedCards = new Set([id]);
    render();
    adapter.cards.get(id)?.focus({ preventScroll: true });
  },
  open: async (s) => {
    if (connectMode && connectSource) {
      await select(s);
      return;
    }
    if (!(await guardDraft())) return;
    connectMode = false;
    connectSource = null;
    if (!(await select(s, false, true))) return;
    tab = 'overview';
    draft = null;
    draftOriginal = null;
    render();
  },
  pin: (id) => {
    if (detailOpen || draftDirty() || feedback.state || layoutPreview) return;
    change((p) => togglePinned(p.cards.find((c) => c.id === id)));
  },
  moveMany: (ids, delta) => change((p) => moveCards(p, ids, delta, store.activeView)),
  resize: (id, size) =>
    change((p) => {
      setGeometry(p, id, store.activeView, 'size', size);
      const card = p.cards.find((c) => c.id === id);
      card.extensions ||= {};
      card.extensions[APPEARANCE] = appearanceWith(card, { sizeMode: 'manual' });
    }),
  connection: (source, target, pos) => connection(source, target, pos),
  viewport: (zoom, position) => {
    store.setView(zoom, position);
    updateStatus();
  },
  collapse: (id) => toggleBranch(id),
  locked: () =>
    Boolean(
      (detailOpen && !$('#detail-panel').classList.contains('inspector-docked')) ||
      draftDirty() ||
      feedback.state ||
      layoutPreview ||
      dateEditor.open ||
      overviewEditor.open ||
      adapter.gesturing ||
      adapter.resizing ||
      adapter.edgeDragging,
    ),
});
function render() {
  $('#canvas-region').dataset.view = store.activeView;
  $('#map-view').hidden = home;
  $('#map-view').setAttribute('aria-label', t('mapView'));
  $('[data-action=inspector]').disabled = home;
  $('#mind-view-banner').hidden = home || store.activeView !== 'mind';
  $('[data-action=convert-mind]').hidden = home || store.activeView === 'mind';
  inspector.sync();
  $('#app').classList.toggle('home-mode', home);
  $('#home-page').hidden = !home;
  $('.workspace').hidden = home;
  $('[data-action=continue]').hidden = !hasSession;
  if (home) gallery.render();
  $('#detail-theme').dataset.i18nTitle = theme === 'dark' ? 'lightMode' : 'darkMode';
  $('[data-action=expand]').dataset.i18nTitle = expanded ? 'restoreDetail' : 'fullDetail';

  const existing = new Set(store.project.cards.map((c) => c.id));
  selectedCards = new Set([...selectedCards].filter((id) => existing.has(id)));
  if (detailOpen || selection?.kind !== 'card' || !selectedCards.has(selection.id))
    selectedCards = new Set(
      selection?.kind === 'card' && existing.has(selection.id) ? [selection.id] : [],
    );
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
  // Branch focus is session-only: it only makes sense while a card is selected.
  if (selection?.kind !== 'card') focusBranch = false;
  for (const el of document.querySelectorAll('[data-action=focus],[data-panel-action=focus]')) {
    el.setAttribute('aria-pressed', String(focusBranch));
    el.dataset.i18nTitle = focusBranch ? 'focusBranchExit' : 'focus';
  }
  $('[data-action=focus]').disabled =
    !focusBranch && !['card', 'relation'].includes(selection?.kind);
  if (selection && !entity()) {
    selection = null;
    draft = null;
    draftOriginal = null;
  }
  if (!layoutPreview) revealSelection(selection);
  adapter.sync(store.project, selection, store.activeView, {
    positions: layoutPreview?.result.positions,
    collapsed: store.collapsed,
    selectedCards,
    focusRoot: focusBranch ? selection.id : null,
  });
  $('#selection-tools').hidden =
    selectedCards.size < 2 && !(selectedCards.size === 1 && selectedCards.has(singleMarqueeId));
  if ($('#selection-tools').hidden) $('#selection-json').open = false;
  $('#selection-count').textContent = t('selectedCardsCount', { count: selectedCards.size });
  const groupedCards = new Set(cardGroups(store.project).flatMap((group) => group.cardIds));
  const createGroupButton = $('[data-action=group-create]');
  createGroupButton.hidden = selectedCards.size < 2;
  createGroupButton.disabled = [...selectedCards].some((id) => groupedCards.has(id));
  createGroupButton.title = t(createGroupButton.disabled ? 'groupAlreadyAssigned' : 'groupCreate');
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

  $('#map-view').dataset.activeView = store.activeView;
  for (const button of document.querySelectorAll('[data-map-view]'))
    button.setAttribute('aria-pressed', String(button.dataset.mapView === store.activeView));
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
  $('#project-menu > summary').setAttribute('aria-label', t('helpAndTools'));
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
  $('#connect-hint').hidden = !connectMode;
  $('#connect-hint').textContent = t('chooseTarget');
  palette.render();
  renderList();
  renderPanel();
  updateStatus();
  translate();
  dateEditor.syncLocale();
  overviewEditor.syncLocale();
  scheduleRecovery();
}
const renderCardList = createCardList({
  host: $('#card-list'),
  onSelect: async (id) => {
    if (await select({ kind: 'card', id }, false, true)) {
      closeSearch();
      adapter.focus(id);
    }
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
  if (edit && next?.kind === 'card' && selectionLocked(store.project, next)) {
    edit = false;
    open = true;
  }
  if (feedback.state || layoutPreview) return false;
  if (connectMode && next?.kind === 'card') {
    if (selectionLocked(store.project, next)) {
      toast('pinnedCardLocked');
      return false;
    }
    if (!connectSource) {
      connectSource = next.id;
      return true;
    }
    await connection(connectSource, next.id);
    return true;
  }
  if (JSON.stringify(selection) === JSON.stringify(next) && !edit && selectedCards.size < 2) {
    if (open) {
      detailOpen = true;
      renderPanel();
    }
    return true;
  }
  if (
    JSON.stringify(selection) !== JSON.stringify(next) &&
    !(await inspector.beforeSelectionChange())
  )
    return false;
  if (!(await guardDraft())) return false;
  revealSelection(next);
  selection = next;
  selectedCards = new Set(next?.kind === 'card' ? [next.id] : []);
  singleMarqueeId = null;
  detailOpen = Boolean(next && (open || edit || next.kind === 'relation' || detailOpen));
  tab = next?.kind === 'relation' || edit || next?.kind === 'project' ? 'edit' : 'overview';
  if (
    !$('#format-inspector').hidden &&
    inspector.active === 'card' &&
    next?.kind === 'card' &&
    !open &&
    !edit
  ) {
    tab = 'format';
    detailOpen = true;
  }
  draft = null;
  draftOriginal = null;
  if (tab === 'edit' && entity()) beginDraft();
  render();
  return true;
}
function selectMany(ids, { marquee = false } = {}) {
  if (adapter.callbacks.groupLocked()) return false;
  if (inspector.hasPending()) {
    void inspector.close();
    return false;
  }
  selectedCards = new Set(
    ids.filter((id) => adapter.cards.has(id) && !adapter.cards.get(id).hidden),
  );
  singleMarqueeId = marquee && selectedCards.size === 1 ? [...selectedCards][0] : null;
  const id = selectedCards.has(selection?.id) ? selection.id : [...selectedCards][0];
  selection = id ? { kind: 'card', id } : null;
  tab = 'overview';
  draft = null;
  draftOriginal = null;
  render();
  return true;
}
function renderPanel() {
  const body = $('#panel-body');
  const key = selection?.kind + ':' + selection?.id + ':' + tab;
  if (
    blockEditor &&
    blockEditorDraft === draft &&
    previousPanelKey === key &&
    detailOpen &&
    body.querySelector('#block-editor')
  ) {
    blockEditor.translate();
    return;
  }
  const state = previousPanelKey === key ? captureEditor(body) : null;
  const formatGroups = state
    ? new Map(
        [...body.querySelectorAll('details[data-format-group]')].map((group) => [
          group.dataset.formatGroup,
          group.open,
        ]),
      )
    : null;
  const formatHexValues = state
    ? new Map(
        [...body.querySelectorAll('[data-hex-for]')].map((input) => [
          input.dataset.hexFor,
          input.value,
        ]),
      )
    : null;
  const transferToolsOpen = Boolean(state && body.querySelector('.node-transfer-tools')?.open);
  const advancedOpen = Boolean(state && body.querySelector('.format-advanced')?.open);
  const imageOpen =
    state && body.querySelector('.image-tools')
      ? {
          open: body.querySelector('.image-tools').open,
          count: body.querySelectorAll('.attachment-row').length,
        }
      : null;
  if (previousPanelKey !== key) {
    sourceEditorState = null;
  }
  if (state && body.querySelector('.writing-source[hidden]') && sourceEditorState)
    state.fields = sourceEditorState.fields;
  else if (state && body.querySelector('.writing-source')) sourceEditorState = state;
  renderPanelContent();
  previousPanelKey = selection?.kind + ':' + selection?.id + ':' + tab;
  if (
    detailOpen &&
    !home &&
    selection?.kind === 'card' &&
    entity() &&
    !selectionLocked(store.project, selection)
  )
    documentTransfer.mount(body);
  if (selection?.kind === 'relation' && selectionLocked(store.project, selection)) {
    for (const field of body.querySelectorAll('input,textarea,select,button'))
      field.disabled = true;
    const notice = document.createElement('p');
    notice.className = 'pinned-lock-notice';
    notice.textContent = t('pinnedCardLocked');
    body.prepend(notice);
  }
  if (body.querySelector('.node-transfer-tools'))
    body.querySelector('.node-transfer-tools').open = transferToolsOpen;
  if (body.querySelector('.format-advanced'))
    body.querySelector('.format-advanced').open = advancedOpen;
  if (formatGroups)
    for (const group of body.querySelectorAll('details[data-format-group]'))
      if (formatGroups.has(group.dataset.formatGroup))
        group.open = formatGroups.get(group.dataset.formatGroup);
  if (formatHexValues)
    for (const input of body.querySelectorAll('[data-hex-for]'))
      if (formatHexValues.has(input.dataset.hexFor))
        input.value = formatHexValues.get(input.dataset.hexFor);
  if (
    imageOpen &&
    body.querySelector('.image-tools') &&
    (imageOpen.open || imageOpen.count === body.querySelectorAll('.attachment-row').length)
  )
    body.querySelector('.image-tools').open = imageOpen.open;
  restoreEditor(body, state);
  if (!state) body.scrollTop = 0;
  $('#writing-exit').hidden = !(writing && selection?.kind === 'card');
  document.documentElement.classList.toggle(
    'writing-mode',
    detailOpen && writing && selection?.kind === 'card',
  );
}
function syncReadingScale() {
  const percent = READING_SCALES[readingScale];
  $('#detail-panel').style.setProperty('--reading-scale', String(percent / 100));
  setDocumentScale($('#panel-body .html-document-frame'), percent);
  $('#reading-text-smaller').disabled = readingScale === 0;
  $('#reading-text-larger').disabled = readingScale === READING_SCALES.length - 1;
}
function renderPanelContent() {
  disposeReadingContents?.();
  disposeReadingContents = null;
  blockEditor?.destroy();
  blockEditor = null;
  blockEditorDraft = null;
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
  const readOnly = selection.kind === 'card' && isPinned(e);
  if (readOnly) tab = 'overview';
  const docked = !readOnly && (tab === 'format' || selection.kind === 'relation');
  if (panel.open && panel.classList.contains('inspector-docked') !== docked) detailSurface.close();
  panel.classList.toggle('inspector-docked', docked);
  if (docked) {
    inspector.show(selection.kind === 'relation' ? 'edge' : 'card');
    if (panel.parentElement !== $('#inspector-fields')) $('#inspector-fields').append(panel);
  } else if (panel.parentElement !== $('.workspace')) $('.workspace').append(panel);
  panel.classList.toggle('detail-full', expanded);
  const reading = !docked && tab === 'overview' && selection.kind === 'card';
  panel.classList.toggle('detail-reading', reading);
  for (const button of panel.querySelectorAll('.reading-text-size')) button.hidden = !reading;
  $('#panel-title').textContent =
    selection.kind === 'project'
      ? t('projectSettings')
      : selection.kind === 'card'
        ? e.title
        : t('relation');
  if (!(tab === 'overview' && selection.kind === 'card')) detailSurface.show($('#panel-title'));
  const tabs = $('#panel-tabs');
  tabs.replaceChildren();
  if (selection.kind === 'card')
    for (const mode of ['overview', 'edit', 'format']) {
      const button = document.createElement('button');
      const label = t(
        mode === 'format'
          ? 'inspectorTitle'
          : mode === 'edit' && e.extensions?.[DOCUMENT]
            ? 'blockEditor'
            : mode,
      );
      // Icon tab: the translated name stays as (visually hidden) text and as the tooltip.
      button.dataset.tab = mode;
      button.textContent = label;
      button.title = label;
      button.className = tab === mode ? 'active' : '';
      button.disabled = readOnly && mode !== 'overview';
      button.onclick = async () => {
        if (mode === tab) return;
        const editing = ['edit', 'format'].includes(tab) && ['edit', 'format'].includes(mode);
        if (editing && (await blockEditor?.flush()) === false) return;
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
      (readOnly
        ? '<div class="pinned-lock-notice"><p>' +
          esc(t('pinnedReadOnly')) +
          '</p><button type="button" id="detail-unpin">' +
          esc(t('unpinCard')) +
          '</button></div>'
        : '') +
      '<div class="reading-layout"><nav class="reading-contents" hidden></nav><div class="markdown"></div></div><details class="document-details"><summary>' +
      esc(t('metadata')) +
      '</summary><p class="summary">' +
      esc(e.summary) +
      '</p><div class="type-tags">' +
      [...new Set([e.type, ...e.tags])]
        .filter(Boolean)
        .map((v) => '<span>' + esc(v) + '</span>')
        .join('') +
      '</div><div class="image-opt"><p class="muted">' +
      esc(t('imageNotice')) +
      '</p><button id="allow-images">' +
      esc(t('loadImages')) +
      '</button></div><div id="relations-list" class="relations-section"></div></details>';
    const unpin = body.querySelector('#detail-unpin');
    if (unpin)
      unpin.onclick = async () => {
        if (await guardDraft()) change((p) => togglePinned(p.cards.find((c) => c.id === e.id)));
      };
    const host = body.querySelector('.markdown');
    const contents = (root) => {
      if (version !== panelVersion) return;
      disposeReadingContents?.();
      disposeReadingContents = mountReadingContents(
        body.querySelector('.reading-contents'),
        root,
        body,
      );
    };
    syncReadingScale();
    if (e.content || e.extensions?.[DOCUMENT])
      (e.extensions?.[DOCUMENT]
        ? renderHTMLDocument(host, e, {
            allowImages,
            contents,
            fontScale: READING_SCALES[readingScale],
            videos: true,
          })
        : Promise.resolve(renderLegacySource(host, e.content)).then(() => contents(host))
      ).catch(() => {
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
    detailSurface.show($('#panel-title'));
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
  });
  const iconActions =
    selection.kind === 'card' && tab === 'edit' && Boolean(d.extensions?.[DOCUMENT]);
  const actionContent = (key, icon) =>
    iconActions ? '<span aria-hidden="true">' + icon + '</span>' : esc(t(key));
  const actionLabel = (key) =>
    iconActions ? ' aria-label="' + esc(t(key)) + '" title="' + esc(t(key)) + '"' : '';
  body.innerHTML =
    '<form class="editor">' +
    fields +
    '<div class="form-errors" role="alert"></div><div class="editor-actions">' +
    (tab === 'format' || selection.kind === 'relation'
      ? '<span id="format-draft-status" class="format-draft-status" role="status"></span>'
      : '') +
    '<button type="button" id="cancel-draft">' +
    esc(t('discardChanges')) +
    '</button><button class="primary" type="submit">' +
    esc(t('apply')) +
    '</button></div>' +
    (selection.kind === 'project'
      ? ''
      : '<div class="editor-actions">' +
        (selection.kind === 'card'
          ? '<button type="button" id="duplicate"' +
            actionLabel('duplicate') +
            '>' +
            actionContent('duplicate', '⧉') +
            '</button>'
          : '') +
        '<button type="button" id="delete" class="danger"' +
        actionLabel('delete') +
        '>' +
        actionContent('delete', '⌫') +
        '</button></div>') +
    '</form>';
  const form = body.querySelector('form');
  if (body.querySelector('#block-editor')) {
    mountBlockEditor(
      body.querySelector('#block-editor'),
      draft,
      (document, text, images) => {
        draft.extensions[DOCUMENT] = document;
        if (Object.keys(images).length) draft.extensions[IMAGE_NAMESPACE] = images;
        draft.content = text;
        updateStatus();
        scheduleRecovery();
      },
      () => version === panelVersion,
      () => {
        updateStatus();
        scheduleRecovery();
      },
    )
      .then((editor) => {
        if (version !== panelVersion) editor?.destroy();
        else {
          blockEditor = editor;
          blockEditorDraft = draft;
          if (editor && pendingEditorRecovery) {
            editor.restoreRecovery(pendingEditorRecovery);
            pendingEditorRecovery = null;
          }
          updateStatus();
        }
      })
      .catch(() => toast('errorImport'));
  }
  if (selection.kind === 'relation' && store.activeView === 'mind') {
    for (const input of form.querySelectorAll('[name=edge-route],[name=edge-mode]')) {
      input.disabled = true;
      input.title = t('mindCurvesOnly');
    }
  }
  if ($('#edit-card-overview'))
    $('#edit-card-overview').onclick = async () => {
      if (!(await guardDraft())) return;
      detailSurface.close();
      detailOpen = false;
      inspector.show('text');
      $('#inspector-text').append($('#card-overview-editor'));
      overviewEditor.show(selection.id, $('#inspector-tabs'));
    };
  function syncFormatContext() {
    const images = form.querySelector('[data-image-fields]');
    if (images)
      images.hidden = !(
        ['image', 'image-text'].includes(nodeStyle(draft).kind) || nodeStyle(draft).coverImageId
      );
    const radius = form.querySelector('[data-radius-field]');
    if (radius)
      radius.hidden = !['', 'rectangle', 'rounded', 'square'].includes(
        appearance(draft).shape || '',
      );
    const autoSize = appearance(draft).sizeMode === 'fit';
    for (const input of form.querySelectorAll('[name=width], [name=height]'))
      input.disabled = autoSize;
  }
  syncFormatContext();
  const syncIconChoices = docked ? installFormatChoiceIcons(form) : () => {};
  for (const hex of form.querySelectorAll('[data-hex-for]')) {
    const picker = form.elements[hex.dataset.hexFor];
    if (!picker) continue;
    hex.addEventListener('input', () => {
      if (/^#[0-9a-f]{6}$/i.test(hex.value)) {
        picker.value = hex.value;
        picker.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    picker.addEventListener('input', () => {
      hex.value = picker.value;
    });
  }
  form.oninput = (event) => {
    for (const input of form.querySelectorAll('[name]')) {
      const name = input.name;
      if (input.type === 'checkbox' && event.target !== input) continue;
      if ((name.startsWith('node-') || name.startsWith('mind-')) && event.target !== input)
        continue;
      const value = input.value;
      if (name === 'edge-route') {
        draft.extensions ||= {};
        if (draft.extensions[EDGE]?.route !== value) draft.extensions[EDGE] = { route: value };
      } else if (name === 'edge-mode') {
        if (event.target === input) setEdgeMode(draft, store.activeView, value);
      } else if (name === 'tags')
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
        if (
          key === 'radius' &&
          event.target !== input &&
          draft.extensions[APPEARANCE]?.radius === undefined
        )
          continue;
        draft.extensions[APPEARANCE] ||= {};
        if (key === 'shape' && !value) {
          delete draft.extensions[APPEARANCE].shape;
          continue;
        }
        draft.extensions[APPEARANCE][key] =
          input.type === 'checkbox'
            ? input.checked
            : ['align', 'shadow', 'shape', 'sizeMode'].includes(key)
              ? value
              : Number(value);
      } else draft[name] = value;
    }
    if (['appearance-shape', 'width', 'height'].includes(event.target.name)) {
      const size = store.activeView === 'mind' ? draftMindSize : draft.size;
      const next =
        appearance(draft).shape || event.target.name === 'appearance-shape'
          ? resizeShape(appearance(draft).shape, size.width, size.height, event.target.name)
          : { ...size };
      if (['width', 'height'].includes(event.target.name)) {
        draft.extensions ||= {};
        draft.extensions[APPEARANCE] = appearanceWith(draft, { sizeMode: 'manual' });
        if (form.elements['appearance-sizeMode'])
          form.elements['appearance-sizeMode'].value = 'manual';
      }
      if (store.activeView === 'mind') draftMindSize = next;
      else draft.size = next;
      form.elements.width.value = next.width;
      form.elements.height.value = next.height;
    }
    if (
      event.target.name === 'appearance-shape' &&
      ['rectangle', 'rounded'].includes(event.target.value)
    ) {
      draft.extensions[APPEARANCE].radius = event.target.value === 'rectangle' ? 0 : 24;
      form.elements['appearance-radius'].value = draft.extensions[APPEARANCE].radius;
    }
    syncFormatContext();
    syncIconChoices();
    updateFormatPreview();
    if (
      selection.kind === 'card' &&
      appearance(draft).sizeMode === 'fit' &&
      $('#format-card-preview')
    )
      fitDraftSize();
    updateStatus();
    scheduleRecovery();
  };
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const savingContent =
      selection.kind === 'card' && tab === 'edit' && Boolean(draft?.extensions?.[DOCUMENT]);
    if ((await blockEditor?.flush()) === false) return;
    if (
      selection.kind === 'card' &&
      appearance(draft).sizeMode === 'fit' &&
      $('#format-card-preview') &&
      !fitDraftSize()
    )
      return;
    if (applyDraft()) {
      await detailSurface.requestClose();
      if (!detailOpen) {
        if (savingContent) toast('editorSaveSuccess', { position: 'top' });
        else announceApplied(true);
      }
    }
  };
  $('#cancel-draft').onclick = async () => {
    if (draftDirty()) {
      const choice = await dialog('draftTitle', () => '<p>' + esc(t('draftBody')) + '</p>', [
        ['cancel', 'cancel'],
        ['discard', 'discard'],
      ]);
      if (choice !== 'discard') return;
    }
    beginDraft();
    renderPanel();
    updateStatus();
  };
  function fitDraftSize() {
    const host = $('#format-card-preview .graph-card');
    if (!host) return true;
    const next = measureOverview(draft, host, store.activeView);
    if (!next) {
      $('#fit-warning').textContent = t('fitOverflow');
      return false;
    }
    if (store.activeView === 'mind') draftMindSize = next;
    else draft.size = next;
    form.elements.width.value = next.width;
    form.elements.height.value = next.height;
    $('#fit-warning').textContent = '';
    updateFormatPreview();
    return true;
  }
  function updateFormatPreview() {
    const host = $('#format-card-preview');
    if (!host) return;
    const previewSize = store.activeView === 'mind' ? draftMindSize : draft.size;
    host.replaceChildren(overviewElement(draft, store.activeView, previewSize));
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
      if (draft.extensions) {
        const fontSize = draft.extensions[APPEARANCE]?.titleFontSize;
        delete draft.extensions[APPEARANCE];
        if (fontSize !== undefined) draft.extensions[APPEARANCE] = { titleFontSize: fontSize };
      }
      renderPanel();
      updateStatus();
    };
  }
  if ($('#html-writing-toggle')) {
    $('#html-writing-toggle').onclick = async () => {
      if ((await blockEditor?.flush()) === false) return;
      writing = !writing;
      document.documentElement.classList.toggle('writing-mode', writing);
      $('#writing-exit').hidden = !writing;
      $('#html-writing-toggle').setAttribute(
        'aria-label',
        t(writing ? 'exitWriting' : 'writingMode'),
      );
      $('#html-writing-toggle').title = t(writing ? 'exitWriting' : 'writingMode');
      body.scrollTop = 0;
      adapter.cy.resize();
    };
    $('#download-html').onclick = async () => {
      try {
        if ((await blockEditor?.flush()) === false) return;
        download(
          await standaloneHTMLDocument(draft),
          filename(draft.title).replace(/\.json$/, '.html'),
          'text/html;charset=utf-8',
        );
      } catch {
        toast('errorExport');
      }
    };
  }
  if ($('#duplicate')) $('#duplicate').onclick = duplicate;
  if ($('#delete')) $('#delete').onclick = deleteSelected;
}
function applyDraft() {
  if (selectionLocked(store.project, selection)) {
    toast('pinnedCardLocked');
    return false;
  }
  const form = document.querySelector('#panel-body form');
  if (form && !form.checkValidity()) {
    toast('inspectorInvalidDraft');
    return false;
  }
  if (!draft) return true;
  if (selection.kind === 'card' && appearance(draft).sizeMode === 'fit') {
    const next = measureOverview(draft, null, store.activeView);
    if (!next) {
      $('#panel-body .form-errors').textContent = t('fitOverflow');
      return false;
    }
    if (store.activeView === 'mind') draftMindSize = next;
    else draft.size = next;
  }
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
  const profile = selection.kind === 'card' ? uniformDrafts.get(draftOriginal) : null;
  if (profile) {
    try {
      applyUniformStyles(p, profile, store.activeView, (card) =>
        measureOverview(
          { ...card, size: geometry(p, card, store.activeView).size },
          null,
          store.activeView,
        ),
      );
    } catch {
      $('#panel-body .form-errors').textContent = t('fitOverflow');
      return false;
    }
  }
  const result = validate(p);
  if (result.errors.length) {
    $('#panel-body .form-errors').textContent = errorLines(result.errors);
    return false;
  }
  const d = clone(draft),
    s = clone(selection);
  const changed = change((project) => {
    if (profile) {
      project.cards = p.cards;
      if (p.extensions) project.extensions = p.extensions;
      else delete project.extensions;
    } else if (s.kind === 'project') project.metadata = d;
    else {
      const kind = s.kind === 'card' ? 'cards' : 'relations';
      project[kind] = project[kind].map((e) => (e.id === s.id ? d : e));
      if (s.kind === 'card' && JSON.stringify(draftMindSize) !== JSON.stringify(originalMindSize))
        setGeometry(project, s.id, 'mind', 'size', draftMindSize);
    }
  });
  if (!changed && JSON.stringify(p) !== JSON.stringify(store.project)) return false;
  beginDraft();
  renderPanel();
  updateStatus();
  return true;
}
async function guardDraft() {
  const flushed = await blockEditor?.flush();
  if (adapter.resizing || adapter.gesturing || adapter.edgeDragging) return false;
  if (layoutPreview) return false;
  if (!draftDirty()) return true;
  const choice = await dialog('draftTitle', () => '<p>' + esc(t('draftBody')) + '</p>', [
    ['cancel', 'cancel'],
    ['discard', 'discard'],
    ['apply', 'apply', true],
  ]);
  if (choice === 'cancel') return false;
  if (choice === 'apply' && (flushed === false || !applyDraft())) return false;
  draft = null;
  draftOriginal = null;
  return true;
}
async function connection(source, target, position) {
  if ([source, target].some((id) => isPinned(projectIndex(store.project).cards.get(id)))) {
    toast('pinnedCardLocked');
    return;
  }
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
    card = newCard(
      { x: p.x - DEFAULT_CARD_SIZE.width / 2, y: p.y - DEFAULT_CARD_SIZE.height / 2 },
      t('newCard'),
    );
    target = card.id;
  }
  const r = newRelation(source, target);
  if (
    !change((p) => {
      if (card) {
        p.cards.push(card);
        setGeometry(p, card.id, 'mind', 'size', card.size);
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

function openSearch() {
  if (detailOpen || home) return;
  $('#search-drawer').hidden = false;
  $('[data-action=search]').setAttribute('aria-expanded', 'true');
  $('#search').focus();
}
function closeSearch() {
  const wasOpen = !$('#search-drawer').hidden;
  $('#search-drawer').hidden = true;
  $('[data-action=search]').setAttribute('aria-expanded', 'false');
  if (wasOpen && !detailOpen) $('[data-action=search]').focus();
}
async function createPaletteNode(option, point, file) {
  if (detailOpen || home || layoutPreview || feedback.state || !(await guardDraft())) return;
  const snapshot = store.project,
    view = store.activeView;
  const size = option.shape
    ? resizeShape(option.shape, 240, 160)
    : option.kind === 'card'
      ? { ...DEFAULT_CARD_SIZE }
      : { width: 260, height: option.kind === 'text' ? 80 : 190 };
  const center = point ? adapter.graphPoint(point.x, point.y) : adapter.center();
  const card = newCard(
    { x: center.x - size.width / 2, y: center.y - size.height / 2 },
    t(
      option.shape ||
        { card: 'newCard', text: 'kindText', image: 'kindImage', 'image-text': 'kindImageText' }[
          option.kind
        ],
    ),
  );
  card.size = size;
  // Text nodes start with just a title; existing card descriptions remain untouched.
  if (option.kind === 'text') card.summary = '';
  if (option.kind !== 'card') {
    card.style = { backgroundColor: '#FFFFFF', textColor: '#0F172A', borderColor: '#CBD5E1' };
    delete card.extensions['card-atlas:typography'];
  }
  card.extensions = { ...card.extensions, [NODE]: { kind: option.kind } };
  if (option.shape) card.extensions[APPEARANCE] = { shape: option.shape, sizeMode: 'manual' };
  if (file) {
    try {
      const image = await readImageFile(file, LIMITS.file);
      if (
        home ||
        store.project !== snapshot ||
        store.activeView !== view ||
        detailOpen ||
        layoutPreview ||
        feedback.state
      )
        return;
      const id = newId('image');
      card.extensions[IMAGE_NAMESPACE] = { [id]: image };
      card.extensions[NODE].coverImageId = id;
      card.extensions[NODE].imageFit = 'contain';
      if (option.kind === 'image-text') card.summary = t('imageTextExample');
      card.extensions[DOCUMENT].components = [
        { tag: 'img', attributes: { src: 'attachment:' + id, alt: image.name }, children: [] },
      ];
      card.content = documentText(card.extensions[DOCUMENT]);
    } catch {
      toast('errorImageAttachment');
      return;
    }
  }
  if (
    !change((p) => {
      p.cards.push(card);
      if (view === 'card' && option.kind === 'card') setGeometry(p, card.id, 'mind', 'size', size);
      if (view === 'mind') {
        setGeometry(p, card.id, view, 'position', card.position);
        setGeometry(p, card.id, view, 'size', size);
      }
    })
  )
    return;
  selection = { kind: 'card', id: card.id };
  draft = null;
  draftOriginal = null;
  render();
  adapter.cards.get(card.id)?.focus();
}

async function addCard() {
  if (!(await guardDraft())) return;
  const pos = adapter.center(),
    card = newCard(
      { x: pos.x - DEFAULT_CARD_SIZE.width / 2, y: pos.y - DEFAULT_CARD_SIZE.height / 2 },
      t('newCard'),
    );
  if (
    !change((p) => {
      p.cards.push(card);
      setGeometry(p, card.id, 'mind', 'size', card.size);
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
  if (selectionLocked(store.project, selection)) {
    toast('pinnedCardLocked');
    return;
  }
  if (selection?.kind !== 'card' || !(await guardDraft())) return;
  const original = entity();
  const card = clone(original);
  card.id = newId('card');
  stampCreated(card);
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
  if (selectedCards.size > 1) {
    toast('groupMoveOnly');
    return;
  }
  if (selectionLocked(store.project, selection)) {
    toast('pinnedCardLocked');
    return;
  }
  if (!selection || selection.kind === 'project' || !(await guardDraft())) return;
  const s = clone(selection);
  const index = projectIndex(store.project);
  const deleted =
    s.kind === 'card'
      ? { title: index.cards.get(s.id)?.title ?? '', count: index.degrees.get(s.id) || 0 }
      : null;
  if (!change((p) => remove(p, s))) return;
  if (deleted)
    toast(deleted.count ? 'deletedCard' : 'deletedCardOnly', {
      params: { title: deleted.title, count: number(deleted.count) },
    });
  else toast('deletedRelation');
  selection = null;
  detailOpen = false;
  draft = null;
  draftOriginal = null;
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
    editorSource: blockEditor?.recoveryState() || null,
    uniformStyles: clone(uniformDrafts.get(draftOriginal) || null),
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
  pendingEditorRecovery =
    selection?.kind === 'card' && draft?.extensions?.[DOCUMENT] && snapshot.tab === 'edit'
      ? snapshot.editorSource
      : null;
  if (draftOriginal && snapshot.uniformStyles)
    uniformDrafts.set(draftOriginal, clone(snapshot.uniformStyles));
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
    pendingEditorRecovery = null;
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

async function exportSelectionJSON(mode) {
  if (adapter.callbacks.groupLocked() || !selectedCards.size) return;
  const project = store.project;
  const ids = [...selectedCards];
  let result;
  try {
    result = selectionFile(project, ids, { viewport: store.viewport, viewports: store.viewports });
  } catch {
    toast('selectionJsonFailed');
    return;
  }
  if (result.excludedNamespaces.length || result.partialGroups.length) {
    const choice = await dialog(
      'selectionJsonWarningTitle',
      () =>
        (result.partialGroups.length
          ? '<p>' +
            esc(t('selectionJsonPartialGroups', { count: result.partialGroups.length })) +
            '</p>'
          : '') +
        (result.excludedNamespaces.length
          ? '<p>' +
            esc(t('selectionJsonExcluded')) +
            '</p><ul>' +
            result.excludedNamespaces.map((name) => '<li>' + esc(name) + '</li>').join('') +
            '</ul>'
          : ''),
      [
        ['cancel', 'cancel'],
        ['selectionJsonContinue', 'continue', true],
      ],
    );
    if (choice !== 'continue') return;
    if (
      store.project !== project ||
      ids.length !== selectedCards.size ||
      ids.some((id) => !selectedCards.has(id))
    ) {
      toast('selectionJsonChanged');
      return;
    }
  }
  try {
    if (mode === 'copy') {
      await navigator.clipboard.writeText(result.text);
      toast('selectionJsonCopied');
    } else {
      download(result.text, filename(project.metadata.title + '-selection'));
      toast('exportHint');
    }
  } catch {
    toast(mode === 'copy' ? 'selectionJsonCopyFailed' : 'selectionJsonFailed');
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
    if (choice === 'apply' && ((await blockEditor?.flush()) === false || !applyDraft()))
      return false;
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
    const legacyCount =
      result.project?.cards.filter((card) => !card.extensions?.[DOCUMENT]).length || 0;
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
    if (legacyCount)
      html +=
        '<p class="transfer-warning">' +
        esc(t('legacyProjectNotice').replace('{count}', number(legacyCount))) +
        '</p>';
    const shownPath = (path) => (path === '$file' ? file.name : path);
    const section = (key, issues) =>
      '<h3>' +
      esc(t(key)) +
      ' (' +
      number(issues.length) +
      ')</h3><ul class="issues">' +
      issues
        .map(
          (e) =>
            '<li><code>' + esc(shownPath(e.path)) + '</code> — ' + esc(issueMessage(e)) + '</li>',
        )
        .join('') +
      '</ul>';
    if (result.errors?.length) html += section('errors', result.errors);
    if (result.warnings?.length) html += section('warnings', result.warnings);
    if (result.adjustments?.length)
      html +=
        '<details class="import-technical"><summary>' +
        esc(t('importTechnicalDetails', { count: number(result.adjustments.length) })) +
        '</summary>' +
        section('adjustments', result.adjustments) +
        '</details>';
    return html;
  };
  const choice = await dialog('importPreview', body, [
    ['cancel', 'cancel'],
    ['applyImport', 'apply', true, result.errors.length > 0],
  ]);
  if (choice === 'apply') await replaceProject(result.project, result.adjustments.length > 0);
}
async function loadExample(path = 'assets/data/example.json', initialView = 'card') {
  if (loadingTemplate || feedback.state) return;
  loadingTemplate = true;
  try {
    const response = await fetch(path);
    if (!response.ok) throw Error();
    const result = stage(await response.text());
    if (result.errors.length) throw Error();
    if (await replaceProject(result.project, false)) {
      if (initialView === 'mind') {
        store.switchView('mind');
        render();
      }
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
async function switchMapView(targetView) {
  if (feedback.state) {
    $('#detail-map-view').value = store.activeView;
    return;
  }
  if (targetView === store.activeView) return;
  // Cancel a transient group drag before evaluating the view's draft guard.
  if (adapter.gesturing) adapter.cancelGesture?.();
  if (layoutPreview) {
    cancelLayout();
    toast('previewCancelledSwitch');
  }
  if (!(await guardDraft())) {
    $('#detail-map-view').value = store.activeView;
    return;
  }
  if (targetView === 'mind' && !store.project.extensions?.[MIND]?.rootId) {
    await actions['convert-mind']();
    $('#detail-map-view').value = store.activeView;
    return;
  }
  store.switchView(targetView);
  selectedCards = new Set(selection?.kind === 'card' ? [selection.id] : []);
  singleMarqueeId = null;
  previousPanelKey = null;
  render();
  adapter.setViewport(store.viewport);
}
for (const button of document.querySelectorAll('[data-map-view]'))
  button.onclick = () => switchMapView(button.dataset.mapView);
$('#detail-map-view').onchange = (e) => {
  switchMapView(e.target.value);
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
  selectedCards = new Set([...selectedCards].filter((key) => !hidden.has(key)));
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
  inspector: () => inspector.activate('global'),
  'convert-mind': async () => {
    if (home || feedback.state || layoutPreview || !(await guardDraft())) return;
    let rootId =
      selection?.kind === 'card' && !isPinned(entity())
        ? selection.id
        : store.project.cards.find((c) => !isPinned(c))?.id;
    if (!rootId) {
      toast(store.project.cards.length ? 'mindAllPinned' : 'mindNoCards');
      return;
    }
    const choice = await dialog(
      'convertMind',
      () => {
        const body = document.createElement('div');
        const help = document.createElement('p');
        help.textContent = t('mindConvertHint');
        const label = document.createElement('label');
        label.textContent = t('mindRoot');
        const select = document.createElement('select');
        select.id = 'mind-convert-root';
        for (const card of store.project.cards.filter((c) => !isPinned(c)))
          select.append(new window.Option(card.title, card.id));
        select.value = rootId;
        select.onchange = () => {
          rootId = select.value;
        };
        label.append(select);
        body.append(help, label);
        return body;
      },
      [
        ['cancel', 'cancel'],
        ['convertMind', 'apply', true],
      ],
    );
    if (choice !== 'apply') return;
    try {
      const result = convertMind(store.project, rootId);
      if (
        !change((p) => {
          p.relations = result.project.relations;
          p.extensions = result.project.extensions;
        })
      )
        return;
      detailSurface.close();
      detailOpen = false;
      draft = null;
      draftOriginal = null;
      store.switchView('mind');
      store.collapsed = new Set();
      selection = { kind: 'card', id: rootId };
      render();
      adapter.fit();
      toast(result.warnings.length ? 'mindConvertWarnings' : 'mindConverted');
    } catch {
      toast('mindConvertFailed');
    }
  },
  'auto-route-all': async () => {
    if (store.activeView === 'mind') {
      toast('mindCurvesOnly');
      return;
    }
    if (home || !(await guardDraft())) return;
    let result;
    const ok = change((p) => {
      result = enableAutoRoutes(p, store.activeView);
    });
    if (ok || result?.changed === 0)
      toast(result.changed ? 'autoRouteEnabled' : 'autoRouteNoCandidates');
  },
  'edge-adjust': async () => {
    if (store.activeView === 'mind') {
      toast('mindCurvesOnly');
      return;
    }
    if (
      selection?.kind !== 'relation' ||
      selectionLocked(store.project, selection) ||
      !(await guardDraft())
    )
      return;
    const id = selection.id;
    if (
      edgeMode(entity(), store.activeView) === 'auto' &&
      !change((p) =>
        setEdgeMode(
          p.relations.find((r) => r.id === id),
          store.activeView,
          'manual',
        ),
      )
    )
      return;
    draft = null;
    draftOriginal = null;
    detailOpen = false;
    detailSurface.close();
    render();
    adapter.edgeEditor.start(id);
  },
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

  'clear-selection': () => selectMany([]),
  'selection-copy-json': () => exportSelectionJSON('copy'),
  'selection-download-json': () => exportSelectionJSON('download'),
  'group-create': () => {
    if (!adapter.callbacks.groupLocked()) editGroup(null, [...selectedCards]);
  },
  help: async () => {
    if (adapter.gesturing || adapter.resizing || feedback.state) return;
    await dialog('quickHelpTitle', quickHelpBody, [['close', 'cancel', true]]);
    $('#quick-help').focus();
  },
  search: openSearch,
  'search-close': closeSearch,
  new: createProject,
  add: addCard,
  connect: async () => {
    if (selectionLocked(store.project, selection)) {
      toast('pinnedCardLocked');
      return;
    }
    if (!(await guardDraft())) return;
    connectMode = !connectMode;
    selectedCards = new Set(selection?.kind === 'card' ? [selection.id] : []);
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
    document.documentElement.classList.remove('writing-mode');
    $('#writing-exit').hidden = true;
    if ($('#html-writing-toggle')) {
      $('#html-writing-toggle').setAttribute('aria-label', t('writingMode'));
      $('#html-writing-toggle').title = t('writingMode');
    }
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
  'reading-text-smaller': () => {
    readingScale = Math.max(0, readingScale - 1);
    syncReadingScale();
  },
  'reading-text-larger': () => {
    readingScale = Math.min(READING_SCALES.length - 1, readingScale + 1);
    syncReadingScale();
  },
  'zoom-in': () => adapter.zoom(1.2),
  'zoom-out': () => adapter.zoom(1 / 1.2),
  'zoom-reset': () => adapter.resetZoom(),
  fit: () => adapter.fit(),
  focus: () => {
    if (selection?.kind === 'card' && focusBranch) {
      focusBranch = false;
      render();
      return;
    }
    if (selection?.kind === 'card') {
      focusBranch = true;
      revealSelection(selection);
      render();
      adapter.focus(selection.id);
      return;
    }
    if (revealSelection(selection)) render();
    if (selection?.kind === 'relation') adapter.focusRelation(selection.id);
  },
  'detail-theme': () => actions.theme(),
  theme: () => {
    theme = theme === 'light' ? 'dark' : 'light';
    // Controls must not ease between theme tokens (flash on the new background); the class
    // suppresses transitions until the new theme has painted.
    const root = document.documentElement;
    window.cancelAnimationFrame(themeSwitchFrame);
    root.classList.add('theme-switching');
    root.dataset.theme = theme;
    adapter.setTheme(theme);
    render();
    themeSwitchFrame = window.requestAnimationFrame(() => {
      themeSwitchFrame = window.requestAnimationFrame(() =>
        root.classList.remove('theme-switching'),
      );
    });
  },
};
document.addEventListener('click', (e) => {
  const button = e.target.closest('[data-action],[data-panel-action]');
  if (button && !button.disabled && !feedback.state)
    actions[button.dataset.action || button.dataset.panelAction]?.();
  if (!e.target.closest('#selection-json') || button) $('#selection-json').open = false;
  if (!e.target.closest('#project-menu') || button) $('#project-menu').open = false;
});
document.addEventListener('keydown', (e) => {
  if (dateEditor.open || overviewEditor.open) return;
  if (e.key === 'Escape' && !feedback.state && $('#selection-json').open) {
    e.preventDefault();
    $('#selection-json').open = false;
    $('#selection-json > summary').focus();
    return;
  }
  if (e.key === 'Escape' && !detailOpen && !feedback.state && !$('#search-drawer').hidden) {
    e.preventDefault();
    closeSearch();
    return;
  }
  if (e.key === 'Escape' && !detailOpen && !feedback.state && $('#project-menu').open) {
    e.preventDefault();
    $('#project-menu').open = false;
    $('#project-menu > summary').focus();
    return;
  }
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
  // GrapesJS forwards iframe keystrokes to the parent; keep them in the editor.
  // Vietnamese input methods can use Backspace while replacing a letter.
  if (
    detailOpen &&
    (e.key === 'Escape' || e.code === 'Space' || e.target.closest('#block-editor iframe'))
  )
    return;
  // Native controls must receive Space for keyboard activation, including the inspector tabs.
  if (e.code === 'Space' && e.target.closest('button,a[href],summary')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    adapter.space = true;
  }
  if (e.key === 'Escape' && focusBranch && !connectMode) {
    e.preventDefault();
    focusBranch = false;
    render();
    return;
  }
  if (e.key === 'Escape') {
    if (layoutPreview) {
      e.preventDefault();
      cancelLayout();
      return;
    }
    connectMode = false;
    connectSource = null;
    selectedCards.clear();
    selection = null;
    render();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    actions[e.shiftKey ? 'redo' : 'undo']();
  }
  if (!detailOpen && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    openSearch();
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
  if (store.dirty || draftDirty() || dateEditor.dirty || overviewEditor.dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});
installImagePreview($('#panel-body'));
installChatGPTLauncher();
// Thú cưng: lựa chọn chỉ giữ trong phiên (không storage); ?pet=cat|dog|off đặt giá trị khởi đầu.
const petChat = createPetChat({
  getPet: () => pets.get(),
  speak: (text, duration, pause) => pets.speak(text, duration, pause),
  t,
});
const pets = createPetController({
  initial: resolvePet(new window.URLSearchParams(window.location.search).get('pet')),
  onClick: () => petChat.click(),
});
$('#pet-choice').value = pets.get();
$('#pet-choice').addEventListener('change', (e) => pets.set(e.target.value));
store.subscribe(render);
setLocale('vi');
render();
gallery.load();

initializeRecovery();
