import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { stage } from '../assets/js/json/validator.js';
test('every bundled gallery template imports independently with valid relations and stable snapshot', async () => {
  const catalog = JSON.parse(await fs.readFile('assets/data/template-catalog.json', 'utf8'));
  assert.equal(new Set(catalog.map((x) => x.id)).size, catalog.length);
  assert.deepEqual(
    new Set(catalog.map((x) => x.category)),
    new Set(['personal', 'learning', 'work', 'project']),
  );
  for (const item of catalog) {
    const text = await fs.readFile(item.path, 'utf8');
    const result = stage(text);
    assert.deepEqual(result.errors, [], item.id);
    assert.ok(result.project.cards.length);
    const again = stage(JSON.stringify(result.project));
    assert.deepEqual(again.project, result.project);
    assert.ok((await fs.stat(item.preview)).size);
  }
});
