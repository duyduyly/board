import { test, expect } from '@playwright/test';
test('date editor inherits global locale, stages, cancels and applies one undoable date', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  await page.locator('#locale').selectOption('en');
  const badge = page.locator('.graph-card[data-id=card-user-service] time');
  const popup = page.locator('#card-date-editor');
  const input = page.locator('#card-date-input');
  await badge.click();
  await expect(popup).toBeVisible();
  await input.fill('2026-10-10');
  await expect(page.locator('#card-date-locale')).toHaveCount(0);
  await expect(input).toHaveValue('2026-10-10');
  await popup.locator('[data-date-cancel]').click();
  await expect(badge).toHaveText('Creation date unavailable');
  await expect(badge).toBeFocused();
  await badge.press('Enter');
  await input.fill('2026-10-10');
  await popup.locator('[data-date-apply]').focus();
  await page.keyboard.press('Control+z');
  await expect(popup).toBeVisible();
  await expect(input).toHaveValue('2026-10-10');
  await page.screenshot({ path: 'planning/design/card-date-editor.png' });
  await popup.locator('[data-date-apply]').click();
  await expect(badge).toHaveText('10/10/2026');
  await expect(badge).toBeFocused();
  await page.locator('[data-action=undo]').first().click();
  await expect(badge).toHaveText('Creation date unavailable');
  await page.locator('[data-action=redo]').first().click();
  await expect(badge).toHaveText('10/10/2026');
  await page.locator('#map-view').selectOption('mind');
  await badge.click();
  await input.fill('2026-01-01');
  await page.keyboard.press('Escape');
  await expect(popup).not.toBeVisible();
  await expect(badge).toHaveText('10/10/2026');
  await badge.click();
  await input.fill('');
  await popup.locator('[data-date-apply]').click();
  await expect(badge).toHaveText('Creation date unavailable');
  expect(errors).toEqual([]);
});
test('manual date preserves original timestamp and JSON round trip', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  await page.locator('[data-palette-shape=heart]').click();
  const badge = page.locator('.graph-card[data-shape=heart] time');
  const original = await badge.getAttribute('datetime');
  await badge.click();
  await page.locator('#card-date-input').fill('2024-02-29');
  await page.locator('[data-date-apply]').click();
  await expect(badge).toHaveText('29/02/2024');
  const value = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { serialize, stage } = await import('/assets/js/json/validator.js');
    const result = stage(serialize(store.project));
    return {
      errors: result.errors,
      meta: store.project.cards.find(
        (c) => c.extensions?.['card-atlas:appearance']?.shape === 'heart',
      ).extensions['card-atlas:metadata'],
    };
  });
  expect(value.errors).toEqual([]);
  expect(value.meta.createdAt).toBe(original);
  expect(value.meta.createdDate).toBe('2024-02-29');
  await badge.click();
  await page.locator('#card-date-input').fill('');
  await page.locator('[data-date-apply]').click();
  await expect(badge).toHaveAttribute('datetime', original);
});
