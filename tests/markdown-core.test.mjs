import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownDocument } from '../assets/js/markdown-export/markdown.js';
import { buildMarkdownZip } from '../assets/js/markdown-export/index.js';
import { TextDecoder } from 'node:util';
import { readZip } from './docx-zip-reader.mjs';

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const labels = {
  ungrouped: 'Other notes',
  links: 'Links',
  type: 'Type',
  tags: 'Tags',
  legacySource: 'Legacy source',
  mermaidSource: 'Mermaid source',
  remoteImage: 'Web image',
  image: 'Image',
  group: 'Group',
  contents: 'Contents',
  contentsHint: 'Pick an entry',
  contentsTip: 'Ctrl + Click in Word',
};

const text = (value, marks) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const p = (...inlines) => ({ type: 'paragraph', inlines });
const md = (blocks, options) =>
  markdownDocument({ title: '', description: '', blocks }, options).text.trimEnd();

const card = (id, extra = {}) => ({
  id,
  title: 'Title ' + id,
  summary: '',
  type: '',
  tags: [],
  content: '',
  position: { x: 0, y: 0 },
  size: { width: 200, height: 100 },
  style: { backgroundColor: '#fff', textColor: '#000', borderColor: '#000' },
  ...extra,
});
const project = (cards, relations = [], extensions) => ({
  version: '1.0',
  metadata: { title: 'Atlas', description: 'About' },
  canvas: { zoom: 1, position: { x: 0, y: 0 } },
  cards,
  relations,
  ...(extensions ? { extensions } : {}),
});
const el = (tag, attributes = {}, ...children) => ({ tag, attributes, children });
const docExt = (...nodes) => ({ 'card-atlas:document': { components: nodes } });
const decode = (bytes) => new TextDecoder().decode(bytes);

test('cover follows the Word template: logo, title, description', () => {
  const { text: out } = markdownDocument(
    { title: 'My *Atlas*', description: '1. first', blocks: [] },
    { logoPath: 'images/card-atlas-logo.png' },
  );
  assert.equal(
    out,
    '<img src="images/card-atlas-logo.png" alt="Card Atlas" width="120">\n\n' +
      '# My \\*Atlas\\*\n\n*1\\. first*\n',
  );
});

test('headings move down one level, keep anchors and stop at six', () => {
  const heading = (level, bookmark) => ({
    type: 'heading',
    level,
    inlines: [text('Topic #')],
    ...(bookmark ? { bookmark } : {}),
  });
  assert.equal(md([heading(1, 'g1')]), '## <a id="g1"></a>Topic \\#');
  assert.equal(md([heading(5)]), '###### Topic \\#');
  assert.equal(md([heading(6, 'c3')]), '<a id="c3"></a>**Topic #**');
});

test('text is escaped and cannot start a block', () => {
  assert.equal(md([p(text('a*b_c [x] <y> |z| & ~'))]), 'a\\*b\\_c \\[x\\] \\<y\\> \\|z\\| \\& \\~');
  assert.equal(md([p(text('# not a heading'))]), '\\# not a heading');
  assert.equal(md([p(text('- not a list'))]), '\\- not a list');
  assert.equal(md([p(text('2024. year'))]), '2024\\. year');
  assert.equal(md([p(text('  > quote'))]), '\\> quote');
});

test('marks wrap merged runs and keep spaces outside the delimiters', () => {
  const bold = { bold: true };
  assert.equal(md([p(text('a'), text(' b', bold), text('c ', bold), text('d'))]), 'a **bc** d');
  assert.equal(
    md([p(text('x', { italic: true, strike: true }), text('u', { underline: true }))]),
    '*~~x~~*<u>u</u>',
  );
  assert.equal(md([p(text('H'), text('2', { sub: true }), text('O'))]), 'H<sub>2</sub>O');
  assert.equal(md([p(text('a`b', { code: true }))]), '``a`b``');
  assert.equal(md([p(text('`x', { code: true }))]), '`` `x ``');
});

test('links, anchors, breaks and images', () => {
  const link = { type: 'link', href: 'https://e.x/a b(c)', children: [text('site')] };
  const anchor = { type: 'link', anchor: 'c2', children: [text('Next')] };
  assert.equal(
    md([p(link, { type: 'break' }, anchor)]),
    '[site](https://e.x/a%20b%28c%29)<br>[Next](#c2)',
  );
  const image = { type: 'image', key: 'c/i', mimeType: 'image/png', data: PNG, alt: 'A "cat"' };
  const images = new Map([['c/i', 'images/image-001.png']]);
  assert.equal(md([p(image)], { images }), '![A "cat"](images/image-001.png)');
  assert.equal(
    md([p({ ...image, widthPx: 90 })], { images }),
    '<img src="images/image-001.png" alt="A &quot;cat&quot;" width="90">',
  );
  const missing = markdownDocument({ title: '', description: '', blocks: [p(image)] });
  assert.equal(missing.text.trim(), '\\[A "cat"\\]');
  assert.equal(missing.skippedImages, 1);
});

test('lists keep numbering and nesting; adjacent lists stay separate', () => {
  const item = (listId, ordered, level, value, start) => ({
    type: 'list-item',
    ordered,
    level,
    listId,
    inlines: [text(value)],
    ...(start ? { start } : {}),
  });
  assert.equal(
    md([
      item(1, true, 0, 'one', 3),
      item(1, true, 1, 'sub'),
      item(1, true, 1, 'sub2'),
      item(1, true, 0, 'two', 3),
      item(2, false, 1, 'dot'),
      item(3, true, 0, 'again'),
    ]),
    '3. one\n   1. sub\n   2. sub2\n4. two\n   - dot\n1) again',
  );
});

