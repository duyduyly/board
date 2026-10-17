import { escapeHTML as esc } from '../common/html.js';
import { t } from '../i18n/index.js';

export function quickHelpBody() {
  return (
    '<div class="quick-help-content"><p class="muted">' +
    esc(t('quickHelpIntro')) +
    '</p><dl>' +
    ['Select', 'Marquee', 'Pin', 'Edit', 'Navigate', 'Save']
      .map(
        (key) =>
          '<div><dt>' +
          esc(t('quickHelp' + key)) +
          '</dt><dd>' +
          esc(t('quickHelp' + key + 'Body')) +
          '</dd></div>',
      )
      .join('') +
    '</dl></div>'
  );
}
