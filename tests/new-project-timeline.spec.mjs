import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { exportMenuAction } from './ui-driver.mjs';

const timelineButton = (page) => page.locator('[data-map-view=timeline]');
const timelineView = (page) => page.locator('section#timeline-view');
const timelineOption = (page) => page.locator('#modal #new-project-timeline');

async function openNewProject(page) {
  await page.goto('/');
  await page.locator('[data-action=new]').first().click();
  await expect(page.locator('#modal #new-project-title')).toBeFocused();
}

test('new project without the Timeline option opens the Note Board', async ({ page }) => {
  await openNewProject(page);
  await expect(timelineOption(page)).not.toBeChecked();
  await page.locator('#modal [data-choice=create]').click();
  await expect(page.locator('[data-map-view=card]')).toHaveAttribute('aria-pressed', 'true');
  await expect(timelineButton(page)).toBeHidden();
  await expect(timelineView(page)).not.toBeVisible();
});

test('new project with the Timeline option opens an empty Timeline and exports it', async ({
  page,
}) => {
  await openNewProject(page);
  await page.keyboard.press('Tab');
  await expect(timelineOption(page)).toBeFocused();
  await page.keyboard.press('Space');
  await expect(timelineOption(page)).toBeChecked();
  await page.locator('#modal #new-project-title').focus();
  await page.keyboard.press('Enter');

  await expect(timelineView(page)).toBeVisible();
  await expect(timelineButton(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#timeline-view .timeline-empty')).toBeVisible();

  const downloading = page.waitForEvent('download');
  await exportMenuAction(page, 'export');
  const exported = JSON.parse(await fs.readFile(await (await downloading).path(), 'utf8'));
  expect(exported.extensions['card-atlas:timeline']).toBeTruthy();
});

test('Timeline option label and hint follow the locale', async ({ page }) => {
  await page.goto('/');
  await page.locator('#locale').selectOption('en');
  await page.locator('[data-action=new]').first().click();
  await expect(timelineOption(page)).toBeVisible();
  await expect(page.locator('#modal')).toContainText('Add a Timeline to this project');
  await expect(page.locator('#modal')).toContainText('opens in the Timeline view');
  await page.locator('#modal [data-choice=cancel]').click();

  await page.locator('#locale').selectOption('vi');
  await page.locator('[data-action=new]').first().click();
  await expect(page.locator('#modal')).toContainText('Tạo Timeline cho dự án này');
  await expect(page.locator('#modal')).toContainText('Dự án sẽ mở ở view Timeline');
});
