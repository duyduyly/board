import { labelIcon } from './editor-icons.js';
import { t } from '../i18n/index.js';
import { LESSON_SAMPLES, SAMPLES } from './editor-samples.js';

const GROUPS = [['libraryGroupLesson', LESSON_SAMPLES], ...SAMPLES];

/**
 * Library of ready-made elements for the visual editor. A tile inserts its element on click (or
 * Enter) and can be dragged onto the canvas; the editor owns both actions through its ports.
 * @param {{
 *   onInsert: (html: string) => void,
 *   onDragStart: (html: string) => void,
 *   onDragEnd: () => void,
 * }} ports
 */
export function createElementLibrary({ onInsert, onDragStart, onDragEnd }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.blockLabel = 'elementLibrary';
  button.setAttribute('aria-expanded', 'false');
  const root = document.createElement('section');
  root.className = 'block-editor-library';
  root.hidden = true;
  const setOpen = (open) => {
    root.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  };
  button.onclick = () => {
    setOpen(root.hidden);
    if (!root.hidden) root.querySelector('button')?.focus();
  };
  const render = () => {
    const heading = document.createElement('strong');
    heading.textContent = t('elementLibrary');
    const hint = document.createElement('p');
    hint.textContent = t('elementLibraryHint');
    root.replaceChildren(heading, hint);
    for (const [group, samples] of GROUPS) {
      const title = document.createElement('h4');
      title.textContent = t(group);
      const list = document.createElement('div');
      list.className = 'block-editor-library-items';
      for (const [key, html] of samples) {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.draggable = true;
        tile.dataset.libraryItem = key;
        tile.textContent = t(key);
        tile.onclick = () => onInsert(html);
        tile.ondragstart = (event) => {
          // Firefox starts a drag only when some data is set.
          event.dataTransfer.setData('text/plain', tile.textContent);
          event.dataTransfer.effectAllowed = 'copy';
          onDragStart(html);
        };
        tile.ondragend = () => onDragEnd();
        list.append(tile);
      }
      root.append(title, list);
    }
  };
  return {
    root,
    button,
    close: () => setOpen(false),
    translate() {
      labelIcon(button, 'elementLibrary');
      render();
    },
  };
}
