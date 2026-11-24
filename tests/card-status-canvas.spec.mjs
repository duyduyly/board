import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { TextDecoder } from 'node:util';
import { readZip, readZipText } from './docx-zip-reader.mjs';
import { exportMenuAction, theme, view } from './ui-driver.mjs';

const CARD = 'card-user-service';
const CARD_SELECTOR = '.graph-card[data-id="' + CARD + '"]';
const LABEL_DONE = 'Xong';

async function openExample(page) {
  await page.goto('/');
  await page.locator('[data-action=example]').click();
  await expect(page.locator('.graph-card')).toHaveCount(4);
}

const box = async (page) => {
  const rect = await page.locator(CARD_SELECTOR).boundingBox();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
};

// Through the visible chip and its menu, like a user.
async function assignStatus(page, value) {
  await chip(page).click();
  await page.locator('#card-status-popover [data-status="' + value + '"]').click();
  await expect(page.locator('#card-status-popover')).not.toBeVisible();
}

const chip = (page) => page.locator(CARD_SELECTOR + ' .card-status-chip');
const toggle = (page) => page.locator('[data-action=status-display]');

const intersects = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function expectChipKeepsGeometry(page) {
  const before = await box(page);
  await expect(chip(page)).toBeVisible();
  await expect(chip(page)).toContainText('Mới');
  const defaultChip = await chip(page).boundingBox();
  expect(defaultChip.y + defaultChip.height).toBeLessThanOrEqual(before.y + before.height);
  await assignStatus(page, 'done');
  expect(await box(page)).toEqual(before);
  await expect(chip(page)).toBeVisible();
  await expect(chip(page)).toContainText(LABEL_DONE);
  await expect(chip(page)).toHaveAttribute('aria-label', /Xong/);
  const chipBox = await chip(page).boundingBox();
  for (const other of ['.card-open', '.card-pin']) {
    const locator = page.locator(CARD_SELECTOR + ' ' + other);
    if (await locator.isVisible())
      expect(intersects(chipBox, await locator.boundingBox())).toBe(false);
  }
}

test('Note Board: status chip shows label and keeps card geometry', async ({ page }) => {
  await openExample(page);
  await expectChipKeepsGeometry(page);
});

test('Mind Map: status chip shows label and keeps card geometry', async ({ page }) => {
  await openExample(page);
  await view(page, 'mind');
  await expect(page.locator(CARD_SELECTOR)).toBeVisible();
  await expectChipKeepsGeometry(page);
});

test('display toggle hides chips in both views without touching history', async ({ page }) => {
  await openExample(page);
  await assignStatus(page, 'done');
  const undo = page.locator('[data-action=undo]');
  const undoDisabled = await undo.isDisabled();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(chip(page)).toBeVisible();

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(chip(page)).toBeHidden();
  await expect(chip(page)).not.toBeInViewport();
  expect(await undo.isDisabled()).toBe(undoDisabled);

  await view(page, 'mind');
  await expect(page.locator(CARD_SELECTOR)).toBeVisible();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(chip(page)).toBeHidden();

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(chip(page)).toBeVisible();
  expect(await undo.isDisabled()).toBe(undoDisabled);
});

test('Undo after toggling the display still reverts only the status', async ({ page }) => {
  await openExample(page);
  await assignStatus(page, 'done');
  await toggle(page).click();
  await page.locator('[data-action=undo]').click();
  await toggle(page).click();
  await expect(chip(page)).toContainText('Mới');
});

test('the chip is a control: pressing it never drags the card', async ({ page }) => {
  await openExample(page);
  const before = await box(page);
  const target = await chip(page).boundingBox();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 120, target.y + 80, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
  expect(await box(page)).toEqual(before);
});

test('cancelled cards fade only while the display toggle is on', async ({ page }) => {
  await openExample(page);
  await assignStatus(page, 'cancelled');
  const content = page.locator(CARD_SELECTOR + ' > :not(.card-status-strip)').first();
  const opacity = () => content.evaluate((node) => Number(window.getComputedStyle(node).opacity));
  expect(await opacity()).toBeLessThan(1);
  await toggle(page).click();
  expect(await opacity()).toBe(1);
  await toggle(page).click();
  expect(await opacity()).toBeLessThan(1);
});

test('card list shows the status label and search finds it', async ({ page }) => {
  await openExample(page);
  await page.locator('[data-action=search]').click();
  const row = page.locator('.card-row[data-card-id="' + CARD + '"]');
  await expect(row.locator('.card-row-status')).toHaveText('Mới');
  await page.locator('[data-action=search]').click();
  await assignStatus(page, 'done');
  await page.locator('[data-action=search]').click();
  await expect(row.locator('.card-row-status')).toHaveText(LABEL_DONE);
  await page.locator('#search').fill(LABEL_DONE);
  const rows = page.locator('.card-row');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute('data-card-id', CARD);
});

test('chip stays visible in light and dark themes', async ({ page }) => {
  await openExample(page);
  await assignStatus(page, 'blocked');
  await expect(chip(page)).toBeVisible();
  const before = await page.locator('html').getAttribute('data-theme');
  await theme(page);
  await expect.poll(() => page.locator('html').getAttribute('data-theme')).not.toBe(before);
  await expect(chip(page)).toBeVisible();
  await expect(chip(page)).toContainText('Bị chặn');
  await theme(page);
  await expect(chip(page)).toBeVisible();
});

test('Word and Markdown exports include the label only for non-New statuses', async ({ page }) => {
  await openExample(page);
  await assignStatus(page, 'done');
  const marker = /\[(Mới|Đang làm|Xong|Bị chặn|Đã hủy)\]/g;

  const [word] = await Promise.all([
    page.waitForEvent('download'),
    exportMenuAction(page, 'export-word'),
  ]);
  const docx = new Uint8Array(fs.readFileSync(await word.path()));
  const documentXml = new Map(readZipText(docx)).get('word/document.xml');
  expect(documentXml).toContain('[' + LABEL_DONE + ']');
  // Notes left on the default New stay unlabelled.
  expect(documentXml.match(marker)).toEqual(['[' + LABEL_DONE + ']']);

  const [markdown] = await Promise.all([
    page.waitForEvent('download'),
    exportMenuAction(page, 'export-markdown'),
  ]);
  const zip = readZip(new Uint8Array(fs.readFileSync(await markdown.path())));
  const mdName = [...zip.keys()].find((name) => name.endsWith('.md'));
  // Markdown escapes the brackets of the heading suffix.
  expect(new TextDecoder().decode(zip.get(mdName))).toContain('\\[' + LABEL_DONE + '\\]');
});
