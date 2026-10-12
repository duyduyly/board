import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  stage,
  validate,
  normalize,
  serialize,
  filename,
  blank,
} from '../assets/js/json/validator.js';
import {
  ProjectStore,
  newCard,
  newRelation,
  remove,
  search,
} from '../assets/js/store/project-store.js';
import { dictionaries, setLocale, t } from '../assets/js/i18n/index.js';
const example = JSON.parse(await fs.readFile('assets/data/example.json', 'utf8'));
const input = () => structuredClone(example);
test('example contract and schema asset agree', async () => {
  assert.deepEqual(validate(input()).errors, []);
  assert.deepEqual(stage(JSON.stringify(input())).adjustments, []);
  const schema = (await import('../assets/js/json/schema.js')).default;
  assert.deepEqual(
    schema,
    JSON.parse(await fs.readFile('assets/data/project.schema.json', 'utf8')),
  );
});
test('syntax, unknown fields, finite numbers, partial points and colors rejected', () => {
  assert.equal(stage('{').errors[0].code, 'syntax');
  for (const mutate of [
    (p) => (p.cards[0].unknown = true),
    (p) => (p.cards[0].position = { x: 1 }),
    (p) => (p.cards[0].position.x = Infinity),
    (p) => (p.cards[0].title = '  '),
    (p) => (p.cards[0].style.borderColor = 'red'),
    (p) => (p.version = '2.0'),
  ]) {
    const p = input();
    mutate(p);
    assert.ok(validate(p).errors.length);
  }
  const p = input();
  p.cards[0].unknown = true;
  assert.equal(validate(p).errors[0].path, 'cards[0].unknown');
});
test('graph namespaces, cycles, parallel edges and duplicate warnings', () => {
  const p = input();
  p.relations[0].id = p.cards[0].id;
  assert.deepEqual(validate(p).errors, []);
  p.relations.push({ ...structuredClone(p.relations[0]), id: 'parallel' });
  assert.equal(validate(p).warnings[0].code, 'duplicateRelation');
  p.relations.push({
    ...structuredClone(p.relations[1]),
    id: 'cycle',
    source: p.cards[2].id,
    target: p.cards[0].id,
  });
  assert.deepEqual(validate(p).errors, []);
  p.relations[0].target = 'missing';
  assert.equal(validate(p).errors[0].code, 'missingEndpoint');
  p.relations[0].target = p.relations[0].source;
  assert.equal(validate(p).errors[0].code, 'selfLoop');
});
test('IDs unique and stable', () => {
  const p = input();
  p.cards[1].id = p.cards[0].id;
  assert.ok(validate(p).errors.some((e) => e.code === 'duplicateId'));
  const p2 = input();
  p2.relations[1].id = p2.relations[0].id;
  assert.ok(validate(p2).errors.some((e) => e.code === 'duplicateId'));
});
test('grid defaults deterministic and idempotent with mixed positions', () => {
  const p = {
    version: '1.0',
    cards: [
      { id: 'a', title: 'A', position: { x: 100, y: 50 }, size: { width: 260, height: 140 } },
      { id: 'b', title: 'B' },
      { id: 'c', title: 'C' },
    ],
    relations: [],
  };
  const n = normalize(p);
  assert.equal(n.project.cards[1].position.x, 420);
  assert.equal(n.project.cards[1].position.y, 50);
  assert.equal(n.project.cards[2].position.x, 740);
  assert.deepEqual(normalize(n.project).adjustments, []);
  assert.deepEqual(normalize(p).project, n.project);
  assert.deepEqual(p.cards[0].position, { x: 100, y: 50 });
});
test('operating limits fail closed at boundaries', () => {
  assert.equal(stage('{}', 10 * 1024 * 1024 + 1).errors[0].code, 'fileLimit');
  const p = blank();
  p.cards = Array.from({ length: 500 }, (_, i) => newCard({ x: i, y: 0 }, 'A'));
  assert.deepEqual(validate(p).errors, []);
  p.cards.push(newCard({ x: 0, y: 0 }, 'B'));
  assert.ok(validate(p).errors.length);
  const p2 = input();
  p2.cards[0].content = 'a'.repeat(100000);
  assert.deepEqual(validate(p2).errors, []);
  p2.cards[0].content += 'x';
  assert.ok(validate(p2).errors.length);
  p2.cards[0].content = '';
  p2.relations = Array.from({ length: 2000 }, (_, i) => ({ ...p2.relations[0], id: 'r' + i }));
  assert.deepEqual(validate(p2).errors, []);
  p2.relations.push({ ...p2.relations[0], id: 'overflow' });
  assert.ok(validate(p2).errors.length);
});
test('cascade deletion undo restores order, graph and clean snapshot', () => {
  const s = new ProjectStore();
  s.replace(input());
  s.commit((p) => remove(p, { kind: 'card', id: p.cards[0].id }));
  assert.equal(s.project.cards.length, 2);
  assert.equal(s.project.relations.length, 1);
  assert.ok(s.dirty);
  s.undo();
  assert.deepEqual(s.project, input());
  assert.equal(s.dirty, false);
  s.redo();
  assert.equal(s.project.cards.length, 2);
});
test('connector transaction undo and redo one operation', () => {
  const s = new ProjectStore();
  s.replace(input());
  const card = newCard({ x: 0, y: 0 });
  const rel = newRelation(s.project.cards[0].id, card.id);
  s.commit((p) => {
    p.cards.push(card);
    p.relations.push(rel);
  });
  assert.equal(s.undoStack.length, 1);
  s.undo();
  assert.deepEqual(s.project, input());
  s.redo();
  assert.equal(s.project.cards.length, 4);
});
test('no-op, rename, redo invalidation and project boundary', () => {
  const s = new ProjectStore();
  s.replace(input());
  s.commit(() => {});
  assert.equal(s.undoStack.length, 0);
  const id = s.project.cards[0].id;
  s.commit((p) => (p.cards[0].title = 'Changed'));
  assert.equal(s.project.cards[0].id, id);
  s.undo();
  s.commit((p) => (p.cards[0].summary = 'New'));
  assert.equal(s.redoStack.length, 0);
  s.replace(blank());
  assert.equal(s.undoStack.length, 0);
});
test('history eviction and oversized transaction notice', () => {
  const s = new ProjectStore({ maxHistory: 2 });
  s.replace(input());
  for (let i = 0; i < 3; i++) s.commit((p) => (p.cards[0].title = 'Name ' + i));
  assert.equal(s.undoStack.length, 2);
  s.undo();
  s.undo();
  assert.equal(s.project.cards[0].title, 'Name 0');
  const tiny = new ProjectStore({ maxBytes: 10 });
  tiny.replace(input());
  tiny.commit((p) => (p.cards[0].title = 'changed'));
  assert.equal(tiny.undoStack.length, 0);
  assert.ok(tiny.notice);
});
test('view separate from content and normalization dirty', () => {
  const s = new ProjectStore();
  s.replace(input());
  s.setView(2, { x: 10, y: 20 });
  assert.equal(s.dirty, false);
  assert.equal(s.viewChanged, true);
  s.replace(normalize({ version: '1.0', cards: [], relations: [] }).project, true);
  assert.equal(s.dirty, true);
  s.exported();
  assert.equal(s.dirty, false);
});
test('rejected command keeps model and history', () => {
  const s = new ProjectStore();
  s.replace(input());
  assert.throws(() => s.commit((p) => (p.relations[0].target = 'missing')));
  assert.deepEqual(s.project, input());
  assert.equal(s.undoStack.length, 0);
});
test('round-trip retains extensions, content and styles', () => {
  const p = input();
  p.extensions = { 'test:payload': { nested: [1, true, null, 'x'] } };
  p.relations[0].extensions = { 'test:zero': 0 };
  const result = stage(serialize(p));
  assert.deepEqual(result.project, p);
  assert.equal(result.errors.length, 0);
});
test('filename sanitized and locale does not alter project', () => {
  assert.equal(filename(''), 'graph-project.json');
  assert.equal(filename('bad/name:*'), 'bad-name--.json');
  const s = new ProjectStore();
  s.replace(input());
  const a = serialize(s.project);
  setLocale('en');
  assert.equal(t('apply'), 'Apply');
  setLocale('vi');
  assert.equal(t('apply'), 'Áp dụng');
  assert.equal(serialize(s.project), a);
  assert.deepEqual(Object.keys(dictionaries.en).sort(), Object.keys(dictionaries.vi).sort());
  assert.ok(t('errorSchema', { code: 'type' }).includes('type'));
});
test('search includes full Markdown and case-insensitive fields', () => {
  const p = input();
  assert.equal(search(p.cards, 'USER').length, 3);
  assert.equal(search(p.cards, 'storage').length, 1);
  assert.equal(search(p.cards, 'actual tables').length, 1);
});

