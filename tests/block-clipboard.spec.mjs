import { test, expect } from '@playwright/test';

test('native clipboard paste and continued typing persist', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  const frame = page.frameLocator('#block-editor .gjs-frame');
  await expect(page.locator('#block-editor .gjs-frame')).toBeVisible();
  await page.locator('[data-block-label=blockParagraph]').click();
  await page.evaluate(() => {
    const input = document.createElement('textarea');
    input.id = 'clipboard-test-source';
    input.value = 'Sao chép tiếng Việt';
    document.querySelector('#block-editor').prepend(input);
    input.focus();
    input.select();
  });
  await page.keyboard.press('Control+c');
  await frame.locator('p').dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+v');
  await expect(frame.locator('p')).toContainText('Sao chép tiếng Việt');
  await page.keyboard.insertText(' tiếp tục');
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  expect(
    await page.evaluate(
      async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).content,
    ),
  ).toContain('Sao chép tiếng Việt tiếp tục');
});

test('multiline text copied into a paragraph survives Apply and reopen', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=blockParagraph]').click();
  await page.evaluate(() => {
    const input = document.createElement('textarea');
    input.value = 'Dòng một\nDòng hai\nDòng ba';
    document.querySelector('#block-editor').prepend(input);
    input.focus();
    input.select();
  });
  await page.keyboard.press('Control+c');
  const p = page.frameLocator('#block-editor .gjs-frame').locator('p');
  await p.dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+v');
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  expect(card.content).toContain('Dòng một');
  expect(card.content).toContain('Dòng hai');
  expect(card.content).toContain('Dòng ba');
  expect(card.content).toMatch(/Dòng một\s*\n\s*Dòng hai\s*\n\s*Dòng ba/);
  await page.locator(`[data-id="${card.id}"]`).focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  const editor = page.frameLocator('#block-editor .gjs-frame');
  await expect(editor.locator('body')).toContainText('Dòng một');
  await expect(editor.locator('body')).toContainText('Dòng hai');
  await expect(editor.locator('body')).toContainText('Dòng ba');
});
