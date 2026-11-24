import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUS,
  STATUS_VALUES,
  cardStatus,
  effectiveStatus,
  setStatus,
} from '../assets/js/graph/card-status.js';

test('STATUS_VALUES lists the five statuses', () => {
  assert.deepEqual([...STATUS_VALUES], ['new', 'in-progress', 'done', 'blocked', 'cancelled']);
});

test('cardStatus is null without a status', () => {
  assert.equal(cardStatus({}), null);
  assert.equal(cardStatus({ extensions: {} }), null);
  assert.equal(cardStatus(undefined), null);
});

test('effectiveStatus defaults a missing key to new', () => {
  assert.equal(effectiveStatus({}), 'new');
  assert.equal(effectiveStatus(undefined), 'new');
  assert.equal(effectiveStatus({ extensions: { [STATUS]: { value: 'done' } } }), 'done');
});

test('setStatus assigns and changes the status', () => {
  const card = {};
  assert.equal(setStatus(card, 'in-progress'), true);
  assert.deepEqual(card.extensions[STATUS], { value: 'in-progress' });
  assert.equal(setStatus(card, 'done'), true);
  assert.equal(cardStatus(card), 'done');
});

test('choosing the default new on a note without a key changes nothing', () => {
  const card = {};
  assert.equal(setStatus(card, 'new'), false);
  assert.deepEqual(card, {});
});

test('choosing new on another status drops the key', () => {
  const card = { id: 'a' };
  setStatus(card, 'blocked');
  assert.equal(setStatus(card, 'new'), true);
  assert.deepEqual(card, { id: 'a' });
  assert.equal(effectiveStatus(card), 'new');
});

test('an explicit stored new is kept when new is chosen again', () => {
  const card = { extensions: { [STATUS]: { value: 'new' } } };
  assert.equal(setStatus(card, 'new'), false);
  assert.deepEqual(card.extensions[STATUS], { value: 'new' });
});

test('setStatus returns false when nothing changes', () => {
  const card = {};
  assert.equal(setStatus(card, null), false);
  assert.deepEqual(card, {});
  setStatus(card, 'blocked');
  assert.equal(setStatus(card, 'blocked'), false);
});

test('setStatus throws statusInvalid for values outside the enum', () => {
  const card = {};
  assert.throws(() => setStatus(card, 'finished'), { message: 'statusInvalid' });
  assert.throws(() => setStatus(card, ''), { message: 'statusInvalid' });
  assert.deepEqual(card, {});
});

test('clearing the status removes empty extensions', () => {
  const card = { id: 'a' };
  setStatus(card, 'done');
  assert.equal(setStatus(card, null), true);
  assert.deepEqual(card, { id: 'a' });
});

test('clearing keeps other extensions and setting does not touch them', () => {
  const card = { extensions: { 'card-atlas:comments': { version: 1, items: [] } } };
  setStatus(card, 'in-progress');
  assert.deepEqual(Object.keys(card.extensions).sort(), ['card-atlas:comments', STATUS]);
  assert.equal(setStatus(card, null), true);
  assert.deepEqual(card.extensions, { 'card-atlas:comments': { version: 1, items: [] } });
});
