import { escapeHTML as esc } from '../common/html.js';
import { t } from '../i18n/index.js';
import { appearance } from '../detail/appearance.js';
import { formatPropertyIcon } from './format-property-icons.js';
export function labelField(
  key,
  name,
  value,
  { textarea = false, color = false, options = null, icon = false } = {},
) {
  let control;
  if (options)
    control =
      '<select name="' +
      name +
      '">' +
      options
        .map(
          (o) =>
            '<option value="' +
            esc(o.value) +
            '"' +
            (o.value === value ? ' selected' : '') +
            '>' +
            esc(o.label) +
            '</option>',
        )
        .join('') +
      '</select>';
  else if (textarea) control = '<textarea name="' + name + '">' + esc(value) + '</textarea>';
  else
    control =
      '<input type="' +
      (color ? 'color' : 'text') +
      '" name="' +
      name +
      '" value="' +
      esc(value) +
      '">';
  const nameText = esc(t(key));
  return '<label' + (icon ? ' title="' + nameText + '"' : '') + '>' +
    (icon ? formatPropertyIcon(key) + '<span class="format-property-name">' + nameText + '</span>' : nameText) +
    control + '</label>';
}
export function cardColorField(card, key, { icon = false } = {}) {
  const flag = key === 'backgroundColor' ? 'backgroundTransparent' : 'borderTransparent';
  return (
    '<div>' +
    labelField(key, key, card.style[key], { color: true, icon }) +
    '<label class="color-hex-label">' + esc(t('hexColor')) +
    '<input type="text" data-hex-for="' + esc(key) + '" value="' + esc(card.style[key]) +
    '" pattern="#[0-9A-Fa-f]{6}" maxlength="7" required spellcheck="false"></label>' +
    (key === 'textColor'
      ? ''
      : '<label class="transparency-option"><input type="checkbox" name="appearance-' +
        flag +
        '"' +
        (appearance(card)[flag] ? ' checked' : '') +
        '>' +
        esc(t(flag)) +
        '</label>') +
    '</div>'
  );
}
