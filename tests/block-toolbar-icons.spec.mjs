import { test, expect } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('grouped icon toolbar keeps accessible labels and switches editor modes', async ({ page }, info) => {
  await page.setViewportSize({ width: 1050, height: 900 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await expect(page.locator('#block-editor')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('[data-editor-group]')).toHaveCount(4);
  for (const button of await page.locator('[data-block-label], [data-editor-mode]').all()) {
    await expect(button).toHaveAttribute('aria-label', /\S/);
    await expect(button).toHaveAttribute('title', /\S/);
  }
  for (const button of await page.locator('#panel-body .editor-actions button').all()) {
    await expect(button).toHaveAccessibleName(/\S/);
  }
  await page.locator('[data-block-label=blockHeading]').click();
  await expect(page.frameLocator('#block-editor .gjs-frame').locator('h2')).toHaveCount(1);
  await page.locator('[data-editor-mode=html]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-editor-source]')).toBeVisible();
  await page.locator('[data-editor-mode=visual]').click();
  await expect(page.frameLocator('#block-editor .gjs-frame').locator('h2')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: join(tmpdir(), 'card-atlas-toolbar-' + info.project.name + '.png') });
  expect(errors).toEqual([]);
});

test('icon labels and toolbar groups use the global English locale', async ({ page }) => {
  await page.goto('/');
  await page.locator('#locale').selectOption('en');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-editor-group=editorGroupLayout]')).toHaveAttribute('aria-label', 'Layout');
  await expect(page.locator('[data-block-label=blockHeading]')).toHaveAttribute('title', /heading/i);
  await expect(page.locator('[data-editor-mode=html]')).toHaveAttribute('aria-label', /HTML/i);
});
