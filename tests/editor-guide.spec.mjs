import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { locale } from './ui-driver.mjs';

async function openEditor(page, lang = 'vi') {
  await page.goto('/');
  if (lang !== 'vi') await locale(page, lang);
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(page.locator('[data-block-label=aiPromptCopy]')).toBeHidden();
  await page.locator('[data-editor-mode=html]').click();
  await expect(page.locator('[data-block-label=aiPromptCopy]')).toBeVisible();
}

const promptButton = (page) => page.locator('[data-block-label=aiPromptCopy]');
const samplesButton = (page) => page.locator('[data-block-label=htmlSamplesTitle]');
const status = (page) => page.locator('.block-editor-guide-status');

test('the prompt button copies the reusable part of board-html-prompt.md', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openEditor(page);
  await expect(promptButton(page)).toHaveAttribute('aria-label', 'Sao chép prompt cho AI');
  await promptButton(page).click();
  await expect(status(page)).toContainText('Đã sao chép prompt');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const asset = await readFile('assets/data/board-html-prompt.md', 'utf8');
  const normal = (text) => text.replace(/\r\n/g, '\n');
  expect(normal(copied)).toBe(normal(asset));
  expect(copied).toContain('Hãy viết nội dung cho một note trong Board');
  expect(copied).toContain('Yêu cầu nội dung của tôi');
  expect(copied).not.toContain('Cách dùng kết quả trong Board');
  await expect(page.locator('[data-prompt-fallback]')).toBeHidden();
});

test('without clipboard access the prompt is shown selected for manual copy', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    });
  });
  await openEditor(page);
  await promptButton(page).click();
  await expect(status(page)).toContainText('Không truy cập được clipboard');
  const fallback = page.locator('[data-prompt-fallback]');
  await expect(fallback).toBeVisible();
  await expect(fallback).toBeFocused();
  expect(await fallback.inputValue()).toContain('Hãy viết nội dung cho một note trong Board');
});

test('the ? button toggles the samples panel from the keyboard', async ({ page }) => {
  await openEditor(page);
  const panel = page.locator('.block-editor-samples');
  await expect(panel).toBeHidden();
  await expect(samplesButton(page)).toHaveAttribute('aria-expanded', 'false');
  await samplesButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(panel).toBeVisible();
  await expect(samplesButton(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toContainText('Khối HTML');
  await expect(panel).toContainText('Trình bày bằng class và style');
  await expect(panel.locator('li[data-sample]')).toHaveCount(14);
  await samplesButton(page).click();
  await expect(panel).toBeHidden();
});

test('every sample passes the HTML review without removed parts', async ({ page }) => {
  await openEditor(page);
  await samplesButton(page).click();
  const samples = page.locator('.block-editor-samples li[data-sample]');
  const count = await samples.count();
  for (let index = 0; index < count; index += 1) {
    await samples.nth(index).locator('[data-sample-insert]').click();
    const result = page.locator('[data-html-result]');
    await expect(result).toBeVisible();
    await expect(result, await samples.nth(index).getAttribute('data-sample')).toContainText(
      'Không phát hiện phần bị loại',
    );
    await page.locator('[data-html-cancel]').click();
  }
});

test('Insert adds a reviewed sample to the document and Copy puts it on the clipboard', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openEditor(page);
  await samplesButton(page).click();
  const alert = page.locator('li[data-sample=sampleAlert]');
  await alert.locator('[data-sample-copy]').click();
  await expect(status(page)).toContainText('Đã sao chép mẫu');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('alert alert-info');

  await alert.locator('[data-sample-insert]').click();
  await page.locator('[data-html-accept]').click();
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const document = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return JSON.stringify(store.project.cards.at(-1).extensions['card-atlas:document']);
  });
  expect(document).toContain('alert alert-info');
});

test('English locale labels the buttons, panel and messages in English', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openEditor(page, 'en');
  await expect(promptButton(page)).toHaveAttribute('aria-label', 'Copy the AI prompt');
  await expect(samplesButton(page)).toHaveAttribute('aria-label', 'HTML and CSS samples');
  await promptButton(page).click();
  await expect(status(page)).toContainText('Prompt copied');
  await samplesButton(page).click();
  const panel = page.locator('.block-editor-samples');
  await expect(panel).toContainText('HTML blocks');
  await expect(panel.locator('[data-sample-insert]').first()).toHaveText('Insert');
});

test('the prompt, samples and import buttons belong to HTML code mode only', async ({ page }) => {
  await openEditor(page);
  await expect(samplesButton(page)).toBeVisible();
  await expect(page.locator('[data-editor-import]')).toBeVisible();
  await samplesButton(page).click();
  await expect(page.locator('.block-editor-samples')).toBeVisible();
  await page.locator('[data-editor-mode=visual]').click();
  await expect(promptButton(page)).toBeHidden();
  await expect(samplesButton(page)).toBeHidden();
  await expect(page.locator('[data-editor-import]')).toBeHidden();
  await expect(page.locator('.block-editor-samples')).toBeHidden();
  await expect(page.locator('[data-block-label=htmlImportTitle]')).toBeVisible();
});

test('Import HTML in code mode inserts the reviewed HTML at the cursor', async ({ page }) => {
  await openEditor(page);
  const source = page.locator('[data-editor-source]');
  await source.click();
  await page.keyboard.type('<p>Before</p>');
  const importButton = page.locator('[data-editor-import]');
  await expect(importButton).toHaveAttribute('aria-label', 'Nhập HTML');
  await importButton.click();
  await page
    .locator('[data-html-source]')
    .fill('<p onclick="x()">Imported</p><script>alert(1)</script>');
  await page.locator('[data-html-review]').click();
  await expect(page.locator('[data-html-result]')).toContainText('onclick');
  await page.locator('[data-html-accept]').click();
  await expect(source).toContainText('<p>Before</p><p>Imported</p>');
  await expect(source).not.toContainText('script');
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const document = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return JSON.stringify(store.project.cards.at(-1).extensions['card-atlas:document']);
  });
  expect(document).toContain('Before');
  expect(document).toContain('Imported');
});
