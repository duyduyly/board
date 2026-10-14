import test from 'node:test';
import assert from 'node:assert/strict';
import { newCard, ProjectStore } from '../assets/js/store/project-store.js';
import { blank, validate, serialize, stage } from '../assets/js/json/validator.js';
import {
  CARD_META,
  togglePinned,
  stampCreated,
  setCreatedDate,
  cardDateValue,
} from '../assets/js/graph/card-metadata.js';
import { mergeNode } from '../assets/js/json/node-transfer.js';
test('creation metadata is typed, calendar-valid, portable and undo atomic', () => {
  const p = blank(),
    c = newCard({ x: 0, y: 0 });
  p.cards.push(c);
  const time = c.extensions[CARD_META].createdAt;
  assert.equal(new Date(time).toISOString(), time);
  const store = new ProjectStore();
  store.replace(p);
  store.commit((d) => togglePinned(d.cards[0]));
  assert.equal(store.project.cards[0].extensions[CARD_META].pinned, true);
  assert.equal(store.project.cards[0].extensions[CARD_META].createdAt, time);
  store.undo();
  assert.deepEqual(store.project, p);
  store.redo();
  assert.deepEqual(stage(serialize(store.project)).errors, []);
  for (const bad of [
    { pinned: 'yes' },
    { createdAt: '2026-02-30T00:00:00.000Z' },
    { createdAt: 'today' },
    { createdAt: null },
    { unsafe: 1 },
  ]) {
    c.extensions[CARD_META] = bad;
    assert.ok(validate(p).errors.length);
  }
  delete c.extensions;
  assert.deepEqual(validate(p).errors, []);
});
test('Update preserves target creation/pin metadata while duplicate stamping retains pin', () => {
  const c = newCard({ x: 0, y: 0 }),
    source = newCard({ x: 0, y: 0 });
  stampCreated(c, '2020-01-01T00:00:00.000Z');
  togglePinned(c);
  assert.deepEqual(
    mergeNode(c, source, { takeUnknown: true }).card.extensions[CARD_META],
    c.extensions[CARD_META],
  );
  stampCreated(c, '2026-10-14T00:00:00.000Z');
  assert.equal(c.extensions[CARD_META].pinned, true);
});

test('committed signature cache follows pin, undo, redo, export and rejects candidate mutations', () => {
  const p = blank();
  p.cards.push(newCard({ x: 0, y: 0 }));
  const store = new ProjectStore();
  store.replace(p);
  assert.equal(store.dirty, false);
  const signature = store.contentSignature;
  store.setView(0.5, { x: 10, y: 20 });
  assert.equal(store.contentSignature, signature);
  assert.equal(store.dirty, false);
  store.commit((d) => togglePinned(d.cards[0]));
  assert.equal(store.dirty, true);
  store.undo();
  assert.equal(store.dirty, false);
  store.redo();
  store.exported();
  assert.equal(store.dirty, false);
  store.undo();
  assert.equal(store.dirty, true);
  store.redo();
  assert.equal(store.dirty, false);
  assert.throws(() =>
    store.commit((d) => {
      d.cards[0].title = '';
    }),
  );
  assert.equal(store.dirty, false);
});

test('manual date validates calendar, round trips, clears and duplicate starts fresh', () => {
  const p = blank(),
    c = newCard({ x: 0, y: 0 });
  p.cards.push(c);
  const original = c.extensions[CARD_META].createdAt;
  setCreatedDate(c, '2024-02-29');
  assert.equal(cardDateValue(c), '2024-02-29');
  assert.equal(c.extensions[CARD_META].createdAt, original);
  assert.deepEqual(stage(serialize(p)).errors, []);
  for (const bad of ['2023-02-29', '2026-04-31', '0000-01-01', 'today']) {
    setCreatedDate(c, bad);
    assert.ok(validate(p).errors.length);
  }
  setCreatedDate(c, '2024-02-29');
  stampCreated(c);
  assert.equal(c.extensions[CARD_META].createdDate, undefined);
  setCreatedDate(c, '2024-02-29');
  setCreatedDate(c, '');
  assert.equal(c.extensions[CARD_META].createdDate, undefined);
  assert.deepEqual(validate(p).errors, []);
});
