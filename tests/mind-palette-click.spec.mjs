import { test, expect } from '@playwright/test';
import { view } from './ui-driver.mjs';

test('new Mind Map text node opens title editor from visible text', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await view(page, 'mind');
  await page.locator('[data-palette-kind=text]').click();
  const id = await page.evaluate(async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).id);
  const title = page.locator(`[data-id="${id}"] [data-overview-field=title]`);
  await expect(title).toBeVisible();
  await title.click();
  await expect(page.locator('#format-inspector')).toBeVisible();
  await expect(page.locator('#overview-field')).toHaveValue('title');
  await expect(page.locator('#overview-text')).toHaveValue(await title.textContent());
  await page.locator('#overview-text').fill('Sửa tiêu đề');
  await page.locator('[data-overview-apply]').click();
  await expect(page.locator(`[data-id="${id}"] [data-overview-field=title]`)).toHaveText('Sửa tiêu đề');
});
