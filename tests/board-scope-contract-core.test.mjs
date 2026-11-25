import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { serialize, stage } from '../assets/js/json/validator.js';
import { OWNER, ownerOf } from '../assets/js/graph/card-scope.js';
import { TIMELINE } from '../assets/js/graph/timeline.js';
import { GROUPS } from '../assets/js/graph/card-groups.js';
import { MIND } from '../assets/js/graph/mind-map.js';

const FIXTURE = 'tests/fixtures/timeline-boards-project.json';
const load = async () => JSON.parse(await fs.readFile(FIXTURE, 'utf8'));
const card = (p, id) => p.cards.find((c) => c.id === id);
const codesOf = (p) => stage(JSON.stringify(p)).errors.map((e) => e.code);
const relation = (id, source, target) => ({
  id,
  source,
  target,
  label: '',
  description: '',
  type: 'default',
  style: { color: '#64748b', line: 'solid', arrow: 'end' },
});

test('fixture stages cleanly and owners round-trip through serialize', async () => {
  const first = stage(await fs.readFile(FIXTURE, 'utf8'));
  assert.deepEqual(first.errors, []);
  assert.equal(ownerOf(card(first.project, 'a-child-1')), 'node-a');
  assert.equal(ownerOf(card(first.project, 'node-c')), null);
  const second = stage(serialize(first.project));
  assert.deepEqual(second.errors, []);
  assert.equal(ownerOf(card(second.project, 'b-child-2')), 'node-b');
  assert.deepEqual(second.project.cards, first.project.cards);
});

test('a project without owners is unchanged', async () => {
  const p = await load();
  p.cards = p.cards.filter((c) => ownerOf(c) === null);
  p.relations = p.relations.filter((r) => r.id === 'rel-root');
  delete p.extensions[GROUPS];
  const staged = stage(JSON.stringify(p));
  assert.deepEqual(staged.errors, []);
  assert.equal(
    staged.project.cards.some((c) => c.extensions?.[OWNER]),
    false,
  );
});

test('owner pointing to a missing card is rejected', async () => {
  const p = await load();
  card(p, 'a-child-1').extensions[OWNER].nodeId = 'ghost';
  assert.ok(codesOf(p).includes('ownerMissing'));
});

test('nested and self owners are rejected', async () => {
  const nested = await load();
  card(nested, 'node-d').extensions[OWNER] = { nodeId: 'a-child-1' };
  assert.ok(codesOf(nested).includes('ownerNested'));
  const self = await load();
  card(self, 'a-child-1').extensions[OWNER].nodeId = 'a-child-1';
  assert.ok(codesOf(self).includes('ownerNested'));
});

test('owner without a timeline is rejected', async () => {
  const p = await load();
  delete p.extensions[TIMELINE];
  assert.ok(codesOf(p).includes('ownerWithoutTimeline'));
});

test('a relation across boards is rejected', async () => {
  const p = await load();
  p.relations.push(relation('rel-cross', 'a-child-1', 'node-d'));
  assert.ok(codesOf(p).includes('relationScope'));
  const other = await load();
  other.relations.push(relation('rel-cross-2', 'a-child-1', 'b-child-1'));
  assert.ok(codesOf(other).includes('relationScope'));
});

test('a group across boards is rejected', async () => {
  const p = await load();
  p.extensions[GROUPS].groups[0].cardIds.push('node-d');
  assert.ok(codesOf(p).includes('groupScope'));
});

test('a mind map root inside a board is rejected', async () => {
  const p = await load();
  p.extensions[MIND] = { rootId: 'a-child-1' };
  assert.ok(codesOf(p).includes('mindRootScope'));
});
