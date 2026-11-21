import test from 'node:test';
import assert from 'node:assert/strict';
import { docxParts } from '../assets/js/word-export/ooxml.js';
import { xmlText, xmlAttr } from '../assets/js/word-export/ooxml-parts.js';
import { zipStore } from '../assets/js/word-export/zip.js';
import { readZip, readZipText } from './docx-zip-reader.mjs';

// PNG 2x1 và GIF 3x2 chỉ gồm header đủ để imageSize đọc kích thước.
const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 2,
  0, 0, 0, 1, 8, 6, 0, 0, 0,
]);
const GIF = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 3, 0, 2, 0]);

const text = (value, marks) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const para = (...inlines) => ({ type: 'paragraph', inlines });

function build(model, images = new Map(), logo) {
  const { files, skippedImages } = docxParts(model, { images, logo });
  const bytes = zipStore(files);
  return { files, skippedImages, parts: readZipText(bytes), raw: readZip(bytes) };
}

/** Kiểm thẻ XML cân bằng; thuộc tính đã escape nên không chứa `>`. */
function assertBalanced(name, xml) {
  const stack = [];
  const tag = /<(\/?)([\w:.-]+)[^>]*?(\/?)>/g;
  const body = xml.replace(/<\?xml[^>]*\?>/, '');
  for (let m = tag.exec(body); m; m = tag.exec(body)) {
    const [, closing, tagName, selfClosing] = m;
    if (selfClosing) continue;
    if (closing) assert.equal(stack.pop(), tagName, `${name}: thẻ đóng ${tagName} lệch`);
    else stack.push(tagName);
  }
  assert.deepEqual(stack, [], `${name}: còn thẻ chưa đóng`);
}

const count = (xml, pattern) => (xml.match(pattern) || []).length;
const modelOf = (...blocks) => ({ title: 'Tiêu đề', description: '', blocks });

test('đủ part, mọi part XML cân bằng thẻ', () => {
  const { parts } = build(modelOf(para(text('Xin chào'))));
  for (const name of [
    '[Content_Types].xml',
    '_rels/.rels',
    'word/document.xml',
    'word/_rels/document.xml.rels',
    'word/styles.xml',
    'word/numbering.xml',
    'docProps/core.xml',
    'word/header1.xml',
    'word/footer1.xml',
  ])
    assert.ok(parts.has(name), name);
  for (const [name, xml] of parts) assertBalanced(name, xml);
  const styles = parts.get('word/styles.xml');
  for (const id of [
    'Normal',
    'Title',
    'Subtitle',
    'Lead',
    'Meta',
    'Caption',
    'Quote',
    'Code',
    'MenuLink',
    'LinkItem',
    'Hyperlink',
    'TableGrid',
    'Heading1',
    'Heading9',
  ])
    assert.match(styles, new RegExp(`w:styleId="${id}"`));
  assert.match(styles, /w:ascii="Aptos"/);
  assert.doesNotMatch(styles, /Calibri/);
  assert.match(styles, /w:styleId="MenuLink"[\s\S]*?w:color w:val="224769"/);
  assert.match(styles, /w:styleId="LinkItem"[\s\S]*?<w:ind w:left="245"\/>/);
  assert.match(parts.get('docProps/core.xml'), /<dc:title>Tiêu đề<\/dc:title>/);
});

test('title và description thành Title/Subtitle, sectPr là phần tử cuối body', () => {
  const { parts } = build({ title: 'T', description: 'D', blocks: [para(text('x'))] });
  const doc = parts.get('word/document.xml');
  assert.match(doc, /<w:pStyle w:val="Title"\/>/);
  assert.match(doc, /<w:pStyle w:val="Subtitle"\/>/);
  assert.ok(doc.endsWith('</w:sectPr></w:body></w:document>'));
  assert.match(doc, /w:w="11906" w:h="16838"/);
  assert.equal(count(doc, /<w:sectPr>/g), 1);
});

