import { t, number, getLocale } from '../i18n/index.js';
import { search, searchExcerpt } from '../store/project-store.js';
import { projectIndex } from '../graph/project-index.js';
export function createCardList({ host, onSelect }) {
  let listProject = null,
    listQuery = null,
    listLocale = null,
    listSelection = null;
  function renderList({ project, query, selection }) {
    if (listProject === project && listQuery === query && listLocale === getLocale()) {
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
    listProject = project;
    listQuery = query;
    listLocale = getLocale();
    listSelection = selection?.kind === 'card' ? selection.id : null;
    const { degrees } = projectIndex(project);
    host.replaceChildren();
    const cards = search(project.cards, query);
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
        await onSelect(c.id);
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
  return renderList;
}
