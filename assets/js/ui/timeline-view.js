import { effectiveStatus } from '../graph/card-status.js';
import { filterEntries, timelineEntries, todayIndex, todayKey } from '../graph/timeline.js';
import { calendarDate, dateRange, getLocale, statusLabel, t } from '../i18n/index.js';

const ACTION_SELECTOR = '[data-timeline-action]';
const TITLE_SELECTOR = '.timeline-title';
const PART_ACTION = { title: 'open', date: 'schedule', status: 'status' };

/** @param {string} tag @param {string} [className] @param {string} [text] */
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** @param {string} action @param {string} label @param {string} [className] */
function actionButton(action, label, className) {
  const button = /** @type {HTMLButtonElement} */ (node('button', className, label));
  button.type = 'button';
  button.dataset.timelineAction = action;
  return button;
}

/** @param {unknown} selection @returns {Set<string>} */
function selectedIds(selection) {
  if (!selection) return new Set();
  if (typeof selection === 'string') return new Set([selection]);
  if (selection instanceof Set || Array.isArray(selection)) return new Set(selection);
  return new Set();
}

/**
 * Timeline surface (HTML overlay in `section#timeline-view`). Reads committed snapshots only and
 * reports user intent through ports; one delegated listener per event type, no per-entry listeners.
 * @param {{
 *   host: HTMLElement,
 *   onOpen: (id: string) => void,
 *   onStatus: (id: string, anchor: HTMLElement) => void,
 *   onSchedule: (id: string, anchor: HTMLElement) => void,
 *   onReveal: (id: string) => void,
 *   onBoard: () => void,
 *   isPinned: (id: string) => boolean,
 * }} ports
 */
