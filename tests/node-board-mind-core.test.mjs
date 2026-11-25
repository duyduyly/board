import assert from 'node:assert/strict';
import test from 'node:test';
import { OWNER, clearOwners, projectScope, scopeIssues } from '../assets/js/graph/card-scope.js';
import { MIND, mindIssues, mindRootOf, mindRoots, setRoot } from '../assets/js/graph/mind-map.js';

const card = (id, owner) => ({
  id,
  ...(owner ? { extensions: { [OWNER]: { nodeId: owner } } } : {}),
});
const branch = (id, source, target) => ({
  id,
  source,
  target,
  extensions: { [MIND]: { kind: 'branch' } },
});
const project = (extra = {}) => ({
  cards: [card('n'), card('a', 'n'), card('b', 'n'), card('x')],
  relations: [],
  extensions: { [MIND]: { rootId: 'x', boardRoots: { n: 'a' } } },
  ...extra,
});
const mindErrors = (p) => mindIssues(p).map((e) => e.path);

test('mindRootOf and mindRoots read project and board roots', () => {
  const p = project();
  assert.equal(mindRootOf(p), 'x');
  assert.equal(mindRootOf(p, 'n'), 'a');
  assert.equal(mindRootOf(p, 'b'), undefined);
  assert.deepEqual([...mindRoots(p)].sort(), ['a', 'x']);
});

test('board root keyed by __proto__ stays an own entry', () => {
  const p = { cards: [card('__proto__'), card('r', '__proto__')], relations: [] };
  setRoot(p, 'r', false, '__proto__');
  assert.equal(Object.hasOwn(p.extensions[MIND].boardRoots, '__proto__'), true);
  assert.equal(mindRootOf(p, '__proto__'), 'r');
  assert.equal(mindRootOf(p, 'toString'), undefined);
  assert.deepEqual(mindIssues(p), []);
  assert.equal(projectScope(p, '__proto__').extensions[MIND].rootId, 'r');
});

test('mindIssues rejects a board root that is missing or on a missing node', () => {
  const p = project();
  p.extensions[MIND].boardRoots = { n: 'nope', ghost: 'a' };
  assert.deepEqual(mindErrors(p), [
    'extensions.' + MIND + '.boardRoots.n',
    'extensions.' + MIND + '.boardRoots.ghost',
  ]);
});

test('mindIssues rejects a branch pointing into any root', () => {
  const p = project();
  p.relations = [branch('r1', 'b', 'a')];
  assert.deepEqual(mindErrors(p), ['relations[0].extensions.' + MIND + '.kind']);
  p.relations = [branch('r1', 'a', 'b')];
  assert.deepEqual(mindIssues(p), []);
});

test('scopeIssues flags a board root outside its board', () => {
  const p = project();
  assert.deepEqual(
    scopeIssues(p, { timeline: true }).map((i) => i.code),
    [],
  );
  p.extensions[MIND].boardRoots = { n: 'x' };
  const [issue] = scopeIssues(p, { timeline: true });
  assert.equal(issue.code, 'mindBoardRootScope');
  assert.deepEqual(issue.params, { nodeId: 'n' });
  assert.equal(issue.path, 'extensions.' + MIND + '.boardRoots.n');
});

test('projectScope drops board roots and does not mutate the input', () => {
  const p = project();
  const copy = structuredClone(p);
  assert.deepEqual(projectScope(p, 'n').extensions[MIND], { rootId: 'a' });
  assert.deepEqual(projectScope(p, null).extensions[MIND], { rootId: 'x' });
  p.extensions[MIND].boardRoots.n = 'x';
  assert.deepEqual(projectScope(p, 'n').extensions[MIND], {});
  p.extensions[MIND].boardRoots.n = 'a';
  assert.deepEqual(p, copy);
});

test('setRoot writes a board root, detaches its parent and clears empty boardRoots', () => {
  const p = project({ relations: [branch('r1', 'a', 'b')] });
  p.extensions = {};
  assert.throws(() => setRoot(p, 'b', false, 'n'), /rootParent/);
  setRoot(p, 'b', true, 'n');
  assert.equal(p.relations[0].extensions[MIND].kind, 'reference');
  assert.deepEqual(p.extensions[MIND], { boardRoots: { n: 'b' } });
  setRoot(p, 'a', false, 'n');
  assert.equal(mindRootOf(p, 'n'), 'a');
  setRoot(p, null, false, 'n');
  assert.deepEqual(p.extensions[MIND], {});
  setRoot(p, 'x');
  assert.equal(mindRootOf(p), 'x');
});

test('clearOwners removes board roots but keeps branches', () => {
  const p = project({ relations: [branch('r1', 'a', 'b')] });
  clearOwners(p);
  assert.deepEqual(p.extensions[MIND], { rootId: 'x' });
  assert.equal(p.relations.length, 1);
});
