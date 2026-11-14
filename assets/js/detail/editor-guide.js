import { labelIcon } from './editor-icons.js';
import { t } from '../i18n/index.js';
import { SAMPLES } from './editor-samples.js';

// Generated from docs/board-html-prompt.md by `npm run sync:prompt`; the app only reads assets/.
const PROMPT_URL = new URL('../../data/board-html-prompt.md', import.meta.url);

/**
 * Editor help: a button that copies the AI prompt and a panel of HTML/CSS samples.
 * @param {{ onInsert: (html: string) => void }} ports insert goes through the import review
 */
export function createEditorGuide({ onInsert }) {
  const promptButton = document.createElement('button');
  promptButton.type = 'button';
  promptButton.dataset.blockLabel = 'aiPromptCopy';
  const samplesButton = document.createElement('button');
  samplesButton.type = 'button';
  samplesButton.dataset.blockLabel = 'htmlSamplesTitle';
  samplesButton.setAttribute('aria-expanded', 'false');

  const root = document.createElement('section');
  root.className = 'block-editor-guide';
  const status = document.createElement('p');
  status.className = 'block-editor-guide-status';
  status.setAttribute('role', 'status');
  // Shown only when the clipboard is unavailable, so the prompt can still be copied by hand.
  const fallback = document.createElement('textarea');
  fallback.readOnly = true;
  fallback.rows = 6;
  fallback.hidden = true;
  fallback.dataset.promptFallback = '';
  const panel = document.createElement('div');
  panel.className = 'block-editor-samples';
  panel.hidden = true;
  root.append(status, fallback, panel);

  let prompt = null;
  let statusKey = '';
  const say = (key) => {
    statusKey = key;
    status.textContent = key ? t(key) : '';
  };
  const copy = async (text, done) => {
    try {
      await navigator.clipboard.writeText(text);
      say(done);
      return true;
    } catch {
      return false;
    }
  };
  promptButton.onclick = async () => {
    fallback.hidden = true;
    try {
      prompt ??= fetch(PROMPT_URL).then((response) => {
        if (!response.ok) throw Error('prompt');
        return response.text();
      });
      const text = await prompt;
      if (await copy(text, 'aiPromptCopied')) return;
      fallback.value = text;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      say('aiPromptCopyFailed');
    } catch {
      prompt = null;
      say('aiPromptUnavailable');
    }
  };
  samplesButton.onclick = () => {
    panel.hidden = !panel.hidden;
    samplesButton.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) panel.querySelector('button')?.focus();
  };

  const renderSamples = () => {
    const intro = document.createElement('p');
    intro.textContent = t('htmlSamplesIntro');
    const heading = document.createElement('strong');
    heading.textContent = t('htmlSamplesTitle');
    panel.replaceChildren(heading, intro);
    for (const [group, samples] of SAMPLES) {
      const title = document.createElement('h4');
      title.textContent = t(group);
      const list = document.createElement('ul');
      for (const [key, html] of samples) {
        const item = document.createElement('li');
        item.dataset.sample = key;
        const name = document.createElement('span');
        name.className = 'block-editor-sample-name';
        name.textContent = t(key);
        const code = document.createElement('pre');
        code.textContent = html;
        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.dataset.sampleCopy = '';
        copyButton.textContent = t('sampleCopy');
        copyButton.onclick = async () => {
          if (!(await copy(html, 'sampleCopied'))) say('sampleCopyFailed');
        };
        const insertButton = document.createElement('button');
        insertButton.type = 'button';
        insertButton.dataset.sampleInsert = '';
        insertButton.textContent = t('sampleInsert');
        insertButton.onclick = () => onInsert(html);
        item.append(name, copyButton, insertButton, code);
        list.append(item);
      }
      panel.append(title, list);
    }
    const note = document.createElement('p');
    note.className = 'block-editor-sample-note';
    note.textContent = t('htmlSamplesStyleNote');
    panel.append(note);
  };

  return {
    root,
    promptButton,
    samplesButton,
    close() {
      panel.hidden = true;
      fallback.hidden = true;
      samplesButton.setAttribute('aria-expanded', 'false');
      say('');
    },
    translate() {
      labelIcon(promptButton, 'aiPromptCopy');
      labelIcon(samplesButton, 'htmlSamplesTitle');
      fallback.setAttribute('aria-label', t('aiPromptCopy'));
      say(statusKey);
      renderSamples();
    },
  };
}
