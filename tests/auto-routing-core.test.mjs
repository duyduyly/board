import test from 'node:test';
import assert from 'node:assert/strict';
import { autoRoutes, enableAutoRoutes, segmentBlocked } from '../assets/js/graph/auto-routing.js';
import {
  EDGE,
  setEdgeMode,
  edgeMode,
  setEdgeCorners,
  initialCorners,
} from '../assets/js/graph/edge-routing.js';
import { stage, serialize, validate } from '../assets/js/json/validator.js';
import { ProjectStore } from '../assets/js/store/project-store.js';
import { fanoutProject, rectangles } from './auto-routing-fixture.mjs';
import { shapes, shapePoints } from '../assets/js/graph/shape-registry.js';

test('supplied seven-card fanout routes around cards, distributes ports and is deterministic', () => {
  const p = stage(JSON.stringify(fanoutProject())).project,
    original = JSON.stringify(p.cards);
  assert.equal(enableAutoRoutes(p, 'card').changed, 6);
  const paths = autoRoutes(p, rectangles(p), 'card');
  assert.equal(paths.size, 6);
  assert.equal(new Set([...paths.values()].map((v) => v.source.y)).size, 6);
  for (const [id, path] of paths) {
    assert.ok(!path.failed, id);
    const r = p.relations.find((r) => r.id === id),
      obstacles = p.cards
        .filter((c) => ![r.source, r.target].includes(c.id))
        .map((c) => ({
          x1: c.position.x,
          y1: c.position.y,
          x2: c.position.x + c.size.width,
          y2: c.position.y + c.size.height,
        }));
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1],
        b = path.points[i];
      assert.ok(a.x === b.x || a.y === b.y);
      assert.ok(!segmentBlocked(a, b, obstacles));
    }
  }
  assert.deepEqual([...paths], [...autoRoutes(p, rectangles(p), 'card')]);
  const segments = [...paths].flatMap(([id, p]) =>
    p.points.slice(1).map((b, i) => ({ id, a: p.points[i], b })),
  );
  for (let i = 0; i < segments.length; i++)
    for (let j = i + 1; j < segments.length; j++) {
      const p = segments[i],
        q = segments[j];
      if (p.id === q.id) continue;
      if (
        Math.abs(p.a.x - p.b.x) < 0.001 &&
        Math.abs(q.a.x - q.b.x) < 0.001 &&
        Math.abs(p.a.x - q.a.x) < 0.001
      )
        assert.ok(
          Math.min(Math.max(p.a.y, p.b.y), Math.max(q.a.y, q.b.y)) -
            Math.max(Math.min(p.a.y, p.b.y), Math.min(q.a.y, q.b.y)) <
            1,
          'shared vertical lane',
        );
      if (
        Math.abs(p.a.y - p.b.y) < 0.001 &&
        Math.abs(q.a.y - q.b.y) < 0.001 &&
        Math.abs(p.a.y - q.a.y) < 0.001
      )
        assert.ok(
          Math.min(Math.max(p.a.x, p.b.x), Math.max(q.a.x, q.b.x)) -
            Math.max(Math.min(p.a.x, p.b.x), Math.min(q.a.x, q.b.x)) <
            1,
          'shared horizontal lane',
        );
    }
  assert.equal(JSON.stringify(p.cards), original);
});
test('mode lifecycle keeps manual controls/inactive view, skips pins and is atomic with Undo/roundtrip', () => {
  const p = stage(JSON.stringify(fanoutProject())).project;
  p.cards[1].extensions = { 'card-atlas:metadata': { pinned: true } };
  setEdgeCorners(p.relations[1], 'card', initialCorners({ x: 0, y: 0 }, { x: 600, y: 0 }, -100));
  setEdgeMode(p.relations[2], 'card', 'manual');
  const s = new ProjectStore();
  s.replace(p);
  s.commit((p) => {
    const result = enableAutoRoutes(p, 'card');
    assert.equal(result.changed, 3);
    assert.equal(result.skipped, 3);
  });
  assert.equal(edgeMode(s.project.relations[0], 'card'), 'manual');
  assert.equal(edgeMode(s.project.relations[3], 'card'), 'auto');
  assert.equal(edgeMode(s.project.relations[3], 'mind'), 'manual');
  const before = serialize(s.project);
  assert.equal(stage(before).errors.length, 0);
  s.undo();
  assert.deepEqual(s.project, p);
  s.redo();
  assert.equal(serialize(s.project), before);
  const controls = structuredClone(s.project.relations[1].extensions[EDGE].corners);
  s.commit((p) => setEdgeMode(p.relations[1], 'card', 'auto'));
  s.commit((p) => setEdgeMode(p.relations[1], 'card', 'manual'));
  assert.deepEqual(s.project.relations[1].extensions[EDGE].corners, controls);
  assert.throws(
    () => s.commit((p) => setEdgeMode(p.relations[0], 'card', 'auto')),
    /pinnedCardLocked/,
  );
  for (const modes of [{ card: 'bad' }, { other: 'auto' }, [], null]) {
    const bad = structuredClone(s.project);
    bad.relations[3].extensions[EDGE].modes = modes;
    assert.ok(validate(bad).errors.length);
  }
});
test('bounded search finds multi-turn detours and overlapping endpoints produce explicit failure', () => {
  const p = stage(JSON.stringify(fanoutProject())).project;
  enableAutoRoutes(p, 'card');
  const rects = rectangles(p);
  rects.set('fan-1', { ...rects.get('fan-1'), x: rects.get('fan-0').x, y: rects.get('fan-0').y });
  assert.equal(autoRoutes(p, rects, 'card').get('wire-0').failed, true);
  const small = {
    cards: [{ id: 'a' }, { id: 'b' }],
    relations: [
      {
        id: 'r',
        source: 'a',
        target: 'b',
        extensions: { [EDGE]: { route: 'orthogonal', modes: { card: 'auto' } } },
      },
    ],
  };
  const boxes = [
    { id: 'a', x: 0, y: 0, width: 80, height: 80 },
    { id: 'b', x: 600, y: 400, width: 80, height: 80 },
    { id: 'wall1', x: 150, y: -100, width: 80, height: 450 },
    { id: 'wall2', x: 350, y: 200, width: 80, height: 450 },
  ];
  const route = autoRoutes(small, new Map(boxes.map((b) => [b.id, b])), 'card').get('r');
  assert.ok(!route.failed);
  for (let i = 1; i < route.points.length; i++)
    assert.ok(
      !segmentBlocked(
        route.points[i - 1],
        route.points[i],
        boxes.slice(2).map((b) => ({ x1: b.x, y1: b.y, x2: b.x + b.width, y2: b.y + b.height })),
      ),
    );
  // Two offset rooms and a middle wall require a corridor not among the simple L/Z rails.
  const maze = [
    { id: 'a', x: 0, y: 0, width: 80, height: 80 },
    { id: 'b', x: 800, y: 800, width: 80, height: 80 },
    { id: 'top-a', x: -300, y: -200, width: 600, height: 80 },
    { id: 'bottom-a', x: -300, y: 180, width: 600, height: 80 },
    { id: 'top-b', x: 600, y: 600, width: 600, height: 80 },
    { id: 'bottom-b', x: 600, y: 980, width: 600, height: 80 },
    { id: 'middle', x: 400, y: 200, width: 80, height: 500 },
  ];
  const detour = autoRoutes(small, new Map(maze.map((r) => [r.id, r])), 'card').get('r');
  assert.ok(!detour.failed);
  for (let i = 1; i < detour.points.length; i++)
    assert.ok(
      !segmentBlocked(
        detour.points[i - 1],
        detour.points[i],
        maze.slice(2).map((b) => ({ x1: b.x, y1: b.y, x2: b.x + b.width, y2: b.y + b.height })),
      ),
    );
});
test('automatic fanout attaches to registered shape outlines instead of floating box corners', () => {
  for (const shape of Object.keys(shapes)) {
    const p = stage(JSON.stringify(fanoutProject())).project;
    enableAutoRoutes(p, 'card');
    const rects = rectangles(p),
      source = rects.get('fan-0');
    source.points = shapePoints(shape, { width: source.width, height: source.height }, 24);
    const routes = autoRoutes(p, rects, 'card');
    for (const path of routes.values()) {
      assert.ok(!path.failed, shape);
      const point = { x: path.source.x - source.x, y: path.source.y - source.y };
      let closest = Infinity;
      for (let i = 0; i < source.points.length; i++) {
        const a = source.points[i],
          b = source.points[(i + 1) % source.points.length],
          dx = b.x - a.x,
          dy = b.y - a.y,
          t = Math.max(
            0,
            Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
          );
        closest = Math.min(closest, Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy));
      }
      assert.ok(closest < 0.01, shape + ' port off outline');
    }
  }
});
