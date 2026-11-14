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

/** Tag and text of each top-level block in the visual editor. */
const blocks = (frame) =>
  frame.locator('body').evaluate((body) => {
    const root = body.querySelector('[data-gjs-type=wrapper]') || body;
    return [...root.children]
      .filter((node) => !['STYLE', 'SCRIPT'].includes(node.tagName))
      .map((node) => node.tagName.toLowerCase() + ':' + node.textContent.trim());
  });

async function applyAndRead(page) {
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  return page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { documentHTML } = await import('/assets/js/graph/html-document.js');
    return documentHTML(store.project.cards.at(-1).extensions['card-atlas:document']);
  });
}

const LONG =
  '<h1>Title</h1><p>First</p>' +
  Array.from({ length: 30 }, (_, index) => '<p>Filler ' + index + '</p>').join('') +
  '<p>Last</p>';

test('a new block is inserted right after the selected block, selected and in view', async ({
  page,
}) => {
  const frame = await openEditor(page, LONG);
  await frame.locator('h1').click();
  await page.locator('[data-block-label=blockHeading]').click();
  const list = await blocks(frame);
  expect(list.slice(0, 3)).toEqual(['h1:Title', 'h2:...', 'p:First']);
  const added = frame.locator('h2');
  await expect(added).toHaveClass(/gjs-selected/);
  await expect(added).toBeInViewport();
});

test('with nothing selected a new block goes to the end and is scrolled into view', async ({
  page,
}) => {
  const frame = await openEditor(page, LONG);
  await page.locator('[data-block-label=blockQuote]').click();
  const list = await blocks(frame);
  expect(list.at(-1)).toBe('blockquote:...');
  expect(list.at(-2)).toBe('p:Last');
  await expect(frame.locator('blockquote')).toBeInViewport();
});

test('Enter starts a new paragraph and fast typing lands in it', async ({ page }) => {
  const frame = await openEditor(page, '<h1>Title</h1><p>First</p><p>Last</p>');
  await frame.locator('p', { hasText: 'First' }).dblclick();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Second paragraph');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Third');
  await expect(frame.locator('p', { hasText: 'Third' })).toBeVisible();
  expect(await blocks(frame)).toEqual([
    'h1:Title',
    'p:First',
    'p:Second paragraph',
    'p:Third',
    'p:Last',
  ]);
  expect(await applyAndRead(page)).toBe(
    '<h1>Title</h1><p>First</p><p>Second paragraph</p><p>Third</p><p>Last</p>',
  );
});

test('Enter in the middle splits the paragraph and keeps inline formatting', async ({ page }) => {
  const frame = await openEditor(page, '<h1>Title</h1><p>Alpha <strong>Beta</strong> Gamma</p>');
  await frame.locator('p').dblclick();
  await page.keyboard.press('Control+End');
  for (let step = 0; step < ' Gamma'.length; step += 1) await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await page.keyboard.type('New');
  await expect(frame.locator('p')).toHaveCount(2);
  await expect(frame.locator('p').nth(1)).toContainText('New');
  const html = await applyAndRead(page);
  expect(html).toMatch(
    /^<h1>Title<\/h1><p>Alpha <strong>Beta<\/strong><\/p><p>New(?: |&nbsp;)?Gamma<\/p>$/,
  );
});

test('Shift+Enter keeps a line break inside the same paragraph', async ({ page }) => {
  const frame = await openEditor(page, '<h1>Title</h1><p>First</p>');
  await frame.locator('p').dblclick();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('Line');
  await expect(frame.locator('p')).toHaveCount(1);
  expect(await applyAndRead(page)).toBe('<h1>Title</h1><p>First<br>Line</p>');
});

test('Enter at the end of a heading continues with a paragraph', async ({ page }) => {
  const frame = await openEditor(page, '<h1>Title</h1><p>Body</p>');
  await frame.locator('h1').dblclick();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Intro');
  await expect(frame.locator('p', { hasText: 'Intro' })).toBeVisible();
  expect(await applyAndRead(page)).toBe('<h1>Title</h1><p>Intro</p><p>Body</p>');
});

test('Enter inside a list still adds a list item', async ({ page }) => {
  const frame = await openEditor(page, '<h1>Title</h1><ul><li>One</li></ul>');
  await frame.locator('ul').dblclick();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Two');
  await expect(frame.locator('li')).toHaveCount(2);
  expect(await applyAndRead(page)).toMatch(/<ul><li[^>]*>One<\/li><li[^>]*>Two<\/li><\/ul>$/);
});
