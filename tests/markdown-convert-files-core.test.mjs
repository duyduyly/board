import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { stage } from '../assets/js/json/validator.js';

test('offline conversion backs up exact bytes, validates output and does not overwrite inputs', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'card-atlas-convert-'));
  const input = resolve('tests/fixtures/legacy/example.json');
  const bytes = await readFile(input);
  const out = join(temp, 'result');
  const run = spawnSync(
    process.execPath,
    ['scripts/convert-markdown-files.mjs', '--out', out, input],
    { encoding: 'utf8' },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(await readFile(join(out, 'backup', 'example.json')), bytes);
  assert.deepEqual(await readFile(input), bytes);
  const converted = await readFile(join(out, 'converted', 'example.json'), 'utf8');
  const project = stage(converted);
  assert.deepEqual(project.errors, []);
  const original = JSON.parse(bytes);
  assert.deepEqual(project.project.relations, stage(bytes.toString()).project.relations);
  assert.equal(project.project.cards.length, original.cards.length);
  assert.ok(project.project.cards.every((c) => c.extensions['card-atlas:document']));
  const report = JSON.parse(await readFile(join(out, 'report.json'), 'utf8'));
  assert.equal(report.files[0].cards.length, original.cards.length);
  assert.ok(
    report.files[0].cards.some((c) => c.warnings.some((w) => w.kind === 'mermaid-preserved')),
  );
  const second = join(temp, 'second');
  const rerun = spawnSync(
    process.execPath,
    ['scripts/convert-markdown-files.mjs', '--out', second, join(out, 'converted', 'example.json')],
    { encoding: 'utf8' },
  );
  assert.equal(rerun.status, 0, rerun.stderr);
  assert.deepEqual(
    JSON.parse(await readFile(join(second, 'converted', 'example.json'), 'utf8')),
    JSON.parse(converted),
  );
  const secondReport = JSON.parse(await readFile(join(second, 'report.json'), 'utf8'));
  assert.ok(secondReport.files[0].cards.every((card) => card.skipped));
  const again = spawnSync(
    process.execPath,
    ['scripts/convert-markdown-files.mjs', '--out', out, input],
    { encoding: 'utf8' },
  );
  assert.notEqual(again.status, 0);
  assert.deepEqual(await readFile(input), bytes);
});

test('a batch with an invalid project writes no output directory', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'card-atlas-invalid-'));
  const bad = join(temp, 'bad.json');
  await writeFile(bad, '{}');
  const out = join(temp, 'result');
  const run = spawnSync(
    process.execPath,
    ['scripts/convert-markdown-files.mjs', '--out', out, resolve('assets/data/example.json'), bad],
    { encoding: 'utf8' },
  );
  assert.notEqual(run.status, 0);
  await assert.rejects(stat(out), { code: 'ENOENT' });
});
