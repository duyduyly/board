import { Marked } from 'marked';
import {
  DOCUMENT,
  documentText,
  documentIssues,
  safeURL,
} from '../assets/js/graph/html-document.js';

const element = (tag, children = [], attributes = {}) => ({ tag, attributes, children });
const markdown = new Marked({ gfm: true });
markdown.use({
  extensions: [
    {
      name: 'textColor',
      level: 'inline',
      start: (source) => source.search(/\[[^\]\r\n]+\]\{color:#/),
      tokenizer(source) {
        const match = /^\[([^\]\r\n]+)\]\{color:(#[0-9a-fA-F]{6})\}/.exec(source);
        if (match) return { type: 'textColor', raw: match[0], text: match[1], color: match[2] };
      },
    },
  ],
});
function decode(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
  return String(text ?? '').replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (all, key) => {
      if (key[0] === '#') {
        const value =
          key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
        return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
          ? String.fromCodePoint(value)
          : all;
      }
      return named[key.toLowerCase()] ?? all;
    },
  );
}
export function convertMarkdownCard(card) {
  if (card.extensions?.[DOCUMENT])
    return { card: structuredClone(card), warnings: [], skipped: true };
  const warnings = [];
  const imageMap = card.extensions?.['card-atlas:images'] || {};
  const warn = (kind, token) => warnings.push({ kind, source: token.raw || token.text || '' });
  const code = (value, language = '', origin = '') =>
    element('pre', [element('code', [value], { ...(language ? { class: 'language-' + language } : {}), ...(origin ? { 'data-origin': origin } : {}) })]);
  function render(tokens, inline = false) {
    return tokens.flatMap((token) => {
      const nested = () => render(token.tokens || [], true);
      switch (token.type) {
        case 'space':
          return [];
        case 'text':
        case 'escape':
          if (
            !token.tokens &&
            /&(?!(?:amp|lt|gt|quot|apos|nbsp);)[a-z][a-z0-9]+;/i.test(token.text || '')
          )
            warn('unknown-entity-preserved', token);
          return token.tokens ? render(token.tokens, inline) : [decode(token.text)];
        case 'paragraph':
          return [element('p', nested())];
        case 'heading':
          return [element('h' + token.depth, nested())];
        case 'textColor':
          return [element('span', [token.text], { style: 'color:' + token.color })];
        case 'strong':
          return [element('strong', nested())];
        case 'em':
          return [element('em', nested())];
        case 'del':
          return [element('s', nested())];
        case 'codespan':
          return [element('code', [token.text])];
        case 'br':
          return [element('br')];
        case 'hr':
          return [element('hr')];
        case 'code': {
          const language = (token.lang || '').split(/\s/)[0].toLowerCase();
          if (language === 'mermaid') {
            warn('mermaid-preserved', token);
            return [code(token.text, 'mermaid', 'legacy-mermaid')];
          }
          return [code(token.text, /^[a-z0-9_-]+$/.test(language) ? language : '')];
        }
        case 'blockquote':
          return [element('blockquote', render(token.tokens || []))];
        case 'checkbox':
          return [token.checked ? '[x] ' : '[ ] '];
        case 'list':
          if (token.ordered && token.start > 999999) warn('list-start-preserved-in-report', token);
          return [
            element(
              token.ordered ? 'ol' : 'ul',
              token.items.map((item) => element('li', render(item.tokens || []))),
              token.ordered && token.start > 1 && token.start <= 999999
                ? { start: String(token.start) }
                : {},
            ),
          ];
        case 'table': {
          const cell = (tag, c) =>
            element(
              tag,
              render(c.tokens || [], true),
              c.align ? { style: 'text-align: ' + c.align } : {},
            );
          return [
            element(
              'table',
              [
                element('thead', [
                  element(
                    'tr',
                    token.header.map((c) => cell('th', c)),
                  ),
                ]),
                element(
                  'tbody',
                  token.rows.map((row) =>
                    element(
                      'tr',
                      row.map((c) => cell('td', c)),
                    ),
                  ),
                ),
              ],
              { class: 'table table-bordered' },
            ),
          ];
        }
        case 'link': {
          const href = decode(token.href);
          if (
            !safeURL(href) ||
            (href.startsWith('attachment:') && !Object.hasOwn(imageMap, href.slice(11)))
          ) {
            warn('link-preserved-as-text', token);
            return [element('span', [decode(token.raw)], { 'data-origin': 'legacy-unsupported' })];
          }
          return [
            element('a', nested(), {
              href,
              ...(token.title ? { title: decode(token.title) } : {}),
            }),
          ];
        }
        case 'image': {
          const src = decode(token.href);
          const id = src.startsWith('attachment:') ? src.slice(11) : '';
          if (!id || !Object.hasOwn(imageMap, id)) {
            warn('image-preserved-as-text', token);
            return [element('span', [decode(token.raw)], { 'data-origin': 'legacy-external-image' })];
          }
          return [
            element('img', [], {
              src,
              alt: decode(token.text || ''),
              ...(token.title ? { title: decode(token.title) } : {}),
            }),
          ];
        }
        case 'html': {
          warn('html-preserved-as-code', token);
          return inline ? [element('code', [token.raw], { 'data-origin': 'legacy-raw-html' })] : [code(token.raw, 'html', 'legacy-raw-html')];
        }
        default:
          warn('unsupported-preserved-as-text', token);
          return [element('span', [decode(token.raw || token.text || '')], { 'data-origin': 'legacy-unsupported' })];
      }
    });
  }
  const result = structuredClone(card);
  const components = render(markdown.lexer(card.content || ''));
  const document = { version: 1, format: 'html-bs5', components };
  result.extensions = { ...result.extensions, [DOCUMENT]: document };
  result.content = documentText(document);
  if (documentIssues(result).length)
    throw new Error('Converted document exceeds limits or violates the document contract');
  return { card: result, warnings, skipped: false };
}
