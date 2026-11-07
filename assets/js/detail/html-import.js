import { labelIcon } from './editor-icons.js';
﻿import { t } from '../i18n/index.js';
import { DOCUMENT, documentHTML, documentIssues } from '../graph/html-document.js';
import { parseDocument } from './html-content.js';

export function createHTMLImport(editor, images) {
  const root = document.createElement('section');
  root.className = 'block-html-import';
  root.hidden = true;
  const heading = document.createElement('strong');
  const label = document.createElement('label');
  const caption = document.createElement('span');
  const source = document.createElement('textarea');
  source.rows = 7;
  source.dataset.htmlSource = '';
  label.append(caption, source);
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = '.html,.htm,text/html';
  file.dataset.htmlFile = '';
  const review = document.createElement('button');
  review.type = 'button';
  review.dataset.htmlReview = '';
  const result = document.createElement('div');
  result.dataset.htmlResult = '';
  result.hidden = true;
  const warning = document.createElement('p');
  warning.setAttribute('role', 'status');
  const preview = document.createElement('pre');
  preview.dataset.htmlPreview = '';
  result.append(warning, preview);
  const accept = document.createElement('button');
  accept.type = 'button';
  accept.dataset.htmlAccept = '';
  accept.disabled = true;
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.dataset.htmlCancel = '';
  root.append(heading, label, file, review, result, accept, cancel);
  let staged = null;
  const invalidate = () => {
    staged = null;
    result.hidden = true;
    accept.disabled = true;
  };
  source.oninput = invalidate;
  const show = () => {
    root.hidden = false;
    source.focus();
  };
  file.onchange = async () => {
    const chosen = file.files[0];
    file.value = '';
    if (!chosen) return;
    if (chosen.size > 1000000) {
      warning.textContent = t('htmlImportTooLarge');
      result.hidden = false;
      accept.disabled = true;
      return;
    }
    source.value = await chosen.text();
    invalidate();
  };
  const stage = () => {
    invalidate();
    result.hidden = false;
    if (new TextEncoder().encode(source.value).length > 1000000) {
      warning.textContent = t('htmlImportTooLarge');
      return;
    }
    const parsed = parseDocument(source.value);
    const missing = [];
    const visit = (nodes) => {
      for (const node of nodes) {
        if (typeof node === 'string') continue;
        if (node.tag === 'img' && node.attributes.src?.startsWith('attachment:') &&
          (!Object.hasOwn(images, node.attributes.src.slice(11)) || !images[node.attributes.src.slice(11)])) {
          delete node.attributes.src;
          missing.push('img src');
        }
        visit(node.children);
      }
    };
    visit(parsed.document.components);
    const removed = [...parsed.removed, ...missing];
    if (
      documentIssues({ extensions: { [DOCUMENT]: parsed.document, 'card-atlas:images': images } })
        .length
    ) {
      warning.textContent = t('htmlImportInvalid');
      return;
    }
    staged = parsed.document;
    warning.textContent = removed.length
      ? t('htmlImportRemoved') + ': ' + [...new Set(removed)].join(', ')
      : t('htmlImportClean');
    preview.textContent = documentHTML(staged);
    accept.disabled = false;
  };
  review.onclick = stage;
  accept.onclick = () => {
    if (!staged) return;
    editor.addComponents(documentHTML(staged));
    root.hidden = true;
    source.value = '';
    invalidate();
  };
  cancel.onclick = () => {
    root.hidden = true;
    source.value = '';
    invalidate();
  };
  return {
    root,
    show,
    fromClipboard(html) {
      source.value = html;
      show();
      stage();
    },
    translate() {
      heading.textContent = t('htmlImportTitle');
      caption.textContent = t('htmlImportSource');
      labelIcon(review, 'htmlImportReview');
      labelIcon(accept, 'htmlImportAccept');
      labelIcon(cancel, 'cancel');
      file.setAttribute('aria-label', t('htmlImportFile'));
    },
  };
}
