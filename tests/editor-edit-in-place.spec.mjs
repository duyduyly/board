import { test, expect } from '@playwright/test';

const FRAME = '#block-editor .gjs-frame';

async function openEditor(page, html) {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-editor-mode=html]').click();
  await page.locator('[data-editor-source]').fill(html);
  await page.locator('[data-editor-mode=visual]').click();
  const frame = page.frameLocator(FRAME);
  await expect(frame.locator('h1')).toBeVisible();
  return frame;
}

async function applyAndRead(page) {
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  return page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { documentHTML } = await import('/assets/js/graph/html-document.js');
    return documentHTML(store.project.cards.at(-1).extensions['card-atlas:document']);
  });
}

const DOCUMENT =
  '<h1>Title</h1>' +
  '<div class="alert alert-info">Callout</div>' +
  '<div class="card"><div class="card-body"><h5 class="card-title">Heading</h5><p class="card-text">Body</p></div></div>' +
  '<table class="table table-bordered"><tbody><tr><th>Head</th></tr><tr><td>Cell</td></tr></tbody></table>';

for (const [name, selector, saved] of [
  ['a callout', 'div.alert', '<div class="alert alert-info">CalloutZZ</div>'],
  ['a card title', '.card-title', '<h5 class="card-title">HeadingZZ</h5>'],
  ['a card paragraph', '.card-text', '<p class="card-text">BodyZZ</p>'],
  ['a table header cell', 'th', '<th>HeadZZ</th>'],
  ['a table cell', 'td', '<td>CellZZ</td>'],
]) {
  test('a direct double-click edits ' + name + ' and the text is saved', async ({ page }) => {
    const frame = await openEditor(page, DOCUMENT);
    const target = frame.locator(selector).first();
    await target.dblclick();
    await expect(target).toHaveAttribute('contenteditable', 'true');
    await page.keyboard.press('Control+End');
    await page.keyboard.type('ZZ');
    await expect(target).toContainText('ZZ');
    expect(await applyAndRead(page)).toContain(saved);
  });
}

test('selecting a block with a property panel does not move the page under the pointer', async ({
  page,
}) => {
  const frame = await openEditor(page, DOCUMENT);
  const callout = frame.locator('div.alert');
  const before = await callout.boundingBox();
  await callout.click();
  await expect(page.locator('.block-component-controls')).toBeVisible();
  const selected = await callout.boundingBox();
  expect(Math.abs(selected.y - before.y)).toBeLessThanOrEqual(1);
  await frame.locator('h1').click();
  await expect(page.locator('.block-component-controls')).toBeHidden();
  const after = await callout.boundingBox();
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
});
