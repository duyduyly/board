import { test, expect } from '@playwright/test';

test('image alignment survives undo, redo and saving without losing image properties', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=insertImage]').locator('..').locator('input[type=file]').setInputFiles({
    name: 'example.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXcAAAAASUVORK5CYII=', 'base64'),
  });
  const image = page.frameLocator('#block-editor .gjs-frame').locator('img');
  await image.click();
  await page.locator('[data-image-control=alt]').fill('Example');
  await page.locator('[data-image-control=alt]').dispatchEvent('change');
  await page.locator('[data-image-control=width]').fill('120');
  await page.locator('[data-image-control=width]').dispatchEvent('change');
  await page.locator('[data-image-control=fit]').selectOption('cover');
  await page.locator('[data-image-control=caption]').fill('Caption');
  await page.locator('[data-image-control=caption]').dispatchEvent('change');
  await page.waitForTimeout(1000); // GrapesJS groups adjacent changes into one undo entry.
  const alignment = page.locator('[data-image-control=alignment]');
  const initialMargin = await image.evaluate((element) => window.getComputedStyle(element).marginLeft);
  await alignment.selectOption('center');
  await expect(image).not.toHaveCSS('margin-left', initialMargin);
  await page.waitForTimeout(1000);
  await page.locator('[data-block-label=blockUndo]').click();
  await expect(image).toHaveCSS('margin-left', initialMargin);
  await page.locator('[data-block-label=blockRedo]').click();
  await expect(image).not.toHaveCSS('margin-left', initialMargin);
  await page.locator('#panel-body [type=submit]').click();
  const card = await page.evaluate(async () => (await import('/assets/js/app.js')).store.project.cards.at(-1));
  await page.locator(`[data-id="${card.id}"]`).focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await image.click();
  await expect(alignment).toHaveValue('center');
  await expect(page.locator('[data-image-control=alt]')).toHaveValue('Example');
  await expect(page.locator('[data-image-control=width]')).toHaveValue('120');
  await expect(page.locator('[data-image-control=fit]')).toHaveValue('cover');
  await expect(page.locator('[data-image-control=caption]')).toHaveValue('Caption');
});
