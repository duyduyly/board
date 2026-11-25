import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardRank, outline } from '../assets/js/word-export/order.js';

const fixture = () =>
  JSON.parse(
    readFileSync(new URL('./fixtures/timeline-boards-project.json', import.meta.url), 'utf8'),
  );
const ordered = (project, view = 'card') =>
  [...cardRank(project, view)].sort((a, b) => a[1] - b[1]).map(([id]) => id);

test('owned cards follow their owner node in export order', () => {
  const ids = ordered(fixture());
  const at = (id) => ids.indexOf(id);
  assert.equal(at('a-child-1'), at('node-a') + 1);
  assert.equal(at('a-child-2'), at('node-a') + 2);
  assert.equal(at('b-child-1'), at('node-b') + 1);
  assert.equal(at('b-child-2'), at('node-b') + 2);
});

test('no card is lost and the outline lists every card once', () => {
  const project = fixture();
  assert.equal(ordered(project).length, project.cards.length);
  const { groups, ungrouped } = outline(project, 'card');
  const all = [...ungrouped];
  const walk = (list) => list.forEach((g) => (all.push(...g.cardIds), walk(g.children)));
  walk(groups);
  assert.equal(all.length, project.cards.length);
  assert.equal(new Set(all).size, project.cards.length);
});

test('a project without owners keeps position order', () => {
  const project = fixture();
  for (const card of project.cards) delete card.extensions;
  assert.deepEqual(ordered(project), [
    'a-child-1',
    'b-child-1',
    'node-a',
    'a-child-2',
    'b-child-2',
    'node-b',
    'node-c',
    'node-d',
    'node-e',
  ]);
});
