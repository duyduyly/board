import { t } from '../i18n/index.js';
export function createTemplateGallery({ host, onOpen, onError }) {
  let catalog = null,
    category = 'all',
    loading = false;
  async function load() {
    if (loading || catalog) return;
    loading = true;
    render();
    try {
      const response = await fetch('assets/data/template-catalog.json');
      if (!response.ok) throw Error('catalog');
      const data = await response.json();
      if (
        !Array.isArray(data) ||
        data.some(
          (x) =>
            !['personal', 'learning', 'work', 'project'].includes(x.category) ||
            !/^assets\//.test(x.path) ||
            !/^assets\//.test(x.preview),
        )
      )
        throw Error('catalog');
      catalog = data;
    } catch {
      onError();
    } finally {
      loading = false;
      render();
    }
  }
  function render() {
    host.replaceChildren();
    const title = document.createElement('h1');
    title.textContent = t('galleryTitle');
    const intro = document.createElement('p');
    intro.className = 'gallery-intro';
    intro.textContent = t('galleryIntro');
    const nav = document.createElement('nav');
    nav.className = 'gallery-categories';
    nav.setAttribute('aria-label', t('templateCategories'));
    for (const key of ['all', 'personal', 'learning', 'work', 'project']) {
      const button = document.createElement('button');
      button.textContent = t('category' + key);
      button.dataset.category = key;
      button.setAttribute('aria-pressed', String(category === key));
      button.onclick = () => {
        category = key;
        render();
        host.querySelector('[data-category="' + key + '"]').focus();
      };
      nav.append(button);
    }
    const grid = document.createElement('div');
    grid.className = 'template-grid';
    grid.setAttribute('aria-busy', String(loading));
    for (const item of (catalog || []).filter(
      (x) => category === 'all' || x.category === category,
    )) {
      const button = document.createElement('button');
      button.className = 'template-tile';
      button.dataset.template = item.id;
      const action = { architecture: 'example', english: 'english-example', mind: 'mind-example' }[
        item.id
      ];
      if (action) button.dataset.action = action;
      const image = document.createElement('img');
      image.src = item.preview;
      image.alt = '';
      image.width = 400;
      image.height = 300;
      const label = document.createElement('span');
      label.textContent = t(item.titleKey);
      button.append(image, label);
      button.onclick = (event) => {
        event.stopPropagation();
        onOpen(item.path);
      };
      grid.append(button);
    }
    if (loading)
      for (let i = 0; i < 6; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'template-skeleton';
        grid.append(skeleton);
      }
    if (!loading && !grid.children.length) {
      const empty = document.createElement('p');
      empty.textContent = t(catalog ? 'noTemplates' : 'errorRead');
      grid.append(empty);
      if (!catalog) {
        const retry = document.createElement('button');
        retry.textContent = t('retry');
        retry.onclick = load;
        grid.append(retry);
      }
    }
    host.append(title, intro, nav, grid);
  }
  return { render, load };
}
