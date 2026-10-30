import { projectAction as toolbarProjectAction } from './ui-driver.mjs';
import { view as switchMapView } from './ui-driver.mjs';
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
test('paper hover stays visual; root conversion uses curved compact nodes and opens shared content', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
  const note = page.locator('[data-id=card-user-service]');
  await note.hover({ position: { x: 15, y: 100 } });
  await expect
    .poll(() => note.evaluate((el) => window.getComputedStyle(el, '::after').transform))
    .toBe('matrix(1, 0, 0, 1, 0, 0)');
  const before = await page.evaluate(async () => (await import('/assets/js/app.js')).store.project);
  await page.locator('#locale').selectOption('en');
  await expect(page.locator('[data-action=convert-mind]')).toHaveText('Convert to Mind Map');
  await toolbarProjectAction(page, 'convert-mind');
  await page.locator('[data-choice=cancel]').click();
  expect(
    await page.evaluate(async () => (await import('/assets/js/app.js')).store.project),
  ).toEqual(before);
  await page.locator('#locale').selectOption('vi');
  await toolbarProjectAction(page, 'convert-mind');
  await page.locator('#mind-convert-root').selectOption('card-user-service');
  await page.locator('[data-choice=apply]').click();
  await expect(page.locator('#map-view')).toHaveAttribute('data-active-view', 'mind');
  await expect(page.locator('#mind-view-banner')).toBeVisible();
  await expect(note).toHaveClass(/mind-node/);
  await expect(note).not.toHaveClass(/paper-note/);
  const state = await page.evaluate(async () => {
    const { adapter, store } = await import('/assets/js/app.js');
    return { p: store.project, curves: adapter.cy.edges().map((e) => e.style('curve-style')) };
  });
  expect(state.p.cards).toEqual(before.cards);
  expect(state.curves.every((x) => x === 'unbundled-bezier')).toBe(true);
  await note.locator('h3').dblclick();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(page.locator('#panel-body .markdown')).toBeVisible();
  await page.locator('[data-action=close]').click();
  await page.screenshot({ path: 'planning/design/separate-mind-map.png' });
  await switchMapView(page, 'card');
  await expect(note).toHaveClass(/paper-note/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await note.hover({ position: { x: 15, y: 100 } });
  expect(
    await note.evaluate((el) => window.getComputedStyle(el, '::after').transitionDuration),
  ).toBe('0s');
  await page.screenshot({ path: 'planning/design/note-curl.png' });
  await page.keyboard.press('Control+z');
  expect(
    await page.evaluate(async () => (await import('/assets/js/app.js')).store.project),
  ).toEqual(before);
});

test('Mind Map image nodes show their cover and double-click opens shared Markdown', async ({
  page,
}) => {
  const image = {
    name: 'cover.png',
    mimeType: 'image/png',
    data: (await fs.readFile('tests/fixtures/english-endings.png')).toString('base64'),
  };
  const p = {
    version: '1.0',
    metadata: { title: 'Image Mind Map' },
    cards: [
      { id: 'root', title: 'Root', position: { x: 0, y: 0 }, size: { width: 260, height: 260 } },
      {
        id: 'image',
        title: 'Image lesson',
        summary: 'Chú thích cho bức ảnh',
        content: '# Image lesson',
        position: { x: 400, y: 0 },
        size: { width: 260, height: 190 },
        extensions: {
          'card-atlas:node': { kind: 'image', coverImageId: 'cover' },
          'card-atlas:images': { cover: image },
        },
      },
    ],
    relations: [{ id: 'r', source: 'root', target: 'image' }],
  };
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'image.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.locator('[data-choice=apply]').click();
  const caption = page.locator('[data-id=image] .card-summary');
  await expect(caption).toHaveText('Chú thích cho bức ảnh');
  await expect(caption).toHaveCSS('text-align', 'center');
  await toolbarProjectAction(page, 'convert-mind');
  await page.locator('[data-choice=apply]').click();
  const node = page.locator('[data-id=image]');
  await expect(caption).toHaveCSS('text-align', 'center');
  const imageBox = await node.locator('.node-image-frame').boundingBox();
  const captionBox = await caption.boundingBox();
  expect(captionBox.y).toBeGreaterThanOrEqual(imageBox.y + imageBox.height);
  await expect(node.locator('.node-image-frame img')).toBeVisible();
  await node.locator('.node-image-frame img').dblclick();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(page.locator('#panel-body .markdown')).toContainText('Image lesson');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[name=content]').fill('# Updated from Mind Map');
  await page.locator('#panel-body [type=submit]').click();
  await switchMapView(page, 'card');
  await node.locator('.card-open').click();
  await expect(page.locator('#panel-body .markdown')).toContainText('Updated from Mind Map');
});
