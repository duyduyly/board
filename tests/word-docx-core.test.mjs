import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { TextDecoder } from 'node:util';
import { buildDocx, DOCX_MIME } from '../assets/js/word-export/index.js';
import { readZip, readZipText } from './docx-zip-reader.mjs';

const labels = {
  ungrouped: 'Other notes',
  links: 'Links',
  type: 'Type',
  tags: 'Tags',
  legacySource: 'Legacy source',
  mermaidSource: 'Mermaid source',
  remoteImage: 'Web image',
  image: 'Image',
  group: 'Group',
  contents: 'Contents',
  contentsHint: 'Hint',
  contentsTip: 'Tip',
};
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
// RIFF....WEBP header with a lossless chunk: enough for the attachment validator and the pipeline.
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([30, 0, 0, 0]),
  Buffer.from('WEBPVP8L'),
  Buffer.from([10, 0, 0, 0, 0x2f, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
]).toString('base64');
const TRANSCODED_PNG = Uint8Array.from(Buffer.from(PNG, 'base64'));

const card = (id, extra = {}) => ({
  id,
  title: 'Title ' + id,
  summary: '',
  type: '',
  tags: [],
  content: '',
  position: { x: 0, y: Number(id.replace(/\D/g, '')) || 0 },
  size: { width: 200, height: 100 },
  style: { backgroundColor: '#fff', textColor: '#000', borderColor: '#000' },
  ...extra,
});
const el = (tag, attributes = {}, ...children) => ({ tag, attributes, children });
const doc = (...nodes) => ({ 'card-atlas:document': { components: nodes } });
const attachments = {
  png: { name: 'p.png', mimeType: 'image/png', data: PNG },
  w: { name: 'w.webp', mimeType: 'image/webp', data: WEBP },
};
const img = (src) => el('p', {}, el('img', { src, alt: 'pic ' + src }));

function fixture() {
  const body = doc(
    el('h2', {}, 'Section'),
    el('p', {}, 'See ', el('a', { href: 'https://example.com/x?a=1&b=2' }, 'external')),
    img('attachment:png'),
    img('attachment:png'),
    el(
      'table',
      {},
      el('thead', {}, el('tr', {}, el('th', { colspan: '2' }, 'Head'))),
      el('tr', {}, el('td', { rowspan: '2' }, 'a'), el('td', {}, 'b')),
      el('tr', {}, el('td', {}, el('ul', {}, el('li', {}, 'cell item')))),
    ),
    el(
      'ul',
      {},
      el('li', {}, 'one', el('ol', {}, el('li', {}, 'nested'), el('li', {}, 'again'))),
      el('li', {}, 'two'),
    ),
    el('pre', {}, el('code', { class: 'language-js' }, 'const a = 1 < 2;\n')),
    el('pre', {}, el('code', { class: 'language-mermaid' }, 'graph TD\nA-->B')),
    el('p', {}, el('img', { src: 'https://example.com/r.png', alt: 'remote' })),
    img('attachment:w'),
  );
  return {
    version: '1.0',
    metadata: { title: 'Atlas & <Co>', description: 'About' },
    canvas: { zoom: 1, position: { x: 0, y: 0 } },
    cards: [
      card('c1', { extensions: { 'card-atlas:images': attachments, ...body } }),
      card('c2', { content: 'Legacy *markdown*\n\nsecond paragraph' }),
      card('c3', { extensions: doc(el('p', {}, 'Plain body')) }),
    ],
    relations: [
      {
        id: 'r1',
        source: 'c1',
        target: 'c2',
        label: 'leads',
        description: '',
        type: '',
        style: { color: '#000', line: 'solid', arrow: 'end' },
      },
    ],
    extensions: {
      'card-atlas:groups': {
        groups: [
          { id: 'g1', title: 'Outer', cardIds: ['c1'], links: [{ id: 'l1', source: 'c3' }] },
          { id: 'g2', title: 'Middle', cardIds: ['c2'], parentId: 'g1' },
          { id: 'g3', title: 'Inner', cardIds: [], parentId: 'g2' },
        ],
      },
    },
  };
}

const build = (project, options = {}) => buildDocx(project, { view: 'card', labels, ...options });
const withTranscode = { transcode: async () => TRANSCODED_PNG };

/** Rough well-formedness: tags open and close in order. */
function assertBalanced(name, xml) {
  const stack = [];
  for (const m of xml.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)[^>]*?(\/?)>/g)) {
    const [, closing, tag, selfClosing] = m;
    if (selfClosing) continue;
    if (closing) assert.equal(stack.pop(), tag, `${name}: unbalanced </${tag}>`);
    else stack.push(tag);
  }
  assert.deepEqual(stack, [], `${name}: unclosed tags`);
}

