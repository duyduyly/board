import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectStore, newCard, newRelation, remove } from '../assets/js/store/project-store.js';
import { blank, validate, stage, serialize } from '../assets/js/json/validator.js';
import {
  GROUPS,
  createGroup,
  removeGroup,
  frameBounds,
  cardGroups,
} from '../assets/js/graph/card-groups.js';
import { EDGE, edgeRoute, routeTypes } from '../assets/js/graph/edge-routing.js';
import { moveCards } from '../assets/js/graph/move-cards.js';
import { togglePinned } from '../assets/js/graph/card-metadata.js';
import { geometry } from '../assets/js/graph/mind-map.js';

function sample() {
  const p = blank();
  p.cards = [0, 1, 2].map((i) => newCard({ x: i * 350, y: 50 }));
  p.relations = [newRelation(p.cards[0].id, p.cards[2].id)];
  togglePinned(p.cards[1]);
  return p;
}
test('group namespace validates unique membership and references, preserving unknown namespaces on roundtrip', () => {
  const p = sample(),
    ids = p.cards.map((c) => c.id);
  createGroup(p, { id: 'g', title: 'Learning', cardIds: ids.slice(0, 2) });
  p.extensions['other:data'] = { preserve: true };
  assert.deepEqual(stage(serialize(p)).project, p);
  for (const mutate of [
    (q) =>
      q.extensions[GROUPS].groups.push({ id: 'g2', title: 'Duplicate member', cardIds: [ids[0]] }),
    (q) => q.extensions[GROUPS].groups[0].cardIds.push('missing'),
    (q) => q.extensions[GROUPS].groups[0].cardIds.push(ids[0]),
    (q) => (q.extensions[GROUPS].groups[0].title = ' '),
    (q) => (q.extensions[GROUPS].groups[0].title = 'x'.repeat(121)),
    (q) => (q.extensions[GROUPS].groups[0].cardIds = []),
    (q) => (q.extensions[GROUPS].groups[0].extra = 'not supported'),
  ]) {
    const q = structuredClone(p);
    mutate(q);
    assert.ok(validate(q).errors.length);
  }
  assert.throws(
    () => createGroup(p, { id: 'second', title: 'Other', cardIds: [ids[0], ids[2]] }),
    /groupAlreadyAssigned/,
  );
});
for (const view of ['card', 'mind'])
  test(`frame membership drag/ungroup/delete are atomic and preserve pins in ${view}`, () => {
    const store = new ProjectStore();
    store.replace(sample());
    const ids = store.project.cards.map((c) => c.id);
    store.commit((p) => createGroup(p, { id: 'g', title: 'Team', cardIds: ids.slice(0, 2) }));
    const before = structuredClone(store.project);
    store.commit((p) => moveCards(p, cardGroups(p)[0].cardIds, { x: 75, y: 25 }, view));
    const after = structuredClone(store.project);
    assert.deepEqual(after.cards[1], before.cards[1]);
    assert.deepEqual(
      geometry(after, after.cards[1], 'mind'),
      geometry(before, before.cards[1], 'mind'),
    );
    assert.equal(
      geometry(after, after.cards[0], view).position.x,
      geometry(before, before.cards[0], view).position.x + 75,
    );
    store.undo();
    assert.deepEqual(store.project, before);
    store.redo();
    assert.deepEqual(store.project, after);
    store.commit((p) => removeGroup(p, 'g'));
    assert.deepEqual(store.project.cards, after.cards);
    assert.deepEqual(store.project.relations, after.relations);
    store.undo();
    store.commit((p) => remove(p, { kind: 'card', id: ids[0] }));
    assert.deepEqual(cardGroups(store.project)[0].cardIds, [ids[1]]);
    store.undo();
    assert.deepEqual(store.project, after);
    assert.deepEqual(stage(serialize(after)).project, after);
    const rects = new Map(after.cards.map((c) => [c.id, geometry(after, c, view)]));
    const bounds = frameBounds(rects, ids.slice(0, 2));
    assert.ok(bounds.x < geometry(after, after.cards[0], view).position.x);
    assert.ok(bounds.width > 350);
  });
test('routes preserve defaults and endpoint meaning; invalid routing and pinned relation edits fail atomically', () => {
  const p = sample();
  assert.equal(edgeRoute(p.relations[0]), 'curved');
  for (const route of routeTypes) {
    p.relations[0].extensions = { [EDGE]: { route } };
    assert.deepEqual(stage(serialize(p)).project, p);
  }
  for (const value of [{ route: 'script' }, { route: 'straight', css: 'evil' }, null]) {
    p.relations[0].extensions = { [EDGE]: value };
    assert.ok(validate(p).errors.length);
  }
  p.relations[0].extensions = { [EDGE]: { route: 'straight' } };
  togglePinned(p.cards[0]);
  const store = new ProjectStore();
  store.replace(p);
  const before = serialize(store.project);
  assert.throws(
    () =>
      store.commit((q) => {
        q.relations[0].extensions[EDGE].route = 'orthogonal';
      }),
    /pinnedCardLocked/,
  );
  assert.equal(serialize(store.project), before);
  assert.equal(store.undoStack.length, 0);
});
