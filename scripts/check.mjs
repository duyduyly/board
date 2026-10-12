import { checkArchitecture } from './architecture.mjs';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
const walk = async (p) => {
  let files = [];
  for (const e of await fs.readdir(p, { withFileTypes: true })) {
    if (e.name === 'vendor') continue;
    const f = path.join(p, e.name);
    files.push(...(e.isDirectory() ? await walk(f) : /\.(js|mjs)$/.test(f) ? [f] : []));
  }
  return files;
};
for (const f of [
  ...(await walk('assets/js')),
  ...(await walk('scripts')),
  ...(await walk('tests')),
]) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stderr);
    process.exit(1);
  }
}
const lint = spawnSync(
  process.execPath,
  ['node_modules/eslint/bin/eslint.js', 'assets/js', 'scripts', 'tests'],
  { stdio: 'inherit' },
);
if (lint.status !== 0) process.exit(1);
await checkArchitecture();
console.log('Syntax and lint checks passed');
