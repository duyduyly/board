/**
 * Các part OOXML tĩnh hoặc gần tĩnh của file .docx; thuần chuỗi, không DOM/store.
 * @typedef {{ id: string, type: string, target: string, external?: boolean }} Relationship
 * @typedef {{ numId: number, ordered: boolean, level: number, start?: number }} NumberingList
 */

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** A4 theo twip (1/20 pt); lề, header và footer theo template Claude_With_Menu. */
const PAGE_WIDTH_TWIPS = 11906;
const PAGE_HEIGHT_TWIPS = 16838;
const PAGE_MARGIN_TOP_TWIPS = 1123;
const PAGE_MARGIN_RIGHT_TWIPS = 1267;
const PAGE_MARGIN_BOTTOM_TWIPS = 1080;
const PAGE_MARGIN_LEFT_TWIPS = 1296;
const PAGE_HEADER_TWIPS = 533;
const PAGE_FOOTER_TWIPS = 576;
const TWIPS_PER_PIXEL = 15;

export const PAGE = {
  widthTwips: PAGE_WIDTH_TWIPS,
  heightTwips: PAGE_HEIGHT_TWIPS,
  marginTopTwips: PAGE_MARGIN_TOP_TWIPS,
  marginRightTwips: PAGE_MARGIN_RIGHT_TWIPS,
  marginBottomTwips: PAGE_MARGIN_BOTTOM_TWIPS,
  marginLeftTwips: PAGE_MARGIN_LEFT_TWIPS,
  headerTwips: PAGE_HEADER_TWIPS,
  footerTwips: PAGE_FOOTER_TWIPS,
  textWidthTwips: PAGE_WIDTH_TWIPS - PAGE_MARGIN_LEFT_TWIPS - PAGE_MARGIN_RIGHT_TWIPS,
};

/** Bề rộng vùng chữ A4 theo pixel 96 DPI, dùng làm trần cho ảnh. */
export const TEXT_WIDTH_PX = Math.floor(PAGE.textWidthTwips / TWIPS_PER_PIXEL);

export const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
};

const REL_BASE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const REL_TYPES = {
  document: `${REL_BASE}/officeDocument`,
  styles: `${REL_BASE}/styles`,
  numbering: `${REL_BASE}/numbering`,
  image: `${REL_BASE}/image`,
  header: `${REL_BASE}/header`,
  footer: `${REL_BASE}/footer`,
  hyperlink: `${REL_BASE}/hyperlink`,
  coreProperties:
    'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
};

const FONT_TEXT = 'Aptos';
const FONT_CODE = 'Consolas';
const COLOR_TEXT = '252E39';
const COLOR_NAVY = '1B3755';
const COLOR_TEAL = '1D6E7A';
const COLOR_HEADING_MINOR = '1F3864';
const COLOR_MUTED = '595959';
const COLOR_SUBTLE = '5C6978';
const COLOR_QUOTE = '374B5F';
const COLOR_CODE = '263B4B';
const COLOR_LINK = '0563C1';
const COLOR_MENU_LINK = '224769';
const COLOR_CODE_FILL = 'F2F2F2';
const COLOR_RULE = 'BFBFBF';
const COLOR_FOOTER = '5C6978';
const FOOTER_SIZE = 16;
const HEADING_LEVELS = 9;
/** Thông số heading theo cấp 1..9: cỡ chữ (half-point), màu, spacing before/after (twip). */
const HEADING_SPECS = [
  { size: 34, color: COLOR_NAVY, before: 380, after: 160 },
  { size: 28, color: COLOR_NAVY, before: 300, after: 120 },
  { size: 24, color: COLOR_NAVY, before: 240, after: 100 },
  { size: 22, color: COLOR_TEAL, before: 200, after: 80 },
  ...Array.from({ length: HEADING_LEVELS - 4 }, () => ({
    size: 22,
    color: COLOR_HEADING_MINOR,
    before: 240,
    after: 80,
  })),
];
const NUMBERING_LEVELS = 9;
const NUMBERING_INDENT_TWIPS = 567;
const NUMBERING_HANGING_TWIPS = 283;
const BULLET_GLYPHS = ['•', '◦', '▪'];
const ORDERED_FORMATS = ['decimal', 'lowerLetter', 'lowerRoman'];
const ABSTRACT_BULLET = 0;
const ABSTRACT_ORDERED = 1;

