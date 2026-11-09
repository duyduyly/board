import { test, expect } from '@playwright/test';
import { projectAction } from './ui-driver.mjs';

const PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const card = (id, x, extra = {}) => ({
  id,
  title: id,
  summary: `${id} summary`,
  content: `# ${id}`,
  position: { x, y: 120 },
  size: { width: 220, height: 150 },
  ...extra,
});

const project = {
  version: '1.0',
  metadata: { title: 'Mind field click' },
  cards: [
    card('root', 30, { summary: '' }),
    card('pinned', 290, {
      extensions: {
        'card-atlas:node': { kind: 'text' },
        'card-atlas:metadata': { pinned: true },
      },
    }),
    card('image', 550, {
      summary: 'Image caption',
      extensions: {
        'card-atlas:node': { kind: 'image', coverImageId: 'cover' },
        'card-atlas:images': { cover: { name: 'c.png', mimeType: 'image/png', data: PIXEL } },
      },
    }),
    card('plain', 30, {
      position: { x: 30, y: 420 },
      title: 'Plain title',
      summary: 'Plain summary',
      extensions: { 'card-atlas:node': { kind: 'text' } },
    }),
    card('compact', 290, {
      position: { x: 290, y: 420 },
      summary: 'Compact summary',
      size: { width: 240, height: 100 },
      extensions: { 'card-atlas:node': { kind: 'text' } },
    }),
  ],
  relations: [],
  extensions: { 'card-atlas:mind-map': { rootId: 'root' } },
};

async function loadMind(page) {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'mind.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-map-view=mind]').click();
}

const field = (page, id, name) => page.locator(`[data-id=${id}] [data-overview-field=${name}]`);

async function expectPopup(page, name, value) {
  await expect(page.locator('#format-inspector')).toBeVisible();
  await expect(page.locator('#overview-field')).toHaveValue(name);
  await expect(page.locator('#overview-text')).toHaveValue(value);
}

test('Mind click on title, summary and image caption opens the matching popup field', async ({
  page,
}) => {
  await loadMind(page);
  await field(page, 'root', 'title').click();
  await expectPopup(page, 'title', 'root');
  await page.locator('[data-overview-cancel]').click();
  await expect(field(page, 'root', 'summary')).toHaveCount(0);
  await field(page, 'image', 'summary').click();
  await expectPopup(page, 'summary', 'Image caption');
  await page.locator('[data-overview-cancel]').click();
  await field(page, 'plain', 'summary').click();
  await expectPopup(page, 'summary', 'Plain summary');
  await page.locator('[data-overview-cancel]').click();
  await field(page, 'compact', 'summary').click();
  await expectPopup(page, 'summary', 'Compact summary');
});

test('Mind summary edit applies as one undoable command', async ({ page }) => {
  await loadMind(page);
  await field(page, 'plain', 'summary').click();
  await page.locator('#overview-text').fill('Edited summary');
  await page.locator('[data-overview-apply]').click();
  await expect(field(page, 'plain', 'summary')).toHaveText('Edited summary');
  await page.locator('[data-action=undo]').click();
  await expect(field(page, 'plain', 'summary')).toHaveText('Plain summary');
});

test('Mind Enter and Space on a field open the popup; Enter on the card opens Detail', async ({
  page,
}) => {
  await loadMind(page);
  const summary = field(page, 'plain', 'summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expectPopup(page, 'summary', 'Plain summary');
  await page.locator('[data-overview-cancel]').click();
  await expect(page.locator('#detail-panel')).toBeHidden();
  await field(page, 'plain', 'title').focus();
  await page.keyboard.press('Space');
  await expectPopup(page, 'title', 'Plain title');
  await page.locator('[data-overview-cancel]').click();
  await page.locator('[data-id=plain]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detail-panel')).toBeVisible();
});

test('Mind double-click on text opens Detail', async ({ page }) => {
  await loadMind(page);
  await field(page, 'plain', 'summary').dblclick();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(page.locator('#panel-body .markdown')).toContainText('plain');
});

test('pinned Mind node opens read-only Detail instead of the popup', async ({ page }) => {
  await loadMind(page);
  await field(page, 'pinned', 'title').click();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(page.locator('#overview-text')).not.toBeVisible();
  await expect(field(page, 'pinned', 'title')).toHaveAttribute('aria-label', /.+/);
  await expect(page.locator('#panel-body .markdown')).toBeVisible();
});

test('aria-label of an editable Mind field names the edit action', async ({ page }) => {
  await loadMind(page);
  const label = await field(page, 'plain', 'summary').getAttribute('aria-label');
  expect(label).toContain('Plain summary');
  const pinnedLabel = await field(page, 'pinned', 'summary').getAttribute('aria-label');
  expect(pinnedLabel).not.toContain('pinned summary');
});

test('layout preview locks the canvas: click on text opens no popup in Mind', async ({ page }) => {
  await loadMind(page);
  await projectAction(page, 'layout');
  await expect(page.locator('#layout-preview-bar')).toBeVisible();
  await field(page, 'plain', 'summary').click({ force: true });
  await expect(page.locator('#overview-text')).toBeHidden();
  await expect(page.locator('#detail-panel')).toBeHidden();
});

test('dirty popup draft is guarded: Cancel keeps the draft', async ({ page }) => {
  await loadMind(page);
  await field(page, 'root', 'title').click();
  await page.locator('#overview-text').fill('Dirty root');
  await page.locator('[data-overview-cancel]').click();
  await expect(field(page, 'root', 'title')).toHaveText('root');
});

test('Note Board click on summary still opens the popup', async ({ page }) => {
  await loadMind(page);
  await page.locator('[data-map-view=card]').click();
  await field(page, 'plain', 'summary').click();
  await expectPopup(page, 'summary', 'Plain summary');
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 800 },
])
  for (const locale of ['vi', 'en'])
    for (const theme of ['light', 'dark'])
      test(`Mind hint does not overlap canvas hint ${viewport.width} ${locale} ${theme}`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.goto('/');
        await page.locator('#locale').selectOption(locale);
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value;
        }, theme);
        await page.locator('#file-input').setInputFiles('assets/data/mind-map-example.json');
        await page.locator('[data-choice=apply]').click();
        await page.locator('[data-map-view=mind]').click();
        const banner = page.locator('#mind-view-banner');
        await expect(banner).toBeVisible();
        await expect(banner).toContainText(
          locale === 'vi' ? 'bấm chữ để sửa' : 'click text to edit',
        );
        const hint = page.locator('.canvas-hint');
        if (await hint.isVisible()) {
          const a = await hint.boundingBox();
          const b = await banner.boundingBox();
          const overlap =
            a.x < b.x + b.width &&
            b.x < a.x + a.width &&
            a.y < b.y + b.height &&
            b.y < a.y + a.height;
          expect(overlap).toBe(false);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          viewport.width,
        );
      });
