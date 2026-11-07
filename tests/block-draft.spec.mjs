import { test, expect } from '@playwright/test';

async function openNew(page) {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('[data-block-label=blockParagraph]').click();
  const p = page.frameLocator('#block-editor .gjs-frame').locator('p');
  await p.dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('Draft text');
  return p;
}

test('closing a dirty editor can be canceled or discarded without project changes', async ({
  page,
}) => {
  const p = await openNew(page);
  const before = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return { content: store.project.cards.at(-1).content, history: store.undoStack.length };
  });
  await page.locator('#detail-panel [data-action=close]').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('[data-choice=cancel]').click();
  await expect(p).toHaveText('Draft text');
  await page.locator('#detail-panel [data-action=close]').click();
  await page.locator('[data-choice=discard]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const after = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return { content: store.project.cards.at(-1).content, history: store.undoStack.length };
  });
  expect(after).toEqual(before);
});

test('invalid document retains editor draft and never commits', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('[data-block-label=blockCode]').click();
  const code = page.frameLocator('#block-editor .gjs-frame').locator('code');
  await code.click();
  const input = page.locator('[data-code-text]');
  await input.click();
  await expect(input).toBeFocused();
  const huge = 'x'.repeat(100001);
  await input.fill(huge);
  const before = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return { content: store.project.cards.at(-1).content, history: store.undoStack.length };
  });
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(page.locator('#panel-body .form-errors')).not.toBeEmpty();
  await expect(input).toHaveValue(huge);
  const after = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return { content: store.project.cards.at(-1).content, history: store.undoStack.length };
  });
  expect(after).toEqual(before);
});

test('cancel button restores the original draft without changing project history', async ({
  page,
}) => {
  await openNew(page);
  const history = await page.evaluate(
    async () => (await import('/assets/js/app.js')).store.undoStack.length,
  );
  await page.locator('#cancel-draft').click();
  await expect(page.locator('#block-editor .gjs-frame')).toBeVisible();
  await expect(page.frameLocator('#block-editor .gjs-frame').locator('p')).toHaveCount(0);
  expect(
    await page.evaluate(async () => (await import('/assets/js/app.js')).store.undoStack.length),
  ).toBe(history);
});

test('Fit failure preserves the HTML draft and project transaction', async ({ page }) => {
  await page.goto('/');
  const project = {
    version: '1.0',
    cards: [
      {
        id: 'fit-html',
        title: 'Very long title '.repeat(200),
        content: '',
        extensions: {
          'card-atlas:appearance': { sizeMode: 'fit' },
          'card-atlas:typography': { title: { fontSize: 72 } },
          'card-atlas:document': { version: 1, format: 'html-bs5', components: [] },
        },
      },
    ],
    relations: [],
  };
  await page.locator('#file-input').setInputFiles({
    name: 'fit.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-id=fit-html]').focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-block-label=blockParagraph]').click();
  const p = page.frameLocator('#block-editor .gjs-frame').locator('p');
  await p.dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('Draft survives fit failure');
  const before = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return { content: store.project.cards[0].content, history: store.undoStack.length };
  });
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(page.locator('#panel-body .form-errors')).not.toBeEmpty();
  await expect(p).toHaveText('Draft survives fit failure');
  const after = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return { content: store.project.cards[0].content, history: store.undoStack.length };
  });
  expect(after).toEqual(before);
});

test('pin lock rejects a pending HTML draft without discarding it', async ({ page }) => {
  const p = await openNew(page);
  const before = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { togglePinned } = await import('/assets/js/graph/card-metadata.js');
    store.commit((project) => togglePinned(project.cards.at(-1)));
    return { content: store.project.cards.at(-1).content, history: store.undoStack.length };
  });
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(p).toHaveText('Draft text');
  const after = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return { content: store.project.cards.at(-1).content, history: store.undoStack.length };
  });
  expect(after).toEqual(before);
});
