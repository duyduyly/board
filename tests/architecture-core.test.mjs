import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeModules } from '../scripts/architecture.mjs';
import { projectIndex } from '../assets/js/graph/project-index.js';
import { ProjectStore, newCard, newRelation, remove } from '../assets/js/store/project-store.js';

test('graph query index follows committed snapshots through mutations, delete and undo', () => {
  const store = new ProjectStore();
  store.commit((p) => {
    p.cards.push(newCard({ x: 0, y: 0 }, 'a'), newCard({ x: 300, y: 0 }, 'b'));
    p.relations.push(newRelation(p.cards[0].id, p.cards[1].id));
  });
  const first = store.project,
    index = projectIndex(first),
    target = first.cards[1].id;
  assert.equal(projectIndex(first), index);
  assert.equal(index.degrees.get(target), 1);
  assert.equal(index.incoming.get(target)[0].source, first.cards[0].id);
  store.commit((p) => remove(p, { kind: 'card', id: target }));
  assert.equal(projectIndex(store.project).cards.has(target), false);
  assert.equal(projectIndex(store.project).relations.size, 0);
  assert.equal(index.cards.has(target), true);
  store.undo();
  assert.equal(projectIndex(store.project).degrees.get(target), 1);
  assert.equal(JSON.stringify(store.project).includes('incoming'), false);
});
test('architecture gate detects cycles, missing imports and common upward imports', () => {
  const safe = new Map([
    ['assets/js/app.js', "import { x } from './common/data.js';"],
    ['assets/js/common/data.js', 'export const x = 1;'],
  ]);
  assert.deepEqual(analyzeModules(safe).errors, []);
  safe.set('assets/js/common/data.js', "export { x } from '../app.js';");
  const errors = analyzeModules(safe).errors.join('\n');
  assert.match(errors, /Import cycle/);
  assert.match(errors, /upward common/);
  assert.match(errors, /application entry/);
  safe.set('assets/js/common/data.js', "import './missing.js';");
  assert.match(analyzeModules(safe).errors.join('\n'), /missing module/);
});
