import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEDULE,
  TIMELINE,
  isCalendarDate,
  scheduleIssues,
  hasTimeline,
  enableTimeline,
  disableTimeline,
  cardSchedule,
  setSchedule,
  timelineEntries,
  filterEntries,
  todayKey,
  todayIndex,
} from '../assets/js/graph/timeline.js';

const card = (id, extensions) => ({ id, ...(extensions ? { extensions } : {}) });
const sched = (start, end) => ({ [SCHEDULE]: end ? { start, end } : { start } });
const created = (createdDate) => ({ 'card-atlas:metadata': { createdDate } });

test('order is schedule/card-date by date, unscheduled apart', () => {
  const project = {
    cards: [
      card('none'),
      card('b', created('2026-03-02')),
      card('a', sched('2026-03-01', '2026-03-09')),
    ],
  };
  const { entries, unscheduled } = timelineEntries(project);
  assert.deepEqual(
    entries.map((e) => [e.id, e.source]),
    [
      ['a', 'schedule'],
      ['b', 'card-date'],
    ],
  );
  assert.deepEqual(unscheduled, ['none']);
});

test('schedule wins over card date', () => {
  const project = { cards: [card('a', { ...created('2026-01-01'), ...sched('2026-05-05') })] };
  assert.deepEqual(timelineEntries(project).entries[0], {
    id: 'a',
    start: '2026-05-05',
    end: null,
    source: 'schedule',
  });
});

test('same day sorts by end, then card order; point before range', () => {
  const project = {
    cards: [
      card('range', sched('2026-04-01', '2026-04-05')),
      card('short', sched('2026-04-01', '2026-04-02')),
      card('pointB', created('2026-04-01')),
      card('pointA', sched('2026-04-01')),
    ],
  };
  assert.deepEqual(
    timelineEntries(project).entries.map((e) => e.id),
    ['pointB', 'pointA', 'short', 'range'],
  );
});

test('isCalendarDate rejects impossible dates', () => {
  assert.equal(isCalendarDate('2026-02-28'), true);
  assert.equal(isCalendarDate('2024-02-29'), true);
  for (const bad of ['2026-02-30', '0000-01-01', '2026-13-01', '2026-1-1', '', null, 5])
    assert.equal(isCalendarDate(bad), false, String(bad));
});

test('setSchedule validates and reports changes', () => {
  const c = card('a');
  assert.throws(() => setSchedule(c, { start: '2026-02-30' }), /scheduleInvalid/);
  assert.throws(() => setSchedule(c, { start: '0000-01-01' }), /scheduleInvalid/);
  assert.throws(
    () => setSchedule(c, { start: '2026-03-05', end: '2026-03-04' }),
    /scheduleInvalid/,
  );
  assert.equal(c.extensions, undefined);
  assert.equal(setSchedule(c, { start: '2026-03-05', end: '2026-03-07' }), true);
  assert.deepEqual(cardSchedule(c), { start: '2026-03-05', end: '2026-03-07' });
  assert.equal(setSchedule(c, { start: '2026-03-05', end: '2026-03-07' }), false);
  assert.equal(setSchedule(c, { start: '2026-03-05' }), true);
  assert.deepEqual(cardSchedule(c), { start: '2026-03-05' });
  assert.equal(setSchedule(c, { start: '2026-03-05', end: null }), false);
});

test('setSchedule null removes the key and empty extensions', () => {
  const c = card('a', sched('2026-03-05'));
  assert.equal(setSchedule(c, null), true);
  assert.equal('extensions' in c, false);
  assert.equal(setSchedule(c, null), false);
  const keep = card('b', { ...sched('2026-03-05'), other: {} });
  setSchedule(keep, null);
  assert.deepEqual(keep.extensions, { other: {} });
});

test('scheduleIssues reports format and order', () => {
  assert.deepEqual(scheduleIssues(card('a'), '$.cards[0]'), []);
  assert.equal(scheduleIssues(card('a', sched('2026-02-30')), 'p')[0].code, 'format');
  const order = scheduleIssues(card('a', sched('2026-03-05', '2026-03-01')), 'p');
  assert.equal(order[0].code, 'scheduleOrder');
  assert.ok(order[0].path.endsWith('.end'));
});

test('enable/disableTimeline toggle and clean extensions', () => {
  const project = { cards: [] };
  assert.equal(hasTimeline(project), false);
  assert.equal(disableTimeline(project), false);
  assert.equal(enableTimeline(project), true);
  assert.equal(enableTimeline(project), false);
  assert.deepEqual(project.extensions[TIMELINE], { version: 1 });
  assert.equal(disableTimeline(project), true);
  assert.equal('extensions' in project, false);
  project.extensions = { 'card-atlas:groups': {}, [TIMELINE]: { version: 1 } };
  disableTimeline(project);
  assert.deepEqual(project.extensions, { 'card-atlas:groups': {} });
});

test('timelineEntries is cached per snapshot and never mutates it', () => {
  const project = { cards: [card('a', sched('2026-03-05')), card('b')] };
  const before = JSON.stringify(project);
  const first = timelineEntries(project);
  assert.equal(timelineEntries(project), first);
  assert.equal(JSON.stringify(project), before);
  assert.notEqual(timelineEntries({ cards: project.cards }), first);
});

test('todayKey uses local date parts', () => {
  assert.equal(todayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.match(todayKey(), /^\d{4}-\d{2}-\d{2}$/);
});

test('todayIndex finds first entry on or after today', () => {
  const entries = [{ start: '2026-01-01' }, { start: '2026-01-10' }, { start: '2026-02-01' }];
  assert.equal(todayIndex(entries, '2025-12-31'), 0);
  assert.equal(todayIndex(entries, '2026-01-10'), 1);
  assert.equal(todayIndex(entries, '2026-01-11'), 2);
  assert.equal(todayIndex(entries, '2027-01-01'), 3);
  assert.equal(todayIndex([], '2026-01-01'), 0);
});

test('filterEntries uses effective status', () => {
  const done = { 'card-atlas:status': { value: 'done' } };
  const project = {
    cards: [card('a', { ...sched('2026-03-01'), ...done }), card('b', sched('2026-03-02'))],
  };
  const { entries } = timelineEntries(project);
  const ids = (list) => list.map((e) => e.id);
  assert.equal(filterEntries(project, entries, null), entries);
  assert.deepEqual(ids(filterEntries(project, entries, 'done')), ['a']);
  assert.deepEqual(ids(filterEntries(project, entries, 'new')), ['b']);
  assert.deepEqual(filterEntries(project, entries, 'blocked'), []);
});

test('500 cards build quickly', () => {
  const pad = (n) => String(n).padStart(2, '0');
  const cards = Array.from({ length: 500 }, (_, i) =>
    card(`c${i}`, sched(`2026-${pad((i % 12) + 1)}-${pad((i % 28) + 1)}`)),
  );
  const started = performance.now();
  const { entries } = timelineEntries({ cards });
  assert.equal(entries.length, 500);
  assert.ok(performance.now() - started < 200);
});
