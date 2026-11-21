import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addGroupLink,
  cleanupGroups,
  groupIssues,
  groupLinkIssue,
} from '../assets/js/graph/card-groups.js';
import { stage, validate } from '../assets/js/json/validator.js';
import { selectionFile } from '../assets/js/json/selection-export.js';

const GROUPS = 'card-atlas:groups';
const card = (id, x) => ({ id, title: id, content: '', position: { x, y: 0 } });
const project = (group) => ({
  version: '1.0',
  metadata: { title: 'Groups' },
  cards: [card('a', 0), card('b', 300), card('c', 600), card('d', 900)],
  relations: [],
  extensions: {
    [GROUPS]: {
      groups: [{ id: 'g1', title: 'Group', cardIds: ['a', 'b'], ...group }],
    },
  },
});

test('a group may carry a description and arrows from cards outside it', () => {
  const p = project({
    description: 'What this group is about',
    links: [
      { id: 'l1', source: 'c' },
      { id: 'l2', source: 'd' },
    ],
  });
  assert.deepEqual(validate(p).errors, []);
  assert.deepEqual(groupIssues(p), []);
});

test('arrows from missing cards, duplicate arrow ids and long descriptions are rejected', () => {
  assert.notDeepEqual(validate(project({ links: [{ id: 'l1', source: 'zz' }] })).errors, []);
  assert.notDeepEqual(
    validate(
      project({
        links: [
          { id: 'l1', source: 'c' },
          { id: 'l1', source: 'd' },
        ],
      }),
    ).errors,
    [],
  );
  assert.notDeepEqual(validate(project({ description: 'x'.repeat(501) })).errors, []);
  assert.notDeepEqual(
    validate(project({ links: [{ id: 'l1', source: 'c', label: 'x' }] })).errors,
    [],
  );
});

test('groupLinkIssue blocks members, duplicates and unknown ids; addGroupLink appends', () => {
  const p = project();
  assert.equal(groupLinkIssue(p, 'g1', 'a'), 'groupLinkMember');
  assert.equal(groupLinkIssue(p, 'g1', 'zz'), 'groupLinkMissing');
  assert.equal(groupLinkIssue(p, 'nope', 'c'), 'groupLinkMissing');
  assert.equal(groupLinkIssue(p, 'g1', 'c'), null);
  addGroupLink(p, 'g1', { id: 'l1', source: 'c' });
  assert.deepEqual(p.extensions[GROUPS].groups[0].links, [{ id: 'l1', source: 'c' }]);
  assert.equal(groupLinkIssue(p, 'g1', 'c'), 'groupLinkExists');
});

test('deleting the source card removes its arrow, and the last arrow removes the field', () => {
  const p = project({
    links: [
      { id: 'l1', source: 'c' },
      { id: 'l2', source: 'd' },
    ],
  });
  p.cards = p.cards.filter((item) => item.id !== 'c');
  cleanupGroups(p);
  assert.deepEqual(p.extensions[GROUPS].groups[0].links, [{ id: 'l2', source: 'd' }]);
  p.cards = p.cards.filter((item) => item.id !== 'd');
  cleanupGroups(p);
  assert.equal('links' in p.extensions[GROUPS].groups[0], false);
});

test('a selection export keeps only arrows whose card is selected and stays valid', () => {
  const p = project({
    description: 'Kept',
    links: [
      { id: 'l1', source: 'c' },
      { id: 'l2', source: 'd' },
    ],
  });
  const withC = JSON.parse(selectionFile(p, ['a', 'b', 'c']).text);
  assert.deepEqual(withC.extensions[GROUPS].groups[0].links, [{ id: 'l1', source: 'c' }]);
  assert.equal(withC.extensions[GROUPS].groups[0].description, 'Kept');
  const without = selectionFile(p, ['a', 'b']);
  assert.equal('links' in JSON.parse(without.text).extensions[GROUPS].groups[0], false);
  assert.deepEqual(stage(without.text).errors, []);
});
