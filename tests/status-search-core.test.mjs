import test from 'node:test';
import assert from 'node:assert/strict';
import { search, newCard } from '../assets/js/store/project-store.js';
import { effectiveStatus, setStatus } from '../assets/js/graph/card-status.js';

const labels = { done: 'Hoàn thành' };
const extra = (c) => labels[effectiveStatus(c)] ?? 'Mới';

test('search matches the status label through extraText', () => {
  const done = newCard({ x: 0, y: 0 }),
    plain = newCard({ x: 0, y: 0 });
  setStatus(done, 'done');
  assert.deepEqual(search([done, plain], 'hoàn thành', extra), [done]);
});

test('search without extraText ignores status', () => {
  const done = newCard({ x: 0, y: 0 });
  setStatus(done, 'done');
  assert.deepEqual(search([done], 'hoàn thành'), []);
});

test('a note without a status key matches the default New label', () => {
  const plain = newCard({ x: 0, y: 0 }),
    done = newCard({ x: 0, y: 0 });
  setStatus(done, 'done');
  assert.deepEqual(search([plain, done], 'mới', extra), [plain]);
});
