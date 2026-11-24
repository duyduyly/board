import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { exportMenuAction, locale, theme, view } from './ui-driver.mjs';

const SHOTS = process.env.CARD_COMMENTS_SHOTS;
const CARD = 'card-user-service';
const card = (page) => page.locator('.graph-card[data-id=' + CARD + ']');
const area = (page) => page.locator('#card-comment-text');
const rows = (page) => page.locator('.card-comment');

async function start(page) {
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  await card(page).dblclick();
  await expect(page.locator('#detail-panel')).toBeVisible();
}
async function closeDetail(page) {
  await page.locator('[data-action=close]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
}
async function reopen(page) {
  await card(page).dblclick();
  await expect(page.locator('#detail-panel')).toBeVisible();
}
async function addByButton(page, text) {
  await area(page).fill(text);
  await page.locator('.card-comment-add').click();
}

test('add, order, rendering, time, limits, delete and undo of comments', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);
  await expect(area(page)).toBeVisible();
  await expect(page.locator('.card-comments-empty')).toBeVisible();
  await expect(page.locator('.card-comment-add')).toBeDisabled();
  await area(page).fill('   ');
  await expect(page.locator('.card-comment-add')).toBeDisabled();

  await addByButton(page, '- a\n- b\n1. x');
  await expect(rows(page)).toHaveCount(1);
  await area(page).fill('dòng một\ndòng hai');
  await area(page).press('Control+Enter');
  await expect(rows(page)).toHaveCount(2);
  await expect(area(page)).toHaveValue('');
  await expect(area(page)).toBeFocused();

  // newest first
  const newest = rows(page).nth(0);
  const oldest = rows(page).nth(1);
  await expect(newest.locator('p')).toHaveCount(1);
  await expect(newest.locator('p br')).toHaveCount(1);
  await expect(newest.locator('p')).toContainText('dòng một');
  await expect(newest.locator('p')).toContainText('dòng hai');
  await expect(oldest.locator('ul > li')).toHaveText(['a', 'b']);
  await expect(oldest.locator('ol > li')).toHaveText(['x']);

  // time: ISO datetime attribute, text follows locale
  const time = newest.locator('time');
  const iso = await time.getAttribute('datetime');
  expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  const viText = await time.textContent();
  expect(viText.trim()).not.toBe('');
  await page.locator('[data-action=close]').click();
  await locale(page, 'en');
  await reopen(page);
  const enTime = rows(page).nth(0).locator('time');
  await expect(enTime).toHaveAttribute('datetime', iso);
  expect(await enTime.textContent()).not.toBe(viText);
  await expect(page.locator('#card-comments-title')).toContainText('Comments');
  await expect(page.locator('.card-comment-add')).toHaveText('Add');
  await locale(page, 'vi');
  await expect(page.locator('#card-comments-title')).toContainText('Comment');
  await expect(page.locator('.card-comment-add')).toHaveText('Thêm');
  await expect(rows(page).nth(0).locator('time')).toHaveText(viText);

  // length limit
  await area(page).fill('x'.repeat(4001));
  await expect(page.locator('.card-comment-add')).toBeDisabled();
  await expect(page.locator('.card-comment-error')).toBeVisible();
  await expect(page.locator('.card-comment-error')).not.toHaveText('');
  await area(page).fill('x'.repeat(4000));
  await expect(page.locator('.card-comment-add')).toBeEnabled();
  await expect(page.locator('.card-comment-error')).toBeHidden();
  await area(page).fill('');

  // delete -> status inside the modal Detail -> Undo restores in one step
  await newest.locator('.card-comment-delete').click();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.locator('.card-comment-status')).toBeVisible();
  await expect(page.locator('.card-comment-status')).toContainText('Ctrl+Z');
  await expect(page.locator('.card-comment-delete').first()).toBeInViewport();
  await page.locator('.card-comment-delete').first().focus();
  await page.keyboard.press('Control+z');
  await expect(rows(page)).toHaveCount(2);
  await expect(page.locator('#card-comments-title')).toBeFocused();
  await expect(rows(page).nth(0).locator('time')).toHaveAttribute('datetime', iso);
  await expect(rows(page).nth(1).locator('ul > li')).toHaveText(['a', 'b']);
  // Undo reverted only the delete, not the earlier adds
  await page.locator('#card-comments-title').focus();
  await page.keyboard.press('Control+z');
  await expect(rows(page)).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('unsent text survives Undo and locale change', async ({ page }) => {
  await start(page);
  await addByButton(page, 'one');
  await expect(rows(page)).toHaveCount(1);
  await area(page).fill('chưa gửi');
  await page.locator('#card-comments-title').focus();
  await page.keyboard.press('Control+z');
  await expect(rows(page)).toHaveCount(0);
  await expect(area(page)).toHaveValue('chưa gửi');
  await page.locator('[data-action=close]').click();
  if (await page.locator('#modal').isVisible()) await page.locator('[data-choice=discard]').click();
  await locale(page, 'en');
  await reopen(page);
  await expect(area(page)).toHaveValue('chưa gửi');
});

test('pinned note shows comments read-only with a notice', async ({ page }) => {
  await start(page);
  await addByButton(page, 'keep me');
  await expect(rows(page)).toHaveCount(1);
  await closeDetail(page);
  await card(page).locator('.card-pin').click();
  await reopen(page);
  await expect(page.locator('.card-comments-locked')).toBeVisible();
  await expect(area(page)).toHaveCount(0);
  await expect(page.locator('.card-comment-add')).toHaveCount(0);
  await expect(rows(page)).toHaveCount(1);
  await expect(page.locator('.card-comment-delete')).toHaveCount(0);
  await expect(rows(page).locator('p')).toHaveText('keep me');
});

test('comments survive JSON export/import and appear in Mind Map', async ({ page }) => {
  await start(page);
  await addByButton(page, '- a\n- b\n1. x');
  await addByButton(page, 'hai\nbả');
  await expect(rows(page)).toHaveCount(2);
  await theme(page);
  if (SHOTS) await page.screenshot({ path: SHOTS + '\\card-comments-dark.png' });
  await closeDetail(page);

  const download = page.waitForEvent('download');
  await page.locator('#project-menu > summary').click();
  await exportMenuAction(page, 'export');
  const exported = JSON.parse(await fs.readFile(await (await download).path(), 'utf8'));
  const items = exported.cards.find((c) => c.id === CARD).extensions['card-atlas:comments'].items;
  expect(items.map((i) => i.text)).toEqual(['- a\n- b\n1. x', 'hai\nbả']);

  await page.reload();
  await page.locator('#file-input').setInputFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await page.locator('[data-choice=apply]').click();
  await reopen(page);
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(1).locator('ul > li')).toHaveText(['a', 'b']);
  await closeDetail(page);

  await view(page, 'mind');
  await card(page).dblclick();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(0).locator('p')).toContainText('hai');
  if (SHOTS) await page.screenshot({ path: SHOTS + '\\card-comments-mind-dark.png' });
});
