import { view as switchMapView } from './ui-driver.mjs';
import { test, expect } from '@playwright/test';
test('pushpin hover preserves transparent SVG in both themes and views', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/Card Atlas/);
  await page.locator('[data-template=architecture]').click();
  const card = page.locator('.graph-card[data-id=card-user-service]');
  const pin = card.locator('.card-pin');
  for (const view of ['card', 'mind']) {
    await switchMapView(page, view);
    for (const theme of ['light', 'dark']) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page.locator('#theme-toggle').click();
      await pin.hover();
      const style = await pin.evaluate((el) => {
        const s = window.getComputedStyle(el);
        return {
          image: s.backgroundImage,
          color: s.backgroundColor,
          border: s.borderWidth,
          filter: s.filter,
        };
      });
      expect(style.image).toContain('pushpin.svg');
      expect(style.color).toBe('rgba(0, 0, 0, 0)');
      expect(style.border).toBe('0px');
      expect(style.filter).toBe('none');
      await pin.click();
      await expect(pin).toHaveAttribute('aria-pressed', 'true');
      await pin.hover();
      expect(await pin.evaluate((el) => window.getComputedStyle(el).backgroundImage)).toContain(
        'pushpin-red.svg',
      );
      await page.locator('[data-action=undo]').first().click();
      await expect(pin).toHaveAttribute('aria-pressed', 'false');
      expect(await pin.evaluate((el) => window.getComputedStyle(el).backgroundImage)).toContain(
        'pushpin.svg',
      );
      await expect(page.locator('#detail-panel')).not.toBeVisible();
    }
  }
  await pin.hover();
  await page.screenshot({ path: 'planning/design/pin-hover-fixed.png' });
  expect(errors).toEqual([]);
});
