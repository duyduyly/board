import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectionFile } from '../assets/js/json/selection-export.js';
import { nodeFile, stageNode, excludedProjectNamespaces } from '../assets/js/json/node-transfer.js';
import { stage } from '../assets/js/json/validator.js';
import { copyCards, pasteCards } from '../assets/js/graph/copy-cards.js';
import { TIMELINE } from '../assets/js/graph/timeline.js';

const SCHEDULE = 'card-atlas:schedule';
const project = () =>
  stage(readFileSync(new URL('./fixtures/timeline-project.json', import.meta.url), 'utf8')).project;

test('selection export keeps the timeline configuration and card schedules', () => {
  const result = selectionFile(project(), ['task-01', 'task-02']);
  assert.deepEqual(result.excludedNamespaces, []);
  const staged = stage(result.text);
  assert.deepEqual(staged.errors, []);
  assert.deepEqual(staged.project.extensions[TIMELINE], project().extensions[TIMELINE]);
  assert.deepEqual(staged.project.cards[0].extensions[SCHEDULE], {
    start: '2026-03-02',
    end: '2026-03-08',
  });
});

test('node file does not require acknowledgement for timeline and keeps the card schedule', () => {
  const source = project();
  assert.deepEqual(excludedProjectNamespaces(source), []);
  const text = nodeFile(source, source.cards[0]);
  const staged = stageNode(text);
  assert.equal(staged.project.extensions?.[TIMELINE], undefined);
  assert.deepEqual(
    staged.project.cards[0].extensions[SCHEDULE],
    source.cards[0].extensions[SCHEDULE],
  );
});

test('copy and paste keep the card schedule', () => {
  const source = project();
  const target = project();
  const [id] = pasteCards(target, copyCards(source, ['task-01']), {
    offset: 20,
    newId: (kind) => `${kind}-new`,
    now: '2026-06-01',
  });
  const copy = target.cards.find((card) => card.id === id);
  assert.deepEqual(copy.extensions[SCHEDULE], source.cards[0].extensions[SCHEDULE]);
});
