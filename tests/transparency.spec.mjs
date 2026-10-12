import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test('transparent background/border preview, themes, views, undo and portable export', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/Card Atlas/);
  await page.locator('[data-action=example]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
  await page.locator('.card-row[data-card-id=card-user-service]').click();
  await page.locator('#panel-tabs button').nth(2).click();
  const bg = page.locator('[name=appearance-backgroundTransparent]');
  const border = page.locator('[name=appearance-borderTransparent]');
  await expect(bg).not.toBeChecked();
  await bg.check();
  await border.check();
  const preview = page.locator('#format-card-preview .graph-card');
  await expect(preview).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(preview).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
  await expect(preview).toHaveCSS('box-shadow', 'none');
  await page.locator('#locale').selectOption('en');
  await expect(page.getByText('Transparent background', { exact: true })).toBeVisible();
  await expect(bg).toBeChecked();
  await page.locator('#theme-toggle').click();
  await expect(preview).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.locator('.editor [type=submit]').click();
  const card = page.locator('.graph-card[data-id=card-user-service]');
  await expect(card).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(card).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
  await page.locator('#map-view').selectOption('mind');
  await expect(card).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
  await page.screenshot({ path: 'planning/design/transparent-dark-mind.png' });
  await page.locator('[data-action=undo]').click();
  await expect(card).not.toHaveClass(/transparent-background/);
  await page.locator('[data-action=redo]').click();
  await expect(card).toHaveClass(/transparent-background/);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-action=export]').click();
  const downloaded = await downloadPromise;
  const text = await fs.readFile(await downloaded.path(), 'utf8');
  const data = JSON.parse(text).cards.find((c) => c.id === 'card-user-service');
  expect(data.extensions['card-atlas:appearance']).toMatchObject({
    backgroundTransparent: true,
    borderTransparent: true,
  });
  expect(data.style.backgroundColor).toMatch(/^#[0-9a-f]{6}$/i);
  const imported = await page.evaluate(async (text) => {
    const { stage } = await import('/assets/js/json/validator.js');
    const { store } = await import('/assets/js/app.js');
    const result = stage(text);
    if (!result.errors.length) store.replace(result.project);
    return result.errors;
  }, text);
  expect(imported).toEqual([]);
  await page.locator('.card-row[data-card-id=card-user-service]').click();
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(bg).toBeChecked();
  await bg.uncheck();
  await border.uncheck();
  await page.locator('.editor [type=submit]').click();
  await expect(card).not.toHaveClass(/transparent-background/);
  await page.locator('#theme-toggle').click();
  await page.locator('#map-view').selectOption('card');
  await expect(card).toHaveCSS('background-color', 'rgb(237, 233, 254)');
  await page.screenshot({ path: 'planning/design/transparent-restored-light.png' });
  expect(errors).toEqual([]);
});

test('Cancel and reset transparent draft keep applied colors', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-action=example]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
  await page.locator('.card-row[data-card-id=card-user-api]').click();
  await page.locator('#panel-tabs button').nth(2).click();
  const bg = page.locator('[name=appearance-backgroundTransparent]');
  await bg.check();
  await page.locator('#cancel-draft').click();
  await expect(bg).not.toBeChecked();
  await bg.check();
  await page.locator('#reset-appearance').click();
  await expect(bg).not.toBeChecked();
  await expect(page.locator('.graph-card[data-id=card-user-api]')).not.toHaveClass(
    /transparent-background/,
  );
});
