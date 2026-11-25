import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { blank, serialize, stage } from '../assets/js/json/validator.js';
import { ProjectStore, newCard } from '../assets/js/store/project-store.js';
import { togglePinned } from '../assets/js/graph/card-metadata.js';
import {
  SCHEDULE,
  TIMELINE,
  cardSchedule,
  enableTimeline,
  hasTimeline,
  setSchedule,
} from '../assets/js/graph/timeline.js';

function projectWith({ schedule, timeline } = {}) {
  const p = blank();
  p.cards = [newCard({ x: 0, y: 0 }), newCard({ x: 400, y: 0 })];
  if (schedule !== undefined) p.cards[0].extensions[SCHEDULE] = schedule;
  if (timeline !== undefined) p.extensions = { [TIMELINE]: timeline };
  return p;
}
const errorsOf = (options) => stage(serialize(projectWith(options))).errors;
const storeWith = () => {
  const store = new ProjectStore();
  store.replace(projectWith());
  return store;
};

test('schedule and timeline round-trip through stage and serialize', () => {
  const first = serialize(
    projectWith({ schedule: { start: '2026-03-01', end: '2026-03-09' }, timeline: { version: 1 } }),
  );
  const staged = stage(first);
  assert.deepEqual(staged.errors, []);
  assert.deepEqual(cardSchedule(staged.project.cards[0]), {
    start: '2026-03-01',
    end: '2026-03-09',
  });
  assert.equal(hasTimeline(staged.project), true);
  assert.equal(serialize(staged.project), first);
});

test('a schedule with only start is valid', () => {
  assert.deepEqual(errorsOf({ schedule: { start: '2026-03-01' } }), []);
});

test('contract rejects malformed schedule', () => {
  for (const schedule of [
    { start: '2026-3-1' },
    { start: '2026-03-01T00:00:00Z' },
    { start: '2026-02-30' },
    { start: '2026-13-01' },
    { start: '0000-01-01' },
    { start: '2026-03-01', end: '2026-02-28' },
    { start: '2026-03-01', end: 'soon' },
    { start: '2026-03-01', extra: true },
    { end: '2026-03-01' },
    {},
  ])
    assert.notDeepEqual(errorsOf({ schedule }), [], JSON.stringify(schedule));
});

test('contract rejects malformed timeline config', () => {
  assert.deepEqual(errorsOf({ timeline: { version: 1 } }), []);
  for (const timeline of [{ version: 2 }, {}, { version: 1, extra: true }, '1'])
    assert.notDeepEqual(errorsOf({ timeline }), [], JSON.stringify(timeline));
});

test('enabling the timeline is one undo step', () => {
  const store = storeWith();
  const before = serialize(store.project);
  store.commit((p) => enableTimeline(p));
  assert.equal(store.undoStack.length, 1);
  assert.equal(hasTimeline(store.project), true);
  store.undo();
  assert.equal(serialize(store.project), before);
  store.redo();
  assert.equal(hasTimeline(store.project), true);
});

test('setting a schedule is one undo step', () => {
  const store = storeWith();
  const before = serialize(store.project);
  store.commit((p) => setSchedule(p.cards[0], { start: '2026-03-01', end: '2026-03-05' }));
  assert.equal(store.undoStack.length, 1);
  assert.deepEqual(cardSchedule(store.project.cards[0]), {
    start: '2026-03-01',
    end: '2026-03-05',
  });
  store.undo();
  assert.equal(serialize(store.project), before);
  store.redo();
  assert.equal(cardSchedule(store.project.cards[0]).end, '2026-03-05');
});

test('pinned cards reject schedule commits', () => {
  const store = storeWith();
  store.commit((p) => togglePinned(p.cards[0]));
  const before = serialize(store.project),
    depth = store.undoStack.length;
  assert.throws(
    () => store.commit((p) => setSchedule(p.cards[0], { start: '2026-03-01' })),
    /pinnedCardLocked/,
  );
  assert.equal(serialize(store.project), before);
  assert.equal(store.undoStack.length, depth);
});

test('timeline fixture stages without errors or adjustments', async () => {
  const text = await fs.readFile('tests/fixtures/timeline-project.json', 'utf8');
  const staged = stage(text);
  assert.deepEqual(staged.errors, []);
  assert.deepEqual(staged.adjustments, []);
  assert.equal(staged.project.cards.length, 32);
  assert.equal(hasTimeline(staged.project), true);
});
