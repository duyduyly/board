import { t } from '../i18n/index.js';
import { documentHeadings } from './writing.js';

// A heading counts as "being read" once it has scrolled up to this distance below the scroller top.
const ACTIVE_LINE = 96;

/**
 * Builds the reading outline for `root` inside `nav` and keeps the current section marked while
 * `scroller` scrolls. `root` may live in the same-origin viewer iframe.
 * @param {HTMLElement} nav
 * @param {HTMLElement} root
 * @param {HTMLElement} scroller
 * @returns {() => void} cleanup
 */
export function mountReadingContents(nav, root, scroller) {
  const headings = documentHeadings(root);
  nav.hidden = headings.length < 2;
  if (nav.hidden) return () => {};
  const frame = root.ownerDocument.defaultView?.frameElement || null;
  const controller = new window.AbortController();
  const title = document.createElement('strong');
  title.className = 'reading-contents-title';
  title.textContent = t('contents');
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'reading-contents-toggle';
  const label = document.createElement('span');
  label.textContent = t('contents');
  const current = document.createElement('span');
  current.className = 'reading-contents-current';
  toggle.append(label, current);
  const list = document.createElement('div');
  list.className = 'reading-contents-list';
  const setOpen = (open) => {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.onclick = () => setOpen(!nav.classList.contains('open'));
  const items = headings.map((h) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = h.textContent;
    button.className = 'heading-' + h.tagName.toLowerCase();
    button.onclick = () => {
      setOpen(false);
      h.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    };
    list.append(button);
    return button;
  });
  setOpen(false);
  nav.setAttribute('aria-label', t('contents'));
  nav.replaceChildren(title, toggle, list);

  let active = -1,
    pending = 0;
  const update = () => {
    pending = 0;
    const offset = frame ? frame.getBoundingClientRect().top : 0;
    const line = scroller.getBoundingClientRect().top + ACTIVE_LINE;
    let next = 0;
    for (let index = 1; index < headings.length; index++) {
      if (offset + headings[index].getBoundingClientRect().top > line) break;
      next = index;
    }
    if (next === active) return;
    items[active]?.classList.remove('active');
    items[active]?.removeAttribute('aria-current');
    active = next;
    items[active].classList.add('active');
    items[active].setAttribute('aria-current', 'location');
    current.textContent = headings[active].textContent;
  };
  scroller.addEventListener(
    'scroll',
    () => {
      pending ||= window.requestAnimationFrame(update);
    },
    { passive: true, signal: controller.signal },
  );
  update();
  return () => {
    controller.abort();
    window.cancelAnimationFrame(pending);
  };
}
