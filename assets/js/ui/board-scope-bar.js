import { t } from '../i18n/index.js';

/**
 * Header of a node's own board or of the "all notes" overview: a small path row (back, project),
 * the title/summary buttons (open the overview editor) and a meta line.
 * Titles and summaries are user content and are never translated.
 */
export function createBoardScopeBar({ host, onTimeline, onRoot, onEdit }) {
  const backEl = host.querySelector('[data-scope-action="timeline"]');
  const projectEl = host.querySelector('[data-scope-action="root"]');
  const titleEl = host.querySelector('.board-scope-title');
  const overviewTitleEl = host.querySelector('.board-scope-overview-title');
  const summaryEl = host.querySelector('.board-scope-summary');
  const summaryRow = host.querySelector('.board-scope-summary-row');
  const countEl = host.querySelector('.board-scope-count');
  const hintEl = host.querySelector('.board-scope-hint');
  const editButtons = { title: titleEl, summary: summaryEl };
  host.addEventListener('click', (event) => {
    if (event.target.closest('[data-scope-action="timeline"]')) {
      onTimeline();
      return;
    }
    if (event.target.closest('[data-scope-action="root"]')) {
      onRoot();
      return;
    }
    const edit = event.target.closest('[data-scope-edit]');
    if (edit) onEdit?.(edit.dataset.scopeEdit, edit);
  });

  // Floating tools (Mind Map bar, layout preview) sit below this header; CSS reads the published height.
  const region = host.parentElement;
  new ResizeObserver(() => {
    const height = host.hidden ? 0 : host.offsetTop + host.offsetHeight;
    region?.style.setProperty('--board-scope-height', height + 'px');
  }).observe(host);

  function pinMark() {
    const mark = document.createElement('span');
    mark.className = 'board-scope-pin';
    mark.setAttribute('aria-hidden', 'true');
    return mark;
  }

  function renderEditButton(button, field, text, pinned) {
    button.setAttribute(
      'aria-label',
      pinned
        ? (text ? text + '. ' : '') + t('pinnedReadOnly')
        : t('editOverviewField', { field: t(field), value: text }),
    );
    if (pinned) button.setAttribute('aria-disabled', 'true');
    else button.removeAttribute('aria-disabled');
  }

  function renderPath(state, back) {
    backEl.textContent = t(back === 'overview' ? 'boardOverviewTitle' : 'timelineView');
    backEl.title = t(back === 'overview' ? 'boardScopeBackOverview' : 'boardScopeBack');
    projectEl.textContent = state.projectTitle;
    projectEl.hidden = !state.projectTitle;
    projectEl.title = t('boardScopeRoot');
    projectEl.setAttribute('aria-label', t('boardScopeRoot') + ': ' + state.projectTitle);
  }

  function renderNode(state) {
    // Older callers pass nodeTitle and no mode/back: treat them as a Timeline-scoped node.
    const title = state.title ?? state.nodeTitle ?? '';
    const summary = state.summary ?? '';
    renderPath(state, state.back === 'overview' ? 'overview' : 'timeline');
    titleEl.hidden = false;
    overviewTitleEl.hidden = true;
    summaryRow.hidden = false;
    titleEl.replaceChildren(...(state.pinned ? [pinMark()] : []), title);
    titleEl.title = title;
    // A pinned note without a summary offers nothing to edit, so the empty-field prompt is dropped.
    summaryRow.hidden = Boolean(state.pinned && !summary);
    summaryEl.textContent = summary || t('timelineSummaryEmpty');
    summaryEl.classList.toggle('is-empty', !summary);
    renderEditButton(titleEl, 'title', title, state.pinned);
    renderEditButton(summaryEl, 'summary', summary, state.pinned);
    countEl.textContent = t(state.count === 1 ? 'boardScopeCountOne' : 'boardScopeCount', {
      count: state.count,
    });
    hintEl.hidden = true;
    hintEl.textContent = '';
  }

  function renderOverview(state) {
    renderPath(state, 'timeline');
    titleEl.hidden = true;
    summaryRow.hidden = true;
    overviewTitleEl.hidden = false;
    overviewTitleEl.textContent = t('boardOverviewTitle');
    const notes = t(state.cards === 1 ? 'boardOverviewNotesOne' : 'boardOverviewNotes', {
      count: state.cards,
    });
    const boards = t(state.boards === 1 ? 'boardOverviewBoardsOne' : 'boardOverviewBoards', {
      count: state.boards,
    });
    countEl.textContent = notes + ' · ' + boards;
    hintEl.textContent = t('boardOverviewHint');
    hintEl.hidden = false;
  }

  function render(state) {
    host.hidden = !state;
    if (!state) return;
    if (state.mode === 'overview') renderOverview(state);
    else renderNode(state);
  }
  function focusCurrent() {
    (overviewTitleEl.hidden ? titleEl : overviewTitleEl).focus();
  }
  function element(field) {
    return editButtons[field] ?? null;
  }
  return { render, focusCurrent, element };
}
