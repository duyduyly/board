import vi from './vi.js';
import en from './en.js';
export const dictionaries = { vi, en };
let locale = 'vi';
export function getLocale() {
  return locale;
}
export function setLocale(value) {
  locale = value === 'en' ? 'en' : 'vi';
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}
export function t(key, params = {}) {
  if (
    !Object.hasOwn(dictionaries[locale], key) &&
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname)
  )
    console.warn('[i18n] Missing key: ' + locale + ':' + key);
  const value = dictionaries[locale][key] ?? vi[key] ?? key;
  return value.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? '{' + name + '}'));
}
export function issueMessage(issue) {
  if (issue.code === 'syntax' && issue.line && issue.column)
    return t('errorSyntaxAt', { line: issue.line, column: issue.column });
  if (issue.code === 'const' && issue.params && 'allowedValue' in issue.params)
    return t('errorConst', { value: JSON.stringify(issue.params.allowedValue) });
  const key = {
    syntax: 'errorSyntax',
    mindMap: 'errorMindMap',
    imageAttachment: 'errorImageAttachment',
    appearance: 'errorAppearance',
    fileLimit: 'errorFileLimit',
    duplicateId: 'errorDuplicateId',
    missingEndpoint: 'errorMissingEndpoint',
    selfLoop: 'errorSelfLoop',
    duplicateRelation: 'errorDuplicateRelation',
    defaultAdded: 'errorDefaultAdded',
    scheduleOrder: 'errorScheduleOrder',
    ownerMissing: 'errorOwnerMissing',
    ownerNested: 'errorOwnerNested',
    ownerWithoutTimeline: 'errorOwnerWithoutTimeline',
    relationScope: 'errorRelationScope',
    groupScope: 'errorGroupScope',
    mindRootScope: 'errorMindRootScope',
  }[issue.code];
  return key ? t(key) : t('errorSchema', { code: issue.code });
}
const statusKeys = {
  new: 'statusNew',
  'in-progress': 'statusInProgress',
  done: 'statusDone',
  blocked: 'statusBlocked',
  cancelled: 'statusCancelled',
};
export function statusLabel(value) {
  return Object.hasOwn(statusKeys, value) ? t(statusKeys[value]) : value;
}
export function number(n) {
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US').format(n);
}
const dateTimeFormats = {};
export function dateTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  dateTimeFormats[locale] ??= new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return dateTimeFormats[locale].format(date);
}
const calendarFormats = {};
function calendarFormat() {
  return (calendarFormats[locale] ??= new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }));
}
function calendarTime(ymd) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? '');
  if (!match) return null;
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(time) ? null : time;
}
// Calendar dates carry no time zone: format the UTC instant built from y-m-d so the day never shifts.
export function calendarDate(ymd) {
  const time = calendarTime(ymd);
  return time === null ? ymd : calendarFormat().format(time);
}
export function dateRange(start, end = null) {
  if (end === null || end === undefined) return calendarDate(start);
  const from = calendarTime(start);
  const to = calendarTime(end);
  const joined = calendarDate(start) + ' – ' + calendarDate(end);
  if (from === null || to === null) return joined;
  const format = calendarFormat();
  return typeof format.formatRange === 'function' ? format.formatRange(from, to) : joined;
}
