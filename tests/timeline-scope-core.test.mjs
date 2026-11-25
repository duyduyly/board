import assert from 'node:assert/strict';
import test from 'node:test';
import { timelineEntries } from '../assets/js/graph/timeline.js';

const card = (id, extensions) => ({ id, title: id, ...(extensions && { extensions }) });
const owned = (nodeId) => ({ 'card-atlas:owner': { nodeId } });
const scheduled = (start) => ({ 'card-atlas:schedule': { start } });

test('cards on a node board stay out of the Timeline', () => {
  const project = {
    cards: [
      card('a', scheduled('2026-01-01')),
      card('b', { ...owned('a'), ...scheduled('2026-01-02') }),
      card('c'),
      card('d', owned('a')),
    ],
    relations: [],
  };
  const { entries, unscheduled } = timelineEntries(project);
  assert.deepEqual(
    entries.map((entry) => entry.id),
    ['a'],
  );
  assert.deepEqual(unscheduled, ['c']);
});

test('a node with children still appears', () => {
  const project = { cards: [card('n'), card('k', owned('n'))], relations: [] };
  assert.deepEqual(timelineEntries(project).unscheduled, ['n']);
});
