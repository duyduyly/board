import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { projectAction, theme, view } from './ui-driver.mjs';
const gif = {
  name: 'cover.gif',
  mimeType: 'image/gif',
  data: 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
};
const imageNS = 'card-atlas:images',
  nodeNS = 'card-atlas:node',
  viewsNS = 'card-atlas:views';
const readProject = (page) =>
  page.evaluate(async () => (await import('/assets/js/app.js')).store.project);
async function start(page, fixture = null) {
  await page.goto('/');
  if (fixture) {
    await page.locator('#file-input').setInputFiles({
      name: 'fixture.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
    await page.locator('[data-choice=apply]').click();
  } else await page.locator('[data-template=architecture]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
  await page.locator('.card-row[data-card-id=card-user-service]').click();
}
async function tools(page) {
  if (!(await page.locator('.node-transfer-tools').evaluate((e) => e.open)))
    await page.locator('.node-transfer-tools summary').click();
}
async function upload(page, kind, value) {
  await tools(page);
  await page.locator('#import-' + kind + '-file').setInputFiles({
    name: kind === 'node' ? 'node.json' : 'document.md',
    mimeType: kind === 'node' ? 'application/json' : 'text/markdown',
    buffer: Buffer.isBuffer(value)
      ? value
      : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)),
  });
  await expect(page.locator('#modal')).toBeVisible();
}
async function exportFile(page, draft = false) {
  await tools(page);
  await page.locator('#export-node').click();
  if (draft) await page.locator('#transfer-source').selectOption('draft');
  if (await page.locator('#transfer-acknowledge').count())
    await page.locator('#transfer-acknowledge').check();
  const pending = page.waitForEvent('download');
  await page.locator('[data-choice=accept]').click();
  const download = await pending;
  return JSON.parse(await fs.readFile(await download.path(), 'utf8'));
}
async function imageFixture() {
  const fixture = JSON.parse(await fs.readFile('assets/data/example.json', 'utf8'));
  const card = fixture.cards.find((c) => c.id === 'card-user-service');
  card.content = '![Used](attachment:body)';
  card.extensions = {
    'test:extra': { old: true },
    [nodeNS]: { kind: 'image-text', coverImageId: 'cover' },
    [imageNS]: {
      cover: gif,
      body: {
        name: 'body.png',
        mimeType: 'image/png',
        data: (await fs.readFile('tests/fixtures/english-endings.png')).toString('base64'),
      },
      unused: { ...gif, name: 'unused.gif' },
    },
  };
  return fixture;
}
function incoming(card) {
  const source = structuredClone(card);
  source.id = 'foreign';
  source.title = 'Imported node';
  source.summary = 'Imported summary';
  source.position = { x: 9000, y: 9000 };
  source.size = { width: 420, height: 260 };
  source.style = { backgroundColor: '#123456', textColor: '#FFFFFF', borderColor: '#456789' };
  source.extensions[imageNS].cover = { ...gif, name: 'incoming.gif' };
  source.extensions['card-atlas:appearance'] = { radius: 35 };
  source.extensions['test:extra'] = { new: true };
  source.extensions['test:new'] = { enabled: true };
  source.content = '# Imported\n\n![New cover](attachment:cover)';
  return {
    version: '1.0',
    cards: [source],
    relations: [],
    extensions: { [viewsNS]: { mindMap: { sizes: { foreign: { width: 350, height: 230 } } } } },
  };
}
test('Markdown preview Replace/Append, locale, unsafe source and Apply/Undo', async ({ page }) => {
  const external = [];
  const consoleIssues = [];
  page.on('pageerror', (e) => consoleIssues.push(e.message));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) consoleIssues.push(m.text());
  });
  page.on('request', (r) => {
    if (/evil\.invalid/.test(r.url())) external.push(r.url());
  });
  await start(page);
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('textarea[name=content]').fill('# Existing draft');
  const before = await readProject(page),
    title = await page.locator('input[name=title]').inputValue();
  const text =
    '# Imported tiếng Việt\n\n![Local][pic]\n\n[pic]: ./photo.png\n\n![Remote](https://evil.invalid/a.png)\n\n<script>window.bad=1</script>\n\n```mermaid\nflowchart LR\n A-->B\n```';
  await upload(page, 'markdown', text);
  await expect(page.locator('#modal')).toHaveAccessibleName('Xem trước Markdown');
  await expect(page.locator('.transfer-warning')).toContainText(['./photo.png', 'evil.invalid']);
  await expect(page.locator('.transfer-preview .diagram svg')).toBeVisible();
  await expect(page.locator('[data-choice=accept]')).toBeInViewport();
  await page.screenshot({ path: 'planning/design/feedback-02-markdown-preview.png' });
  await page.setViewportSize({ width: 1050, height: 900 });
  await expect(page.locator('[data-choice=accept]')).toBeInViewport();
  expect(
    await page.evaluate(
      () =>
        document.querySelector('#modal').scrollWidth <=
        document.querySelector('#modal').clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: 'planning/design/feedback-02-markdown-1050.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press('Escape');
  await expect(page.locator('textarea[name=content]')).toHaveValue('# Existing draft');
  await upload(page, 'markdown', text);
  await page.locator('#transfer-md-mode').selectOption('append');
  await page.locator('#modal-locale').selectOption('en');
  await expect(page.locator('#transfer-md-mode')).toHaveValue('append');
  await page.locator('[data-choice=accept]').click();
  await expect(page.locator('textarea[name=content]')).toHaveValue('# Existing draft\n\n' + text);
  await expect(page.locator('input[name=title]')).toHaveValue(title);
  expect(await readProject(page)).toEqual(before);
  expect(external).toEqual([]);
  expect(consoleIssues).toEqual([]);
  expect(await page.evaluate(() => window.bad)).toBeUndefined();
  await page.locator('.editor button[type=submit]').click();
  expect(
    (await readProject(page)).cards.find((c) => c.id === 'card-user-service').content,
  ).toContain('Imported tiếng Việt');
  await projectAction(page, 'undo');
  expect(await readProject(page)).toEqual(before);
});
test('Markdown bad UTF8, limits and append overflow leave draft/model unchanged', async ({
  page,
}) => {
  await start(page);
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('textarea[name=content]').fill('Keep draft');
  const before = await readProject(page);
  for (const bytes of [
    Buffer.from([0xc3, 0x28]),
    Buffer.from('x'.repeat(100001)),
    Buffer.alloc(10 * 1024 * 1024 + 1, 120),
  ]) {
    await upload(page, 'markdown', bytes);
    await expect(page.locator('#modal h2')).toContainText('Không thể');
    await page.locator('[data-choice=cancel]').click();
    await expect(page.locator('textarea[name=content]')).toHaveValue('Keep draft');
  }
  await page.locator('textarea[name=content]').fill('x'.repeat(99999));
  await upload(page, 'markdown', 'abc');
  await page.locator('#transfer-md-mode').selectOption('append');
  await expect(page.locator('[data-choice=accept]')).toBeDisabled();
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('textarea[name=content]')).toHaveValue('x'.repeat(99999));
  expect(await readProject(page)).toEqual(before);
});
test('Node export applied/draft, project exclusion consent and unused image option', async ({
  page,
}) => {
  const fixture = await imageFixture();
  fixture.extensions = { 'test:project': { foreignRef: 'card-user-api' } };
  await start(page, fixture);
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('input[name=title]').fill('Unapplied title');
  const before = await readProject(page);
  await tools(page);
  await page.locator('#export-node').click();
  await expect(page.locator('[data-choice=accept]')).toBeDisabled();
  await page.screenshot({ path: 'planning/design/feedback-02-node-export.png' });
  await page.locator('[data-choice=cancel]').click();
  const applied = await exportFile(page),
    draft = await exportFile(page, true);
  expect(applied.cards[0].title).toBe('User Service');
  expect(draft.cards[0].title).toBe('Unapplied title');
  expect(applied.cards).toHaveLength(1);
  expect(applied.relations).toEqual([]);
  expect(applied.extensions?.['test:project']).toBeUndefined();
  expect(applied.cards[0].extensions['test:extra']).toEqual({ old: true });
  expect(Object.keys(applied.cards[0].extensions[imageNS])).toHaveLength(3);
  await tools(page);
  await page.locator('#export-node').click();
  await page.locator('#transfer-acknowledge').check();
  await page.locator('#transfer-unused').uncheck();
  const wait = page.waitForEvent('download');
  await page.locator('[data-choice=accept]').click();
  const pruned = JSON.parse(await fs.readFile(await (await wait).path(), 'utf8'));
  expect(Object.keys(pruned.cards[0].extensions[imageNS])).toEqual(['cover', 'body']);
  expect(await readProject(page)).toEqual(before);
  await expect(page.locator('input[name=title]')).toHaveValue('Unapplied title');
});
test('Node Update remaps image collision and preserves cover/geometry/relations with one Apply undo', async ({
  page,
}) => {
  const fixture = await imageFixture();
  await start(page, fixture);
  const before = await readProject(page),
    current = before.cards.find((c) => c.id === 'card-user-service'),
    source = incoming(current);
  await upload(page, 'node', source);
  await expect(page.locator('.transfer-result')).toContainText('cover-import-1');
  await page.screenshot({ path: 'planning/design/feedback-02-node-preview.png' });
  await page.locator('#modal-locale').selectOption('en');
  await page.locator('[data-choice=accept]').click();
  expect(await readProject(page)).toEqual(before);
  await expect(page.locator('input[name=title]')).toHaveValue('Imported node');
  await page.locator('.editor button[type=submit]').click();
  const after = await readProject(page),
    updated = after.cards.find((c) => c.id === current.id);
  expect(updated.position).toEqual(current.position);
  expect(updated.size).toEqual(current.size);
  expect(updated.style).toEqual(current.style);
  expect(after.relations).toEqual(before.relations);
  expect(updated.extensions[nodeNS].coverImageId).toBe('cover');
  expect(updated.extensions[imageNS].cover.name).toBe('cover.gif');
  expect(updated.content).toContain('attachment:cover-import-1');
  expect(updated.extensions['test:extra']).toEqual({ old: true });
  expect(updated.extensions['test:new']).toEqual({ enabled: true });
  await projectAction(page, 'undo');
  expect(await readProject(page)).toEqual(before);
  await projectAction(page, 'redo');
  expect(await readProject(page)).toEqual(after);
});
test('Node format opt-in affects only active view and explicitly replaces conflicting extensions', async ({
  page,
}) => {
  await start(page, await imageFixture());
  await view(page, 'mind');
  const before = await readProject(page),
    current = before.cards.find((c) => c.id === 'card-user-service');
  await theme(page);
  await upload(page, 'node', incoming(current));
  await page.locator('#transfer-format').check();
  await page.locator('#transfer-unknown').check();
  await page.screenshot({ path: 'planning/design/feedback-02-node-preview-dark.png' });
  await page.locator('[data-choice=accept]').click();
  await page.locator('.editor button[type=submit]').click();
  const after = await readProject(page),
    card = after.cards.find((c) => c.id === current.id);
  expect(card.size).toEqual(current.size);
  expect(card.position).toEqual(current.position);
  expect(after.extensions[viewsNS].mindMap.sizes[current.id]).toEqual({ width: 350, height: 230 });
  expect(card.extensions[nodeNS].coverImageId).toBe('cover-import-1');
  expect(card.extensions['card-atlas:appearance'].radius).toBe(35);
  expect(card.extensions['test:extra']).toEqual({ new: true });
  await projectAction(page, 'undo');
  expect(await readProject(page)).toEqual(before);
});
test('Node Add preview then draft guard Cancel/Discard, independent ID and atomic undo', async ({
  page,
}) => {
  await start(page, await imageFixture());
  const before = await readProject(page),
    source = incoming(before.cards[1]);
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('textarea[name=content]').fill('Keep dirty draft');
  await upload(page, 'node', source);
  await page.locator('#transfer-node-mode').selectOption('add');
  await expect(page.locator('#transfer-format')).toBeDisabled();
  await page.locator('[data-choice=accept]').click();
  await page.locator('[data-choice=cancel]').click();
  expect(await readProject(page)).toEqual(before);
  await expect(page.locator('textarea[name=content]')).toHaveValue('Keep dirty draft');
  await upload(page, 'node', source);
  await page.locator('#transfer-node-mode').selectOption('add');
  await page.locator('[data-choice=accept]').click();
  await page.locator('[data-choice=discard]').click();
  const after = await readProject(page);
  expect(after.cards).toHaveLength(4);
  expect(after.relations).toEqual(before.relations);
  const added = after.cards.at(-1);
  expect(added.id).not.toBe('foreign');
  expect(added.position).not.toEqual(source.cards[0].position);
  expect(added.title).toBe('Imported node');
  await projectAction(page, 'undo');
  expect(await readProject(page)).toEqual(before);
  await projectAction(page, 'redo');
  expect(await readProject(page)).toEqual(after);
});
test('Node invalid/dangling files preserve draft and project, unknown project import requires consent', async ({
  page,
}) => {
  await start(page, await imageFixture());
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('textarea[name=content]').fill('Keep');
  const before = await readProject(page),
    source = incoming(before.cards[1]);
  const dangling = structuredClone(source);
  dangling.cards[0].content = '![Missing](attachment:not-there)';
  const malformed = structuredClone(source);
  malformed.cards[0].content = '![Wrong ID](attachment:cover.bad)';
  for (const invalid of ['{', before, dangling, malformed]) {
    await upload(page, 'node', invalid);
    await expect(page.locator('#modal h2')).toContainText('Không thể');
    await page.locator('[data-choice=cancel]').click();
    await expect(page.locator('textarea[name=content]')).toHaveValue('Keep');
    expect(await readProject(page)).toEqual(before);
  }
  source.extensions['test:project'] = { secret: 'do not merge' };
  await upload(page, 'node', source);
  await expect(page.locator('[data-choice=accept]')).toBeDisabled();
  await page.locator('#transfer-acknowledge').check();
  await expect(page.locator('[data-choice=accept]')).toBeEnabled();
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('textarea[name=content]')).toHaveValue('Keep');
  expect(await readProject(page)).toEqual(before);
});
test('Self-contained Markdown images reimport offline and imported draft recovers only with opt-in', async ({
  page,
}) => {
  const requests = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('data:'))
      requests.push(r.url());
  });
  await start(page, await imageFixture());
  await page.locator('#panel-tabs button').nth(1).click();
  const download = page.waitForEvent('download');
  await page.locator('#download-markdown').click();
  const text = await fs.readFile(await (await download).path(), 'utf8');
  await upload(page, 'markdown', text);
  await page.locator('[data-choice=accept]').click();
  await expect(page.locator('textarea[name=content]')).toHaveValue(/attachment:markdown-image-/);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await projectAction(page, 'recovery');
  await page.locator('[data-choice=enable]').click();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await (await import('/assets/js/store/recovery.js')).readRecovery())?.draft?.content,
      ),
    )
    .toMatch(/attachment:markdown-image-/);
  page.on('dialog', (d) => d.accept());
  await page.reload();
  await page.locator('[data-choice=restore]').click();
  await expect(page.locator('textarea[name=content]')).toHaveValue(/attachment:markdown-image-/);
  await page.locator('.editor button[type=submit]').click();
  await page.locator('#panel-tabs button').nth(0).click();
  await expect(page.locator('.markdown img')).toBeVisible();
  expect(requests).toEqual([]);
  await projectAction(page, 'recovery');
  await page.locator('[data-choice=disable]').click();
  await expect.poll(() => page.evaluate(() => localStorage.length)).toBe(0);
});

