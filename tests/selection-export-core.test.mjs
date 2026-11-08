import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectionFile } from '../assets/js/json/selection-export.js';
import { stage, validate } from '../assets/js/json/validator.js';

const image = {
  name: 'one.gif',
  mimeType: 'image/gif',
  data: 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
};
const point = (x, y) => ({ x, y });
const fixture = () =>
  stage(
    JSON.stringify({
      version: '1.0',
      metadata: { title: 'Selection', description: 'Example' },
      cards: [
        { id: 'a', title: 'Root', position: point(0, 0) },
        {
          id: 'b',
          title: 'Picture',
          position: point(100, 0),
          extensions: {
            'card-atlas:node': { kind: 'image', coverImageId: 'cover' },
            'card-atlas:images': { cover: image },
            'card-atlas:document': {
              version: 1,
              format: 'html-bs5',
              components: [
                { tag: 'img', attributes: { src: 'attachment:cover', alt: 'Photo' }, children: [] },
              ],
            },
            'test:card': { retained: true },
          },
        },
        { id: 'c', title: 'Third', position: point(200, 0) },
      ],
      relations: [
        {
          id: 'ab',
          source: 'a',
          target: 'b',
          extensions: { 'card-atlas:mind-map': { kind: 'branch' } },
        },
        {
          id: 'bc',
          source: 'b',
          target: 'c',
          extensions: { 'card-atlas:mind-map': { kind: 'branch' }, 'test:edge': { value: 9 } },
        },
      ],
      extensions: {
        'card-atlas:mind-map': { rootId: 'a' },
        'card-atlas:groups': { groups: [{ id: 'g', title: 'Group', cardIds: ['a', 'b', 'c'] }] },
        'card-atlas:views': {
          mindMap: {
            positions: { a: point(0, 1), b: point(2, 3), c: point(4, 5) },
            sizes: { a: { width: 100, height: 80 }, b: { width: 140, height: 90 } },
            viewport: { zoom: 1, position: point(0, 0) },
          },
        },
        'test:project': { opaque: 'must disclose exclusion' },
      },
    }),
  ).project;

test('selected project preserves cards, internal edges and valid partial groups without mutations', () => {
  const project = fixture();
  assert.ok(project);
  const before = JSON.stringify(project);
  const result = selectionFile(project, new Set(['c', 'b']), {
    viewports: {
      card: { zoom: 1.2, position: point(10, 20) },
      mind: { zoom: 0.8, position: point(30, 40) },
    },
  });
  assert.equal(JSON.stringify(project), before);
  assert.deepEqual(result.excludedNamespaces, ['test:project']);
  assert.deepEqual(result.partialGroups, [{ id: 'g', title: 'Group', selected: 2, total: 3 }]);
  assert.equal(result.excludedRelations, 1);
  const parsed = stage(result.text);
  assert.deepEqual(parsed.errors, []);
  const selected = parsed.project;
  assert.deepEqual(
    selected.cards.map((card) => card.id),
    ['b', 'c'],
  );
  assert.deepEqual(selected.cards[0], project.cards[1]);
  assert.deepEqual(selected.relations, [project.relations[1]]);
  assert.deepEqual(selected.extensions['card-atlas:groups'].groups[0].cardIds, ['b', 'c']);
  assert.equal(selected.extensions['card-atlas:mind-map'].rootId, undefined);
  assert.deepEqual(Object.keys(selected.extensions['card-atlas:views'].mindMap.positions), [
    'b',
    'c',
  ]);
  assert.deepEqual(Object.keys(selected.extensions['card-atlas:views'].mindMap.sizes), ['b']);
  assert.deepEqual(selected.canvas, { zoom: 1.2, position: point(10, 20) });
  assert.deepEqual(selected.extensions['card-atlas:views'].mindMap.viewport, {
    zoom: 0.8,
    position: point(30, 40),
  });
  assert.deepEqual(validate(selected).errors, []);
});

test('root, full groups and selections without group are preserved appropriately', () => {
  const project = fixture();
  const all = selectionFile(project, ['a', 'b', 'c']);
  assert.deepEqual(all.partialGroups, []);
  assert.equal(stage(all.text).project.extensions['card-atlas:mind-map'].rootId, 'a');
  assert.deepEqual(
    stage(all.text).project.extensions['card-atlas:groups'],
    project.extensions['card-atlas:groups'],
  );
  const single = selectionFile(project, ['a', 'a']);
  const parsed = stage(single.text).project;
  assert.deepEqual(
    parsed.cards.map((card) => card.id),
    ['a'],
  );
  assert.deepEqual(parsed.relations, []);
  assert.deepEqual(parsed.extensions['card-atlas:groups'].groups[0].cardIds, ['a']);
  assert.deepEqual(single.partialGroups, [{ id: 'g', title: 'Group', selected: 1, total: 3 }]);
});

test('invalid or missing selection fails instead of silently exporting another set', () => {
  const project = fixture();
  assert.throws(() => selectionFile(project, []), /selectionEmpty/);
  assert.throws(() => selectionFile(project, ['a', 'unknown']), /selectionMissing/);
  assert.throws(() => selectionFile(project, 'a'), /selectionInvalid/);
  assert.throws(() => selectionFile(project, null), /selectionInvalid/);
});
