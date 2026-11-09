import test from 'node:test';
import assert from 'node:assert/strict';
import { branchCards } from '../assets/js/graph/branch-focus.js';

const project = (ids, edges) => ({
  cards: ids.map((id) => ({ id })),
  relations: edges.map(([source, target, kind], i) => ({ id: `r${i}`, source, target, kind })),
});
const sorted = (set) => [...set].sort();

test('branchCards follows outgoing relations only', () => {
  const p = project(
    ['a', 'b', 'c', 'd'],
    [
      ['a', 'b'],
      ['b', 'c'],
      ['b', 'd'],
    ],
  );
  assert.deepEqual(sorted(branchCards(p, 'a')), ['a', 'b', 'c', 'd']);
  assert.deepEqual(sorted(branchCards(p, 'b')), ['b', 'c', 'd']);
  assert.deepEqual(sorted(branchCards(p, 'c')), ['c']);
});

test('branchCards is safe on cycles, self loops and duplicate relations', () => {
  const p = project(
    ['a', 'b'],
    [
      ['a', 'b'],
      ['b', 'a'],
      ['a', 'b'],
      ['a', 'a'],
    ],
  );
  assert.deepEqual(sorted(branchCards(p, 'a')), ['a', 'b']);
  assert.deepEqual(sorted(branchCards(p, 'b')), ['a', 'b']);
});

test('branchCards returns an empty set for an unknown root and keeps isolated cards alone', () => {
  const p = project(['a', 'b', 'x'], [['a', 'b']]);
  assert.equal(branchCards(p, 'missing').size, 0);
  assert.deepEqual(sorted(branchCards(p, 'x')), ['x']);
});

test('branchCards honours the follow filter', () => {
  const p = project(
    ['a', 'b', 'c', 'd'],
    [
      ['a', 'b', 'branch'],
      ['a', 'c', 'reference'],
      ['b', 'd', 'branch'],
    ],
  );
  const branchOnly = (relation) => relation.kind === 'branch';
  assert.deepEqual(sorted(branchCards(p, 'a', branchOnly)), ['a', 'b', 'd']);
  assert.deepEqual(sorted(branchCards(p, 'a', () => false)), ['a']);
});

test('branchCards stays bounded at project limits', () => {
  const ids = Array.from({ length: 500 }, (_, i) => `n${i}`);
  const edges = [];
  for (let i = 1; i < 500; i += 1) edges.push([`n${Math.floor((i - 1) / 2)}`, `n${i}`]);
  while (edges.length < 2000)
    edges.push([`n${edges.length % 500}`, `n${(edges.length * 7) % 500}`]);
  const p = project(ids, edges);
  const started = performance.now();
  const result = branchCards(p, 'n0');
  assert.equal(result.size, 500);
  assert.ok(performance.now() - started < 500);
});
