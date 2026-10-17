import { test, expect } from '@playwright/test';

test('small help button beside locale explains gestures, switches language and preserves project/selection', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  const a = page.locator('.graph-card').nth(0),
    b = page.locator('.graph-card').nth(1);
  await a.click({ position: { x: 30, y: 150 } });
  await b.locator('h3').click({ modifiers: ['Shift'] });
  const before = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return JSON.stringify({
      p: store.project,
      history: store.undoStack.length,
      dirty: store.dirty,
    });
  });
  const button = page.locator('#quick-help');
  await expect(button).toHaveAccessibleName('Hướng dẫn nhanh');
  const locale = await page.locator('#locale').boundingBox(),
    help = await button.boundingBox();
  expect(help.x).toBeGreaterThanOrEqual(locale.x + locale.width);
  expect(help.width).toBeLessThanOrEqual(30);
  await button.click();
  await expect(page.locator('#modal')).toBeVisible();
  await expect(page.locator('.quick-help-content dt')).toHaveCount(6);
  await expect(page.locator('.quick-help-content')).toContainText('Shift');
  await expect(page.locator('.quick-help-content')).toContainText('Xuất dự án');
  await expect(page.locator('#modal-locale')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.locator('#locale').selectOption('en');
  await button.click();
  await expect(page.locator('#modal')).toHaveAccessibleName('Quick help');
  await expect(page.locator('.quick-help-content')).toContainText('Pinned cards are read-only');
  await page.keyboard.press('Escape');
  await expect(page.locator('#modal')).not.toBeVisible();
  await expect(button).toBeFocused();
  await expect(page.locator('.graph-card.selected')).toHaveCount(2);
  expect(
    await page.evaluate(async () => {
      const { store } = await import('/assets/js/app.js');
      return JSON.stringify({
        p: store.project,
        history: store.undoStack.length,
        dirty: store.dirty,
      });
    }),
  ).toBe(before);
  await page.setViewportSize({ width: 1050, height: 900 });
  await page.locator('#theme-toggle').click();
  const small = await button.boundingBox();
  expect(small.x + small.width).toBeLessThanOrEqual(1050);
  await button.click();
  await expect(page.locator('#modal [data-choice=cancel]')).toBeInViewport();
  await page.screenshot({ path: 'planning/design/quick-help-dark.png' });
  await page.locator('#modal [data-choice=cancel]').click();
  await expect(button).toBeFocused();
  expect(errors).toEqual([]);
});
