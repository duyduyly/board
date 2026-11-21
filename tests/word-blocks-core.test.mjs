import test from 'node:test';
import assert from 'node:assert/strict';
import { documentBlocks } from '../assets/js/word-export/document-blocks.js';

const labels = { image: 'Image', remoteImage: 'Web image', mermaidSource: 'Mermaid source' };
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const images = { pic1: { name: 'pic.png', mimeType: 'image/png', data: PNG } };

const el = (tag, attributes = {}, ...children) => ({ tag, attributes, children });
const run = (nodes, extra = {}) =>
  documentBlocks({ components: nodes }, { cardId: 'c1', labels, images, ...extra });
const text = (value, marks) =>
  marks ? { type: 'text', text: value, marks } : { type: 'text', text: value };

test('headings are offset by headingBase and capped at 9', () => {
  const blocks = run([el('h1', {}, 'A'), el('h3', {}, 'B'), el('h6', {}, 'C')], { headingBase: 4 });
  assert.deepEqual(
    blocks.map((b) => [b.type, b.level]),
    [
      ['heading', 5],
      ['heading', 7],
      ['heading', 9],
    ],
  );
  assert.deepEqual(blocks[0].inlines, [text('A')]);
  assert.equal(run([el('h2', {}, 'x')])[0].level, 2);
});

test('paragraph containers, inline runs around nested blocks and whitespace collapsing', () => {
  const blocks = run([
    el(
      'div',
      {},
      'before  ',
      el('strong', {}, 'bold'),
      el('ul', {}, el('li', {}, 'x')),
      ' after\n',
    ),
  ]);
  assert.deepEqual(blocks[0], {
    type: 'paragraph',
    inlines: [text('before '), text('bold', { bold: true })],
  });
  assert.equal(blocks[1].type, 'list-item');
  assert.deepEqual(blocks[2], { type: 'paragraph', inlines: [text('after')] });
  assert.deepEqual(run([el('p', {}, ' '), el('p', {}, el('br'))]), []);
  assert.deepEqual(run(['plain text']), [{ type: 'paragraph', inlines: [text('plain text')] }]);
});

test('inline marks, colors and br', () => {
  const [p] = run([
    el(
      'p',
      {},
      el('em', {}, 'i'),
      el('u', {}, 'u'),
      el('s', {}, 's'),
      el('sub', {}, 'b'),
      el('sup', {}, 'p'),
      el('code', {}, 'c'),
      el('b', {}, el('i', {}, 'both')),
      el('br'),
      el('span', { style: 'color:#F00;background-color:rgb(0, 128, 255)' }, 'col'),
      el('span', { style: 'color:red' }, 'named'),
      el('span', { style: 'color:#0a0' }, 'short'),
    ),
  ]);
  assert.deepEqual(p.inlines, [
    text('i', { italic: true }),
    text('u', { underline: true }),
    text('s', { strike: true }),
    text('b', { sub: true }),
    text('p', { sup: true }),
    text('c', { code: true }),
    text('both', { bold: true, italic: true }),
    { type: 'break' },
    text('col', { color: '#ff0000', highlight: '#0080ff' }),
    text('named'),
    text('short', { color: '#00aa00' }),
  ]);
});

test('alignment from classes and text-align, inherited by nested paragraphs', () => {
  const blocks = run([
    el('p', { class: 'text-center' }, 'c'),
    el('p', { class: 'text-end' }, 'e'),
    el('p', { style: 'text-align:justify' }, 'j'),
    el(
      'div',
      { class: 'text-center' },
      el('p', {}, 'n'),
      el('p', { style: 'text-align:left' }, 'l'),
    ),
    el('p', {}, 'none'),
  ]);
  assert.deepEqual(
    blocks.map((b) => b.align),
    ['center', 'right', 'justify', 'center', 'left', undefined],
  );
});

test('hr, blockquote and figcaption styles', () => {
  const blocks = run([
    el('hr'),
    el('blockquote', {}, el('p', {}, 'q')),
    el('figure', {}, el('figcaption', {}, 'cap')),
  ]);
  assert.deepEqual(blocks[0], { type: 'paragraph', inlines: [], rule: true });
  assert.equal(blocks[1].style, 'Quote');
  assert.equal(blocks[2].style, 'Caption');
});

