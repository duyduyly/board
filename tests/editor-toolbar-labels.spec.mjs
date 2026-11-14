import { test, expect } from '@playwright/test';
import { locale } from './ui-driver.mjs';

const FRAME = '#block-editor .gjs-frame';

async function openEditor(page, lang = 'vi') {
  await page.goto('/');
  if (lang !== 'vi') await locale(page, lang);
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(page.locator('#block-editor')).not.toHaveAttribute('aria-busy', 'true');
}

const tool = (page, key) => page.locator('.block-editor-tools [data-block-label=' + key + ']');

test('the most used blocks show a text label and no two blocks share an icon', async ({ page }) => {
  await openEditor(page);
  await expect(tool(page, 'blockParagraph')).toContainText('Đoạn văn');
  await expect(tool(page, 'blockHeading')).toContainText('Tiêu đề');
  await expect(tool(page, 'blockList')).toContainText('Danh sách');
  await expect(tool(page, 'blockTable')).toContainText('Bảng');
  await expect(tool(page, 'insertImage')).toContainText('Ảnh');
  await expect(tool(page, 'htmlImportTitle')).toContainText('Nhập HTML');
  const icons = await page
    .locator('.block-editor-tools [data-block-label]')
    .evaluateAll((buttons) =>
      buttons.map((button) => (button.querySelector('[aria-hidden]') || button).textContent.trim()),
    );
  expect(new Set(icons).size).toBe(icons.length);
  // The visual-mode toolbar must not leak the code-mode import button.
  await expect(page.locator('[data-editor-import]')).toBeHidden();
});

test('English locale translates the button labels', async ({ page }) => {
  await openEditor(page, 'en');
  await expect(tool(page, 'blockParagraph')).toContainText('Paragraph');
  await expect(tool(page, 'insertImage')).toContainText('Image');
});

for (const [lang, names, badge] of [
  ['vi', ['Chọn khối cha', 'Kéo để di chuyển khối', 'Nhân bản khối', 'Xóa khối'], 'Văn bản'],
  [
    'en',
    ['Select the parent block', 'Drag to move the block', 'Duplicate block', 'Delete block'],
    'Text',
  ],
]) {
  test('the selected block toolbar and type badge are named in ' + lang, async ({ page }) => {
    await openEditor(page, lang);
    await tool(page, 'blockParagraph').click();
    const frame = page.frameLocator(FRAME);
    await expect(frame.locator('p')).toHaveClass(/gjs-selected/);
    const items = page.locator('.gjs-toolbar-item');
    await expect(items).toHaveCount(4);
    for (const [index, name] of names.entries()) {
      await expect(items.nth(index)).toHaveAttribute('title', name);
      await expect(items.nth(index)).toHaveAttribute('aria-label', name);
    }
    // The type badge belongs to the hovered block.
    await frame.locator('p').hover();
    await expect(page.locator('.gjs-badge').filter({ hasText: badge })).toHaveCount(1);
  });
}

test('the import panel uses worded buttons and a translated file button', async ({ page }) => {
  await openEditor(page);
  await tool(page, 'htmlImportTitle').click();
  await expect(page.locator('[data-html-file-button]')).toHaveText('Chọn tệp HTML');
  await expect(page.locator('[data-html-review]')).toHaveText('Kiểm tra HTML');
  await expect(page.locator('[data-html-accept]')).toHaveText('Thêm nội dung đã kiểm tra');
  await expect(page.locator('[data-html-cancel]')).toHaveText('Hủy');
  await expect(page.locator('[data-html-file]')).toBeHidden();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('[data-html-file-button]').click();
  await (
    await chooser
  ).setFiles({
    name: 'sample.html',
    mimeType: 'text/html',
    buffer: Buffer.from('<p>From file</p>'),
  });
  await expect(page.locator('[data-html-source]')).toHaveValue('<p>From file</p>');
  await page.locator('[data-html-review]').click();
  await expect(page.locator('[data-html-preview]')).toContainText('From file');
});

test('code mode shows one block per visual line without changing the source text', async ({
  page,
}) => {
  await openEditor(page);
  await page.locator('[data-editor-mode=html]').click();
  const source = page.locator('[data-editor-source]');
  const html = '<h1>Title</h1><p>One</p><ul><li>A</li><li>B</li></ul><p>Two</p>';
  await source.fill(html);
  await expect(source).toHaveText(html);
  expect(await source.evaluate((node) => node.textContent.includes('\n'))).toBe(false);
  await expect(page.locator('.cm-line')).toHaveCount(1);
  await expect(page.locator('.cm-soft-break')).toHaveCount(6);
  const tops = await page.evaluate(() => {
    const top = (text) => {
      const walker = document.createTreeWalker(
        document.querySelector('.cm-content'),
        window.NodeFilter.SHOW_TEXT,
      );
      for (let node = walker.nextNode(); node; node = walker.nextNode())
        if (node.textContent.includes(text)) {
          const range = document.createRange();
          range.selectNodeContents(node);
          return Math.round(range.getBoundingClientRect().top);
        }
      return -1;
    };
    return [top('Title'), top('One'), top('Two')];
  });
  expect(tops[1]).toBeGreaterThan(tops[0]);
  expect(tops[2]).toBeGreaterThan(tops[1]);
});
