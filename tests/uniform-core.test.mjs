import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectStore, newCard } from '../assets/js/store/project-store.js';
import { blank, stage, serialize } from '../assets/js/json/validator.js';
import {
  uniformProfile,
  applyUniformStyles,
  TYPOGRAPHY,
} from '../assets/js/graph/card-typography.js';
test('uniform typography copies only styles and remains atomic across fit failure, undo and round-trip', () => {
  const p = blank();
  for (let i = 0; i < 3; i++) {
    const c = newCard({ x: i * 300, y: 0 });
    c.title = 'Title ' + i;
    c.summary = 'Summary ' + i;
    c.content = '# ' + i;
    c.style.textColor = i ? '#112233' : '#334455';
    c.extensions['card-atlas:appearance'] = { titleFontSize: 12 + i };
    p.cards.push(c);
  }
  const profile = uniformProfile(p.cards[0], {
      title: { fontSize: 24, fontFamily: 'serif' },
      summary: {},
      type: {},
    }),
    store = new ProjectStore();
  store.replace(p);
  store.commit((d) => applyUniformStyles(d, profile, 'card', () => ({ width: 300, height: 200 })));
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(store.project.cards[i].extensions[TYPOGRAPHY], profile);
    assert.equal(store.project.cards[i].title, p.cards[i].title);
    assert.equal(store.project.cards[i].content, p.cards[i].content);
    assert.deepEqual(store.project.cards[i].size, p.cards[i].size);
  }
  assert.deepEqual(stage(serialize(store.project)).errors, []);
  store.undo();
  assert.deepEqual(store.project, p);
  store.redo();
  const before = structuredClone(store.project);
  assert.throws(() =>
    store.commit((d) => {
      d.cards[2].extensions['card-atlas:appearance'].sizeMode = 'fit';
      applyUniformStyles(d, profile, 'mind', () => null);
    }),
  );
  assert.deepEqual(store.project, before);
});
