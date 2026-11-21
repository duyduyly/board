import { fitImage, imageSize } from './media.js';
import {
  NS,
  REL_TYPES,
  TEXT_WIDTH_PX,
  PAGE,
  contentTypesXml,
  coreXml,
  documentRelsXml,
  footerXml,
  numberingXml,
  rootRelsXml,
  stylesXml,
  xmlAttr,
  xmlText,
} from './ooxml-parts.js';

/**
 * @typedef {import('./ooxml-parts.js').Relationship} Relationship
 * @typedef {import('./ooxml-parts.js').NumberingList} NumberingList
 * @typedef {{ bold?: boolean, italic?: boolean, underline?: boolean, strike?: boolean, code?: boolean, sub?: boolean, sup?: boolean, color?: string, highlight?: string }} Marks
 * @typedef {{ type: 'text', text: string, marks?: Marks } | { type: 'break' } | { type: 'link', href?: string, anchor?: string, children: Inline[] } | { type: 'image', key: string, mimeType?: string, data?: string, alt: string, widthPx?: number }} Inline
 * @typedef {{ header: boolean, cells: { header: boolean, colSpan: number, rowSpan: number, blocks: Block[] }[] }} TableRow
 * @typedef {{ type: 'heading', level: number, inlines: Inline[], bookmark?: string, card?: boolean } | { type: 'paragraph', inlines: Inline[], style?: string, align?: string, rule?: boolean, spacing?: string } | { type: 'list-item', ordered: boolean, level: number, listId: number, start?: number, inlines: Inline[] } | { type: 'code', text: string, caption?: string } | { type: 'table', caption?: Inline[], rows: TableRow[] } | { type: 'callout', variant: string, blocks: Block[] } | { type: 'toc', title: string, hint: string, tip: string, sections: TocSection[] } | { type: 'page-break' }} Block
 * @typedef {{ label: string | null, entries: { text: string, anchor: string, level: number }[] }} TocSection
 * @typedef {{ title: string, description: string, blocks: Block[] }} DocModel
 * @typedef {{ mimeType: string, bytes: Uint8Array }} ImageSource
 * @typedef {{ fill: string, border: string }} Decor
 * @typedef {{ bold?: boolean, link?: boolean, decor?: Decor, cell?: boolean }} RenderOptions
 * @typedef {{ mimeType: 'image/png', bytes: Uint8Array }} Logo
 * @typedef {{ rId: string, partName: string, ext: string, size: { width: number, height: number }, bytes: Uint8Array }} MediaEntry
 */

const DOCUMENT_PART = 'word/document.xml';
const MEDIA_EXTENSIONS = /** @type {Record<string, string>} */ ({
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/gif': 'gif',
});
const HEADER_PART = 'word/header1.xml';
const HEADER_RELS_PART = 'word/_rels/header1.xml.rels';
const FOOTER_PART = 'word/footer1.xml';
/** Khóa nội bộ của logo trong bảng ảnh, không trùng khóa ảnh của người dùng. */
const LOGO_KEY = 'card-atlas:logo';
const LOGO_ALT = 'Card Atlas';
const COVER_LOGO_WIDTH_PX = 120;
const HEADER_LOGO_HEIGHT_PX = 20;
const HEADER_REL_ID = 'rId1';
const FIRST_FREE_REL = 5;
const MAX_HEADING = 9;
const FONT_CODE = 'Consolas';
const COLOR_HEADER_CELL = 'EAF2F5';
const COLOR_CARD_RULE = 'D9E5EB';
const COLOR_HEADER_TEXT = '808F9A';
const COLOR_TOC_HINT = '63707D';
const COLOR_TOC_LINK = '245579';
const COLOR_TOC_TIP = '717D88';
const TOC_HINT_SIZE = 20;
const TOC_TIP_SIZE = 18;
const HEADER_SIZE = 16;
const TOC_INDENT_TWIPS = 283;
const TOC_TITLE_SPACING = 'w:before="0" w:after="120"';
const COVER_TITLE_SPACING = 'w:before="120"';
const CELL_PARAGRAPH_SPACING = 'w:after="60"';
const CELL_FONT_SIZE = 18;
const COLOR_RULE = 'A6A6A6';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const EXTERNAL_URL = /^(https?:|mailto:)/i;
const CALLOUT_BORDER_SIZE = 6;
const CALLOUT_BORDER_SPACE = 4;
const RULE_BORDER_SIZE = 6;
const CARD_BORDER_SIZE = 6;
const TABLE_WIDTH_PCT = 5000;

