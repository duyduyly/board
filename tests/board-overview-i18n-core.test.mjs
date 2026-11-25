import assert from 'node:assert/strict';
import test from 'node:test';
import en from '../assets/js/i18n/en.js';
import vi from '../assets/js/i18n/vi.js';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const KEYS = {
  timelineOverview: [],
  timelineOverviewHint: [],
  timelineBoardOpen: [],
  boardOverviewTitle: [],
  boardOverviewNotes: ['count'],
  boardOverviewNotesOne: [],
  boardOverviewBoards: ['count'],
  boardOverviewBoardsOne: [],
  boardOverviewHint: [],
  boardOverviewLocked: [],
  boardOverviewClosed: [],
  boardScopeBackOverview: [],
};

test('board overview i18n keys exist in both locales with the expected placeholders', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(vi).sort());
  for (const [key, expected] of Object.entries(KEYS)) {
    for (const dict of [vi, en]) {
      assert.equal(typeof dict[key], 'string', key);
      assert.ok(dict[key].length > 0, key);
      assert.deepEqual(placeholders(dict[key]), expected, key);
    }
  }
});

test('the replaced timelineOpenOn key is gone from both locales', () => {
  assert.equal('timelineOpenOn' in vi, false);
  assert.equal('timelineOpenOn' in en, false);
});
