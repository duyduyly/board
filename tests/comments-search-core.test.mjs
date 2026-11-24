import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { search, searchExcerpt, newCard } from '../assets/js/store/project-store.js';
import { addComment } from '../assets/js/graph/card-comments.js';
import { stageNode } from '../assets/js/json/node-transfer.js';

const commented = () => {
  const card = newCard({ x: 0, y: 0 });
  card.title = 'Plain title';
  addComment(card, {
    id: 'c1',
    createdAt: '2026-01-01T00:00:00.000Z',
    text: 'Remember the zebracrossing deadline',
  });
  return card;
};

test('search finds a card by text that exists only in its comments', () => {
  const card = commented(),
    other = newCard({ x: 0, y: 0 });
  assert.deepEqual(search([card, other], 'ZebraCrossing'), [card]);
  assert.deepEqual(search([card, other], 'unrelated'), []);
});

test('excerpt shows the matching comment fragment, empty without a match', () => {
  const card = commented();
  assert.match(searchExcerpt(card, 'zebracrossing'), /zebracrossing deadline/);
  assert.equal(searchExcerpt(card, 'missing'), '');
});

test('node transfer example with comments passes the stage validator', async () => {
  const text = await fs.readFile('assets/data/node-transfer-example.json', 'utf8');
  const { project } = stageNode(text);
  const items = project.cards[0].extensions['card-atlas:comments'].items;
  assert.equal(items.length, 2);
  assert.ok(items.some((item) => item.text.includes('\n- ')));
});
