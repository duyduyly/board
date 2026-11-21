/**
 * Pure Markdown rendering of the export IR built by `word-export/model.js`: CommonMark plus GitHub
 * tables and alerts. No DOM, i18n or store access; image paths are decided by the caller.
 *
 * @typedef {import('../word-export/document-blocks.js').Block} Block
 * @typedef {import('../word-export/document-blocks.js').Inline} Inline
 * @typedef {import('../word-export/document-blocks.js').Marks} Marks
 * @typedef {import('../word-export/model.js').DocModel} DocModel
 * @typedef {{ label: string | null, entries: { text: string, anchor: string, level: number }[] }} TocSection
 * @typedef {{ images: Map<string, string>, skippedImages: number }} Context
 * @typedef {{ cell?: boolean }} InlineOptions
 */

const MAX_HEADING_LEVEL = 6;
// The project title is the only level-1 heading, so every heading of the model moves down one level.
const HEADING_SHIFT = 1;
const LOGO_ALT = 'Card Atlas';
const LOGO_WIDTH_PX = 120;
const MIN_FENCE = 3;
const TOC_INDENT = '  ';
const BLOCK_GAP = '\n\n';
const RULE = '---';
const ALERTS = /** @type {Record<string, string>} */ ({
  info: 'NOTE',
  warning: 'WARNING',
  success: 'TIP',
  danger: 'CAUTION',
});
// Paragraph styles of the model that are secondary text (summary, group description, type/tags).
const EMPHASIZED_STYLES = new Set(['Subtitle', 'Lead', 'Meta']);
const LINK_STYLE = 'LinkItem';
const SPECIAL = /[\\`*_[\]<>~|&]/g;
const BLOCK_START = /^([#>+=-]|\d{1,9}(?=[.)]))/;
const CLOSING_HASHES = /(\s)(#+)\s*$/;
const UNSAFE_URL_CHARS = /[\s()<>]/g;
const HTML_ATTR_CHARS = /[&"<>]/g;
const HTML_ENTITIES = /** @type {Record<string, string>} */ ({
  '&': '&amp;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;',
});

/** Escapes text so Markdown shows it literally; newlines become spaces. @param {string} value */
const escapeText = (value) =>
  String(value)
    .replace(/\s*\n\s*/g, ' ')
    .replace(SPECIAL, '\\$&');

/** @param {string} value */
const escapeAttr = (value) => String(value).replace(HTML_ATTR_CHARS, (c) => HTML_ENTITIES[c]);

/** @param {string} url */
const escapeUrl = (url) =>
  url.replace(UNSAFE_URL_CHARS, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** Keeps a line from being read as a heading, quote, list item or rule. @param {string} line */
function guardBlockStart(line) {
  const trimmed = line.replace(/^[ \t]+/, '');
  const match = BLOCK_START.exec(trimmed);
  if (!match) return trimmed;
  return /\d/.test(match[1]) ? match[1] + '\\' + trimmed.slice(match[1].length) : '\\' + trimmed;
}

/** The marks that change Markdown output, as a comparable key. @param {Marks | undefined} marks */
const marksKey = (marks = {}) =>
  ['bold', 'italic', 'underline', 'strike', 'code', 'sub', 'sup', 'highlight']
    .filter((name) => marks[/** @type {keyof Marks} */ (name)])
    .join(' ');

/** A code span whose fence is longer than any backtick run inside. @param {string} value */
function codeSpan(value, cell) {
  const text = value.replace(/\n/g, ' ');
  const longest = Math.max(0, ...(text.match(/`+/g) || []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  const pad = /^[` ]|[` ]$/.test(text) ? ' ' : '';
  const body = cell ? text.replace(/\|/g, '\\|') : text;
  return fence + pad + body + pad + fence;
}

/**
 * One run of text with the same marks. Surrounding spaces stay outside the delimiters, which
 * CommonMark would not accept as emphasis otherwise.
 * @param {string} value @param {Marks} marks @param {InlineOptions} opts
 */
