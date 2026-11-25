import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectionFile } from '../assets/js/json/selection-export.js';
import { nodeFile, stageNode } from '../assets/js/json/node-transfer.js';
import { serialize, stage } from '../assets/js/json/validator.js';
import { MIND } from '../assets/js/graph/mind-map.js';

const text = readFileSync(
  new URL('./fixtures/node-board-mind-project.json', import.meta.url),
  'utf8',
);
const raw = () => JSON.parse(text);
const load = () => stage(text).project;
const errorsOf = (p) => stage(JSON.stringify(p)).errors;
const cardOf = (p, id) => p.cards.find((c) => c.id === id);
const roots = (p) => p.extensions?.[MIND]?.boardRoots;

test('fixture stages cleanly with project and board roots', () => {
  const result = stage(text);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.adjustments, []);
  assert.equal(result.project.extensions[MIND].rootId, 'node-d');
  assert.deepEqual(roots(result.project), { 'node-a': 'a-child-1' });
});

test('import, serialize and import again keeps boardRoots', () => {
  const again = stage(serialize(load())).project;
  assert.deepEqual(roots(again), { 'node-a': 'a-child-1' });
  assert.equal(again.extensions[MIND].rootId, 'node-d');
});

test('boardRoots root from another board is rejected', () => {
  const p = raw();
  p.extensions[MIND].boardRoots = { 'node-a': 'b-child-1' };
  assert.ok(errorsOf(p).some((e) => e.code === 'mindBoardRootScope'));
});

test('boardRoots key that is owned by a node is rejected', () => {
  const p = raw();
  p.extensions[MIND].boardRoots = { 'a-child-2': 'a-child-1' };
  assert.ok(errorsOf(p).some((e) => e.code === 'mindBoardRootScope'));
});

test('a branch into a board root is rejected', () => {
  const p = raw();
  p.relations.push({
    id: 'into-root',
    source: 'a-child-2',
    target: 'a-child-1',
    extensions: { [MIND]: { kind: 'branch' } },
  });
  assert.ok(errorsOf(p).some((e) => e.path.startsWith('relations') && e.code === 'mindMap'));
});

test('selection keeps boardRoots only when node and root are both selected', () => {
  const kept = stage(selectionFile(load(), ['node-a', 'a-child-1', 'a-child-2']).text).project;
  assert.deepEqual(roots(kept), { 'node-a': 'a-child-1' });
  assert.equal(kept.extensions[MIND].rootId, undefined);

  const noNode = stage(selectionFile(load(), ['a-child-1', 'a-child-2']).text).project;
  assert.equal(roots(noNode), undefined);
  const noRoot = stage(selectionFile(load(), ['node-a', 'a-child-2']).text).project;
  assert.equal(roots(noRoot), undefined);
});

test('selection keeps the project rootId as before', () => {
  const p = stage(selectionFile(load(), ['node-d', 'node-e']).text).project;
  assert.equal(p.extensions[MIND].rootId, 'node-d');
  assert.equal(roots(p), undefined);
});

test('nodeFile of a board root is valid and carries no root', () => {
  const project = load();
  const out = stageNode(nodeFile(project, cardOf(project, 'a-child-1'), { excludeUnknown: true }));
  assert.deepEqual(out.errors || [], []);
  assert.equal(out.project.extensions?.[MIND]?.rootId, undefined);
  assert.equal(roots(out.project), undefined);
});
