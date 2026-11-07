import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 700 },
]) {
  test(`Detail width stays usable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.locator('[data-template=personal]').click();
    await page.locator('[data-palette-kind=card]').click();
    await page.keyboard.press('Enter');
    const panel = page.locator('#detail-panel');
    await expect(panel).toBeVisible();
    const rect = await panel.boundingBox();
    expect(rect.width).toBeLessThanOrEqual(viewport.width);
    if (viewport.width === 1440) expect(rect.width).toBeGreaterThan(1200);
    if (viewport.width === 1920) expect(rect.width).toBeCloseTo(1280, 0);
    if (viewport.width === 390) expect(rect.width).toBeGreaterThan(360);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    await page.locator('#panel-tabs button').nth(1).click();
    await page.locator('#html-writing-toggle').click();
    const writing = await panel.boundingBox();
    expect(writing.width).toBeCloseTo(rect.width, 0);
    await page.locator('[data-action=expand]').click();
    await expect(panel).toHaveClass(/detail-full/);
    expect((await panel.boundingBox()).width).toBeCloseTo(viewport.width, 0);
  });
}

test('wider Detail exposes more document space in both viewer and editor', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-id=personal-0] .card-open').click();
  const viewer = page.frameLocator('.html-document-frame').locator('body');
  await expect(viewer).toBeVisible();
  const viewerWidth = await viewer.evaluate((element) => element.getBoundingClientRect().width);
  expect(viewerWidth).toBeGreaterThan(1000);
  expect(viewerWidth).toBeLessThanOrEqual(1120);
  await page.locator('#panel-tabs button').nth(1).click();
  const editor = page.frameLocator('#block-editor .gjs-frame').locator('body');
  await expect(editor).toBeVisible();
  const editorWidth = await editor.evaluate((element) => element.getBoundingClientRect().width);
  expect(editorWidth).toBeGreaterThan(1000);
  expect(editorWidth).toBeLessThanOrEqual(1120);
  await expect(page.locator('[data-editor-mode=html]')).toBeVisible();
  await page.locator('[data-editor-mode=html]').click();
  await expect(page.locator('[data-editor-source]')).toBeVisible();
});
