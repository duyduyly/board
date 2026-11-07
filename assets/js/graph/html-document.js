import { escapeHTML } from '../common/html.js';
export const DOCUMENT = 'card-atlas:document';
export const documentTags = new Set(
  'p div section article aside header footer h1 h2 h3 h4 h5 h6 span strong b em i u s sub sup br hr ul ol li blockquote pre code table caption thead tbody tfoot tr th td figure figcaption img a'.split(
    ' ',
  ),
);
const attributes = new Set([
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
]);
export const safeURL = (value, image = false) =>
  /^(https?:\/\/|attachment:[A-Za-z0-9_-]+$)/i.test(value) ||
  (!image && /^(mailto:|#)/i.test(value));
export function safeRemoteImageURL(value) {
  if (typeof value !== 'string' || value.length > 2000 || /[\s\u0000-\u001f\u007f]/.test(value) || !/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function safeStyle(value) {
  return value
    .split(';')
    .map((part) => part.trim())
    .filter(
      (part) =>
        /^(color|background-color|text-align|font-size|font-family|font-weight|font-style|text-decoration|margin(?:-(?:top|right|bottom|left))?|padding(?:-(?:top|right|bottom|left))?|width|max-width|height|border(?:-radius|-width|-color|-style)?|display|vertical-align|object-fit)\s*:\s*[#\w\s.,%()'"-]+$/i.test(
          part,
        ) && !/url|expression|var\s*\(|@|\\|position|javascript/i.test(part),
    )
    .join(';');
}
export function allowedAttribute(name, value) {
  if (!attributes.has(name) || typeof value !== 'string') return false;
  if (name === 'src') return /^attachment:[A-Za-z0-9_-]+$/.test(value) || safeRemoteImageURL(value);
  if (name === 'data-origin') return ['legacy-mermaid', 'legacy-raw-html', 'legacy-external-image', 'legacy-unsupported'].includes(value);
  if (name === 'href') return safeURL(value);
  if (name === 'style') return value === safeStyle(value);
  if (name === 'start') return /^(?:[1-9]\d{0,5})$/.test(value);
  if (name === 'class') return /^[A-Za-z0-9_\s-]*$/.test(value);
  return value.length <= 2000;
}
export function documentIssues(card, path = 'document') {
  const doc = card.extensions?.[DOCUMENT];
  if (doc === undefined) return [];
  const invalid = () => [{ path, code: 'htmlDocument' }];
  if (
    !doc ||
    doc.version !== 1 ||
    doc.format !== 'html-bs5' ||
    !Array.isArray(doc.components) ||
    Object.keys(doc).some((k) => !['version', 'format', 'components'].includes(k))
  )
    return invalid();
  let count = 0,
    length = 0;
  function check(nodes, depth) {
    if (depth > 32 || !Array.isArray(nodes)) return false;
    return nodes.every((node) => {
      if (++count > 3000) return false;
      if (typeof node === 'string') {
        length += node.length;
        return true;
      }
      if (
        !node ||
        !documentTags.has(node.tag) ||
        Object.keys(node).some((k) => !['tag', 'attributes', 'children'].includes(k)) ||
        !node.attributes ||
        typeof node.attributes !== 'object' ||
        Array.isArray(node.attributes)
      )
        return false;
      if (!Object.entries(node.attributes).every(([k, v]) => allowedAttribute(k, v))) return false;
      if (['br', 'hr', 'img'].includes(node.tag) && (!Array.isArray(node.children) || node.children.length))
        return false;
      if (
        node.tag === 'img' &&
        node.attributes.src &&
        node.attributes.src.startsWith('attachment:') &&
        (!Object.hasOwn(card.extensions?.['card-atlas:images'] || {}, node.attributes.src.slice(11)) ||
          !card.extensions['card-atlas:images'][node.attributes.src.slice(11)])
      )
        return false;
      return check(node.children, depth + 1);
    });
  }
  return check(doc.components, 0) && length <= 100000 ? [] : invalid();
}
export function documentHTML(doc) {
  const render = (nodes) =>
    nodes
      .map((node) =>
        typeof node === 'string'
          ? escapeHTML(node)
          : '<' +
            node.tag +
            Object.entries(node.attributes)
              .map(([k, v]) => ' ' + k + '="' + escapeHTML(v) + '"')
              .join('') +
            '>' +
            (['img', 'br', 'hr'].includes(node.tag)
              ? ''
              : render(node.children) + '</' + node.tag + '>'),
      )
      .join('');
  return render(doc.components);
}
export function documentText(doc) {
  const blocks = new Set(
    'p div section article aside header footer h1 h2 h3 h4 h5 h6 ul ol li blockquote pre table caption thead tbody tfoot tr figure figcaption'.split(
      ' ',
    ),
  );
  const text = (nodes) =>
    nodes
      .map((node) => {
        if (typeof node === 'string') return node;
        if (node.tag === 'br' || node.tag === 'hr') return '\n';
        if (node.tag === 'img') return node.attributes.alt || '';
        return text(node.children) + (blocks.has(node.tag) ? '\n' : '');
      })
      .join('');
  return text(doc.components).trim();
}
