import { escapeHTML as esc } from '../common/html.js';
import { t } from '../i18n/index.js';

// Grouped by where the action happens, so a long list stays easy to scan.
const SECTIONS = [
  ['Canvas', ['Select', 'Marquee', 'Copy', 'Pin', 'Navigate', 'MindLinks']],
  ['Groups', ['Groups', 'GroupNest', 'GroupLinks']],
  ['Documents', ['Edit', 'Write', 'Library', 'Code', 'Reading']],
  ['Save', ['Save', 'WordExport']],
];

export function quickHelpBody() {
  return (
    '<div class="quick-help-content"><p class="muted">' +
    esc(t('quickHelpIntro')) +
    '</p>' +
    SECTIONS.map(
      ([section, keys]) =>
        '<section><h3>' +
        esc(t('quickHelpSection' + section)) +
        '</h3><dl>' +
        keys
          .map(
            (key) =>
              '<div><dt>' +
              esc(t('quickHelp' + key)) +
              '</dt><dd>' +
              esc(t('quickHelp' + key + 'Body')) +
              '</dd></div>',
          )
          .join('') +
        '</dl></section>',
    ).join('') +
    '</div>'
  );
}
