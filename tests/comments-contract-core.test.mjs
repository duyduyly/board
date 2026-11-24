import test from 'node:test';
import assert from 'node:assert/strict';
import schema from '../assets/js/json/schema.js';
import { blank, serialize, stage, validate } from '../assets/js/json/validator.js';
import { ProjectStore, newCard } from '../assets/js/store/project-store.js';
import { togglePinned } from '../assets/js/graph/card-metadata.js';
import {
  COMMENTS,
  COMMENT_LIMITS,
  addComment,
  cardComments,
} from '../assets/js/graph/card-comments.js';
import { copyCards, pasteCards } from '../assets/js/graph/copy-cards.js';
import { selectionFile } from '../assets/js/json/selection-export.js';

const AT = '2026-01-02T03:04:05.000Z';
const comment = (n = 1, extra = {}) => ({
  id: `c${n}`,
  createdAt: AT,
  text: `Note ${n}`,
  ...extra,
});
const commentSchema = schema.$defs.card.properties.extensions.properties[COMMENTS];

function storeWith(count = 1) {
  const p = blank();
  p.cards = [newCard({ x: 0, y: 0 }), newCard({ x: 400, y: 0 })];
  for (let n = 1; n <= count; n++) addComment(p.cards[0], comment(n));
  const store = new ProjectStore();
  store.replace(p);
  return store;
}
const withComments = (value) => {
  const p = blank();
  p.cards = [newCard({ x: 0, y: 0 })];
  p.cards[0].extensions = { ...p.cards[0].extensions, [COMMENTS]: value };
  return serialize(p);
};
const rejects = (value) => assert.notDeepEqual(stage(withComments(value)).errors, []);

test('schema limits come from COMMENT_LIMITS', () => {
  assert.equal(commentSchema.properties.items.maxItems, COMMENT_LIMITS.items);
  assert.equal(commentSchema.properties.items.items.properties.text.maxLength, COMMENT_LIMITS.text);
});

test('comments round-trip through stage and serialize', () => {
  const store = storeWith(2);
  const first = serialize(store.project);
  const staged = stage(first);
  assert.deepEqual(staged.errors, []);
  assert.deepEqual(cardComments(staged.project.cards[0]), [comment(1), comment(2)]);
  assert.equal(serialize(staged.project), first);
});

test('contract rejects malformed comments', () => {
  const ok = { version: 1, items: [comment()] };
  assert.deepEqual(stage(withComments(ok)).errors, []);
  rejects({ ...ok, extra: true });
  rejects({ version: 1, items: [comment(1, { extra: 1 })] });
  rejects({ version: 1, items: [comment(1, { text: '' })] });
  rejects({ version: 1, items: [comment(1, { text: '  \n\t ' })] });
  rejects({ version: 1, items: [comment(1, { text: 'x'.repeat(COMMENT_LIMITS.text + 1) })] });
  rejects({
    version: 1,
    items: Array.from({ length: COMMENT_LIMITS.items + 1 }, (_, n) => comment(n)),
  });
  rejects({ version: 1, items: [comment(1, { createdAt: '2026-01-02' })] });
  rejects({ version: 1, items: [comment(1, { createdAt: '2026-13-45T03:04:05.000Z' })] });
  rejects({ version: 1, items: [comment(1), comment(1)] });
  rejects({ version: 2, items: [comment()] });
  assert.deepEqual(
    stage(
      withComments({
        version: 1,
        items: [comment(1, { text: 'x'.repeat(COMMENT_LIMITS.text) })],
      }),
    ).errors,
    [],
  );
});

test('validator reports comment issue paths', () => {
  const issue = (items, code) =>
    validate(JSON.parse(withComments({ version: 1, items }))).errors.find((e) => e.code === code);
  assert.equal(
    issue([comment(1), comment(1)], 'duplicateId').path,
    `cards[0].extensions.${COMMENTS}.items[1].id`,
  );
  assert.equal(
    issue([comment(1, { createdAt: '2026-13-45T03:04:05.000Z' })], 'format').path,
    `cards[0].extensions.${COMMENTS}.items[0].createdAt`,
  );
});

test('adding a comment is one undo step and replays on redo', () => {
  const store = storeWith(0);
  const before = serialize(store.project);
  store.commit((p) => addComment(p.cards[0], comment()));
  assert.equal(store.undoStack.length, 1);
  assert.equal(cardComments(store.project.cards[0]).length, 1);
  store.undo();
  assert.equal(serialize(store.project), before);
  store.redo();
  assert.deepEqual(cardComments(store.project.cards[0]), [comment()]);
});

test('pinned cards reject comment commits', () => {
  const store = storeWith(1);
  store.commit((p) => togglePinned(p.cards[0]));
  const before = serialize(store.project),
    depth = store.undoStack.length;
  assert.throws(() => store.commit((p) => addComment(p.cards[0], comment(2))), /pinnedCardLocked/);
  assert.equal(serialize(store.project), before);
  assert.equal(store.undoStack.length, depth);
});

test('copy/paste and selection export keep comments', () => {
  const store = storeWith(2);
  const ids = [store.project.cards[0].id];
  const snapshot = copyCards(store.project, ids);
  store.commit((p) => pasteCards(p, snapshot, { offset: 20, newId: (k) => `${k}-new` }));
  const pasted = store.project.cards[2];
  assert.deepEqual(cardComments(pasted), cardComments(store.project.cards[0]));
  const { text } = selectionFile(store.project, ids);
  const exported = stage(text);
  assert.deepEqual(exported.errors, []);
  assert.deepEqual(cardComments(exported.project.cards[0]), [comment(1), comment(2)]);
});
