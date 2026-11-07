import { test, expect } from '@playwright/test';

test('HTML import previews removals and only adds reviewed safe content', async ({ page }) => {
  const remote = [];
  page.on('request', (r) => {
    if (r.url().startsWith('https://example.com')) remote.push(r.url());
  });
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=htmlImportTitle]').click();
  const source = page.locator('[data-html-source]');
  const html =
    '<div class="row"><div class="col-md-6"><p onclick="alert(1)">Hello <strong>world</strong></p><script>window.evil=1</script><img src="javascript:alert(1)"><a href="javascript:alert(1)">link</a></div></div>';
  await source.fill(html);
  await page.locator('[data-html-review]').click();
  await expect(source).toHaveValue(html);
  await expect(page.locator('[data-html-result]')).toContainText('đã loại');
  const preview = page.locator('[data-html-preview]');
  await expect(preview).toContainText('class="row"');
  await expect(preview).not.toContainText('<script>');
  await expect(preview).not.toContainText('onclick');
  await expect(preview).not.toContainText('javascript:');
  const frame = page.frameLocator('#block-editor .gjs-frame');
  await expect(frame.locator('.row')).toHaveCount(0);
  await page.locator('[data-html-accept]').click();
  await expect(frame.locator('.row .col-md-6 strong')).toHaveText('world');
  await expect(frame.locator('script')).toHaveCount(0);
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  expect(card.content).toContain('Hello');
  expect(JSON.stringify(card.extensions['card-atlas:document'])).not.toContain('javascript:');
  expect(await page.evaluate(() => window.evil)).toBeUndefined();
  expect(remote).toEqual([]);
});

test('HTML review can be canceled and changing source invalidates preview', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=htmlImportTitle]').click();
  await page.locator('[data-html-source]').fill('<p>First</p>');
  await page.locator('[data-html-review]').click();
  await expect(page.locator('[data-html-accept]')).toBeEnabled();
  await page.locator('[data-html-source]').fill('<p>Changed</p>');
  await expect(page.locator('[data-html-accept]')).toBeDisabled();
  await page.locator('[data-html-cancel]').click();
  await expect(page.frameLocator('#block-editor .gjs-frame').locator('p')).toHaveCount(0);
});

test('HTML clipboard paste requires review before insertion', async ({ page, browserName }) => {
  test.skip(
    browserName !== 'chromium',
    'Browser clipboard rich MIME setup is not available in Firefox',
  );
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=blockParagraph]').click();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(async () =>
    navigator.clipboard.write([
      new window.ClipboardItem({
        'text/plain': new Blob(['Clipboard'], { type: 'text/plain' }),
        'text/html': new Blob(
          ['<p onclick="bad()"><strong>Clipboard</strong></p><script>bad()</script>'],
          { type: 'text/html' },
        ),
      }),
    ]),
  );
  const frame = page.frameLocator('#block-editor .gjs-frame');
  await frame.locator('p').dblclick();
  await page.keyboard.press('Control+v');
  await expect(page.locator('[data-html-result]')).toBeVisible();
  await expect(page.locator('[data-html-result]')).toContainText('đã loại');
  await expect(frame.locator('strong')).toHaveCount(0);
  await page.locator('[data-html-accept]').click();
  await expect(frame.locator('strong')).toHaveText('Clipboard');
});

test('HTML file import reviews content before insertion and enforces size limit', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=htmlImportTitle]').click();
  await page.locator('[data-html-file]').setInputFiles({
    name: 'sample.html',
    mimeType: 'text/html',
    buffer: Buffer.from('<p class="lead">File content</p>'),
  });
  await page.locator('[data-html-review]').click();
  await expect(page.locator('[data-html-preview]')).toContainText('File content');
  await page.locator('[data-html-accept]').click();
  await expect(page.frameLocator('#block-editor .gjs-frame').locator('p.lead')).toHaveText(
    'File content',
  );
  await page.locator('[data-block-label=htmlImportTitle]').click();
  await page.locator('[data-html-file]').setInputFiles({
    name: 'large.html',
    mimeType: 'text/html',
    buffer: Buffer.alloc(1000001, 65),
  });
  await expect(page.locator('[data-html-result]')).toContainText('1 MB');
  await expect(page.locator('[data-html-accept]')).toBeDisabled();
});

test('native rich text copy opens HTML review', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=blockParagraph]').click();
  await page.evaluate(() => {
    const node = document.createElement('div');
    node.setAttribute('contenteditable', 'true');
    node.innerHTML = '<strong>Copied rich text</strong>';
    document.querySelector('#block-editor').prepend(node);
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.keyboard.press('Control+c');
  const frame = page.frameLocator('#block-editor .gjs-frame');
  await frame.locator('p').dblclick();
  await page.keyboard.press('Control+v');
  await expect(page.locator('[data-html-result]')).toBeVisible();
  await expect(page.locator('[data-html-preview]')).toContainText('Copied rich text');
  await page.locator('[data-html-accept]').click();
  await expect(frame.locator('strong')).toHaveText('Copied rich text');
});