function markedText(value, marks, opts) {
  const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(value.replace(/\s*\n\s*/g, ' '));
  if (!core) return lead + trail;
  let out = marks.code ? codeSpan(core, opts.cell) : escapeText(core);
  if (marks.sub) out = '<sub>' + out + '</sub>';
  if (marks.sup) out = '<sup>' + out + '</sup>';
  if (marks.underline) out = '<u>' + out + '</u>';
  if (marks.highlight) out = '<mark>' + out + '</mark>';
  if (marks.strike) out = '~~' + out + '~~';
  if (marks.italic) out = '*' + out + '*';
  if (marks.bold) out = '**' + out + '**';
  return lead + out + trail;
}

/** @param {Context} ctx @param {Extract<Inline, { type: 'image' }>} image */
function imageMarkdown(ctx, image) {
  const path = ctx.images.get(image.key);
  if (!path) {
    ctx.skippedImages++;
    return escapeText('[' + image.alt + ']');
  }
  if (image.widthPx)
    return `<img src="${escapeAttr(path)}" alt="${escapeAttr(image.alt)}" width="${image.widthPx}">`;
  return '![' + escapeText(image.alt) + '](' + escapeUrl(path) + ')';
}

/** @param {Context} ctx @param {Extract<Inline, { type: 'link' }>} link @param {InlineOptions} opts */
function linkMarkdown(ctx, link, opts) {
  const label = renderInlines(ctx, link.children, opts);
  const target = link.anchor ? '#' + link.anchor : link.href;
  if (!target) return label;
  return '[' + (label || escapeText(target)) + '](' + escapeUrl(target) + ')';
}

/**
 * Inline content on one line; adjacent text runs with the same marks are merged first so their
 * delimiters do not touch (`**a****b**`).
 * @param {Context} ctx @param {Inline[] | undefined} inlines @param {InlineOptions} [opts]
 * @returns {string}
 */
function renderInlines(ctx, inlines, opts = {}) {
  let out = '';
  /** @type {{ text: string, marks: Marks, key: string } | null} */
  let run = null;
  const flush = () => {
    if (run) out += markedText(run.text, run.marks, opts);
    run = null;
  };
  for (const inline of inlines || []) {
    if (inline.type === 'text') {
      const key = marksKey(inline.marks);
      if (run && run.key === key) run.text += inline.text;
      else {
        flush();
        run = { text: inline.text, marks: inline.marks || {}, key };
      }
      continue;
    }
    flush();
    if (inline.type === 'break') out += '<br>';
    else if (inline.type === 'link') out += linkMarkdown(ctx, inline, opts);
    else if (inline.type === 'image') out += imageMarkdown(ctx, inline);
  }
  flush();
  return out;
}

/** @param {string} anchor */
const anchorTag = (anchor) => `<a id="${escapeAttr(anchor)}"></a>`;

/** @param {Context} ctx @param {Extract<Block, { type: 'heading' }>} block */
function headingMarkdown(ctx, block) {
  const level = Math.max(1, Math.trunc(block.level) || 1) + HEADING_SHIFT;
  const anchor = block.bookmark ? anchorTag(block.bookmark) : '';
  const content = renderInlines(ctx, block.inlines);
  // Markdown has six heading levels; deeper ones become a bold line.
  if (level > MAX_HEADING_LEVEL) return anchor + (content ? '**' + content + '**' : '');
  return '#'.repeat(level) + ' ' + anchor + content.replace(CLOSING_HASHES, '$1\\$2');
}

/** @param {Context} ctx @param {Extract<Block, { type: 'paragraph' }>} block */
function paragraphMarkdown(ctx, block) {
  if (block.rule) return RULE;
  const content = guardBlockStart(renderInlines(ctx, block.inlines));
  if (!content) return '';
  if (block.style === LINK_STYLE) return '- ' + content;
  if (block.style && EMPHASIZED_STYLES.has(block.style)) return '*' + content + '*';
  return content;
}

