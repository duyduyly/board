import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPEARANCE,
  PLAIN_CARD_RADIUS,
  appearance,
  appearanceWith,
} from '../assets/js/detail/appearance.js';

const card = (value) => ({ extensions: value === undefined ? {} : { [APPEARANCE]: value } });

test('appearanceWith omits the derived default radius when none is stored', () => {
  for (const base of [card(), card({ titleFontSize: 20 }), card({ shape: 'rectangle' })]) {
    const next = appearanceWith(base, { sizeMode: 'manual' });
    assert.equal(next.sizeMode, 'manual');
    assert.equal('radius' in next, false);
  }
  assert.equal(appearance(card()).radius, PLAIN_CARD_RADIUS);
});

test('appearanceWith keeps a stored radius and honors an explicit patch radius', () => {
  assert.equal(appearanceWith(card({ radius: 0 }), { sizeMode: 'manual' }).radius, 0);
  assert.equal(appearanceWith(card({ radius: 24 }), { sizeMode: 'manual' }).radius, 24);
  assert.equal(appearanceWith(card(), { radius: 7 }).radius, 7);
});

test('appearanceWith does not mutate the card and keeps other stored fields', () => {
  const base = card({ shape: 'circle', titleFontSize: 20 });
  const next = appearanceWith(base, { sizeMode: 'manual' });
  assert.deepEqual(base.extensions[APPEARANCE], { shape: 'circle', titleFontSize: 20 });
  assert.equal(next.shape, 'circle');
  assert.equal(next.titleFontSize, 20);
});
