import { t } from '../i18n/index.js';

// Preserve legacy text as inert source until it is converted offline.
export function renderLegacySource(host, source) {
  const notice = document.createElement('p');
  notice.className = 'legacy-source-notice';
  notice.textContent = t('legacySourceNotice');
  const pre = document.createElement('pre');
  pre.className = 'legacy-source-text';
  pre.textContent = source || '';
  host.replaceChildren(notice, pre);
}
