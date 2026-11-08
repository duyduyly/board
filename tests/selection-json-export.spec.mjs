import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const state = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return {
      project: JSON.stringify(store.project),
      dirty: store.dirty,
      undo: store.undoStack.length,
      redo: store.redoStack.length,
      selected: [...document.querySelectorAll('.graph-card.selected')]
        .map((el) => el.dataset.id)
        .sort(),
    };
  });

async function loadProject(page, extensions) {
  const image = (await readFile('tests/fixtures/english-endings.png')).toString('base64');
  const cards = [
    {
      id: 'a',
      title: 'A',
      content: '',
      position: { x: 0, y: 0 },
      extensions: {
        'card-atlas:images': { sample: { name: 'sample.png', mimeType: 'image/png', data: image } },
        'card-atlas:document': {
          version: 1,
          format: 'html-bs5',
          components: [
            { tag: 'img', attributes: { src: 'attachment:sample', alt: 'image' }, children: [] },
          ],
        },
      },
    },
    {
      id: 'b',
      title: 'B pinned',
      content: '',
      position: { x: 320, y: 0 },
      extensions: { 'card-atlas:metadata': { pinned: true } },
    },
    { id: 'c', title: 'Outside', content: '', position: { x: 0, y: 440 } },
  ];
  const project = {
    version: '1.0',
    metadata: { title: 'Selection export' },
    cards,
    relations: [
      { id: 'ab', source: 'a', target: 'b' },
      { id: 'bc', source: 'b', target: 'c' },
    ],
    ...(extensions ? { extensions } : {}),
  };
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'source.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-action=fit]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
  return image;
}

async function marqueePair(page) {
  const a = await page.locator('.graph-card[data-id=a]').boundingBox();
  const b = await page.locator('.graph-card[data-id=b]').boundingBox();
  await page.keyboard.down('Shift');
  await page.mouse.move(b.x + b.width + 10, b.y + b.height + 10);
  await page.mouse.down();
  await page.mouse.move(a.x - 10, a.y - 10, { steps: 12 });
  await expect(page.locator('.selection-marquee')).toBeVisible();
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.locator('.graph-card.selected')).toHaveCount(2);
  await expect(page.locator('.graph-card[data-id=a]')).toHaveClass(/selected/);
  await expect(page.locator('.graph-card[data-id=b]')).toHaveClass(/selected/);
  await expect(page.locator('.graph-card[data-id=c]')).not.toHaveClass(/selected/);
}

function expectSelection(payload, image) {
  expect(payload.version).toBe('1.0');
  expect(payload.cards.map((card) => card.id).sort()).toEqual(['a', 'b']);
  expect(payload.relations.map((relation) => relation.id)).toEqual(['ab']);
  expect(
    payload.cards.find((card) => card.id === 'b').extensions['card-atlas:metadata'].pinned,
  ).toBe(true);
  expect(
    payload.cards.find((card) => card.id === 'a').extensions['card-atlas:images'].sample.data,
  ).toBe(image);
}

