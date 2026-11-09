import { projectAction, view } from './ui-driver.mjs';
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

const CARD = 'card-user-service';
const APPEARANCE = 'card-atlas:appearance';
const stored = (page, id = CARD) =>
  page.evaluate(
    async ([cardId, key]) => {
      const { store } = await import('/assets/js/app.js');
      return store.project.cards.find((c) => c.id === cardId).extensions?.[key] ?? null;
    },
    [id, APPEARANCE],
  );
const historyLength = (page) =>
  page.evaluate(async () => (await import('/assets/js/app.js')).store.undoStack.length);
const radiusOf = (page, id = CARD) =>
  page
    .locator('.graph-card[data-id=' + id + ']')
    .evaluate((el) => window.getComputedStyle(el).borderTopLeftRadius);
async function start(page, template = 'architecture') {
  await page.goto('/');
  await page.locator('[data-template=' + template + ']').click();
  await expect(page.locator('.graph-card[data-id=' + CARD + ']')).toBeVisible();
}
async function openFormat(page, id = CARD) {
  await page.locator('.graph-card[data-id=' + id + ']').focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(2).click();
}
const apply = (page) => page.locator('#panel-body form [type=submit]').click();
async function importProject(page, project) {
  await page.locator('#file-input').setInputFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
}

test('editing the background color keeps the default radius out of JSON, export and import', async ({
  page,
}) => {
  await start(page);
  const before = await historyLength(page);
  await openFormat(page);
  await page.locator('[data-hex-for=backgroundColor]').fill('#aabbcc');
  await apply(page);
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const value = await stored(page);
  expect(value).not.toBeNull();
  expect(value).not.toHaveProperty('radius');
  expect(await historyLength(page)).toBe(before + 1);
  expect(await radiusOf(page)).toBe('6px');
  const download = page.waitForEvent('download');
  await page.locator('#project-menu > summary').click();
  await page.locator('[data-action=export]').first().click();
  const file = await (await download).path();
  const exported = JSON.parse(await fs.readFile(file, 'utf8'));
  expect(
    exported.cards.find((c) => c.id === CARD).extensions?.[APPEARANCE] ?? {},
  ).not.toHaveProperty('radius');
  await importProject(page, exported);
  expect(await stored(page)).not.toHaveProperty('radius');
});

test('one Undo reverts the color edit', async ({ page }) => {
  await start(page);
  const original = await page.evaluate(async (id) => {
    const { store } = await import('/assets/js/app.js');
    return store.project.cards.find((c) => c.id === id).style.backgroundColor;
  }, CARD);
  await openFormat(page);
  await page.locator('[data-hex-for=backgroundColor]').fill('#aabbcc');
  await apply(page);
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  await projectAction(page, 'undo');
  const after = await page.evaluate(async (id) => {
    const { store } = await import('/assets/js/app.js');
    return store.project.cards.find((c) => c.id === id).style.backgroundColor;
  }, CARD);
  expect(after).toBe(original);
});

test('changing width/height in Format does not store radius', async ({ page }) => {
  await start(page);
  await openFormat(page);
  await page.locator('[name=width]').fill('340');
  await page.locator('[name=height]').fill('200');
  await apply(page);
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const value = await stored(page);
  expect(value.sizeMode).toBe('manual');
  expect(value).not.toHaveProperty('radius');
  expect(await radiusOf(page)).toBe('6px');
});

test('resizing on the canvas does not store radius', async ({ page }) => {
  await start(page);
  const card = page.locator('.graph-card[data-id=' + CARD + ']');
  await card.locator('.card-title, h3').first().click();
  const handle = card.locator('.resize-handle');
  await expect(handle).toBeVisible();
  const b = await handle.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 60, b.y + b.height / 2 + 40, { steps: 6 });
  await page.mouse.up();
  const value = await stored(page);
  expect(value.sizeMode).toBe('manual');
  expect(value).not.toHaveProperty('radius');
});

test('explicit radius is stored; rectangle and rounded presets write 0 and 24', async ({
  page,
}) => {
  await start(page);
  await openFormat(page);
  await page.locator('[name=appearance-radius]').fill('12');
  await apply(page);
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  expect((await stored(page)).radius).toBe(12);
  for (const [shape, radius] of [
    ['rectangle', 0],
    ['rounded', 24],
  ]) {
    await openFormat(page);
    await page.locator('[name=appearance-shape]').selectOption(shape);
    await expect(page.locator('[name=appearance-radius]')).toHaveValue(String(radius));
    await apply(page);
    await expect(page.locator('#detail-panel')).not.toBeVisible();
    expect((await stored(page)).radius).toBe(radius);
  }
});

test('a stored radius survives unrelated Format edits', async ({ page }) => {
  await start(page);
  const project = JSON.parse(await fs.readFile('assets/data/example.json', 'utf8'));
  project.cards.find((c) => c.id === CARD).extensions = { [APPEARANCE]: { radius: 10 } };
  await importProject(page, project);
  await openFormat(page);
  await page.locator('[data-hex-for=backgroundColor]').fill('#aabbcc');
  await apply(page);
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  expect((await stored(page)).radius).toBe(10);
  expect(await radiusOf(page)).toBe('10px');
});

test('a Mind card keeps its 20px default after a color edit', async ({ page }) => {
  const id = 'english-s-spelling';
  await page.goto('/');
  const project = JSON.parse(await fs.readFile('assets/data/mind-map-example.json', 'utf8'));
  await importProject(page, project);
  await view(page, 'mind');
  const before = await radiusOf(page, id);
  expect(before).toBe('20px');
  await openFormat(page, id);
  await page.locator('[data-hex-for=backgroundColor]').fill('#aabbcc');
  await apply(page);
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  expect(await stored(page, id)).not.toHaveProperty('radius');
  expect(await radiusOf(page, id)).toBe('20px');
});
