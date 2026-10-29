import { view as switchMapView } from './ui-driver.mjs';
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test('Learning Atlas is available in learning examples and opens both views without data loss', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('[data-category=learning]').click();
  const tile = page.locator('[data-template=learning-atlas]');
  await expect(tile).toContainText('Learning Atlas');
  await page.locator('#template-search').fill('khung ghi chep');
  await expect(page.locator('.template-tile')).toHaveCount(1);
  await expect(page.locator('#template-search')).toBeFocused();
  await page.locator('#template-search').fill('not-a-template');
  await expect(page.locator('.template-tile')).toHaveCount(0);
  await page.locator('#template-search').fill('Learning Atlas');
  await expect(tile).toBeVisible();
  await page.locator('#locale').selectOption('en');
  await expect(tile).toContainText('Reusable study template');
  await page.screenshot({ path: 'planning/design/learning-atlas-gallery-search.png' });
  await tile.click();
  await expect(page.locator('.graph-card')).toHaveCount(14);
  await expect(page.locator('.group-frame')).toHaveCount(2);
  const before = await page.evaluate(async () => (await import('/assets/js/app.js')).store.project);
  const original = JSON.parse(
    await fs.readFile('assets/data/templates/learning-atlas.json', 'utf8'),
  );
  expect(before.cards.map((c) => c.content)).toEqual(original.cards.map((c) => c.content));
  await switchMapView(page, 'mind');
  await expect(page.locator('.graph-card')).toHaveCount(14);
  await switchMapView(page, 'card');
  const after = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { serialize, stage } = await import('/assets/js/json/validator.js');
    return { p: store.project, errors: stage(serialize(store.project)).errors };
  });
  expect(after.p).toEqual(before);
  expect(after.errors).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'planning/design/learning-atlas-gallery-open.png' });
});
