import { test, expect } from '@playwright/test';
import { openRow, view } from './ui-driver.mjs';

const CARD = 'card-user-service';
const OTHER = 'card-user-api';
const SAGE = '#E3EFE8';
const BLUE = '#E8F0FB';
const DEFAULT = '#FFF2B0';
const card = (page, id = CARD) => page.locator('.graph-card[data-id=' + id + ']');
const button = (page, id = CARD) => card(page, id).locator('.card-color-button');
const popover = (page) => page.locator('#card-color-popover');
const swatch = (page, name) => popover(page).locator('[data-swatch="' + name + '"]');

async function start(page) {
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
}
const background = (page, id = CARD) =>
  page.evaluate(
    async (cardId) =>
      (await import('/assets/js/app.js')).store.project.cards.find((c) => c.id === cardId).style
        .backgroundColor,
    id,
  );
const undoDepth = (page) =>
  page.evaluate(async () => (await import('/assets/js/app.js')).store.undoStack.length);
const box = async (page, id = CARD) => card(page, id).boundingBox();
// Select by clicking the card body, away from every strip control.
const choose = async (page, id, shift = false) => {
  const b = await box(page, id);
  await card(page, id).click({
    modifiers: shift ? ['Shift'] : [],
    position: { x: 25, y: b.height - 24 },
  });
};

test('the colour button appears on select or hover only and is a named native button', async ({
  page,
}) => {
  await start(page);
  await expect(button(page)).toHaveCSS('opacity', '0');
  await card(page).hover({ position: { x: 25, y: 150 } });
  await expect(button(page)).toHaveCSS('opacity', '1');
  await page.mouse.move(5, 5);
  await expect(button(page)).toHaveCSS('opacity', '0');
  await choose(page, CARD);
  await page.mouse.move(5, 5);
  await expect(button(page)).toHaveCSS('opacity', '1');
  expect(await button(page).evaluate((el) => el.tagName)).toBe('BUTTON');
  await expect(button(page)).toHaveAttribute('aria-label', 'Đổi màu nền');
  await expect(button(page)).toHaveAttribute('aria-disabled', 'false');
});

test('choosing a colour applies at once as one Undo step and the Format dock shows it', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);
  const before = await background(page);
  const depth = await undoDepth(page);
  const geometry = await box(page);
  await choose(page, CARD);
  await button(page).click();
  await expect(popover(page)).toBeVisible();
  await swatch(page, 'blue').click();
  await expect(popover(page)).not.toBeVisible();
  expect(await background(page)).toBe(BLUE);
  expect(await undoDepth(page)).toBe(depth + 1);
  await expect(button(page)).toBeFocused();
  expect(await box(page)).toEqual(geometry);

  await openRow(page, page.locator('.card-row[data-card-id=' + CARD + ']'));
  await page.locator('#panel-tabs button').nth(2).click();
  await expect(page.locator('[name=backgroundColor]')).toHaveValue(BLUE.toLowerCase());
  await page.keyboard.press('Control+z');
  expect(await background(page)).toBe(before);
  expect(await undoDepth(page)).toBe(depth);
  expect(errors).toEqual([]);
});

test('the marked swatch carries a check and Default restores the note colour', async ({ page }) => {
  await start(page);
  await choose(page, CARD);
  await button(page).click();
  await swatch(page, 'sage').click();
  expect(await background(page)).toBe(SAGE);
  await button(page).click();
  await expect(swatch(page, 'sage')).toHaveAttribute('aria-checked', 'true');
  await expect(swatch(page, 'blue')).toHaveAttribute('aria-checked', 'false');
  await expect(swatch(page, 'sage')).toBeFocused();
  expect(
    await swatch(page, 'sage').evaluate((el) => window.getComputedStyle(el, '::after').content),
  ).toBe('"✓"');
  await swatch(page, 'default').click();
  expect(await background(page)).toBe(DEFAULT);
  await button(page).click();
  await expect(swatch(page, 'default')).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
});

test('keyboard: arrows move, Enter and Space choose, Escape closes unchanged', async ({ page }) => {
  await start(page);
  const depth = await undoDepth(page);
  await choose(page, CARD);
  await button(page).focus();
  await page.keyboard.press('Enter');
  await expect(popover(page)).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(popover(page)).not.toBeVisible();
  await expect(button(page)).toBeFocused();
  expect(await undoDepth(page)).toBe(depth);
  await expect(page.locator('#detail-panel')).not.toBeVisible();

  await page.keyboard.press('Space');
  await expect(popover(page)).toBeVisible();
  // The note starts sage, so the menu opens on Sage and one step down is Blue.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(popover(page)).not.toBeVisible();
  expect(await background(page)).toBe(BLUE);
  await expect(button(page)).toBeFocused();
  expect(await undoDepth(page)).toBe(depth + 1);

  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  expect(await background(page)).toBe(SAGE);
});