test('canonical file size prevents edits that cannot reimport', () => {
  const p = input();
  p.metadata.description = 'x'.repeat(10 * 1024 * 1024);
  assert.ok(validate(p).errors.some((e) => e.code === 'fileLimit'));
  const s = new ProjectStore();
  s.replace(input());
  assert.throws(() => s.commit((next) => (next.metadata.description = p.metadata.description)));
  assert.deepEqual(s.project, input());
});

test('Mermaid policy blocks configuration and resources before render', async () => {
  const { isSafeDiagramSource } = await import('../assets/js/detail/mermaid-policy.js');
  assert.equal(isSafeDiagramSource('flowchart LR\n A --> B'), true);
  for (const code of [
    '%%{init: {"themeCSS":"@import url(https://example.com/a)"}}%%\nflowchart LR\n A-->B',
    '---\nconfig: test\n---\nflowchart LR\n A-->B',
    'flowchart LR\n A@{ img: "https://example.com/a" }',
    'flowchart LR\n A-->B\nstyle A fill:url(test)',
    'flowchart LR\n A-->B\nclick A callback',
  ])
    assert.equal(isSafeDiagramSource(code), false);
});

test('extensions reject non-finite values instead of silently converting to null', () => {
  const p = input();
  p.extensions = { 'test:bad': Infinity };
  assert.ok(validate(p).errors.some((e) => e.code === 'jsonValue'));
  const text = '{"version":"1.0","cards":[],"relations":[],"extensions":{"test:bad":1e999}}';
  assert.ok(stage(text).errors.some((e) => e.code === 'jsonValue'));
});

