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
import {
  removeGroup,
  createGroup,
  addGroupLink,
  groupLinkIssue,
  newGroupParent,
  updateGroup,
  cardGroups,
  groupOfCard,
  groupOutline,
  addCardsToGroup,
  removeCardsFromGroup,
  removeFromGroupIssue,
} from './graph/card-groups.js';
import { copyCards, pasteCards } from './graph/copy-cards.js';
import { selectionLocked } from './graph/card-lock.js';
import { moveCards } from './graph/move-cards.js';
import { createCardOverviewEditor } from './ui/card-overview-editor.js';
import { setOverview, uniformProfile, applyUniformStyles } from './graph/card-typography.js';
import { createCardDateEditor } from './ui/card-date-editor.js';
import { createCardComments } from './ui/card-comments.js';
import { addComment, removeComment } from './graph/card-comments.js';
import { effectiveStatus, setStatus } from './graph/card-status.js';
import { createCardStatusPopover } from './ui/card-status-popover.js';
import { createGroupPickerPopover } from './ui/group-picker-popover.js';
import {
  currentQuickBackground,
  quickBackgroundValue,
  setQuickBackground,
  DEFAULT_BACKGROUND_ID,
  QUICK_BACKGROUNDS,
} from './graph/card-quick-color.js';
import { createCardColorPopover } from './ui/card-color-popover.js';
import { createCardScheduleEditor } from './ui/card-schedule-editor.js';
import { createTimelineInfoEditor } from './ui/timeline-info-editor.js';
import { createTimelineView } from './ui/timeline-view.js';
import { createBoardScopeBar } from './ui/board-scope-bar.js';
import { overviewLayout } from './graph/board-overview.js';
import {
  adoptNewCards,
  clearOwners,
  ownedCounts,
  ownedIds,
  ownerOf,
  scopedProject,
} from './graph/card-scope.js';
import {
  cardSchedule,
  disableTimeline,
  enableTimeline,
  hasTimeline,
  setSchedule,
  setTimelineInfo,
  timelineInfo,
  todayKey,
} from './graph/timeline.js';
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
  mindRootOf,
  relationKind,
  newLinkKind,
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
  // Status chips on notes are a session-only display preference (CC-23), never exported.
  showStatus = true,
  selectedCards = new Set(),
  // Copied notes live in session memory only (CC-23); pasteCount staggers repeated pastes.
  cardClipboard = null,
  pasteCount = 0,
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
  // Timeline is a session surface over the Project Model: store.activeView keeps the last canvas view.
  timelineActive = false,
  // Board of one Timeline node (session only, CC-23): the canvas draws a projection of its notes.
  boardScope = null,
  scopeReturn = null,
  // "View all": the Timeline notes of every board on one arranged canvas. Layout is projected, never
  // stored; its viewport is session memory and never reaches the exported view (CC-23).
  boardOverview = false,
  overviewViewport = null,
  overviewReturn = null,
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
// Per-board viewports stay in session memory; only the project board viewport is exported.
const scopeViewports = new Map();
const OVERVIEW_FIT_GAP = 16; // px kept clear around the fitted overview
const ZOOM_BAR_OFFSET = 24; // the zoom bar sits this far above the canvas bottom
const canvasProject = () =>
  boardOverview ? overviewLayout(store.project).project : scopedProject(store.project, boardScope);
