import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addCardsToGroup,
  groupIssues,
  groupOfCard,
  groupOutline,
  removeCardsFromGroup,
  removeFromGroupIssue,
} from '../assets/js/graph/card-groups.js';

const GROUPS = 'card-atlas:groups';
const card = (id, x) => ({ id, title: id, content: '', position: { x, y: 0 } });
const project = (groups) => ({
  version: '1.0',
  metadata: { title: 'Membership' },
  cards: ['a', 'b', 'c', 'd', 'e', 'f'].map((id, index) => card(id, index * 300)),
  relations: [],
  extensions: { [GROUPS]: { groups } },
});
const find = (p, id) => p.extensions[GROUPS].groups.find((g) => g.id === id);

// outer ⊃ inner ⊃ deep; free notes: e, f.
const nested = () =>
  project([
    { id: 'outer', title: 'Outer', cardIds: ['a', 'b'] },
    { id: 'inner', title: 'Inner', cardIds: ['c'], parentId: 'outer' },
    { id: 'deep', title: 'Deep', cardIds: ['d'], parentId: 'inner' },
  ]);

test('groupOfCard finds the direct group or null', () => {
  const p = nested();
  assert.equal(groupOfCard(p, 'c').id, 'inner');
  assert.equal(groupOfCard(p, 'e'), null);
});

test('groupOutline walks the tree depth-first with 1-based depth and total counts', () => {
  const outline = groupOutline(nested());
  assert.deepEqual(
    outline.map((o) => [o.id, o.depth, o.count]),
    [
      ['outer', 1, 4],
      ['inner', 2, 2],
      ['deep', 3, 1],
    ],
  );
  assert.equal(outline[1].title, 'Inner');
});

test('addCardsToGroup appends to a root, child and deep group and stays valid', () => {
  for (const [target, expected] of [
    ['outer', ['a', 'b', 'e', 'f']],
    ['inner', ['c', 'e', 'f']],
    ['deep', ['d', 'e', 'f']],
  ]) {
    const p = nested();
    assert.equal(addCardsToGroup(p, target, ['e', 'f']), 0);
    assert.deepEqual(find(p, target).cardIds, expected);
    assert.deepEqual(groupIssues(p), []);
  }
});

test('addCardsToGroup rejects missing groups and notes that already have a group', () => {
  const p = nested();
  assert.throws(() => addCardsToGroup(p, 'nope', ['e']), { message: 'groupLinkMissing' });
  assert.throws(() => addCardsToGroup(p, 'inner', ['e', 'a']), { message: 'groupAlreadyAssigned' });
});

test('addCardsToGroup drops arrows from the added notes into their own group chain', () => {
  const p = nested();
  find(p, 'outer').links = [
    { id: 'l1', source: 'e' },
    { id: 'l2', source: 'f' },
  ];
  find(p, 'inner').links = [{ id: 'l3', source: 'e' }];
  find(p, 'deep').links = [{ id: 'l4', source: 'e' }];
  // e joins inner: arrows from e into inner and its parent outer would point at its own group.
  assert.equal(addCardsToGroup(p, 'inner', ['e']), 2);
  assert.deepEqual(find(p, 'outer').links, [{ id: 'l2', source: 'f' }]);
  assert.equal(find(p, 'inner').links, undefined);
  // deep is a subgroup of inner, not an ancestor: its arrow stays.
  assert.deepEqual(find(p, 'deep').links, [{ id: 'l4', source: 'e' }]);
});

test('removing a note from a subgroup returns it to the parent group', () => {
  const p = nested();
  find(p, 'inner').cardIds = ['c', 'e'];
  removeCardsFromGroup(p, ['e']);
  assert.deepEqual(find(p, 'inner').cardIds, ['c']);
  assert.deepEqual(find(p, 'outer').cardIds, ['a', 'b', 'e']);
  assert.deepEqual(groupIssues(p), []);
});

test('removing a note from a top-level group leaves every group', () => {
  const p = nested();
  removeCardsFromGroup(p, ['a']);
  assert.deepEqual(find(p, 'outer').cardIds, ['b']);
  assert.equal(groupOfCard(p, 'a'), null);
  assert.deepEqual(groupIssues(p), []);
});

test('mixed selections move each note one level and ignore ungrouped ids', () => {
  const p = nested();
  find(p, 'inner').cardIds = ['c', 'e'];
  removeCardsFromGroup(p, ['a', 'e', 'f']);
  assert.deepEqual(find(p, 'outer').cardIds, ['b', 'e']);
  assert.deepEqual(find(p, 'inner').cardIds, ['c']);
  assert.deepEqual(groupIssues(p), []);
});

test('a parent member and a child member can leave together', () => {
  const p = nested();
  find(p, 'inner').cardIds = ['c', 'e'];
  removeCardsFromGroup(p, ['a', 'e']);
  assert.deepEqual(find(p, 'outer').cardIds, ['b', 'e']);
});

test('removing the last note of a group is an issue and leaves the project unchanged', () => {
  const p = project([
    { id: 'solo', title: 'Solo', cardIds: ['a'] },
    { id: 'kid', title: 'Kid', cardIds: ['b'], parentId: 'solo' },
  ]);
  // solo keeps a subgroup, so its own note may leave; the subgroup's only note may not.
  assert.equal(removeFromGroupIssue(p, ['a']), null);
  assert.equal(removeFromGroupIssue(p, ['b']), 'groupNeedsMemberNested');
  const flat = project([{ id: 'g', title: 'G', cardIds: ['a'] }]);
  const before = structuredClone(flat);
  assert.equal(removeFromGroupIssue(flat, ['a']), 'groupNeedsMember');
  assert.throws(() => removeCardsFromGroup(flat, ['a']), { message: 'groupNeedsMember' });
  assert.deepEqual(flat, before);
  assert.equal(removeFromGroupIssue(flat, ['e']), null);
});

test('emptying a subgroup reports the nested message', () => {
  const p = project([
    { id: 'outer', title: 'Outer', cardIds: ['a'] },
    { id: 'kid', title: 'Kid', cardIds: ['b'], parentId: 'outer' },
  ]);
  // b goes back to outer, leaving kid with nothing and no subgroup.
  assert.equal(removeFromGroupIssue(p, ['b']), 'groupNeedsMemberNested');
});

test('removal keeps arrows of the group', () => {
  const p = nested();
  find(p, 'outer').links = [{ id: 'l1', source: 'e' }];
  removeCardsFromGroup(p, ['a']);
  assert.deepEqual(find(p, 'outer').links, [{ id: 'l1', source: 'e' }]);
});
