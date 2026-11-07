import { test, expect } from '@playwright/test';

for (const locale of ['vi', 'en']) {
  test(`wide table and image stay usable in viewer and visual editor in ${locale}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto('/');
    await page.locator('[data-template=personal]').click();
    if (locale === 'en') await page.locator('#locale').selectOption('en');
    await page.locator('[data-action=fit]').click();
    await page.locator('[data-id=personal-0] .card-open').click();
    await page.locator('#panel-tabs button').nth(1).click();
    await page
      .locator('#block-editor input[type=file][accept^="image/"]:not([data-image-replace-file])')
      .setInputFiles('tests/fixtures/english-endings.png');
    await expect(page.frameLocator('#block-editor .gjs-frame').locator('img')).toBeVisible();
    await page.locator('[data-editor-mode=html]').click();
    const source = page.locator('[data-editor-source]');
    const imageHTML = (await source.innerText()).replace('<img ', '<img width="1200" ');
    const cells = Array.from(
      { length: 12 },
      (_, index) => `<td>Column ${index + 1} content</td>`,
    ).join('');
    await source.fill(`${imageHTML}<table><tbody><tr>${cells}</tr></tbody></table>`);
    await page.locator('[data-editor-mode=visual]').click();

    async function verifyContent(frame) {
      const table = frame.locator('table');
      const image = frame.locator('img');
      await expect(table).toBeVisible();
      await expect(image).toBeVisible();
      await expect(image).toHaveAttribute('width', '1200');
      const dimensions = await table.evaluate((el) => ({
        width: el.clientWidth,
        scrollWidth: el.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.width);
      await table.evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      await expect.poll(() => table.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      expect(
        await image.evaluate(
          (el) => el.getBoundingClientRect().width <= el.parentElement.clientWidth + 1,
        ),
      ).toBe(true);
      expect(
        await frame.locator('body').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
    }

    await verifyContent(page.frameLocator('#block-editor .gjs-frame'));
    await page.locator('#panel-body [type=submit]').click();
    await page.locator('[data-action=fit]').click();
    await page.locator('[data-id=personal-0] .card-open').click();
    await verifyContent(page.frameLocator('.html-document-frame'));
  });
}