// Mind root of the board on screen: the project board's or the open note board's.
const canvasRoot = () => mindRootOf(store.project, boardScope);
const scopeViewKey = () => (store.activeView === 'mind' ? 'mind' : 'card');
const inBoardScope = (card) => boardOverview || ownerOf(card) === boardScope;
// The arranged layout is read-only: moves, links, resizes and new notes would land in projected positions.
function overviewBlocked() {
  if (!boardOverview) return false;
  toast('boardOverviewLocked');
  return true;
}
const relationInBoardScope = (project) => {
  const ids = new Set(project.cards.filter(inBoardScope).map((c) => c.id));
  return (relation) => ids.has(relation.source) && ids.has(relation.target);
};
const feedback = createFeedback();
const { toast, dialog, renderModal, finishDialog, showMessage } = feedback;
const formatGuide = createFormatGuide({ dialog, toast });
const editGroup = createGroupEditor({
  dialog,
  toast,
  project: canvasProject,
  onApply: (id, values) =>
    change((p) => {
      if (id) updateGroup(p, id, values);
      else
        createGroup(p, {
          id: newId('group'),
          title: values.title,
          cardIds: values.cardIds,
          ...(values.description ? { description: values.description } : {}),
        });
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
      ? (timelineActive && timeline.element(selection.id, 'title')) ||
        adapter.cards.get(selection.id) ||
        $('[data-palette-kind=card]')
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
    eligibleCards: canvasProject().cards.filter((card) => !isPinned(card)).length,
    eligibleEdges: canvasProject().relations.filter(
      (relation) => !selectionLocked(store.project, { kind: 'relation', id: relation.id }),
    ).length,
    eligibleRoutes:
      store.activeView === 'mind'
        ? 0
        : canvasProject().relations.filter(
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
    if (overviewBlocked()) return false;
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
        ? canvasProject().cards.filter((card) => !isPinned(card)).length
        : 0;
    const affectedEdges =
      options.routes || options.arrows
        ? canvasProject().relations.filter(
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
        const inScopeRelation = relationInBoardScope(p);
        if (options.routes)
          for (const relation of p.relations) {
            if (
              inScopeRelation(relation) &&
              relation.extensions?.[EDGE]?.route === 'orthogonal' &&
              !selectionLocked(p, { kind: 'relation', id: relation.id })
            )
              setEdgeMode(relation, store.activeView, 'auto');
          }
        if (options.surface)
          for (const card of p.cards) {
            if (inBoardScope(card) && !isPinned(card)) card.style = clone(source.style);
          }
        if (options.arrows && edgeSource)
          for (const relation of p.relations) {
            if (
              inScopeRelation(relation) &&
              !selectionLocked(p, { kind: 'relation', id: relation.id })
            )
              relation.style = clone(edgeSource.style);
          }
        if (options.typography)
          applyUniformStyles(
            p,
            typographyProfile,
            store.activeView,
            (card) =>
              measureOverview(
                { ...card, size: geometry(p, card, store.activeView).size },
                null,
                store.activeView,
              ),
            inBoardScope,
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
  locked: () => Boolean(home || detailOpen || layoutPreview || feedback.state || boardOverview),
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
    const before = new Set(store.project.cards.map((c) => c.id));
    const result = store.commit((p) => {
      mutator(p);
      if (hasTimeline(p)) adoptNewCards(p, before, boardScope);
    });
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
function announceApplied(success, key = 'formatUpdated') {
  if (success) toast(key, { position: 'top', detail: store.notice ? 'historyLimit' : null });
  return success;
}
function announceSchedule(success, key) {
  if (success) toast(key, { position: 'top', detail: store.notice ? 'historyLimit' : null });
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
// Status changes only through this chip menu: one guarded command, so Undo is one step.
const statusBlocked = () => detailOpen || draftDirty() || feedback.state || layoutPreview;
const statusPopover = createCardStatusPopover({
  current: (id) => {
    const card = projectIndex(store.project).cards.get(id);
    return card && !isPinned(card) ? effectiveStatus(card) : null;
  },
  fallback: (id) =>
    (timelineActive && timeline.element(id, 'status')) ||
    adapter.cards.get(id)?.querySelector('.card-status-chip'),
  onApply: (id, value) => {
    if (statusBlocked()) {
      toast('statusChangeBlocked');
      return false;
    }
    const card = projectIndex(store.project).cards.get(id);
    if (!card || isPinned(card)) return false;
    return change((p) =>
      setStatus(
        p.cards.find((c) => c.id === id),
        value,
      ),
    );
  },
});
// Notes in the selection that sit in no group yet; the picker only adds these.
const ungroupedSelection = () => [...selectedCards].filter((id) => !groupOfCard(store.project, id));
// The picker serves the toolbar button (whole selection) and a note's own "+" button (that note).
let pickerIds = [],
  pickerFallback = null;
const groupPicker = createGroupPickerPopover({
  groups: () => groupOutline(canvasProject()),
  fallback: () => pickerFallback?.(),
  onApply: (groupId) => {
    const ids = pickerIds;
    const title = cardGroups(store.project).find((g) => g.id === groupId)?.title;
    if (ids.length && change((p) => addCardsToGroup(p, groupId, ids)))
      toast('groupCardsAdded', { params: { count: ids.length, title } });
  },
});
function removeFromGroups(ids) {
  const issue = removeFromGroupIssue(store.project, ids);
  if (issue) toast(issue);
  else if (change((p) => removeCardsFromGroup(p, ids)))
    toast('groupCardsRemoved', { params: { count: ids.length } });
}
const scheduleEditor = createCardScheduleEditor({
  title: (id) => projectIndex(store.project).cards.get(id)?.title || '',
  // Prefill with the date the timeline already shows for the note (its note date).
  suggest: (id) => {
    const card = projectIndex(store.project).cards.get(id);
    return (card && cardDateValue(card)) || null;
  },
  current: (id) => {
    const card = projectIndex(store.project).cards.get(id);
    return card && !isPinned(card) ? cardSchedule(card) : null;
  },
  fallback: (id) => timeline.element(id, 'date'),
  onApply: (id, value) => {
    if (statusBlocked()) return false;
    const card = projectIndex(store.project).cards.get(id);
    if (!card || isPinned(card)) return false;
    const notice = value ? 'scheduleUpdated' : 'scheduleCleared';
    if (JSON.stringify(cardSchedule(card)) === JSON.stringify(value))
      return announceSchedule(true, notice);
    return announceSchedule(
      change((p) =>
        setSchedule(
          p.cards.find((c) => c.id === id),
          value,
        ),
      ),
      notice,
    );
  },
});
function timelineStatus(id, anchor) {
  const card = projectIndex(store.project).cards.get(id);
  if (!card || statusPopover.open) return;
  if (inspector.hasPending()) {
    void inspector.close();
    return;
  }
  if (isPinned(card)) toast('statusPinnedHint');
  else if (
    statusBlocked() ||
    dateEditor.open ||
    overviewEditor.open ||
    scheduleEditor.open ||
    timelineInfoEditor.open
  )
    toast('statusChangeBlocked');
  else statusPopover.show(id, anchor);
}
function timelineSchedule(id, anchor) {
  const card = projectIndex(store.project).cards.get(id);
  if (!card || scheduleEditor.open) return;
  if (inspector.hasPending()) {
    void inspector.close();
    return;
  }
  if (isPinned(card)) toast('schedulePinned');
  else if (statusBlocked() || statusPopover.open || dateEditor.open || overviewEditor.open)
    toast('scheduleBlocked');
  else scheduleEditor.show(id, anchor);
}
function timelineColor(id, anchor) {
  const card = projectIndex(store.project).cards.get(id);
  if (!card || colorPopover.open) return;
  if (inspector.hasPending()) {
    void inspector.close();
    return;
  }
  if (isPinned(card)) toast('quickColorPinnedHint');
  else if (
    statusBlocked() ||
    statusPopover.open ||
    dateEditor.open ||
    overviewEditor.open ||
    scheduleEditor.open ||
    timelineInfoEditor.open
  )
    toast('quickColorBlocked');
  else colorPopover.show(id, anchor);
}
async function timelineOpen(id) {
  if (!(await guardDraft()) || !(await select({ kind: 'card', id }, false, true))) return;
  tab = 'overview';
  draft = null;
  draftOriginal = null;
  render();
}
// Same editor as a canvas note, shown as a popup anchored to the clicked text (not in the Format dock).
function timelineEdit(id, anchor, field) {
  const card = projectIndex(store.project).cards.get(id);
  if (!card || overviewEditor.open) return;
  if (inspector.hasPending()) {
    void inspector.close();
    return;
  }
  if (isPinned(card)) toast('pinnedReadOnly');
  else if (statusBlocked() || dateEditor.open || statusPopover.open || scheduleEditor.open)
    toast('timelineEditBlocked');
  else {
    selectMany([id]);
    document.body.append($('#card-overview-editor'));
    overviewEditor.show(id, anchor, field);
  }
}
const timelineInfoEditor = createTimelineInfoEditor({
  current: () => timelineInfo(store.project),
  fallback: (field) => timeline.infoElement(field),
  onApply: (value) => {
    if (statusBlocked() || !hasTimeline(store.project)) return false;
    // setTimelineInfo reports "no change" the same as a refused commit, so probe on the extensions only.
    if (!setTimelineInfo({ extensions: clone(store.project.extensions) }, value))
      return announceSchedule(true, 'timelineInfoUpdated');
    return announceSchedule(
      change((p) => setTimelineInfo(p, value)),
      'timelineInfoUpdated',
    );
  },
});
function timelineInfoEdit(field, anchor) {
  if (timelineInfoEditor.open) return;
  if (inspector.hasPending()) {
    void inspector.close();
    return;
  }
  if (
    statusBlocked() ||
    dateEditor.open ||
    statusPopover.open ||
    scheduleEditor.open ||
    overviewEditor.open
  )
    toast('timelineInfoBlocked');
  else timelineInfoEditor.show(field, anchor);
}
const TIMELINE_NOTE_GAP = 40;
// New Timeline note: dated today, placed right of the existing notes so it never overlaps one.
async function timelineAddNote() {
  if (home || feedback.state || layoutPreview || !(await guardDraft())) return;
  const view = store.activeView;
  const rootCards = scopedProject(store.project, null).cards;
  const right = rootCards.reduce((edge, card) => {
    const { position, size } = geometry(store.project, card, view);
    return Math.max(edge, position.x + size.width);
  }, 0);
  const top = rootCards.reduce(
    (edge, card) => Math.min(edge, geometry(store.project, card, view).position.y),
    Infinity,
  );
  const card = newCard(
    {
      x: rootCards.length ? right + TIMELINE_NOTE_GAP : 0,
      y: Number.isFinite(top) ? top : 0,
    },
    t('newCard'),
  );
  if (
    !change((p) => {
      p.cards.push(card);
      setGeometry(p, card.id, 'mind', 'size', card.size);
      if (view === 'mind') setGeometry(p, card.id, 'mind', 'position', card.position);
      setSchedule(p.cards.at(-1), { start: todayKey() });
    })
  )
    return;
  // Only add the entry; its title, summary and dates are edited in place on the card.
  selection = { kind: 'card', id: card.id };
  render();
  timeline.reveal(card.id);
}
const timeline = createTimelineView({
  host: $('#timeline-view'),
  onOpen: timelineOpen,
  onEdit: timelineEdit,
  onStatus: timelineStatus,
  onSchedule: timelineSchedule,
  onColor: (id, anchor) => timelineColor(id, anchor),
  onInfo: timelineInfoEdit,
  onOverview: () =>
    selectedCards.size === 1 ? openOverview([...selectedCards][0]) : openOverview(),
  onBoard: () => switchMapView('card'),
  onOpenBoard: (id) => enterBoard(id),
  onAddNote: () => timelineAddNote(),
  isPinned: (id) => isPinned(projectIndex(store.project).cards.get(id)),
});
const scopeBar = createBoardScopeBar({
  host: $('#board-scope'),
  onTimeline: () => (boardOverview ? exitOverview('timeline') : leaveBoard()),
  onRoot: () => leaveToProjectBoard(),
  onEdit: (field, anchor) => boardHeaderEdit(field, anchor),
});
// Same popup editor as a Timeline card, anchored to the board header's title or summary button.
function boardHeaderEdit(field, anchor) {
  const id = boardScope;
  const card = id === null ? null : projectIndex(store.project).cards.get(id);
  if (!card || overviewEditor.open) return;
  if (inspector.hasPending()) {
    void inspector.close();
    return;
  }
  if (isPinned(card)) toast('pinnedReadOnly');
  else if (statusBlocked() || dateEditor.open || statusPopover.open || scheduleEditor.open)
    toast('timelineEditBlocked');
  else {
    document.body.append($('#card-overview-editor'));
    overviewEditor.show(id, anchor, field);
  }
}
async function enterBoard(nodeId, focusId) {
  if (home || feedback.state || layoutPreview || !(await guardDraft())) return false;
  const node = projectIndex(store.project).cards.get(nodeId);
  if (!node || ownerOf(node) !== null) return false;
  if (adapter.gesturing) adapter.cancelGesture?.();
  // Read before the scope changes: syncing a new projection moves the viewport.
  const saved = scopeViewports.get(nodeId)?.card;
  if (boardScope === null) {
    scopeReturn = boardOverview
      ? {
          ...overviewReturn,
          overview: {
            viewport: { zoom: adapter.cy.zoom(), position: clone(adapter.cy.pan()) },
          },
        }
      : {
          view: store.activeView,
          viewport: clone(store.viewport),
          timeline: timeline.context(),
        };
  }
  boardOverview = false;
  $('#toast').hidden = true;
  overviewReturn = null;
  boardScope = nodeId;
  timelineActive = false;
  if (store.activeView === 'mind') store.switchView('card');
  previousPanelKey = null;
  render();
  adapter.cy.resize();
  if (saved) adapter.setViewport(saved);
  else if (canvasProject().cards.length) {
    adapter.fit();
    capFitZoom();
  } else adapter.setViewport({ zoom: 1, position: { x: 0, y: 0 } });
  const card = focusId && adapter.cards.get(focusId);
  if (card) {
    adapter.focus(focusId);
    card.focus({ preventScroll: true });
  } else scopeBar.focusCurrent();
  return true;
}
// A first fit on a few notes would blow them up; keep them at 100% around the same centre.
function capFitZoom() {
  const { cy } = adapter;
  const zoom = cy.zoom();
  if (zoom <= 1) return;
  const pan = cy.pan();
  const cx = adapter.region.clientWidth / 2,
    cyy = adapter.region.clientHeight / 2;
  adapter.setViewport({
    zoom: 1,
    position: { x: cx - (cx - pan.x) / zoom, y: cyy - (cyy - pan.y) / zoom },
  });
}
// Viewports of a note board are kept per view: its Note Board and its Mind Map frame differently.
function rememberScopeViewport(viewport) {
  const saved = viewport || { zoom: adapter.cy.zoom(), position: clone(adapter.cy.pan()) };
  scopeViewports.set(boardScope, { ...scopeViewports.get(boardScope), [scopeViewKey()]: saved });
}
function restoreScopeViewport() {
  const saved = scopeViewports.get(boardScope)?.[scopeViewKey()];
  adapter.cy.resize();
  if (saved) adapter.setViewport(saved);
  else if (canvasProject().cards.length) {
    adapter.fit();
    capFitZoom();
  } else adapter.setViewport({ zoom: 1, position: { x: 0, y: 0 } });
}
// Collapsed ids outside the board on screen stay collapsed.
function withoutScopeIds(collapsed) {
  const inScope = new Set(canvasProject().cards.map((c) => c.id));
  return new Set([...collapsed].filter((id) => !inScope.has(id)));
}
// "Note Board" in the header leaves a note's board for the project board, not the Timeline.
async function leaveToProjectBoard() {
  if (!(await leaveBoard({ timeline: true }))) return;
  if (timelineActive) await switchMapView('card');
}
// A board opened from "View all" goes back there, unless the caller asks for the Timeline.
async function leaveBoard({ timeline: toTimeline = false } = {}) {
  if (boardScope === null || feedback.state || layoutPreview || !(await guardDraft())) return false;
  if (adapter.gesturing) adapter.cancelGesture?.();
  const nodeId = boardScope;
  const back = scopeReturn;
  rememberScopeViewport();
  boardScope = null;
  scopeReturn = null;
  if (back?.overview && !toTimeline) {
    overviewReturn = { view: back.view, viewport: back.viewport, timeline: back.timeline };
    showOverview(back.overview.viewport);
    adapter.boardFrames.element(nodeId)?.focus({ preventScroll: true });
    return true;
  }
  if (back && back.view !== store.activeView) store.switchView(back.view);
  timelineActive = hasTimeline(store.project);
  previousPanelKey = null;
  render();
  if (back) store.setView(back.viewport.zoom, back.viewport.position);
  adapter.setViewport(store.viewport);
  if (back && timelineActive) timeline.restore(back.timeline);
  timeline.element(nodeId, 'board')?.focus({ preventScroll: true });
  return true;
}
async function openOverview(focusId) {
  if (home || feedback.state || layoutPreview || !hasTimeline(store.project)) return false;
  if (!(await guardDraft())) return false;
  if (focusId && !(await select({ kind: 'card', id: focusId }))) return false;
  if (adapter.gesturing) adapter.cancelGesture?.();
  overviewReturn = {
    view: store.activeView,
    viewport: clone(store.viewport),
    timeline: timeline.context(),
  };
  showOverview(overviewViewport, focusId);
  return true;
}
function showOverview(viewport, focusId) {
  boardOverview = true;
  timelineActive = false;
  boardScope = null;
  if (store.activeView === 'mind') store.switchView('card');
  previousPanelKey = null;
  render();
  adapter.cy.resize();
  if (viewport) adapter.setViewport(viewport);
  else if (canvasProject().cards.length) fitOverview();
  else adapter.setViewport({ zoom: 1, position: { x: 0, y: 0 } });
  const card = focusId && adapter.cards.get(focusId);
  if (card) {
    adapter.focus(focusId);
    card.focus({ preventScroll: true });
  } else scopeBar.focusCurrent();
}
// Fit the cards and board frames into the part of the canvas not covered by the header or zoom bar.
function fitOverview() {
  const { cy, region } = adapter;
  cy.resize();
  const box = cy.elements().boundingBox();
  let { x1, y1, x2, y2 } = box;
  for (const f of overviewLayout(store.project).frames) {
    x1 = Math.min(x1, f.x);
    y1 = Math.min(y1, f.y);
    x2 = Math.max(x2, f.x + f.width);
    y2 = Math.max(y2, f.y + f.height);
  }
  const rect = region.getBoundingClientRect();
  const top = $('#board-scope').getBoundingClientRect().bottom - rect.top + OVERVIEW_FIT_GAP;
  const bottom =
    rect.height - ($('.zoom-controls').offsetHeight + OVERVIEW_FIT_GAP * 2 + ZOOM_BAR_OFFSET);
  const left = OVERVIEW_FIT_GAP,
    right = rect.width - OVERVIEW_FIT_GAP;
  const zoom = Math.min(
    1,
    Math.max(0.1, Math.min((right - left) / (x2 - x1), (bottom - top) / (y2 - y1))),
  );
  adapter.setViewport({
    zoom,
    position: {
      x: (left + right) / 2 - ((x1 + x2) * zoom) / 2,
      y: (top + bottom) / 2 - ((y1 + y2) * zoom) / 2,
    },
  });
}
// target 'timeline' returns to the Timeline scroll; 'card' lands on the ordinary project board.
async function exitOverview(target) {
  if (!boardOverview || feedback.state || layoutPreview || !(await guardDraft())) return false;
  if (adapter.gesturing) adapter.cancelGesture?.();
  const back = overviewReturn;
  overviewViewport = { zoom: adapter.cy.zoom(), position: clone(adapter.cy.pan()) };
  boardOverview = false;
  overviewReturn = null;
  if (target === 'timeline' && back && back.view !== store.activeView) store.switchView(back.view);
  timelineActive = target === 'timeline' && hasTimeline(store.project);
  previousPanelKey = null;
  render();
  if (back && back.view === store.activeView)
    store.setView(back.viewport.zoom, back.viewport.position);
  adapter.setViewport(store.viewport);
  $('#toast').hidden = true; // The overview lock hint does not belong to the board we return to.
  if (timelineActive && back) timeline.restore(back.timeline);
  if (timelineActive) $('[data-timeline-action=overview]')?.focus({ preventScroll: true });
  return true;
}
// Quick background colour: one guarded command (all unpinned selected notes when the clicked one is
// part of a multi-selection), so Undo is one step. A transparent note becomes opaque, or the colour
// would not show.
const colorTargets = (id) =>
  selectedCards.size > 1 && selectedCards.has(id) ? [...selectedCards] : [id];
const colorPopover = createCardColorPopover({
  current: (id) => {
    const card = projectIndex(store.project).cards.get(id);
    if (!card || isPinned(card)) return null;
    const swatches = Object.fromEntries(
      [DEFAULT_BACKGROUND_ID, ...QUICK_BACKGROUNDS.map((c) => c.id)].map((swatch) => [
        swatch,
        quickBackgroundValue(swatch, card),
      ]),
    );
    return {
      selected: currentQuickBackground(card),
      swatches,
      background: card.style.backgroundColor,
    };
  },
  fallback: (id) =>
    (timelineActive && timeline.element(id, 'color')) ||
    adapter.cards.get(id)?.querySelector('.card-color-button'),
  onApply: (id, swatch) => {
    if (statusBlocked()) {
      toast('quickColorBlocked');
      return false;
    }
    const ids = new Set(colorTargets(id));
    return change((p) => {
      for (const card of p.cards.filter((c) => ids.has(c.id) && !isPinned(c))) {
        setQuickBackground(card, swatch);
        if (appearance(card).backgroundTransparent)
          card.extensions[APPEARANCE].backgroundTransparent = false;
      }
    });
  },
});
// Comments change only through these guarded commands; the panel re-renders from the store.
const commentsAllowed = () => detailOpen && !draftDirty() && !feedback.state && !layoutPreview;
const comments = createCardComments({
  onAdd: (id, text) =>
    commentsAllowed() &&
    change((p) =>
      addComment(
        p.cards.find((c) => c.id === id),
        { id: newId('comment'), createdAt: new Date().toISOString(), text },
      ),
    ),
  onRemove: (id, commentId) =>
    commentsAllowed() &&
    change((p) =>
      removeComment(
        p.cards.find((c) => c.id === id),
        commentId,
      ),
    ),
});
function syncStatusDisplay() {
  $('#canvas-region').classList.toggle('hide-card-status', !showStatus);
  const button = $('[data-action=status-display]');
  button.setAttribute('aria-pressed', String(showStatus));
  button.dataset.i18nTitle = showStatus ? 'statusDisplayHide' : 'statusDisplayShow';
}
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
      : (boardScope === id && scopeBar.element(field)) ||
        (timelineActive && timeline.element(id, field)) ||
        adapter.cards.get(id)?.querySelector('[data-overview-field="' + field + '"]') ||
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
        applyUniformStyles(
          project,
          profile,
          store.activeView,
          (card) =>
            measureOverview(
              { ...card, size: geometry(project, card, store.activeView).size },
              null,
              store.activeView,
            ),
          inBoardScope,
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
    // Edited from the board header: say what changed instead of the format-oriented message.
    const notice = boardScope === id ? 'noteTextUpdated' : 'formatUpdated';
    if (JSON.stringify(project) === JSON.stringify(store.project))
      return announceApplied(true, notice);
    return announceApplied(
      change((p) => {
        p.cards = project.cards;
        if (project.extensions) p.extensions = project.extensions;
        else delete p.extensions;
      }),
      notice,
    );
  },
});
export const adapter = new GraphAdapter($('#canvas-region'), $('#cards-layer'), {
  board: (id) => void enterBoard(id),
  frameOpen: (id) => void enterBoard(id),
  arranged: () => boardOverview,
  arrangedDrag: () => toast('boardOverviewLocked'),
  // Owned cards are outside the scoped projection, so the count comes from the full project.
  boardCount: (id) => (boardScope === null ? ownedCounts(store.project).get(id) || 0 : 0),
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
  groupLocked: () => selectionBlocked() || boardOverview,
  selectionLocked: () => selectionBlocked(),
  date: (id, anchor) => {
    if (inspector.hasPending()) {
      void inspector.close();
      return;
    }
    selectMany([id]);
    dateEditor.show(id, anchor);
  },
  status: (id, anchor) => {
    const card = projectIndex(store.project).cards.get(id);
    if (!card || statusPopover.open) return;
    if (inspector.hasPending()) {
      void inspector.close();
      return;
    }
    if (isPinned(card)) toast('statusPinnedHint');
    else if (statusBlocked() || dateEditor.open || overviewEditor.open)
      toast('statusChangeBlocked');
    else {
      selectMany([id]);
      statusPopover.show(id, anchor);
    }
  },
  color: (id, anchor) => {
    const card = projectIndex(store.project).cards.get(id);
    if (!card || colorPopover.open) return;
    if (inspector.hasPending()) {
      void inspector.close();
      return;
    }
    if (isPinned(card)) toast('quickColorPinnedHint');
    else if (statusBlocked() || dateEditor.open || overviewEditor.open) toast('quickColorBlocked');
    else {
      if (!selectedCards.has(id)) selectMany([id]);
      colorPopover.show(id, anchor);
    }
  },
  groupButtons: () => !boardOverview && !layoutPreview,
  group: (id, anchor) => {
    if (adapter.callbacks.groupLocked() || layoutPreview) return;
    if (groupOfCard(store.project, id)) return removeFromGroups([id]);
    pickerIds = [id];
    pickerFallback = () => adapter.cards.get(id)?.querySelector('.card-group-button');
    groupPicker.show(anchor);
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
    if (overviewBlocked()) return;
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
  groupConnection: (source, group) => groupConnection(source, group),
  connectingFrom: () => (connectMode ? connectSource : null),
  viewport: (zoom, position) => {
    if (boardOverview) overviewViewport = { zoom, position: clone(position) };
    else if (boardScope === null) store.setView(zoom, position);
    else rememberScopeViewport({ zoom, position: clone(position) });
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
      scheduleEditor.open ||
      timelineInfoEditor.open ||
      statusPopover.open ||
      groupPicker.open ||
      colorPopover.open ||
      overviewEditor.open ||
      adapter.gesturing ||
      adapter.resizing ||
      adapter.edgeDragging,
    ),
});
const selectionBlocked = () => adapter.callbacks.locked() || connectMode || home;
const currentView = () => (timelineActive ? 'timeline' : store.activeView);
function render() {
  // Undo/Redo or removing the Timeline can delete the open node: fall back to the project board.
  const scopeNode = boardScope === null ? null : projectIndex(store.project).cards.get(boardScope);
  const scopeClosed =
    boardScope !== null &&
    (!hasTimeline(store.project) || !scopeNode || ownerOf(scopeNode) !== null);
  if (scopeClosed) {
    const view = scopeReturn?.view ?? 'card';
    boardScope = null;
    scopeReturn = null;
    timelineActive = hasTimeline(store.project);
    if (store.activeView !== view) store.switchView(view);
  }
  const overviewClosed = boardOverview && !hasTimeline(store.project);
  if (overviewClosed) {
    boardOverview = false;
    overviewReturn = null;
  }
  const timelineAvailable = !home && hasTimeline(store.project);
  if (!hasTimeline(store.project)) timelineActive = false;
  $('#canvas-region').dataset.view = store.activeView;
  $('#canvas-region').classList.toggle('board-overview', boardOverview);
  $('#map-view').hidden = home;
  $('#map-view').setAttribute('aria-label', t('mapView'));
  $('[data-action=inspector]').disabled = home;
  $('#mind-view-banner').hidden = home || timelineActive || store.activeView !== 'mind';
  $('[data-action=convert-mind]').hidden = home || store.activeView === 'mind';
  $('[data-action=timeline-remove]').hidden = !timelineAvailable;
  $('#timeline-view').hidden = !timelineActive;
  $('.workspace').classList.toggle('timeline-active', timelineActive);
  inspector.sync();
  $('#app').classList.toggle('home-mode', home);
  $('#home-page').hidden = !home;
  $('.workspace').hidden = home;
  $('[data-action=continue]').hidden = !hasSession;
  if (home) gallery.render();
  $('#detail-theme').dataset.i18nTitle = theme === 'dark' ? 'lightMode' : 'darkMode';
  $('[data-action=expand]').dataset.i18nTitle = expanded ? 'restoreDetail' : 'fullDetail';

  const scoped = canvasProject();
  const scopedIndex = projectIndex(scoped);
  if (
    (selection?.kind === 'card' && !scopedIndex.cards.has(selection.id)) ||
    (selection?.kind === 'relation' && !scopedIndex.relations.has(selection.id))
  ) {
    selection = null;
    draft = null;
    draftOriginal = null;
    detailOpen = false;
  }
  const existing = new Set(scoped.cards.map((c) => c.id));
  selectedCards = new Set([...selectedCards].filter((id) => existing.has(id)));
  if (detailOpen || selection?.kind !== 'card' || !selectedCards.has(selection.id))
    selectedCards = new Set(
      selection?.kind === 'card' && existing.has(selection.id) ? [selection.id] : [],
    );
  const allIds = new Set(store.project.cards.map((c) => c.id));
  if ([...store.collapsed].some((id) => !allIds.has(id)))
    store.collapsed = new Set([...store.collapsed].filter((id) => allIds.has(id)));
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
  syncStatusDisplay();
  $('[data-action=focus]').disabled =
    !focusBranch && !['card', 'relation'].includes(selection?.kind);
  if (selection && !entity()) {
    selection = null;
    draft = null;
    draftOriginal = null;
  }
  if (!layoutPreview) revealSelection(selection);
  adapter.sync(scoped, selection, store.activeView, {
    positions: layoutPreview?.result.positions,
    collapsed: store.collapsed,
    selectedCards,
    focusRoot: focusBranch ? selection.id : null,
    frames: boardOverview ? overviewLayout(store.project).frames : undefined,
  });
  const groupedIds = [...selectedCards].filter((id) => groupOfCard(store.project, id));
  const addButton = $('[data-action=group-add]');
  const removeButton = $('[data-action=group-remove]');
  const mixedMembership = groupedIds.length > 0 && groupedIds.length < selectedCards.size;
  addButton.hidden =
    groupedIds.length === selectedCards.size || !cardGroups(canvasProject()).length;
  addButton.disabled = groupedIds.length > 0 || boardOverview;
  addButton.title = t(mixedMembership ? 'groupAddMixed' : 'groupAddCardsHint');
  removeButton.hidden = !groupedIds.length;
  removeButton.disabled = boardOverview;
  // One selected note shows the bar only when it offers a group action (or came from a marquee).
  $('#selection-tools').hidden =
    selectedCards.size < 2 &&
    !(selectedCards.size === 1 && selectedCards.has(singleMarqueeId)) &&
    !(selectedCards.size === 1 && (!addButton.hidden || !removeButton.hidden));
  // A single clicked note only needs the group actions; the short bar stays clear of nearby notes.
  $('#selection-tools').classList.toggle(
    'compact',
    selectedCards.size === 1 && !selectedCards.has(singleMarqueeId),
  );
  if ($('#selection-tools').hidden) $('#selection-json').open = false;
  $('#selection-count').textContent = t('selectedCardsCount', { count: selectedCards.size });
  const createGroupButton = $('[data-action=group-create]');
  createGroupButton.hidden = selectedCards.size < 2;
  // Notes that all sit directly in one group form a subgroup of it.
  const place = selectedCards.size ? newGroupParent(store.project, [...selectedCards]) : {};
  createGroupButton.disabled = Boolean(place.issue) || boardOverview;
  createGroupButton.title = t(
    place.issue || (place.parentId ? 'groupCreateSubgroup' : 'groupCreate'),
  );
  $('#mind-map-tools').hidden = timelineActive || store.activeView !== 'mind';
  $('#layout-preview-bar').hidden = !layoutPreview;
  $('#panel-body').inert = Boolean(layoutPreview);
  $('#layout-warnings').textContent =
    layoutPreview?.result.warnings.map((w) => t(w.code, { count: w.count })).join(' ') || '';
  $('[data-action=layout]').disabled = Boolean(layoutPreview) || !store.project.cards.length;
  $('[data-action=expand-all]').disabled = Boolean(layoutPreview) || !store.collapsed.size;
  for (const action of [
    'new',
    'add',
    'connect',
    'import',
    'export',
    'export-word',
    'export-markdown',
    'recovery',
    'timeline-remove',
  ])
    for (const el of document.querySelectorAll('[data-action="' + action + '"]'))
      el.disabled = Boolean(layoutPreview);

  $('#map-view').dataset.activeView = currentView();
  for (const button of document.querySelectorAll('[data-map-view]'))
    button.setAttribute('aria-pressed', String(button.dataset.mapView === currentView()));
  $('#detail-map-view').value = currentView();
  $('[data-panel-action=layout]').hidden = store.activeView !== 'mind';
  $('#mind-map-hint').hidden =
    timelineActive || store.activeView !== 'mind' || Boolean(canvasRoot());
  $('#mind-map-hint').textContent = t('mindHint');
  $('#project-name').textContent = store.project.metadata.title;
  const projectNameLabel = t('projectSettings') + ': ' + store.project.metadata.title;
  $('#project-name').title = projectNameLabel;
  $('#project-name').setAttribute('aria-label', projectNameLabel);
  $('#welcome').hidden = scoped.cards.length > 0;
  $('#project-menu > summary').setAttribute('aria-label', t('helpAndTools'));
  $('#counts').textContent =
    number(scoped.cards.length) +
    ' ' +
    t('cards') +
    ' · ' +
    number(scoped.relations.length) +
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
  if (timelineActive) timeline.render({ project: store.project, selection: selectedCards });
  updateStatus();
  translate();
  renderScopeChrome(scoped);
  if (scopeClosed || overviewClosed) {
    adapter.setViewport(store.viewport);
    toast(scopeClosed ? 'boardScopeClosed' : 'boardOverviewClosed');
  }
  dateEditor.syncLocale();
  scheduleEditor.syncLocale();
  timelineInfoEditor.syncLocale();
  statusPopover.syncLocale();
  groupPicker.syncLocale();
  colorPopover.syncLocale();
  overviewEditor.syncLocale();
  scheduleRecovery();
}
// Breadcrumb and empty-board text; runs after translate() so it wins over data-i18n.
function renderScopeChrome(scoped) {
  const node = boardScope === null ? null : projectIndex(store.project).cards.get(boardScope);
  const projectTitle = store.project.metadata.title;
  let header = null;
  if (boardOverview)
    header = {
      mode: 'overview',
      projectTitle,
      cards: scoped.cards.length,
      boards: overviewLayout(store.project).frames.length,
    };
  else if (node)
    header = {
      mode: 'node',
      projectTitle,
      back: scopeReturn?.overview ? 'overview' : 'timeline',
      title: node.title,
      summary: node.summary,
      count: scoped.cards.length,
      pinned: isPinned(node),
    };
  scopeBar.render(header);
  if (node && !scoped.cards.length) {
    $('#welcome h1').textContent = t('boardScopeEmptyTitle', { title: node.title });
    $('#welcome p').textContent = t('boardScopeEmptyBody');
  }
}
const renderCardList = createCardList({
  host: $('#card-list'),
  onSelect: async (id) => {
    const owner = ownerOf(projectIndex(store.project).cards.get(id) ?? { extensions: {} });
    // "View all" shows every note: search only selects and focuses, the scope never changes.
    if (!boardOverview) {
      if (owner !== null) {
        if (owner !== boardScope && !(await enterBoard(owner, id))) return;
      } else if (boardScope !== null && !(await leaveBoard())) return;
    }
    if (await select({ kind: 'card', id }, false, true)) {
      closeSearch();
      if (timelineActive) timeline.reveal(id);
      else adapter.focus(id);
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
  if (selectionBlocked()) return false;
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
  const readingHeight = state && body.querySelector('.reading-layout')?.offsetHeight;
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
  holdReadingHeight(body, readingHeight);
  restoreEditor(body, state);
  if (!state) body.scrollTop = 0;
  $('#writing-exit').hidden = !(writing && selection?.kind === 'card');
  document.documentElement.classList.toggle(
    'writing-mode',
    detailOpen && writing && selection?.kind === 'card',
  );
}
// The reading frame is rebuilt and sized asynchronously, so for a moment the panel is shorter and a
// restored scroll position gets clamped. Hold the previous height until the frame has settled.
const READING_HEIGHT_HOLD_MS = 1500;
function holdReadingHeight(body, height) {
  const layout = body.querySelector('.reading-layout');
  if (!layout || !height) return;
  layout.style.minHeight = height + 'px';
  setTimeout(() => layout.style.removeProperty('min-height'), READING_HEIGHT_HOLD_MS);
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
      '<div class="reading-layout"><nav class="reading-contents" hidden></nav><div class="markdown"></div></div><div class="card-comments-host"></div><details class="document-details"><summary>' +
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
    comments.mount(body.querySelector('.card-comments-host'), { card: e, locked: readOnly });
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
      change((p) => setRoot(p, id, true, boardScope));
    };
  if ($('#clear-root')) {
    $('#clear-root').disabled = !canvasRoot();
    $('#clear-root').onclick = async () => {
      if (await guardDraft()) change((p) => setRoot(p, null, false, boardScope));
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
      applyUniformStyles(
        p,
        profile,
        store.activeView,
        (card) =>
          measureOverview(
            { ...card, size: geometry(p, card, store.activeView).size },
            null,
            store.activeView,
          ),
        inBoardScope,
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
/** Draws an arrow from a card to a group frame as one Undo step. */
async function groupConnection(source, groupId) {
  if (overviewBlocked()) return;
  connectMode = false;
  connectSource = null;
  if (isPinned(projectIndex(store.project).cards.get(source))) {
    toast('pinnedCardLocked');
    render();
    return;
  }
  if (!(await guardDraft())) return;
  const issue = groupLinkIssue(store.project, groupId, source);
  if (issue) {
    toast(issue);
    render();
    return;
  }
  if (!change((p) => addGroupLink(p, groupId, { id: newId('group-link'), source }))) return;
  toast('groupLinkAdded');
  render();
}
async function connection(source, target, position) {
  if (overviewBlocked()) return;
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
  // In the Mind Map a hand-drawn link grows the tree, so the source can collapse its new child.
  if (store.activeView === 'mind' && newLinkKind(canvasProject(), source, target) === 'branch')
    r.extensions = { [MIND]: { kind: 'branch' } };
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
  if (overviewBlocked()) return;
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
  if (overviewBlocked() || !(await guardDraft())) return;
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
  if (overviewBlocked()) return;
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
const PASTE_OFFSET = 36;
const copyableIds = () =>
  selectedCards.size ? [...selectedCards] : selection?.kind === 'card' ? [selection.id] : [];
function copySelection() {
  const ids = copyableIds();
  if (!ids.length) return false;
  cardClipboard = copyCards(store.project, ids);
  pasteCount = 0;
  toast('cardsCopied', { params: { count: cardClipboard.cards.length } });
  return true;
}
async function pasteSnapshot(snapshot, offset) {
  if (overviewBlocked() || adapter.callbacks.groupLocked() || !(await guardDraft())) return false;
  if (
    store.project.cards.length + snapshot.cards.length > LIMITS.cards ||
    store.project.relations.length + snapshot.relations.length > LIMITS.relations
  ) {
    toast('pasteLimit');
    return false;
  }
  let ids = [];
  if (
    !change((p) => {
      ids = pasteCards(p, snapshot, { offset, newId });
    })
  )
    return false;
  selectMany(ids);
  toast('cardsPasted', { params: { count: ids.length } });
  return true;
}
async function pasteSelection() {
  if (cardClipboard && (await pasteSnapshot(cardClipboard, PASTE_OFFSET * (pasteCount + 1))))
    pasteCount += 1;
}
// Duplicate leaves the copy buffer alone, so an earlier Ctrl+C can still be pasted afterwards.
async function duplicateSelection() {
  const ids = copyableIds();
  if (ids.length) await pasteSnapshot(copyCards(store.project, ids), PASTE_OFFSET);
}
async function deleteSelected() {
  if (overviewBlocked()) return;
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
  const childIds = s.kind === 'card' ? ownedIds(store.project, s.id) : [];
  if (childIds.length) {
    if (childIds.some((id) => isPinned(index.cards.get(id)))) {
      toast('boardDeletePinned');
      return;
    }
    const choice = await dialog(
      'boardDeleteTitle',
      () =>
        '<p>' +
        esc(
          t(childIds.length === 1 ? 'boardDeleteBodyOne' : 'boardDeleteBody', {
            title: deleted.title,
            count: number(childIds.length),
          }),
        ) +
        '</p>',
      [
        ['cancel', 'cancel'],
        ['boardDeleteConfirm', 'remove', true],
      ],
    );
    if (choice !== 'remove') return;
    if (
      !change((p) => {
        for (const id of [...childIds, s.id]) remove(p, { kind: 'card', id });
      })
    )
      return;
    toast(childIds.length === 1 ? 'deletedCardWithBoardOne' : 'deletedCardWithBoard', {
      params: { title: deleted.title, count: number(childIds.length) },
    });
  } else {
    if (!change((p) => remove(p, s))) return;
    if (deleted)
      toast(deleted.count ? 'deletedCard' : 'deletedCardOnly', {
        params: { title: deleted.title, count: number(deleted.count) },
      });
    else toast('deletedRelation');
  }
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
  timelineActive = hasTimeline(store.project);
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
  if (selectionBlocked() || !selectedCards.size) return;
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

async function resolveExportDraft() {
  if (!draftDirty()) return true;
  const choice = await dialog('exportDraftTitle', () => '<p>' + esc(t('draftBody')) + '</p>', [
    ['cancel', 'cancel'],
    ['exportApplied', 'applied'],
    ['applyExport', 'apply', true],
  ]);
  if (choice === 'cancel') return false;
  return !(choice === 'apply' && ((await blockEditor?.flush()) === false || !applyDraft()));
}
async function exportProject() {
  if (!(await resolveExportDraft())) return false;
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
/** Document exports in the Export menu: they download a file to read and never mark the project saved. */
const DOCUMENT_EXPORTS = {
  word: {
    run: async (project, options) =>
      (await import('./word-export/browser.js')).exportWordFile(project, options),
    done: 'wordExportDone',
    doneSkipped: 'wordExportDoneSkipped',
    empty: 'wordExportEmpty',
    failed: 'wordExportFailed',
  },
  markdown: {
    run: async (project, options) =>
      (await import('./markdown-export/browser.js')).exportMarkdownFile(project, options),
    done: 'markdownExportDone',
    doneSkipped: 'markdownExportDoneSkipped',
    empty: 'markdownExportEmpty',
    failed: 'markdownExportFailed',
  },
};
// The chosen option disappears with the menu, so focus returns to the menu button first; the
// draft dialog then hands focus back to it as well.
function closeExportMenu() {
  if (!$('#export-menu').open) return;
  $('#export-menu').open = false;
  $('#export-menu > summary').focus();
}
async function exportDocument(format) {
  const kind = DOCUMENT_EXPORTS[format];
  const menuButton = $('#export-menu > summary');
  closeExportMenu();
  if (layoutPreview || menuButton.getAttribute('aria-busy') === 'true') return;
  if (!store.project.cards.length) return toast(kind.empty);
  if (!(await resolveExportDraft())) return;
  menuButton.setAttribute('aria-busy', 'true');
  try {
    const { skippedImages } = await kind.run(store.project, { view: store.activeView });
    toast(skippedImages ? kind.doneSkipped : kind.done, {
      params: { count: skippedImages },
      detail: store.dirty ? 'wordExportNotSaved' : null,
    });
  } catch (error) {
    console.error(error);
    toast(kind.failed);
  } finally {
    menuButton.removeAttribute('aria-busy');
  }
}
async function createProject() {
  if (!(await guardDraft())) return;
  let title = t('untitledProject');
  let withTimeline = true;
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
    const option = document.createElement('label');
    option.className = 'new-project-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'new-project-timeline';
    checkbox.checked = withTimeline;
    checkbox.onchange = () => {
      withTimeline = checkbox.checked;
    };
    const optionText = document.createElement('span');
    optionText.textContent = t('newProjectTimeline');
    option.append(checkbox, optionText);
    const optionHint = document.createElement('p');
    optionHint.className = 'new-project-option-hint';
    optionHint.textContent = t('newProjectTimelineHint');
    container.append(label, hint, option, optionHint);
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
  if (withTimeline) enableTimeline(project);
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
  comments.clear();
  timelineActive = hasTimeline(p);
  boardScope = null;
  scopeReturn = null;
  boardOverview = false;
  overviewViewport = null;
  overviewReturn = null;
  scopeViewports.clear();
  timeline.reset();
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
      if (initialView === 'mind' && !hasTimeline(result.project)) {
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
    $('#detail-map-view').value = currentView();
    return;
  }
  // Leaving "View all" for Mind Map or Note Board lands on the ordinary project board first.
  if (boardOverview) {
    if (!(await exitOverview(targetView === 'timeline' ? 'timeline' : 'card'))) return;
    if (targetView === 'mind') await switchMapView('mind');
    return;
  }
  if (boardScope !== null && targetView === 'timeline') {
    await leaveBoard({ timeline: true });
    return;
  }
  if (targetView === currentView()) return;
  // Cancel a transient group drag before evaluating the view's draft guard.
  if (adapter.gesturing) adapter.cancelGesture?.();
  if (layoutPreview) {
    cancelLayout();
    toast('previewCancelledSwitch');
  }
  if (!(await guardDraft())) {
    $('#detail-map-view').value = currentView();
    return;
  }
  if (targetView === 'timeline') {
    const created = !hasTimeline(store.project);
    if (created && !change((p) => enableTimeline(p))) {
      $('#detail-map-view').value = currentView();
      return;
    }
    timelineActive = true;
    previousPanelKey = null;
    render();
    if (created) {
      const heading = $('#timeline-heading');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      toast('timelineCreated');
    }
    return;
  }
  if (targetView === 'mind' && !canvasRoot()) {
    await actions['convert-mind']();
    $('#detail-map-view').value = currentView();
    return;
  }
  timelineActive = false;
  if (boardScope !== null) rememberScopeViewport();
  if (targetView !== store.activeView) store.switchView(targetView);
  selectedCards = new Set(selection?.kind === 'card' ? [selection.id] : []);
  singleMarqueeId = null;
  previousPanelKey = null;
  render();
  if (boardScope !== null) restoreScopeViewport();
  else adapter.setViewport(store.viewport);
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
  const { hidden } = visibility(canvasProject(), collapsed);
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
  if (!canvasRoot()) {
    toast('layoutNeedsRoot');
    return;
  }
  if (!(await guardDraft())) return;
  detailOpen = false;
  detailSurface.close();
  try {
    const result = radialLayout(scopedProject(store.project, boardScope));
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
  'timeline-remove': async () => {
    if (home || feedback.state || layoutPreview || !hasTimeline(store.project)) return;
    if (!(await guardDraft())) return;
    const owned = store.project.cards.filter((c) => ownerOf(c) !== null);
    if (owned.some(isPinned)) return toast('timelineRemovePinnedBoards');
    const choice = await dialog(
      'timelineRemoveTitle',
      () =>
        '<p>' +
        esc(t('timelineRemoveBody')) +
        '</p>' +
        (owned.length
          ? '<p>' + esc(t('timelineRemoveBoardsBody', { count: number(owned.length) })) + '</p>'
          : ''),
      [
        ['cancel', 'cancel'],
        ['timelineRemove', 'remove', true],
      ],
    );
    if (
      choice !== 'remove' ||
      !change((p) => {
        clearOwners(p);
        disableTimeline(p);
      })
    )
      return;
    timelineActive = false;
    render();
    adapter.setViewport(store.viewport);
    toast('timelineRemoved');
  },
  'convert-mind': async () => {
    if (home || feedback.state || layoutPreview || !(await guardDraft())) return;
    const scoped = canvasProject();
    const candidates = scoped.cards.filter((c) => !isPinned(c));
    let rootId =
      selection?.kind === 'card' && candidates.some((c) => c.id === selection.id)
        ? selection.id
        : candidates[0]?.id;
    if (!rootId) {
      toast(scoped.cards.length ? 'mindAllPinned' : 'mindNoCards');
      return;
    }
    const board = boardScope;
    const boardTitle = board === null ? '' : projectIndex(store.project).cards.get(board)?.title;
    const choice = await dialog(
      'convertMind',
      () => {
        const body = document.createElement('div');
        const help = document.createElement('p');
        help.textContent =
          board === null ? t('mindConvertHint') : t('mindConvertBoardHint', { title: boardTitle });
        const label = document.createElement('label');
        label.textContent = t('mindRoot');
        const select = document.createElement('select');
        select.id = 'mind-convert-root';
        for (const card of candidates) select.append(new window.Option(card.title, card.id));
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
      const result = convertMind(store.project, rootId, board);
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
      timelineActive = false;
      if (board !== null) rememberScopeViewport();
      store.switchView('mind');
      store.collapsed = withoutScopeIds(store.collapsed);
      selection = { kind: 'card', id: rootId };
      render();
      if (board === null) adapter.fit();
      else {
        adapter.cy.resize();
        adapter.fit();
        capFitZoom();
      }
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
      result = enableAutoRoutes(p, store.activeView, relationInBoardScope(p));
    });
    if (ok || result?.changed === 0)
      toast(result.changed ? 'autoRouteEnabled' : 'autoRouteNoCandidates');
  },
  'edge-adjust': async () => {
    if (overviewBlocked()) return;
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
    timelineActive = hasTimeline(store.project);
    render();
    adapter.cy.resize();
    adapter.setViewport(store.viewport);
  },

  layout: startLayout,
  'layout-cancel': cancelLayout,
  'layout-reset': () => {
    if (layoutPreview) {
      try {
        layoutPreview.result = radialLayout(scopedProject(store.project, boardScope));
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
      store.collapsed = withoutScopeIds(store.collapsed);
      render();
    }
  },

  'clear-selection': () => selectMany([]),
  'selection-duplicate': duplicateSelection,
  'selection-copy-json': () => exportSelectionJSON('copy'),
  'selection-download-json': () => exportSelectionJSON('download'),
  'group-create': () => {
    if (overviewBlocked()) return;
    if (!adapter.callbacks.groupLocked()) editGroup(null, [...selectedCards]);
  },
  'group-add': () => {
    if (overviewBlocked() || adapter.callbacks.groupLocked() || layoutPreview) return;
    pickerIds = ungroupedSelection();
    pickerFallback = () => $('[data-action=group-add]');
    groupPicker.show($('[data-action=group-add]'));
  },
  'group-remove': () => {
    if (overviewBlocked() || adapter.callbacks.groupLocked() || layoutPreview) return;
    removeFromGroups([...selectedCards].filter((id) => groupOfCard(store.project, id)));
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
    if (overviewBlocked()) return;
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
  export: () => {
    closeExportMenu();
    return exportProject();
  },
  'export-word': () => exportDocument('word'),
  'export-markdown': () => exportDocument('markdown'),
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
  'status-display': () => {
    showStatus = !showStatus;
    syncStatusDisplay();
    translate($('.zoom-controls'));
  },
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
  if (!e.target.closest('#export-menu')) $('#export-menu').open = false;
});
document.addEventListener('keydown', (e) => {
  if (
    dateEditor.open ||
    scheduleEditor.open ||
    timelineInfoEditor.open ||
    statusPopover.open ||
    groupPicker.open ||
    colorPopover.open ||
    overviewEditor.open
  )
    return;
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
  if (e.key === 'Escape' && !detailOpen && !feedback.state && $('#export-menu').open) {
    e.preventDefault();
    closeExportMenu();
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
  if (e.code === 'Space' && !timelineActive) {
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
  if (!detailOpen && !timelineActive && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
    const key = e.key.toLowerCase();
    // Selected page text keeps the browser's own copy.
    if (key === 'c' && window.getSelection().isCollapsed && copySelection()) e.preventDefault();
    if (key === 'v' && cardClipboard) {
      e.preventDefault();
      pasteSelection();
    }
    if (key === 'd' && copyableIds().length) {
      e.preventDefault();
      duplicateSelection();
    }
  }
  if (!timelineActive && (e.key === 'Delete' || e.key === 'Backspace')) {
    e.preventDefault();
    deleteSelected();
  }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') adapter.space = false;
});
window.addEventListener('blur', () => (adapter.space = false));
window.addEventListener('beforeunload', (e) => {
  if (
    store.dirty ||
    draftDirty() ||
    dateEditor.dirty ||
    scheduleEditor.dirty ||
    timelineInfoEditor.dirty ||
    overviewEditor.dirty
  ) {
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