const INVALID_XML_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const XML_ESCAPES = /** @type {Record<string, string>} */ ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
});

/**
 * Loại ký tự XML không hợp lệ rồi escape; dùng cho cả text và giá trị thuộc tính.
 * @param {unknown} value
 * @returns {string}
 */
export function xmlText(value) {
  return String(value ?? '')
    .replace(INVALID_XML_CHARS, '')
    .replace(/[&<>"']/g, (ch) => XML_ESCAPES[ch]);
}

export const xmlAttr = xmlText;

const MEDIA_TYPES = /** @type {Record<string, string>} */ ({
  png: 'image/png',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
});

/**
 * @param {string[]} extensions phần mở rộng ảnh thực có (png, jpeg, gif)
 * @returns {string}
 */
export function contentTypesXml(extensions) {
  const media = [...new Set(extensions)]
    .sort()
    .filter((ext) => MEDIA_TYPES[ext])
    .map((ext) => `<Default Extension="${ext}" ContentType="${MEDIA_TYPES[ext]}"/>`)
    .join('');
  const word = 'application/vnd.openxmlformats-officedocument.wordprocessingml';
  return (
    `${XML_DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    media +
    `<Override PartName="/word/document.xml" ContentType="${word}.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="${word}.styles+xml"/>` +
    `<Override PartName="/word/numbering.xml" ContentType="${word}.numbering+xml"/>` +
    `<Override PartName="/word/header1.xml" ContentType="${word}.header+xml"/>` +
    `<Override PartName="/word/footer1.xml" ContentType="${word}.footer+xml"/>` +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '</Types>'
  );
}

/** @param {Relationship[]} rels @returns {string} */
function relationshipsXml(rels) {
  const items = rels
    .map(
      (rel) =>
        `<Relationship Id="${xmlAttr(rel.id)}" Type="${rel.type}" Target="${xmlAttr(rel.target)}"` +
        `${rel.external ? ' TargetMode="External"' : ''}/>`,
    )
    .join('');
  return `${XML_DECLARATION}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items}</Relationships>`;
}

/** @returns {string} */
export function rootRelsXml() {
  return relationshipsXml([
    { id: 'rId1', type: REL_TYPES.document, target: 'word/document.xml' },
    { id: 'rId2', type: REL_TYPES.coreProperties, target: 'docProps/core.xml' },
  ]);
}

/** @param {Relationship[]} rels @returns {string} */
export function documentRelsXml(rels) {
  return relationshipsXml(rels);
}

/** @param {string} title @returns {string} */
export function coreXml(title) {
  return (
    `${XML_DECLARATION}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${xmlText(title)}</dc:title></cp:coreProperties>`
  );
}

/** @param {string} font @returns {string} */
const fonts = (font) =>
  `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/>`;

/**
 * @param {string} id
 * @param {string} name
 * @param {{ basedOn?: string, next?: string, type?: string, pPr?: string, rPr?: string, extra?: string, defaultStyle?: boolean, custom?: boolean }} [opts]
 * @returns {string}
 */
function style(
  id,
  name,
  { basedOn, next, type = 'paragraph', pPr = '', rPr = '', extra = '', defaultStyle, custom } = {},
) {
  return (
    `<w:style w:type="${type}"${defaultStyle ? ' w:default="1"' : ''}${custom ? ' w:customStyle="1"' : ''} w:styleId="${id}">` +
    `<w:name w:val="${name}"/>` +
    (basedOn ? `<w:basedOn w:val="${basedOn}"/>` : '') +
    (next ? `<w:next w:val="${next}"/>` : '') +
    '<w:qFormat/>' +
    (pPr ? `<w:pPr>${pPr}</w:pPr>` : '') +
    (rPr ? `<w:rPr>${rPr}</w:rPr>` : '') +
    `${extra}</w:style>`
  );
}

/** @param {number} level @returns {string} */
function headingStyle(level) {
  const { size, color, before, after } = HEADING_SPECS[level - 1];
  return style(`Heading${level}`, `heading ${level}`, {
    basedOn: 'Normal',
    next: 'Normal',
    pPr:
      `<w:keepNext/><w:keepLines/><w:spacing w:before="${before}" w:after="${after}" w:line="276" w:lineRule="auto"/>` +
      `<w:outlineLvl w:val="${level - 1}"/>`,
    rPr: `<w:b/><w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`,
  });
}

/** @returns {string} */
function tableGridBorders() {
  const sides = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'];
  return sides
    .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="${COLOR_RULE}"/>`)
    .join('');
}

/** @returns {string} */
export function stylesXml() {
  const headings = Array.from({ length: HEADING_LEVELS }, (_, i) => headingStyle(i + 1)).join('');
  const quoteBorder = `<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="${COLOR_RULE}"/></w:pBdr>`;
  return (
    `${XML_DECLARATION}<w:styles xmlns:w="${NS.w}">` +
    '<w:docDefaults><w:rPrDefault><w:rPr>' +
    `${fonts(FONT_TEXT)}<w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="vi-VN" w:eastAsia="en-US" w:bidi="ar-SA"/>` +
    '</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="295" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    style('Normal', 'Normal', {
      defaultStyle: true,
      pPr: '<w:widowControl/><w:spacing w:after="100" w:line="295" w:lineRule="auto"/>',
      rPr: `${fonts(FONT_TEXT)}<w:color w:val="${COLOR_TEXT}"/><w:sz w:val="21"/><w:szCs w:val="21"/>`,
    }) +
    style('Title', 'Title', {
      basedOn: 'Normal',
      next: 'Normal',
      pPr: '<w:keepNext/><w:keepLines/><w:spacing w:before="0" w:after="220" w:line="276" w:lineRule="auto"/>',
      rPr: `<w:b/><w:color w:val="${COLOR_NAVY}"/><w:sz w:val="50"/><w:szCs w:val="50"/>`,
    }) +
    style('Subtitle', 'Subtitle', {
      basedOn: 'Normal',
      next: 'Normal',
      pPr: '<w:spacing w:after="140"/>',
      rPr: `<w:color w:val="${COLOR_SUBTLE}"/><w:sz w:val="23"/><w:szCs w:val="23"/>`,
    }) +
    style('Lead', 'Lead', {
      basedOn: 'Normal',
      next: 'Normal',
      rPr: `<w:i/><w:color w:val="${COLOR_MUTED}"/>`,
    }) +
    style('Meta', 'Meta', {
      basedOn: 'Normal',
      next: 'Normal',
      pPr: '<w:spacing w:after="140"/>',
      rPr: `<w:color w:val="${COLOR_SUBTLE}"/><w:sz w:val="18"/><w:szCs w:val="18"/>`,
    }) +
    style('Caption', 'caption', {
      basedOn: 'Normal',
      next: 'Normal',
      pPr: '<w:keepNext/><w:spacing w:before="120" w:after="60"/>',
      rPr: `<w:i/><w:color w:val="${COLOR_MUTED}"/><w:sz w:val="20"/><w:szCs w:val="20"/>`,
    }) +
    style('Quote', 'Quote', {
      basedOn: 'Normal',
      next: 'Normal',
      pPr: `${quoteBorder}<w:spacing w:before="100" w:after="160" w:line="300" w:lineRule="auto"/><w:ind w:left="317" w:right="216"/>`,
      rPr: `<w:i/><w:color w:val="${COLOR_QUOTE}"/><w:sz w:val="20"/><w:szCs w:val="20"/>`,
    }) +
    style('Code', 'Code', {
      basedOn: 'Normal',
      next: 'Normal',
      pPr: `<w:keepLines/><w:shd w:val="clear" w:color="auto" w:fill="${COLOR_CODE_FILL}"/><w:spacing w:before="100" w:after="180" w:line="264" w:lineRule="auto"/><w:ind w:left="187" w:right="115"/>`,
      rPr: `${fonts(FONT_CODE)}<w:color w:val="${COLOR_CODE}"/><w:sz w:val="18"/><w:szCs w:val="18"/>`,
    }) +
    style('ListParagraph', 'List Paragraph', {
      basedOn: 'Normal',
      pPr: '<w:spacing w:after="50" w:line="283" w:lineRule="auto"/><w:contextualSpacing/>',
    }) +
    style('MenuLink', 'Menu Link', {
      custom: true,
      basedOn: 'Normal',
      pPr: '<w:spacing w:after="180" w:line="288" w:lineRule="auto"/>',
      rPr: `<w:color w:val="${COLOR_MENU_LINK}"/><w:sz w:val="22"/><w:szCs w:val="22"/>`,
    }) +
    style('LinkItem', 'Link Item', {
      custom: true,
      basedOn: 'Normal',
      pPr: '<w:spacing w:after="60"/><w:ind w:left="245"/>',
    }) +
    headings +
    '<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style>' +
    '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:basedOn w:val="DefaultParagraphFont"/>' +
    `<w:rPr><w:color w:val="${COLOR_LINK}"/><w:u w:val="single"/></w:rPr></w:style>` +
    '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/>' +
    '<w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>' +
    '<w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
    '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/>' +
    `<w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:tblPr><w:tblBorders>${tableGridBorders()}</w:tblBorders></w:tblPr></w:style>` +
    '</w:styles>'
  );
}

/** Footer căn giữa `—  <số trang>  —`. @returns {string} */
export function footerXml() {
  const rPr = `<w:rPr><w:color w:val="${COLOR_FOOTER}"/><w:sz w:val="${FOOTER_SIZE}"/></w:rPr>`;
  const dash = (/** @type {string} */ text) =>
    `<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r>`;
  return (
    `${XML_DECLARATION}<w:ftr xmlns:w="${NS.w}"><w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
    `${dash('—  ')}<w:fldSimple w:instr=" PAGE "><w:r>${rPr}<w:t>1</w:t></w:r></w:fldSimple>${dash('  —')}` +
    '</w:p></w:ftr>'
  );
}

/** @param {number} index @param {boolean} ordered @returns {string} */
function numberingLevel(index, ordered) {
  const text = ordered ? `%${index + 1}.` : BULLET_GLYPHS[index % BULLET_GLYPHS.length];
  const format = ordered ? ORDERED_FORMATS[index % ORDERED_FORMATS.length] : 'bullet';
  const left = NUMBERING_INDENT_TWIPS * (index + 1);
  return (
    `<w:lvl w:ilvl="${index}"><w:start w:val="1"/><w:numFmt w:val="${format}"/>` +
    `<w:lvlText w:val="${xmlAttr(text)}"/><w:lvlJc w:val="left"/>` +
    `<w:pPr><w:ind w:left="${left}" w:hanging="${NUMBERING_HANGING_TWIPS}"/></w:pPr></w:lvl>`
  );
}

/** @param {number} id @param {boolean} ordered @returns {string} */
function abstractNum(id, ordered) {
  const levels = Array.from({ length: NUMBERING_LEVELS }, (_, i) => numberingLevel(i, ordered));
  return `<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="hybridMultilevel"/>${levels.join('')}</w:abstractNum>`;
}

/** @param {NumberingList} list @returns {string} */
function numElement(list) {
  const override =
    list.ordered && Number.isFinite(list.start)
      ? `<w:lvlOverride w:ilvl="${list.level}"><w:startOverride w:val="${Math.trunc(/** @type {number} */ (list.start))}"/></w:lvlOverride>`
      : '';
  const abstractId = list.ordered ? ABSTRACT_ORDERED : ABSTRACT_BULLET;
  return `<w:num w:numId="${list.numId}"><w:abstractNumId w:val="${abstractId}"/>${override}</w:num>`;
}

/** @param {NumberingList[]} lists @returns {string} */
export function numberingXml(lists) {
  return (
    `${XML_DECLARATION}<w:numbering xmlns:w="${NS.w}">` +
    abstractNum(ABSTRACT_BULLET, false) +
    abstractNum(ABSTRACT_ORDERED, true) +
    lists.map(numElement).join('') +
    '</w:numbering>'
  );
}
