import { test, expect } from '@playwright/test';

for (const locale of ['vi', 'en']) {
  test(`viewer resizes with its width in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto('/');
    await page.locator('[data-template=personal]').click();
    if (locale === 'en') await page.locator('#locale').selectOption('en');
    await page.locator('[data-palette-kind=card]').click();
    await page.keyboard.press('Enter');
    await page.locator('#panel-tabs button').nth(1).click();
    await page.locator('[data-editor-mode=html]').click();
    const paragraph =
      '<p>Responsive documents should remain readable as the viewport becomes narrower and the words wrap onto additional lines.</p>';
    await page.locator('[data-editor-source]').fill(paragraph.repeat(20));
    await page.locator('#panel-body [type=submit]').click();
    const id = await page.evaluate(
      async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).id,
    );
    await page.locator(`[data-id="${id}"]`).focus();
    await page.keyboard.press('Enter');
    const frame = page.locator('.html-document-frame');
    const body = page.frameLocator('.html-document-frame').locator('body');
    await expect(body.locator('p')).toHaveCount(20);
    const snapshot = () =>
      page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project));
    const before = await snapshot();
    const height = () => frame.evaluate((el) => el.clientHeight);
    const fits = async () => (await body.evaluate((el) => el.scrollHeight)) <= (await height()) + 2;
    await expect.poll(fits).toBe(true);
    const wideHeight = await height();
    await page.setViewportSize({ width: 390, height: 640 });
    await expect.poll(height).toBeGreaterThan(wideHeight);
    await expect.poll(fits).toBe(true);
    const narrowHeight = await height();
    await page.setViewportSize({ width: 1200, height: 900 });
    await expect.poll(height).toBeLessThan(narrowHeight);
    await expect.poll(fits).toBe(true);
    expect(await snapshot()).toBe(before);
  });
}
