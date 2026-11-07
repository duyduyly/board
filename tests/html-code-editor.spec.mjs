import { test, expect } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('HTML editor offers local code tools without changing the draft on open', async ({ page }, info) => {
  const requests = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:4173')) requests.push(request.url());
  });
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-editor-mode=html]').click();
  const source = page.locator('[data-editor-source]');
  await expect(page.locator('.cm-lineNumbers')).toBeVisible();
  await expect(page.locator('#panel-body [type=submit]')).toBeDisabled();
  await source.fill('<section>');
  await source.press('End');
  await source.press('Enter');
  await source.type('<p>');
  await expect(source).toContainText('</p>');
  await page.locator('[data-editor-search]').click();
  await expect(page.locator('.cm-search')).toBeVisible();
  await expect(page.locator('.cm-search input').first()).toHaveAttribute('placeholder', 'Tìm');
  await page.locator('.cm-search input').first().fill('section');
  await page.locator('.cm-search input[name=replace]').fill('article');
  await page.locator('.cm-search').getByRole('button', { name: 'Thay tất cả' }).click();
  await expect(source).toContainText('<article>');
  await page.locator('.cm-search').getByRole('button', { name: 'Đóng' }).click();
  await page.screenshot({ path: join(tmpdir(), 'card-atlas-html-editor-' + info.project.name + '.png') });
  await source.fill('<div class="unfinished');
  await expect(page.locator('.cm-lint-marker-warning').first()).toBeVisible();
  expect(requests).toEqual([]);
});

test('HTML undo retains the visual document baseline', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=blockParagraph]').click();
  await page.locator('[data-editor-mode=html]').click();
  const source = page.locator('[data-editor-source]');
  const before = await source.textContent();
  await source.press('Control+End');
  await source.type('x');
  await source.press('Control+z');
  await expect(source).toHaveText(before);
});

test('explicit HTML formatting preserves text, supports undo and leaves unsupported source intact', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-editor-mode=html]').click();
  const source = page.locator('[data-editor-source]');
  const original = '<div class="row" style="color: red"><p> A <strong>B</strong> C </p><pre>  x\n y</pre></div>';
  await source.fill(original);
  await page.locator('[data-editor-format]').click();
  await expect(source).toContainText('class="row"\n');
  await expect(source).toContainText('<p> A <strong>B</strong> C </p><pre>  x\n y</pre>');
  await expect(page.locator('.block-editor-notice')).toContainText('bản nháp');
  await source.press('Control+z');
  await expect(source).toHaveText(original);
  const unsupported = '<p class=>Keep</p>';
  await source.fill(unsupported);
  await page.locator('[data-editor-format]').click();
  await expect(source).toHaveText(unsupported);
  await expect(page.locator('.block-editor-notice')).toContainText('giữ nguyên');
});

test('formatted HTML retains table, attributes and text after visual editing and save', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-editor-mode=html]').click();
  await page.locator('[data-editor-source]').fill('<section class="container" style="color: red"><table class="table table-bordered"><tbody><tr><td colspan="2">A <strong>B</strong> C</td></tr></tbody></table><pre>  x\n y</pre></section>');
  await page.locator('[data-editor-format]').click();
  await page.locator('[data-editor-mode=visual]').click();
  const frame = page.frameLocator('#block-editor .gjs-frame');
  await expect(frame.locator('td')).toHaveAttribute('colspan', '2');
  await expect(frame.locator('td')).toHaveText('A B C');
  await expect(frame.locator('pre')).toHaveText('  x\n y');
  await page.locator('#panel-body [type=submit]').click();
  const card = await page.evaluate(async () => (await import('/assets/js/app.js')).store.project.cards.at(-1));
  expect(JSON.stringify(card.extensions['card-atlas:document'])).toContain('colspan');
  await page.locator(`[data-id="${card.id}"]`).focus();
  await page.keyboard.press('Enter');
  const viewer = page.frameLocator('.html-document-frame');
  await expect(viewer.locator('td')).toHaveText('A B C');
  await expect(viewer.locator('pre')).toHaveText('  x\n y');
});

test('unsupported HTML comments remain recoverable when switching to visual mode', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-editor-mode=html]').click();
  const source = page.locator('[data-editor-source]');
  const html = '<p>Before</p><!-- keep this --><p>After</p>';
  await source.fill(html);
  await page.locator('[data-editor-mode=visual]').click();
  await expect(source).toBeVisible();
  await expect(source).toHaveText(html);
  await expect(page.locator('#panel-body [type=submit]')).toBeDisabled();
});

test('format undo and redo stay separate from typing on both sides', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-editor-mode=html]').click();
  const source = page.locator('[data-editor-source]');
  await source.fill('<p class="x">Hello</p>');
  await source.press('Control+End');
  await source.type('!');
  await page.locator('[data-editor-format]').click();
  const formatted = await source.textContent();
  await source.press('Control+End');
  await source.type('?');
  await source.press('Control+z');
  await expect(source).toHaveText(formatted);
  await source.press('Control+z');
  await expect(source).toHaveText('<p class="x">Hello</p>!');
  await source.press('Control+y');
  await expect(source).toHaveText(formatted);
});
