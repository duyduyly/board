import { allowedAttribute, documentTags } from '../graph/html-document.js';

const voidTags = new Set(['br', 'hr', 'img']);
const space = /[\t\n\f\r ]/;

/** Format attribute layout without inserting or changing any text nodes.
 * Returns the original source on any unsupported or ambiguous syntax.
 */
export function formatHTML(source) {
  if (typeof source !== 'string') throw new TypeError('HTML source must be a string');
  const rejected = () => ({ ok: false, html: source, changed: false });
  const stack = [];
  const output = [];
  let i = 0;
  while (i < source.length) {
    const start = source.indexOf('<', i);
    if (start < 0) {
      output.push(source.slice(i));
      break;
    }
    output.push(source.slice(i, start));
    if (source.startsWith('<!--', start)) {
      const end = source.indexOf('-->', start + 4);
      if (
        end < 0 ||
        source.slice(start + 4, end).includes('--') ||
        (end > start + 4 && source[end - 1] === '-')
      )
        return rejected();
      output.push(source.slice(start, end + 3));
      i = end + 3;
      continue;
    }
    // In HTML a less-than sign followed by neither a letter nor markup
    // punctuation is text, such as "2 < 3". Preserve it verbatim.
    if (!/[A-Za-z/!?]/.test(source[start + 1] || '')) {
      output.push('<');
      i = start + 1;
      continue;
    }
    i = start + 1;
    const closing = source[i] === '/';
    if (closing) i++;
    const name = /^[A-Za-z][A-Za-z0-9-]*/.exec(source.slice(i));
    if (!name) return rejected();
    const tag = name[0].toLowerCase();
    if (!documentTags.has(tag)) return rejected();
    i += name[0].length;
    if (closing) {
      while (space.test(source[i] || '\0')) i++;
      if (source[i] !== '>' || stack.pop() !== tag) return rejected();
      output.push(source.slice(start, ++i));
      continue;
    }
    const attrs = [];
    const seen = new Set();
    let suffix = '';
    while (i < source.length) {
      const wsStart = i;
      while (space.test(source[i] || '\0')) i++;
      const ws = source.slice(wsStart, i);
      if (source[i] === '>' || (source[i] === '/' && source[i + 1] === '>')) {
        const selfClosing = source[i] === '/';
        if (selfClosing && !voidTags.has(tag)) return rejected();
        i += selfClosing ? 2 : 1;
        suffix = ws + (selfClosing ? '/>' : '>');
        break;
      }
      if (!ws) return rejected();
      const attr = /^[A-Za-z][A-Za-z0-9-]*/.exec(source.slice(i));
      if (!attr) return rejected();
      const attrStart = i;
      const key = attr[0].toLowerCase();
      if (seen.has(key)) return rejected();
      seen.add(key);
      i += attr[0].length;
      while (space.test(source[i] || '\0')) i++;
      if (source[i++] !== '=') return rejected();
      while (space.test(source[i] || '\0')) i++;
      const quote = source[i];
      let value;
      if (quote === '"' || quote === "'") {
        const valueStart = ++i;
        const end = source.indexOf(quote, i);
        if (end < 0) return rejected();
        value = source.slice(valueStart, end);
        i = end + 1;
      } else {
        const match = /^[^\t\n\f\r "'`=<>]+/.exec(source.slice(i));
        if (!match) return rejected();
        value = match[0];
        i += value.length;
      }
      if (!allowedAttribute(key, value)) return rejected();
      attrs.push(source.slice(attrStart, i));
    }
    if (!suffix) return rejected();
    if (!voidTags.has(tag)) stack.push(tag);
    // Attribute separators are HTML syntax, not rendered whitespace. Leave all
    // text and attribute values byte-for-byte unchanged, including pre/code.
    const indent = '  '.repeat(Math.min(stack.length + (voidTags.has(tag) ? 1 : 0), 32));
    output.push('<' + name[0] + attrs.map((attr) => '\n' + indent + attr).join('') + suffix);
  }
  if (stack.length) return rejected();
  const html = output.join('');
  // A browser additionally checks its actual parsing of both fragments.
  if (typeof globalThis.DOMParser !== 'undefined') {
    const parser = new globalThis.DOMParser();
    const before = parser.parseFromString(source, 'text/html').body;
    const after = parser.parseFromString(html, 'text/html').body;
    if (!before.isEqualNode(after)) return rejected();
  }
  return { ok: true, html, changed: html !== source };
}
