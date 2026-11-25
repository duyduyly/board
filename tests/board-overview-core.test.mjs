import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OVERVIEW_GAP, overviewLayout } from '../assets/js/graph/board-overview.js';
import { OWNER } from '../assets/js/graph/card-scope.js';
import { TIMELINE, SCHEDULE } from '../assets/js/graph/timeline.js';
import { GROUPS } from '../assets/js/graph/card-groups.js';

const fixture = () =>
  JSON.parse(readFileSync(new URL('./fixtures/timeline-boards-project.json', import.meta.url)));

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

const size = { width: 260, height: 190 };
const card = (id, x, y, extensions) => ({
  id,
  title: id,
  position: { x, y },
  size,
  ...(extensions ? { extensions } : {}),
});
const owned = (id, nodeId, x, y) => card(id, x, y, { [OWNER]: { nodeId } });
const dated = (id, start) => card(id, 0, 0, { [SCHEDULE]: { start } });
const project = (cards, extensions = { [TIMELINE]: { version: 1 } }) => ({
  cards,
  relations: [],
  extensions,
});

const rect = (c) => ({ x: c.position.x, y: c.position.y, w: c.size.width, h: c.size.height });
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const frameRect = (f) => ({ x: f.x, y: f.y, w: f.width, h: f.height });
const assertDisjoint = (rects) => {
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) assert.ok(!overlaps(rects[i], rects[j]));
};

test('no Timeline or no child cards gives no frames and the same positions', () => {
  const noTimeline = project([card('a', 5, 6), owned('k', 'a', 1, 1)], {});
  const out = overviewLayout(noTimeline);
  assert.deepEqual(out.frames, []);
  assert.equal(out.project, noTimeline);
  const noKids = project([card('a', 5, 6), card('b', 9, 9)]);
  assert.deepEqual(overviewLayout(noKids).frames, []);
  assert.equal(overviewLayout(noKids).project, noKids);
});

test('shared notes keep reference and position', () => {
  const p = fixture();
  const out = overviewLayout(p);
  for (const id of ['node-d', 'node-e']) {
    assert.equal(
      out.project.cards.find((c) => c.id === id),
      p.cards.find((c) => c.id === id),
    );
  }
});

test('frames follow Timeline order then unscheduled', () => {
  assert.deepEqual(
    overviewLayout(fixture()).frames.map((f) => [f.nodeId, f.count]),
    [
      ['node-a', 2],
      ['node-b', 2],
    ],
  );
  const cards = [
    card('u', 0, 0),
    dated('late', '2026-05-01'),
    dated('early', '2026-01-01'),
    owned('k1', 'u', 0, 0),
    owned('k2', 'late', 0, 0),
    owned('k3', 'early', 0, 0),
  ];
  assert.deepEqual(
    overviewLayout(project(cards)).frames.map((f) => f.nodeId),
    ['early', 'late', 'u'],
  );
});

test('frames are disjoint and clear of the shared notes', () => {
  const out = overviewLayout(fixture());
  const rects = out.frames.map(frameRect);
  assertDisjoint(rects);
  const shared = out.project.cards.filter((c) => ['node-d', 'node-e'].includes(c.id)).map(rect);
  for (const f of rects) for (const s of shared) assert.ok(!overlaps(f, s));
});

test('frame encloses node and children with the node at the top', () => {
  const out = overviewLayout(fixture());
  for (const f of out.frames) {
    const node = out.project.cards.find((c) => c.id === f.nodeId);
    const kids = out.project.cards.filter((c) => c.extensions?.[OWNER]?.nodeId === f.nodeId);
    assert.equal(node.position.y, f.y + OVERVIEW_GAP.header + OVERVIEW_GAP.pad);
    for (const c of [node, ...kids]) {
      const r = rect(c);
      assert.ok(r.x >= f.x && r.x + r.w <= f.x + f.width);
      assert.ok(r.y >= f.y && r.y + r.h <= f.y + f.height);
    }
    for (const k of kids) assert.ok(k.position.y >= node.position.y + node.size.height);
  }
});

test('children keep relative offsets and sizes', () => {
  const p = fixture();
  const out = overviewLayout(p);
  const pick = (proj, id) => proj.cards.find((c) => c.id === id);
  const offset = (proj) => ({
    x: pick(proj, 'a-child-2').position.x - pick(proj, 'a-child-1').position.x,
    y: pick(proj, 'a-child-2').position.y - pick(proj, 'a-child-1').position.y,
  });
  assert.deepEqual(offset(out.project), offset(p));
  for (const c of p.cards) assert.deepEqual(pick(out.project, c.id).size, c.size);
});

test('frozen input is not mutated and no card keys are added', () => {
  const p = deepFreeze(fixture());
  const out = overviewLayout(p);
  for (const c of out.project.cards) {
    const original = p.cards.find((x) => x.id === c.id);
    assert.deepEqual(Object.keys(c).sort(), Object.keys(original).sort());
  }
});

test('same snapshot returns the same layout object', () => {
  const p = fixture();
  assert.equal(overviewLayout(p), overviewLayout(p));
});

test('50 nodes with 9 children each lay out without overlap', () => {
  const cards = [];
  for (let n = 0; n < 50; n++) {
    cards.push(dated(`n${n}`, `2026-01-${String((n % 28) + 1).padStart(2, '0')}`));
    for (let k = 0; k < 9; k++)
      cards.push(owned(`n${n}-k${k}`, `n${n}`, (k % 3) * 300, Math.floor(k / 3) * 250));
  }
  const out = overviewLayout(project(cards));
  assert.equal(out.frames.length, 50);
  assert.equal(out.project.cards.length, 500);
  assertDisjoint(out.frames.map(frameRect));
});

test('groups inside one board stay, groups holding a moved node are dropped', () => {
  const p = fixture();
  p.extensions[GROUPS].groups.push({ id: 'root-group', title: 'R', cardIds: ['node-a', 'node-d'] });
  const out = overviewLayout(p);
  assert.deepEqual(
    out.project.extensions[GROUPS].groups.map((g) => g.id),
    ['group-b'],
  );
  assert.equal(p.extensions[GROUPS].groups.length, 2);
});

test('relations are kept', () => {
  const p = fixture();
  assert.equal(overviewLayout(p).project.relations, p.relations);
});
