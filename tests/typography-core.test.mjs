import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPOGRAPHY, setOverview } from '../assets/js/graph/card-typography.js';
import { blank, validate, serialize, stage } from '../assets/js/json/validator.js';
import { newCard, ProjectStore } from '../assets/js/store/project-store.js';
import { mergeNode } from '../assets/js/json/node-transfer.js';
test('overview formatting is bounded, safe, atomic and portable', () => {
  const p = blank(),
    c = newCard({ x: 0, y: 0 });
  p.cards.push(c);
  const store = new ProjectStore();
  store.replace(p);
  const values = { title: 'Tiêu đề mới', summary: 'Summary', type: 'NOTE' },
    styles = {
      title: { fontSize: 24, color: '#123456', fontFamily: 'serif' },
      summary: { fontSize: 13 },
      type: {},
    };
  store.commit((d) => setOverview(d.cards[0], values, styles));
  assert.deepEqual(stage(serialize(store.project)).errors, []);
  assert.equal(store.project.cards[0].title, values.title);
  store.undo();
  assert.deepEqual(store.project, p);
  store.redo();
  for (const style of [
    { fontSize: 7 },
    { fontSize: 73 },
    { color: 'red' },
    { color: 'url(x)' },
    { fontFamily: 'remote' },
    { fontWeight: 900 },
  ]) {
    c.extensions[TYPOGRAPHY] = { title: style };
    assert.ok(validate(p).errors.length);
  }
  c.extensions[TYPOGRAPHY] = { title: styles.title };
  const incoming = newCard({ x: 0, y: 0 });
  assert.deepEqual(mergeNode(c, incoming).card.extensions[TYPOGRAPHY], c.extensions[TYPOGRAPHY]);
  assert.deepEqual(
    mergeNode(c, incoming, { takeFormat: true }).card.extensions?.[TYPOGRAPHY],
    incoming.extensions[TYPOGRAPHY],
  );
  setOverview(c, values, { title: {}, summary: {}, type: {} });
  assert.equal(c.extensions?.[TYPOGRAPHY], undefined);
});

test('overview tags preserve literal commas until explicitly edited', () => {
  const p = blank(),
    c = newCard({ x: 0, y: 0 });
  p.cards.push(c);
  c.tags = ['a,b', 'x'];
  setOverview(
    c,
    { title: c.title, summary: c.summary, type: c.type, tags: [...c.tags] },
    { title: {}, summary: {}, type: {} },
  );
  assert.deepEqual(c.tags, ['a,b', 'x']);
  setOverview(
    c,
    { title: c.title, summary: c.summary, type: c.type, tags: 'new, tags' },
    { title: {}, summary: {}, type: {} },
  );
  assert.deepEqual(c.tags, ['new', 'tags']);
  assert.deepEqual(validate(p).errors, []);
});
