import { safeRemoteImageURL, safeURL } from '../graph/html-document.js';
import { validImageAttachment } from '../detail/attachments.js';

/**
 * Pure mapping from the `card-atlas:document` tree to the Word export IR
 * (see planner/plan.md section 2.4). No DOM, i18n or store access: labels and
 * attachment images are passed in.
 *
 * @typedef {{ bold?: boolean, italic?: boolean, underline?: boolean, strike?: boolean, code?: boolean, sub?: boolean, sup?: boolean, color?: string, highlight?: string }} Marks
 * @typedef {{ type: 'text', text: string, marks?: Marks }
 *   | { type: 'break' }
 *   | { type: 'link', href?: string, anchor?: string, children: Inline[] }
 *   | { type: 'image', key: string, mimeType: string, data: string, alt: string, widthPx?: number }} Inline
 * @typedef {{ header: boolean, colSpan: number, rowSpan: number, blocks: Block[] }} TableCell
 * @typedef {{ type: 'heading', level: number, inlines: Inline[], bookmark?: string }
 *   | { type: 'paragraph', inlines: Inline[], style?: string, align?: string, rule?: boolean }
 *   | { type: 'list-item', ordered: boolean, level: number, listId: number, start?: number, inlines: Inline[] }
 *   | { type: 'code', text: string, caption?: string }
 *   | { type: 'table', caption?: Inline[], rows: { header: boolean, cells: TableCell[] }[] }
 *   | { type: 'callout', variant: string, blocks: Block[] }} Block
 * @typedef {{ name: string, mimeType: string, data: string }} ImageRecord
 * @typedef {{ image: string, remoteImage: string, mermaidSource: string }} BlockLabels
 * @typedef {{ cardId: string, headingBase?: number, images?: Record<string, ImageRecord>, labels: BlockLabels, listIds?: { next: number } }} BlockOptions
 */

const MAX_HEADING_LEVEL = 9;
const MAX_LIST_LEVEL = 8;
const MAX_SPAN = 63;
const FIRST_LIST_ID = 1;
const CALLOUT_VARIANTS = new Set(['info', 'warning', 'success', 'danger']);
const INLINE_TAGS = new Set('span strong b em i u s sub sup code a br img'.split(' '));
const MARK_BY_TAG = {
  strong: 'bold',
  b: 'bold',
  em: 'italic',
  i: 'italic',
  u: 'underline',
  s: 'strike',
  sub: 'sub',
  sup: 'sup',
  code: 'code',
};
const ALIGN_BY_CLASS = {
  'text-start': 'left',
  'text-center': 'center',
  'text-end': 'right',
  'text-justify': 'justify',
};
const ALIGN_BY_STYLE = {
  left: 'left',
  start: 'left',
  center: 'center',
  right: 'right',
  end: 'right',
  justify: 'justify',
};
const HEADING_TAG = /^h([1-6])$/;

/** @param {any} node @param {string} name */
const attr = (node, name) =>
  typeof node.attributes?.[name] === 'string' ? node.attributes[name] : '';
/** @param {any} node @returns {string[]} */
const classes = (node) => attr(node, 'class').split(/\s+/).filter(Boolean);
/** @param {any} node @returns {any[]} */
const childrenOf = (node) => (Array.isArray(node.children) ? node.children : []);

/** @param {string} value @returns {Record<string, string>} */
function parseStyle(value) {
  /** @type {Record<string, string>} */
  const result = {};
  for (const part of value.split(';')) {
    const at = part.indexOf(':');
    if (at > 0)
      result[part.slice(0, at).trim().toLowerCase()] = part
        .slice(at + 1)
        .trim()
        .toLowerCase();
  }
  return result;
}

/** @param {number} n */
const hex2 = (n) =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');

/**
 * Accepts #rgb, #rrggbb and rgb()/rgba() and returns #rrggbb, otherwise undefined.
 * @param {string | undefined} value
 */
