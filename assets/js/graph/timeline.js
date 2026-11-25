import { cardDateValue } from './card-metadata.js';
import { effectiveStatus } from './card-status.js';

export const SCHEDULE = 'card-atlas:schedule';
export const TIMELINE = 'card-atlas:timeline';
const TIMELINE_VERSION = 1;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * @typedef {{ id: string, start: string, end: string | null, source: 'schedule' | 'card-date' }} TimelineEntry
 * @typedef {{ entries: TimelineEntry[], unscheduled: string[] }} TimelineModel
 */

/** True for a real calendar date written as YYYY-MM-DD (year 0000 is rejected). @param {unknown} value */
export function isCalendarDate(value) {
  const match = typeof value === 'string' ? DATE_PATTERN.exec(value) : null;
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < 1) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** @param {any} card @returns {{ start: string, end?: string } | null} */
export const cardSchedule = (card) => card?.extensions?.[SCHEDULE] || null;

/**
 * Validation issues of a card schedule; path is the card path used by the validator.
 * @param {any} card @param {string} path
 */
export function scheduleIssues(card, path) {
  const schedule = cardSchedule(card);
  if (!schedule) return [];
  const base = `${path}.extensions.${SCHEDULE}`;
  const errors = [];
  for (const key of /** @type {const} */ (['start', 'end'])) {
    if (schedule[key] !== undefined && !isCalendarDate(schedule[key]))
      errors.push({ path: `${base}.${key}`, code: 'format', params: { format: 'calendar date' } });
  }
  if (!errors.length && schedule.end !== undefined && schedule.end < schedule.start)
    errors.push({ path: `${base}.end`, code: 'scheduleOrder', params: {} });
  return errors;
}

/** @param {any} project */
export const hasTimeline = (project) => Boolean(project?.extensions?.[TIMELINE]);

/** Call only inside a store commit. Returns false when Timeline is already enabled. @param {any} project */
export function enableTimeline(project) {
  if (hasTimeline(project)) return false;
  project.extensions ||= {};
  project.extensions[TIMELINE] = { version: TIMELINE_VERSION };
  return true;
}

/** Call only inside a store commit. Returns false when Timeline is already off. @param {any} project */
export function disableTimeline(project) {
  if (!hasTimeline(project)) return false;
  delete project.extensions[TIMELINE];
  if (!Object.keys(project.extensions).length) delete project.extensions;
  return true;
}

/**
 * Sets or clears the explicit schedule; call only inside a store commit. Returns false when
 * unchanged so callers can skip the commit.
 * @param {any} card
 * @param {{ start: string, end?: string | null } | null} value
 * @returns {boolean}
 */
export function setSchedule(card, value) {
  if (value === null) {
    if (!cardSchedule(card)) return false;
    delete card.extensions[SCHEDULE];
    if (!Object.keys(card.extensions).length) delete card.extensions;
    return true;
  }
  const end = value.end || undefined;
  if (
    !isCalendarDate(value.start) ||
    (end !== undefined && !isCalendarDate(end)) ||
    (end !== undefined && end < value.start)
  )
    throw new Error('scheduleInvalid');
  const next =
    end === undefined || end === value.start ? { start: value.start } : { start: value.start, end };
  const current = cardSchedule(card);
  if (current && current.start === next.start && (current.end ?? null) === (next.end ?? null))
    return false;
  card.extensions ||= {};
  card.extensions[SCHEDULE] = next;
  return true;
}

/** @param {any} card @returns {TimelineEntry | null} */
function entryOf(card) {
  const schedule = cardSchedule(card);
  if (schedule)
    return { id: card.id, start: schedule.start, end: schedule.end ?? null, source: 'schedule' };
  const date = cardDateValue(card);
  return date ? { id: card.id, start: date, end: null, source: 'card-date' } : null;
}

/** @type {WeakMap<object, TimelineModel>} */
const modelCache = new WeakMap();

/**
 * Entries sorted by start, then end (a point before a range), then card order; cards without any
 * date go to `unscheduled`. Cached per committed snapshot; callers must not mutate the result.
 * @param {any} project @returns {TimelineModel}
 */
export function timelineEntries(project) {
  const cached = modelCache.get(project);
  if (cached) return cached;
  /** @type {{ entry: TimelineEntry, index: number }[]} */
  const dated = [];
  /** @type {string[]} */
  const unscheduled = [];
  (project.cards || []).forEach((/** @type {any} */ card, /** @type {number} */ index) => {
    const entry = entryOf(card);
    if (entry) dated.push({ entry, index });
    else unscheduled.push(card.id);
  });
  const compare = (/** @type {string} */ a, /** @type {string} */ b) =>
    a < b ? -1 : a > b ? 1 : 0;
  dated.sort(
    (a, b) =>
      compare(a.entry.start, b.entry.start) ||
      compare(a.entry.end ?? a.entry.start, b.entry.end ?? b.entry.start) ||
      a.index - b.index,
  );
  const model = { entries: dated.map((item) => item.entry), unscheduled };
  modelCache.set(project, model);
  return model;
}

/**
 * Keeps entries whose card has the given effective status; null keeps everything (same array).
 * @param {any} project @param {TimelineEntry[]} entries @param {string | null} status
 */
export function filterEntries(project, entries, status) {
  if (!status) return entries;
  const byId = new Map((project.cards || []).map((/** @type {any} */ card) => [card.id, card]));
  return entries.filter((entry) => effectiveStatus(byId.get(entry.id)) === status);
}

/** Local calendar date as YYYY-MM-DD. @param {Date} [date] */
export function todayKey(date = new Date()) {
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Index of the first entry that starts on or after today (entries.length when none). @param {TimelineEntry[]} entries @param {string} today */
export function todayIndex(entries, today) {
  const at = entries.findIndex((entry) => entry.start >= today);
  return at < 0 ? entries.length : at;
}
