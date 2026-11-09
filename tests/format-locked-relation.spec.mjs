import { test, expect } from '@playwright/test';

for (const { locale, viewport, hint } of [
  {
    locale: 'vi',
    viewport: { width: 1440, height: 900 },
    hint: 'Mũi tên nối với note đã ghim đang bị khóa.',
  },
  {
    locale: 'en',
    viewport: { width: 390, height: 844 },
    hint: 'This connector is locked because it touches a pinned note.',
  },
]) {
  test(`locked connector shows its explanation in ${locale} at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const project = {
      version: '1.0',
      metadata: { title: 'Locked connector' },
      cards: [
        { id: 'a', title: 'A', content: '', position: { x: 0, y: 0 } },
        {
          id: 'p',
          title: 'Pinned',
          content: '',
          position: { x: 400, y: 0 },
          extensions: { 'card-atlas:metadata': { pinned: true } },
        },
      ],
      relations: [{ id: 'r', source: 'a', target: 'p' }],
    };
    await page
      .locator('#file-input')
      .setInputFiles({
        name: 'locked.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(project)),
      });
    await page.locator('#modal [data-choice=apply]').click();
    if (locale !== 'vi') await page.locator('#locale').selectOption(locale);
    await page.locator('[data-action=fit]').click();
    const snapshot = () =>
      page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project));
    const before = await snapshot();
    const box = await page.locator('#canvas-region').boundingBox();
    const mid = await page.evaluate(async () =>
      (await import('/assets/js/app.js')).adapter.cy.getElementById('r:r').renderedMidpoint(),
    );
    await page.mouse.click(box.x + mid.x, box.y + mid.y);
    await expect(page.locator('#format-inspector')).toBeVisible();
    await expect(page.locator('#inspector-edge-hint')).toHaveText(hint);
    await expect(page.locator('#inspector-edge-hint')).toBeVisible();
    await expect(page.locator('#inspector-fields')).toBeHidden();
    expect(await snapshot()).toBe(before);
  });
}