export function createTimelineView({
  host,
  onOpen,
  onStatus,
  onSchedule,
  onReveal,
  onBoard,
  isPinned,
}) {
  const filterSelect = /** @type {HTMLSelectElement} */ (
    host.querySelector('#timeline-status-filter')
  );
  const countEl = /** @type {HTMLElement} */ (host.querySelector('.timeline-count'));
  const scrollEl = /** @type {HTMLElement} */ (host.querySelector('.timeline-scroll'));
  const trackEl = /** @type {HTMLElement} */ (host.querySelector('.timeline-track'));
  const unscheduledEl = /** @type {HTMLDetailsElement} */ (
    host.querySelector('.timeline-unscheduled')
  );
  const unscheduledSummary = /** @type {HTMLElement} */ (unscheduledEl.querySelector('summary'));
  const unscheduledList = /** @type {HTMLElement} */ (unscheduledEl.querySelector('ul'));
  const emptyEl = /** @type {HTMLElement} */ (host.querySelector('.timeline-empty'));

  let filter = '';
  let current = { project: null, selection: null, revealLabel: '' };
  /** @type {{ project: any, locale: string, filter: string, revealLabel: string } | null} */
  let built = null;
  /** @type {Map<string, HTMLElement>} */
  let entryEls = new Map();
  /** @type {Set<string>} */
  let painted = new Set();
  /** @type {HTMLElement | null} */
  let todayEl = null;

  function buildEntry(card, entry, side, revealLabel) {
    const status = effectiveStatus(card);
    const pinned = isPinned(card.id);
    const range = dateRange(entry.start, entry.end);
    const li = node('li', 'timeline-entry');
    li.dataset.cardId = card.id;
    li.dataset.cardStatus = status;
    li.dataset.side = side;
    li.dataset.dateSource = entry.source;

    const date = actionButton('schedule', range, 'timeline-date');
    if (entry.source === 'card-date')
      date.append(node('span', 'timeline-date-source', t('cardDate')));
    date.setAttribute('aria-label', t('scheduleEditFor', { range }));
    if (pinned) date.setAttribute('aria-disabled', 'true');

    const title = node('h3');
    title.append(actionButton('open', card.title, 'timeline-title'));

    const chip = actionButton('status', '', 'timeline-status-chip');
    const label = statusLabel(status);
    chip.append(node('span', 'card-status-text', label));
    chip.setAttribute('aria-label', t('statusChangeFor', { status: label }));
    if (pinned) chip.setAttribute('aria-disabled', 'true');

    const footer = node('footer', 'timeline-card-footer');
    const revealText = t('timelineOpenOn', { view: revealLabel });
    const revealButton = actionButton('reveal', revealText, 'timeline-reveal');
    revealButton.title = revealText;
    footer.append(chip, revealButton);

    const article = node('article', 'timeline-card');
    article.append(date, title, node('p', 'timeline-summary', card.summary || ''), footer);
    li.append(node('span', 'timeline-marker'), article);
    return li;
  }

  function buildUnscheduled(card) {
    const li = node('li');
    li.dataset.cardId = card.id;
    const date = actionButton('schedule', t('timelineSetDate'));
    if (isPinned(card.id)) date.setAttribute('aria-disabled', 'true');
    li.append(actionButton('open', card.title, 'timeline-title'), date);
    return li;
  }

  function rebuild() {
    const { project, revealLabel } = current;
    const keepScroll = scrollEl.scrollLeft;
    entryEls = new Map();
    painted = new Set();
    todayEl = null;
    filterSelect.value = filter;
    const model = timelineEntries(project);
    const entries = filterEntries(project, model.entries, filter || null);
    const cards = new Map((project.cards || []).map((card) => [card.id, card]));
    const unscheduled = filter
      ? model.unscheduled.filter((id) => effectiveStatus(cards.get(id)) === filter)
      : model.unscheduled;

    const items = entries.map((entry, index) => {
      const li = buildEntry(cards.get(entry.id), entry, index % 2 ? 'below' : 'above', revealLabel);
      entryEls.set(entry.id, li);
      return li;
    });
    if (items.length) {
      todayEl = node('li', 'timeline-today');
      todayEl.setAttribute('aria-label', `${t('timelineToday')}: ${calendarDate(todayKey())}`);
      items.splice(todayIndex(entries, todayKey()), 0, todayEl);
    }
    trackEl.replaceChildren(...items);

    unscheduledList.replaceChildren(...unscheduled.map((id) => buildUnscheduled(cards.get(id))));
    unscheduledEl.hidden = !unscheduled.length;
    unscheduledSummary.textContent = t('timelineUnscheduled', { count: unscheduled.length });
    if (!model.entries.length && unscheduled.length) unscheduledEl.open = true;

    countEl.textContent = t('timelineCount', { count: entries.length });
    renderEmpty(model.entries.length, entries.length, unscheduled.length, cards.size);
    scrollEl.scrollLeft = keepScroll;
  }

  function renderEmpty(total, shown, unscheduledShown, cardCount) {
    emptyEl.hidden = shown > 0;
    if (shown > 0) return emptyEl.replaceChildren();
    if (total)
      return emptyEl.replaceChildren(
        node('p', '', t('timelineFilterEmpty')),
        actionButton('clear-filter', t('timelineClearFilter')),
      );
    if (unscheduledShown)
      return emptyEl.replaceChildren(
        node('p', '', t('timelineAllUnscheduled', { count: unscheduledShown })),
      );
    emptyEl.replaceChildren(
      node('p', '', t(cardCount ? 'timelineFilterEmpty' : 'timelineEmpty')),
      cardCount
        ? actionButton('clear-filter', t('timelineClearFilter'))
        : actionButton('board', t('timelineOpenBoard')),
    );
  }

  // Scrolls only the strip: scrollIntoView would also move ancestors such as the canvas region.
  /** @param {HTMLElement | null} el */
  function centerInStrip(el) {
    if (!el) return;
    const box = el.getBoundingClientRect();
    const strip = scrollEl.getBoundingClientRect();
    scrollEl.scrollLeft += box.left + box.width / 2 - (strip.left + strip.width / 2);
  }

  function paintSelection() {
    const next = selectedIds(current.selection);
    for (const id of painted) if (!next.has(id)) entryEls.get(id)?.classList.remove('selected');
    for (const id of next) {
      const el = entryEls.get(id);
      if (el) el.classList.add('selected');
    }
    painted = new Set([...next].filter((id) => entryEls.has(id)));
  }

  function render({ project, selection, revealLabel }) {
    current = { project, selection, revealLabel };
    const locale = getLocale();
    const same =
      built &&
      built.project === project &&
      built.locale === locale &&
      built.filter === filter &&
      built.revealLabel === revealLabel;
    if (!same) {
      rebuild();
      built = { project, locale, filter, revealLabel };
    }
    paintSelection();
  }

  function setFilter(value) {
    filter = value;
    if (current.project) render(current);
    else filterSelect.value = filter;
  }

  /** @param {string} id @param {string} part */
  function element(id, part) {
    const action = PART_ACTION[part];
    const owner = [...host.querySelectorAll('[data-card-id]')].find(
      (el) => el.dataset.cardId === id,
    );
    const button = action
      ? owner?.querySelector(`[data-timeline-action="${action}"]`) || null
      : null;
    // A button inside the closed list cannot take focus.
    if (button && unscheduledEl.contains(button)) unscheduledEl.open = true;
    return button;
  }

  function reveal(id) {
    if (!current.project) return;
    if (filter && !entryEls.has(id) && !timelineEntries(current.project).unscheduled.includes(id))
      setFilter('');
    const el = entryEls.get(id);
    centerInStrip(el);
    /** @type {HTMLElement | null} */ (element(id, 'title'))?.focus({ preventScroll: true });
  }

  function reset() {
    if (filter) setFilter('');
    scrollEl.scrollLeft = 0;
  }

  function scrollToToday() {
    centerInStrip(todayEl);
  }

  host.addEventListener('click', (event) => {
    const button = /** @type {HTMLElement | null} */ (event.target)?.closest?.(ACTION_SELECTOR);
    if (!button || !host.contains(button)) return;
    const action = button.dataset.timelineAction;
    const id = /** @type {HTMLElement | null} */ (button.closest('[data-card-id]'))?.dataset.cardId;
    if (action === 'today') scrollToToday();
    else if (action === 'start') scrollEl.scrollLeft = 0;
    else if (action === 'end') scrollEl.scrollLeft = scrollEl.scrollWidth;
    else if (action === 'board') onBoard();
    else if (action === 'clear-filter') setFilter('');
    else if (id && action === 'open') onOpen(id);
    else if (id && action === 'status') onStatus(id, button);
    else if (id && action === 'schedule') onSchedule(id, button);
    else if (id && action === 'reveal') onReveal(id);
  });

  host.addEventListener('change', (event) => {
    if (event.target === filterSelect) setFilter(filterSelect.value);
  });

  host.addEventListener('keydown', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (!target.matches?.(TITLE_SELECTOR) || !trackEl.contains(target)) return;
    const titles = [...trackEl.querySelectorAll(TITLE_SELECTOR)];
    const at = titles.indexOf(target);
    const next = {
      ArrowLeft: at - 1,
      ArrowRight: at + 1,
      Home: 0,
      End: titles.length - 1,
    }[event.key];
    if (next === undefined || !titles[next]) return;
    event.preventDefault();
    /** @type {HTMLElement} */ (titles[next]).focus();
  });

  // Passive:false only so a vertical wheel can drive the horizontal strip when it overflows.
  scrollEl.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (scrollEl.scrollWidth <= scrollEl.clientWidth) return;
      event.preventDefault();
      scrollEl.scrollLeft += event.deltaY;
    },
    { passive: false },
  );

  return { render, reveal, element, reset };
}
