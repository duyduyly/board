import { escapeHTML as esc } from '../common/html.js';
import { t } from '../i18n/index.js';
import { appearance } from '../detail/appearance.js';
export function labelField(
  key,
  name,
  value,
  { textarea = false, color = false, options = null } = {},
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
  return '<label>' + esc(t(key)) + control + '</label>';
}
export function cardColorField(card, key) {
  const flag = key === 'backgroundColor' ? 'backgroundTransparent' : 'borderTransparent';
  return (
    '<div>' +
    labelField(key, key, card.style[key], { color: true }) +
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
