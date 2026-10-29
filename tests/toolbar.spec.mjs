import { test, expect } from '@playwright/test';

test('compact toolbar has help tools and native segmented views; cursor/guards follow mode', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('#quick-help').click();
  await page.locator('[data-action=help]').click();
  await expect(page.locator('#modal .quick-help-content')).toBeVisible();
  await page.locator('[data-choice=cancel]').click();
  await page.locator('[data-template=personal]').click();
  await expect(page.locator('.graph-card')).toHaveCount(4);
  await expect(
    page.locator(
      '.toolbar #open-inspector,.toolbar [data-action=add],.toolbar [data-action=connect],.toolbar select#map-view',
    ),
  ).toHaveCount(0);
  await expect(page.locator('[data-map-view=card]')).toHaveAttribute('aria-pressed', 'true');
  expect(
    await page.locator('#canvas-region').evaluate((e) => window.getComputedStyle(e).cursor),
  ).toContain('note.svg');
  await page.locator('[data-map-view=mind]').click();
  await expect(page.locator('#mind-convert-root')).toBeVisible();
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('[data-map-view=card]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-map-view=mind]').click();
  await page.locator('[data-choice=apply]').click();
  await expect(page.locator('[data-map-view=mind]')).toHaveAttribute('aria-pressed', 'true');
  expect(
    await page.locator('#canvas-region').evaluate((e) => window.getComputedStyle(e).cursor),
  ).toContain('mind.svg');
  await page.locator('[data-map-view=card]').click();
  await page.locator('#quick-help').click();
  await page.locator('[data-action=inspector]').click();
  await expect(page.locator('#format-inspector')).toBeVisible();
  await page.locator('#inspector-tabs button').nth(2).click();
  await page.locator('[name=width]').fill('280');
  await page.locator('[data-map-view=mind]').click();
  await expect(page.locator('[data-choice=cancel]')).toBeVisible();
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('[data-map-view=card]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[name=width]')).toHaveValue('280');
  await page.locator('#cancel-draft').click();
  await page.locator('#inspector-close').click();
  await page.locator('#locale').selectOption('en');
  await expect(page.locator('#quick-help')).toHaveAttribute('aria-label', 'Help and project tools');
  for (const width of [1440, 1050, 900]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.screenshot({ path: 'planning/design/compact-toolbar.png' });
  expect(errors).toEqual([]);
});
