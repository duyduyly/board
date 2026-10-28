import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EDGE,
  edgePath,
  setEdgeOffset,
  initialCorners,
  orthogonalCorners,
  setEdgeCorners,
} from '../assets/js/graph/edge-routing.js';
import { blank, validate, stage, serialize } from '../assets/js/json/validator.js';
import { ProjectStore, newCard, newRelation } from '../assets/js/store/project-store.js';

test('manual edge adjustment is view-specific, atomic, bounded and protected by pin invariant', () => {
  const p = blank();
  p.cards = [newCard({ x: 0, y: 0 }), newCard({ x: 600, y: 0 })];
  p.relations = [newRelation(p.cards[0].id, p.cards[1].id)];
  const s = new ProjectStore();
  s.replace(p);
  s.commit((p) => {
    setEdgeOffset(p.relations[0], 'card', -250);
    setEdgeOffset(p.relations[0], 'mind', 100);
  });
  assert.deepEqual(s.project.relations[0].extensions[EDGE].adjustments, { card: -250, mind: 100 });
  const serialized = serialize(s.project);
  assert.equal(stage(serialized).errors.length, 0);
  s.commit((p) => setEdgeOffset(p.relations[0], 'card', null));
  assert.deepEqual(s.project.relations[0].extensions[EDGE].adjustments, { mind: 100 });
  s.undo();
  assert.equal(serialize(s.project), serialized);
  s.redo();
  for (const adjustments of [{ card: Infinity }, { mind: 2001 }, { other: 1 }, [], null]) {
    const bad = structuredClone(s.project);
    bad.relations[0].extensions[EDGE].adjustments = adjustments;
    assert.ok(validate(bad).errors.length);
  }
  s.commit((p) => {
    p.cards[0].extensions ||= {};
    p.cards[0].extensions['card-atlas:metadata'] = { pinned: true };
  });
  const before = serialize(s.project);
  assert.throws(
    () => s.commit((p) => setEdgeOffset(p.relations[0], 'mind', 200)),
    /pinnedCardLocked/,
  );
  assert.equal(serialize(s.project), before);
});
test('orthogonal manual rails keep90degree bends and can detour aligned endpoints; curved projection round-trips', () => {
  for (const [a, b] of [
    [
      { x: 0, y: 0 },
      { x: 600, y: 0 },
    ],
    [
      { x: 0, y: 0 },
      { x: 0, y: 600 },
    ],
    [
      { x: 600, y: 300 },
      { x: 0, y: 0 },
    ],
  ]) {
    const path = edgePath('orthogonal', a, b, -250),
      dx = b.x - a.x,
      dy = b.y - a.y,
      L = Math.hypot(dx, dy);
    const points = path.style['segment-weights'].map((w, i) => ({
      x: a.x + w * dx - (path.style['segment-distances'][i] * dy) / L,
      y: a.y + w * dy + (path.style['segment-distances'][i] * dx) / L,
    }));
    const all = [a, ...points, b];
    for (let i = 1; i < all.length; i++)
      assert.ok(
        Math.abs(all[i].x - all[i - 1].x) < 0.001 || Math.abs(all[i].y - all[i - 1].y) < 0.001,
      );
    assert.equal(Math.round(path.offset(path.handle)), -250);
    const curve = edgePath('curved', a, b, 300);
    assert.equal(Math.round(curve.offset(curve.handle)), 300);
  }
});
test('independent corners retain orthogonal legs, view-specific reset and pin protection', () => {
  const a = { x: 140, y: 280 },
    b = { x: 840, y: 280 },
    c = initialCorners(a, b, -100);
  c.source.x -= 80;
  c.source.y -= 30;
  c.target.y -= 60;
  const path = orthogonalCorners(a, b, c),
    dx = b.x - a.x,
    dy = b.y - a.y,
    L = Math.hypot(dx, dy);
  const pts = path.style['segment-weights'].map((w, i) => ({
    x: a.x + w * dx - (path.style['segment-distances'][i] * dy) / L,
    y: a.y + w * dy + (path.style['segment-distances'][i] * dx) / L,
  }));
  const all = [a, ...pts, b];
  for (let i = 1; i < all.length; i++)
    assert.ok(
      Math.abs(all[i].x - all[i - 1].x) < 0.001 || Math.abs(all[i].y - all[i - 1].y) < 0.001,
    );
  assert.equal(path.source.y, 150);
  assert.equal(path.target.y, 120);
  const p = blank();
  p.cards = [newCard(a), newCard(b)];
  p.relations = [newRelation(p.cards[0].id, p.cards[1].id)];
  p.relations[0].extensions = { [EDGE]: { route: 'orthogonal' } };
  const s = new ProjectStore();
  s.replace(p);
  s.commit((p) => {
    setEdgeCorners(p.relations[0], 'card', c);
    setEdgeOffset(p.relations[0], 'mind', 123);
  });
  const before = serialize(s.project);
  assert.equal(stage(before).errors.length, 0);
  s.commit((p) => setEdgeOffset(p.relations[0], 'card', null));
  assert.equal(s.project.relations[0].extensions[EDGE].corners, undefined);
  assert.equal(s.project.relations[0].extensions[EDGE].adjustments.mind, 123);
  s.undo();
  assert.equal(serialize(s.project), before);
  for (const bad of [
    { ...c, axis: 'diagonal' },
    { ...c, source: { x: 0 } },
    { ...c, target: { x: Infinity, y: 0 } },
    { ...c, target: { x: 10001, y: 0 } },
    { ...c, extra: 1 },
  ]) {
    const q = structuredClone(s.project);
    q.relations[0].extensions[EDGE].corners.card = bad;
    assert.ok(validate(q).errors.length);
  }
  s.commit((p) => {
    p.cards[0].extensions ||= {};
    p.cards[0].extensions['card-atlas:metadata'] = { pinned: true };
  });
  assert.throws(
    () => s.commit((p) => setEdgeCorners(p.relations[0], 'card', initialCorners(a, b, 80))),
    /pinnedCardLocked/,
  );
});
