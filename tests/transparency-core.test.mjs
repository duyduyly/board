import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { stage, serialize, validate } from '../assets/js/json/validator.js';
import { ProjectStore } from '../assets/js/store/project-store.js';
import { APPEARANCE, appearance } from '../assets/js/detail/appearance.js';
test('transparent flags preserve colors, round-trip and undo; reject non-booleans', async () => {
  const p = stage(await fs.readFile('assets/data/example.json', 'utf8')).project;
  const original = structuredClone(p.cards[0].style);
  assert.equal(appearance(p.cards[0]).backgroundTransparent, false);
  const store = new ProjectStore();
  store.replace(p);
  store.commit((next) => {
    next.cards[0].extensions ||= {};
    next.cards[0].extensions[APPEARANCE] = { backgroundTransparent: true, borderTransparent: true };
  });
  const imported = stage(serialize(store.project));
  assert.deepEqual(imported.errors, []);
  assert.deepEqual(imported.project.cards[0].style, original);
  assert.equal(appearance(imported.project.cards[0]).borderTransparent, true);
  store.undo();
  assert.equal(appearance(store.project.cards[0]).backgroundTransparent, false);
  store.redo();
  assert.equal(appearance(store.project.cards[0]).backgroundTransparent, true);
  for (const invalid of ['true', 1, null, 'url(x)']) {
    const copy = structuredClone(store.project);
    copy.cards[0].extensions[APPEARANCE].backgroundTransparent = invalid;
    assert.ok(validate(copy).errors.some((e) => e.path.includes('card-atlas:appearance')));
  }
});
