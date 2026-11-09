import { test, expect } from '@playwright/test';
import { view } from './ui-driver.mjs';

// T06: card without shape defaults to 6px; shaped rectangle/square stay 2px (rendered 0);
// Mind cards without stored radius keep 20px; stored radius always wins.
const DEFAULT_RADIUS = '6px';
const MIND_DEFAULT_RADIUS = '20px';
const APPEARANCE = 'card-atlas:appearance';

const card = (id, x, y, kind, extensions = {}) => ({
  id,
  title: id,
  summary: id + ' summary',
  content: '# ' + id,
  position: { x, y },
  size: { width: 220, height: 140 },
  extensions: { 'card-atlas:node': { kind }, ...extensions },
});
const project = () => ({
  version: '1.0',
  metadata: { title: 'Default radius' },
  cards: [
    card('paper', 40, 40, 'card'),
    card('text', 300, 40, 'text'),
    card('stored0', 560, 40, 'card', { [APPEARANCE]: { radius: 0 } }),
    card('stored2', 820, 40, 'card', { [APPEARANCE]: { radius: 2 } }),
    card('stored24', 1080, 40, 'card', { [APPEARANCE]: { radius: 24 } }),
    card('rect', 40, 260, 'card', { [APPEARANCE]: { shape: 'rectangle' } }),
    card('square', 300, 260, 'card', { [APPEARANCE]: { shape: 'square' } }),
    card('rounded', 560, 260, 'card', { [APPEARANCE]: { shape: 'rounded' } }),
  ],
  relations: [],
  extensions: { 'card-atlas:mind-map': { rootId: 'paper' } },
});

const radiusOf = (page, id) =>
  page
    .locator('.graph-card[data-id=' + id + ']')
    .evaluate((el) => window.getComputedStyle(el).borderTopLeftRadius);

async function load(page) {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'radius.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project())),
  });
  await page.locator('[data-choice=apply]').click();
  await expect(page.locator('.graph-card[data-id=paper]')).toBeVisible();
}

test('Note Board: unshaped cards default to 6px, stored radius wins, shapes keep their values', async ({
  page,
}) => {
  await load(page);
  await view(page, 'card');
  expect(await radiusOf(page, 'paper')).toBe(DEFAULT_RADIUS);
  expect(await radiusOf(page, 'text')).toBe(DEFAULT_RADIUS);
  expect(await radiusOf(page, 'stored0')).toBe('0px');
  expect(await radiusOf(page, 'stored2')).toBe('2px');
  expect(await radiusOf(page, 'stored24')).toBe('24px');
  // shaped nodes (rectangle/square) are polygons: .shaped-node forces radius 0, never the soft default.
  expect(await radiusOf(page, 'rect')).toBe('0px');
  expect(await radiusOf(page, 'square')).toBe('0px');
});

test('Mind: text keeps 6px, card without stored radius keeps 20px, stored radius wins', async ({
  page,
}) => {
  await load(page);
  await view(page, 'mind');
  expect(await radiusOf(page, 'text')).toBe(DEFAULT_RADIUS);
  expect(await radiusOf(page, 'paper')).toBe(MIND_DEFAULT_RADIUS);
  expect(await radiusOf(page, 'stored0')).toBe('0px');
  expect(await radiusOf(page, 'stored24')).toBe('24px');
});

for (const kind of ['card', 'text', 'image-text'])
  test(`palette ${kind} on Note Board creates a ${DEFAULT_RADIUS} card without storing radius`, async ({
    page,
  }) => {
    await load(page);
    await view(page, 'card');
    const ids = () =>
      page.evaluate(async () =>
        (await import('/assets/js/app.js')).store.project.cards.map((c) => c.id),
      );
    const before = await ids();
    const chooser = kind === 'image-text' ? page.waitForEvent('filechooser') : null;
    await page.locator('[data-palette-kind=' + kind + ']').click();
    if (chooser) await (await chooser).setFiles('tests/fixtures/english-endings.png');
    await expect(page.locator('.graph-card')).toHaveCount(before.length + 1);
    const created = (await ids()).find((id) => !before.includes(id));
    expect(created).toBeTruthy();
    expect(await radiusOf(page, created)).toBe(DEFAULT_RADIUS);
    const stored = await page.evaluate(
      async ([id, key]) =>
        (await import('/assets/js/app.js')).store.project.cards.find((c) => c.id === id)
          .extensions?.[key] ?? {},
      [created, APPEARANCE],
    );
    expect(stored).not.toHaveProperty('radius');
  });

test('Format preview uses the same default radius as the canvas', async ({ page }) => {
  await load(page);
  await view(page, 'card');
  await page.locator('.graph-card[data-id=paper]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(2).click();
  await expect(page.locator('#format-card-preview .graph-card')).toHaveCSS(
    'border-radius',
    DEFAULT_RADIUS,
  );
  await expect(page.locator('[name=appearance-radius]')).toHaveValue('6');
});
