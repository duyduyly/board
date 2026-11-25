import test from 'node:test';
import assert from 'node:assert/strict';
import { applyUniformStyles, TYPOGRAPHY } from '../assets/js/graph/card-typography.js';
import { enableAutoRoutes } from '../assets/js/graph/auto-routing.js';
import { convertMind } from '../assets/js/graph/convert-mind.js';
import { ownerOf, setOwner } from '../assets/js/graph/card-scope.js';
import { edgeMode } from '../assets/js/graph/edge-routing.js';
import { geometry } from '../assets/js/graph/mind-map.js';
import { newCard, newRelation } from '../assets/js/store/project-store.js';
import { TIMELINE } from '../assets/js/graph/timeline.js';
import { blank } from '../assets/js/json/validator.js';

const card = (id, x) => ({ ...newCard({ x, y: 0 }, id), id });
const profile = { title: { fontSize: 20 } };

test('applyUniformStyles applies to every card by default and only included cards with a predicate', () => {
  const make = () => {
    const p = blank();
    p.cards = [card('a', 0), card('b', 300)];
    setOwner(p.cards[1], 'a');
    return p;
  };
  const all = make();
  applyUniformStyles(all, profile, 'board', () => ({ width: 10, height: 10 }));
  assert.ok(all.cards.every((c) => c.extensions[TYPOGRAPHY]));
  const scoped = make();
  applyUniformStyles(
    scoped,
    profile,
    'board',
    () => null,
    (c) => ownerOf(c) === null,
  );
  assert.ok(scoped.cards[0].extensions[TYPOGRAPHY]);
  assert.notDeepEqual(scoped.cards[1].extensions[TYPOGRAPHY], profile);
});

test('enableAutoRoutes only touches relations accepted by the predicate', () => {
  const make = () => {
    const p = blank();
    p.cards = ['a', 'b', 'c', 'd'].map((id, i) => card(id, i * 300));
    p.relations = [
      ['a', 'b'],
      ['c', 'd'],
    ].map(([s, t], i) => ({
      ...newRelation(s, t),
      id: 'r' + i,
      extensions: { 'card-atlas:edge': { route: 'orthogonal' } },
    }));
    return p;
  };
  const all = make();
  assert.equal(enableAutoRoutes(all, 'board').changed, 2);
  const some = make();
  const result = enableAutoRoutes(some, 'board', (r) => r.id === 'r1');
  assert.equal(result.changed, 1);
  assert.notEqual(edgeMode(some.relations[0], 'board'), 'auto');
  assert.equal(edgeMode(some.relations[1], 'board'), 'auto');
});

test('convertMind at the project root leaves owned cards untouched', () => {
  const p = blank();
  p.extensions = { ...p.extensions, [TIMELINE]: { version: 1 } };
  p.cards = [card('root', 0), card('kid', 300), card('own', 600)];
  setOwner(p.cards[2], 'kid');
  p.relations = [{ ...newRelation('root', 'kid'), id: 'r0' }];
  const before = {
    size: geometry(p, p.cards[2], 'mind').size,
    position: geometry(p, p.cards[2], 'mind').position,
  };
  const { project } = convertMind(p, 'root');
  const own = project.cards.find((c) => c.id === 'own');
  assert.deepEqual(geometry(project, own, 'mind').size, before.size);
  assert.deepEqual(geometry(project, own, 'mind').position, before.position);
  assert.equal(ownerOf(own), 'kid');
  assert.deepEqual(geometry(project, project.cards[0], 'mind').size, { width: 320, height: 120 });
});