test('xmlText/xmlAttr escape và lọc ký tự XML không hợp lệ', () => {
  assert.equal(xmlText(`a&b<c>"d"'e'`), 'a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;');
  assert.equal(xmlAttr('x\u0000y\u0008z\uFFFE\uFFFF'), 'xyz');
  assert.equal(xmlText('keep\t\n\r'), 'keep\t\n\r');
  assert.equal(xmlText('lone\uD800high'), 'lonehigh');
  assert.equal(xmlText('lone\uDC00low'), 'lonelow');
  assert.equal(xmlText('pair\uD83D\uDE00'), 'pair\uD83D\uDE00');
  const { parts } = build(modelOf(para(text('a<b & \u0001c'))));
  const doc = parts.get('word/document.xml');
  assert.match(doc, /a&lt;b &amp; c/);
  assert.doesNotMatch(doc, /\u0001/);
});

test('heading có bookmark duy nhất và anchor nội bộ', () => {
  const { parts } = build(
    modelOf(
      { type: 'heading', level: 1, inlines: [text('A')], bookmark: 'c1' },
      { type: 'heading', level: 12, inlines: [text('B')], bookmark: 'c2' },
      para({ type: 'link', anchor: 'c1', children: [text('đến A')] }),
    ),
  );
  const doc = parts.get('word/document.xml');
  const ids = [...doc.matchAll(/<w:bookmarkStart w:id="(\d+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['0', '1']);
  assert.equal(count(doc, /<w:bookmarkEnd /g), 2);
  assert.match(doc, /<w:pStyle w:val="Heading9"\/>/);
  assert.match(
    doc,
    /<w:hyperlink w:anchor="c1" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"\/>/,
  );
});

test('hyperlink ngoài dùng rel External, trùng URL dùng chung rId, scheme lạ thành chữ', () => {
  const link = (href) => ({ type: 'link', href, children: [text('l')] });
  const { parts } = build(
    modelOf(
      para(
        link('https://a.example/x?a=1&b=2'),
        link('https://a.example/x?a=1&b=2'),
        link('javascript:alert(1)'),
      ),
    ),
  );
  const rels = parts.get('word/_rels/document.xml.rels');
  assert.equal(count(rels, /TargetMode="External"/g), 1);
  assert.match(rels, /Target="https:\/\/a\.example\/x\?a=1&amp;b=2"/);
  const doc = parts.get('word/document.xml');
  assert.equal(count(doc, /<w:hyperlink r:id=/g), 2);
  assert.doesNotMatch(doc, /javascript/);
  const rIds = [...rels.matchAll(/Id="(rId\d+)"/g)].map((m) => m[1]);
  assert.equal(new Set(rIds).size, rIds.length);
});

test('inline marks theo thứ tự rPr', () => {
  const { parts } = build(
    modelOf(
      para(
        text('x', {
          bold: true,
          italic: true,
          underline: true,
          strike: true,
          code: true,
          sup: true,
          color: '#ff0000',
          highlight: '#00ff00',
        }),
        text('y', { color: 'red' }),
        { type: 'break' },
      ),
    ),
  );
  const doc = parts.get('word/document.xml');
  assert.match(
    doc,
    /<w:rPr><w:rFonts [^>]*\/><w:b\/><w:i\/><w:strike\/><w:color w:val="FF0000"\/><w:u w:val="single"\/><w:shd [^>]*w:fill="00FF00"\/><w:vertAlign w:val="superscript"\/><\/w:rPr>/,
  );
  assert.equal(count(doc, /<w:color /g), 1);
  assert.match(doc, /<w:r><w:br\/><\/w:r>/);
});

test('code: dòng ngăn w:br, tab thành w:tab, giữ khoảng trắng, caption trước', () => {
  const { parts } = build(modelOf({ type: 'code', text: 'a\n\tb  c\r\nd', caption: 'Mermaid' }));
  const doc = parts.get('word/document.xml');
  assert.ok(doc.indexOf('Mermaid') < doc.indexOf('w:val="Code"'));
  assert.match(
    doc,
    /<w:r><w:t xml:space="preserve">a<\/w:t><w:br\/><w:tab\/><w:t xml:space="preserve">b {2}c<\/w:t><w:br\/><w:t xml:space="preserve">d<\/w:t><\/w:r>/,
  );
});

test('list: numPr, mỗi listId một w:num, ordered có startOverride', () => {
  const item = (listId, ordered, level, start) => ({
    type: 'list-item',
    ordered,
    level,
    listId,
    ...(start === undefined ? {} : { start }),
    inlines: [text('i')],
  });
  const { parts } = build(
    modelOf(
      item(7, false, 0),
      item(7, false, 1),
      item(9, true, 0, 5),
      item(9, true, 0),
      item(11, true, 0),
    ),
  );
  const doc = parts.get('word/document.xml');
  assert.equal(count(doc, /<w:numId w:val="1"\/>/g), 2);
  assert.equal(count(doc, /<w:numId w:val="2"\/>/g), 2);
  assert.match(doc, /<w:numPr><w:ilvl w:val="1"\/><w:numId w:val="1"\/><\/w:numPr>/);
  const numbering = parts.get('word/numbering.xml');
  assert.equal(count(numbering, /<w:abstractNum /g), 2);
  assert.equal(count(numbering, /<w:lvl w:ilvl="[0-8]"/g), 18);
  assert.equal(count(numbering, /<w:num w:numId=/g), 3);
  assert.match(
    numbering,
    /<w:num w:numId="2"><w:abstractNumId w:val="1"\/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="5"\/><\/w:lvlOverride><\/w:num>/,
  );
  assert.equal(count(numbering, /startOverride/g), 1);
  assert.ok(numbering.lastIndexOf('</w:abstractNum>') < numbering.indexOf('<w:num '));
});

const cell = (label, extra = {}) => ({
  header: false,
  colSpan: 1,
  rowSpan: 1,
  blocks: label ? [para(text(label))] : [],
  ...extra,
});

test('table: thứ tự tblPr/tblGrid/tr, header row, caption, tc luôn có p', () => {
  const { parts } = build(
    modelOf({
      type: 'table',
      caption: [text('Bảng 1')],
      rows: [
        { header: true, cells: [cell('H1', { header: true }), cell('H2', { header: true })] },
        { header: false, cells: [cell(''), cell('b')] },
      ],
    }),
  );
  const doc = parts.get('word/document.xml');
  assert.ok(doc.indexOf('Bảng 1') < doc.indexOf('<w:tbl>'));
  assert.ok(doc.indexOf('<w:tblPr>') < doc.indexOf('<w:tblGrid>'));
  assert.ok(doc.indexOf('<w:tblGrid>') < doc.indexOf('<w:tr>'));
  assert.equal(count(doc, /<w:tblHeader\/>/g), 1);
  assert.equal(count(doc, /<w:gridCol /g), 2);
  assert.match(doc, /<w:b\/>/);
  for (const tc of doc.match(/<w:tc>.*?<\/w:tc>/g)) assert.match(tc, /<w:p[ >/]/);
  assert.equal(count(doc, /<w:tc>/g), 4);
});

test('table: colSpan thành gridSpan, rowSpan thành vMerge restart/continue', () => {
  const { parts } = build(
    modelOf({
      type: 'table',
      rows: [
        { header: false, cells: [cell('a', { rowSpan: 2 }), cell('b', { colSpan: 2 })] },
        { header: false, cells: [cell('c'), cell('d')] },
      ],
    }),
  );
  const doc = parts.get('word/document.xml');
  assert.equal(count(doc, /<w:gridCol /g), 3);
  assert.equal(count(doc, /<w:gridSpan w:val="2"\/>/g), 1);
  assert.equal(count(doc, /<w:vMerge w:val="restart"\/>/g), 1);
  assert.equal(count(doc, /<w:vMerge\/>/g), 1);
  const rows = doc.match(/<w:tr>.*?<\/w:tr>/g);
  assert.equal(count(rows[0], /<w:tc>/g), 2);
  assert.equal(count(rows[1], /<w:tc>/g), 3);
  assert.match(rows[1], /^<w:tr><w:tc><w:tcPr><w:tcW [^>]*\/><w:vMerge\/>/);
});

test('table: ô cuối là bảng lồng vẫn có w:p đứng sau', () => {
  const inner = { type: 'table', rows: [{ header: false, cells: [cell('x')] }] };
  const { parts } = build(
    modelOf({ type: 'table', rows: [{ header: false, cells: [cell('', { blocks: [inner] })] }] }),
  );
  const doc = parts.get('word/document.xml');
  assert.match(doc, /<\/w:tbl><w:p\/><\/w:tc>/);
  assertBalanced('document', doc);
});

test('callout: đoạn bên trong có shading và viền theo variant', () => {
  const { parts } = build(
    modelOf(
      { type: 'callout', variant: 'warning', blocks: [para(text('w'))] },
      { type: 'callout', variant: 'lạ', blocks: [para(text('n'))] },
    ),
  );
  const doc = parts.get('word/document.xml');
  assert.match(
    doc,
    /<w:pBdr>(<w:\w+ [^>]*w:color="F0A500"\/>){4}<\/w:pBdr><w:shd [^>]*w:fill="FFF4E0"\/>/,
  );
  assert.match(doc, /w:fill="F5F5F5"/);
});

test('paragraph: style, căn lề, đường kẻ', () => {
  const { parts } = build(
    modelOf(
      { type: 'paragraph', style: 'Quote', align: 'justify', inlines: [text('q')] },
      { type: 'paragraph', rule: true, inlines: [] },
    ),
  );
  const doc = parts.get('word/document.xml');
  assert.match(doc, /<w:pPr><w:pStyle w:val="Quote"\/><w:jc w:val="both"\/><\/w:pPr>/);
  assert.match(doc, /<w:pPr><w:pBdr><w:bottom [^>]*\/><\/w:pBdr><\/w:pPr><\/w:p>/);
});

const image = (key, extra = {}) => ({ type: 'image', key, alt: `alt "${key}"`, ...extra });

test('ảnh: nhúng wp:inline, docPr/rId duy nhất, dùng chung một media part', () => {
  const images = new Map([['a/1', { mimeType: 'image/png', bytes: PNG }]]);
  const { parts, raw } = build(modelOf(para(image('a/1'), image('a/1', { widthPx: 1 }))), images);
  const doc = parts.get('word/document.xml');
  assert.equal(count(doc, /<wp:inline /g), 2);
  const docPr = [...doc.matchAll(/<wp:docPr id="(\d+)"/g)].map((m) => m[1]);
  assert.deepEqual(docPr, ['1', '2']);
  assert.match(doc, /descr="alt &quot;a\/1&quot;"/);
  const media = [...raw.keys()].filter((name) => name.startsWith('word/media/'));
  assert.deepEqual(media, ['word/media/image1.png']);
  assert.deepEqual(raw.get('word/media/image1.png'), PNG);
  const rels = parts.get('word/_rels/document.xml.rels');
  assert.equal(count(rels, /relationships\/image"/g), 1);
  const embedded = new Set([...doc.matchAll(/r:embed="(rId\d+)"/g)].map((m) => m[1]));
  assert.equal(embedded.size, 1);
  assert.match(rels, new RegExp(`Id="${[...embedded][0]}"[^>]*Target="media/image1\\.png"`));
  assert.match(doc, /<wp:extent cx="19050" cy="9525"\/>/);
  assert.match(doc, /<wp:extent cx="9525" cy="4763"\/>/);
});

test('ảnh: Content_Types khớp media thực có', () => {
  const images = new Map([
    ['p', { mimeType: 'image/png', bytes: PNG }],
    ['g', { mimeType: 'image/gif', bytes: GIF }],
  ]);
  const { parts } = build(modelOf(para(image('p'), image('g'))), images);
  const types = parts.get('[Content_Types].xml');
  assert.match(types, /Extension="png" ContentType="image\/png"/);
  assert.match(types, /Extension="gif" ContentType="image\/gif"/);
  assert.doesNotMatch(types, /Extension="jpeg"/);
  const plain = build(modelOf(para(text('x')))).parts.get('[Content_Types].xml');
  assert.doesNotMatch(plain, /Extension="png"/);
});

test('ảnh thiếu, header hỏng hoặc mime lạ thành [alt] và được đếm', () => {
  const images = new Map([
    ['bad', { mimeType: 'image/png', bytes: Uint8Array.of(1, 2, 3) }],
    ['webp', { mimeType: 'image/webp', bytes: PNG }],
  ]);
  const { parts, skippedImages, raw } = build(
    modelOf(para(image('none'), image('bad'), image('webp'))),
    images,
  );
  assert.equal(skippedImages, 3);
  const doc = parts.get('word/document.xml');
  assert.match(doc, /\[alt &quot;none&quot;\]/);
  assert.equal(count(doc, /<wp:inline /g), 0);
  assert.equal([...raw.keys()].filter((name) => name.startsWith('word/media/')).length, 0);
});

test('ảnh rộng bị giới hạn theo vùng chữ A4 và output tất định', () => {
  const wide = Uint8Array.from(PNG);
  new DataView(wide.buffer).setUint32(16, 4000);
  new DataView(wide.buffer).setUint32(20, 2000);
  const images = new Map([['w', { mimeType: 'image/png', bytes: wide }]]);
  const model = modelOf(para(image('w')));
  const first = build(model, images);
  assert.match(first.parts.get('word/document.xml'), /<wp:extent cx="5924550" cy="2962275"\/>/);
  const second = docxParts(model, { images });
  assert.deepEqual(
    second.files.map((f) => [f.name, [...f.data]]),
    first.files.map((f) => [f.name, [...f.data]]),
  );
});

test('không mutate input', () => {
  const model = modelOf(
    { type: 'heading', level: 1, inlines: [text('A')], bookmark: 'c1' },
    {
      type: 'table',
      rows: [
        { header: false, cells: [cell('a', { rowSpan: 2 })] },
        { header: false, cells: [] },
      ],
    },
  );
  const snapshot = JSON.stringify(model);
  build(model);
  assert.equal(JSON.stringify(model), snapshot);
});

const LOGO = { mimeType: 'image/png', bytes: PNG };

/** Mọi `w:pPr` phải là con đầu tiên của `w:p` (đúng thứ tự schema), kể cả trong header/footer. */
function assertPPrFirst(name, xml) {
  const misplaced = /<w:p>(?:(?!<\/w:p>|<w:pPr>)[\s\S])+<w:pPr>/;
  assert.doesNotMatch(xml, misplaced, `${name}: pPr không đứng đầu w:p`);
}

test('header/footer được tham chiếu từ sectPr, rels và Content_Types', () => {
  const { parts } = build(modelOf(para(text('x'))));
  const doc = parts.get('word/document.xml');
  const rels = parts.get('word/_rels/document.xml.rels');
  const header = /<w:headerReference w:type="default" r:id="(rId\d+)"\/>/.exec(doc)[1];
  const footer = /<w:footerReference w:type="default" r:id="(rId\d+)"\/>/.exec(doc)[1];
  assert.match(
    rels,
    new RegExp(`Id="${header}"[^>]*relationships/header"[^>]*Target="header1\\.xml"`),
  );
  assert.match(
    rels,
    new RegExp(`Id="${footer}"[^>]*relationships/footer"[^>]*Target="footer1\\.xml"`),
  );
  const types = parts.get('[Content_Types].xml');
  assert.match(types, /PartName="\/word\/header1\.xml"[^>]*wordprocessingml\.header\+xml/);
  assert.match(types, /PartName="\/word\/footer1\.xml"[^>]*wordprocessingml\.footer\+xml/);
  assert.match(
    doc,
    /w:top="1123" w:right="1267" w:bottom="1080" w:left="1296" w:header="533" w:footer="576"/,
  );
  assert.match(
    parts.get('word/footer1.xml'),
    /<w:jc w:val="center"\/>[\s\S]*<w:fldSimple w:instr=" PAGE ">[\s\S]*5C6978/,
  );
  assert.match(
    parts.get('word/header1.xml'),
    /<w:jc w:val="right"\/>[\s\S]*<w:caps\/><w:color w:val="808F9A"\/><w:sz w:val="16"\/>[\s\S]*Tiêu đề/,
  );
});

test('không logo: không rels header, không media, không tính ảnh bỏ qua', () => {
  const { parts, raw, skippedImages } = build(modelOf(para(text('x'))));
  assert.equal(parts.has('word/_rels/header1.xml.rels'), false);
  assert.equal([...raw.keys()].filter((name) => name.startsWith('word/media/')).length, 0);
  assert.equal(skippedImages, 0);
  assert.doesNotMatch(parts.get('word/header1.xml'), /<w:drawing>/);
});

test('logo: một media part dùng ở bìa và header, rels header đúng, docPr duy nhất', () => {
  const { parts, raw } = build(modelOf(para(text('x'))), new Map(), LOGO);
  assert.deepEqual(
    [...raw.keys()].filter((name) => name.startsWith('word/media/')),
    ['word/media/image1.png'],
  );
  const doc = parts.get('word/document.xml');
  const header = parts.get('word/header1.xml');
  const headerRels = parts.get('word/_rels/header1.xml.rels');
  assert.match(headerRels, /Id="rId1"[^>]*relationships\/image"[^>]*Target="media\/image1\.png"/);
  assert.match(header, /<a:blip r:embed="rId1"\/>/);
  const docRels = parts.get('word/_rels/document.xml.rels');
  assert.equal(count(docRels, /Target="media\/image1\.png"/g), 1);
  assert.ok(doc.indexOf('<w:drawing>') < doc.indexOf('w:val="Title"'));
  assert.match(doc, /<wp:extent cx="1143000" cy="571500"\/>/);
  assert.match(doc, /<w:pStyle w:val="Title"\/><w:spacing w:before="120"\/>/);
  assert.match(
    header,
    /<wp:extent cx="381000" cy="190500"\/>[\s\S]*<w:t xml:space="preserve"> <\/w:t>[\s\S]*Tiêu đề/,
  );
  const ids = [...(doc + header).matchAll(/<wp:docPr id="(\d+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['1', '2']);
});

test('logo và ảnh người dùng cùng ảnh không trộn media, docPr vẫn duy nhất trên cả file', () => {
  const images = new Map([['a/1', { mimeType: 'image/png', bytes: PNG }]]);
  const { parts, raw } = build(modelOf(para(image('a/1'))), images, LOGO);
  assert.equal([...raw.keys()].filter((name) => name.startsWith('word/media/')).length, 2);
  const ids = [
    ...(parts.get('word/document.xml') + parts.get('word/header1.xml')).matchAll(
      /<wp:docPr id="(\d+)"/g,
    ),
  ].map((m) => m[1]);
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 3);
});

test('logo không hợp lệ bị bỏ qua, không tính skippedImages', () => {
  const bad = { mimeType: 'image/png', bytes: Uint8Array.of(1, 2, 3) };
  const { parts, skippedImages } = build(modelOf(para(text('x'))), new Map(), bad);
  assert.equal(skippedImages, 0);
  assert.equal(parts.has('word/_rels/header1.xml.rels'), false);
  assert.doesNotMatch(parts.get('word/document.xml'), /<w:drawing>/);
  assert.doesNotMatch(parts.get('word/document.xml'), /<w:spacing w:before="120"\/>/);
});

test('toc: tiêu đề không bookmark, nhãn section, hyperlink anchor và indent theo level', () => {
  const { parts } = build(
    modelOf(
      {
        type: 'toc',
        title: 'Mục lục',
        hint: 'Chọn một mục',
        tip: 'Mẹo: Ctrl + Click',
        sections: [
          {
            label: 'Nhóm A',
            entries: [
              { text: 'Thẻ 1', anchor: 'c1', level: 0 },
              { text: 'Con & cháu', anchor: 'c2', level: 2 },
            ],
          },
          { label: null, entries: [{ text: 'Thẻ 3', anchor: 'c3', level: 1 }] },
        ],
      },
      { type: 'page-break' },
    ),
  );
  const doc = parts.get('word/document.xml');
  assert.match(
    doc,
    /<w:pStyle w:val="Heading1"\/><w:spacing w:before="0" w:after="120"\/><\/w:pPr><w:r><w:t xml:space="preserve">Mục lục/,
  );
  assert.equal(count(doc, /<w:bookmarkStart /g), 0);
  assert.match(doc, /<w:color w:val="63707D"\/><w:sz w:val="20"\/>/);
  assert.match(doc, /<w:b\/><w:caps\/><\/w:rPr><w:t xml:space="preserve">Nhóm A/);
  assert.equal(count(doc, /<w:caps\/>/g), 1);
  assert.equal(count(doc, /<w:pStyle w:val="MenuLink"\/>/g), 3);
  assert.match(
    doc,
    /<w:pStyle w:val="MenuLink"\/><\/w:pPr><w:hyperlink w:anchor="c1" w:history="1"><w:r><w:rPr><w:color w:val="245579"\/>/,
  );
  assert.match(
    doc,
    /<w:pStyle w:val="MenuLink"\/><w:ind w:left="566"\/><\/w:pPr><w:hyperlink w:anchor="c2"[\s\S]*Con &amp; cháu/,
  );
  assert.match(doc, /<w:ind w:left="283"\/><\/w:pPr><w:hyperlink w:anchor="c3"/);
  assert.match(doc, /<w:i\/><w:color w:val="717D88"\/><w:sz w:val="18"\/>[\s\S]*Mẹo: Ctrl/);
  assert.match(doc, /<w:p><w:r><w:br w:type="page"\/><\/w:r><\/w:p><w:sectPr>/);
  assertBalanced('document', doc);
});

test('heading card có viền dưới D9E5EB, heading thường thì không; LinkItem là style đoạn', () => {
  const { parts } = build(
    modelOf(
      { type: 'heading', level: 1, card: true, inlines: [text('A')], bookmark: 'c1' },
      { type: 'heading', level: 2, inlines: [text('B')] },
      { type: 'paragraph', style: 'LinkItem', inlines: [text('→ ')] },
    ),
  );
  const doc = parts.get('word/document.xml');
  assert.match(
    doc,
    /<w:pPr><w:pStyle w:val="Heading1"\/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="D9E5EB"\/><\/w:pBdr><\/w:pPr><w:bookmarkStart/,
  );
  assert.equal(count(doc, /D9E5EB/g), 1);
  assert.match(doc, /<w:pStyle w:val="LinkItem"\/>/);
});

test('bảng theo template: tblW pct, căn giữa, vAlign, ô sz18 after 60, header EAF2F5 một shd', () => {
  const { parts } = build(
    modelOf({
      type: 'table',
      rows: [
        { header: true, cells: [cell('H', { header: true })] },
        { header: false, cells: [cell('b')] },
      ],
    }),
  );
  const doc = parts.get('word/document.xml');
  assert.match(doc, /<w:tblW w:w="5000" w:type="pct"\/><w:jc w:val="center"\/><w:tblLook /);
  assert.equal(count(doc, /<w:vAlign w:val="center"\/>/g), 2);
  assert.equal(count(doc, /<w:spacing w:after="60"\/>/g), 2);
  assert.match(doc, /<w:rPr><w:b\/><w:sz w:val="18"\/><w:szCs w:val="18"\/><\/w:rPr>/);
  assert.match(doc, /<w:rPr><w:sz w:val="18"\/><w:szCs w:val="18"\/><\/w:rPr>/);
  const [headerCell] = doc.match(/<w:tcPr>.*?<\/w:tcPr>/g);
  assert.equal(count(headerCell, /<w:shd /g), 1);
  assert.match(headerCell, /w:fill="EAF2F5"\/><w:vAlign/);
  assert.match(headerCell, /<w:tcW w:w="9343" w:type="dxa"\/>/);
});

test('mọi part XML cân bằng và pPr luôn đứng đầu w:p', () => {
  const images = new Map([['a/1', { mimeType: 'image/png', bytes: PNG }]]);
  const model = modelOf(
    {
      type: 'toc',
      title: 'M',
      hint: 'h',
      tip: 't',
      sections: [{ label: 'L', entries: [{ text: 'e', anchor: 'c1', level: 1 }] }],
    },
    { type: 'page-break' },
    { type: 'heading', level: 1, card: true, inlines: [text('A')], bookmark: 'c1' },
    para(image('a/1')),
    { type: 'callout', variant: 'info', blocks: [para(text('c'))] },
  );
  const { parts } = build(model, images, LOGO);
  for (const [name, xml] of parts) assertBalanced(name, xml);
  for (const name of ['word/document.xml', 'word/header1.xml', 'word/footer1.xml'])
    assertPPrFirst(name, parts.get(name));
});
