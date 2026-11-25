import { ownedCounts } from '../graph/card-scope.js';
import { effectiveStatus } from '../graph/card-status.js';
import {
  filterEntries,
  timelineEntries,
  timelineInfo,
  todayIndex,
  todayKey,
} from '../graph/timeline.js';
import { calendarDate, dateRange, getLocale, statusLabel, t } from '../i18n/index.js';

const TIMELINE_CREAM = '#FFF5D6';

// Movement before a press on the empty strip becomes a drag, so plain clicks stay clicks.
const DRAG_THRESHOLD = 4;
const DRAG_IGNORE = 'button, a, input, select, textarea, summary, .timeline-card';

const ACTION_SELECTOR = '[data-timeline-action]';
const TITLE_SELECTOR = '.timeline-title';
// Parts a caller can focus again after an editor closes (see `element`).
const PART_SELECTOR = {
  title: '[data-timeline-action="edit"][data-timeline-field="title"]',
  summary: '[data-timeline-action="edit"][data-timeline-field="summary"]',
  date: '[data-timeline-action="schedule"]',
  status: '[data-timeline-action="status"]',
  open: '[data-timeline-action="open"]',
  color: '[data-timeline-action="color"]',
  board: '[data-timeline-action="board-open"]',
};

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

/**
 * Primary footer action: opens the node's own board; the count says how many notes it holds.
 * @param {string} title @param {number} count
 */
function boardButton(title, count) {
  const button = actionButton('board-open', '', 'timeline-board');
  button.dataset.count = String(count);
  button.append(
    node('span', 'timeline-board-label', t('timelineBoardOpen')),
    node(
      'span',
      'timeline-board-count',
      count
        ? t(count === 1 ? 'timelineBoardCountOne' : 'timelineBoardCount', { count })
        : t('timelineBoardEmpty'),
    ),
  );
  const label = t(count === 1 ? 'timelineBoardOpenForOne' : 'timelineBoardOpenFor', {
    title,
    count,
  });
  button.title = label;
  button.setAttribute('aria-label', label);
  return button;
}

/**
 * Text field that opens the shared overview editor (same affordance as a note on the canvas).
 * @param {string} field @param {string} text @param {string} className @param {boolean} pinned
 */
function editButton(field, text, className, pinned) {
  const button = actionButton('edit', text, className);
  button.dataset.timelineField = field;
  button.setAttribute(
    'aria-label',
    pinned ? t('pinnedReadOnly') : t('editOverviewField', { field: t(field), value: text }),
  );
  if (pinned) button.setAttribute('aria-disabled', 'true');
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
 *   onEdit: (id: string, anchor: HTMLElement, field: string) => void,
 *   onStatus: (id: string, anchor: HTMLElement) => void,
 *   onSchedule: (id: string, anchor: HTMLElement) => void,
 *   onColor: (id: string, anchor: HTMLElement) => void,
 *   onInfo: (field: string, anchor: HTMLElement) => void,
 *   onOpenBoard: (id: string) => void,
 *   onBoard: () => void,
 *   onOverview: () => void,
 *   onAddNote: () => void,
 *   isPinned: (id: string) => boolean,
 * }} ports
 */
