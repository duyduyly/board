import { test, expect } from '@playwright/test';

test('editor undo and redo change the draft independently of project history', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  const frame = page.frameLocator('#block-editor .gjs-frame');
  await expect(page.locator('#block-editor .gjs-frame')).toBeVisible();
  const history = await page.evaluate(
    async () => (await import('/assets/js/app.js')).store.undoStack.length,
  );
  await page.locator('[data-block-label=blockParagraph]').click();
  await expect(frame.locator('p')).toHaveCount(1);
  await page.locator('[data-block-label=blockUndo]').click();
  await expect(frame.locator('p')).toHaveCount(0);
  await page.locator('[data-block-label=blockRedo]').click();
  await expect(frame.locator('p')).toHaveCount(1);
  await frame.locator('p').dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('Một ý tưởng');
  await page.locator('[data-block-label=blockQuote]').focus();
  await page.locator('[data-block-label=blockUndo]').click();
  await expect(frame.locator('p')).not.toHaveText('Một ý tưởng');
  await page.locator('[data-block-label=blockRedo]').click();
  await expect(frame.locator('p')).toHaveText('Một ý tưởng');
  expect(
    await page.evaluate(async () => (await import('/assets/js/app.js')).store.undoStack.length),
  ).toBe(history);
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  expect(
    await page.evaluate(async () => (await import('/assets/js/app.js')).store.undoStack.length),
  ).toBe(history + 1);
});

test('keyboard undo inside the editor does not undo the project', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await expect(page.locator('#block-editor .gjs-frame')).toBeVisible();
  await page.locator('[data-block-label=blockParagraph]').click();
  const paragraph = page.frameLocator('#block-editor .gjs-frame').locator('p');
  const history = await page.evaluate(
    async () => (await import('/assets/js/app.js')).store.undoStack.length,
  );
  await paragraph.dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('A new idea');
  await page.keyboard.press('Control+z');
  await expect(paragraph).not.toHaveText('A new idea');
  await page.keyboard.press('Control+Shift+z');
  await expect(paragraph).toHaveText('A new idea');
  expect(
    await page.evaluate(async () => (await import('/assets/js/app.js')).store.undoStack.length),
  ).toBe(history);
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  expect(
    await page.evaluate(
      async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).content,
    ),
  ).toContain('A new idea');
});

test('undo and redo inline formatting preserves the chosen result on Apply', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('[data-block-label=blockParagraph]').click();
  const p = page.frameLocator('#block-editor .gjs-frame').locator('p');
  await p.dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('Important');
  await page.keyboard.press('Control+a');
  await page.locator('.gjs-rte-toolbar [data-locale-key=blockBold]').click();
  await expect(p.locator('b,strong')).toHaveText('Important');
  await page.locator('.gjs-rte-toolbar [data-locale-key=blockBold]').focus();
  await page.keyboard.press('Control+z');
  await expect(p.locator('b,strong')).toHaveCount(0);
  await page.keyboard.press('Control+Shift+z');
  await expect(p.locator('b,strong')).toHaveText('Important');
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  expect(JSON.stringify(card.extensions['card-atlas:document'])).toMatch(/"tag":"(b|strong)"/);
});

test('undo in the link address input stays in that input', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('[data-block-label=blockParagraph]').click();
  const p = page.frameLocator('#block-editor .gjs-frame').locator('p');
  await p.dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('Resource');
  await page.keyboard.press('Control+a');
  await page.locator('.gjs-rte-toolbar [data-locale-key=blockLink]').click();
  const input = page.locator('.block-editor-link input');
  await input.focus();
  await page.keyboard.type('https://example.com');
  await expect(input).toHaveValue('https://example.com');
  const history = await page.evaluate(
    async () => (await import('/assets/js/app.js')).store.undoStack.length,
  );
  await page.keyboard.press('Control+z');
  await expect(input).not.toHaveValue('https://example.com');
  expect(
    await page.evaluate(async () => (await import('/assets/js/app.js')).store.undoStack.length),
  ).toBe(history);
  await expect(p).toContainText('Resource');
});
