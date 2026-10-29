import { view as switchMapView } from './ui-driver.mjs';
import { test, expect } from '@playwright/test';
test('pin and date shared views, keyboard, locale, undo and safe shapes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  const legacy = page.locator('.graph-card[data-id=card-user-service]');
  await expect(legacy.locator('time')).toHaveText('Chưa có ngày tạo');
  await legacy.locator('.card-pin').click();
  await expect(legacy.locator('.card-pin')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  await page.locator('[data-action=undo]').first().click();
  await expect(legacy.locator('.card-pin')).toHaveAttribute('aria-pressed', 'false');
  await legacy.locator('.card-pin').focus();
  await page.keyboard.press('Enter');
  await expect(legacy.locator('.card-pin')).toBeFocused();
  await expect(legacy.locator('.card-pin')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Control+z');
  await expect(legacy.locator('.card-pin')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Control+Shift+z');
  await expect(legacy.locator('.card-pin')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#locale').selectOption('en');
  await expect(legacy.locator('time')).toHaveText('Creation date unavailable');
  await expect(legacy.locator('.card-pin')).toHaveAttribute('aria-label', 'Unpin card');
  await switchMapView(page, 'mind');
  await expect(legacy.locator('.card-pin')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-palette-shape=heart]').click();
  const fresh = page.locator('.graph-card[data-shape=heart]');
  await expect(fresh).toHaveCount(1);
  await expect(fresh.locator('time')).toHaveAttribute('datetime', /Z$/);
  const result = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { serialize, stage } = await import('/assets/js/json/validator.js');
    return {
      valid: stage(serialize(store.project)).errors,
      c: store.project.cards.find(
        (c) => c.extensions?.['card-atlas:appearance']?.shape === 'heart',
      ),
    };
  });
  expect(result.valid).toEqual([]);
  expect(result.c.extensions['card-atlas:metadata'].createdAt).toBeTruthy();
  await fresh.locator('.card-pin').click();
  await page.locator('#theme-toggle').click();
  await expect(fresh.locator('.card-pin')).toHaveAttribute('aria-pressed', 'true');
  expect(
    await fresh
      .locator('.card-status-strip')
      .evaluate((el) => el.parentElement.classList.contains('graph-card')),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.locator('[data-action=fit]').click();
  await page.screenshot({ path: 'planning/design/card-pin-date-dark.png' });
});

test.describe('creation day follows browser timezone', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' });
  test('UTC timestamp keeps exact value while badge shows local creation day', async ({ page }) => {
    const fs = await import('node:fs/promises');
    const project = JSON.parse(await fs.readFile('assets/data/note-paper-example.json', 'utf8'));
    project.cards[0].extensions['card-atlas:metadata'].createdAt = '2026-10-14T23:30:00.000Z';
    await page.goto('/');
    await page.locator('#file-input').setInputFiles({
      name: 'notes.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
    await page.locator('[data-choice=apply]').click();
    const date = page.locator('.graph-card[data-id=paper-0] time');
    await expect(date).toHaveText('15/10/2026');
    await page.locator('#locale').selectOption('en');
    await expect(date).toHaveText('15/10/2026');
    expect(
      await page.evaluate(async () => {
        const { store } = await import('/assets/js/app.js');
        return store.project.cards[0].extensions['card-atlas:metadata'].createdAt;
      }),
    ).toBe('2026-10-14T23:30:00.000Z');
  });
});
