import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BACKGROUND_ID,
  QUICK_BACKGROUNDS,
  currentQuickBackground,
  defaultBackground,
  setQuickBackground,
} from '../assets/js/graph/card-quick-color.js';

const note = (backgroundColor, kind) => ({
  style: { backgroundColor },
  extensions: kind ? { 'card-atlas:node': { kind } } : undefined,
});

test('default background depends on the node kind', () => {
  assert.equal(defaultBackground(note('#000000')), '#FFF2B0');
  assert.equal(defaultBackground(note('#000000', 'text')), '#FFFFFF');
});

test('current swatch is matched case-insensitively and custom colours match nothing', () => {
  assert.equal(currentQuickBackground(note('#fff2b0')), DEFAULT_BACKGROUND_ID);
  assert.equal(currentQuickBackground(note('#e8f0fb')), 'blue');
  assert.equal(currentQuickBackground(note('#123456')), null);
});

test('setQuickBackground changes only the background and reports no-ops', () => {
  const card = note('#FFF2B0');
  card.style.textColor = '#111111';
  assert.equal(setQuickBackground(card, 'sage'), true);
  assert.deepEqual(card.style, { backgroundColor: '#E3EFE8', textColor: '#111111' });
  assert.equal(setQuickBackground(card, 'sage'), false);
  assert.equal(setQuickBackground(card, DEFAULT_BACKGROUND_ID), true);
  assert.equal(card.style.backgroundColor, '#FFF2B0');
  assert.throws(() => setQuickBackground(card, 'nope'), /quickColorInvalid/);
});

test('palette ids and values are unique', () => {
  assert.equal(new Set(QUICK_BACKGROUNDS.map((c) => c.id)).size, QUICK_BACKGROUNDS.length);
  assert.equal(new Set(QUICK_BACKGROUNDS.map((c) => c.value)).size, QUICK_BACKGROUNDS.length);
});

test('a custom #RRGGBB value is accepted and normalised; anything else is rejected', () => {
  const card = note('#FFF2B0');
  assert.equal(setQuickBackground(card, '#336699'), true);
  assert.equal(card.style.backgroundColor, '#336699');
  assert.equal(setQuickBackground(card, '#336699'), false);
  assert.throws(() => setQuickBackground(card, '#33669'), /quickColorInvalid/);
});
