import { test, expect } from '@playwright/test';
import { locale } from './ui-driver.mjs';

const GROUPS = 'card-atlas:groups';

async function loadProject(page, lang = 'vi') {
  const project = {
    version: '1.0',
    metadata: { title: 'Group dialog' },
    cards: [
      { id: 'a', title: 'Sign up', content: '', position: { x: 0, y: 0 } },
      {
        id: 'b',
        title: 'Reset password',
        content: '',
        position: { x: 320, y: 0 },
        extensions: { 'card-atlas:metadata': { pinned: true } },
      },
      { id: 'c', title: 'Gateway', content: '', position: { x: 0, y: 520 } },
      { id: 'd', title: 'Design', content: '', position: { x: 360, y: 520 } },
    ],
    relations: [],
    extensions: {
      [GROUPS]: {
        groups: [
          { id: 'g1', title: 'Auth', cardIds: ['a', 'b'], links: [{ id: 'l1', source: 'c' }] },
        ],
      },
    },
  };
  await page.goto('/');
  if (lang !== 'vi') await locale(page, lang);
  await page.locator('#file-input').setInputFiles({
    name: 'groups.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-action=fit]').click();
}

const save = (page) => page.locator('[data-choice=save-group]');
const status = (page) => page.locator('.group-editor-status');

test('edit dialog: labelled stacked fields, counted sections, pinned badge and a named save button', async ({
  page,
}) => {
  await loadProject(page);
  await page.locator('[data-group-action=edit]').click();
  await expect(page.getByLabel('Tên nhóm')).toBeFocused();
  await expect(page.getByLabel('Tên nhóm')).toHaveValue('Auth');
  const description = page.getByLabel(/Mô tả ngắn/);
  await expect(description).toHaveAttribute('aria-describedby', 'group-description-hint');
  await expect(page.locator('.group-editor-count')).toHaveText('0/500');
  await description.fill('Who may enter');
  await expect(page.locator('.group-editor-count')).toHaveText('13/500');
  await expect(page.locator('.group-editor-section legend')).toHaveText([
    'Thành viên (2)',
    'Mũi tên chỉ vào nhóm (1)',
  ]);
  await expect(page.locator('.group-members label', { hasText: 'Reset password' })).toContainText(
    'đã ghim',
  );
  await expect(page.locator('.group-links-list label')).toHaveText('Từ “Gateway”');
  await expect(save(page)).toHaveText('Lưu nhóm');
  await expect(status(page)).toBeHidden();
});

test('the dialog explains why saving is unavailable', async ({ page }) => {
  await loadProject(page);
  await page.locator('[data-group-action=edit]').click();
  await page.getByLabel('Tên nhóm').fill('   ');
  await expect(save(page)).toBeDisabled();
  await expect(status(page)).toHaveText('Nhập tên nhóm để lưu.');
  await page.getByLabel('Tên nhóm').fill('Auth');
  await expect(status(page)).toBeHidden();
  for (const box of await page.locator('.group-editor-section').first().locator('input').all())
    await box.uncheck();
  await expect(save(page)).toBeDisabled();
  await expect(status(page)).toContainText('Nhóm cần ít nhất một note');
  await page.locator('.group-members label', { hasText: 'Sign up' }).locator('input').check();
  await expect(save(page)).toBeEnabled();
});

test('create dialog lists the notes that will be grouped and selects the placeholder name', async ({
  page,
}) => {
  await loadProject(page);
  await page.locator('.graph-card[data-id=c]').click();
  await page.locator('.graph-card[data-id=d]').click({ modifiers: ['Shift'] });
  await page.locator('[data-action=group-create]').click();
  await expect(page.locator('.group-editor-item')).toHaveText(['Gateway', 'Design']);
  await expect(page.locator('.group-editor-section input')).toHaveCount(0);
  await expect(save(page)).toHaveText('Tạo nhóm');
  await page.keyboard.type('Infrastructure');
  await expect(page.getByLabel('Tên nhóm')).toHaveValue('Infrastructure');
  await save(page).click();
  await expect(page.locator('.group-frame-handle', { hasText: 'Infrastructure' })).toBeVisible();
});

test('the save button stays on screen when a group has many members', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 640 });
  await loadProject(page);
  await page.locator('[data-group-action=edit]').click();
  await expect(save(page)).toBeInViewport();
});

test('English locale', async ({ page }) => {
  await loadProject(page, 'en');
  await page.locator('[data-group-action=edit]').click();
  await expect(page.getByLabel('Group name')).toBeVisible();
  await expect(page.getByLabel(/Short description/)).toBeVisible();
  await expect(page.locator('.group-editor-section legend').first()).toHaveText('Members (2)');
  await expect(save(page)).toHaveText('Save group');
});
