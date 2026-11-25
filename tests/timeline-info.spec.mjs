import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { exportMenuAction } from './ui-driver.mjs';

const FIXTURE = new URL('./fixtures/timeline-project.json', import.meta.url);
const TIMELINE = 'card-atlas:timeline';
const titleButton = (page) => page.locator('#timeline-view .timeline-intro-title');
const descriptionButton = (page) => page.locator('#timeline-view .timeline-intro-description');
const editor = (page) => page.locator('#timeline-info-editor');

async function openTimeline(page) {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: await fs.readFile(FIXTURE),
  });
  await page
    .locator('[data-choice=apply]')
    .click({ timeout: 2000 })
    .catch(() => {});
  await expect(page.locator('section#timeline-view')).toBeVisible();
}
async function exported(page) {
  const downloading = page.waitForEvent('download');
  await exportMenuAction(page, 'export');
  return JSON.parse(await fs.readFile(await (await downloading).path(), 'utf8'));
}

test.describe('Timeline title and description', () => {
  test('empty Timeline offers translated placeholders', async ({ page }) => {
    await openTimeline(page);
    await expect(titleButton(page)).toHaveText('Thêm tiêu đề cho Timeline');
    await expect(descriptionButton(page)).toHaveText('Thêm mục đích hoặc mô tả ngắn');
    await page.locator('#locale').selectOption('en');
    await expect(titleButton(page)).toHaveText('Add a Timeline title');
    await expect(descriptionButton(page)).toHaveText('Add a purpose or short description');
  });

  test('edit, cancel, undo and export keep title and description', async ({ page }) => {
    await openTimeline(page);
    await titleButton(page).click();
    await expect(editor(page)).toBeVisible();
    await expect(editor(page).locator('#timeline-info-title')).toBeFocused();
    await editor(page).locator('#timeline-info-title').fill('Kế hoạch quý 4');
    await editor(page).locator('[data-info-cancel]').click();
    await expect(editor(page)).toBeHidden();
    await expect(titleButton(page)).toBeFocused();
    await expect(titleButton(page)).toHaveText('Thêm tiêu đề cho Timeline');

    await descriptionButton(page).click();
    await expect(editor(page).locator('#timeline-info-description')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(editor(page)).toBeHidden();

    await titleButton(page).press('Enter');
    await editor(page).locator('#timeline-info-title').fill('  Kế hoạch quý 4  ');
    await editor(page).locator('#timeline-info-description').fill('Theo dõi các mốc chính.');
    await editor(page).locator('[data-info-apply]').click();
    await expect(editor(page)).toBeHidden();
    await expect(titleButton(page)).toHaveText('Kế hoạch quý 4');
    await expect(descriptionButton(page)).toHaveText('Theo dõi các mốc chính.');
    await expect(page.locator('#toast')).toContainText('Đã cập nhật thông tin Timeline');

    const info = (await exported(page)).extensions[TIMELINE];
    expect(info).toEqual({
      version: 1,
      title: 'Kế hoạch quý 4',
      description: 'Theo dõi các mốc chính.',
    });

    await page.locator('[data-action=undo]').first().click();
    await expect(titleButton(page)).toHaveText('Thêm tiêu đề cho Timeline');
    await expect(descriptionButton(page)).toHaveText('Thêm mục đích hoặc mô tả ngắn');
    expect((await exported(page)).extensions[TIMELINE]).toEqual({ version: 1 });
  });

  test('user text stays untranslated across locales', async ({ page }) => {
    await openTimeline(page);
    await descriptionButton(page).click();
    await editor(page).locator('#timeline-info-description').fill('Purpose of the plan');
    await editor(page).locator('[data-info-apply]').click();
    await page.locator('#locale').selectOption('en');
    await expect(descriptionButton(page)).toHaveText('Purpose of the plan');
    await expect(titleButton(page)).toHaveText('Add a Timeline title');
    await titleButton(page).click();
    await expect(editor(page).locator('h2')).toHaveText('Timeline details');
  });
});
