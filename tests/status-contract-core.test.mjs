import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import schema from '../assets/js/json/schema.js';
import { blank, serialize, stage } from '../assets/js/json/validator.js';
import { ProjectStore, newCard } from '../assets/js/store/project-store.js';
import { togglePinned } from '../assets/js/graph/card-metadata.js';
import { STATUS, STATUS_VALUES, cardStatus, setStatus } from '../assets/js/graph/card-status.js';
import { copyCards, pasteCards } from '../assets/js/graph/copy-cards.js';
import { selectionFile } from '../assets/js/json/selection-export.js';
import { stageNode } from '../assets/js/json/node-transfer.js';

const statusSchema = schema.$defs.card.properties.extensions.properties[STATUS];

function storeWith(value = 'in-progress') {
  const p = blank();
  p.cards = [newCard({ x: 0, y: 0 }), newCard({ x: 400, y: 0 })];
  // An explicit stored `new` is still valid contract data even though setStatus drops the key.
  if (value === 'new') p.cards[0].extensions = { [STATUS]: { value } };
  else if (value) setStatus(p.cards[0], value);
  const store = new ProjectStore();
  store.replace(p);
  return store;
}
const withStatus = (value) => {
  const p = blank();
  p.cards = [newCard({ x: 0, y: 0 })];
  p.cards[0].extensions = { ...p.cards[0].extensions, [STATUS]: value };
  return serialize(p);
};
const rejects = (value) => assert.notDeepEqual(stage(withStatus(value)).errors, []);

test('schema enum comes from STATUS_VALUES', () => {
  assert.deepEqual(statusSchema.properties.value.enum, [...STATUS_VALUES]);
  assert.deepEqual(statusSchema.required, ['value']);
});

test('every status value round-trips through stage and serialize', () => {
  for (const value of STATUS_VALUES) {
    const first = serialize(storeWith(value).project);
    const staged = stage(first);
    assert.deepEqual(staged.errors, []);
    assert.equal(cardStatus(staged.project.cards[0]), value);
    assert.equal(serialize(staged.project), first);
  }
});

test('contract rejects malformed status', () => {
  assert.deepEqual(stage(withStatus({ value: 'done' })).errors, []);
  rejects({ value: 'finished' });
  rejects({ value: 'Done' });
  rejects({ value: 'done', extra: true });
  rejects({});
  rejects('done');
  rejects({ value: null });
});

test('setting a status is one undo step', () => {
  const store = storeWith(null);
  const before = serialize(store.project);
  store.commit((p) => setStatus(p.cards[0], 'done'));
  assert.equal(store.undoStack.length, 1);
  assert.equal(cardStatus(store.project.cards[0]), 'done');
  store.undo();
  assert.equal(serialize(store.project), before);
  store.redo();
  assert.equal(cardStatus(store.project.cards[0]), 'done');
});

test('pinned cards reject status commits', () => {
  const store = storeWith('new');
  store.commit((p) => togglePinned(p.cards[0]));
  const before = serialize(store.project),
    depth = store.undoStack.length;
  assert.throws(() => store.commit((p) => setStatus(p.cards[0], 'done')), /pinnedCardLocked/);
  assert.equal(serialize(store.project), before);
  assert.equal(store.undoStack.length, depth);
});

test('copy/paste and selection export keep status', () => {
  const store = storeWith('blocked');
  const ids = [store.project.cards[0].id];
  const snapshot = copyCards(store.project, ids);
  store.commit((p) => pasteCards(p, snapshot, { offset: 20, newId: (k) => `${k}-new` }));
  assert.equal(cardStatus(store.project.cards[2]), 'blocked');
  const { text } = selectionFile(store.project, ids);
  const exported = stage(text);
  assert.deepEqual(exported.errors, []);
  assert.equal(cardStatus(exported.project.cards[0]), 'blocked');
});

test('node transfer example stages cleanly with its status', async () => {
  const text = await fs.readFile('assets/data/node-transfer-example.json', 'utf8');
  const staged = stageNode(text, Buffer.byteLength(text));
  assert.deepEqual(staged.errors ?? [], []);
  assert.equal(cardStatus(staged.project.cards[0]), 'in-progress');
});
