import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardRank, outline } from '../assets/js/word-export/order.js';

const fixture = () =>
  JSON.parse(
    readFileSync(new URL('./fixtures/node-board-mind-project.json', import.meta.url), 'utf8'),
  );
const ordered = (project, view) =>
  [...cardRank(project, view)].sort((a, b) => a[1] - b[1]).map(([id]) => id);

test('mind view places a node board tree right after its node', () => {
  const ids = ordered(fixture(), 'mind');
  const at = (id) => ids.indexOf(id);
  assert.equal(at('a-child-1'), at('node-a') + 1);
  assert.equal(at('a-child-2'), at('node-a') + 2);
  assert.equal(at('b-child-1'), at('node-b') + 1);
});

test('mind view follows the board branch tree, not geometry', () => {
  const project = fixture();
  // a-child-2 sits above a-child-1 by geometry, but the tree starts at the board root.
  project.extensions['card-atlas:views'].mindMap.positions['a-child-2'] = { x: -500, y: -500 };
  const ids = ordered(project, 'mind');
  assert.ok(ids.indexOf('a-child-1') < ids.indexOf('a-child-2'));
});

test('note board view ignores the board mind root', () => {
  const project = fixture();
  project.cards.find((c) => c.id === 'a-child-1').position = { x: 900, y: 900 };
  const ids = ordered(project, 'card');
  assert.ok(ids.indexOf('a-child-2') < ids.indexOf('a-child-1'));
});

test('every card is exported once in both views', () => {
  const project = fixture();
  for (const view of ['card', 'mind']) {
    assert.equal(ordered(project, view).length, project.cards.length);
    const { groups, ungrouped } = outline(project, view);
    const all = [...ungrouped];
    const walk = (list) => list.forEach((g) => (all.push(...g.cardIds), walk(g.children)));
    walk(groups);
    assert.equal(new Set(all).size, project.cards.length);
    assert.equal(all.length, project.cards.length);
  }
});
