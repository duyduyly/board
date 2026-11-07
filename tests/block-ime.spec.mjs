import { test, expect } from '@playwright/test';

test('IME composition followed by Apply preserves Vietnamese text', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CDP IME protocol is available in Chromium only');
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(page.locator('#block-editor .gjs-frame')).toBeVisible();
  await page.locator('[data-block-label=blockParagraph]').click();
  const paragraph = page.frameLocator('#block-editor .gjs-frame').locator('p');
  await paragraph.dblclick();
  await page.keyboard.press('Control+a');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'tie', selectionStart: 3, selectionEnd: 3 });
  await cdp.send('Input.imeSetComposition', { text: 'tiếng', selectionStart: 5, selectionEnd: 5 });
  await cdp.send('Input.insertText', { text: 'tiếng' });
  await page.keyboard.insertText(' Việt');
  await expect(paragraph).toHaveText('tiếng Việt');
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  expect(
    await page.evaluate(
      async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).content,
    ),
  ).toContain('tiếng Việt');
});

test('composition cancellation and replacement do not corrupt surrounding text', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CDP IME protocol is available in Chromium only');
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=blockParagraph]').click();
  const p = page.frameLocator('#block-editor .gjs-frame').locator('p');
  await p.dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('Hoc tap');
  await page.keyboard.press('Home');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'test', selectionStart: 4, selectionEnd: 4 });
  await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
  await expect(p).toHaveText('Hoc tap');
  await cdp.send('Input.imeSetComposition', { text: 'Học ', selectionStart: 4, selectionEnd: 4 });
  await cdp.send('Input.insertText', { text: 'Học ' });
  await expect(p).toHaveText('Học Hoc tap');
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  expect(
    await page.evaluate(
      async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).content,
    ),
  ).toContain('Học Hoc tap');
});

test('simulated backspace and replacement preserves Vietnamese text in visual and HTML editors', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=blockParagraph]').click();
  const paragraph = page.frameLocator('#block-editor .gjs-frame').locator('p');
  await paragraph.dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('tie');
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText('ế');
  await page.keyboard.type('ng');
  await expect(paragraph).toHaveText('tiếng');
  await page.locator('[data-editor-mode=html]').click();
  const source = page.locator('[data-editor-source]');
  await source.fill('<p>tie</p>');
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText('ế');
  await page.keyboard.type('ng');
  await expect(source).toHaveText('<p>tiếng</p>');
  await page.locator('[data-editor-mode=visual]').click();
  await expect(paragraph).toHaveText('tiếng');
  await page.locator('#panel-body [type=submit]').click();
  const content = await page.evaluate(
    async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).content,
  );
  expect(content).toContain('tiếng');
});
