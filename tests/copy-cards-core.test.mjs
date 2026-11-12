import test from 'node:test';
import assert from 'node:assert/strict';
import { copyCards, pasteCards } from '../assets/js/graph/copy-cards.js';
import { validate } from '../assets/js/json/validator.js';

const NOW = '2026-11-12T08:00:00.000Z';
const card = (id, x, extensions) => ({
  id,
  title: 'Note ' + id,
  summary: '',
  content: '',
  type: 'note',
  tags: [],
  position: { x, y: 10 },
  size: { width: 220, height: 120 },
  ...(extensions ? { extensions } : {}),
});
const relation = (id, source, target) => ({
  id,
  source,
  target,
  label: 'uses',
  description: '',
  type: 'default',
  style: { color: '#64748b', line: 'solid', arrow: 'end' },
});
const project = () => ({
  version: '1.0',
  metadata: { title: 'Copy test' },
  canvas: { zoom: 1, position: { x: 0, y: 0 } },
  cards: [
    card('a', 0, {
      'card-atlas:metadata': { pinned: true, createdAt: '2026-01-01T00:00:00.000Z' },
    }),
    card('b', 300),
    card('c', 600),
  ],
  relations: [relation('ab', 'a', 'b'), relation('bc', 'b', 'c')],
  extensions: {
    'card-atlas:views': {
      mindMap: { positions: { a: { x: 50, y: 60 } }, sizes: { a: { width: 260, height: 80 } } },
    },
  },
});
const counter = () => {
  let n = 0;
  return (kind) => kind + '-new-' + ++n;
};

test('copyCards keeps only relations inside the selection and detaches the snapshot', () => {
  const source = project();
  const snapshot = copyCards(source, ['a', 'b']);
  assert.deepEqual(
    snapshot.cards.map((item) => item.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    snapshot.relations.map((item) => item.id),
    ['ab'],
  );
  assert.deepEqual(snapshot.mind, {
    a: { position: { x: 50, y: 60 }, size: { width: 260, height: 80 } },
  });
  source.cards[0].title = 'changed';
  assert.equal(snapshot.cards[0].title, 'Note a');
});

test('pasteCards appends unpinned, re-stamped copies with rewired relations and shifted geometry', () => {
  const p = project();
  const snapshot = copyCards(p, ['a', 'b']);
  const ids = pasteCards(p, snapshot, { offset: 36, newId: counter(), now: NOW });
  assert.deepEqual(ids, ['card-new-1', 'card-new-2']);
  assert.equal(p.cards.length, 5);
  const copy = p.cards.find((item) => item.id === 'card-new-1');
  assert.deepEqual(copy.position, { x: 36, y: 46 });
  assert.deepEqual(copy.size, { width: 220, height: 120 });
  assert.deepEqual(copy.extensions['card-atlas:metadata'], { createdAt: NOW });
  assert.equal(p.cards[0].extensions['card-atlas:metadata'].pinned, true);
  const added = p.relations.at(-1);
  assert.deepEqual(
    [added.id, added.source, added.target, added.label],
    ['relation-new-3', 'card-new-1', 'card-new-2', 'uses'],
  );
  assert.equal(p.relations.length, 3);
  const mind = p.extensions['card-atlas:views'].mindMap;
  assert.deepEqual(mind.positions['card-new-1'], { x: 86, y: 96 });
  assert.deepEqual(mind.sizes['card-new-1'], { width: 260, height: 80 });
  assert.equal(mind.positions['card-new-2'], undefined);
  assert.deepEqual(validate(p).errors, []);
});

test('a snapshot can be pasted repeatedly and after its originals were removed', () => {
  const p = project();
  const snapshot = copyCards(p, ['c']);
  p.cards = p.cards.filter((item) => item.id !== 'c');
  p.relations = p.relations.filter((item) => item.id !== 'bc');
  const newId = counter();
  const first = pasteCards(p, snapshot, { offset: 36, newId, now: NOW });
  const second = pasteCards(p, snapshot, { offset: 72, newId, now: NOW });
  assert.notEqual(first[0], second[0]);
  assert.deepEqual(p.cards.find((item) => item.id === second[0]).position, { x: 672, y: 82 });
  assert.equal(snapshot.cards[0].id, 'c');
  assert.deepEqual(validate(p).errors, []);
});
