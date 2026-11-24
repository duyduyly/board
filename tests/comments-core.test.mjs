import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMENTS,
  COMMENT_LIMITS,
  addComment,
  cardComments,
  commentBlocks,
  commentCount,
  commentIssues,
  commentsText,
  removeComment,
} from '../assets/js/graph/card-comments.js';

const at = '2026-11-24T08:15:30.123Z';
const add = (card, id, text) => addComment(card, { id, createdAt: at, text });

test('commentBlocks parses bullets, numbered lists and paragraphs', () => {
  assert.deepEqual(commentBlocks('- a\n* b'), [
    { type: 'list', ordered: false, items: ['a', 'b'] },
  ]);
  assert.deepEqual(commentBlocks('1. a\n2. b'), [
    { type: 'list', ordered: true, start: 1, items: ['a', 'b'] },
  ]);
  assert.deepEqual(commentBlocks('3) x\n4) y'), [
    { type: 'list', ordered: true, start: 3, items: ['x', 'y'] },
  ]);
  assert.deepEqual(commentBlocks('one\ntwo'), [{ type: 'paragraph', lines: ['one', 'two'] }]);
  assert.deepEqual(commentBlocks('one\n\ntwo'), [
    { type: 'paragraph', lines: ['one'] },
    { type: 'paragraph', lines: ['two'] },
  ]);
  assert.deepEqual(commentBlocks('intro\n- a\n- b\nafter\n1. n'), [
    { type: 'paragraph', lines: ['intro'] },
    { type: 'list', ordered: false, items: ['a', 'b'] },
    { type: 'paragraph', lines: ['after'] },
    { type: 'list', ordered: true, start: 1, items: ['n'] },
  ]);
  assert.deepEqual(commentBlocks('-not a list'), [{ type: 'paragraph', lines: ['-not a list'] }]);
});

test('addComment normalizes text and enforces limits', () => {
  const card = {};
  add(card, 'comment-1', '\r\n\r\n  first\r\nsecond\r\n\r\n');
  assert.equal(card.extensions[COMMENTS].version, 1);
  assert.equal(cardComments(card)[0].text, '  first\nsecond');
  add(card, 'comment-2', 'next');
  assert.deepEqual(
    cardComments(card).map((c) => c.id),
    ['comment-1', 'comment-2'],
  );
  assert.throws(() => add({}, 'c', ' \n\r\n '), { message: 'commentEmpty' });
  assert.throws(() => add({}, 'c', 'x'.repeat(COMMENT_LIMITS.text + 1)), {
    message: 'commentTooLong',
  });
  assert.doesNotThrow(() => add({}, 'c', 'x'.repeat(COMMENT_LIMITS.text)));
  const full = {};
  for (let i = 0; i < COMMENT_LIMITS.items; i++) add(full, 'c' + i, 't');
  assert.throws(() => add(full, 'extra', 't'), { message: 'commentLimit' });
  assert.equal(commentCount(full), COMMENT_LIMITS.items);
});

test('removeComment cleans empty namespace and extensions', () => {
  const card = { extensions: { other: { a: 1 } } };
  add(card, 'a', 'one');
  add(card, 'b', 'two');
  assert.equal(removeComment(card, 'missing'), false);
  assert.equal(removeComment(card, 'a'), true);
  assert.deepEqual(
    cardComments(card).map((c) => c.id),
    ['b'],
  );
  assert.equal(removeComment(card, 'b'), true);
  assert.deepEqual(card.extensions, { other: { a: 1 } });
  const only = {};
  add(only, 'x', 'one');
  removeComment(only, 'x');
  assert.equal('extensions' in only, false);
});

test('commentIssues flags bad timestamps and duplicate ids', () => {
  const card = {};
  add(card, 'a', 'one');
  assert.deepEqual(commentIssues(card, '$.cards[0]'), []);
  card.extensions[COMMENTS].items.push(
    { id: 'a', createdAt: '2026-02-30T00:00:00.000Z', text: 'dup' },
    { id: 'b', createdAt: 'nope', text: 'bad' },
  );
  const issues = commentIssues(card, '$.cards[0]');
  assert.deepEqual(
    issues.map((i) => i.code),
    ['format', 'duplicateId', 'format'],
  );
  assert.ok(issues[1].path.endsWith('items[1].id'));
});

test('commentsText and commentCount handle cards without comments', () => {
  assert.equal(commentCount({}), 0);
  assert.equal(commentsText({}), '');
  const card = {};
  add(card, 'a', 'alpha');
  add(card, 'b', 'beta');
  assert.equal(commentCount(card), 2);
  assert.equal(commentsText(card), 'alpha\nbeta');
});
