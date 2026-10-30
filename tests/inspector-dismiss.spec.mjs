import { test, expect } from '@playwright/test';
import { projectAction } from './ui-driver.mjs';

test('inspector outside dismissal preserves drafts, modal controls and grouped layouts', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await projectAction(page, 'inspector');
  await expect(page.locator('#format-inspector')).toBeVisible();
  await page.locator('#inspector-global [name=typography]').check();
  await expect(page.locator('.bulk-typography-settings')).toBeVisible();
  await expect(page.locator('#format-inspector')).toBeVisible();
  await page.locator('#canvas-region').click({ position: { x: 12, y: 100 } });
  await expect(page.locator('#format-inspector')).not.toBeVisible();
  await page.locator('.graph-card').first().locator('h3').click();
  await expect(page.locator('#overview-text')).toBeVisible();
  await page.locator('#overview-text').fill('Bản nháp giữ lại');
  await page.locator('#canvas-region').click({ position: { x: 12, y: 100 } });
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('#overview-text')).toHaveValue('Bản nháp giữ lại');
  await expect(page.locator('#format-inspector')).toBeVisible();
  await page.locator('#canvas-region').click({ position: { x: 12, y: 100 } });
  await page.locator('[data-choice=discard]').click();
  await expect(page.locator('#format-inspector')).not.toBeVisible();
  await page.locator('.graph-card').first().focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(2).click();
  await page.locator('[name=width]').fill('280');
  await expect(page.locator('#format-inspector [data-image-fields]')).not.toBeVisible();
  const pair = await page.locator('[name=width]').evaluate((el) => {
    const a = el.getBoundingClientRect();
    const b = document.querySelector('[name=height]').getBoundingClientRect();
    return { topA: a.top, topB: b.top, leftA: a.left, leftB: b.left };
  });
  expect(pair.topA).toBe(pair.topB);
  expect(pair.leftB).toBeGreaterThan(pair.leftA);
  await page.locator('#canvas-region').click({ position: { x: 12, y: 100 } });
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('[name=width]')).toHaveValue('280');
  await page.screenshot({ path: 'planning/design/inspector-grid-card.png' });
  const dims = await page
    .locator('#format-inspector')
    .evaluate((el) => ({ width: el.clientWidth, scroll: el.scrollWidth }));
  expect(dims.scroll).toBeLessThanOrEqual(dims.width);
  await page.locator('#canvas-region').click({ position: { x: 12, y: 100 } });
  await page.locator('[data-choice=apply]').click();
  await expect(page.locator('#format-inspector')).not.toBeVisible();
  expect(
    await page.evaluate(
      async () => (await import('/assets/js/app.js')).store.project.cards[0].size.width,
    ),
  ).toBe(280);
  await projectAction(page, 'inspector');
  // Help is a deliberate outside action: dismiss the clean dock and open the modal.
  await page.locator('#quick-help').click();
  await page.locator('[data-action=help]').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await page.locator('#locale').selectOption('en');
  await projectAction(page, 'inspector');
  await page.locator('[name=typography]').check();
  await page.screenshot({ path: 'planning/design/inspector-grid-global.png' });
  await page.setViewportSize({ width: 900, height: 780 });
  expect(
    await page.locator('#format-inspector').evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  expect(errors).toEqual([]);
});
