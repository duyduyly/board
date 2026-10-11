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
  const key = {
    syntax: 'errorSyntax',
    imageAttachment: 'errorImageAttachment',
    fileLimit: 'errorFileLimit',
    duplicateId: 'errorDuplicateId',
    missingEndpoint: 'errorMissingEndpoint',
    selfLoop: 'errorSelfLoop',
    duplicateRelation: 'errorDuplicateRelation',
    defaultAdded: 'errorDefaultAdded',
  }[issue.code];
  return key ? t(key) : t('errorSchema', { code: issue.code });
}
export function number(n) {
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US').format(n);
}
