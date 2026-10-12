import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { stage, validate } from '../assets/js/json/validator.js';
import { ProjectStore } from '../assets/js/store/project-store.js';
import { NODE, MIND, VIEWS, geometry } from '../assets/js/graph/mind-map.js';
import { APPEARANCE } from '../assets/js/detail/appearance.js';
import { IMAGE_NAMESPACE } from '../assets/js/detail/attachments.js';
import { markdownDocument } from '../assets/js/detail/writing.js';
import {
  decodeDocument,
  stageMarkdown,
  markdownCandidate,
} from '../assets/js/detail/markdown-import.js';
import {
  nodeFile,
  stageNode,
  mergeNode,
  extensionConflicts,
  updateNodeProject,
  addNodeProject,
} from '../assets/js/json/node-transfer.js';

const fixture = stage(await fs.readFile('assets/data/mind-map-example.json', 'utf8')).project;
const image = (name = 'image.gif') => ({
  name,
  mimeType: 'image/gif',
  data: 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
});
function setup() {
  const project = structuredClone(fixture),
    card = project.cards[0];
  card.extensions = {
    ...card.extensions,
    [NODE]: { kind: 'image-text', coverImageId: 'cover' },
    [IMAGE_NAMESPACE]: { cover: image(), used: image('used.gif'), unused: image('unused.gif') },
    'test:extra': { source: 'kept' },
  };
  card.content = '![Photo](attachment:used)';
  project.extensions[VIEWS] ||= { mindMap: {} };
  project.extensions[VIEWS].mindMap.sizes = {
    [card.id]: { width: 300, height: 220 },
    [project.cards[1].id]: { width: 260, height: 100 },
  };
  assert.deepEqual(validate(project).errors, []);
  return { project, card };
}
test('portable node filters graph refs, preserves card namespaces and gates unknown project exclusions', () => {
  const { project, card } = setup();
  project.extensions['test:project'] = { ref: project.cards[1].id };
  const before = JSON.stringify(project);
  assert.throws(() => nodeFile(project, card), /transferAcknowledge/);
  const result = stageNode(nodeFile(project, card, { excludeUnknown: true })).project;
  assert.equal(result.cards.length, 1);
  assert.deepEqual(result.relations, []);
  assert.deepEqual(result.cards[0], card);
  assert.deepEqual(result.extensions[MIND], { rootId: card.id });
  assert.deepEqual(Object.keys(result.extensions[VIEWS].mindMap.sizes), [card.id]);
  assert.equal(result.extensions['test:project'], undefined);
  assert.equal(JSON.stringify(project), before);
  const other = stageNode(nodeFile(project, project.cards[1], { excludeUnknown: true })).project;
  assert.equal(other.extensions?.[MIND], undefined);
});
test('attachment export keeps all by default, prunes only on request, fails dangling refs', () => {
  const { project, card } = setup();
  const all = stageNode(nodeFile(project, card)).project.cards[0];
  assert.equal(Object.keys(all.extensions[IMAGE_NAMESPACE]).length, 3);
  const pruned = stageNode(nodeFile(project, card, { includeUnused: false })).project.cards[0];
  assert.deepEqual(Object.keys(pruned.extensions[IMAGE_NAMESPACE]), ['cover', 'used']);
  card.content += ' ![Missing](attachment:absent)';
  assert.throws(() => nodeFile(project, card), /transferMissingImage/);
  card.content = '![Malformed](attachment:cover.bad)';
  assert.throws(() => nodeFile(project, card), /transferMissingImage/);
  card.content = '![Empty](attachment:)';
  assert.throws(() => nodeFile(project, card), /transferMissingImage/);
});
test('staging accepts legacy one-card normalized JSON and rejects graph or unknown contract fields', () => {
  const legacy = stageNode(
    JSON.stringify({ version: '1.0', cards: [{ id: 'legacy', title: 'Old' }], relations: [] }),
  );
  assert.equal(legacy.project.cards[0].content, '');
  assert.ok(legacy.adjustments.length);
  assert.throws(() => stageNode(JSON.stringify(fixture)), /transferOneCard/);
  assert.throws(() => stageNode('{'), /transferInvalid/);
  assert.throws(
    () =>
      stageNode(
        JSON.stringify({
          version: '1.0',
          cards: [{ id: 'a', title: 'A', bogus: true }],
          relations: [],
        }),
      ),
    /transferInvalid/,
  );
});
test('merge remaps collisions while preserving cover, kind, appearance and unknown extension conflicts', () => {
  const { card } = setup(),
    incoming = structuredClone(card);
  incoming.id = 'foreign';
  incoming.title = 'Imported';
  incoming.style.backgroundColor = '#112233';
  incoming.extensions[IMAGE_NAMESPACE].cover = image('different.gif');
  incoming.extensions[NODE] = { kind: 'image', coverImageId: 'cover' };
  incoming.extensions[APPEARANCE] = { radius: 32 };
  incoming.extensions['test:extra'] = { source: 'incoming' };
  incoming.extensions['test:new'] = { enabled: true };
  incoming.content = '![Cover](attachment:cover)';
  const before = JSON.stringify(card);
  assert.deepEqual(extensionConflicts(card, incoming), ['test:extra']);
  const merged = mergeNode(card, incoming);
  assert.equal(merged.card.id, card.id);
  assert.equal(merged.card.extensions[NODE].kind, 'image-text');
  assert.equal(merged.card.extensions[NODE].coverImageId, 'cover');
  assert.equal(merged.card.extensions[IMAGE_NAMESPACE].cover.name, 'image.gif');
  assert.equal(merged.card.content, '![Cover](attachment:cover-import-1)');
  assert.deepEqual(merged.card.extensions['test:extra'], { source: 'kept' });
  assert.deepEqual(merged.card.extensions['test:new'], { enabled: true });
  assert.deepEqual(merged.card.style, card.style);
  const formatted = mergeNode(card, incoming, { takeFormat: true, takeUnknown: true }).card;
  assert.equal(formatted.extensions[NODE].coverImageId, 'cover-import-1');
  assert.equal(formatted.extensions[NODE].kind, 'image');
  assert.equal(formatted.extensions[APPEARANCE].radius, 32);
  assert.deepEqual(formatted.extensions['test:extra'], { source: 'incoming' });
  assert.equal(JSON.stringify(card), before);
});
test('Update/format changes only active view size, preserves relations and undoes atomically', () => {
  const { project, card } = setup();
  const source = stageNode(nodeFile(project, card)).project;
  source.cards[0].title = 'Changed';
  source.cards[0].size = { width: 500, height: 360 };
  source.extensions[VIEWS].mindMap.sizes[card.id] = { width: 420, height: 240 };
  const merged = mergeNode(card, source.cards[0], { takeFormat: true }).card;
  const next = updateNodeProject(project, card.id, merged, source, 'mind', true);
  assert.deepEqual(next.relations, project.relations);
  assert.deepEqual(next.cards[0].position, card.position);
  assert.deepEqual(next.cards[0].size, card.size);
  assert.deepEqual(geometry(next, next.cards[0], 'mind').size, { width: 420, height: 240 });
  const store = new ProjectStore();
  store.replace(project);
  store.commit((p) => Object.assign(p, next));
  assert.equal(store.undoStack.length, 1);
  store.undo();
  assert.deepEqual(store.project, project);
  store.redo();
  assert.deepEqual(store.project, next);
  const cardView = updateNodeProject(project, card.id, merged, source, 'card', true);
  assert.deepEqual(cardView.cards[0].size, source.cards[0].size);
  assert.deepEqual(cardView.extensions[VIEWS], project.extensions[VIEWS]);
});
test('Add makes independent ID/geometry without root/branch and rejects graph capacity before commit', () => {
  const { project, card } = setup();
  const source = stageNode(nodeFile(project, card)).project;
  const added = addNodeProject(project, source, 'new-id', 'mind', { x: 33, y: 44 });
  assert.equal(added.cards.at(-1).id, 'new-id');
  assert.deepEqual(added.relations, project.relations);
  assert.deepEqual(added.extensions[MIND], project.extensions[MIND]);
  assert.deepEqual(geometry(added, added.cards.at(-1), 'mind').position, { x: 33, y: 44 });
  assert.equal(
    added.cards.at(-1).extensions[IMAGE_NAMESPACE].cover.data,
    card.extensions[IMAGE_NAMESPACE].cover.data,
  );
  assert.throws(
    () => addNodeProject(project, source, card.id, 'card', { x: 0, y: 0 }),
    /transferInvalid/,
  );
  const full = {
    ...project,
    cards: Array.from({ length: 500 }, (_, i) => ({ ...structuredClone(card), id: 'full-' + i })),
    relations: [],
    extensions: {},
  };
  assert.throws(
    () => addNodeProject(full, source, 'overflow', 'card', { x: 0, y: 0 }),
    /transferInvalid/,
  );
});
test('Markdown UTF8/limits fail closed; relative/reference images listed, code ignored and unsafe source preserved', () => {
  assert.equal(decodeDocument(new TextEncoder().encode('Tiếng Việt')), 'Tiếng Việt');
  assert.throws(() => decodeDocument(new Uint8Array([0xc3, 0x28])), /transferEncoding/);
  const { card } = setup();
  const text =
    '![Local][pic]\n\n[pic]: ./photos/a.png\n\n![Remote](https://example.org/a.png)\n\n`![Code](./not-an-image.png)`\n\n<script>alert(1)</script>';
  const staged = stageMarkdown(text, card);
  assert.deepEqual(staged.missing, ['./photos/a.png']);
  assert.equal(staged.remote.length, 1);
  assert.equal(markdownCandidate(card, staged).content, text);
  assert.deepEqual(markdownCandidate(card, staged).style, card.style);
  assert.throws(() => stageMarkdown('x'.repeat(100001), card), /transferContentLimit/);
  assert.throws(
    () =>
      markdownCandidate(
        { ...card, content: 'x'.repeat(99999) },
        stageMarkdown('abc', card),
        'append',
      ),
    /transferContentLimit/,
  );
});
test('self-contained Markdown export imports embedded raster into validated attachments without fetching', () => {
  const { card } = setup();
  const exported = markdownDocument(card);
  const staged = stageMarkdown(exported, { ...card, extensions: {} });
  const candidate = markdownCandidate({ ...card, extensions: {} }, staged);
  assert.equal(staged.embedded.length, 1);
  assert.equal(staged.missing.length, 0);
  assert.match(candidate.content, /attachment:markdown-image-1/);
  assert.equal(
    candidate.extensions[IMAGE_NAMESPACE]['markdown-image-1'].data,
    card.extensions[IMAGE_NAMESPACE].used.data,
  );
  assert.throws(
    () => stageMarkdown('![bad](data:image/png;base64,YWJjZA==)', card),
    /errorImageAttachment/,
  );
  const svg = stageMarkdown('![SVG](data:image/svg+xml;base64,PHN2Zz4=)', card);
  assert.equal(svg.embedded.length, 0);
  assert.equal(svg.missing.length, 1);
});

test('portable example round-trips and merged attachments enforce canonical project budget', async () => {
  const example = stageNode(
    await fs.readFile('assets/data/node-transfer-example.json', 'utf8'),
  ).project;
  assert.deepEqual(stageNode(nodeFile(example, example.cards[0])).project.cards, example.cards);
  const { project, card } = setup();
  const payload = gifPayload();
  card.extensions[IMAGE_NAMESPACE].cover.data = payload;
  const source = stageNode(nodeFile(project, card)).project;
  source.cards[0].extensions[IMAGE_NAMESPACE].cover.name = 'collision-large.gif';
  const merged = mergeNode(card, source.cards[0]).card;
  assert.throws(
    () => updateNodeProject(project, card.id, merged, source, 'card', false),
    /transferInvalid/,
  );
  function gifPayload() {
    return image().data + 'A'.repeat(5 * 1024 * 1024);
  }
});