function parseColor(value) {
  if (!value) return undefined;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(value);
  if (short) return '#' + short[1] + short[1] + short[2] + short[2] + short[3] + short[3];
  if (/^#[0-9a-f]{6}$/.test(value)) return value;
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/.exec(
    value,
  );
  return rgb ? '#' + hex2(+rgb[1]) + hex2(+rgb[2]) + hex2(+rgb[3]) : undefined;
}

/** @param {any} node @param {string | undefined} inherited */
function alignOf(node, inherited) {
  for (const name of classes(node)) if (ALIGN_BY_CLASS[name]) return ALIGN_BY_CLASS[name];
  return ALIGN_BY_STYLE[parseStyle(attr(node, 'style'))['text-align']] || inherited;
}

/** @param {any} node @param {Marks} marks @returns {Marks} */
function marksFor(node, marks) {
  const style = parseStyle(attr(node, 'style'));
  const color = parseColor(style.color);
  const highlight = parseColor(style['background-color']);
  const next = { ...marks };
  if (MARK_BY_TAG[node.tag]) next[MARK_BY_TAG[node.tag]] = true;
  if (color) next.color = color;
  if (highlight) next.highlight = highlight;
  return next;
}

/** @param {string} text @param {Marks} marks @returns {Inline} */
const textInline = (text, marks) =>
  Object.keys(marks).length ? { type: 'text', text, marks: { ...marks } } : { type: 'text', text };

/** @param {string} label @param {string} alt */
const labelled = (label, alt) => (alt ? label + ': ' + alt : label);

/** @param {any} node */
function widthPx(node) {
  const match = /^(\d{1,5})(?:px)?$/.exec(attr(node, 'width'));
  return match && +match[1] > 0 ? +match[1] : undefined;
}

/** @param {any} node @param {Marks} marks @param {any} ctx @returns {Inline[]} */
function imageInline(node, marks, ctx) {
  const src = attr(node, 'src');
  const alt = attr(node, 'alt');
  const missing = () => [textInline('[' + labelled(ctx.labels.image, alt) + ']', marks)];
  if (src.startsWith('attachment:')) {
    const id = src.slice('attachment:'.length);
    const record = Object.hasOwn(ctx.images, id) ? ctx.images[id] : null;
    if (!validImageAttachment(record)) return missing();
    const width = widthPx(node);
    return [
      {
        type: 'image',
        key: ctx.cardId + '/' + id,
        mimeType: record.mimeType,
        data: record.data,
        alt: alt || record.name,
        ...(width ? { widthPx: width } : {}),
      },
    ];
  }
  if (!safeRemoteImageURL(src)) return missing();
  const text = labelled(ctx.labels.remoteImage, alt || src);
  return [{ type: 'link', href: src, children: [textInline(text, marks)] }];
}

/** @param {any} node @param {Marks} marks @param {any} ctx @returns {Inline[]} */
function linkInline(node, marks, ctx) {
  const href = attr(node, 'href');
  const children = inlinesOf(childrenOf(node), marks, ctx, true);
  if (!href || href.startsWith('#') || !safeURL(href)) return children;
  return [{ type: 'link', href, children: children.length ? children : [textInline(href, marks)] }];
}

/**
 * Inline-only flattening: block tags inside are treated as transparent.
 * Links are never nested (`inLink`).
 * @param {any[]} nodes @param {Marks} marks @param {any} ctx @param {boolean} [inLink]
 * @returns {Inline[]}
 */
function inlinesOf(nodes, marks, ctx, inLink = false) {
  /** @type {Inline[]} */
  const out = [];
  for (const node of nodes) {
    if (typeof node === 'string') {
      const text = node.replace(/\s+/g, ' ');
      if (text) out.push(textInline(text, marks));
    } else if (node.tag === 'br') out.push({ type: 'break' });
    else if (node.tag === 'img') out.push(...imageInline(node, marks, ctx));
    else if (node.tag === 'a' && !inLink) out.push(...linkInline(node, marksFor(node, marks), ctx));
    else out.push(...inlinesOf(childrenOf(node), marksFor(node, marks), ctx, inLink));
  }
  return out;
}

/**
 * Trims collapsed whitespace at paragraph edges and around breaks, dropping empty text.
 * @param {Inline[]} inlines
 * @returns {Inline[]}
 */
function trimInlines(inlines) {
  const trimmed = inlines.map((inline, i) => {
    if (inline.type !== 'text') return inline;
    let text = inline.text;
    const before = inlines[i - 1];
    const after = inlines[i + 1];
    if (!before || before.type === 'break') text = text.trimStart();
    if (!after || after.type === 'break') text = text.trimEnd();
    return { ...inline, text };
  });
  return trimmed.filter((inline) => inline.type !== 'text' || inline.text);
}

/** A run made only of breaks is an empty editor line and is dropped. @param {Inline[]} inlines */
const hasContent = (inlines) => inlines.some((inline) => inline.type !== 'break');

/** @param {Inline[]} inlines @param {any} scope @returns {Block} */
const listItem = (inlines, scope) => ({
  type: 'list-item',
  ordered: scope.ordered,
  level: scope.level,
  listId: scope.listId,
  ...(scope.start ? { start: scope.start } : {}),
  inlines,
});

/** @param {Inline[]} inlines @param {any} env @returns {Block} */
function paragraphBlock(inlines, env) {
  if (env.item && !env.item.emitted) {
    env.item.emitted = true;
    return listItem(inlines, env.scope);
  }
  return {
    type: 'paragraph',
    inlines,
    ...(env.style ? { style: env.style } : {}),
    ...(env.align ? { align: env.align } : {}),
  };
}

/** @param {string | undefined} value @param {number} [max] */
const positiveInt = (value, max = Infinity) =>
  /^\d{1,6}$/.test(value || '') && Number(value) > 0 ? Math.min(Number(value), max) : undefined;

/** @param {any[]} nodes @returns {string} */
function rawText(nodes) {
  return nodes
    .map((node) =>
      typeof node === 'string' ? node : node.tag === 'br' ? '\n' : rawText(childrenOf(node)),
    )
    .join('');
}

/** @param {any} node */
function isMermaid(node) {
  const marked = (/** @type {any} */ n) =>
    classes(n).includes('language-mermaid') || attr(n, 'data-origin') === 'legacy-mermaid';
  return (
    marked(node) ||
    childrenOf(node).some(
      (child) => typeof child !== 'string' && child.tag === 'code' && marked(child),
    )
  );
}

/** @param {any} node @param {any} ctx @returns {Block[]} */
function codeBlocks(node, ctx) {
  const text = rawText(childrenOf(node)).replace(/\r\n?/g, '\n').replace(/\n$/, '');
  return [
    { type: 'code', text, ...(isMermaid(node) ? { caption: ctx.labels.mermaidSource } : {}) },
  ];
}

/** @param {any} node @param {any} ctx @param {any} env @returns {Block[]} */
function listBlocks(node, ctx, env) {
  const ordered = node.tag === 'ol';
  const start = ordered ? positiveInt(attr(node, 'start')) : undefined;
  const parent = env.scope;
  const reuse = parent && parent.ordered === ordered && !start;
  const scope = {
    ordered,
    start,
    level: parent ? Math.min(parent.level + 1, MAX_LIST_LEVEL) : 0,
    listId: reuse ? parent.listId : ctx.listIds.next++,
  };
  return childrenOf(node).flatMap((child) => {
    if (typeof child === 'string') return [];
    if (child.tag !== 'li') return walk([child], ctx, { ...env, scope, item: null });
    const item = { emitted: false };
    const blocks = walk(childrenOf(child), ctx, {
      ...env,
      align: alignOf(child, env.align),
      scope,
      item,
    });
    return item.emitted ? blocks : [listItem([], scope), ...blocks];
  });
}

/** @param {any} node @param {string} name @returns {any[]} */
const childTags = (node, name) =>
  childrenOf(node).filter((child) => typeof child !== 'string' && child.tag === name);

/** @param {any} section @returns {any[]} */
const rowsIn = (section) => childTags(section, 'tr');

/** @param {any} cell @param {any} ctx @returns {TableCell} */
const tableCell = (cell, ctx) => ({
  header: cell.tag === 'th',
  colSpan: positiveInt(attr(cell, 'colspan'), MAX_SPAN) || 1,
  rowSpan: positiveInt(attr(cell, 'rowspan'), MAX_SPAN) || 1,
  blocks: walk(childrenOf(cell), ctx, { align: alignOf(cell, undefined) }),
});

/** @param {any} node @param {any} ctx @returns {Block[]} */
function tableBlocks(node, ctx) {
  const mark = (/** @type {any[]} */ rows, /** @type {boolean} */ head) =>
    rows.map((row) => ({ row, head }));
  const ordered = [
    ...mark(childTags(node, 'thead').flatMap(rowsIn), true),
    ...mark(rowsIn(node), false),
    ...mark(childTags(node, 'tbody').flatMap(rowsIn), false),
    ...mark(childTags(node, 'tfoot').flatMap(rowsIn), false),
  ];
  const rows = ordered
    .map(({ row, head }) => {
      const cells = [...childTags(row, 'th'), ...childTags(row, 'td')]
        .sort((a, b) => childrenOf(row).indexOf(a) - childrenOf(row).indexOf(b))
        .map((cell) => tableCell(cell, ctx));
      return { header: head || (cells.length > 0 && cells.every((cell) => cell.header)), cells };
    })
    .filter((row) => row.cells.length);
  if (!rows.length) return [];
  const caption = childTags(node, 'caption').flatMap((c) =>
    trimInlines(inlinesOf(childrenOf(c), {}, ctx)),
  );
  return [{ type: 'table', ...(caption.length ? { caption } : {}), rows }];
}

/** @param {any} node @returns {string} */
function calloutVariant(node) {
  const found = classes(node).find(
    (name) => name.startsWith('alert-') && CALLOUT_VARIANTS.has(name.slice(6)),
  );
  return found ? found.slice(6) : 'neutral';
}

/** @param {any} node @param {any} ctx @returns {Block[]} */
function headingBlocks(node, ctx) {
  const inlines = trimInlines(inlinesOf(childrenOf(node), {}, ctx));
  const level = Math.min(ctx.headingBase + Number(node.tag.slice(1)), MAX_HEADING_LEVEL);
  return hasContent(inlines) ? [{ type: 'heading', level, inlines }] : [];
}

/** @param {any} node @param {any} ctx @param {any} env @returns {Block[]} */
function blockFor(node, ctx, env) {
  const align = alignOf(node, env.align);
  if (HEADING_TAG.test(node.tag)) return headingBlocks(node, ctx);
  if (node.tag === 'ul' || node.tag === 'ol') return listBlocks(node, ctx, { ...env, align });
  if (node.tag === 'pre') return codeBlocks(node, ctx);
  if (node.tag === 'table') return tableBlocks(node, ctx);
  if (node.tag === 'hr') return [{ type: 'paragraph', inlines: [], rule: true }];
  if (node.tag === 'div' && classes(node).includes('alert'))
    return [
      {
        type: 'callout',
        variant: calloutVariant(node),
        blocks: walk(childrenOf(node), ctx, { align }),
      },
    ];
  const style =
    node.tag === 'blockquote' ? 'Quote' : node.tag === 'figcaption' ? 'Caption' : env.style;
  return walk(childrenOf(node), ctx, { ...env, align, style });
}

/**
 * Block-aware walk: inline runs collect into paragraphs, block tags flush them.
 * @param {any[]} nodes @param {any} ctx
 * @param {{ align?: string, style?: string, scope?: any, item?: { emitted: boolean } | null }} env
 * @returns {Block[]}
 */
function walk(nodes, ctx, env) {
  /** @type {Block[]} */
  const out = [];
  /** @type {Inline[]} */
  let run = [];
  const flush = () => {
    const inlines = trimInlines(run);
    run = [];
    if (hasContent(inlines)) out.push(paragraphBlock(inlines, env));
  };
  for (const node of nodes) {
    if (typeof node === 'string' || INLINE_TAGS.has(node.tag))
      run.push(...inlinesOf([node], {}, ctx));
    else {
      flush();
      out.push(...blockFor(node, ctx, env));
    }
  }
  flush();
  return out;
}

/**
 * Converts a `card-atlas:document` (the object with `components`, or the node array itself) to IR blocks.
 * Inputs are never mutated.
 *
 * List ids: pass one shared `listIds` object (conventionally `{ next: 1 }`) for a whole Word document.
 * Every root `ul`/`ol` takes `listIds.next++`; the counter is mutated so ids stay unique across cards.
 * A nested list reuses its parent's `listId` when it has the same ordered flag and no `start`, otherwise it
 * takes a new id. `start` is set on every item of an `ol` that has a valid `start` attribute.
 * Without `listIds` a private counter starting at 1 is used.
 *
 * @param {{ components?: any[] } | any[] | null | undefined} doc
 * @param {BlockOptions} options
 * @returns {Block[]}
 */
export function documentBlocks(doc, { cardId, headingBase = 0, images = {}, labels, listIds }) {
  const nodes = Array.isArray(doc) ? doc : doc?.components;
  if (!Array.isArray(nodes)) return [];
  const ctx = {
    cardId,
    headingBase,
    images: images || {},
    labels,
    listIds: listIds || { next: FIRST_LIST_ID },
  };
  return walk(nodes, ctx, {});
}
