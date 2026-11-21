import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { readZip, readZipText } from './docx-zip-reader.mjs';
import { exportMenuAction, openRow } from './ui-driver.mjs';

const SAMPLE = path.join('wordspace', 'tasks', '20_word_export', 'assets', 'sample.docx');
const WORD_BUTTON = '#export-menu [data-action=export-word]';
const EXPORT_MENU = '#export-menu > summary';
const TOAST = {
  vi: {
    done: 'Đã yêu cầu tải file Word. Hãy kiểm tra trong Downloads.',
    notSaved: 'Dự án vẫn chưa được lưu: dùng Xuất → Xuất dự án để lưu bản mở lại được.',
    empty: 'Dự án chưa có ghi chú nào để xuất Word.',
  },
  en: { done: 'Word download requested. Check your Downloads.' },
};
const NO_DOWNLOAD_WAIT_MS = 1200;

async function exportWord(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exportMenuAction(page, 'export-word'),
  ]);
  expect(await download.failure()).toBeNull();
  return download;
}

async function expectNoDownload(page, action) {
  let downloaded = false;
  const onDownload = () => (downloaded = true);
  page.on('download', onDownload);
  await action();
  await page.waitForTimeout(NO_DOWNLOAD_WAIT_MS);
  page.off('download', onDownload);
  expect(downloaded).toBe(false);
}

const xmlErrors = (page, parts) =>
  page.evaluate((entries) => {
    const parser = new window.DOMParser();
    return entries
      .filter(([, text]) =>
        parser.parseFromString(text, 'application/xml').querySelector('parsererror'),
      )
      .map(([name]) => name);
  }, parts);

const projectTitle = (page) =>
  page.evaluate(async () => (await import('/assets/js/app.js')).store.project.metadata.title);

async function openDraft(page) {
  await page.goto('/');
  await page.locator('[data-action=example]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
  await openRow(page, page.locator('.card-row[data-card-id=card-user-service]'));
  await page.locator('#panel-tabs button').nth(2).click();
  const background = page.locator('[name=appearance-backgroundTransparent]');
  const original = await background.isChecked();
  await background.setChecked(!original);
  await expect(page.locator('#cancel-draft')).toBeVisible();
  return { background, original };
}

test('template with groups exports a well-formed docx', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('[data-template=learning-atlas]').click();
  await expect(page.locator('.graph-card').first()).toBeVisible();
  const title = await projectTitle(page);
  const cardTitles = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards
      .map((card) => card.title)
      .filter((value) => typeof value === 'string' && value.trim())
      .slice(0, 3),
  );
  expect(cardTitles.length).toBeGreaterThan(0);
  const started = Date.now();
  const download = await exportWord(page);
  const file = await download.path();
  console.log(
    `word-export ${info.project.name} learning-atlas: ${Date.now() - started} ms (click to download)`,
  );
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
  const bytes = fs.readFileSync(file);
  fs.mkdirSync(path.dirname(SAMPLE), { recursive: true });
  fs.writeFileSync(SAMPLE, bytes);
  const zip = readZip(new Uint8Array(bytes));
  const parts = [...zip.keys()].filter((name) => /\.(xml|rels)$/.test(name));
  expect(parts).toContain('word/document.xml');
  const texts = [...readZipText(new Uint8Array(bytes))].filter(([name]) => parts.includes(name));
  expect(await xmlErrors(page, texts)).toEqual([]);
  const documentXml = new Map(texts).get('word/document.xml');
  expect(documentXml).toContain(title);
  for (const cardTitle of cardTitles) expect(documentXml).toContain(cardTitle);
  expect(errors).toEqual([]);
});

test('success toast is localised and re-exports in English', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await expect(page.locator('.graph-card').first()).toBeVisible();
  await exportWord(page);
  const toast = page.locator('#toast[role=status]');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText(TOAST.vi.done);
  await page.locator('#locale').selectOption('en');
  await exportWord(page);
  await expect(toast).toContainText(TOAST.en.done);
});

test('empty project shows a notice and downloads nothing', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-action=new]').click();
  await page.locator('[data-choice=create]').click();
  await expect(page.locator('.graph-card')).toHaveCount(0);
  await expectNoDownload(page, () => exportMenuAction(page, 'export-word'));
  await expect(page.locator('#toast[role=status]')).toContainText(TOAST.vi.empty);
});

test('dirty project stays unsaved after Word export', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await expect(page.locator('.graph-card').first()).toBeVisible();
  const before = await page.locator('.graph-card').count();
  await page.locator('[data-palette-kind=card]').click();
  await expect(page.locator('.graph-card')).toHaveCount(before + 1);
  const state = page.locator('#save-state');
  await expect(state).toHaveClass(/dirty/);
  const stateText = await state.textContent();
  await exportWord(page);
  await expect(page.locator('#toast[role=status]')).toContainText(TOAST.vi.notSaved);
  await expect(state).toHaveClass(/dirty/);
  await expect(state).toHaveText(stateText);
});

test('draft guard: the docked Format draft is asked about before Word export', async ({ page }) => {
  const { background, original } = await openDraft(page);
  const dialog = page.locator('#modal');
  const exportMenu = page.locator(EXPORT_MENU);

  // The docked Format inspector consumes the outside press on the Export menu and asks first, so
  // the export draft dialog (exportDraftTitle) cannot be reached through visible controls.
  await expectNoDownload(page, () => exportMenu.click());
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-choice=cancel]').click();
  await expect(dialog).not.toBeVisible();
  await expect(background).toBeChecked({ checked: !original });
  await expect(page.locator('#cancel-draft')).toBeVisible();

  await expectNoDownload(page, async () => {
    await exportMenu.click();
    await dialog.locator('[data-choice=apply]').click();
  });
  await expect(page.locator('#cancel-draft')).not.toBeVisible();

  const download = await exportWord(page);
  expect(download.suggestedFilename()).toMatch(/.docx$/);
  await expect(page.locator('#save-state')).toHaveClass(/dirty/);
});

test('keyboard: open the Export menu, Tab to Word and Enter downloads', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await expect(page.locator('.graph-card').first()).toBeVisible();
  await page.locator(EXPORT_MENU).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.locator(WORD_BUTTON)).toBeFocused();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.keyboard.press('Enter'),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
  // The menu closes after the choice and focus goes back to its button.
  await expect(page.locator(WORD_BUTTON)).toBeHidden();
  await expect(page.locator(EXPORT_MENU)).toBeFocused();
});

test('menu is hidden on the home gallery and Word is disabled during layout preview', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator(EXPORT_MENU)).toBeHidden();
  await page.locator('[data-template=mind-project]').click();
  await page.locator(EXPORT_MENU).click();
  await expect(page.locator(WORD_BUTTON)).toBeVisible();
  await page.locator(EXPORT_MENU).click();
  await page.locator('[data-action=layout]').click();
  await expect(page.locator('#layout-preview-bar')).toBeVisible();
  await page.locator(EXPORT_MENU).click();
  await expect(page.locator(WORD_BUTTON)).toBeDisabled();
  await page.locator(EXPORT_MENU).click();
  await page.locator('[data-action=layout-cancel]').click();
  await expect(page.locator(WORD_BUTTON)).toBeEnabled();
});