/** Màu callout theo biến thể: nền nhạt, viền đậm hơn. */
const CALLOUT_COLORS = /** @type {Record<string, Decor>} */ ({
  info: { fill: 'E8F1FB', border: '5B9BD5' },
  warning: { fill: 'FFF4E0', border: 'F0A500' },
  success: { fill: 'E9F6EC', border: '4CAF50' },
  danger: { fill: 'FDECEA', border: 'E53935' },
  neutral: { fill: 'F5F5F5', border: 'BFBFBF' },
});

const ALIGNMENTS = /** @type {Record<string, string>} */ ({
  left: 'left',
  center: 'center',
  right: 'right',
  justify: 'both',
});

const encoder = new TextEncoder();

/**
 * Trạng thái dựng một lần `docxParts`: quan hệ, media, ID và danh sách numbering.
 * @param {Map<string, ImageSource>} images
 * @param {Logo | undefined} logo
 */
function createContext(images, logo) {
  /** @type {Relationship[]} */
  const rels = [
    { id: 'rId1', type: REL_TYPES.styles, target: 'styles.xml' },
    { id: 'rId2', type: REL_TYPES.numbering, target: 'numbering.xml' },
    { id: 'rId3', type: REL_TYPES.header, target: 'header1.xml' },
    { id: 'rId4', type: REL_TYPES.footer, target: 'footer1.xml' },
  ];
  return {
    images: logo ? new Map([...images, [LOGO_KEY, logo]]) : images,
    rels,
    nextRel: FIRST_FREE_REL,
    /** @type {Map<string, MediaEntry>} */
    media: new Map(),
    /** @type {Map<string, string>} */
    links: new Map(),
    /** @type {Map<number, NumberingList>} */
    lists: new Map(),
    docPrId: 0,
    bookmarkId: 0,
    skippedImages: 0,
  };
}

/** @typedef {ReturnType<typeof createContext>} Context */

/** @param {Context} ctx @param {string} type @param {string} target @param {boolean} [external] @returns {string} */
function addRel(ctx, type, target, external) {
  const id = `rId${ctx.nextRel++}`;
  ctx.rels.push({ id, type, target, ...(external ? { external: true } : {}) });
  return id;
}

/** @param {Context} ctx @param {string} href @returns {string} */
function linkRel(ctx, href) {
  let id = ctx.links.get(href);
  if (!id) {
    id = addRel(ctx, REL_TYPES.hyperlink, href, true);
    ctx.links.set(href, id);
  }
  return id;
}

/** @param {Context} ctx @param {string} key @returns {MediaEntry | null} */
function mediaFor(ctx, key) {
  const known = ctx.media.get(key);
  if (known) return known;
  const source = ctx.images.get(key);
  const ext = source ? MEDIA_EXTENSIONS[source.mimeType] : undefined;
  const size = source && ext ? imageSize(source.bytes, source.mimeType) : null;
  if (!source || !ext || !size) return null;
  const partName = `word/media/image${ctx.media.size + 1}.${ext}`;
  const entry = {
    rId: addRel(ctx, REL_TYPES.image, partName.replace('word/', '')),
    partName,
    ext,
    size,
    bytes: source.bytes,
  };
  ctx.media.set(key, entry);
  return entry;
}

/** @param {string} text @returns {string} */
function runContent(text) {
  return text
    .split(/(\t|\r\n|\n|\r)/)
    .map((part) => {
      if (part === '') return '';
      if (part === '\t') return '<w:tab/>';
      if (/^[\r\n]/.test(part)) return '<w:br/>';
      return `<w:t xml:space="preserve">${xmlText(part)}</w:t>`;
    })
    .join('');
}

/** @param {string | undefined} color @returns {string | null} */
const hexColor = (color) => (color && HEX_COLOR.test(color) ? color.slice(1).toUpperCase() : null);

