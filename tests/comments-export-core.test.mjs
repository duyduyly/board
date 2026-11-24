import test from 'node:test';
import assert from 'node:assert/strict';
import { wordDocument } from '../assets/js/word-export/model.js';
import { buildDocx } from '../assets/js/word-export/index.js';
import { markdownDocument } from '../assets/js/markdown-export/markdown.js';
import { readZipText } from './docx-zip-reader.mjs';

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
  comments: 'Comment',
  commentTime: (iso) => 'at ' + iso.slice(0, 10),
};
const COMMENTS = 'card-atlas:comments';
const items = [
  {
    id: 'a',
    createdAt: '2026-01-02T03:04:05.000Z',
    text: 'first\nsecond\n\n- one\n- *two*\n\n3. x\n4. y',
  },
  { id: 'b', createdAt: '2026-02-03T00:00:00.000Z', text: 'later' },
];
const card = (id, extensions) => ({
  id,
  title: 'Title ' + id,
  summary: '',
  type: '',
  tags: [],
  content: '',
  position: { x: 0, y: 0 },
  size: { width: 200, height: 100 },
  style: { backgroundColor: '#fff', textColor: '#000', borderColor: '#000' },
  ...(extensions ? { extensions } : {}),
});
const project = (cards) => ({
  version: '1.0',
  metadata: { title: 'Atlas', description: '' },
  canvas: { zoom: 1, position: { x: 0, y: 0 } },
  cards,
  relations: [],
});
const withComments = project([card('c1', { [COMMENTS]: { version: 1, items } }), card('c2')]);
const cardBlocks = (model, title) => {
  const from = model.blocks.findIndex((b) => b.type === 'heading' && b.inlines[0].text === title);
  return model.blocks.slice(from + 1);
};

test('Word IR adds a Comment section with dated Meta lines, breaks and lists', () => {
  const model = wordDocument(withComments, { labels });
  const blocks = cardBlocks(model, 'Title c1').slice(0, 9);
  assert.deepEqual(blocks[0], {
    type: 'heading',
    level: 2,
    inlines: [{ type: 'text', text: 'Comment' }],
  });
  assert.equal(blocks[1].style, 'Meta');
  assert.equal(blocks[1].inlines[0].text, 'at 2026-01-02');
  assert.deepEqual(
    blocks[2].inlines.map((i) => i.type),
    ['text', 'break', 'text'],
  );
  const [one, two, three, four] = blocks.slice(3, 7);
  assert.deepEqual(
    [one.type, one.ordered, one.level, two.listId === one.listId],
    ['list-item', false, 0, true],
  );
  assert.notEqual(three.listId, one.listId);
  assert.deepEqual([three.ordered, three.start, four.start], [true, 3, 3]);
  assert.equal(blocks[7].inlines[0].text, 'at 2026-02-03');
});

test('cards without comments and a missing commentTime keep the IR stable', () => {
  const plain = wordDocument(project([card('c2')]), { labels });
  assert.ok(!plain.blocks.some((b) => b.type === 'heading' && b.inlines[0].text === 'Comment'));
  const raw = wordDocument(withComments, { labels: { ...labels, commentTime: undefined } });
  assert.ok(raw.blocks.some((b) => b.style === 'Meta' && b.inlines[0].text === items[0].createdAt));
});

test('docx with comments is well formed and contains the heading', async () => {
  const { bytes } = await buildDocx(withComments, { view: 'card', labels });
  const xml = readZipText(bytes).get('word/document.xml');
  assert.match(xml, /Comment/);
  assert.match(xml, /at 2026-01-02/);
  const stack = [];
  for (const m of xml.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) assert.equal(stack.pop(), m[2]);
    else stack.push(m[2]);
  }
  assert.deepEqual(stack, []);
});

test('markdown renders comment lists, line breaks and escapes markup', () => {
  const { text } = markdownDocument(wordDocument(withComments, { labels }));
  assert.match(text, /^- one$/m);
  assert.match(text, /^3\. x$/m);
  assert.match(text, /^4\. y$/m);
  assert.match(text, /\\*two\\*/);
  assert.match(text, /first(\\n| {2}\n|<br>)\s*second/);
});
