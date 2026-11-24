import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { TextDecoder } from 'node:util';
import { readZip, readZipText } from './docx-zip-reader.mjs';
import { exportMenuAction, locale, view } from './ui-driver.mjs';

const CARD = 'card-user-service';
const CARD_SELECTOR = '.graph-card[data-id="' + CARD + '"]';
const UNIQUE_WORD = 'zebraquark';
const LIST_COMMENT = 'Ghi chú ' + UNIQUE_WORD + '\n- mục một\n- mục hai';

async function openExample(page) {
  await page.goto('/');
  await page.locator('[data-action=example]').click();
  await expect(page.locator('.graph-card')).toHaveCount(4);
}

const box = async (page) => {
  const rect = await page.locator(CARD_SELECTOR).boundingBox();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
};

async function addComments(page, texts) {
  await page.locator(CARD_SELECTOR).focus();
  await page.keyboard.press('Enter');
  const section = page.locator('section.card-comments');
  await expect(section).toBeVisible();
  const existing = await section.locator('.card-comment').count();
  for (const text of texts) {
    await page.locator('textarea#card-comment-text').fill(text);
    await section.locator('.card-comment-add').click();
  }
  await expect(section.locator('.card-comment')).toHaveCount(existing + texts.length);
  await page.locator('[data-action=close]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
}

const badge = (page) => page.locator(CARD_SELECTOR + ' .card-comment-count');

const intersects = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function expectGeometryAndBadge(page, expectedCount) {
  const before = await box(page);
  await expect(badge(page)).toBeHidden();
  await addComments(page, ['Một', LIST_COMMENT].slice(0, expectedCount));
  expect(await box(page)).toEqual(before);
  await expect(badge(page)).toBeVisible();
  await expect(badge(page)).toHaveText(String(expectedCount));
  const badgeBox = await badge(page).boundingBox();
  const cardBox = await box(page);
  expect(badgeBox.x).toBeGreaterThanOrEqual(cardBox.x);
  expect(badgeBox.x + badgeBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
  for (const other of ['.card-open', '.card-pin']) {
    const locator = page.locator(CARD_SELECTOR + ' ' + other);
    if (await locator.isVisible())
      expect(intersects(badgeBox, await locator.boundingBox())).toBe(false);
  }
}

test('Note Board: comments keep card geometry and show an exact count badge', async ({ page }) => {
  await openExample(page);
  await expectGeometryAndBadge(page, 2);
});

test('Mind Map: comments keep card geometry and show an exact count badge', async ({ page }) => {
  await openExample(page);
  await view(page, 'mind');
  await expect(page.locator(CARD_SELECTOR)).toBeVisible();
  await expectGeometryAndBadge(page, 1);
});

test('badge label follows the locale and hides again at zero', async ({ page }) => {
  await openExample(page);
  await addComments(page, ['Một']);
  await expect(badge(page)).toHaveAttribute('aria-label', '1 comment');
  await addComments(page, ['Hai']);
  await expect(badge(page)).toHaveAttribute('aria-label', '2 comment');
  await locale(page, 'en');
  await expect(badge(page)).toHaveAttribute('aria-label', '2 comments');
  await expect(badge(page)).toHaveAttribute('title', '2 comments');
  await page.locator(CARD_SELECTOR).focus();
  await page.keyboard.press('Enter');
  const deletes = page.locator('section.card-comments .card-comment-delete');
  await deletes.first().click();
  await deletes.first().click();
  await expect(page.locator('section.card-comments .card-comment')).toHaveCount(0);
  await page.locator('[data-action=close]').click();
  await expect(badge(page)).toBeHidden();
});

test('clicking the middle of a card with a badge still selects the card', async ({ page }) => {
  await openExample(page);
  await addComments(page, ['Một']);
  const rect = await box(page);
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await expect(page.locator('.graph-card.selected')).toHaveAttribute('data-id', CARD);
});

test('global search finds text that exists only in a comment', async ({ page }) => {
  await openExample(page);
  await addComments(page, [LIST_COMMENT]);
  await page.locator('[data-action=search]').click();
  await page.locator('#search').fill(UNIQUE_WORD);
  const rows = page.locator('.card-row');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveAttribute('data-card-id', CARD);
});

test('Word and Markdown exports include the Comment section and list', async ({ page }) => {
  await openExample(page);
  await addComments(page, [LIST_COMMENT]);

  const [word] = await Promise.all([
    page.waitForEvent('download'),
    exportMenuAction(page, 'export-word'),
  ]);
  const docx = new Uint8Array(fs.readFileSync(await word.path()));
  const documentXml = new Map(readZipText(docx)).get('word/document.xml');
  expect(documentXml).toContain('>Comment<');
  expect(documentXml).toContain(UNIQUE_WORD);
  expect(documentXml).toContain('mục một');
  expect(documentXml).toContain('mục hai');
  expect(documentXml).toContain('<w:numPr>');

  const [markdown] = await Promise.all([
    page.waitForEvent('download'),
    exportMenuAction(page, 'export-markdown'),
  ]);
  const zip = readZip(new Uint8Array(fs.readFileSync(await markdown.path())));
  const mdName = [...zip.keys()].find((name) => name.endsWith('.md'));
  const text = new TextDecoder().decode(zip.get(mdName));
  expect(text).toMatch(/^#+ Comment$/m);
  expect(text).toContain(UNIQUE_WORD);
  expect(text).toMatch(/^[-*] mục một$/m);
  expect(text).toMatch(/^[-*] mục hai$/m);
});