/** @param {Marks} marks @param {RenderOptions} opts @returns {string} */
function runProps(marks, opts) {
  const color = hexColor(marks.color);
  const fill = hexColor(marks.highlight);
  const parts = [
    opts.link ? '<w:rStyle w:val="Hyperlink"/>' : '',
    marks.code
      ? `<w:rFonts w:ascii="${FONT_CODE}" w:hAnsi="${FONT_CODE}" w:cs="${FONT_CODE}"/>`
      : '',
    marks.bold || opts.bold ? '<w:b/>' : '',
    marks.italic ? '<w:i/>' : '',
    marks.strike ? '<w:strike/>' : '',
    color ? `<w:color w:val="${color}"/>` : '',
    opts.cell ? `<w:sz w:val="${CELL_FONT_SIZE}"/><w:szCs w:val="${CELL_FONT_SIZE}"/>` : '',
    marks.underline ? '<w:u w:val="single"/>' : '',
    fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : '',
    marks.sup
      ? '<w:vertAlign w:val="superscript"/>'
      : marks.sub
        ? '<w:vertAlign w:val="subscript"/>'
        : '',
  ].join('');
  return parts ? `<w:rPr>${parts}</w:rPr>` : '';
}

/** @param {string} text @param {Marks} marks @param {RenderOptions} opts @returns {string} */
function textRun(text, marks, opts) {
  const content = runContent(text);
  return content ? `<w:r>${runProps(marks, opts)}${content}</w:r>` : '';
}

/** @param {Context} ctx @param {MediaEntry} media @param {{ alt: string, widthPx?: number }} image @param {string} [rId] quan hệ ảnh của part chứa run; mặc định của document @returns {string} */
function drawingRun(ctx, media, image, rId = media.rId) {
  const { cx, cy } = fitImage(media.size, { widthPx: image.widthPx, maxWidthPx: TEXT_WIDTH_PX });
  const id = ++ctx.docPrId;
  const name = `Picture ${id}`;
  return (
    '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:docPr id="${id}" name="${name}" descr="${xmlAttr(image.alt)}"/>` +
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
    `<a:graphic><a:graphicData uri="${NS.pic}"><pic:pic>` +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="${name}" descr="${xmlAttr(image.alt)}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
  );
}

/** @param {Context} ctx @param {Extract<Inline, { type: 'image' }>} image @param {RenderOptions} opts @returns {string} */
function imageRun(ctx, image, opts) {
  const media = mediaFor(ctx, image.key);
  if (media) return drawingRun(ctx, media, image);
  ctx.skippedImages++;
  return textRun(`[${image.alt}]`, {}, opts);
}

/** @param {Context} ctx @param {Extract<Inline, { type: 'link' }>} link @param {RenderOptions} opts @returns {string} */
function linkRun(ctx, link, opts) {
  const inner = renderInlines(ctx, link.children, { ...opts, link: true });
  if (link.anchor)
    return `<w:hyperlink w:anchor="${xmlAttr(link.anchor)}" w:history="1">${inner}</w:hyperlink>`;
  if (link.href && EXTERNAL_URL.test(link.href))
    return `<w:hyperlink r:id="${linkRel(ctx, link.href)}" w:history="1">${inner}</w:hyperlink>`;
  return renderInlines(ctx, link.children, opts);
}

/** @param {Context} ctx @param {Inline[]} inlines @param {RenderOptions} opts @returns {string} */
function renderInlines(ctx, inlines, opts) {
  return (inlines || [])
    .map((inline) => {
      switch (inline.type) {
        case 'text':
          return textRun(inline.text, inline.marks || {}, opts);
        case 'break':
          return '<w:r><w:br/></w:r>';
        case 'link':
          return linkRun(ctx, inline, opts);
        case 'image':
          return imageRun(ctx, inline, opts);
        default:
          return '';
      }
    })
    .join('');
}

/** @param {string} fill @returns {string} */
const shading = (fill) => `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`;

/** @param {Decor} decor @returns {string} */
function calloutBorders(decor) {
  const side = (/** @type {string} */ name) =>
    `<w:${name} w:val="single" w:sz="${CALLOUT_BORDER_SIZE}" w:space="${CALLOUT_BORDER_SPACE}" w:color="${decor.border}"/>`;
  return `<w:pBdr>${['top', 'left', 'bottom', 'right'].map(side).join('')}</w:pBdr>`;
}

