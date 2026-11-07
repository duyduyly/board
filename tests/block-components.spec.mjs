import { test, expect } from '@playwright/test';

for (const [block, selector, expected] of [
  ['blockCard', '.card', 'border-success'],
  ['blockAlert', '.alert', 'alert-success'],
  ['blockBadge', '.badge', 'text-bg-success'],
  ['blockButton', '.btn', 'btn-success'],
]) {
  test(`${block} variant survives Apply and reopen`, async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-template=personal]').click();
    await page.locator('[data-palette-kind=card]').click();
    await page.keyboard.press('Enter');
    await page.locator('#panel-tabs button').nth(1).click();
    await page.locator(`[data-block-label=${block}]`).click();
    const element = page.frameLocator('#block-editor .gjs-frame').locator(selector);
    await element.click({ position: { x: 4, y: 4 } });
    await page.locator('[data-component-variant]').selectOption('success');
    await expect(element).toHaveClass(new RegExp(expected));
    await page.locator('#panel-body [type=submit]').click();
    await expect(page.locator('#detail-panel')).not.toBeVisible();
    const card = await page.evaluate(async () =>
      (await import('/assets/js/app.js')).store.project.cards.at(-1),
    );
    await page.locator(`[data-id="${card.id}"]`).focus();
    await page.keyboard.press('Enter');
    await page.locator('#panel-tabs button').nth(1).click();
    await expect(element).toHaveClass(new RegExp(expected));
  });
}

test('table display options persist after reopen', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=blockTable]').click();
  const table = page.frameLocator('#block-editor .gjs-frame').locator('table');
  await table.click({ position: { x: 3, y: 3 } });
  await page.locator('[data-table-option=striped]').check();
  await page.locator('[data-table-option=hover]').check();
  await expect(table).toHaveClass(/table-striped/);
  await expect(table).toHaveClass(/table-hover/);
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  await page.locator(`[data-id="${card.id}"]`).focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(table).toHaveClass(/table-striped/);
  await expect(table).toHaveClass(/table-hover/);
});

test('button links reject unsafe addresses and retain safe URLs', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=blockButton]').click();
  const button = page.frameLocator('#block-editor .gjs-frame').locator('.btn');
  await button.click();
  const input = page.locator('.block-editor-link input');
  await input.fill('javascript:alert(1)');
  await page.locator('.block-editor-link button').click();
  await expect(page.locator('.block-editor-notice')).toContainText('liên kết');
  await expect(button).toHaveAttribute('href', '#');
  await input.fill('https://example.com/learn');
  await page.locator('.block-editor-link button').click();
  await expect(button).toHaveAttribute('href', 'https://example.com/learn');
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  expect(JSON.stringify(card.extensions['card-atlas:document'])).toContain(
    'https://example.com/learn',
  );
});

test('component reset restores the default variant without deleting content', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=blockAlert]').click();
  const alert = page.frameLocator('#block-editor .gjs-frame').locator('.alert');
  await alert.click();
  await page.locator('[data-component-variant]').selectOption('danger');
  await expect(alert).toHaveClass(/alert-danger/);
  await expect(page.locator('[data-component-reset]')).toHaveText(/\S/);
  await page.locator('[data-component-reset]').click();
  await expect(alert).toHaveClass(/alert-info/);
  await expect(alert).not.toHaveClass(/alert-danger/);
  await expect(alert).toContainText('...');
});
