import { marked } from '../../vendor/marked-entry.js';
import { clone } from '../common/data.js';
import { LIMITS } from '../json/validator.js';
import { assertReferences, transferError } from '../json/node-transfer.js';
import { IMAGE_NAMESPACE, validImageAttachment } from './attachments.js';

export function decodeDocument(buffer) {
  if (buffer.byteLength > LIMITS.file) throw transferError('errorFileLimit');
  try {
    return new globalThis.TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw transferError('transferEncoding');
  }
}
export function stageMarkdown(text, card) {
  if (new TextEncoder().encode(text).length > LIMITS.file) throw transferError('errorFileLimit');
  const images = { ...clone(card.extensions?.[IMAGE_NAMESPACE] || {}) };
  const missing = new Set(),
    remote = new Set(),
    embedded = [],
    replacements = new Map();
  const tokens = marked.lexer(text);
  marked.walkTokens(tokens, (token) => {
    if (token.type !== 'image') return;
    const href = token.href;
    if (/^data:/i.test(href)) {
      if (replacements.has(href)) return;
      const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(
        href,
      );
      if (!match) {
        missing.add(href.slice(0, 80));
        return;
      }
      const image = {
        name: token.text || 'image.' + match[1].split('/')[1],
        mimeType: match[1].toLowerCase(),
        data: match[2],
      };
      if (!validImageAttachment(image)) throw transferError('errorImageAttachment');
      let id = 'markdown-image-' + (embedded.length + 1),
        suffix = 1;
      while (Object.hasOwn(images, id))
        id = 'markdown-image-' + (embedded.length + 1) + '-' + suffix++;
      images[id] = image;
      embedded.push(image);
      replacements.set(href, 'attachment:' + id);
    } else if (/^https?:\/\//i.test(href)) remote.add(href);
    else if (!href.startsWith('attachment:')) missing.add(href);
  });
  for (const [href, replacement] of replacements) text = text.split(href).join(replacement);
  if (text.length > LIMITS.content) throw transferError('transferContentLimit');
  return { content: text, images, missing: [...missing], remote: [...remote], embedded };
}
export function markdownCandidate(card, staged, mode = 'replace') {
  const next = clone(card);
  next.content =
    mode === 'append' && next.content ? next.content + '\n\n' + staged.content : staged.content;
  if (next.content.length > LIMITS.content) throw transferError('transferContentLimit');
  next.extensions = { ...next.extensions };
  if (Object.keys(staged.images).length) next.extensions[IMAGE_NAMESPACE] = clone(staged.images);
  assertReferences(next);
  return next;
}