/** @param {string} color @param {number} size @returns {string} */
const bottomRule = (color, size) =>
  `<w:pBdr><w:bottom w:val="single" w:sz="${size}" w:space="1" w:color="${color}"/></w:pBdr>`;

/**
 * Thứ tự con của pPr theo schema: pStyle, numPr, pBdr, shd, spacing, ind, jc.
 * @param {{ style?: string, numPr?: string, rule?: boolean, card?: boolean, decor?: Decor, align?: string, spacing?: string, indentTwips?: number }} p
 * @returns {string}
 */
function paragraphProps({ style, numPr, rule, card, decor, align, spacing, indentTwips }) {
  let borders = '';
  if (rule) borders = bottomRule(COLOR_RULE, RULE_BORDER_SIZE);
  else if (card) borders = bottomRule(COLOR_CARD_RULE, CARD_BORDER_SIZE);
  else if (decor) borders = calloutBorders(decor);
  const jc = align && ALIGNMENTS[align] ? `<w:jc w:val="${ALIGNMENTS[align]}"/>` : '';
  const parts =
    (style ? `<w:pStyle w:val="${xmlAttr(style)}"/>` : '') +
    (numPr || '') +
    borders +
    (decor ? shading(decor.fill) : '') +
    (spacing ? `<w:spacing ${spacing}/>` : '') +
    (indentTwips ? `<w:ind w:left="${indentTwips}"/>` : '') +
    jc;
  return parts ? `<w:pPr>${parts}</w:pPr>` : '';
}

/** @param {Context} ctx @param {Extract<Block, { type: 'heading' }>} block @param {RenderOptions} opts @returns {string} */
function headingXml(ctx, block, opts) {
  const level = Math.min(Math.max(Math.trunc(block.level) || 1, 1), MAX_HEADING);
  const runs = renderInlines(ctx, block.inlines, opts);
  const pPr = paragraphProps({ style: `Heading${level}`, card: block.card, decor: opts.decor });
  if (!block.bookmark) return `<w:p>${pPr}${runs}</w:p>`;
  const id = ctx.bookmarkId++;
  return (
    `<w:p>${pPr}<w:bookmarkStart w:id="${id}" w:name="${xmlAttr(block.bookmark)}"/>` +
    `${runs}<w:bookmarkEnd w:id="${id}"/></w:p>`
  );
}

/** @param {Context} ctx @param {Extract<Block, { type: 'paragraph' }>} block @param {RenderOptions} opts @returns {string} */
function paragraphXml(ctx, block, opts) {
  const pPr = paragraphProps({
    style: block.style && block.style !== 'Normal' ? block.style : undefined,
    rule: block.rule,
    decor: opts.decor,
    align: block.align,
    spacing: block.spacing || (opts.cell ? CELL_PARAGRAPH_SPACING : undefined),
  });
  return `<w:p>${pPr}${renderInlines(ctx, block.inlines, opts)}</w:p>`;
}

/** @param {Context} ctx @param {Extract<Block, { type: 'list-item' }>} block @returns {number} */
function numIdFor(ctx, block) {
  let list = ctx.lists.get(block.listId);
  if (!list) {
    list = { numId: ctx.lists.size + 1, ordered: block.ordered, level: block.level };
    ctx.lists.set(block.listId, list);
  }
  if (list.start === undefined && Number.isFinite(block.start)) {
    list.start = block.start;
    list.level = block.level;
  }
  return list.numId;
}

/** @param {Context} ctx @param {Extract<Block, { type: 'list-item' }>} block @param {RenderOptions} opts @returns {string} */
function listItemXml(ctx, block, opts) {
  const level = Math.min(Math.max(Math.trunc(block.level) || 0, 0), MAX_HEADING - 1);
  const numPr = `<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numIdFor(ctx, block)}"/></w:numPr>`;
  const pPr = paragraphProps({ style: 'ListParagraph', numPr, decor: opts.decor });
  return `<w:p>${pPr}${renderInlines(ctx, block.inlines, opts)}</w:p>`;
}

/** @param {string} text @returns {string} */
const captionXml = (text) =>
  `<w:p>${paragraphProps({ style: 'Caption' })}${textRun(text, {}, {})}</w:p>`;

