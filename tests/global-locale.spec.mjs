import { test, expect } from '@playwright/test';

test('one toolbar locale controls Detail, help and both card popups without data changes', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  const before = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return JSON.stringify({
      p: store.project,
      history: store.undoStack.length,
      dirty: store.dirty,
    });
  });
  const languages = page
    .locator('select')
    .filter({ has: page.locator('option[value=vi]') })
    .filter({ has: page.locator('option[value=en]') });
  await expect(languages).toHaveCount(1);
  await expect(languages).toHaveAttribute('id', 'locale');
  for (const lang of ['en', 'vi']) {
    await page.locator('#locale').selectOption(lang);
    await page.locator('#quick-help').click();
    await expect(page.locator('#modal')).toHaveAccessibleName(
      lang === 'en' ? 'Quick help' : 'Hướng dẫn nhanh',
    );
    await expect(page.locator('#modal select')).toHaveCount(0);
    await page.keyboard.press('Escape');
    const card = page.locator('.graph-card[data-id=card-user-service]');
    await card.locator('.card-open').click();
    await expect(page.locator('#panel-tabs button').first()).toHaveText(
      lang === 'en' ? 'Overview' : 'Tổng quan',
    );
    await expect(page.locator('#detail-locale')).toHaveCount(0);
    await page.locator('[data-action=close]').click();
    await card.locator('time').click();
    await expect(page.locator('#card-date-editor [data-date-apply]')).toHaveText(
      lang === 'en' ? 'Apply' : 'Áp dụng',
    );
    await expect(page.locator('#card-date-editor select')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await card.locator('h3').click();
    await expect(page.locator('#card-overview-editor [data-overview-cancel]')).toHaveText(
      lang === 'en' ? 'Cancel' : 'Hủy',
    );
    await expect(languages).toHaveCount(1);
    await page.keyboard.press('Escape');
  }
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
  await page.screenshot({ path: 'planning/design/global-locale.png' });
  expect(errors).toEqual([]);
});
