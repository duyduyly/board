import { escapeHTML } from '../common/html.js';
import { t } from '../i18n/index.js';

const languages = [
  'plaintext',
  'java',
  'javascript',
  'typescript',
  'json',
  'xml',
  'css',
  'python',
  'sql',
  'bash',
];
export function createCodeControls() {
  const root = document.createElement('div');
  root.className = 'block-code-controls';
  root.hidden = true;
  const languageLabel = document.createElement('label');
  const languageCaption = document.createElement('span');
  const language = document.createElement('select');
  language.dataset.codeLanguage = '';
  for (const value of languages) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    language.append(option);
  }
  languageLabel.append(languageCaption, language);
  const textLabel = document.createElement('label');
  const textCaption = document.createElement('span');
  const text = document.createElement('textarea');
  text.dataset.codeText = '';
  text.spellcheck = false;
  text.rows = 8;
  text.addEventListener('mousedown', () => {
    window.setTimeout(() => text.focus(), 0);
  });
  textLabel.append(textCaption, text);
  root.append(languageLabel, textLabel);
  let component = null;
  language.onchange = () => {
    if (!component) return;
    const classes = component.getClasses().filter((name) => !/^language-/.test(name));
    component.setClass([...classes, 'language-' + language.value]);
  };
  text.oninput = () => {
    if (component) {
      component.components(escapeHTML(text.value));
      const element = component.getEl();
      if (element) element.textContent = text.value;
    }
  };
  return {
    root,
    select(selected) {
      component = selected;
      if (component?.get('tagName') === 'pre')
        component = component.components().find((child) => child.get('tagName') === 'code');
      if (component?.get('tagName') !== 'code') component = null;
      root.hidden = !component;
      if (!component) return;
      const current = component
        .getClasses()
        .find((name) => name.startsWith('language-'))
        ?.slice(9);
      language.value = languages.includes(current) ? current : 'plaintext';
      text.value = component.getEl()?.textContent || '';
    },
    clear() {
      component = null;
      root.hidden = true;
    },
    translate() {
      languageCaption.textContent = t('codeLanguage');
      textCaption.textContent = t('codeContent');
    },
  };
}