test('nested lists keep level, ordered flag, shared and unique listIds and start', () => {
  const listIds = { next: 5 };
  const blocks = run(
    [
      el(
        'ul',
        {},
        el(
          'li',
          {},
          'a',
          el(
            'ul',
            {},
            el('li', {}, 'a1'),
            el('li', {}, 'a2', el('ol', { start: '3' }, el('li', {}, 'n3'))),
          ),
        ),
        el('li', {}, 'b', el('ol', {}, el('li', {}, 'b1'))),
      ),
      el('ol', { start: '7' }, el('li', {}, 'x'), el('li', {}, 'y')),
    ],
    { listIds },
  );
  const view = blocks.map((b) => [b.inlines[0].text, b.ordered, b.level, b.listId, b.start]);
  assert.deepEqual(view, [
    ['a', false, 0, 5, undefined],
    ['a1', false, 1, 5, undefined],
    ['a2', false, 1, 5, undefined],
    ['n3', true, 2, 6, 3],
    ['b', false, 0, 5, undefined],
    ['b1', true, 1, 7, undefined],
    ['x', true, 0, 8, 7],
    ['y', true, 0, 8, 7],
  ]);
  assert.equal(listIds.next, 9);
});

test('list items without text, extra paragraphs, depth cap and private counter', () => {
  const blocks = run([
    el(
      'ul',
      {},
      el('li', {}, el('ul', {}, el('li', {}, 'inner'))),
      el('li', {}, el('p', {}, 'one'), el('p', {}, 'two')),
    ),
  ]);
  assert.deepEqual(
    blocks.map((b) => [b.type, b.level, b.inlines.map((i) => i.text).join('')]),
    [
      ['list-item', 0, ''],
      ['list-item', 1, 'inner'],
      ['list-item', 0, 'one'],
      ['paragraph', undefined, 'two'],
    ],
  );
  assert.equal(blocks[0].listId, 1);
  let deep = el('li', {}, 'deepest');
  for (let i = 0; i < 12; i++) deep = el('li', {}, el('ul', {}, deep));
  const last = run([el('ul', {}, deep)]).pop();
  assert.equal(last.level, 8);
});

test('table with caption, header rows, spans and cell blocks', () => {
  const [table] = run([
    el(
      'table',
      {},
      el('caption', {}, 'Cap'),
      el('thead', {}, el('tr', {}, el('th', { colspan: '2' }, 'H'))),
      el(
        'tbody',
        {},
        el('tr', {}, el('td', { rowspan: '2' }, 'a'), el('td', { class: 'text-end' }, 'b')),
        el('tr', {}, el('td', { colspan: 'x', rowspan: '999' }, el('ul', {}, el('li', {}, 'l')))),
      ),
      el('tfoot', {}, el('tr', {}, el('th', {}, 'f'))),
      el('tr', {}),
    ),
  ]);
  assert.equal(table.type, 'table');
  assert.deepEqual(table.caption, [text('Cap')]);
  assert.deepEqual(
    table.rows.map((r) => [r.header, r.cells.length]),
    [
      [true, 1],
      [false, 2],
      [false, 1],
      [true, 1],
    ],
  );
  assert.deepEqual(
    table.rows.flatMap((r) => r.cells.map((c) => [c.header, c.colSpan, c.rowSpan])),
    [
      [true, 2, 1],
      [false, 1, 2],
      [false, 1, 1],
      [false, 1, 63],
      [true, 1, 1],
    ],
  );
  assert.equal(table.rows[1].cells[1].blocks[0].align, 'right');
  assert.equal(table.rows[2].cells[0].blocks[0].type, 'list-item');
  assert.deepEqual(run([el('table', {}, el('tr', {}))]), []);
});

test('callout variants', () => {
  const variants = ['info', 'warning', 'success', 'danger'];
  for (const v of variants) {
    const [callout] = run([el('div', { class: 'alert alert-' + v }, el('p', {}, 'm'))]);
    assert.equal(callout.type, 'callout');
    assert.equal(callout.variant, v);
    assert.deepEqual(callout.blocks, [{ type: 'paragraph', inlines: [text('m')] }]);
  }
  assert.equal(run([el('div', { class: 'alert alert-primary' }, 'x')])[0].variant, 'neutral');
  assert.equal(run([el('div', { class: 'alert' }, 'x')])[0].variant, 'neutral');
});