/** @param {Extract<Block, { type: 'code' }>} block @returns {string} */
function codeXml(block) {
  const caption = block.caption ? captionXml(block.caption) : '';
  const content = runContent(block.text);
  const run = content ? `<w:r>${content}</w:r>` : '';
  return `${caption}<w:p>${paragraphProps({ style: 'Code' })}${run}</w:p>`;
}

/**
 * @typedef {{ cell?: TableRow['cells'][number], span: number, restart: boolean, continued: boolean, header: boolean }} GridItem
 */

/**
 * Xếp ô vào lưới, chèn ô vMerge continue ở cột còn bị chiếm bởi rowSpan phía trên.
 * @param {TableRow[]} rows
 * @returns {{ items: GridItem[][], columns: number }}
 */
function layoutGrid(rows) {
  /** @type {Map<number, { rows: number, span: number }>} */
  const pending = new Map();
  let columns = 1;
  const items = rows.map((row) => {
    /** @type {GridItem[]} */
    const line = [];
    let col = 0;
    const drain = () => {
      for (let held = pending.get(col); held; held = pending.get(col)) {
        line.push({ span: held.span, restart: false, continued: true, header: row.header });
        held.rows--;
        if (held.rows <= 0) pending.delete(col);
        col += held.span;
      }
    };
    for (const cell of row.cells) {
      drain();
      const span = Math.max(1, Math.trunc(cell.colSpan) || 1);
      const rowSpan = Math.max(1, Math.trunc(cell.rowSpan) || 1);
      if (rowSpan > 1) pending.set(col, { rows: rowSpan - 1, span });
      line.push({ cell, span, restart: rowSpan > 1, continued: false, header: cell.header });
      col += span;
    }
    drain();
    columns = Math.max(columns, col);
    return line;
  });
  for (const line of items) {
    const used = line.reduce((sum, item) => sum + item.span, 0);
    if (used < columns)
      line.push({ span: columns - used, restart: false, continued: false, header: false });
  }
  return { items, columns };
}

/** @param {string} blocksXml @returns {string} */
const ensureCellParagraph = (blocksXml) =>
  !blocksXml || blocksXml.endsWith('</w:tbl>') ? `${blocksXml}<w:p/>` : blocksXml;

/** @param {Context} ctx @param {GridItem} item @param {number} columnWidth @returns {string} */
function cellXml(ctx, item, columnWidth) {
  const merge = item.continued ? '<w:vMerge/>' : item.restart ? '<w:vMerge w:val="restart"/>' : '';
  const tcPr =
    `<w:tcW w:w="${columnWidth * item.span}" w:type="dxa"/>` +
    (item.span > 1 ? `<w:gridSpan w:val="${item.span}"/>` : '') +
    merge +
    (item.header ? shading(COLOR_HEADER_CELL) : '') +
    '<w:vAlign w:val="center"/>';
  const body = item.cell
    ? renderBlocks(ctx, item.cell.blocks, { bold: item.header, cell: true })
    : '';
  return `<w:tc><w:tcPr>${tcPr}</w:tcPr>${ensureCellParagraph(body)}</w:tc>`;
}

/** @param {Context} ctx @param {Extract<Block, { type: 'table' }>} block @returns {string} */
function tableXml(ctx, block) {
  const caption =
    block.caption && block.caption.length
      ? `<w:p>${paragraphProps({ style: 'Caption' })}${renderInlines(ctx, block.caption, {})}</w:p>`
      : '';
  const { items, columns } = layoutGrid(block.rows);
  const columnWidth = Math.floor(PAGE.textWidthTwips / columns);
  const grid = Array.from({ length: columns }, () => `<w:gridCol w:w="${columnWidth}"/>`).join('');
  const rows = items
    .map((line, index) => {
      const header = block.rows[index].header ? '<w:trPr><w:tblHeader/></w:trPr>' : '';
      return `<w:tr>${header}${line.map((item) => cellXml(ctx, item, columnWidth)).join('')}</w:tr>`;
    })
    .join('');
  const tblPr =
    `<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="${TABLE_WIDTH_PCT}" w:type="pct"/><w:jc w:val="center"/>` +
    '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>';
  return `${caption}<w:tbl>${tblPr}<w:tblGrid>${grid}</w:tblGrid>${rows}</w:tbl>`;
}

