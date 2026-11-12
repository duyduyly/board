import { test, expect } from '@playwright/test';
import { locale, projectAction } from './ui-driver.mjs';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SVG =
  'data:image/svg+xml;base64,' +
  Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');
const FAKE_GIF =
  'data:image/gif;base64,' + Buffer.from('this is not a gif at all').toString('base64');

const cardState = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const card = store.project.cards.at(-1);
    return {
      id: card.id,
      images: card.extensions?.['card-atlas:images'] ?? null,
      document: JSON.stringify(card.extensions?.['card-atlas:document'] ?? null),
      history: store.undoStack.length,
    };
  });

async function openImport(page) {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=htmlImportTitle]').click();
}

async function review(page, html) {
  await page.locator('[data-html-source]').fill(html);
  await page.locator('[data-html-review]').click();
  await expect(page.locator('[data-html-result]')).toBeVisible();
}

async function acceptAndApply(page) {
  await page.locator('[data-html-accept]').click();
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
}

test('base64 PNG becomes one attachment, shows in Overview and makes no network request', async ({
  page,
  baseURL,
}) => {
  const external = [];
  const origin = new URL(baseURL).origin;
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:'))
      external.push(url);
  });
  await openImport(page);
  await review(page, '<p>Before</p><img alt="Dot" src="' + PNG + '"><p>After</p>');
  await expect(page.locator('[data-html-result]')).toContainText(
    'Đã chuyển 1 ảnh thành tệp đính kèm.',
  );
  const preview = page.locator('[data-html-preview]');
  await expect(preview).toContainText('attachment:');
  await expect(preview).not.toContainText('data:');
  await acceptAndApply(page);
  const state = await cardState(page);
  expect(Object.keys(state.images ?? {})).toHaveLength(1);
  const [id] = Object.keys(state.images);
  expect(state.images[id].mimeType).toBe('image/png');
  expect(state.document).toContain('attachment:' + id);
  expect(state.document).not.toContain('data:');
  await page.locator('.graph-card[data-id="' + state.id + '"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(0).click();
  const image = page.frameLocator('iframe.html-document-frame').locator('img');
  await expect(image).toHaveCount(1);
  await expect.poll(() => image.evaluate((node) => node.naturalWidth)).toBeGreaterThan(0);
  expect(external).toEqual([]);
});

test('the same data URL used twice makes one attachment', async ({ page }) => {
  await openImport(page);
  await review(page, '<img src="' + PNG + '"><p>x</p><img alt="again" src="' + PNG + '">');
  await expect(page.locator('[data-html-result]')).toContainText('Đã chuyển 1 ảnh');
  await acceptAndApply(page);
  const state = await cardState(page);
  expect(Object.keys(state.images ?? {})).toHaveLength(1);
  const [id] = Object.keys(state.images);
  expect(state.document.split('attachment:' + id).length - 1).toBe(2);
});

test('SVG and wrong-magic GIF data URLs are listed as removed and attach nothing', async ({
  page,
}) => {
  await openImport(page);
  await review(page, '<p>Keep</p><img src="' + SVG + '"><img src="' + FAKE_GIF + '">');
  const result = page.locator('[data-html-result]');
  await expect(result).toContainText('đã loại');
  await expect(result).toContainText('ảnh base64 không hợp lệ');
  await expect(result).not.toContainText('Đã chuyển');
  await expect(page.locator('[data-html-preview]')).not.toContainText('data:');
  await acceptAndApply(page);
  const state = await cardState(page);
  expect(Object.keys(state.images ?? {})).toHaveLength(0);
  expect(state.document).not.toContain('data:');
});

test('Cancel after staging leaks no image into the card', async ({ page }) => {
  await openImport(page);
  await review(page, '<img src="' + PNG + '">');
  await page.locator('[data-html-cancel]').click();
  await page.locator('[data-block-label=htmlImportTitle]').click();
  await review(page, '<p>Other</p>');
  await acceptAndApply(page);
  const state = await cardState(page);
  expect(Object.keys(state.images ?? {})).toHaveLength(0);
  expect(state.document).toContain('Other');
  expect(state.document).not.toContain('attachment:');
});

test('Undo after Apply restores the previous state in one step', async ({ page }) => {
  await openImport(page);
  const before = await cardState(page);
  await review(page, '<p>Pic</p><img src="' + PNG + '">');
  await acceptAndApply(page);
  const applied = await cardState(page);
  expect(applied.history).toBe(before.history + 1);
  expect(Object.keys(applied.images ?? {})).toHaveLength(1);
  await projectAction(page, 'undo');
  const undone = await cardState(page);
  expect(undone.history).toBe(before.history);
  expect(Object.keys(undone.images ?? {})).toHaveLength(0);
  expect(undone.document).not.toContain('Pic');
});

test('English locale shows the data-image messages in English', async ({ page }) => {
  await page.goto('/');
  await locale(page, 'en');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=htmlImportTitle]').click();
  await review(page, '<img src="' + PNG + '"><img src="' + FAKE_GIF + '">');
  const result = page.locator('[data-html-result]');
  await expect(result).toContainText('Unsupported or unsafe parts removed');
  await expect(result).toContainText('invalid base64 image');
  await expect(result).toContainText('1 image(s) converted to attachments.');
  await expect(result).not.toContainText('Đã chuyển');
});
