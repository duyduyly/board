import { test, expect } from '@playwright/test';

const intersects = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 800 },
])
  for (const dock of ['closed', 'open'])
    for (const locale of ['vi', 'en'])
      for (const theme of ['light', 'dark'])
        test(`Mind banner keeps clear of the zoom bar ${viewport.width} dock ${dock} ${locale} ${theme}`, async ({
          page,
        }) => {
          await page.setViewportSize(viewport);
          await page.goto('/');
          await page.locator('#locale').selectOption(locale);
          await page.evaluate((value) => {
            document.documentElement.dataset.theme = value;
          }, theme);
          await page.locator('#file-input').setInputFiles('assets/data/mind-map-example.json');
          await page.locator('[data-choice=apply]').click();
          await page.locator('[data-map-view=mind]').click();
          if (dock === 'open') {
            await page.locator('[data-overview-field=title]').first().click();
            await expect(page.locator('#format-inspector')).toBeVisible();
          }
          const banner = page.locator('#mind-view-banner');
          await expect(banner).toBeVisible();
          const bannerBox = await banner.boundingBox();
          const zoomBox = await page.locator('.zoom-controls').boundingBox();
          const canvasBox = await page.locator('#canvas-region').boundingBox();
          expect(intersects(bannerBox, zoomBox)).toBe(false);
          expect(bannerBox.x).toBeGreaterThanOrEqual(canvasBox.x);
          expect(bannerBox.x + bannerBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width);
          for (const control of await page.locator('.zoom-controls > *').all()) {
            if (!(await control.isVisible())) continue;
            const box = await control.boundingBox();
            expect(box.x + box.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width);
            expect(intersects(bannerBox, box)).toBe(false);
          }
        });
