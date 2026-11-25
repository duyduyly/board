import test from 'node:test';
import assert from 'node:assert/strict';
import { convertMind } from '../assets/js/graph/convert-mind.js';
import { setOwner } from '../assets/js/graph/card-scope.js';
import { MIND, relationKind, mindRootOf, geometry } from '../assets/js/graph/mind-map.js';
import { TIMELINE } from '../assets/js/graph/timeline.js';
import { newCard, newRelation } from '../assets/js/store/project-store.js';
import { blank } from '../assets/js/json/validator.js';

const card = (id, x) => ({ ...newCard({ x, y: 0 }, id), id });
const relation = (id, source, target) => ({ ...newRelation(source, target), id });

function make() {
  const p = blank();
  p.extensions = { ...p.extensions, [TIMELINE]: { version: 1 } };
  p.cards = ['top', 'node', 'o1', 'o2', 'o3'].map((id, i) => card(id, i * 300));
  for (const id of ['o1', 'o2', 'o3'])
    setOwner(
      p.cards.find((c) => c.id === id),
      'node',
    );
  p.relations = [
    relation('rp', 'top', 'node'),
    relation('ra', 'o1', 'o2'),
    relation('rb', 'o2', 'o3'),
  ];
  p.relations[0].extensions = { [MIND]: { kind: 'branch' } };
  p.extensions[MIND] = { rootId: 'top' };
  return p;
}
const kinds = (p, ids) => ids.map((id) => relationKind(p.relations.find((r) => r.id === id)));

test('converting a node board only changes that board', () => {
  const p = make(),
    original = structuredClone(p);
  const { project } = convertMind(p, 'o1', 'node');
  assert.deepEqual(p, original);
  assert.deepEqual(kinds(project, ['ra', 'rb']), ['branch', 'branch']);
  assert.equal(mindRootOf(project, 'node'), 'o1');
  assert.equal(project.extensions[MIND].rootId, 'top');
  assert.equal(relationKind(project.relations[0]), 'branch');
  assert.deepEqual(project.cards, p.cards);
  const mind = project.extensions['card-atlas:views'].mindMap;
  assert.deepEqual(Object.keys(mind.positions).sort(), ['o1', 'o2', 'o3']);
  assert.deepEqual(mind.sizes.o1, { width: 320, height: 120 });
  assert.equal(mind.sizes.top, undefined);
  assert.deepEqual(geometry(project, project.cards[2], 'card'), geometry(p, p.cards[2], 'card'));
});

test('converting the project board keeps node board branches', () => {
  const p = make();
  p.relations[1].extensions = { [MIND]: { kind: 'branch' } };
  p.extensions[MIND] = { boardRoots: { node: 'o1' } };
  const { project } = convertMind(p, 'top');
  assert.equal(relationKind(project.relations.find((r) => r.id === 'ra')), 'branch');
  assert.equal(mindRootOf(project, 'node'), 'o1');
  assert.equal(project.extensions[MIND].rootId, 'top');
  assert.equal(project.extensions['card-atlas:views']?.mindMap?.positions?.o2, undefined);
});

test('root must belong to the board and be unpinned', () => {
  const p = make();
  assert.throws(() => convertMind(p, 'o1'), /mindConvertFailed/);
  assert.throws(() => convertMind(p, 'top', 'node'), /mindConvertFailed/);
  p.cards.find((c) => c.id === 'o1').extensions['card-atlas:metadata'].pinned = true;
  assert.throws(() => convertMind(p, 'o1', 'node'), /mindConvertFailed/);
});

test('a pinned previous board root blocks a different root; pinned cards keep geometry', () => {
  const p = make();
  p.extensions[MIND] = { rootId: 'top', boardRoots: { node: 'o1' } };
  p.cards.find((c) => c.id === 'o1').extensions['card-atlas:metadata'].pinned = true;
  assert.throws(() => convertMind(p, 'o2', 'node'), /mindConvertFailed/);
  const pinnedMind = geometry(p, p.cards[2], 'mind');
  const { project } = convertMind(p, 'top');
  assert.deepEqual(geometry(project, project.cards[2], 'mind'), pinnedMind);
});
