import assert from 'node:assert/strict';
import test from 'node:test';
import en from '../assets/js/i18n/en.js';
import vi from '../assets/js/i18n/vi.js';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const KEYS = {
  groupAddCards: [],
  groupAddCardsHint: [],
  groupAddCardsTitle: [],
  groupAddCardsHeading: ['count'],
  groupAddCardsHeadingOne: ['count'],
  groupNoteCount: ['count'],
  groupNoteCountOne: ['count'],
  groupAddMixed: [],
  groupCardsAdded: ['count', 'title'],
  groupCardsAddedOne: ['count', 'title'],
  groupRemoveCards: [],
  groupRemoveCardsHint: [],
  groupCardsRemoved: ['count'],
  groupCardsRemovedOne: ['count'],
  groupCardsMoved: ['count', 'from', 'to'],
  groupCardsMovedOne: ['count', 'from', 'to'],
  groupRemoveCardFrom: ['title'],
};

test('add/remove group strings exist in both locales with matching placeholders', () => {
  for (const [key, expected] of Object.entries(KEYS))
    for (const dict of [vi, en]) {
      assert.equal(typeof dict[key], 'string', key);
      assert.ok(dict[key].length, key);
      assert.deepEqual(placeholders(dict[key]), expected, key);
    }
});

test('english singular variants read as one note', () => {
  for (const key of ['groupNoteCount', 'groupCardsAdded', 'groupCardsRemoved', 'groupCardsMoved'])
    assert.doesNotMatch(en[key + 'One'], /\bnotes\b/, key);
  assert.doesNotMatch(en.groupAddCardsHeadingOne, /\bnotes\b/);
});