function assertPackage(bytes) {
  const files = readZipText(bytes);
  for (const name of [
    '[Content_Types].xml',
    '_rels/.rels',
    'word/document.xml',
    'word/_rels/document.xml.rels',
    'word/styles.xml',
    'word/numbering.xml',
    'docProps/core.xml',
  ])
    assert.ok(files.has(name), name);
  for (const [name, text] of files) if (/\.(xml|rels)$/.test(name)) assertBalanced(name, text);
  return files;
}

test('DOCX_MIME is the Word media type', () => {
  assert.equal(
    DOCX_MIME,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
});

test('builds a readable package with the project outline in the body', async () => {
  const { bytes } = await build(fixture());
  const body = assertPackage(bytes).get('word/document.xml');
  for (const text of ['Atlas &amp; &lt;Co&gt;', 'Outer', 'Middle', 'Inner', 'Title c1', 'Title c3'])
    assert.ok(body.includes(text), text);
  assert.ok(body.includes('Plain body'));
  assert.ok(body.includes('second paragraph'));
  assert.ok(body.includes('graph TD'));
});

test('content types cover exactly the media in the package', async () => {
  const files = readZip((await build(fixture(), withTranscode)).bytes);
  const types = new TextDecoder().decode(files.get('[Content_Types].xml'));
  const media = [...files.keys()].filter((n) => n.startsWith('word/media/'));
  assert.ok(media.length >= 2);
  const declared = [...types.matchAll(/Extension="([^"]+)"/gi)].map((m) => m[1].toLowerCase());
  for (const name of media) assert.ok(declared.includes(name.split('.').pop()), name);
  assert.ok(!declared.includes('webp'));
});

test('a shared attachment is stored once', async () => {
  const files = readZip((await build(fixture(), withTranscode)).bytes);
  const body = new TextDecoder().decode(files.get('word/document.xml'));
  const media = [...files.keys()].filter((n) => n.startsWith('word/media/'));
  assert.equal(media.length, 2); // c1/png (used twice) and the transcoded WebP
  assert.equal([...body.matchAll(/<w:drawing>/g)].length, 3);
});

test('WebP is embedded as PNG through transcode and counted as skipped otherwise', async () => {
  const calls = [];
  const ok = await build(fixture(), {
    transcode: async (bytes, mimeType) => {
      calls.push(mimeType);
      assert.ok(bytes.length > 0);
      return TRANSCODED_PNG;
    },
  });
  assert.deepEqual(calls, ['image/webp']);
  assert.equal(ok.skippedImages, 0);
  const failing = [null, async () => null, async () => Promise.reject(new Error('boom'))];
  for (const transcode of failing) {
    const result = await build(fixture(), { transcode });
    assert.equal(result.skippedImages, 1);
    assertPackage(result.bytes);
  }
});

test('external links become hyperlinks and group links resolve to bookmarks', async () => {
  const files = assertPackage((await build(fixture())).bytes);
  const body = files.get('word/document.xml');
  assert.ok(body.includes('<w:hyperlink r:id='));
  assert.ok(
    files.get('word/_rels/document.xml.rels').includes('https://example.com/x?a=1&amp;b=2'),
  );
  const bookmarks = new Set(
    [...body.matchAll(/w:bookmarkStart [^>]*w:name="([^"]+)"/g)].map((m) => m[1]),
  );
  const anchors = [...body.matchAll(/w:hyperlink w:anchor="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(anchors.length >= 2);
  for (const anchor of anchors) assert.ok(bookmarks.has(anchor), anchor);
});

test('output is deterministic and the project is left untouched', async () => {
  const project = fixture();
  const before = structuredClone(project);
  const first = await build(project);
  const second = await build(project);
  assert.deepEqual(first.bytes, second.bytes);
  assert.deepEqual(project, before);
});

test('a brand logo is accepted and the package stays valid', async () => {
  const logo = { mimeType: 'image/png', bytes: Buffer.from(PNG, 'base64') };
  const withLogo = await build(fixture(), { logo });
  assertPackage(withLogo.bytes);
  assert.equal(withLogo.skippedImages, (await build(fixture())).skippedImages);
});

test('Mind Map view builds a valid package too', async () => {
  const project = fixture();
  project.extensions['card-atlas:mind-map'] = { rootId: 'c1' };
  assertPackage((await buildDocx(project, { view: 'mind', labels })).bytes);
});

test('bundled sample projects build without errors', async () => {
  let built = 0;
  for (const dir of ['assets/data', 'assets/data/templates']) {
    const base = new URL(`../${dir}/`, import.meta.url);
    for (const name of readdirSync(base).filter((n) => n.endsWith('.json'))) {
      const json = JSON.parse(readFileSync(new URL(name, base), 'utf8'));
      if (json.version !== '1.0' || !Array.isArray(json.cards)) continue;
      assertPackage((await build(json)).bytes);
      built++;
    }
  }
  assert.ok(built >= 3);
});