test('relation lines become one bullet list; secondary text is italic', () => {
  const link = (value) => ({ type: 'paragraph', style: 'LinkItem', inlines: [text(value)] });
  assert.equal(md([link('→ A'), link('→ B')]), '- → A\n- → B');
  assert.equal(md([{ type: 'paragraph', style: 'Subtitle', inlines: [text('sum')] }]), '*sum*');
  assert.equal(md([{ type: 'paragraph', rule: true, inlines: [] }]), '---');
});

test('code fences use the language and outgrow backticks inside', () => {
  assert.equal(
    md([{ type: 'code', text: 'graph TD\nA-->B', caption: 'Mermaid source', language: 'mermaid' }]),
    '```mermaid\ngraph TD\nA-->B\n```',
  );
  assert.equal(md([{ type: 'code', text: 'a\n```\nb' }]), '````\na\n```\nb\n````');
});

test('tables: header row, merged cells and pipes', () => {
  const cell = (value, extra = {}) => ({
    header: false,
    colSpan: 1,
    rowSpan: 1,
    blocks: [p(text(value))],
    ...extra,
  });
  const table = {
    type: 'table',
    rows: [
      { header: true, cells: [cell('H1', { header: true }), cell('H2', { header: true })] },
      { header: false, cells: [cell('a|b', { rowSpan: 2 }), cell('c')] },
      { header: false, cells: [cell('d')] },
      { header: false, cells: [cell('wide', { colSpan: 2 })] },
    ],
  };
  assert.equal(md([table]), '| H1 | H2 |\n| --- | --- |\n| a\\|b | c |\n|  | d |\n| wide |  |');
  const plain = { type: 'table', rows: [{ header: false, cells: [cell('x')] }] };
  assert.equal(md([plain]), '|  |\n| --- |\n| x |');
});

test('callouts become GitHub alerts; the contents page links every entry', () => {
  assert.equal(
    md([{ type: 'callout', variant: 'warning', blocks: [p(text('a')), p(text('b'))] }]),
    '> [!WARNING]\n> a\n>\n> b',
  );
  assert.equal(md([{ type: 'callout', variant: 'neutral', blocks: [p(text('n'))] }]), '> n');
  const toc = {
    type: 'toc',
    title: 'Contents',
    hint: 'Pick',
    tip: 'Word only',
    sections: [
      {
        label: 'Group',
        entries: [
          { text: 'A', anchor: 'c1', level: 0 },
          { text: 'B', anchor: 'g2', level: 1 },
        ],
      },
    ],
  };
  assert.equal(
    md([toc, { type: 'page-break' }]),
    '## Contents\n\n*Pick*\n\n**Group**\n\n- [A](#c1)\n  - [B](#g2)\n\n---',
  );
});

test('zip holds the Markdown file, the logo and every attached image once', () => {
  const images = {
    'card-atlas:images': { img1: { name: 'cat.png', mimeType: 'image/png', data: PNG } },
  };
  const doc = docExt(el('p', {}, el('img', { src: 'attachment:img1', alt: 'Cat' })));
  const input = project(
    [card('a', { extensions: { ...doc, ...images } }), card('b')],
    [
      {
        id: 'r1',
        source: 'a',
        target: 'b',
        label: '',
        description: '',
        type: '',
        style: { color: '#000', line: 'solid', arrow: 'end' },
      },
    ],
  );
  const logo = { bytes: new Uint8Array([1, 2, 3]) };
  const { bytes, skippedImages } = buildMarkdownZip(input, { labels, name: 'Atlas', logo });
  assert.equal(skippedImages, 0);
  const zip = readZip(bytes);
  assert.deepEqual(
    [...zip.keys()],
    ['Atlas.md', 'images/card-atlas-logo.png', 'images/image-001.png'],
  );
  assert.deepEqual([...zip.get('images/card-atlas-logo.png')], [1, 2, 3]);
  const out = decode(zip.get('Atlas.md'));
  assert.match(out, /^<img src="images\/card-atlas-logo.png"/);
  assert.match(out, /\n# Atlas\n\n\*About\*\n/);
  assert.match(out, /\n## Contents\n/);
  assert.match(out, /- \[Title a\]\(#c1\)/);
  assert.match(out, /## <a id="c1"><\/a>Title a\n/);
  assert.match(out, /!\[Cat\]\(images\/image-001\.png\)/);
  assert.match(out, /### Links\n\n- → \[Title b\]\(#c2\)/);
  assert.doesNotMatch(out, /Ctrl \+ Click/);
});

test('zip without a logo still exports and an invalid image is left out', () => {
  const images = {
    'card-atlas:images': { img1: { name: 'x.png', mimeType: 'image/png', data: '!!' } },
  };
  const doc = docExt(el('p', {}, el('img', { src: 'attachment:img1', alt: 'Bad' })));
  const { bytes } = buildMarkdownZip(project([card('a', { extensions: { ...doc, ...images } })]), {
    labels,
    name: 'Atlas',
  });
  assert.deepEqual([...readZip(bytes).keys()], ['Atlas.md']);
});
