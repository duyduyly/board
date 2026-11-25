import assert from 'node:assert/strict';
import test from 'node:test';
import en from '../assets/js/i18n/en.js';
import vi from '../assets/js/i18n/vi.js';
import { issueMessage, setLocale } from '../assets/js/i18n/index.js';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const KEYS = {
  timelineBoardCount: ['count'],
  timelineBoardEmpty: [],
  timelineBoardOpenFor: ['count', 'title'],
  boardScopeLabel: [],
  boardScopeBack: [],
  boardScopeCount: ['count'],
  boardScopeEmptyTitle: ['title'],
  boardScopeEmptyBody: [],
  boardScopeClosed: [],
  boardScopeIn: ['title'],
  boardDeleteTitle: [],
  boardDeleteBody: ['count', 'count', 'title'],
  boardDeleteConfirm: [],
  deletedCardWithBoard: ['count', 'title'],
  boardDeletePinned: [],
  timelineRemoveBoardsBody: ['count'],
  timelineRemovePinnedBoards: [],
  errorOwnerMissing: [],
  errorOwnerNested: [],
  errorOwnerWithoutTimeline: [],
  errorRelationScope: [],
  errorGroupScope: [],
  errorMindRootScope: [],
  errorMindBoardRootScope: [],
  mindConvertBoardHint: ['title'],
};

test('board scope i18n keys exist in both locales with the expected placeholders', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(vi).sort());
  for (const [key, expected] of Object.entries(KEYS)) {
    for (const dict of [vi, en]) {
      assert.equal(typeof dict[key], 'string', key);
      assert.ok(dict[key].length > 0, key);
      assert.deepEqual(placeholders(dict[key]), expected, key);
    }
  }
  for (const guide of [vi.aiGuide, en.aiGuide]) assert.match(guide, /card-atlas:owner/);
  for (const guide of [vi.aiGuide, en.aiGuide, vi.mindGuide, en.mindGuide])
    assert.match(guide, /boardRoots/);
});

test('scope issue codes map to translated messages', () => {
  const codes = {
    ownerMissing: 'errorOwnerMissing',
    ownerNested: 'errorOwnerNested',
    ownerWithoutTimeline: 'errorOwnerWithoutTimeline',
    relationScope: 'errorRelationScope',
    groupScope: 'errorGroupScope',
    mindRootScope: 'errorMindRootScope',
    mindBoardRootScope: 'errorMindBoardRootScope',
  };
  for (const [locale, dict] of [
    ['vi', vi],
    ['en', en],
  ]) {
    setLocale(locale);
    for (const [code, key] of Object.entries(codes))
      assert.equal(issueMessage({ code, path: 'x' }), dict[key], locale + ':' + code);
  }
  setLocale('vi');
});
