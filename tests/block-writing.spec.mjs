import { test, expect } from '@playwright/test';

test('writing mode preserves HTML draft and HTML export is self-contained', async ({ page }) => {
  const external = [];
  page.on('request', (r) => {
    if (
      !r.url().startsWith('http://127.0.0.1:4173') &&
      !r.url().startsWith('data:') &&
      !r.url().startsWith('about:') &&
      !r.url().startsWith('blob:')
    )
      external.push(r.url());
  });
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('[data-block-label=blockParagraph]').click();
  const p = page.frameLocator('#block-editor .gjs-frame').locator('p');
  await p.dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('Nội dung bản nháp');
  await page.locator('#html-writing-toggle').click();
  await expect(page.locator('html')).toHaveClass(/writing-mode/);
  await expect(p).toHaveText('Nội dung bản nháp');
  await page.evaluate(() => {
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      window.exportedBlob = blob;
      return original(blob);
    };
  });
  await page.locator('#download-html').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.exportedBlob))).toBe(true);
  const content = await page.evaluate(() => window.exportedBlob.text());
  expect(content).toContain('Nội dung bản nháp');
  expect(content).toContain('<style>');
  expect(content).toContain('Content-Security-Policy');
  expect(content).not.toMatch(/<script/i);
  expect(external).toEqual([]);
  await page.locator('#html-writing-toggle').click();
  await expect(page.locator('html')).not.toHaveClass(/writing-mode/);
  await expect(p).toHaveText('Nội dung bản nháp');
});

test('HTML export embeds local image instead of an attachment URI', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page
    .locator('#block-editor input[type=file][accept^="image/"]')
    .setInputFiles('tests/fixtures/english-endings.png');
  await expect(page.frameLocator('#block-editor .gjs-frame').locator('img')).toBeVisible();
  await page.evaluate(() => {
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      window.exportedBlob = blob;
      return original(blob);
    };
  });
  await page.locator('#download-html').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.exportedBlob))).toBe(true);
  const html = await page.evaluate(() => window.exportedBlob.text());
  expect(html).toContain('data:image/png;base64,');
  expect(html).not.toContain('attachment:');
});

test('HTML writing template appends editable blocks and stays in draft until Apply', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('[data-block-label=blockParagraph]').click();
  const frame = page.frameLocator('#block-editor .gjs-frame');
  const original = frame.locator('p').first();
  await original.dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('Nội dung gốc');
  await page.locator('[data-html-template]').selectOption('guide');
  await expect(frame.locator('h1')).toHaveText('Hướng dẫn');
  await expect(frame.locator('h2')).toHaveCount(4);
  await expect(original).toHaveText('Nội dung gốc');
  expect(
    await page.evaluate(
      async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).content,
    ),
  ).toBe('');
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  expect(card.content).toContain('Nội dung gốc');
  expect(card.content).toContain('Hướng dẫn');
});