/** @param {Context} ctx @param {Extract<Block, { type: 'callout' }>} block @param {RenderOptions} opts @returns {string} */
function calloutXml(ctx, block, opts) {
  const decor = CALLOUT_COLORS[block.variant] || CALLOUT_COLORS.neutral;
  return renderBlocks(ctx, block.blocks, { ...opts, decor });
}

/**
 * Đoạn một run cho trang mục lục; thứ tự rPr theo schema: b, i, caps, color, sz.
 * @param {string} text
 * @param {{ bold?: boolean, italic?: boolean, caps?: boolean, color?: string, size?: number }} [look]
 * @returns {string}
 */
function tocParagraph(text, { bold, italic, caps, color, size } = {}) {
  const props =
    (bold ? '<w:b/>' : '') +
    (italic ? '<w:i/>' : '') +
    (caps ? '<w:caps/>' : '') +
    (color ? `<w:color w:val="${color}"/>` : '') +
    (size ? `<w:sz w:val="${size}"/>` : '');
  const rPr = props ? `<w:rPr>${props}</w:rPr>` : '';
  return `<w:p><w:r>${rPr}<w:t xml:space="preserve">${xmlText(text)}</w:t></w:r></w:p>`;
}

/** @param {{ text: string, anchor: string, level: number }} entry @returns {string} */
function tocEntryXml({ text, anchor, level }) {
  const indentTwips = TOC_INDENT_TWIPS * Math.max(0, Math.trunc(level) || 0);
  const run = `<w:r><w:rPr><w:color w:val="${COLOR_TOC_LINK}"/></w:rPr><w:t xml:space="preserve">${xmlText(text)}</w:t></w:r>`;
  return (
    `<w:p>${paragraphProps({ style: 'MenuLink', indentTwips })}` +
    `<w:hyperlink w:anchor="${xmlAttr(anchor)}" w:history="1">${run}</w:hyperlink></w:p>`
  );
}

/** @param {Extract<Block, { type: 'toc' }>} block @returns {string} */
function tocXml(block) {
  const title = `<w:p>${paragraphProps({ style: 'Heading1', spacing: TOC_TITLE_SPACING })}<w:r><w:t xml:space="preserve">${xmlText(block.title)}</w:t></w:r></w:p>`;
  const sections = block.sections
    .map(
      (section) =>
        (section.label === null ? '' : tocParagraph(section.label, { bold: true, caps: true })) +
        section.entries.map(tocEntryXml).join(''),
    )
    .join('');
  return (
    title +
    tocParagraph(block.hint, { color: COLOR_TOC_HINT, size: TOC_HINT_SIZE }) +
    sections +
    tocParagraph(block.tip, { italic: true, color: COLOR_TOC_TIP, size: TOC_TIP_SIZE })
  );
}

/** @param {Context} ctx @param {Block} block @param {RenderOptions} opts @returns {string} */
function renderBlock(ctx, block, opts) {
  switch (block.type) {
    case 'heading':
      return headingXml(ctx, block, opts);
    case 'paragraph':
      return paragraphXml(ctx, block, opts);
    case 'list-item':
      return listItemXml(ctx, block, opts);
    case 'code':
      return codeXml(block);
    case 'table':
      return tableXml(ctx, block);
    case 'callout':
      return calloutXml(ctx, block, opts);
    case 'toc':
      return tocXml(block);
    case 'page-break':
      return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    default:
      return '';
  }
}

/** @param {Context} ctx @param {Block[]} blocks @param {RenderOptions} opts @returns {string} */
function renderBlocks(ctx, blocks, opts) {
  return (blocks || []).map((block) => renderBlock(ctx, block, opts)).join('');
}

/** @returns {string} */
function sectionProps() {
  return (
    `<w:sectPr><w:headerReference w:type="default" r:id="rId3"/><w:footerReference w:type="default" r:id="rId4"/>` +
    `<w:pgSz w:w="${PAGE.widthTwips}" w:h="${PAGE.heightTwips}"/>` +
    `<w:pgMar w:top="${PAGE.marginTopTwips}" w:right="${PAGE.marginRightTwips}" w:bottom="${PAGE.marginBottomTwips}" ` +
    `w:left="${PAGE.marginLeftTwips}" w:header="${PAGE.headerTwips}" w:footer="${PAGE.footerTwips}" w:gutter="0"/></w:sectPr>`
  );
}

