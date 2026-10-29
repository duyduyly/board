import test from 'node:test';
import assert from 'node:assert/strict';
import { convertMind } from '../assets/js/graph/convert-mind.js';
import { newCard, newRelation, ProjectStore } from '../assets/js/store/project-store.js';
import { blank, stage, serialize } from '../assets/js/json/validator.js';
import { MIND, relationKind } from '../assets/js/graph/mind-map.js';
test('explicit root converts directed cycles to a tree atomically preserving notes, routes, pins and roundtrip', () => {
  const p = blank();
  p.cards = ['a', 'b', 'c', 'd', 'pin'].map((id, i) => ({
    ...newCard({ x: i * 350, y: 0 }, id),
    id,
  }));
  p.cards[4].extensions['card-atlas:metadata'].pinned = true;
  p.relations = [
    ['a', 'b'],
    ['b', 'c'],
    ['c', 'a'],
    ['a', 'c'],
    ['a', 'pin'],
  ].map(([a, b], i) => ({
    ...newRelation(a, b),
    id: 'r' + i,
    extensions: { 'card-atlas:edge': { route: 'orthogonal' } },
  }));
  const original = structuredClone(p),
    result = convertMind(p, 'a');
  assert.deepEqual(p, original);
  assert.deepEqual(result.project.cards, p.cards);
  assert.equal(result.project.extensions[MIND].rootId, 'a');
  assert.equal(result.project.relations.filter((e) => relationKind(e) === 'branch').length, 2);
  assert.deepEqual(result.project.relations[4], p.relations[4]);
  const store = new ProjectStore();
  store.replace(p);
  store.commit((d) => {
    d.relations = result.project.relations;
    d.extensions = result.project.extensions;
  });
  assert.deepEqual(stage(serialize(store.project)).errors, []);
  assert.equal(store.undoStack.length, 1);
  store.undo();
  assert.deepEqual(store.project, p);
  assert.throws(() => convertMind(p, 'pin'));
  const lockedRoot = structuredClone(p);
  lockedRoot.extensions = { [MIND]: { rootId: 'pin' } };
  assert.throws(() => convertMind(lockedRoot, 'a'));
});
