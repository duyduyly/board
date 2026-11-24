import test from 'node:test';
import assert from 'node:assert/strict';
import { wordDocument } from '../assets/js/word-export/model.js';
import { markdownDocument } from '../assets/js/markdown-export/markdown.js';

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
  status: 'Status',
  statuses: { done: 'Done' },
};
const STATUS = 'card-atlas:status';
const card = (id, title, done) => ({
  id,
  title,
  summary: '',
  type: '',
  tags: [],
  content: '',
  position: { x: 0, y: 0 },
  size: { width: 200, height: 100 },
  style: { backgroundColor: '#fff', textColor: '#000', borderColor: '#000' },
  ...(done ? { extensions: { [STATUS]: { version: 1, value: 'done' } } } : {}),
});
const project = (cards, extensions) => ({
  version: '1.0',
  metadata: { title: 'Atlas', description: '' },
  canvas: { zoom: 1, position: { x: 0, y: 0 } },
  cards,
  relations: [],
  ...(extensions ? { extensions } : {}),
});
const headings = (model) => model.blocks.filter((b) => b.type === 'heading');
const headingTexts = (model) => headings(model).map((b) => b.inlines[0].text);

test('heading carries the status label while the contents page keeps the plain title', () => {
  const model = wordDocument(project([card('a', 'Alpha', true), card('b', 'Beta')]), { labels });
  assert.deepEqual(headingTexts(model), ['Alpha [Done]', 'Beta']);
  const toc = model.blocks.find((b) => b.type === 'toc');
  const entries = JSON.stringify(toc);
  assert.match(entries, /Alpha/);
  assert.doesNotMatch(entries, /\[Done\]/);
});

test('labels without a status map fall back to the raw value', () => {
  const old = { ...labels, statuses: undefined, status: undefined };
  const model = wordDocument(project([card('a', 'Alpha', true)]), { labels: old });
  assert.deepEqual(headingTexts(model), ['Alpha [done]']);
});

test('markdown shows the status label in the heading', () => {
  const { text } = markdownDocument(wordDocument(project([card('a', 'Alpha', true)]), { labels }));
  assert.ok(text.includes('Alpha \\[Done\\]'));
});

test('a group opening card prints its status in the Meta line', () => {
  const groups = {
    'card-atlas:groups': { groups: [{ id: 'g1', title: 'Alpha', cardIds: ['a', 'b'] }] },
  };
  const model = wordDocument(project([card('a', 'Alpha', true), card('b', 'Beta')], groups), {
    labels,
  });
  const metas = model.blocks.filter((b) => b.style === 'Meta').map((b) => b.inlines[0].text);
  const texts = headingTexts(model);
  if (texts.includes('Alpha [Done]')) assert.fail('opening card must not get a second heading');
  assert.ok(metas.includes('Status: Done'), JSON.stringify({ metas, texts }));
});

test('the default New status is left out of headings and Meta lines', () => {
  const withNew = { ...card('a', 'Alpha'), extensions: { [STATUS]: { version: 1, value: 'new' } } };
  const labelsWithNew = { ...labels, statuses: { done: 'Done', new: 'New' } };
  const model = wordDocument(project([withNew, card('b', 'Beta')]), { labels: labelsWithNew });
  assert.deepEqual(headingTexts(model), ['Alpha', 'Beta']);
});
