import { t } from '../i18n/index.js';

/**
 * Breadcrumb of a node's own board: project / Timeline button / node title + note count.
 * Titles are user content and are never translated.
 */
export function createBoardScopeBar({ host, onTimeline, onRoot }) {
  const projectItem = host.querySelector('.board-scope-project');
  const projectEl = projectItem.querySelector('button');
  const titleEl = host.querySelector('.board-scope-title');
  const countEl = host.querySelector('.board-scope-count');
  host.addEventListener('click', (event) => {
    if (event.target.closest('[data-scope-action="timeline"]')) onTimeline();
    else if (event.target.closest('[data-scope-action="root"]')) onRoot();
  });
  function render(state) {
    host.hidden = !state;
    if (!state) return;
    projectEl.textContent = state.projectTitle;
    projectItem.hidden = !state.projectTitle;
    projectEl.title = t('boardScopeRoot');
    projectEl.setAttribute('aria-label', t('boardScopeRoot') + ': ' + state.projectTitle);
    titleEl.textContent = state.nodeTitle;
    titleEl.title = state.nodeTitle;
    countEl.textContent = t(state.count === 1 ? 'boardScopeCountOne' : 'boardScopeCount', {
      count: state.count,
    });
  }
  function focusCurrent() {
    titleEl.focus();
  }
  return { render, focusCurrent };
}
