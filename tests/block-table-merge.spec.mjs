import { test, expect } from '@playwright/test';

async function openTable(page, html) {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-editor-mode=html]').click();
  await page.locator('[data-editor-source]').fill(html);
  await page.locator('[data-editor-mode=visual]').click();
  return page.frameLocator('#block-editor .gjs-frame').locator('table');
}

test('merge right preserves structured contents and supports undo, redo and save', async ({
  page,
}) => {
  const table = await openTable(
    page,
    '<table><tbody><tr><td><strong>First</strong></td><td><em>Second</em></td></tr></tbody></table>',
  );
  await table.locator('td').first().click();
  await page.locator('[data-table-merge-right]').click();
  await expect(table.locator('td')).toHaveCount(1);
  await expect(table.locator('td')).toHaveAttribute('colspan', '2');
  await expect(table.locator('strong')).toHaveText('First');
  await expect(table.locator('em')).toHaveText('Second');
  await expect(table.locator('td br')).toHaveCount(1);
  await page.locator('[data-block-label=blockUndo]').click();
  await expect(table.locator('td')).toHaveCount(2);
  await expect(table.locator('td').first()).toHaveText('First');
  await expect(table.locator('td').last()).toHaveText('Second');
  await page.locator('[data-block-label=blockRedo]').click();
  await expect(table.locator('td')).toHaveCount(1);
  await expect(table.locator('em')).toHaveText('Second');
  await page.locator('[data-editor-mode=html]').click();
  await expect(page.locator('[data-editor-source]')).toContainText('colspan="2"');
  await page.locator('[data-editor-mode=visual]').click();
  await page.locator('#panel-body [type=submit]').click();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  await page.locator(`[data-id="${card.id}"]`).focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(table.locator('td')).toHaveAttribute('colspan', '2');
  await expect(table.locator('strong')).toHaveText('First');
  await expect(table.locator('em')).toHaveText('Second');
});

test('merge is disabled for incompatible or attributed cells and complex tables', async ({
  page,
}) => {
  const table = await openTable(
    page,
    '<table><tbody><tr><td>A</td><td title="keep">B</td></tr></tbody></table>',
  );
  await table.locator('td').first().click();
  await expect(page.locator('[data-table-merge-right]')).toBeDisabled();
  await expect(table.locator('td').last()).toHaveAttribute('title', 'keep');
  await page.locator('[data-editor-mode=html]').click();
  await page
    .locator('[data-editor-source]')
    .fill('<table><tbody><tr><td colspan="2">A</td><td>B</td></tr></tbody></table>');
  await page.locator('[data-editor-mode=visual]').click();
  await table.locator('td').first().click();
  await expect(page.locator('[data-table-merge-right]')).toBeDisabled();
  await expect(table.locator('td')).toHaveCount(2);
});

test('cancel discards a merge of an already saved table', async ({ page }) => {
  const table = await openTable(
    page,
    '<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>',
  );
  await page.locator('#panel-body [type=submit]').click();
  const before = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  await page.locator(`[data-id="${before.id}"]`).focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await table.locator('td').first().click();
  await page.locator('[data-table-merge-right]').click();
  await expect(table.locator('td')).toHaveCount(1);
  await page.locator('#panel-body button[type=button]').filter({ hasText: /Hủy/ }).last().click();
  const after = await page.evaluate(
    async (id) =>
      (await import('/assets/js/app.js')).store.project.cards.find((card) => card.id === id),
    before.id,
  );
  expect(after).toEqual(before);
});
