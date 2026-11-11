import DOMPurify from '../../vendor/dompurify-entry.js';
import {
  DOCUMENT,
  documentTags,
  allowedAttribute,
  safeStyle,
  documentHTML,
} from '../graph/html-document.js';
import { attachmentDataURL } from './attachments.js';
import { showImagePreview } from './image-preview.js';
import { t } from '../i18n/index.js';
import { addContents } from './writing.js';

export const legacySourceKeys = {
  'legacy-mermaid': 'legacySourceMermaid',
  'legacy-raw-html': 'legacySourceHTML',
  'legacy-external-image': 'legacySourceImage',
  'legacy-unsupported': 'legacySourceUnsupported',
};

export function parseDocument(html) {
  const removed = [];
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...documentTags],
    ALLOWED_ATTR: [
      'class',
      'style',
      'href',
      'src',
      'alt',
      'title',
      'colspan',
      'rowspan',
      'start',
      'scope',
      'width',
      'height',
      'data-language',
      'data-origin',
    ],
    ALLOW_DATA_ATTR: false,
    ADD_URI_SAFE_ATTR: ['src'],
    FORCE_BODY: true,
  });
  const purified = DOMPurify.removed
    .filter(
      (item, index) =>
        item.attribute ||
        (item.element?.nodeName !== 'BODY' &&
          !(index === 0 && item.element?.nodeName === 'REMOVE')),
    )
    .map((item) =>
      item.attribute ? item.attribute.name : item.element?.nodeName?.toLowerCase() || 'HTML',
    );
  const root = new window.DOMParser().parseFromString(clean, 'text/html').body;
  function nodes(parent) {
    return [...parent.childNodes].flatMap((node) => {
      if (node.nodeType === 3) return [node.textContent];
      if (node.nodeType !== 1) return [];
      const attributes = {};
      for (const attr of node.attributes) {
        const value = attr.name === 'style' ? safeStyle(attr.value) : attr.value;
        if (value !== attr.value) removed.push(attr.name);
        if (allowedAttribute(attr.name, value)) attributes[attr.name] = value;
        else removed.push(attr.name);
      }
      return [{ tag: node.tagName.toLowerCase(), attributes, children: nodes(node) }];
    });
  }
  return {
    document: { version: 1, format: 'html-bs5', components: nodes(root) },
    removed: [...purified, ...removed],
  };
}
export function resolvedHTML(card, allowImages = false, highlighter = null) {
  const root = new window.DOMParser().parseFromString(
    documentHTML(card.extensions[DOCUMENT]),
    'text/html',
  ).body;
  for (const img of root.querySelectorAll('img')) {
    const src = img.getAttribute('src') || '';
    const data = src.startsWith('attachment:')
      ? attachmentDataURL(card.extensions?.['card-atlas:images']?.[src.slice(11)])
      : allowImages
        ? src
        : '';
    if (data) img.setAttribute('src', data);
    else {
      const caption = root.ownerDocument.createElement('span');
      caption.textContent = img.alt || src;
      img.replaceWith(caption);
    }
  }
  for (const link of root.querySelectorAll('a')) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  if (highlighter) {
    for (const code of root.querySelectorAll('pre > code')) {
      const language = [...code.classList].find((name) => name.startsWith('language-'))?.slice(9);
      const source = code.textContent;
      if (source.length <= 20000 && highlighter.getLanguage(language)) {
        code.innerHTML = highlighter.highlight(source, { language, ignoreIllegals: true }).value;
      }
    }
  }
  return root.innerHTML;
}
export async function standaloneHTMLDocument(card) {
  const cssURL = new URL('../../vendor/bootstrap.min.css', import.meta.url);
  const response = await fetch(cssURL);
  if (!response.ok) throw new Error('Bootstrap stylesheet unavailable');
  const css = await response.text();
  const title = document.createElement('title');
  title.textContent = card.title;
  return (
    '<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data: https: http:;">' +
    title.outerHTML +
    '<style>' +
    css.replace(/<\/style/gi, '<\\/style') +
    '</style></head><body><main class="container py-4">' +
    resolvedHTML(card, true) +
    '</main></body></html>'
  );
}
const frameHeight = (doc) => Math.max(400, doc.body.scrollHeight) + 'px';
/** Applies a session reading scale (percent of the browser default) to an open viewer frame. */
export function setDocumentScale(frame, percent) {
  const doc = frame?.contentDocument;
  if (!doc?.body) return;
  doc.documentElement.style.fontSize = percent + '%';
  frame.style.height = frameHeight(doc);
}
export async function renderHTMLDocument(host, card, options = {}) {
  const hasCode = documentHTML(card.extensions[DOCUMENT]).includes('<code');
  const highlighter = hasCode ? (await import('../../vendor/highlight-entry.js')).default : null;
  if (!host.isConnected) return;
  const frame = document.createElement('iframe');
  frame.className = 'html-document-frame';
  frame.title = card.title;
  frame.setAttribute('sandbox', 'allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    if (!doc) return;
    for (const node of doc.querySelectorAll('[data-origin]')) {
      const key = legacySourceKeys[node.getAttribute('data-origin')];
      if (!key) continue;
      const target = node.closest('pre') || node;
      const label = doc.createElement(target.tagName === 'PRE' ? 'p' : 'span');
      label.className = 'legacy-source-status';
      label.textContent = t(key) + ' ';
      target.before(label);
    }
    if (options.fontScale) doc.documentElement.style.fontSize = options.fontScale + '%';
    (options.contents || addContents)(doc.body);
    const sizeFrame = () => {
      if (frame.isConnected) frame.style.height = frameHeight(doc);
    };
    let width = 0;
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width !== width) {
        width = entry.contentRect.width;
        sizeFrame();
      }
    });
    resizeObserver.observe(frame);
    const removalObserver = new window.MutationObserver(() => {
      if (!frame.isConnected) {
        resizeObserver.disconnect();
        removalObserver.disconnect();
      }
    });
    removalObserver.observe(document, { childList: true, subtree: true });
    sizeFrame();
    doc.fonts?.ready.then(sizeFrame);
    for (const image of doc.querySelectorAll('img')) {
      image.addEventListener('load', sizeFrame, { once: true });
      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      image.setAttribute('aria-label', t('openImage') + ': ' + (image.alt || t('imagePreview')));
    }
    doc.addEventListener('click', (event) => {
      const image = event.target.closest('img');
      if (image) showImagePreview(image);
    });
    doc.addEventListener('keydown', (event) => {
      if (event.target.matches('img') && ['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        showImagePreview(event.target);
      }
    });
  });
  const css = new URL('../../vendor/bootstrap.min.css', import.meta.url).href;
  const documentCSS = new URL('../../css/document-content.css', import.meta.url).href;
  frame.srcdoc =
    '<!doctype html><html' +
    // The viewer follows the app theme; the panel is re-rendered when the theme changes.
    (document.documentElement.dataset.theme === 'dark' ? ' data-bs-theme="dark"' : '') +
    '><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\' ' +
    window.location.origin +
    '; img-src data: ' +
    (options.allowImages ? 'https: http:' : '') +
    ';"><link rel="stylesheet" href="' +
    css +
    '"><link rel="stylesheet" href="' + documentCSS + '"><style>.legacy-source-status{color:#705321;font-size:.875em;font-weight:600}.document-contents{padding:12px;margin-bottom:20px;border:1px solid #b6c3b8}.document-contents button{display:block;border:0;background:none;color:#28594b;text-align:left}.document-contents .heading-h2{padding-left:16px}.document-contents .heading-h3{padding-left:32px}.hljs-keyword,.hljs-selector-tag,.hljs-literal{color:#7147a3}.hljs-string,.hljs-attr{color:#177447}.hljs-number,.hljs-type,.hljs-built_in{color:#a34d19}.hljs-title,.hljs-name{color:#285b9d}.hljs-comment,.hljs-quote{color:#6c7469}[data-bs-theme=dark] .legacy-source-status{color:#e0c48a}[data-bs-theme=dark] .document-contents{border-color:#535c4b}[data-bs-theme=dark] .document-contents button{color:#b2cba4}[data-bs-theme=dark] :is(.hljs-keyword,.hljs-selector-tag,.hljs-literal){color:#c9aaf0}[data-bs-theme=dark] :is(.hljs-string,.hljs-attr){color:#8fd3a8}[data-bs-theme=dark] :is(.hljs-number,.hljs-type,.hljs-built_in){color:#f0a878}[data-bs-theme=dark] :is(.hljs-title,.hljs-name){color:#8fb8f0}[data-bs-theme=dark] :is(.hljs-comment,.hljs-quote){color:#9aa392}</style></head><body>' +
    resolvedHTML(card, options.allowImages, highlighter) +
    '</body></html>';
  host.replaceChildren(frame);
}