export function createTimelineView({
  host,
  onOpen,
  onEdit,
  onStatus,
  onSchedule,
  onColor,
  onInfo,
  onOpenBoard,
  onBoard,
  onOverview,
  onAddNote,
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
  const infoButtons = {
    title: /** @type {HTMLElement} */ (host.querySelector('.timeline-intro-title')),
    description: /** @type {HTMLElement} */ (host.querySelector('.timeline-intro-description')),
  };
  const overviewButton = /** @type {HTMLElement | null} */ (
    host.querySelector('.timeline-overview')
  );

  let filter = '';
  let current = { project: null, selection: null };
  /** @type {{ project: any, locale: string, filter: string } | null} */
  let built = null;
  /** @type {Map<string, HTMLElement>} */
  let entryEls = new Map();
  /** @type {Set<string>} */
  let painted = new Set();
  /** @type {HTMLElement | null} */
  let todayEl = null;

  function buildEntry(card, entry, side, counts) {
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
    const openButton = actionButton('open', '', 'timeline-open');
    const openText = `${t('openDetail')}: ${card.title}`;
    openButton.title = openText;
    openButton.setAttribute('aria-label', openText);
    const colorButton = actionButton('color', '', 'timeline-color');
    const colorText = t(pinned ? 'quickColorPinnedHint' : 'quickColor');
    colorButton.title = colorText;
    colorButton.setAttribute('aria-label', t('quickColor'));
    colorButton.setAttribute('aria-haspopup', 'menu');
    if (pinned) colorButton.setAttribute('aria-disabled', 'true');
    title.append(
      editButton('title', card.title, 'timeline-title', pinned),
      colorButton,
      openButton,
    );

    const chip = actionButton('status', '', 'timeline-status-chip');
    const label = statusLabel(status);
    chip.append(node('span', 'card-status-text', label));
    chip.setAttribute('aria-label', t('statusChangeFor', { status: label }));
    if (pinned) chip.setAttribute('aria-disabled', 'true');

    const footer = node('footer', 'timeline-card-footer');
    footer.append(chip, boardButton(card.title, counts.get(card.id) || 0));

    const article = node('article', 'timeline-card');
    // Same appearance variables as the canvas card, so the note keeps its own colours.
    const { backgroundColor, textColor, borderColor } = card.style || {};
    // The default yellow note paper reads as a softer cream on the Timeline; other colours stay.
    const paper = /^#fff2b0$/i.test(backgroundColor || '') ? TIMELINE_CREAM : backgroundColor;
    if (paper) article.style.setProperty('--card-background', paper);
    if (textColor) article.style.setProperty('--card-ink', textColor);
    if (borderColor) article.style.setProperty('--card-border', borderColor);
    // An empty summary keeps a clickable (placeholder) target so it can still be written here.
    const summary = node('p', 'timeline-summary');
    summary.append(
      editButton(
        'summary',
        card.summary || t('timelineSummaryEmpty'),
        'timeline-summary-edit',
        pinned,
      ),
    );
    if (!card.summary) summary.classList.add('is-empty');
    article.append(title, date, summary, footer);
    li.append(node('span', 'timeline-marker'), article);
    return li;
  }

  function buildUnscheduled(card, counts) {
    const li = node('li');
    li.dataset.cardId = card.id;
    const date = actionButton('schedule', '', 'timeline-schedule-icon');
    date.title = t('timelineSetDate');
    date.setAttribute('aria-label', t('timelineSetDate'));
    if (isPinned(card.id)) date.setAttribute('aria-disabled', 'true');
    li.append(
      editButton('title', card.title, 'timeline-title', isPinned(card.id)),
      boardButton(card.title, counts.get(card.id) || 0),
      date,
    );
    return li;
  }

  // The Timeline's own title and purpose; user content, so only the empty prompts are translated.
  function renderInfo(project) {
    const info = timelineInfo(project);
    for (const field of /** @type {const} */ (['title', 'description'])) {
      const button = infoButtons[field];
      const value = info[field];
      button.textContent =
        value || t(field === 'title' ? 'timelineInfoTitleEmpty' : 'timelineInfoDescriptionEmpty');
      button.classList.toggle('is-empty', !value);
      button.title = value;
      button.setAttribute(
        'aria-label',
        t(field === 'title' ? 'timelineInfoEditTitleAria' : 'timelineInfoEditDescriptionAria', {
          value,
        }),
      );
    }
  }

  function rebuild() {
    const { project } = current;
    renderInfo(project);
    const keepScroll = scrollEl.scrollLeft;
    entryEls = new Map();
    painted = new Set();
    todayEl = null;
    filterSelect.value = filter;
    const model = timelineEntries(project);
    const counts = ownedCounts(project);
    const entries = filterEntries(project, model.entries, filter || null);
    const cards = new Map((project.cards || []).map((card) => [card.id, card]));
    const unscheduled = filter
      ? model.unscheduled.filter((id) => effectiveStatus(cards.get(id)) === filter)
      : model.unscheduled;

    const items = entries.map((entry, index) => {
      const li = buildEntry(cards.get(entry.id), entry, index % 2 ? 'below' : 'above', counts);
      entryEls.set(entry.id, li);
      return li;
    });
    if (items.length) {
      todayEl = node('li', 'timeline-today');
      todayEl.setAttribute('aria-label', `${t('timelineToday')}: ${calendarDate(todayKey())}`);
      todayEl.dataset.label = t('timelineToday');
      items.splice(todayIndex(entries, todayKey()), 0, todayEl);
    }
    trackEl.replaceChildren(...items);

    unscheduledList.replaceChildren(
      ...unscheduled.map((id) => buildUnscheduled(cards.get(id), counts)),
    );
    unscheduledEl.hidden = !unscheduled.length;
    unscheduledSummary.textContent = t('timelineUnscheduled', { count: unscheduled.length });
    if (!model.entries.length && unscheduled.length) unscheduledEl.open = true;

    countEl.textContent = t('timelineCount', { count: entries.length });
    renderEmpty(model.entries.length, entries.length, unscheduled.length, cards.size);
    scrollEl.scrollLeft = keepScroll;
    if (overviewButton) overviewButton.hidden = !cards.size;
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
        : actionButton('add-note', t('timelineAddNote'), 'timeline-add'),
      ...(cardCount ? [] : [actionButton('board', t('timelineOpenBoard'))]),
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

  function render({ project, selection }) {
    current = { project, selection };
    const locale = getLocale();
    const same =
      built && built.project === project && built.locale === locale && built.filter === filter;
    if (!same) {
      rebuild();
      built = { project, locale, filter };
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
    const selector = PART_SELECTOR[part];
    const owner = [...host.querySelectorAll('[data-card-id]')].find(
      (el) => el.dataset.cardId === id,
    );
    const button = selector ? owner?.querySelector(selector) || null : null;
    // A button inside the closed list cannot take focus.
    if (button && unscheduledEl.contains(button)) unscheduledEl.open = true;
    return button;
  }

  /** @param {string} field */
  const infoElement = (field) => infoButtons[field] || null;

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
    else if (action === 'info') onInfo(button.dataset.timelineField || 'title', button);
    else if (action === 'board') onBoard();
    else if (action === 'overview') onOverview();
    else if (action === 'add-note') onAddNote();
    else if (action === 'clear-filter') setFilter('');
    else if (id && action === 'open') onOpen(id);
    else if (id && action === 'edit') onEdit(id, button, button.dataset.timelineField || 'title');
    else if (id && action === 'status') onStatus(id, button);
    else if (id && action === 'schedule') onSchedule(id, button);
    else if (id && action === 'color') onColor(id, button);
    else if (id && action === 'board-open') onOpenBoard(id);
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

  // Press-and-drag on the empty strip scrolls it; the preview is only scrollLeft (nothing committed).
  /** @type {{ id: number, x: number, left: number, active: boolean } | null} */
  let drag = null;
  function endDrag() {
    if (!drag) return;
    if (scrollEl.hasPointerCapture(drag.id)) scrollEl.releasePointerCapture(drag.id);
    scrollEl.classList.remove('is-dragging');
    drag = null;
  }
  scrollEl.addEventListener('pointerdown', (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (event.button !== 0 || target.closest(DRAG_IGNORE) || drag) return;
    if (scrollEl.scrollWidth <= scrollEl.clientWidth) return;
    drag = { id: event.pointerId, x: event.clientX, left: scrollEl.scrollLeft, active: false };
  });
  scrollEl.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    if (!drag.active) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      drag.active = true;
      scrollEl.setPointerCapture(drag.id);
      scrollEl.classList.add('is-dragging');
    }
    scrollEl.scrollLeft = drag.left - dx;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    scrollEl.addEventListener(type, endDrag);
  window.addEventListener('blur', endDrag);
  host.addEventListener('keydown', (event) => event.key === 'Escape' && endDrag());

  const context = () => ({ scrollLeft: scrollEl.scrollLeft });
  const restore = ({ scrollLeft }) => {
    scrollEl.scrollLeft = scrollLeft;
  };

  return { render, reveal, element, infoElement, reset, context, restore };
}
