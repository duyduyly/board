import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OWNER,
  adoptNewCards,
  clearOwners,
  hasOwnedCards,
  ownedCounts,
  ownedIds,
  ownerOf,
  projectScope,
  scopeIssues,
  scopedProject,
  setOwner,
} from '../assets/js/graph/card-scope.js';

const GROUPS = 'card-atlas:groups';
const MIND = 'card-atlas:mind-map';
const card = (id, owner) => ({
  id,
  ...(owner ? { extensions: { [OWNER]: { nodeId: owner } } } : {}),
});
const rel = (id, source, target) => ({ id, source, target });
const codes = (project, options) => scopeIssues(project, options).map((i) => i.code);
const sample = () => ({
  cards: [card('n'), card('a', 'n'), card('b', 'n'), card('x')],
  relations: [rel('r1', 'a', 'b'), rel('r2', 'a', 'x'), rel('r3', 'n', 'x')],
  extensions: {
    [GROUPS]: {
      groups: [
        { id: 'g1', title: 'g1', cardIds: ['a'], links: [{ id: 'l1', source: 'b' }] },
        { id: 'g2', title: 'g2', cardIds: ['x'] },
        { id: 'g3', title: 'g3', parentId: 'g1', cardIds: ['b'] },
      ],
    },
    [MIND]: { rootId: 'a' },
  },
});

test('setOwner sets, clears and cleans empty extensions', () => {
  const c = { id: 'c' };
  assert.equal(setOwner(c, 'n'), true);
  assert.equal(ownerOf(c), 'n');
  assert.equal(setOwner(c, 'n'), false);
  assert.equal(setOwner(c, null), true);
  assert.equal(c.extensions, undefined);
  assert.equal(setOwner(c, null), false);
  const d = { id: 'd', extensions: { other: {}, [OWNER]: { nodeId: 'n' } } };
  setOwner(d, null);
  assert.deepEqual(d.extensions, { other: {} });
});

test('owned ids and counts, cached per snapshot', () => {
  const p = sample();
  assert.deepEqual(ownedIds(p, 'n'), ['a', 'b']);
  assert.deepEqual(ownedIds(p, null), ['n', 'x']);
  assert.equal(hasOwnedCards(p), true);
  assert.equal(hasOwnedCards({ cards: [card('z')] }), false);
  assert.equal(ownedCounts(p).get('n'), 2);
  assert.equal(ownedCounts(p), ownedCounts(p));
});

test('projectScope keeps only the scope cards, relations, groups and mind root', () => {
  const p = sample();
  const copy = structuredClone(p);
  const inner = projectScope(p, 'n');
  assert.deepEqual(
    inner.cards.map((c) => c.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    inner.relations.map((r) => r.id),
    ['r1'],
  );
  assert.deepEqual(
    inner.extensions[GROUPS].groups.map((g) => [g.id, g.cardIds]),
    [
      ['g1', ['a']],
      ['g3', ['b']],
    ],
  );
  // The project-level rootId belongs to the project board; a node board only uses boardRoots.
  assert.equal('rootId' in inner.extensions[MIND], false);
  p.extensions[MIND].boardRoots = { n: 'b' };
  assert.equal(projectScope(p, 'n').extensions[MIND].rootId, 'b');
  assert.equal('boardRoots' in projectScope(p, null).extensions[MIND], false);
  delete p.extensions[MIND].boardRoots;
  const outer = projectScope(p, null);
  assert.deepEqual(
    outer.extensions[GROUPS].groups.map((g) => g.id),
    ['g2'],
  );
  assert.equal('rootId' in outer.extensions[MIND], false);
  assert.deepEqual(p, copy);
});

test('scopedProject caches and returns the project when nothing is owned', () => {
  const p = sample();
  assert.equal(scopedProject(p, 'n'), scopedProject(p, 'n'));
  assert.equal(scopedProject(p, null), scopedProject(p, null));
  assert.notEqual(scopedProject(p, null), p);
  const plain = { cards: [card('z')], relations: [] };
  assert.equal(scopedProject(plain, null), plain);
});

test('adoptNewCards and clearOwners', () => {
  const p = { cards: [card('n'), card('old'), card('new1'), card('new2', 'q')], relations: [] };
  assert.equal(adoptNewCards(p, new Set(['n', 'old']), 'n'), 2);
  assert.equal(ownerOf(p.cards[1]), null);
  assert.deepEqual(ownedIds(p, 'n'), ['new1', 'new2']);
  assert.equal(adoptNewCards(p, new Set(['n', 'old', 'new1']), null), 1);
  assert.equal(ownerOf(p.cards[3]), null);
  assert.equal(clearOwners(p), 1);
  assert.equal(hasOwnedCards(p), false);
});

test('scopeIssues reports each code with its path', () => {
  const mixed = sample();
  mixed.extensions[GROUPS].groups[1].cardIds.push('b');
  assert.deepEqual(codes(mixed, { timeline: true }), [
    'relationScope',
    'groupScope',
    'mindRootScope',
  ]);
  const missing = { cards: [card('a', 'gone')], relations: [] };
  assert.deepEqual(scopeIssues(missing, { timeline: true }), [
    {
      path: `cards[0].extensions.${OWNER}.nodeId`,
      code: 'ownerMissing',
      params: { nodeId: 'gone' },
    },
  ]);
  const nested = {
    cards: [card('a', 'b'), card('b', 'c'), card('c'), card('s', 's')],
    relations: [],
  };
  assert.deepEqual(
    scopeIssues(nested, { timeline: true }).map((i) => [i.path, i.code]),
    [
      [`cards[0].extensions.${OWNER}.nodeId`, 'ownerNested'],
      [`cards[3].extensions.${OWNER}.nodeId`, 'ownerNested'],
    ],
  );
  const flat = { cards: [card('n'), card('a', 'n')], relations: [] };
  assert.deepEqual(codes(flat, { timeline: true }), []);
  assert.deepEqual(codes(flat, { timeline: false }), ['ownerWithoutTimeline']);
});

test('scopeIssues is clean for a consistent project', () => {
  const p = {
    cards: [card('n'), card('a', 'n'), card('b', 'n'), card('x')],
    relations: [rel('r1', 'a', 'b')],
    extensions: { [GROUPS]: { groups: [{ id: 'g', title: 'g', cardIds: ['a', 'b'] }] } },
  };
  assert.deepEqual(codes(p, { timeline: true }), []);
});