test('English missing key falls back to Vietnamese without changing content', () => {
  const original = dictionaries.en.apply;
  delete dictionaries.en.apply;
  try {
    setLocale('en');
    assert.equal(t('apply'), 'Áp dụng');
  } finally {
    dictionaries.en.apply = original;
    setLocale('vi');
  }
});

test('embedded raster attachments validate and survive export/import and undo', async () => {
  const { IMAGE_NAMESPACE, validImageAttachment, imageReference } =
    await import('../assets/js/detail/attachments.js');
  const image = {
    name: 'english-endings.png',
    mimeType: 'image/png',
    data: (await fs.readFile('tests/fixtures/english-endings.png')).toString('base64'),
  };
  assert.ok(validImageAttachment(image));
  assert.equal(
    imageReference('image-one', 'a[b].png'),
    '![' + String.raw`a\[b\].png` + '](attachment:image-one)',
  );
  const store = new ProjectStore();
  store.replace(normalize(example).project);
  store.commit((p) => {
    p.cards[0].extensions = { [IMAGE_NAMESPACE]: { 'image-one': image } };
    p.cards[0].content += '\n\n![Chart](attachment:image-one)';
  });
  const serialized = serialize(store.project, store.viewport);
  const staged = stage(serialized);
  assert.deepEqual(staged.errors, []);
  assert.deepEqual(staged.project.cards[0].extensions[IMAGE_NAMESPACE]['image-one'], image);
  store.undo();
  assert.equal(store.project.cards[0].extensions, undefined);
  store.redo();
  assert.deepEqual(store.project.cards[0].extensions[IMAGE_NAMESPACE]['image-one'], image);
});

test('invalid embedded images fail closed without accepting SVG or malformed base64', async () => {
  const { IMAGE_NAMESPACE, validImageAttachment } =
    await import('../assets/js/detail/attachments.js');
  for (const image of [
    { name: 'bad.svg', mimeType: 'image/svg+xml', data: Buffer.from('<svg/>').toString('base64') },
    {
      name: 'fake.png',
      mimeType: 'image/png',
      data: Buffer.from('<script>alert(1)</script>').toString('base64'),
    },
    { name: 'bad.png', mimeType: 'image/png', data: 'not base64' },
  ]) {
    assert.equal(validImageAttachment(image), false);
    const project = normalize(example).project;
    project.cards[0].extensions = { [IMAGE_NAMESPACE]: { 'image-bad': image } };
    assert.ok(validate(project).errors.some((e) => e.code === 'imageAttachment'));
  }
});

test('Markdown downloads inline attachment images and bound repeated expansion', async () => {
  const { markdownDocument } = await import('../assets/js/detail/writing.js');
  const card = {
    title: 'Document',
    summary: 'Overview',
    content: '![Chart](attachment:image-one)',
    extensions: { 'card-atlas:images': { 'image-one': { mimeType: 'image/png', data: 'AAA' } } },
  };
  assert.ok(markdownDocument(card).includes('![Chart](data:image/png;base64,AAA)'));
  card.extensions['card-atlas:images']['image-one'].data = 'A'.repeat(6 * 1024 * 1024);
  card.content += '\n![Chart](attachment:image-one)';
  assert.throws(() => markdownDocument(card), /size/);
});

test('Appearance is bounded, portable and restored atomically with card size', () => {
  const p = input();
  p.cards[0].extensions = {
    'card-atlas:appearance': {
      radius: 24,
      borderWidth: 3,
      titleFontSize: 18,
      align: 'center',
      shadow: 'none',
    },
  };
  assert.deepEqual(validate(p).errors, []);
  const s = new ProjectStore();
  s.replace(normalize(p).project);
  s.commit((p) => {
    p.cards[0].size.width = 360;
    p.cards[0].extensions['card-atlas:appearance'].radius = 40;
  });
  const portable = stage(serialize(s.project, s.viewport));
  assert.equal(portable.project.cards[0].extensions['card-atlas:appearance'].radius, 40);
  s.undo();
  assert.equal(s.project.cards[0].extensions['card-atlas:appearance'].radius, 24);
  s.redo();
  assert.equal(s.project.cards[0].size.width, 360);
  for (const bad of [
    { radius: -1 },
    { radius: 101 },
    { borderWidth: 9 },
    { titleFontSize: 100 },
    { align: 'evil' },
    { shadow: 'url(x)' },
    { css: 'position:fixed' },
  ]) {
    p.cards[0].extensions['card-atlas:appearance'] = bad;
    assert.ok(validate(p).errors.some((e) => e.path.includes('card-atlas:appearance')));
  }
});
