import { test, expect } from '@playwright/test';
import { locale } from './ui-driver.mjs';

const FRAME = '#block-editor .gjs-frame';
const HTML = '<h1>Title</h1><p>First</p><p>Second</p><p>Third</p>';

async function openEditor(page, lang = 'vi') {
  await page.goto('/');
  if (lang !== 'vi') await locale(page, lang);
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-editor-mode=html]').click();
  await page.locator('[data-editor-source]').fill(HTML);
  await page.locator('[data-editor-mode=visual]').click();
  const frame = page.frameLocator(FRAME);
  await expect(frame.locator('h1')).toBeVisible();
  return frame;
}

const libraryButton = (page) => page.locator('[data-block-label=elementLibrary]');
const tile = (page, key) => page.locator('[data-library-item=' + key + ']');

const blocks = (frame) =>
  frame.locator('body').evaluate((body) => {
    const root = body.querySelector('[data-gjs-type=wrapper]') || body;
    return [...root.children]
      .filter((node) => !['STYLE', 'SCRIPT'].includes(node.tagName) && !node.dataset.dropLine)
      .map((node) => node.tagName.toLowerCase());
  });

/** Drags a library tile and drops it at the top or bottom edge of a block of the page. */
async function dragTile(page, key, target, edge) {
  await tile(page, key).scrollIntoViewIfNeeded();
  const from = await tile(page, key).boundingBox();
  const to = await target.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + 24, { steps: 4 });
  await page.mouse.move(to.x + 60, edge === 'top' ? to.y + 3 : to.y + to.height - 3, { steps: 12 });
  await page.mouse.up();
}

test('the library opens from a labelled button and lists lesson, HTML and styling elements', async ({
  page,
}) => {
  await openEditor(page);
  await expect(libraryButton(page)).toContainText('Thư viện');
  await expect(libraryButton(page)).toHaveAttribute('aria-expanded', 'false');
  const panel = page.locator('.block-editor-library');
  await expect(panel).toBeHidden();
  await libraryButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(panel).toBeVisible();
  await expect(libraryButton(page)).toHaveAttribute('aria-expanded', 'true');
  for (const group of ['Bài học', 'Khối HTML', 'Trình bày bằng class và style'])
    await expect(panel).toContainText(group);
  await expect(panel.locator('[data-library-item]')).toHaveCount(23);
  await page.locator('[data-editor-mode=html]').click();
  await expect(panel).toBeHidden();
  await expect(libraryButton(page)).toBeHidden();
});

test('clicking a tile inserts the element after the selected block and keeps it', async ({
  page,
}) => {
  const frame = await openEditor(page);
  await libraryButton(page).click();
  await frame.locator('p', { hasText: 'First' }).click();
  await tile(page, 'sampleLessonSteps').click();
  expect(await blocks(frame)).toEqual(['h1', 'p', 'ol', 'p', 'p']);
  await expect(frame.locator('ol')).toHaveClass(/gjs-selected/);
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const saved = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { documentHTML } = await import('/assets/js/graph/html-document.js');
    return documentHTML(store.project.cards.at(-1).extensions['card-atlas:document']);
  });
  expect(saved).toBe(
    '<h1>Title</h1><p>First</p><ol><li>...</li><li>...</li><li>...</li></ol><p>Second</p><p>Third</p>',
  );
});

test('dragging a tile drops the element exactly where the pointer is', async ({ page }) => {
  const frame = await openEditor(page);
  await libraryButton(page).click();
  await dragTile(page, 'sampleLessonSteps', frame.locator('p', { hasText: 'Third' }), 'top');
  await expect(frame.locator('ol')).toHaveCount(1);
  expect(await blocks(frame)).toEqual(['h1', 'p', 'p', 'ol', 'p']);
  await dragTile(page, 'sampleLessonIdea', frame.locator('p', { hasText: 'First' }), 'bottom');
  await expect(frame.locator('div.alert')).toHaveCount(1);
  expect(await blocks(frame)).toEqual(['h1', 'p', 'div', 'p', 'ol', 'p']);
  await expect(frame.locator('[data-drop-line]')).toHaveCount(0);
});

test('every library element passes the document filter unchanged', async ({ page }) => {
  await openEditor(page);
  const removed = await page.evaluate(async () => {
    const { SAMPLES, LESSON_SAMPLES } = await import('/assets/js/detail/editor-samples.js');
    const { parseDocument } = await import('/assets/js/detail/html-content.js');
    const items = [...LESSON_SAMPLES, ...SAMPLES.flatMap(([, samples]) => samples)];
    return items
      .map(([key, html]) => [key, parseDocument(html).removed])
      .filter(([, list]) => list.length);
  });
  expect(removed).toEqual([]);
});

test('English locale names the library and its elements in English', async ({ page }) => {
  await openEditor(page, 'en');
  await expect(libraryButton(page)).toContainText('Library');
  await libraryButton(page).click();
  await expect(page.locator('.block-editor-library')).toContainText('Lesson');
  await expect(tile(page, 'sampleLessonSteps')).toHaveText('Numbered steps');
});
