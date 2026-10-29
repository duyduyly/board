import { build } from 'esbuild';
import fs from 'node:fs/promises';
const entries = {
  cytoscape: 'cytoscape',
  ajv: 'ajv',
  marked: 'marked',
  dompurify: 'dompurify',
  mermaid: 'mermaid',
};
await fs.mkdir('assets/vendor', { recursive: true });
await fs.mkdir('scripts/vendor-src', { recursive: true });
for (const [name, pkg] of Object.entries(entries)) {
  await fs.writeFile(
    'scripts/vendor-src/' + name + '-entry.js',
    name === 'marked'
      ? "export {marked} from 'marked';"
      : 'export {default} from ' + JSON.stringify(pkg) + ';',
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
