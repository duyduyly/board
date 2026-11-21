import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { TextDecoder } from 'node:util';
import { readZip } from './docx-zip-reader.mjs';
import { exportMenuAction } from './ui-driver.mjs';

const TOAST = {
  vi: {
    done: 'Đã yêu cầu tải file Markdown (.zip). Hãy kiểm tra trong Downloads.',
    empty: 'Dự án chưa có ghi chú nào để xuất Markdown.',
  },
  en: { done: 'Markdown download requested (.zip). Check your Downloads.' },
};
const NO_DOWNLOAD_WAIT_MS = 1200;

async function exportMarkdown(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exportMenuAction(page, 'export-markdown'),
  ]);
  expect(await download.failure()).toBeNull();
  return download;
}

const projectData = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return {
      title: store.project.metadata.title,
      cards: store.project.cards.map((card) => card.title).filter((value) => value?.trim()),
    };
  });

test('template with groups exports a zip with Markdown, logo and contents', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('[data-template=learning-atlas]').click();
  await expect(page.locator('.graph-card').first()).toBeVisible();
  const { title, cards } = await projectData(page);
  const download = await exportMarkdown(page);
  expect(download.suggestedFilename()).toBe(title + '.zip');
  const zip = readZip(new Uint8Array(fs.readFileSync(await download.path())));
  expect([...zip.keys()]).toContain(title + '.md');
  const logo = zip.get('images/card-atlas-logo.png');
  expect([...logo.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  const text = new TextDecoder().decode(zip.get(title + '.md'));
  expect(text).toContain('<img src="images/card-atlas-logo.png"');
  expect(text).toContain('## Mục lục');
  expect(text).toMatch(/\]\(#c1\)/);
  expect(text).toContain('<a id="c1"></a>');
  // Titles are escaped for Markdown (`\[`, `\.`), so compare them without the backslashes.
  const unescaped = text.replace(/\\(.)/g, '$1');
  for (const cardTitle of cards.slice(0, 3)) expect(unescaped).toContain(cardTitle);
  await expect(page.locator('#toast[role=status]')).toContainText(TOAST.vi.done);
  expect(errors).toEqual([]);
});

test('attached images are written to the images folder and linked', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await expect(page.locator('.graph-card').first()).toBeVisible();
  const attached = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.some(
      (card) => Object.keys(card.extensions?.['card-atlas:images'] || {}).length,
    ),
  );
  const download = await exportMarkdown(page);
  const zip = readZip(new Uint8Array(fs.readFileSync(await download.path())));
  const images = [...zip.keys()].filter((name) => /^images\/image-\d{3}\./.test(name));
  const markdown = [...zip.keys()].find((name) => name.endsWith('.md'));
  const text = new TextDecoder().decode(zip.get(markdown));
  for (const name of images) expect(text).toContain('(' + name + ')');
  if (attached) expect(images.length).toBeGreaterThan(0);
});

test('success toast is localised', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await expect(page.locator('.graph-card').first()).toBeVisible();
  await page.locator('#locale').selectOption('en');
  await exportMarkdown(page);
  await expect(page.locator('#toast[role=status]')).toContainText(TOAST.en.done);
});

test('empty project shows a notice and downloads nothing', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-action=new]').click();
  await page.locator('[data-choice=create]').click();
  await expect(page.locator('.graph-card')).toHaveCount(0);
  let downloaded = false;
  page.on('download', () => (downloaded = true));
  await exportMenuAction(page, 'export-markdown');
  await page.waitForTimeout(NO_DOWNLOAD_WAIT_MS);
  expect(downloaded).toBe(false);
  await expect(page.locator('#toast[role=status]')).toContainText(TOAST.vi.empty);
});
