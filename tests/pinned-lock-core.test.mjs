import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectStore, newCard, newRelation, remove } from '../assets/js/store/project-store.js';
import { blank, serialize, stage } from '../assets/js/json/validator.js';
import { togglePinned, isPinned } from '../assets/js/graph/card-metadata.js';
import { geometry, setGeometry, MIND } from '../assets/js/graph/mind-map.js';
import {
  applyUniformStyles,
  uniformProfile,
  textFields,
} from '../assets/js/graph/card-typography.js';
import { radialLayout, applyLayout } from '../assets/js/graph/radial-layout.js';

function sample() {
  const p = blank();
  p.cards = [newCard({ x: 0, y: 0 }), newCard({ x: 400, y: 400 }), newCard({ x: 800, y: 0 })];
  p.relations = [newRelation(p.cards[0].id, p.cards[1].id)];
  p.extensions = { [MIND]: { rootId: p.cards[0].id } };
  togglePinned(p.cards[0]);
  const store = new ProjectStore();
  store.replace(p);
  return store;
}
test('pinned snapshot rejects edits, geometry, cascade, relationships and combined unpin edits atomically', () => {
  const store = sample(),
    before = serialize(store.project),
    id = store.project.cards[0].id;
  const mutations = [
    (p) => {
      p.cards[0].content = 'changed';
      p.cards[2].title = 'must roll back';
    },
    (p) => {
      p.cards[0].position.x++;
    },
    (p) => {
      p.cards[0].size.width++;
    },
    (p) => setGeometry(p, id, 'mind', 'position', { x: 12, y: 34 }),
    (p) => setGeometry(p, id, 'mind', 'size', { width: 400, height: 400 }),
    (p) => remove(p, { kind: 'card', id }),
    (p) => remove(p, { kind: 'card', id: p.cards[1].id }),
    (p) => {
      p.relations[0].label = 'new';
    },
    (p) => {
      p.relations = [];
    },
    (p) => {
      p.relations.push(newRelation(id, p.cards[2].id));
    },
    (p) => {
      p.extensions[MIND].rootId = p.cards[1].id;
    },
    (p) => {
      togglePinned(p.cards[0]);
      p.cards[0].title = 'bypass';
    },
  ];
  for (const mutation of mutations) {
    assert.throws(() => store.commit(mutation), /pinnedCardLocked/);
    assert.equal(serialize(store.project), before);
    assert.equal(store.undoStack.length, 0);
    assert.equal(store.redoStack.length, 0);
    assert.equal(store.dirty, false);
  }
  store.commit((p) => {
    p.cards[2].title = 'Unrelated edit allowed';
  });
  assert.equal(store.undoStack.length, 1);
});
test('unpin command and history replay work, JSON lock survives round trip', () => {
  const store = sample();
  assert.equal(isPinned(stage(serialize(store.project)).project.cards[0]), true);
  store.commit((p) => togglePinned(p.cards[0]));
  store.commit((p) => {
    p.cards[0].title = 'Editable';
  });
  store.undo();
  store.undo();
  assert.equal(isPinned(store.project.cards[0]), true);
  assert.throws(
    () =>
      store.commit((p) => {
        p.cards[0].title = 'still locked';
      }),
    /pinnedCardLocked/,
  );
  store.redo();
  store.redo();
  assert.equal(store.project.cards[0].title, 'Editable');
});
test('uniform styles skip locked cards and layout preview/apply preserves their geometry', () => {
  const store = sample(),
    original = structuredClone(store.project.cards[0]);
  const originalMind = geometry(store.project, original, 'mind');
  const styles = Object.fromEntries(textFields.map((f) => [f, { fontSize: 24 }]));
  const profile = uniformProfile(store.project.cards[1], styles);
  store.commit((p) => applyUniformStyles(p, profile, 'card', () => ({ width: 400, height: 200 })));
  assert.deepEqual(store.project.cards[0], original);
  const result = radialLayout(store.project);
  assert.deepEqual(result.positions[original.id], originalMind.position);
  store.commit((p) => applyLayout(p, result));
  assert.deepEqual(geometry(store.project, store.project.cards[0], 'mind'), originalMind);
  assert.deepEqual(store.project.cards[0], original);
  assert.deepEqual(stage(serialize(store.project)).errors, []);
});
