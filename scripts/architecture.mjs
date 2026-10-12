import fs from 'node:fs/promises';
import path from 'node:path';
import { Linter } from 'eslint';

// Parse actual import/export syntax with the existing ESLint parser, not source-text matching.
export function analyzeModules(sources) {
  const graph = new Map(),
    errors = [];
  for (const [file, source] of sources) {
    const imports = [];
    const capture = (node) => {
      if (node.source) imports.push(node.source.value);
    };
    const messages = new Linter().verify(source, [
      {
        languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
        plugins: {
          architecture: {
            rules: {
              imports: {
                create: () => ({
                  ImportDeclaration: capture,
                  ExportNamedDeclaration: capture,
                  ExportAllDeclaration: capture,
                }),
              },
            },
          },
        },
        rules: { 'architecture/imports': 'error' },
      },
    ]);
    for (const message of messages) if (message.fatal) errors.push(file + ': ' + message.message);
    const deps = imports
      .filter((value) => value.startsWith('.'))
      .map((value) => path.posix.normalize(path.posix.join(path.posix.dirname(file), value)));
    graph.set(
      file,
      deps.filter((dep) => sources.has(dep)),
    );
    for (const dep of deps) {
      if (dep.endsWith('/app.js') && file !== dep) errors.push(file + ' imports application entry');
      if (file.startsWith('assets/js/common/') && !dep.startsWith('assets/js/common/'))
        errors.push(file + ' has an upward common dependency: ' + dep);
      if (!sources.has(dep) && !dep.startsWith('assets/vendor/'))
        errors.push(file + ' missing module: ' + dep);
    }
  }
  const active = new Set(),
    complete = new Set();
  function visit(file, chain = []) {
    if (active.has(file)) {
      errors.push('Import cycle: ' + [...chain, file].join(' -> '));
      return;
    }
    if (complete.has(file)) return;
    active.add(file);
    for (const dep of graph.get(file) || []) visit(dep, [...chain, file]);
    active.delete(file);
    complete.add(file);
  }
  for (const file of graph.keys()) visit(file);
  return { errors, modules: sources.size };
}
export async function checkArchitecture() {
  const sources = new Map();
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = dir + '/' + entry.name;
      if (entry.isDirectory()) await walk(file);
      else if (file.endsWith('.js')) sources.set(file, await fs.readFile(file, 'utf8'));
    }
  }
  await walk('assets/js');
  const result = analyzeModules(sources);
  if (result.errors.length) throw Error(result.errors.join('\n'));
  console.log(
    'Architecture: ' + result.modules + ' modules; no cycles or upward entry/common imports',
  );
}
