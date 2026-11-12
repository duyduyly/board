import { build } from 'esbuild';
import fs from 'node:fs/promises';
const entries = {
  cytoscape: 'cytoscape',
  ajv: 'ajv',
  dompurify: 'dompurify',
  grapesjs: 'grapesjs',
};
await fs.mkdir('assets/vendor', { recursive: true });
await fs.mkdir('scripts/vendor-src', { recursive: true });
for (const [name, pkg] of Object.entries(entries)) {
  await fs.writeFile(
    'scripts/vendor-src/' + name + '-entry.js',
    'export {default} from ' + JSON.stringify(pkg) + ';',
  );
}
await build({
  entryPoints: Object.keys(entries).map((n) => 'scripts/vendor-src/' + n + '-entry.js'),
  outdir: 'assets/vendor',
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
  bundle: true,
  format: 'esm',
  splitting: true,
  minify: true,
  platform: 'browser',
  target: 'es2022',
  legalComments: 'eof',
});
console.log('Local vendor modules built');
const codeMirrorBuild = await build({
  entryPoints: ['scripts/codemirror-entry.js'],
  outfile: 'assets/vendor/codemirror-entry.js',
  bundle: true,
  format: 'esm',
  minify: true,
  platform: 'browser',
  target: 'es2022',
  legalComments: 'eof',
  metafile: true,
});
const codeMirrorPackages = new Set();
for (const path of Object.keys(codeMirrorBuild.metafile.inputs)) {
  const parts = path.replaceAll('\\', '/').split('/');
  const index = parts.lastIndexOf('node_modules');
  if (index < 0) continue;
  const name = parts[index + 1];
  codeMirrorPackages.add(name.startsWith('@') ? name + '/' + parts[index + 2] : name);
}
const codeMirrorLicenses = [];
for (const name of [...codeMirrorPackages].sort()) {
  codeMirrorLicenses.push(
    '===== ' + name + ' =====\n' + (await fs.readFile('node_modules/' + name + '/LICENSE', 'utf8')),
  );
}
await fs.writeFile(
  'assets/vendor/codemirror-dependencies-LICENSE.txt',
  codeMirrorLicenses.join('\n\n'),
);
await fs.copyFile('node_modules/codemirror/LICENSE', 'assets/vendor/codemirror-LICENSE.txt');
await fs.copyFile(
  'node_modules/@codemirror/lang-html/LICENSE',
  'assets/vendor/codemirror-html-LICENSE.txt',
);
await fs.copyFile(
  'node_modules/@codemirror/state/LICENSE',
  'assets/vendor/codemirror-state-LICENSE.txt',
);
await fs.copyFile(
  'node_modules/@codemirror/language/LICENSE',
  'assets/vendor/codemirror-language-LICENSE.txt',
);
await fs.copyFile(
  'node_modules/@codemirror/lint/LICENSE',
  'assets/vendor/codemirror-lint-LICENSE.txt',
);
await build({
  entryPoints: ['scripts/highlight-entry.js'],
  outfile: 'assets/vendor/highlight-entry.js',
  bundle: true,
  format: 'esm',
  minify: true,
  platform: 'browser',
  target: 'es2022',
  legalComments: 'eof',
});
await fs.copyFile('node_modules/highlight.js/LICENSE', 'assets/vendor/highlight-LICENSE.txt');
await fs.copyFile('node_modules/grapesjs/dist/css/grapes.min.css', 'assets/vendor/grapes.min.css');
await fs.copyFile(
  'node_modules/bootstrap/dist/css/bootstrap.min.css',
  'assets/vendor/bootstrap.min.css',
);
await fs.copyFile('node_modules/grapesjs/LICENSE', 'assets/vendor/grapesjs-LICENSE.txt');
await fs.copyFile('node_modules/bootstrap/LICENSE', 'assets/vendor/bootstrap-LICENSE.txt');
await fs.copyFile('node_modules/grapesjs/locale/vi.mjs', 'assets/vendor/grapes-vi.js');
// elkjs (EPL-2.0, ~1.6 MB) is only an optional layout engine loaded lazily by Mermaid; the default
// dagre layout never needs it, so it is replaced by a stub that fails loudly if an ELK layout is requested.
const omitElkjs = {
  name: 'omit-elkjs',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^elkjs(\/|$)/ }, () => ({
      path: 'elkjs',
      namespace: 'omit-elkjs',
    }));
    pluginBuild.onLoad({ filter: /.*/, namespace: 'omit-elkjs' }, () => ({
      contents:
        "export default class ELK { constructor() { throw new Error('ELK layout is not bundled'); } }",
      loader: 'js',
    }));
  },
};
const mermaidBuild = await build({
  plugins: [omitElkjs],
  entryPoints: ['scripts/mermaid-entry.js'],
  outdir: 'assets/vendor/mermaid',
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
  bundle: true,
  format: 'esm',
  splitting: true,
  minify: true,
  platform: 'browser',
  target: 'es2022',
  legalComments: 'none',
  metafile: true,
});
const mermaidPackages = new Set();
for (const path of Object.keys(mermaidBuild.metafile.inputs)) {
  const parts = path.replaceAll('\\', '/').split('/');
  const index = parts.lastIndexOf('node_modules');
  if (index < 0) continue;
  const name = parts[index + 1];
  mermaidPackages.add(name.startsWith('@') ? name + '/' + parts[index + 2] : name);
}
const mermaidLicenses = [];
for (const name of [...mermaidPackages].sort()) {
  const files = await fs.readdir('node_modules/' + name);
  const licenseFile = files.find((file) => /^(licen[sc]e|copying)(\.|$)/i.test(file));
  const text = licenseFile
    ? await fs.readFile('node_modules/' + name + '/' + licenseFile, 'utf8')
    : 'No license file shipped; see package.json license field.';
  mermaidLicenses.push('===== ' + name + ' =====\n' + text);
}
await fs.writeFile('assets/vendor/mermaid/LICENSES.txt', mermaidLicenses.join('\n\n'));
