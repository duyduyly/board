import { attachmentDataURL } from './attachments.js';
import { marked } from '../../vendor/marked-entry.js';
import DOMPurify from '../../vendor/dompurify-entry.js';
import { t } from '../i18n/index.js';
import { isSafeDiagramSource } from './mermaid-policy.js';
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const external = (href) => {
  try {
    return ['https:', 'http:'].includes(new URL(href).protocol);
  } catch {
    return false;
  }
};
marked.use({
  extensions: [
    {
      name: 'textColor',
      level: 'inline',
      start: (source) => source.search(/\[[^\]\r\n]+\]\{color:#/),
      tokenizer(source) {
        const match = /^\[([^\]\r\n]+)\]\{color:(#[0-9a-fA-F]{6})\}/.exec(source);
        if (match) return { type: 'textColor', raw: match[0], text: match[1], color: match[2] };
      },
      renderer(token) {
        return '<span data-text-color="' + token.color + '">' + escape(token.text) + '</span>';
      },
    },
  ],
});
let diagramCounter = 0;
export async function renderMarkdown(
  host,
  source,
  { allowImages = false, images = {}, isCurrent = () => true } = {},
) {
  const renderer = new marked.Renderer();
  renderer.html = (token) => escape(token.text);
  renderer.image = (token) => {
    if (token.href.startsWith('attachment:')) {
      const id = token.href.slice('attachment:'.length);
      const src = Object.hasOwn(images, id) ? attachmentDataURL(images[id]) : null;
      return src
        ? '<img class="embedded-image" src="' +
            src +
            '" alt="' +
            escape(token.text) +
            '" loading="lazy">'
        : '<span class="blocked-image">' + escape(t('missingImage')) + '</span>';
    }
    return allowImages && external(token.href)
      ? '<img src="' +
          escape(token.href) +
          '" alt="' +
          escape(token.text) +
          '" loading="lazy" referrerpolicy="no-referrer">'
      : '<span class="blocked-image">' +
          escape(external(token.href) ? t('blockedImage') : t('unsupportedImage')) +
          (token.text ? ' · ' + escape(token.text) : '') +
          '</span>';
  };
  const html = marked.parse(source, { renderer, gfm: true });
  const safe = DOMPurify.sanitize(html, {
    FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input'],
    FORBID_ATTR: ['style', 'srcset'],
  });
  if (!isCurrent()) return;
  host.innerHTML = safe;
  for (const span of host.querySelectorAll('[data-text-color]'))
    if (/^#[0-9a-fA-F]{6}$/.test(span.dataset.textColor)) span.style.color = span.dataset.textColor;
  for (const image of host.querySelectorAll('img')) {
    image.tabIndex = 0;
    image.classList.add('zoomable-image');
    image.setAttribute('aria-label', t('zoomImage') + (image.alt ? ': ' + image.alt : ''));
  }
  for (const a of host.querySelectorAll('a')) {
    const href = a.getAttribute('href') || '';
    if (!/^(https?:|mailto:)/i.test(href)) a.removeAttribute('href');
    else {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
  }
  const blocks = [...host.querySelectorAll('code.language-mermaid')];
  if (!blocks.length) return;
  const { default: mermaid } = await import('../../vendor/mermaid-entry.js');
  const dark = document.documentElement.dataset.theme === 'dark';
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    htmlLabels: false,
    suppressErrorRendering: true,
    theme: 'base',
    themeVariables: {
      primaryColor: dark ? '#294536' : '#e0f0e7',
      primaryTextColor: dark ? '#e4eee8' : '#202925',
      primaryBorderColor: dark ? '#80b699' : '#527c68',
      secondaryColor: dark ? '#253c34' : '#f1f5f2',
      tertiaryColor: dark ? '#25332c' : '#f5f7f5',
      edgeLabelBackground: dark ? '#1b2521' : '#f5f7f5',
      textColor: dark ? '#e4eee8' : '#202925',
      lineColor: dark ? '#9bd9bc' : '#527c68',
      fontFamily: 'Segoe UI, sans-serif',
    },
    flowchart: { htmlLabels: false },
    maxTextSize: 100000,
  });
  for (const code of blocks) {
    if (!isCurrent()) return;
    const source = code.textContent;
    const parent = code.closest('pre');
    try {
      if (!isSafeDiagramSource(source)) throw new Error('diagramPolicy');
      const { svg } = await mermaid.render('diagram-' + ++diagramCounter, source);
      if (!isCurrent()) return;
      const diagram = document.createElement('div');
      diagram.className = 'diagram';
      diagram.innerHTML = DOMPurify.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: ['foreignObject', 'script'],
        FORBID_ATTR: ['onclick', 'onload', 'href', 'xlink:href'],
      });
      parent.replaceWith(diagram);
    } catch (error) {
      if (!isCurrent()) return;
      const note = document.createElement('p');
      note.className = 'form-errors';
      note.textContent = t(
        error.message === 'diagramPolicy' ? 'errorDiagramPolicy' : 'errorDiagram',
      );
      parent.before(note);
    }
  }
}
