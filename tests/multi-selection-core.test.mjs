import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectStore, newCard, newRelation } from '../assets/js/store/project-store.js';
import { blank, stage, serialize } from '../assets/js/json/validator.js';
import { geometry, setGeometry } from '../assets/js/graph/mind-map.js';
import { togglePinned } from '../assets/js/graph/card-metadata.js';
import { moveCards } from '../assets/js/graph/move-cards.js';

function fixture() {
  const p = blank();
  p.cards = [0, 1, 2].map((n) => newCard({ x: n * 300, y: n * 100 }));
  p.relations = [newRelation(p.cards[0].id, p.cards[1].id)];
  setGeometry(p, p.cards[2].id, 'mind', 'position', { x: 800, y: -200 });
  togglePinned(p.cards[1]);
  const store = new ProjectStore();
  store.replace(p);
  return store;
}
for (const view of ['card', 'mind'])
  test(`group move is atomic, skips pins, preserves inactive geometry and roundtrips in ${view}`, () => {
    const store = fixture(),
      before = structuredClone(store.project),
      ids = before.cards.map((c) => c.id);
    assert.equal(
      store.commit((p) => moveCards(p, [...ids, ids[0], 'missing'], { x: 45, y: -20 }, view)),
      true,
    );
    const after = structuredClone(store.project);
    for (let i = 0; i < 3; i++) {
      const old = geometry(before, before.cards[i], view).position;
      const moved = geometry(after, after.cards[i], view).position;
      assert.deepEqual(moved, i === 1 ? old : { x: old.x + 45, y: old.y - 20 });
      assert.deepEqual(
        geometry(after, after.cards[i], view === 'card' ? 'mind' : 'card'),
        geometry(before, before.cards[i], view === 'card' ? 'mind' : 'card'),
      );
      assert.equal(after.cards[i].content, before.cards[i].content);
      assert.deepEqual(after.cards[i].size, before.cards[i].size);
    }
    assert.deepEqual(after.cards[1], before.cards[1]);
    assert.deepEqual(after.relations, before.relations);
    assert.equal(store.undoStack.length, 1);
    assert.equal(store.dirty, true);
    store.undo();
    assert.deepEqual(store.project, before);
    assert.equal(store.dirty, false);
    store.redo();
    assert.deepEqual(store.project, after);
    assert.deepEqual(stage(serialize(after)).project, after);
  });
test('group no-ops and invalid deltas cannot mutate model/history', () => {
  const store = fixture(),
    before = serialize(store.project),
    ids = store.project.cards.map((c) => c.id);
  for (const [selected, delta] of [
    [ids, { x: 0, y: 0 }],
    [[ids[1]], { x: 20, y: 20 }],
    [[], { x: 4, y: 4 }],
  ])
    assert.equal(
      store.commit((p) => moveCards(p, selected, delta, 'mind')),
      false,
    );
  for (const delta of [
    { x: NaN, y: 0 },
    { x: 0, y: Infinity },
  ])
    assert.throws(() => store.commit((p) => moveCards(p, ids, delta, 'card')));
  assert.equal(serialize(store.project), before);
  assert.equal(store.undoStack.length, 0);
});