test('Async file read refuses stale drafts and Format Guide downloads standalone example', async ({
  page,
}) => {
  await start(page);
  await page.locator('#panel-tabs button').nth(1).click();
  const before = await readProject(page);
  await tools(page);
  await page.evaluate(() => {
    const original = window.File.prototype.arrayBuffer;
    window.File.prototype.arrayBuffer = async function () {
      await new Promise((resolve) => {
        window.releaseTransferRead = resolve;
      });
      return original.call(this);
    };
  });
  await page.locator('#import-markdown-file').setInputFiles({
    name: 'delayed.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Late content'),
  });
  await expect.poll(() => page.evaluate(() => typeof window.releaseTransferRead)).toBe('function');
  await page.locator('textarea[name=content]').fill('Newer draft');
  await page.evaluate(() => window.releaseTransferRead());
  await expect(page.locator('#modal')).toContainText('đã thay đổi');
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('textarea[name=content]')).toHaveValue('Newer draft');
  expect(await readProject(page)).toEqual(before);
  await projectAction(page, 'format');
  await expect(page.locator('#modal')).toContainText('Trao đổi offline');
  const pending = page.waitForEvent('download');
  await page.locator('#node-example-download').click();
  const example = JSON.parse(await fs.readFile(await (await pending).path(), 'utf8'));
  expect(example.cards).toHaveLength(1);
  expect(example.relations).toEqual([]);
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('textarea[name=content]')).toHaveValue('Newer draft');
});
