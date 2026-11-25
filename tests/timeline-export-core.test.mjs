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
  schedule: 'Time',
  dateRange: (start, end) => (end ? `${start} to ${end}` : start),
};
const SCHEDULE = 'card-atlas:schedule';
const card = (id, title, schedule) => ({
  id,
  title,
  summary: '',
  type: '',
  tags: [],
  content: '',
  position: { x: 0, y: 0 },
  size: { width: 200, height: 100 },
  style: { backgroundColor: '#fff', textColor: '#000', borderColor: '#000' },
  ...(schedule ? { extensions: { [SCHEDULE]: schedule } } : {}),
});
const project = (cards) => ({
  version: '1.0',
  metadata: { title: 'Atlas', description: '' },
  canvas: { zoom: 1, position: { x: 0, y: 0 } },
  cards,
  relations: [],
});
const metas = (model) =>
  model.blocks.filter((b) => b.style === 'Meta').map((b) => b.inlines[0].text);

test('an explicit schedule range is written to the Meta line', () => {
  const model = wordDocument(
    project([card('a', 'Alpha', { start: '2026-01-01', end: '2026-01-05' })]),
    { labels },
  );
  assert.deepEqual(metas(model), ['Time: 2026-01-01 to 2026-01-05']);
});

test('a milestone prints only its start date', () => {
  const model = wordDocument(project([card('a', 'Alpha', { start: '2026-01-01' })]), { labels });
  assert.deepEqual(metas(model), ['Time: 2026-01-01']);
});

test('missing labels fall back to English text and a plain range', () => {
  const bare = { ...labels, schedule: undefined, dateRange: undefined };
  const model = wordDocument(
    project([card('a', 'Alpha', { start: '2026-01-01', end: '2026-01-05' })]),
    { labels: bare },
  );
  assert.deepEqual(metas(model), ['Schedule: 2026-01-01 – 2026-01-05']);
});

test('markdown carries the schedule line', () => {
  const { text } = markdownDocument(
    wordDocument(project([card('a', 'Alpha', { start: '2026-01-01' })]), { labels }),
  );
  assert.ok(text.includes('Time: 2026-01-01'), text);
});

test('a card without a schedule gets no extra Meta line', () => {
  const model = wordDocument(project([card('a', 'Alpha')]), { labels });
  assert.deepEqual(metas(model), []);
});
