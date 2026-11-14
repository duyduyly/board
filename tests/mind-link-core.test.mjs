import test from 'node:test';
import assert from 'node:assert/strict';
import { newLinkKind } from '../assets/js/graph/mind-map.js';

const MIND = 'card-atlas:mind-map';
const branch = (source, target) => ({
  id: source + '-' + target,
  source,
  target,
  extensions: { [MIND]: { kind: 'branch' } },
});
const project = (relations) => ({
  cards: ['root', 'a', 'b', 'c', 'lonely'].map((id) => ({ id })),
  relations,
  extensions: { [MIND]: { rootId: 'root' } },
});

test('a link to a node without a parent extends the tree as a branch', () => {
  const p = project([branch('root', 'a')]);
  assert.equal(newLinkKind(p, 'a', 'b'), 'branch');
  assert.equal(newLinkKind(p, 'root', 'lonely'), 'branch');
  assert.equal(newLinkKind(p, 'lonely', 'c'), 'branch');
});

test('a link that would give a second parent, reach the root or close a cycle stays a reference', () => {
  const p = project([branch('root', 'a'), branch('a', 'b')]);
  assert.equal(newLinkKind(p, 'root', 'b'), 'reference');
  assert.equal(newLinkKind(p, 'b', 'root'), 'reference');
  const detached = project([branch('b', 'c')]);
  assert.equal(newLinkKind(detached, 'c', 'b'), 'reference');
});

test('plain links do not count as parents', () => {
  const p = project([{ id: 'ref', source: 'root', target: 'a' }]);
  assert.equal(newLinkKind(p, 'b', 'a'), 'branch');
});