for (const [locale, width] of [
  ['vi', 1440],
  ['en', 390],
]) {
  test(`marquee selection copies and downloads valid JSON without changing project (${locale}, ${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.__selectionClipboard = text;
          },
        },
      });
    });
    const image = await loadProject(page);
    if (locale === 'en') await page.locator('#locale').selectOption('en');
    await marqueePair(page);
    const before = await state(page);
    await page.locator('#selection-json > summary').click();
    await expect(page.locator('[data-action=selection-copy-json]')).toBeVisible();
    await page.locator('[data-action=selection-copy-json]').click();
    const clipboard = await page.evaluate(() => window.__selectionClipboard);
    expectSelection(JSON.parse(clipboard), image);
    expect(await state(page)).toEqual(before);
    if (!(await page.locator('#selection-json').evaluate((el) => el.open)))
      await page.locator('#selection-json > summary').click();
    const pending = page.waitForEvent('download');
    await page.locator('[data-action=selection-download-json]').click();
    const download = await pending;
    expect(download.suggestedFilename()).toMatch(/-selection\.json$/);
    expect(await download.failure()).toBeNull();
    const path = await download.path();
    const exported = JSON.parse(await readFile(path, 'utf8'));
    expectSelection(exported, image);
    expect(exported).toEqual(JSON.parse(clipboard));
    expect(await state(page)).toEqual(before);
    await page.locator('#file-input').setInputFiles(path);
    await page.locator('[data-choice=apply]').click();
    await page.locator('[data-choice=replace]').click();
    await expect
      .poll(async () =>
        page.evaluate(async () =>
          (await import('/assets/js/app.js')).store.project.cards.map((card) => card.id).sort(),
        ),
      )
      .toEqual(['a', 'b']);
    const roundtrip = await page.evaluate(
      async () => (await import('/assets/js/app.js')).store.project,
    );
    expectSelection(roundtrip, image);
  });
}

test('clipboard failure preserves selection, history and project', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          window.__selectionCopyAttempted = true;
          throw new Error('denied');
        },
      },
    });
  });
  await loadProject(page);
  await marqueePair(page);
  const before = await state(page);
  await page.locator('#selection-json > summary').click();
  await page.locator('[data-action=selection-copy-json]').click();
  await expect.poll(() => page.evaluate(() => window.__selectionCopyAttempted)).toBe(true);
  await expect(page.locator('.toast')).toBeVisible();
  await expect(page.locator('.toast')).toContainText('Không thể sao chép');
  expect(await state(page)).toEqual(before);
});

test('Mind Map marquee exports the selected cards and internal links', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__selectionClipboard = text;
        },
      },
    });
  });
  const image = await loadProject(page, { 'card-atlas:mind-map': { rootId: 'a' } });
  await page.locator('[data-map-view=mind]').click();
  await page.locator('[data-action=fit]').click();
  await marqueePair(page);
  const before = await state(page);
  await page.locator('#selection-json > summary').click();
  await page.locator('[data-action=selection-copy-json]').click();
  const exported = JSON.parse(await page.evaluate(() => window.__selectionClipboard));
  expectSelection(exported, image);
  expect(exported.extensions['card-atlas:mind-map'].rootId).toBe('a');
  expect(await state(page)).toEqual(before);
});

test('native Chromium clipboard contains the selected project JSON', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Clipboard permissions are unavailable in Firefox automation',
  );
  await page
    .context()
    .grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:4173' });
  const image = await loadProject(page, { 'example:project': { extra: true } });
  await marqueePair(page);
  const before = await state(page);
  await page.locator('#selection-json > summary').click();
  await page.locator('[data-action=selection-copy-json]').click();
  await expect(page.locator('#modal')).toContainText('example:project');
  await page.locator('#modal [data-choice=continue]').click();
  let clipboard = '';
  await expect
    .poll(async () => {
      clipboard = await page.evaluate(() => navigator.clipboard.readText());
      return clipboard;
    })
    .toContain('"cards"');
  expectSelection(JSON.parse(clipboard), image);
  expect(await state(page)).toEqual(before);
});

test('partial group and project extension require confirmation before copying', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__selectionClipboard = text;
        },
      },
    });
  });
  const image = await loadProject(page, {
    'card-atlas:groups': {
      groups: [{ id: 'partial', title: 'Partial group', cardIds: ['a', 'c'] }],
    },
    'example:project': { data: 'keep in source project' },
  });
  await marqueePair(page);
  const before = await state(page);
  await page.locator('#selection-json > summary').click();
  await page.locator('[data-action=selection-copy-json]').click();
  await expect(page.locator('#modal [data-choice=continue]')).toBeVisible();
  await expect(page.locator('#modal')).toContainText('1 nhóm');
  await expect(page.locator('#modal')).toContainText('example:project');
  await page.locator('#modal [data-choice=cancel]').click();
  expect(await page.evaluate(() => window.__selectionClipboard)).toBeUndefined();
  expect(await state(page)).toEqual(before);
  if (!(await page.locator('#selection-json').evaluate((el) => el.open)))
    await page.locator('#selection-json > summary').click();
  await page.locator('[data-action=selection-copy-json]').click();
  await page.locator('#modal [data-choice=continue]').click();
  const exported = JSON.parse(await page.evaluate(() => window.__selectionClipboard));
  expectSelection(exported, image);
  expect(exported.extensions?.['example:project']).toBeUndefined();
  expect(exported.extensions?.['card-atlas:groups']?.groups).toContainEqual({
    id: 'partial',
    title: 'Partial group',
    cardIds: ['a'],
  });
  expect(await state(page)).toEqual(before);
});

test('marquee around one card exposes JSON menu, Escape closes it without clearing, and copy works at 320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__selectionClipboard = text;
        },
      },
    });
  });
  const image = await loadProject(page);
  const a = await page.locator('.graph-card[data-id=a]').boundingBox();
  await page.keyboard.down('Shift');
  await page.mouse.move(a.x + a.width + 5, a.y + a.height + 5);
  await page.mouse.down();
  await page.mouse.move(a.x - 5, a.y - 5, { steps: 12 });
  await expect(page.locator('.selection-marquee')).toBeVisible();
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.locator('.graph-card.selected')).toHaveCount(1);
  await expect(page.locator('.graph-card[data-id=a]')).toHaveClass(/selected/);
  await expect(page.locator('#selection-tools')).toBeVisible();
  const before = await state(page);
  await page.locator('#selection-json > summary').click();
  const menu = page.locator('.selection-json-menu');
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  await page.screenshot({ path: join(tmpdir(), 'board-selection-json-320.png') });
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  expect(await state(page)).toEqual(before);
  await page.locator('#selection-json > summary').click();
  await page.locator('[data-action=selection-copy-json]').click();
  const exported = JSON.parse(await page.evaluate(() => window.__selectionClipboard));
  expect(exported.cards.map((card) => card.id)).toEqual(['a']);
  expect(exported.relations).toEqual([]);
  expect(exported.cards[0].extensions['card-atlas:images'].sample.data).toBe(image);
  expect(await state(page)).toEqual(before);
});
