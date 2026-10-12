import test from 'node:test';
import assert from 'node:assert/strict';
import { blank, validate, serialize, stage } from '../assets/js/json/validator.js';
import { ProjectStore, newCard, newRelation, remove } from '../assets/js/store/project-store.js';
import {
  NODE,
  VIEWS,
  MIND,
  geometry,
  setGeometry,
  setRoot,
  branchInfo,
} from '../assets/js/graph/mind-map.js';
const fixture = () => {
  const p = blank();
  p.cards = ['a', 'b', 'c', 'd'].map((id, i) => ({ ...newCard({ x: i * 320, y: 0 }, id), id }));
  return p;
};
test('legacy and per-view geometry isolation with atomic undo and cleanup', () => {
  const p = fixture(),
    s = new ProjectStore();
  s.replace(p);
  s.switchView('mind');
  assert.equal(s.dirty, false);
  assert.equal(s.undoStack.length, 0);
  s.commit((p) => setGeometry(p, 'b', 'mind', 'position', { x: 20, y: 80 }));
  assert.equal(s.project.cards[1].position.x, 320);
  assert.equal(geometry(s.project, s.project.cards[1], 'mind').position.x, 20);
  s.undo();
  assert.equal(s.dirty, false);
  s.redo();
  s.commit((p) => {
    setRoot(p, 'b');
    remove(p, { kind: 'card', id: 'b' });
  });
  assert.equal(s.project.extensions[MIND].rootId, undefined);
  assert.equal(s.project.extensions[VIEWS].mindMap.positions.b, undefined);
  s.undo();
  assert.equal(s.project.cards.length, 4);
  assert.equal(stage(serialize(s.project, s.viewport, s.viewports)).errors.length, 0);
});
test('branch forest rejects cycles/two parents/root parent while references permit cycles', () => {
  const p = fixture();
  p.relations = [newRelation('a', 'b'), newRelation('b', 'c'), newRelation('c', 'a')];
  assert.equal(validate(p).errors.length, 0);
  for (const r of p.relations) r.extensions = { [MIND]: { kind: 'branch' } };
  assert.ok(validate(p).errors.some((e) => e.path === 'relations.branchCycle'));
  p.relations.pop();
  setRoot(p, 'a');
  assert.equal(validate(p).errors.length, 0);
  assert.throws(() => setRoot(p, 'b'));
  setRoot(p, 'b', true);
  assert.equal(validate(p).errors.length, 0);
  p.relations.push({ ...newRelation('d', 'c'), extensions: { [MIND]: { kind: 'branch' } } });
  assert.ok(validate(p).errors.length);
});
test('cover validation, namespaces and safe geometry refs', () => {
  const p = fixture();
  p.cards[0].extensions = { [NODE]: { kind: 'image', coverImageId: 'missing' } };
  assert.ok(validate(p).errors.some((e) => e.path.endsWith('coverImageId')));
  p.cards[0].extensions = { [NODE]: { kind: 'text', imageFit: 'evil' } };
  assert.ok(validate(p).errors.length);
  delete p.cards[0].extensions;
  p.extensions = { [VIEWS]: { mindMap: { positions: { missing: { x: 0, y: 0 } } } } };
  assert.ok(validate(p).errors.length);
  p.extensions = { [VIEWS]: { mindMap: { viewport: { zoom: 8, position: { x: 0, y: 0 } } } } };
  assert.ok(validate(p).errors.length);
});
test('stable branch colors and serializer overlays are session only', () => {
  const p = fixture();
  setRoot(p, 'a');
  p.relations = [{ ...newRelation('a', 'b'), extensions: { [MIND]: { kind: 'branch' } } }];
  const color = branchInfo(p).get('b').color;
  p.cards.pop();
  assert.equal(branchInfo(p).get('b').color, color);
  const s = new ProjectStore();
  s.replace(p);
  s.switchView('mind');
  s.setView(2, { x: 10, y: 20 });
  assert.equal(s.dirty, false);
  const out = JSON.parse(serialize(s.project, s.viewport, s.viewports));
  assert.equal(out.canvas.zoom, 1);
  assert.equal(out.extensions[VIEWS].mindMap.viewport.zoom, 2);
  assert.equal(s.project.extensions[VIEWS], undefined);
});

test('mixed example validates; cover deletion fails atomically and Root deletion undoes', async () => {
  const fs = await import('node:fs/promises');
  const p = stage(await fs.readFile('assets/data/mind-map-example.json', 'utf8')).project;
  assert.ok(p);
  const s = new ProjectStore();
  s.replace(p);
  const baseline = structuredClone(p);
  assert.throws(() =>
    s.commit((p) => {
      delete p.cards.find((c) => c.id === 'illustration').extensions['card-atlas:images'].cover;
    }),
  );
  assert.deepEqual(s.project, baseline);
  assert.equal(s.undoStack.length, 0);
  s.commit((p) => remove(p, { kind: 'card', id: p.extensions[MIND].rootId }));
  assert.equal(s.project.extensions[MIND].rootId, undefined);
  s.undo();
  assert.deepEqual(s.project, baseline);
});
