import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const openArchitecture = async (page) => {
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
};
const openDetail = async (page, id = 'card-user-service') => {
  await page.locator('.card-row[data-card-id="' + id + '"]').click();
  await expect(page.locator('#detail-panel')).toHaveAttribute('open', '');
};
test('gallery categories, responsive and local template assets', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.template-tile')).toHaveCount(6);
  await page.locator('#locale').selectOption('en');
  await expect(page.locator('#template-gallery h1')).toHaveText('Templates');
  await page.screenshot({ path: 'planning/design/feedback-01-gallery.png' });
  await expect(page.locator('.template-grid')).toHaveCSS(
    'grid-template-columns',
    /px .*px .*px .*px/,
  );
  await page.locator('[data-category=learning]').click();
  await expect(page.locator('.template-tile')).toHaveCount(2);
  await page.locator('[data-category=all]').click();
  await page.locator('#theme-toggle').click();
  await page.screenshot({ path: 'planning/design/feedback-01-gallery-dark.png' });
  for (const width of [900, 600, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.screenshot({ path: 'planning/design/feedback-01-gallery-mobile.png' });
  expect(errors).toEqual([]);
});
test('selection, modal focus, Full, draft guard and locale', async ({ page }) => {
  await openArchitecture(page);
  const card = page.locator('.graph-card[data-id=card-user-service]');
  await card.click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(page.locator('#panel-title')).toBeFocused();
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('input[name=title]').fill('Draft title');
  await page.locator('#detail-locale').selectOption('en');
  await expect(page.locator('input[name=title]')).toHaveValue('Draft title');
  await page.locator('[data-action=expand]').click();
  await expect(page.locator('#detail-panel')).toHaveClass(/detail-full/);
  await page.locator('[data-action=expand]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(page.locator('input[name=title]')).toHaveValue('Draft title');
  await page.locator('[data-action=close]').click();
  await page.locator('[data-choice=apply]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  await expect(card).toBeFocused();
  await expect(card).toContainText('Draft title');
  await page.locator('[data-action=undo]').click();
  await expect(card).toContainText('User Service');
});
test('Home Continue preserves project and template replacement guards', async ({ page }) => {
  await openArchitecture(page);
  await page.locator('[data-action=add]').click();
  await page.locator('input[name=title]').fill('Keep me');
  await page.locator('[data-action=close]').click();
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-action=home]').click();
  await expect(page.locator('#home-page')).toBeVisible();
  await page.locator('[data-action=continue]').click();
  await expect(page.locator('.graph-card')).toHaveCount(4);
  await page.locator('[data-action=home]').click();
  await page.locator('[data-template=english]').click();
  await expect(page.locator('#modal')).toContainText('Thay thế dự án');
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('#home-page')).toBeVisible();
  await page.locator('[data-action=continue]').click();
  await expect(page.locator('.graph-card')).toHaveCount(4);
});
test('modal backdrop, focus trap and Mermaid documentation', async ({ page }) => {
  await openArchitecture(page);
  await openDetail(page);
  await expect(page.locator('.diagram svg')).toBeVisible();
  await page.screenshot({ path: 'planning/design/feedback-01-detail.png' });
  for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() =>
      document.querySelector('#detail-panel').contains(document.activeElement),
    ),
  ).toBe(true);
  await page.mouse.click(20, 450);
  await expect(page.locator('#detail-panel')).not.toBeVisible();
});
test('click image Fit/100%, no hover opening and nested Escape', async ({ page }) => {
  await openArchitecture(page);
  await openDetail(page);
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('#embedded-image-input').setInputFiles('tests/fixtures/english-endings.png');
  await expect(page.locator('.attachment-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await page.getByRole('button', { name: 'Tổng quan', exact: true }).click();
  const image = page.locator('.markdown img');
  await expect(image).toBeVisible();
  await image.hover();
  await expect(page.locator('.image-preview')).toHaveCount(0);
  await image.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.image-preview[open]')).toBeVisible();
  const box = await page.locator('.image-preview-image').boundingBox();
  expect(box.width).toBeLessThanOrEqual(1080);
  expect(box.height).toBeLessThanOrEqual(675);
  await page.screenshot({ path: 'planning/design/feedback-01-image-viewer.png' });
  await page
    .locator('.image-preview')
    .getByRole('button', { name: 'Kích thước gốc 100%', exact: true })
    .click();
  await expect(page.locator('.image-preview')).toHaveClass(/actual-size/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.image-preview')).toHaveCount(0);
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(image).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#detail-panel')).not.toBeVisible();
});
test('failed template loading keeps session and gallery', async ({ page }) => {
  await openArchitecture(page);
  await page.locator('[data-action=home]').click();
  await page.route('**/english-endings-example.json', (route) =>
    route.fulfill({ status: 500, body: 'failed' }),
  );
  await page.locator('[data-template=english]').click();
  await expect(page.locator('#toast')).toContainText('đọc');
  await page.locator('[data-action=continue]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
});
test('template catalog files are valid and standalone', async ({ page }) => {
  await page.goto('/');
  const catalog = JSON.parse(await fs.readFile('assets/data/template-catalog.json', 'utf8'));
  for (const item of catalog) {
    const json = await fs.readFile(item.path, 'utf8');
    const errors = await page.evaluate(async (text) => {
      const { stage } = await import('/assets/js/json/validator.js');
      return stage(text).errors;
    }, json);
    expect(errors, item.id).toEqual([]);
    expect((await fs.stat(item.preview)).size).toBeGreaterThan(0);
  }
});

test('Mind Map image and text use select first then explicit Open', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=mind]').click();
  await page.locator('#map-view').selectOption('mind');
  await page.locator('[data-action=fit]').click();
  const imageNode = page.locator('.graph-card[data-id=illustration]');
  await imageNode.click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  await imageNode.dblclick();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await page.locator('[data-action=close]').click();
  const textNode = page.locator('.graph-card[data-id=english-overview]');
  await textNode.click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  await textNode.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detail-panel')).toBeVisible();
});

test('portrait Fit preserves ratio and tiny GIF is not upscaled or fetched', async ({ page }) => {
  await openArchitecture(page);
  await openDetail(page);
  await page.locator('#panel-tabs button').nth(1).click();
  const portrait = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 1000;
    canvas.getContext('2d').fillRect(0, 0, 200, 1000);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('#embedded-image-input').setInputFiles({
    name: 'portrait.png',
    mimeType: 'image/png',
    buffer: Buffer.from(portrait, 'base64'),
  });
  await expect(page.locator('.attachment-row')).toHaveCount(1);
  await page.locator('#embedded-image-input').setInputFiles({
    name: 'tiny.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
  });
  await expect(page.locator('.attachment-row')).toHaveCount(2);
  await page.locator('.editor button[type=submit]').click();
  await page.locator('#panel-tabs button').nth(0).click();
  const images = page.locator('.markdown img');
  await expect(images).toHaveCount(2);
  let requests = 0;
  page.on('request', () => requests++);
  await page.locator('.markdown img[alt="portrait.png"]').focus();
  await page.keyboard.press('Space');
  const portraitBox = await page.locator('.image-preview-image').boundingBox();
  expect(portraitBox.height).toBeLessThanOrEqual(675);
  expect(portraitBox.width / portraitBox.height).toBeCloseTo(0.2, 2);
  await page.keyboard.press('Escape');
  await page.locator('.markdown img[alt="tiny.gif"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.image-preview-image')).toHaveJSProperty('naturalWidth', 1);
  const gifBox = await page.locator('.image-preview-image').boundingBox();
  expect(gifBox.width).toBe(1);
  expect(gifBox.height).toBe(1);
  await page.mouse.click(20, 450);
  await expect(page.locator('.image-preview')).toHaveCount(0);
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(page.locator('.markdown img[alt="tiny.gif"]')).toBeFocused();
  expect(requests).toBe(0);
});
