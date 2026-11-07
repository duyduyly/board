import { test, expect } from '@playwright/test';
test('inline bold survives Apply', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('[data-block-label=blockParagraph]').click();
  const p = page.frameLocator('#block-editor .gjs-frame').locator('p');
  await p.dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('Bold text');
  await page.keyboard.press('Control+a');
  await page.locator('.gjs-rte-toolbar [data-locale-key=blockBold]').click();
  await expect(p.locator('b,strong')).toHaveText('Bold text');
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  expect(JSON.stringify(card.extensions['card-atlas:document'])).toMatch(/"tag":"(b|strong)"/);
});

test('selected link can be assigned a safe address', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('[data-block-label=blockParagraph]').click();
  const p = page.frameLocator('#block-editor .gjs-frame').locator('p');
  await p.dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('Link text');
  await page.keyboard.press('Control+a');
  await page.locator('.gjs-rte-toolbar [data-locale-key=blockLink]').click();
  const field = page.locator('.block-editor-link input');
  await expect(field).toBeVisible();
  await field.fill('javascript:alert(1)');
  await page.locator('.block-editor-link button').click();
  await expect(page.locator('.block-editor-notice')).toContainText('liên kết');
  await field.fill('https://example.com/learn');
  await page.locator('.block-editor-link button').click();
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  expect(JSON.stringify(card.extensions['card-atlas:document'])).toContain(
    'https://example.com/learn',
  );
  await page.locator(`[data-id="${card.id}"]`).focus();
  await page.keyboard.press('Enter');
  const reopenedLink = page.frameLocator('#block-editor .gjs-frame').locator('a');
  await expect(reopenedLink).toHaveAttribute('href', 'https://example.com/learn');
  await reopenedLink.click();
  await expect(field).toHaveValue('https://example.com/learn');
  await field.fill('https://example.org/updated');
  await page.locator('.block-editor-link button').click();
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const updated = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  expect(JSON.stringify(updated.extensions['card-atlas:document'])).toContain(
    'https://example.org/updated',
  );
});

test('rich text controls use the chosen language and expose keyboard labels', async ({ page }) => {
  await page.goto('/');
  await page.locator('#locale').selectOption('en');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('[data-block-label=blockParagraph]').click();
  const p = page.frameLocator('#block-editor .gjs-frame').locator('p');
  await p.dblclick();
  const bold = page.locator('.gjs-rte-toolbar [data-locale-key=blockBold]');
  await expect(bold).toHaveAttribute('aria-label', 'Bold');
  await expect(bold).toHaveAttribute('role', 'button');
  await expect(bold).toHaveAttribute('tabindex', '0');
  await expect(page.locator('[data-block-label=blockParagraph]')).toHaveAttribute('aria-label', 'Paragraph');
});

test('keyboard activates bold on selected text', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('[data-block-label=blockParagraph]').click();
  const p = page.frameLocator('#block-editor .gjs-frame').locator('p');
  await p.dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('Text');
  await page.keyboard.press('Control+a');
  const bold = page.locator('.gjs-rte-toolbar [data-locale-key=blockBold]');
  await expect(bold).toBeVisible();
  await bold.focus();
  await expect(bold).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(p.locator('b,strong')).toHaveText('Text');
});

for (const [block, selector] of [
  ['blockList', 'ul li'],
  ['blockOrderedList', 'ol li'],
  ['blockQuote', 'blockquote'],
]) {
  test(`${block} can be edited and retained`, async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-template=personal]').click();
    await page.locator('[data-palette-kind=card]').click();
    await page.keyboard.press('Enter');
    await page.locator(`[data-block-label=${block}]`).click();
    const element = page.frameLocator('#block-editor .gjs-frame').locator(selector);
    await element.dblclick();
    await page.keyboard.press('Control+a');
    await page.keyboard.insertText('Ghi chú học tập');
    await expect(element).toHaveText('Ghi chú học tập');
    await page.locator('#panel-body [type=submit]').click();
    await expect(page.locator('#detail-panel')).not.toBeVisible();
    const card = await page.evaluate(async () =>
      (await import('/assets/js/app.js')).store.project.cards.at(-1),
    );
    expect(card.content).toContain('Ghi chú học tập');
  });
}

for (const [block, tag] of [
  ['blockOrderedList', 'ol'],
  ['blockList', 'ul'],
])
  test(`${tag} adds and reopens multiple items`, async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-template=personal]').click();
    await page.locator('[data-palette-kind=card]').click();
    await page.keyboard.press('Enter');
    await page.locator(`[data-block-label=${block}]`).click();
    const list = page.frameLocator('#block-editor .gjs-frame').locator(tag);
    await list.locator('li').dblclick();
    await page.keyboard.press('Control+a');
    await page.keyboard.insertText('One');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.insertText('Two');
    await expect(list.locator('li')).toHaveCount(2);
    await page.locator('#panel-body [type=submit]').click();
    await expect(page.locator('#detail-panel')).not.toBeVisible();
    const card = await page.evaluate(async () =>
      (await import('/assets/js/app.js')).store.project.cards.at(-1),
    );
    expect(card.content).toContain('Two');
    await page.locator(`[data-id="${card.id}"]`).focus();
    await page.keyboard.press('Enter');
    await expect(list.locator('li')).toHaveCount(2);
    await expect(list.locator('li').nth(1)).toHaveText('Two');
  });
