import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanupGroups,
  createGroup,
  frameBounds,
  groupCardIds,
  groupDepth,
  groupIssues,
  groupLinkIssue,
  newGroupParent,
  parentOptions,
  removeGroup,
  updateGroup,
} from '../assets/js/graph/card-groups.js';
import { stage, validate } from '../assets/js/json/validator.js';
import { selectionFile } from '../assets/js/json/selection-export.js';

const GROUPS = 'card-atlas:groups';
const card = (id, x) => ({ id, title: id, content: '', position: { x, y: 0 } });
const project = (groups) => ({
  version: '1.0',
  metadata: { title: 'Nested' },
  cards: ['a', 'b', 'c', 'd', 'e', 'f'].map((id, index) => card(id, index * 300)),
  relations: [],
  extensions: { [GROUPS]: { groups } },
});
const groups = (p) => p.extensions[GROUPS].groups;
const find = (p, id) => groups(p).find((g) => g.id === id);

// outer ⊃ inner ⊃ deep; outer also holds note a directly.
const nested = () =>
  project([
    { id: 'outer', title: 'Outer', cardIds: ['a'] },
    { id: 'inner', title: 'Inner', cardIds: ['b', 'c'], parentId: 'outer' },
    { id: 'deep', title: 'Deep', cardIds: ['d'], parentId: 'inner' },
  ]);

test('nested groups validate, report depth and collect cards of every level', () => {
  const p = nested();
  assert.deepEqual(validate(p).errors, []);
  assert.deepEqual(
    ['outer', 'inner', 'deep'].map((id) => groupDepth(p, id)),
    [1, 2, 3],
  );
  assert.deepEqual(groupCardIds(p, 'outer'), ['a', 'b', 'c', 'd']);
  assert.deepEqual(groupCardIds(p, 'inner'), ['b', 'c', 'd']);
});

test('a parent may hold only subgroups, but not nothing', () => {
  const parentOnly = project([
    { id: 'outer', title: 'Outer', cardIds: [] },
    { id: 'inner', title: 'Inner', cardIds: ['a'], parentId: 'outer' },
  ]);
  assert.deepEqual(validate(parentOnly).errors, []);
  assert.notDeepEqual(groupIssues(project([{ id: 'empty', title: 'E', cardIds: [] }])), []);
});

test('unknown parents, self parents, cycles and a fourth level are rejected', () => {
  const bad = [
    [{ id: 'g', title: 'G', cardIds: ['a'], parentId: 'missing' }],
    [{ id: 'g', title: 'G', cardIds: ['a'], parentId: 'g' }],
    [
      { id: 'x', title: 'X', cardIds: ['a'], parentId: 'y' },
      { id: 'y', title: 'Y', cardIds: ['b'], parentId: 'x' },
    ],
    [
      { id: 'l1', title: '1', cardIds: ['a'] },
      { id: 'l2', title: '2', cardIds: ['b'], parentId: 'l1' },
      { id: 'l3', title: '3', cardIds: ['c'], parentId: 'l2' },
      { id: 'l4', title: '4', cardIds: ['d'], parentId: 'l3' },
    ],
  ];
  for (const list of bad) assert.notDeepEqual(groupIssues(project(list)), [], JSON.stringify(list));
});

test('notes that all sit directly in one group become its subgroup; mixed or too deep is refused', () => {
  const p = nested();
  assert.deepEqual(newGroupParent(p, ['e', 'f']), { parentId: null });
  assert.deepEqual(newGroupParent(p, ['b', 'c']), { parentId: 'inner' });
  assert.deepEqual(newGroupParent(p, ['a', 'b']), { issue: 'groupAlreadyAssigned' });
  assert.deepEqual(newGroupParent(p, ['a', 'e']), { issue: 'groupAlreadyAssigned' });
  assert.deepEqual(newGroupParent(p, ['d']), { issue: 'groupTooDeep' });
  createGroup(p, { id: 'sub', title: 'Sub', cardIds: ['b', 'c'] });
  assert.equal(find(p, 'sub').parentId, 'inner');
  assert.deepEqual(find(p, 'inner').cardIds, []);
  assert.deepEqual(validate(p).errors, []);
  assert.throws(() => createGroup(p, { id: 'x', title: 'X', cardIds: ['d'] }), /groupTooDeep/);
});

test('ungrouping moves notes and subgroups up one level and deletes nothing', () => {
  const p = nested();
  removeGroup(p, 'inner');
  assert.deepEqual(find(p, 'outer').cardIds, ['a', 'b', 'c']);
  assert.equal(find(p, 'deep').parentId, 'outer');
  removeGroup(p, 'outer');
  assert.equal('parentId' in find(p, 'deep'), false);
  assert.deepEqual(validate(p).errors, []);
});

test('notes taken out of a subgroup return to its parent; parentId moves within the limit', () => {
  const p = nested();
  updateGroup(p, 'inner', { title: 'Inner', description: '', cardIds: ['b'], linkIds: [] });
  assert.deepEqual(find(p, 'inner').cardIds, ['b']);
  assert.deepEqual(find(p, 'outer').cardIds, ['a', 'c']);
  assert.deepEqual(
    parentOptions(p, 'deep').map((g) => g.id),
    ['outer', 'inner'],
  );
  assert.deepEqual(parentOptions(p, 'outer'), []);
  updateGroup(p, 'deep', {
    title: 'Deep',
    description: '',
    cardIds: ['d'],
    linkIds: [],
    parentId: null,
  });
  assert.equal('parentId' in find(p, 'deep'), false);
  assert.deepEqual(validate(p).errors, []);
});

test('deleting the last note of a subgroup removes it and then its emptied parents', () => {
  const p = project([
    { id: 'outer', title: 'Outer', cardIds: [] },
    { id: 'inner', title: 'Inner', cardIds: ['a'], parentId: 'outer' },
  ]);
  p.cards = p.cards.filter((c) => c.id !== 'a');
  cleanupGroups(p);
  assert.deepEqual(groups(p), []);
});

test('a parent frame encloses its subgroup frames; members of subgroups cannot point at the parent', () => {
  const rects = new Map([['a', { position: { x: 0, y: 0 }, size: { width: 100, height: 100 } }]]);
  const inner = { x: 400, y: 200, width: 300, height: 200 };
  const outer = frameBounds(rects, ['a'], [inner]);
  assert.ok(outer.x <= 0 && outer.y < inner.y - 50);
  assert.ok(outer.x + outer.width >= inner.x + inner.width);
  assert.ok(outer.y + outer.height >= inner.y + inner.height);
  assert.equal(groupLinkIssue(nested(), 'outer', 'd'), 'groupLinkMember');
  assert.equal(groupLinkIssue(nested(), 'deep', 'a'), null);
});

test('a selection export keeps the parents of exported subgroups and stays valid', () => {
  const p = nested();
  const file = selectionFile(p, ['d', 'e']);
  const exported = JSON.parse(file.text).extensions[GROUPS].groups;
  assert.deepEqual(
    exported.map((g) => [g.id, g.cardIds, g.parentId ?? null]),
    [
      ['deep', ['d'], 'inner'],
      ['inner', [], 'outer'],
      ['outer', [], null],
    ],
  );
  assert.deepEqual(stage(file.text).errors, []);
});
