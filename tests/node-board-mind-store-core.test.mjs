import assert from 'node:assert/strict';
import test from 'node:test';
import { OWNER } from '../assets/js/graph/card-scope.js';
import { MIND, mindRootOf, mindRoots, setRoot } from '../assets/js/graph/mind-map.js';
import { CARD_META } from '../assets/js/graph/card-metadata.js';
import { ProjectStore, newCard, remove } from '../assets/js/store/project-store.js';
import { enableTimeline } from '../assets/js/graph/timeline.js';
import { blank, validate } from '../assets/js/json/validator.js';

function owned(id, nodeId) {
  const card = newCard({ x: 0, y: 0 });
  card.id = id;
  if (nodeId) card.extensions[OWNER] = { nodeId };
  return card;
}

function build(pinRoot = false) {
  const p = blank();
  p.cards = [owned('n'), owned('a', 'n'), owned('b', 'n'), owned('x')];
  if (pinRoot) p.cards[1].extensions[CARD_META] = { pinned: true };
  enableTimeline(p);
  setRoot(p, 'x');
  setRoot(p, 'a', false, 'n');
  const store = new ProjectStore();
  store.replace(p);
  return store;
}

test('removing a board root drops its boardRoots entry and the empty map', () => {
  const store = build();
  assert.deepEqual(validate(store.project).errors, []);
  store.commit((p) => remove(p, { kind: 'card', id: 'a' }));
  assert.equal(mindRootOf(store.project, 'n'), undefined);
  assert.equal(store.project.extensions[MIND].boardRoots, undefined);
  assert.equal(mindRootOf(store.project), 'x');
  store.undo();
  assert.equal(mindRootOf(store.project, 'n'), 'a');
});

test('removing the board owner and its notes in one commit leaves a valid project', () => {
  const store = build();
  store.commit((p) => {
    for (const id of ['a', 'b', 'n']) remove(p, { kind: 'card', id });
  });
  assert.deepEqual(validate(store.project).errors, []);
  assert.deepEqual([...mindRoots(store.project)], ['x']);
  assert.equal(store.project.extensions[MIND].boardRoots, undefined);
  store.undo();
  assert.equal(mindRootOf(store.project, 'n'), 'a');
  assert.equal(store.project.cards.length, 4);
});

test('removing only the board owner also drops its entry', () => {
  const store = build();
  store.commit((p) => {
    for (const id of ['a', 'b']) remove(p, { kind: 'card', id });
    remove(p, { kind: 'card', id: 'n' });
  });
  assert.equal(mindRootOf(store.project, 'n'), undefined);
});

test('a pinned board root cannot change role but can be unpinned', () => {
  const store = build(true);
  assert.throws(() => store.commit((p) => setRoot(p, 'b', false, 'n')), /pinnedCardLocked/);
  assert.throws(() => store.commit((p) => setRoot(p, null, false, 'n')), /pinnedCardLocked/);
  assert.equal(mindRootOf(store.project, 'n'), 'a');
  assert.equal(
    store.commit((p) => {
      p.cards[1].extensions[CARD_META].pinned = false;
    }),
    true,
  );
  assert.equal(mindRootOf(store.project, 'n'), 'a');
});
