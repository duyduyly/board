import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectionFile } from '../assets/js/json/selection-export.js';
import { nodeFile, mergeNode, addNodeProject, stageNode } from '../assets/js/json/node-transfer.js';
import { stage } from '../assets/js/json/validator.js';
import { ownerOf, OWNER } from '../assets/js/graph/card-scope.js';
import { TIMELINE } from '../assets/js/graph/timeline.js';

const fixture = () =>
  stage(readFileSync(new URL('./fixtures/timeline-boards-project.json', import.meta.url), 'utf8'))
    .project;
const cardOf = (project, id) => project.cards.find((card) => card.id === id);
const parse = (text) => stage(text).project;

test('selection without the owner node turns board cards into project cards', () => {
  const { text } = selectionFile(fixture(), ['a-child-1', 'a-child-2']);
  const project = parse(text);
  assert.equal(project.cards.length, 2);
  assert.ok(project.cards.every((card) => ownerOf(card) === null));
  assert.ok(project.cards.every((card) => !card.extensions?.[OWNER]));
});

test('selection keeps owners and the timeline when the owner node is selected too', () => {
  const { text } = selectionFile(fixture(), ['node-a', 'a-child-1']);
  const project = parse(text);
  assert.equal(ownerOf(cardOf(project, 'a-child-1')), 'node-a');
  assert.ok(project.extensions[TIMELINE]);
});

test('selection does not mutate the live project', () => {
  const project = fixture();
  selectionFile(project, ['a-child-1']);
  assert.equal(ownerOf(cardOf(project, 'a-child-1')), 'node-a');
});

test('nodeFile drops the owner of the exported card', () => {
  const project = fixture();
  const text = nodeFile(project, cardOf(project, 'a-child-1'), { excludeUnknown: true });
  assert.equal(ownerOf(stageNode(text).project.cards[0]), null);
  assert.equal(ownerOf(cardOf(project, 'a-child-1')), 'node-a');
});

test('addNodeProject drops the owner of the imported card', () => {
  const project = fixture();
  const source = parse(selectionFile(project, ['node-a', 'a-child-1']).text);
  const incoming = { ...source, cards: [cardOf(source, 'a-child-1')] };
  const next = addNodeProject(project, incoming, 'imported', 'note', { x: 1, y: 2 });
  assert.equal(ownerOf(cardOf(next, 'imported')), null);
});

test('mergeNode keeps the owner of the target card, not the file owner', () => {
  const project = fixture();
  const incoming = structuredClone(cardOf(project, 'b-child-1'));
  const keep = mergeNode(cardOf(project, 'a-child-1'), incoming, { takeUnknown: true });
  assert.equal(ownerOf(keep.card), 'node-a');
  const top = mergeNode(cardOf(project, 'node-a'), incoming, { takeUnknown: true });
  assert.equal(ownerOf(top.card), null);
});
