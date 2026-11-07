import { test, expect } from '@playwright/test';
import { projectAction } from './ui-driver.mjs';

for (const locale of ['vi', 'en']) {
  test(`format tabs show icons with accessible names in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto('/');
    await page.locator('[data-template=personal]').click();
    if (locale === 'en') await page.locator('#locale').selectOption('en');
    await projectAction(page, 'inspector');
    const tabs = page.locator('#inspector-tabs button');
    await expect(tabs).toHaveCount(4);
    expect(
      await page.locator('#inspector-tabs').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    for (const button of await tabs.all()) {
      await expect(button.locator('svg[aria-hidden=true]')).toHaveCount(1);
      await expect(button).toHaveAttribute('aria-label', /\S/);
      await expect(button).toHaveAttribute('title', /\S/);
      await expect(button).toHaveText('');
    }
    await expect(tabs.first()).toHaveAttribute('aria-pressed', 'true');
    await tabs.last().focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#inspector-edge-hint')).toBeVisible();
    await expect(tabs.last()).toHaveAttribute('aria-pressed', 'true');
    await tabs.first().focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#inspector-global')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