test('clicking outside closes without a change', async ({ page }) => {
  await start(page);
  const depth = await undoDepth(page);
  await choose(page, CARD);
  await button(page).click();
  await expect(popover(page)).toBeVisible();
  await page.mouse.click(10, 300);
  await expect(popover(page)).not.toBeVisible();
  expect(await undoDepth(page)).toBe(depth);
});

test('a pinned note keeps its colour: the button explains and the menu stays closed', async ({
  page,
}) => {
  await start(page);
  const before = await background(page);
  await card(page).locator('.card-pin').click();
  await card(page).hover({ position: { x: 25, y: 150 } });
  await expect(button(page)).toHaveAttribute('aria-disabled', 'true');
  await button(page).click({ force: true });
  await expect(popover(page)).not.toBeVisible();
  await expect(page.locator('#toast')).toContainText('Note đã ghim chỉ xem');
  expect(await background(page)).toBe(before);
});

test('a transparent background becomes opaque when a colour is chosen', async ({ page }) => {
  await start(page);
  await openRow(page, page.locator('.card-row[data-card-id=' + CARD + ']'));
  await page.locator('#panel-tabs button').nth(2).click();
  await page.locator('[name=appearance-backgroundTransparent]').check();
  await page.locator('#panel-body form [type=submit]').click();
  await expect(card(page)).toHaveClass(/transparent-background/);
  await choose(page, CARD);
  await button(page).click();
  await swatch(page, 'blue').click();
  await expect(card(page)).not.toHaveClass(/transparent-background/);
  expect(await background(page)).toBe(BLUE);
});

test('Mind Map: the button works on a node and keeps its geometry', async ({ page }) => {
  await start(page);
  await view(page, 'mind');
  const geometry = await box(page);
  await card(page).hover({ position: { x: 40, y: 40 } });
  await expect(button(page)).toHaveCSS('opacity', '1');
  await button(page).click();
  await swatch(page, 'blue').click();
  expect(await background(page)).toBe(BLUE);
  expect(await box(page)).toEqual(geometry);
});

test('multi-selection: one command colours every unpinned selected note', async ({ page }) => {
  await start(page);
  await choose(page, CARD);
  await choose(page, OTHER, true);
  const depth = await undoDepth(page);
  await button(page).click();
  await swatch(page, 'blue').click();
  expect(await background(page, CARD)).toBe(BLUE);
  expect(await background(page, OTHER)).toBe(BLUE);
  expect(await undoDepth(page)).toBe(depth + 1);
  await page.keyboard.press('Control+z');
  expect(await background(page, CARD)).not.toBe(BLUE);
  expect(await background(page, OTHER)).not.toBe(BLUE);
});

test('a dirty Format draft blocks the change instead of silently dropping it', async ({ page }) => {
  await start(page);
  await openRow(page, page.locator('.card-row[data-card-id=' + CARD + ']'));
  await page.locator('#panel-tabs button').nth(2).click();
  const bg = page.locator('[name=appearance-backgroundTransparent]');
  const original = await bg.isChecked();
  await bg.setChecked(!original);
  await button(page).click({ force: true });
  await expect(popover(page)).not.toBeVisible();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal [data-choice=cancel]').click();
  await expect(bg).toBeChecked({ checked: !original });
});

test('custom colour: the rainbow row applies the picked hex on change as one Undo step', async ({
  page,
}) => {
  await start(page);
  const before = await background(page);
  const depth = await undoDepth(page);
  await choose(page, CARD);
  await button(page).click();
  const input = popover(page).locator('.card-color-input');
  await expect(input).toHaveAttribute('aria-label', 'Chọn màu khác');
  await expect(input).toHaveValue(before.toLowerCase());
  await input.fill('#336699');
  await expect(popover(page)).not.toBeVisible();
  expect(await background(page)).toBe('#336699');
  expect(await undoDepth(page)).toBe(depth + 1);
  await expect(button(page)).toBeFocused();

  await button(page).click();
  await expect(popover(page).locator('.card-color-custom')).toHaveAttribute('data-checked', 'true');
  expect(
    await popover(page)
      .locator('.card-color-custom')
      .evaluate((el) => window.getComputedStyle(el, '::after').content),
  ).toBe('"✓"');
  await expect(input).toBeFocused();
  await page.keyboard.press('Escape');

  await page.keyboard.press('Control+z');
  expect(await background(page)).toBe(before);
  expect(await undoDepth(page)).toBe(depth);
});