/** @param {Extract<Block, { type: 'code' }>} block */
function codeMarkdown(block) {
  const language = /** @type {{ language?: string }} */ (block).language || '';
  const longest = Math.max(0, ...(block.text.match(/`{3,}/g) || []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(MIN_FENCE, longest + 1));
  const code = fence + language + '\n' + (block.text ? block.text + '\n' : '') + fence;
  // A Mermaid fence is drawn by most Markdown viewers, so the "source code" caption is not needed.
  return block.caption && !language
    ? '*' + escapeText(block.caption) + '*' + BLOCK_GAP + code
    : code;
}

/** Cell content on one line: blocks are joined with `<br>`. @param {Context} ctx @param {Block[]} blocks */
function cellMarkdown(ctx, blocks) {
  /** @type {string[]} */
  const lines = [];
  for (const block of blocks || []) {
    if (block.type === 'paragraph' || block.type === 'heading') {
      const text = renderInlines(ctx, block.inlines, { cell: true });
      if (text) lines.push(block.type === 'heading' ? '**' + text + '**' : text);
    } else if (block.type === 'list-item') {
      lines.push('• ' + renderInlines(ctx, block.inlines, { cell: true }));
    } else if (block.type === 'code') {
      lines.push(...block.text.split('\n').map((line) => codeSpan(line, true)));
    } else if (block.type === 'callout') {
      const text = cellMarkdown(ctx, block.blocks);
      if (text) lines.push(text);
    } else if (block.type === 'table') {
      for (const row of block.rows)
        lines.push(row.cells.map((cell) => cellMarkdown(ctx, cell.blocks)).join(' / '));
    }
  }
  return lines.join('<br>');
}

/**
 * Table rows as a grid of cell texts. GitHub tables cannot merge cells, so a merged cell keeps its
 * text in the first slot and leaves the slots it covered empty.
 * @param {Context} ctx @param {Extract<Block, { type: 'table' }>} block
 */
function tableGrid(ctx, block) {
  /** @type {Map<number, { rows: number, span: number }>} */
  const pending = new Map();
  const grid = block.rows.map((row) => {
    /** @type {string[]} */
    const line = [];
    const drain = () => {
      for (let held = pending.get(line.length); held; held = pending.get(line.length)) {
        line.push(...Array(held.span).fill(''));
        if (--held.rows <= 0) pending.delete(line.length - held.span);
      }
    };
    for (const cell of row.cells) {
      drain();
      const span = Math.max(1, Math.trunc(cell.colSpan) || 1);
      const rowSpan = Math.max(1, Math.trunc(cell.rowSpan) || 1);
      if (rowSpan > 1) pending.set(line.length, { rows: rowSpan - 1, span });
      line.push(cellMarkdown(ctx, cell.blocks), ...Array(span - 1).fill(''));
    }
    drain();
    return line;
  });
  const columns = Math.max(1, ...grid.map((line) => line.length));
  return grid.map((line) => [...line, ...Array(columns - line.length).fill('')]);
}

/** @param {Context} ctx @param {Extract<Block, { type: 'table' }>} block */
function tableMarkdown(ctx, block) {
  const grid = tableGrid(ctx, block);
  const columns = grid[0]?.length || 1;
  const row = (/** @type {string[]} */ cells) => '| ' + cells.join(' | ') + ' |';
  // GitHub tables need a header row; a table without one gets an empty header.
  const header = block.rows[0]?.header ? grid.shift() : Array(columns).fill('');
  const lines = [row(header || []), row(Array(columns).fill('---')), ...grid.map(row)];
  const caption = renderInlines(ctx, block.caption);
  return (caption ? '*' + guardBlockStart(caption) + '*' + BLOCK_GAP : '') + lines.join('\n');
}

/** @param {Context} ctx @param {Extract<Block, { type: 'callout' }>} block */
function calloutMarkdown(ctx, block) {
  const body = renderBlocks(ctx, block.blocks);
  const alert = ALERTS[block.variant];
  const lines = [...(alert ? ['[!' + alert + ']'] : []), ...(body ? body.split('\n') : [])];
  return lines.map((line) => (line ? '> ' + line : '>')).join('\n');
}

/** @param {{ title: string, hint: string, sections: TocSection[] }} block */
function tocMarkdown(block) {
  const parts = ['#'.repeat(1 + HEADING_SHIFT) + ' ' + escapeText(block.title)];
  if (block.hint) parts.push('*' + escapeText(block.hint) + '*');
  for (const section of block.sections) {
    if (section.label !== null) parts.push('**' + escapeText(section.label) + '**');
    const entries = section.entries.map(
      ({ text, anchor, level }) =>
        TOC_INDENT.repeat(Math.max(0, Math.trunc(level) || 0)) +
        '- [' +
        escapeText(text) +
        '](#' +
        escapeUrl(anchor) +
        ')',
    );
    if (entries.length) parts.push(entries.join('\n'));
  }
  return parts.join(BLOCK_GAP);
}

/**
 * List numbering and indentation across consecutive list items. A new top-level list right after
 * another one of the same kind switches its marker (`-`/`*`, `.`/`)`), which is how CommonMark
 * starts a separate list.
 */
function listState() {
  /** @type {Map<number, number[]>} */
  const counters = new Map();
  /** @type {number[]} */
  let columns = [];
  /** @type {{ listId: number, ordered: boolean, alternate: boolean } | null} */
  let top = null;
  return {
    reset() {
      columns = [];
      top = null;
    },
    /** @param {Extract<Block, { type: 'list-item' }>} item */
    marker(item) {
      const level = Math.max(0, Math.trunc(item.level) || 0);
      if (level === 0 && (!top || top.listId !== item.listId))
        top = {
          listId: item.listId,
          ordered: item.ordered,
          alternate: Boolean(top && top.ordered === item.ordered && !top.alternate),
        };
      const alternate = level === 0 && Boolean(top?.alternate);
      const counts = counters.get(item.listId) || [];
      counts.length = level + 1;
      counts[level] = (counts[level] ?? (Number.isFinite(item.start) ? item.start : 1) - 1) + 1;
      counters.set(item.listId, counts);
      const marker = item.ordered ? counts[level] + (alternate ? ')' : '.') : alternate ? '*' : '-';
      const indent = level ? (columns[level - 1] ?? level * 4) : 0;
      columns.length = level;
      columns[level] = indent + marker.length + 1;
      return ' '.repeat(indent) + marker;
    },
  };
}

/** @param {Context} ctx @param {Block} block @param {ReturnType<typeof listState>} lists */
function renderBlock(ctx, block, lists) {
  switch (block.type) {
    case 'heading':
      return headingMarkdown(ctx, block);
    case 'paragraph':
      return paragraphMarkdown(ctx, block);
    case 'list-item': {
      const content = guardBlockStart(renderInlines(ctx, block.inlines));
      return lists.marker(block) + (content ? ' ' + content : '');
    }
    case 'code':
      return codeMarkdown(block);
    case 'table':
      return tableMarkdown(ctx, block);
    case 'callout':
      return calloutMarkdown(ctx, block);
    case 'toc':
      return tocMarkdown(/** @type {any} */ (block));
    case 'page-break':
      return RULE;
    default:
      return '';
  }
}

/** Lines that belong together (one list, one block of link lines) are joined without a blank line. */
const groupOf = (/** @type {Block} */ block) =>
  block.type === 'list-item'
    ? 'list'
    : block.type === 'paragraph' && block.style === LINK_STYLE && !block.rule
      ? 'links'
      : null;

/** @param {Context} ctx @param {Block[] | undefined} blocks @returns {string} */
function renderBlocks(ctx, blocks) {
  const lists = listState();
  let out = '';
  /** @type {string | null} */
  let previous = null;
  for (const block of blocks || []) {
    const group = groupOf(block);
    if (group !== 'list') lists.reset();
    const text = renderBlock(ctx, block, lists);
    if (!text) continue;
    if (out) out += group && group === previous ? '\n' : BLOCK_GAP;
    out += text;
    previous = group;
  }
  return out;
}

/**
 * Markdown text for an export model. `images` maps an image key of the model to its path in the
 * archive; an image without a path is written as `[alt]` and counted in `skippedImages`.
 * @param {DocModel} model
 * @param {{ images?: Map<string, string>, logoPath?: string | null }} [options]
 * @returns {{ text: string, skippedImages: number }}
 */
export function markdownDocument(model, { images = new Map(), logoPath = null } = {}) {
  /** @type {Context} */
  const ctx = { images, skippedImages: 0 };
  const head = [];
  if (logoPath)
    head.push(`<img src="${escapeAttr(logoPath)}" alt="${LOGO_ALT}" width="${LOGO_WIDTH_PX}">`);
  if (model.title) head.push('# ' + escapeText(model.title));
  if (model.description) head.push('*' + guardBlockStart(escapeText(model.description)) + '*');
  const body = renderBlocks(ctx, model.blocks);
  const text = [...head, ...(body ? [body] : [])].join(BLOCK_GAP) + '\n';
  return { text, skippedImages: ctx.skippedImages };
}
