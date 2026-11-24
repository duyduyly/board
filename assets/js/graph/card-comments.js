export const COMMENTS = 'card-atlas:comments';
export const COMMENT_LIMITS = { items: 500, text: 4000 };
const UNORDERED = /^[-*] (.*)$/;
const ORDERED = /^(\d{1,9})[.)] (.*)$/;

/** @typedef {{ id: string, createdAt: string, text: string }} CardComment */
/** @typedef {{ type: 'paragraph', lines: string[] }} ParagraphBlock */
/** @typedef {{ type: 'list', ordered: boolean, start?: number, items: string[] }} ListBlock */

/** @param {any} card @returns {CardComment[]} */
export const cardComments = (card) => card?.extensions?.[COMMENTS]?.items || [];
/** @param {any} card */
export const commentCount = (card) => cardComments(card).length;
/** @param {any} card */
export const commentsText = (card) =>
  cardComments(card)
    .map((comment) => comment.text)
    .join('\n');

/** @param {string} text */
function normalizeText(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.join('\n');
}

/**
 * Appends a user-written comment; call only inside a store commit.
 * @param {any} card
 * @param {CardComment} comment
 */
export function addComment(card, { id, createdAt, text }) {
  const clean = normalizeText(text);
  if (!clean) throw new Error('commentEmpty');
  if (clean.length > COMMENT_LIMITS.text) throw new Error('commentTooLong');
  const items = cardComments(card);
  if (items.length >= COMMENT_LIMITS.items) throw new Error('commentLimit');
  card.extensions ||= {};
  card.extensions[COMMENTS] = { version: 1, items: [...items, { id, createdAt, text: clean }] };
}

/** @param {any} card @param {string} id @returns {boolean} */
export function removeComment(card, id) {
  const items = cardComments(card);
  const rest = items.filter((comment) => comment.id !== id);
  if (rest.length === items.length) return false;
  if (rest.length) card.extensions[COMMENTS] = { ...card.extensions[COMMENTS], items: rest };
  else {
    delete card.extensions[COMMENTS];
    if (!Object.keys(card.extensions).length) delete card.extensions;
  }
  return true;
}

/**
 * Splits comment text into paragraphs and flat lists (no nesting).
 * @param {string} text
 * @returns {Array<ParagraphBlock | ListBlock>}
 */
export function commentBlocks(text) {
  /** @type {Array<ParagraphBlock | ListBlock>} */
  const blocks = [];
  /** @type {ParagraphBlock | ListBlock | null} */
  let open = null;
  for (const line of String(text).replace(/\r\n?/g, '\n').split('\n')) {
    if (!line.trim()) {
      open = null;
      continue;
    }
    const bullet = UNORDERED.exec(line),
      number = ORDERED.exec(line);
    if (bullet || number) {
      const ordered = Boolean(number);
      if (open?.type !== 'list' || open.ordered !== ordered) {
        open = { type: 'list', ordered, items: [] };
        if (number) open.start = Number(number[1]);
        blocks.push(open);
      }
      open.items.push(number ? number[2] : bullet?.[1] || '');
    } else {
      if (open?.type !== 'paragraph') {
        open = { type: 'paragraph', lines: [] };
        blocks.push(open);
      }
      open.lines.push(line);
    }
  }
  return blocks;
}

/** @param {any} card @param {string} path */
export function commentIssues(card, path) {
  /** @type {Array<{ path: string, code: string, params?: object }>} */
  const errors = [],
    seen = new Set();
  cardComments(card).forEach((comment, index) => {
    const base = `${path}.extensions.${COMMENTS}.items[${index}]`,
      date = new Date(comment.createdAt);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== comment.createdAt)
      errors.push({
        path: base + '.createdAt',
        code: 'format',
        params: { format: 'UTC timestamp' },
      });
    if (seen.has(comment.id)) errors.push({ path: base + '.id', code: 'duplicateId' });
    seen.add(comment.id);
  });
  return errors;
}
