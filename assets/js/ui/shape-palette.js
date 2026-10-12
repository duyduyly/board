import { shapes, shapePoints } from '../graph/shape-registry.js';
import { t, getLocale } from '../i18n/index.js';
import { escapeHTML as esc } from '../common/html.js';
export function createShapePalette({ host, region, onCreate, locked }) {
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'image/png,image/jpeg,image/webp,image/gif';
  file.hidden = true;
  host.after(file);
  let pending = null,
    renderedLocale = null,
    renderedLocked = null;
  const create = (option, point) => {
    if (locked()) return;
    if (['image', 'image-text'].includes(option.kind)) {
      pending = { option, point };
      file.click();
    } else onCreate(option, point);
  };
  file.onchange = () => {
    const chosen = file.files[0];
    file.value = '';
    const ctx = pending;
    pending = null;
    if (ctx && chosen && !locked()) onCreate(ctx.option, ctx.point, chosen);
  };
  region.addEventListener('dragover', (e) => {
    if ([...e.dataTransfer.types].includes('application/x-card-atlas-node') && !locked()) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  });
  region.addEventListener('drop', (e) => {
    const value = e.dataTransfer.getData('application/x-card-atlas-node');
    if (!value || locked()) return;
    e.preventDefault();
    try {
      const option = JSON.parse(value);
      if (
        ['card', 'text', 'image', 'image-text'].includes(option.kind) &&
        (!option.shape || Object.hasOwn(shapes, option.shape))
      )
        create(
          { kind: option.kind, ...(option.shape ? { shape: option.shape } : {}) },
          { x: e.clientX, y: e.clientY },
        );
    } catch {
      /* Ignore unrelated drag payloads. */
    }
  });
  function render() {
    const locale = getLocale(),
      disabled = locked();
    if (renderedLocale === locale) {
      if (renderedLocked !== disabled)
        for (const button of host.querySelectorAll('button')) button.disabled = disabled;
      renderedLocked = disabled;
      return;
    }
    renderedLocale = locale;
    renderedLocked = disabled;
    host.innerHTML =
      '<h2>' +
      esc(t('nodeLibrary')) +
      '</h2><p class="library-hint">' +
      esc(t('libraryHint')) +
      '</p><h3>' +
      esc(t('kindGroup')) +
      '</h3><div class="kind-palette"></div><h3>' +
      esc(t('shapeGroup')) +
      '</h3><div class="shape-palette"></div>';
    for (const [kind, key] of [
      ['card', 'kindCard'],
      ['text', 'kindText'],
      ['image', 'kindImage'],
      ['image-text', 'kindImageText'],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.paletteKind = kind;
      button.textContent = t(key);
      wire(button, { kind });
      host.querySelector('.kind-palette').append(button);
    }
    for (const shape of Object.keys(shapes)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.paletteShape = shape;
      button.innerHTML =
        '<svg viewBox="-2 -2 52 44" aria-hidden="true"><polygon points="' +
        shapePoints(shape, { width: 48, height: 40 }, 6)
          .map((p) => p.x + ',' + p.y)
          .join(' ') +
        '"/></svg><span>' +
        esc(t(shape)) +
        '</span>';
      wire(button, { shape, kind: 'text' });
      host.querySelector('.shape-palette').append(button);
    }
  }
  function wire(button, option) {
    button.disabled = locked();
    button.draggable = true;
    button.onclick = () => create(option, null);
    button.ondragstart = (e) => {
      if (locked()) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData('application/x-card-atlas-node', JSON.stringify(option));
      e.dataTransfer.effectAllowed = 'copy';
    };
  }
  return { render };
}