test('code blocks keep whitespace and language; mermaid gets a caption', () => {
  const code = run([el('pre', {}, el('code', { class: 'language-js' }, 'a\n  b\n'))])[0];
  assert.deepEqual(code, { type: 'code', text: 'a\n  b', language: 'js' });
  const plain = run([el('pre', {}, el('code', {}, 'x'))])[0];
  assert.deepEqual(plain, { type: 'code', text: 'x' });
  const mermaid = run([
    el('pre', {}, el('code', { class: 'language-mermaid' }, 'graph TD\nA-->B')),
  ])[0];
  assert.deepEqual(mermaid, {
    type: 'code',
    text: 'graph TD\nA-->B',
    language: 'mermaid',
    caption: 'Mermaid source',
  });
  const legacy = run([el('pre', {}, el('code', { 'data-origin': 'legacy-mermaid' }, 'x'))])[0];
  assert.equal(legacy.caption, 'Mermaid source');
});

test('images: attachment, missing, remote, width', () => {
  const [p] = run([
    el(
      'p',
      {},
      el('img', { src: 'attachment:pic1', alt: 'A pic', width: '120px' }),
      el('img', { src: 'attachment:pic1' }),
      el('img', { src: 'attachment:gone', alt: 'Lost' }),
      el('img', { src: 'attachment:toString' }),
      el('img', { src: 'https://example.com/a.png', alt: 'Remote' }),
      el('img', { src: 'https://example.com/b.png' }),
    ),
  ]);
  assert.deepEqual(p.inlines[0], {
    type: 'image',
    key: 'c1/pic1',
    mimeType: 'image/png',
    data: PNG,
    alt: 'A pic',
    widthPx: 120,
  });
  assert.equal(p.inlines[1].alt, 'pic.png');
  assert.equal(p.inlines[1].widthPx, undefined);
  assert.deepEqual(p.inlines[2], text('[Image: Lost]'));
  assert.deepEqual(p.inlines[3], text('[Image]'));
  assert.deepEqual(p.inlines[4], {
    type: 'link',
    href: 'https://example.com/a.png',
    children: [text('Web image: Remote')],
  });
  assert.equal(p.inlines[5].children[0].text, 'Web image: https://example.com/b.png');
});

test('links: external, mailto, anchor text, video, unsafe and nested', () => {
  const [p] = run([
    el(
      'p',
      {},
      el('a', { href: 'https://example.com' }, el('strong', {}, 'ext')),
      el('a', { href: 'mailto:a@b.co' }, 'mail'),
      el('a', { href: '#section' }, 'jump'),
      el('a', { class: 'board-video', href: 'https://www.youtube.com/watch?v=abcdefghijk' }),
      el('a', { href: 'javascript:alert(1)' }, 'evil'),
      el(
        'a',
        { href: 'https://outer.example' },
        'o',
        el('a', { href: 'https://inner.example' }, 'in'),
      ),
    ),
  ]);
  assert.deepEqual(p.inlines, [
    { type: 'link', href: 'https://example.com', children: [text('ext', { bold: true })] },
    { type: 'link', href: 'mailto:a@b.co', children: [text('mail')] },
    text('jump'),
    {
      type: 'link',
      href: 'https://www.youtube.com/watch?v=abcdefghijk',
      children: [text('https://www.youtube.com/watch?v=abcdefghijk')],
    },
    text('evil'),
    { type: 'link', href: 'https://outer.example', children: [text('o'), text('in')] },
  ]);
});

test('accepts a node array, ignores empty documents and does not mutate input', () => {
  assert.deepEqual(documentBlocks(null, { cardId: 'c', labels }), []);
  assert.deepEqual(documentBlocks({ components: [] }, { cardId: 'c', labels }), []);
  const doc = {
    components: [
      el('h1', {}, 'T'),
      el('ul', {}, el('li', {}, 'x', el('img', { src: 'attachment:pic1' }))),
    ],
  };
  const before = JSON.stringify(doc);
  const imagesBefore = JSON.stringify(images);
  documentBlocks(doc, { cardId: 'c1', labels, images });
  assert.equal(JSON.stringify(doc), before);
  assert.equal(JSON.stringify(images), imagesBefore);
  assert.equal(documentBlocks(doc.components, { cardId: 'c1', labels, images }).length, 2);
});
