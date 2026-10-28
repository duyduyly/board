import test from 'node:test';
import assert from 'node:assert/strict';
import { EDGE, edgePath, setEdgeOffset } from '../assets/js/graph/edge-routing.js';
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
