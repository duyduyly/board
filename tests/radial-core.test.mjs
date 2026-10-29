import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { stage, serialize } from '../assets/js/json/validator.js';
import { ProjectStore, newCard, newRelation } from '../assets/js/store/project-store.js';
import { MIND, setGeometry } from '../assets/js/graph/mind-map.js';
import {
  radialLayout,
  applyLayout,
  overlapCount,
  visibility,
  revealAncestors,
} from '../assets/js/graph/radial-layout.js';
async function sample() {
  return stage(await fs.readFile('assets/data/mind-map-example.json', 'utf8')).project;
}
test('radial deterministic bbox layout preserves input and ignores references', async () => {
  const p = await sample(),
    before = structuredClone(p),
    a = radialLayout(p);
  assert.equal(a.overlaps, 0);
  assert.deepEqual(p, before);
  const reordered = structuredClone(p);
  reordered.cards.reverse();
  reordered.relations.reverse();
  assert.deepEqual(radialLayout(reordered).positions, a.positions);
  p.relations = p.relations.filter((r) => r.extensions?.[MIND]?.kind === 'branch');
  assert.deepEqual(radialLayout(p).positions, a.positions);
  assert.equal(a.detached, 1);
});
test('wide star and deep forest with mixed sizes do not overlap', () => {
  for (const shape of ['star', 'chain', 'balanced']) {
    const p = {
      version: '1.0',
      metadata: { title: 'test' },
      cards: Array.from({ length: 500 }, (_, i) => ({
        ...newCard({ x: 0, y: 0 }, 'Node ' + i),
        id: 'n' + String(i).padStart(3, '0'),
      })),
      relations: [],
      extensions: { [MIND]: { rootId: 'n000' } },
    };
    for (let i = 1; i < 500; i++) {
      const parent = shape === 'star' ? 0 : shape === 'chain' ? i - 1 : Math.floor((i - 1) / 4);
      p.relations.push({
        ...newRelation(p.cards[parent].id, p.cards[i].id),
        extensions: { [MIND]: { kind: 'branch' } },
      });
      if (i % 7 === 0)
        setGeometry(p, p.cards[i].id, 'mind', 'size', {
          width: 100 + (i % 5) * 100,
          height: 120 + (i % 3) * 120,
        });
    }
    const result = radialLayout(p);
    assert.equal(Object.keys(result.positions).length, 500);
    assert.equal(overlapCount(p, result.positions), 0);
    assert.ok(
      Object.values(result.positions).every((v) => Number.isFinite(v.x) && Number.isFinite(v.y)),
    );
  }
});
test('layout Apply is one transaction and restores all geometry with undo', async () => {
  const p = await sample(),
    s = new ProjectStore();
  // The bundled template is already arranged; move a branch before testing Apply.
  p.extensions['card-atlas:views'].mindMap.positions['english-s-use'].x += 80;
  s.replace(p);
  const before = structuredClone(s.project);
  const a = radialLayout(p);
  s.commit((p) => applyLayout(p, a));
  assert.equal(s.undoStack.length, 1);
  assert.deepEqual(s.project.cards, before.cards);
  assert.deepEqual(s.project.relations, before.relations);
  s.undo();
  assert.deepEqual(s.project, before);
  s.redo();
  assert.equal(stage(serialize(s.project)).errors.length, 0);
});
test('collapse descendants excludes references; reveal clears only ancestors', async () => {
  const p = await sample(),
    collapsed = new Set(['english-s-use', 'english-ed-use']);
  const v = visibility(p, collapsed);
  assert.ok(v.hidden.has('english-s-sounds'));
  assert.ok(!v.hidden.has('english-mistakes'));
  assert.ok(!v.hidden.has('english-ed-use'));
  assert.equal(v.counts.get('english-s-use'), 2);
  assert.equal(revealAncestors(p, 'english-s-sounds', collapsed), true);
  assert.deepEqual([...collapsed], ['english-ed-use']);
  assert.equal(radialLayout(p).overlaps, 0);
  assert.throws(() => radialLayout({ ...p, extensions: {} }), /layoutNeedsRoot/);
});

test('large spread warning and viewport baselines remain session state', async () => {
  const p = await sample();
  setGeometry(p, 'english-s-use', 'mind', 'size', { width: 25000, height: 100 });
  assert.ok(radialLayout(p).warnings.some((w) => w.code === 'layoutSpread'));
  const s = new ProjectStore();
  s.replace(p);
  assert.equal(s.viewChanged, false);
  s.switchView('mind');
  s.setView(0.8, { x: 20, y: 30 });
  assert.equal(s.dirty, false);
  assert.equal(s.viewChanged, true);
  s.exported();
  assert.equal(s.viewChanged, false);
  s.collapsed.add('english-s-use');
  assert.equal(s.dirty, false);
  s.replace(p);
  assert.equal(s.collapsed.size, 0);
});
