import test from 'node:test';
import assert from 'node:assert/strict';
import { wordDocument } from '../assets/js/word-export/model.js';
import { cardRank, outline } from '../assets/js/word-export/order.js';

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
  contentsHint: 'Hint',
  contentsTip: 'Tip',
};
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const card = (id, x = 0, y = 0, extra = {}) => ({
  id,
  title: 'Title ' + id,
  summary: '',
  type: '',
  tags: [],
  content: '',
  position: { x, y },
  size: { width: 200, height: 100 },
  style: { backgroundColor: '#fff', textColor: '#000', borderColor: '#000' },
  ...extra,
});
const relation = (id, source, target, extra = {}) => ({
  id,
  source,
  target,
  label: '',
  description: '',
  type: '',
  style: { color: '#000', line: 'solid', arrow: 'end' },
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
const group = (id, cardIds, extra = {}) => ({ id, title: 'Group ' + id, cardIds, ...extra });
const withGroups = (groups) => ({ 'card-atlas:groups': { groups } });
const el = (tag, attributes = {}, ...children) => ({ tag, attributes, children });
const docExt = (...nodes) => ({ 'card-atlas:document': { components: nodes } });

const headings = (model) =>
  model.blocks.filter((b) => b.type === 'heading').map((b) => [b.level, b.inlines[0].text]);
/** Blocks after the contents page and its page break. */
const body = (model) =>
  model.blocks.slice(model.blocks.findIndex((b) => b.type === 'page-break') + 1);
const links = (block) => block.inlines.filter((i) => i.type === 'link');

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

test('Note Board rank follows y, then x, then id', () => {
  const p = project([card('d', 0, 0), card('c', 5, 0), card('b', 0, 0), card('a', 0, 10)]);
  assert.deepEqual([...cardRank(p, 'card').keys()], ['b', 'd', 'c', 'a']);
});

test('Mind Map rank is a pre-order walk from the root, loose cards last by mind geometry', () => {
  const cards = [
    card('root', 0, 0),
    card('b', 0, 50),
    card('a', 0, 60),
    card('a1', 0, 70),
    card('loose2', 0, 900),
    card('loose1', 0, 800),
  ];
  const branch = { 'card-atlas:mind-map': { kind: 'branch' } };
  const relations = [
    relation('r1', 'root', 'b', { extensions: branch }),
    relation('r2', 'root', 'a', { extensions: branch }),
    relation('r3', 'a', 'a1', { extensions: branch }),
    relation('r4', 'a1', 'loose1'),
  ];
  const p = project(cards, relations, {
    'card-atlas:mind-map': { rootId: 'root' },
    'card-atlas:views': {
      mindMap: { positions: { loose1: { x: 0, y: 5 }, loose2: { x: 0, y: 4 } } },
    },
  });
  assert.deepEqual([...cardRank(p, 'mind').keys()], ['root', 'a', 'a1', 'b', 'loose2', 'loose1']);
  assert.deepEqual([...cardRank(p, 'card').keys()], ['root', 'b', 'a', 'a1', 'loose1', 'loose2']);
  const noRoot = project(cards, relations);
  assert.deepEqual([...cardRank(noRoot, 'mind').keys()], [...cardRank(noRoot, 'card').keys()]);
});

test('outline places cards directly in their own group in rank order', () => {
  const p = project(
    [card('a', 0, 30), card('b', 0, 20), card('c', 0, 10), card('d', 0, 0)],
    [],
    withGroups([
      group('g1', ['a', 'b']),
      group('g2', ['c'], { parentId: 'g1', description: 'sub' }),
      group('g3', ['d']),
    ]),
  );
  const { groups, ungrouped } = outline(p, 'card');
  assert.deepEqual(
    groups.map((g) => [g.id, g.depth, g.bookmark, g.cardIds, g.description]),
    [
      ['g1', 1, 'g1', ['b', 'a'], ''],
      ['g3', 1, 'g3', ['d'], ''],
    ],
  );
  assert.deepEqual(
    groups[0].children.map((g) => [g.id, g.depth, g.cardIds, g.description]),
    [['g2', 2, ['c'], 'sub']],
  );
  assert.deepEqual(ungrouped, []);
});

test('three nested group levels become Heading 1-3 and cards sit one level deeper', () => {
  const p = project(
    [card('a', 0, 0), card('b', 0, 1), card('c', 0, 2), card('o', 0, 3)],
    [],
    withGroups([
      group('g1', ['a'], { description: 'Intro' }),
      group('g2', ['b'], { parentId: 'g1' }),
      group('g3', ['c'], { parentId: 'g2' }),
    ]),
  );
  const model = wordDocument(p, { labels });
  assert.deepEqual(headings(model), [
    [1, 'Group g1'],
    [2, 'Title a'],
    [2, 'Group g2'],
    [3, 'Title b'],
    [3, 'Group g3'],
    [4, 'Title c'],
    [1, 'Other notes'],
    [2, 'Title o'],
  ]);
  assert.equal(model.title, 'Atlas');
  assert.equal(model.description, 'About');
  assert.deepEqual(body(model)[1], {
    type: 'paragraph',
    style: 'Lead',
    inlines: [{ type: 'text', text: 'Intro' }],
  });
});

test('Other notes heading exists only when there are groups; otherwise cards are level 1', () => {
  const plain = wordDocument(project([card('a', 0, 0), card('b', 0, 1)]), { labels });
  assert.deepEqual(headings(plain), [
    [1, 'Title a'],
    [1, 'Title b'],
  ]);
  const allGrouped = wordDocument(project([card('a')], [], withGroups([group('g1', ['a'])])), {
    labels,
  });
  assert.ok(!headings(allGrouped).some(([, t]) => t === 'Other notes'));
});

test('summary, meta line, empty parts dropped', () => {
  const p = project([
    card('a', 0, 0, { summary: 'Short', type: 'idea', tags: ['x', 'y'] }),
    card('b', 0, 1, { tags: ['z'] }),
    card('c', 0, 2),
  ]);
  const blocks = body(wordDocument(p, { labels }));
  const text = (b) => b.inlines.map((i) => i.text).join('');
  assert.equal(blocks[1].style, 'Subtitle');
  assert.equal(text(blocks[1]), 'Short');
  assert.equal(blocks[2].style, 'Meta');
  assert.equal(text(blocks[2]), 'Type: idea · Tags: x, y');
  assert.equal(text(blocks[4]), 'Tags: z');
  assert.equal(blocks.length, 6);
});

test('document content is rendered with headings offset by the card level', () => {
  const p = project(
    [card('a', 0, 0, { extensions: docExt(el('h1', {}, 'Inside'), el('p', {}, 'Body')) })],
    [],
    withGroups([group('g1', ['a'])]),
  );
  const model = wordDocument(p, { labels });
  assert.deepEqual(headings(model), [
    [1, 'Group g1'],
    [2, 'Title a'],
    [3, 'Inside'],
  ]);
});

test('a leading document heading equal to the card title is dropped, others stay', () => {
  const same = card('a', 0, 0, {
    title: 'My  Note',
    extensions: docExt(el('h1', {}, ' my note '), el('p', {}, 'Body')),
  });
  const other = card('b', 0, 1, {
    extensions: docExt(el('h1', {}, 'Different'), el('p', {}, 'Body')),
  });
  const model = wordDocument(project([same, other]), { labels });
  assert.deepEqual(headings(model), [
    [1, 'My  Note'],
    [1, 'Title b'],
    [2, 'Different'],
  ]);
});

test('a leading paragraph equal to the summary is dropped after the title heading', () => {
  const p = project([
    card('a', 0, 0, {
      summary: 'Short  summary',
      extensions: docExt(
        el('h1', {}, 'Title a'),
        el('p', {}, 'short summary'),
        el('p', {}, 'Rest'),
      ),
    }),
  ]);
  const text = (b) => b.inlines.map((i) => i.text).join('');
  const blocks = body(wordDocument(p, { labels }));
  assert.deepEqual(
    blocks.map((b) => b.type),
    ['heading', 'paragraph', 'paragraph'],
  );
  assert.equal(blocks[1].style, 'Subtitle');
  assert.equal(text(blocks[2]), 'Rest');
});

test('repeated title or summary later in the document is kept', () => {
  const p = project([
    card('a', 0, 0, {
      summary: 'Sum',
      extensions: docExt(el('p', {}, 'Intro'), el('h1', {}, 'Title a'), el('p', {}, 'Sum')),
    }),
  ]);
  const model = wordDocument(p, { labels });
  assert.deepEqual(headings(model), [
    [1, 'Title a'],
    [2, 'Title a'],
  ]);
  assert.equal(body(model).filter((b) => b.type === 'paragraph').length, 3);
});

test('legacy content is marked and split into paragraphs with line breaks', () => {
  const p = project([card('a', 0, 0, { content: 'one\ntwo\n\n\nthree\n\n' })]);
  const blocks = body(wordDocument(p, { labels }));
  assert.equal(blocks[1].style, 'Meta');
  assert.equal(blocks[1].inlines[0].text, 'Legacy source');
  assert.deepEqual(blocks[2].inlines, [
    { type: 'text', text: 'one' },
    { type: 'break' },
    { type: 'text', text: 'two' },
  ]);
  assert.deepEqual(blocks[3].inlines, [{ type: 'text', text: 'three' }]);
  assert.equal(blocks.length, 4);
  const empty = wordDocument(project([card('b')]), { labels });
  assert.deepEqual(
    empty.blocks.map((b) => b.type),
    ['toc', 'page-break', 'heading'],
  );
  assert.equal(wordDocument(project([]), { labels }).blocks.length, 0);
});

test('relations list arrow, anchor to the target card, label and description', () => {
  const p = project(
    [card('a', 0, 0), card('b', 0, 1), card('c', 0, 2)],
    [
      relation('r1', 'a', 'b', { label: 'uses', description: 'because' }),
      relation('r2', 'a', 'c', { style: { color: '#000', line: 'solid', arrow: 'both' } }),
      relation('r3', 'c', 'a', { style: { color: '#000', line: 'solid', arrow: 'start' } }),
      relation('r4', 'b', 'a', { style: { color: '#000', line: 'solid', arrow: 'none' } }),
    ],
  );
  const { blocks } = wordDocument(p, { labels });
  const at = blocks.findIndex((b) => b.type === 'heading' && b.inlines[0].text === 'Links');
  assert.equal(blocks[at].level, 2);
  const [first, second] = [blocks[at + 1], blocks[at + 2]];
  assert.deepEqual(first.inlines, [
    { type: 'text', text: '→ ' },
    { type: 'link', anchor: 'c2', children: [{ type: 'text', text: 'Title b' }] },
    { type: 'text', text: ' (uses)' },
    { type: 'text', text: ' — because' },
  ]);
  assert.equal(second.inlines[0].text, '↔ ');
  assert.equal(links(second)[0].anchor, 'c3');
  const arrowTo = (title) =>
    blocks
      .filter((b) => b.type === 'paragraph' && links(b)[0]?.children[0].text === title)
      .map((b) => b.inlines[0].text);
  assert.deepEqual(arrowTo('Title a'), ['— ', '← ']);
  const none = wordDocument(
    project(
      [card('a'), card('b', 0, 1)],
      [relation('r', 'b', 'a', { style: { color: '#000', line: 'solid', arrow: 'none' } })],
    ),
    { labels },
  );
  assert.equal(none.blocks.at(-1).inlines[0].text, '— ');
  assert.equal(
    blocks.filter((b) => b.type === 'heading' && b.inlines[0].text === 'Links').length,
    3,
  );
});

test('group links point at the group bookmark under the source card', () => {
  const p = project(
    [card('a', 0, 0), card('b', 0, 1)],
    [],
    withGroups([group('g1', ['b'], { links: [{ id: 'l1', source: 'a' }] })]),
  );
  const model = wordDocument(p, { labels });
  const last = model.blocks.at(-1);
  assert.deepEqual(last.inlines, [
    { type: 'text', text: '→ Group: ' },
    { type: 'link', anchor: 'g1', children: [{ type: 'text', text: 'Group g1' }] },
  ]);
  const idx = model.blocks.findIndex((b) => b.bookmark === 'g1');
  assert.ok(idx >= 0);
});

test('bookmarks are unique and every anchor resolves', () => {
  const cards = ['a', 'b', 'c', 'd'].map((id, i) => card(id, 0, i));
  const p = project(
    cards,
    [relation('r1', 'a', 'd'), relation('r2', 'd', 'b')],
    withGroups([group('g1', ['a']), group('g2', ['b'], { parentId: 'g1' }), group('g3', ['c'])]),
  );
  const { blocks } = wordDocument(p, { labels });
  const marks = blocks.filter((b) => b.bookmark).map((b) => b.bookmark);
  assert.equal(new Set(marks).size, marks.length);
  assert.equal(marks.length, 3 + 4);
  for (const b of blocks.filter((x) => x.type === 'paragraph'))
    for (const l of links(b)) assert.ok(marks.includes(l.anchor), l.anchor);
});

test('cover image becomes a paragraph unless the document already shows it', () => {
  const images = { pic: { name: 'pic.png', mimeType: 'image/png', data: PNG } };
  const node = { kind: 'image-text', coverImageId: 'pic', imageAlt: 'Cover alt' };
  const extra = (doc) => ({
    extensions: { 'card-atlas:images': images, 'card-atlas:node': node, ...doc },
  });
  const bare = wordDocument(project([card('a', 0, 0, extra())]), { labels });
  assert.deepEqual(body(bare)[1], {
    type: 'paragraph',
    inlines: [{ type: 'image', key: 'a/pic', mimeType: 'image/png', data: PNG, alt: 'Cover alt' }],
  });
  const shown = wordDocument(
    project([
      card('a', 0, 0, extra(docExt(el('p', {}, el('img', { src: 'attachment:pic', alt: 'x' }))))),
    ]),
    { labels },
  );
  const covers = shown.blocks.flatMap((b) => b.inlines || []).filter((i) => i.type === 'image');
  assert.equal(covers.length, 1);
  assert.equal(body(shown)[1].inlines[0].alt, 'x');
});

test('list ids stay unique across cards', () => {
  const list = (...items) => el('ul', {}, ...items.map((t) => el('li', {}, t)));
  const p = project([
    card('a', 0, 0, { extensions: docExt(list('x')) }),
    card('b', 0, 1, { extensions: docExt(list('y')) }),
  ]);
  const ids = wordDocument(p, { labels })
    .blocks.filter((b) => b.type === 'list-item')
    .map((b) => b.listId);
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);
});

test('the project is not mutated', () => {
  const p = project(
    [card('a', 0, 5, { content: 'x' }), card('b', 0, 1, { extensions: docExt(el('p', {}, 'hi')) })],
    [relation('r1', 'a', 'b')],
    {
      ...withGroups([group('g1', ['a'], { links: [{ id: 'l', source: 'b' }] })]),
      'card-atlas:mind-map': { rootId: 'a' },
    },
  );
  const before = structuredClone(p);
  deepFreeze(p);
  wordDocument(p, { view: 'mind', labels });
  wordDocument(p, { view: 'card', labels });
  assert.deepEqual(p, before);
});

const toc = (model) => model.blocks[0];
const entry = (text, anchor, level) => ({ text, anchor, level });

test('contents page and page break come first, only when there is a card', () => {
  const model = wordDocument(project([card('a')]), { labels });
  assert.deepEqual(
    [model.blocks[0].type, model.blocks[1].type, model.blocks[2].card],
    ['toc', 'page-break', true],
  );
  assert.deepEqual(
    [toc(model).title, toc(model).hint, toc(model).tip],
    ['Contents', 'Hint', 'Tip'],
  );
  assert.equal(
    wordDocument(project([]), { labels }).blocks.some((b) => b.type === 'toc'),
    false,
  );
});

test('without groups the contents is one unlabelled section of every card', () => {
  const p = project([card('b', 0, 1), card('a', 0, 0)]);
  assert.deepEqual(toc(wordDocument(p, { labels })).sections, [
    { label: null, entries: [entry('Title a', 'c1', 0), entry('Title b', 'c2', 0)] },
  ]);
});

test('contents sections follow groups, nesting levels and loose cards in document order', () => {
  const p = project(
    [card('a', 0, 0), card('b', 0, 1), card('c', 0, 2), card('d', 0, 3), card('o', 0, 4)],
    [],
    withGroups([
      group('g1', ['a']),
      group('g2', ['b'], { parentId: 'g1' }),
      group('g3', ['c'], { parentId: 'g2' }),
      group('g4', ['d']),
    ]),
  );
  const model = wordDocument(p, { labels });
  assert.deepEqual(toc(model).sections, [
    {
      label: 'Group g1',
      entries: [
        entry('Title a', 'c1', 0),
        entry('Group g2', 'g2', 1),
        entry('Title b', 'c2', 1),
        entry('Group g3', 'g3', 2),
        entry('Title c', 'c3', 2),
      ],
    },
    { label: 'Group g4', entries: [entry('Title d', 'c4', 0)] },
    { label: 'Other notes', entries: [entry('Title o', 'c5', 0)] },
  ]);
  const marks = model.blocks.filter((b) => b.bookmark).map((b) => b.bookmark);
  for (const { entries } of toc(model).sections)
    for (const e of entries) assert.ok(marks.includes(e.anchor), e.anchor);
});

test('relation and group links use the LinkItem style', () => {
  const p = project(
    [card('a', 0, 0), card('b', 0, 1)],
    [relation('r', 'a', 'b')],
    withGroups([group('g1', ['b'], { links: [{ id: 'l1', source: 'a' }] })]),
  );
  const styles = body(wordDocument(p, { labels }))
    .filter((b) => b.type === 'paragraph' && links(b).length)
    .map((b) => b.style);
  assert.deepEqual(styles, ['LinkItem', 'LinkItem']);
});

const opening = (id, title, x, y, extra = {}) => card(id, x, y, { title, ...extra });
const text = (b) => b.inlines.map((i) => i.text ?? '').join('');

test('a card titled like its group opens the group instead of repeating the heading', () => {
  const p = project(
    [
      opening('a', ' group  G1 ', 0, 0, { summary: 'Sum', type: 'idea' }),
      card('b', 0, 1),
      card('x', 0, 2),
    ],
    [relation('r', 'x', 'a')],
    withGroups([group('g1', ['a', 'b'], { title: 'Group G1', description: 'Lead' })]),
  );
  const model = wordDocument(p, { labels });
  assert.deepEqual(headings(model), [
    [1, 'Group G1'],
    [2, 'Title b'],
    [1, 'Other notes'],
    [2, 'Title x'],
    [3, 'Links'],
  ]);
  const blocks = body(model);
  assert.deepEqual(
    blocks.slice(0, 4).map((b) => [b.type, b.style, b.bookmark]),
    [
      ['heading', undefined, 'g1'],
      ['paragraph', 'Lead', undefined],
      ['paragraph', 'Subtitle', undefined],
      ['paragraph', 'Meta', undefined],
    ],
  );
  const marks = blocks.filter((b) => b.bookmark).map((b) => b.bookmark);
  assert.equal(new Set(marks).size, marks.length);
  const toLink = blocks.find((b) => b.type === 'paragraph' && links(b).length);
  assert.equal(links(toLink)[0].anchor, 'g1');
  assert.ok(marks.includes('g1'));
  assert.deepEqual(marks, ['g1', 'c1', 'c2']);
});

test('contents drop the opening card but keep a subgroup that has one', () => {
  const p = project(
    [opening('a', 'Group g1', 0, 0), opening('b', 'Group g2', 0, 1), card('c', 0, 2)],
    [],
    withGroups([group('g1', ['a', 'c']), group('g2', ['b'], { parentId: 'g1' })]),
  );
  const model = wordDocument(p, { labels });
  assert.deepEqual(toc(model).sections, [
    {
      label: 'Group g1',
      entries: [entry('Title c', 'c1', 0), entry('Group g2', 'g2', 1)],
    },
  ]);
  assert.deepEqual(headings(model), [
    [1, 'Group g1'],
    [2, 'Title c'],
    [2, 'Group g2'],
  ]);
});

test('opening card content uses the group level for document headings and Links', () => {
  const p = project(
    [
      opening('a', 'Group g1', 0, 0, {
        extensions: docExt(el('h1', {}, 'Group g1'), el('h2', {}, 'Inside'), el('p', {}, 'Body')),
      }),
      card('b', 0, 1),
    ],
    [relation('r', 'a', 'b')],
    withGroups([group('g1', ['a', 'b'])]),
  );
  assert.deepEqual(headings(wordDocument(p, { labels })), [
    [1, 'Group g1'],
    [3, 'Inside'],
    [2, 'Links'],
    [2, 'Title b'],
  ]);
});

test('only direct cards merge and only the first of two same-titled cards', () => {
  const p = project(
    [
      opening('a', 'Group g1', 0, 0),
      opening('b', 'Group g1', 0, 1),
      opening('c', 'Group g2', 0, 2),
      opening('o', 'Group g1', 0, 3),
    ],
    [],
    withGroups([group('g1', ['a', 'b']), group('g2', ['c'], { title: 'Other title' })]),
  );
  const model = wordDocument(p, { labels });
  assert.deepEqual(headings(model), [
    [1, 'Group g1'],
    [2, 'Group g1'],
    [1, 'Other title'],
    [2, 'Group g2'],
    [1, 'Other notes'],
    [2, 'Group g1'],
  ]);
  assert.equal(model.blocks.filter((b) => b.card).length, 3);
  const noGroups = wordDocument(project([opening('a', 'Group g1', 0, 0)]), { labels });
  assert.deepEqual(headings(noGroups), [[1, 'Group g1']]);
});

test('learning atlas template has no adjacent headings with the same text', async () => {
  const { readFile } = await import('node:fs/promises');
  const template = JSON.parse(
    await readFile(new URL('../assets/data/templates/learning-atlas.json', import.meta.url)),
  );
  const model = wordDocument(template, { labels });
  const heads = model.blocks.filter((b) => b.type === 'heading').map(text);
  assert.ok(heads.length > 0);
  heads.forEach((h, i) => i && assert.notEqual(h, heads[i - 1]));
  const marks = new Set(model.blocks.filter((b) => b.bookmark).map((b) => b.bookmark));
  for (const section of toc(model).sections)
    for (const e of section.entries) assert.ok(marks.has(e.anchor), e.anchor);
});