/** @returns {string} */
function namespaceAttrs() {
  return Object.entries(NS)
    .map(([prefix, uri]) => `xmlns:${prefix}="${uri}"`)
    .join(' ');
}

/** Đoạn logo cho trang bìa; chuỗi rỗng khi không có logo hợp lệ. @param {Context} ctx @returns {string} */
function coverLogoXml(ctx) {
  const media = mediaFor(ctx, LOGO_KEY);
  if (!media) return '';
  return `<w:p>${drawingRun(ctx, media, { alt: LOGO_ALT, widthPx: COVER_LOGO_WIDTH_PX })}</w:p>`;
}

/**
 * Header: một đoạn căn phải gồm logo nhỏ (nếu có), khoảng trắng và tên dự án.
 * @param {Context} ctx
 * @param {string} title
 * @returns {string}
 */
function headerXml(ctx, title) {
  const media = mediaFor(ctx, LOGO_KEY);
  const widthPx = media ? (HEADER_LOGO_HEIGHT_PX * media.size.width) / media.size.height : 0;
  const logo = media
    ? drawingRun(ctx, media, { alt: LOGO_ALT, widthPx }, HEADER_REL_ID) +
      '<w:r><w:t xml:space="preserve"> </w:t></w:r>'
    : '';
  const name = title
    ? `<w:r><w:rPr><w:caps/><w:color w:val="${COLOR_HEADER_TEXT}"/><w:sz w:val="${HEADER_SIZE}"/></w:rPr>` +
      `<w:t xml:space="preserve">${xmlText(title)}</w:t></w:r>`
    : '';
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${namespaceAttrs()}>` +
    `<w:p><w:pPr><w:jc w:val="right"/></w:pPr>${logo}${name}</w:p></w:hdr>`
  );
}

/** @param {Context} ctx @param {DocModel} model @returns {string} */
function documentXml(ctx, model) {
  const logo = coverLogoXml(ctx);
  const head = [];
  if (model.title)
    head.push({
      type: 'paragraph',
      style: 'Title',
      spacing: logo ? COVER_TITLE_SPACING : undefined,
      inlines: [{ type: 'text', text: model.title }],
    });
  if (model.description)
    head.push({
      type: 'paragraph',
      style: 'Subtitle',
      inlines: [{ type: 'text', text: model.description }],
    });
  const body =
    logo +
    renderBlocks(ctx, /** @type {Block[]} */ (head), {}) +
    renderBlocks(ctx, model.blocks, {});
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${namespaceAttrs()}><w:body>${body}${sectionProps()}</w:body></w:document>`;
}

/**
 * Dựng các part của file .docx từ DocModel; chưa nén ZIP.
 * @param {DocModel} model
 * @param {{ images: Map<string, ImageSource>, logo?: Logo }} options
 * @returns {{ files: { name: string, data: Uint8Array }[], skippedImages: number }}
 */
export function docxParts(model, { images, logo }) {
  const ctx = createContext(images || new Map(), logo);
  const document = documentXml(ctx, model);
  const header = headerXml(ctx, model.title);
  const logoMedia = ctx.media.get(LOGO_KEY);
  const media = [...ctx.media.values()];
  const text = [
    ['[Content_Types].xml', contentTypesXml(media.map((m) => m.ext))],
    ['_rels/.rels', rootRelsXml()],
    [DOCUMENT_PART, document],
    ['word/_rels/document.xml.rels', documentRelsXml(ctx.rels)],
    [HEADER_PART, header],
    [FOOTER_PART, footerXml()],
    ['word/styles.xml', stylesXml()],
    ['word/numbering.xml', numberingXml([...ctx.lists.values()])],
    ['docProps/core.xml', coreXml(model.title)],
  ];
  if (logoMedia)
    text.push([
      HEADER_RELS_PART,
      documentRelsXml([
        {
          id: HEADER_REL_ID,
          type: REL_TYPES.image,
          target: logoMedia.partName.replace('word/', ''),
        },
      ]),
    ]);
  const files = [
    ...text.map(([name, xml]) => ({ name, data: encoder.encode(xml) })),
    ...media.map((m) => ({ name: m.partName, data: m.bytes })),
  ];
  return { files, skippedImages: ctx.skippedImages };
}
