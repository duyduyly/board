import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { exportMenuAction, locale, openRow, view } from './ui-driver.mjs';

const CARD = 'card-user-service';
const card = (page) => page.locator('.graph-card[data-id=' + CARD + ']');
const chip = (page) => card(page).locator('.card-status-chip');
const popover = (page) => page.locator('#card-status-popover');
const option = (page, value) => popover(page).locator(`[data-status="${value}"]`);
const VALUES = ['new', 'in-progress', 'done', 'blocked', 'cancelled'];

async function start(page) {
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
}
// Change the status through the chip and its menu (one commit, one Undo step).
async function assign(page, value) {
  await chip(page).click();
  await expect(popover(page)).toBeVisible();
  await option(page, value).click();
  await expect(popover(page)).not.toBeVisible();
}
const expectStatus = (page, value) => expect(card(page)).toHaveAttribute('data-card-status', value);
const storedStatus = (page) =>
  page.evaluate(
    async (id) =>
      (await import('/assets/js/app.js')).store.project.cards.find((c) => c.id === id).extensions?.[
        'card-atlas:status'
      ] ?? null,
    CARD,
  );
const undoDepth = (page) =>
  page.evaluate(async () => (await import('/assets/js/app.js')).store.undoStack.length);

test('an unassigned note shows New and the chip is a visible, enabled control', async ({
  page,
}) => {
  await start(page);
  await expectStatus(page, 'new');
  await expect(chip(page)).toBeVisible();
  await expect(chip(page)).toContainText('Mới');
  await expect(chip(page)).toHaveAttribute('aria-disabled', 'false');
  expect(await storedStatus(page)).toBeNull();
});

test('change through the menu with the mouse; Undo and Redo move one step', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);

  await assign(page, 'done');
  await expectStatus(page, 'done');
  await assign(page, 'blocked');
  await expectStatus(page, 'blocked');
  await assign(page, 'new');
  await expectStatus(page, 'new');
  expect(await storedStatus(page)).toBeNull();

  await page.keyboard.press('Control+z');
  await expectStatus(page, 'blocked');
  await page.keyboard.press('Control+z');
  await expectStatus(page, 'done');
  await page.keyboard.press('Control+z');
  await expectStatus(page, 'new');

  await page.keyboard.press('Control+Shift+z');
  await expectStatus(page, 'done');
  await page.keyboard.press('Control+Shift+z');
  await expectStatus(page, 'blocked');
  expect(errors).toEqual([]);
});

test('the menu lists five coloured options, marks the current one and works by keyboard', async ({
  page,
}) => {
  await start(page);
  await chip(page).focus();
  await page.keyboard.press('Enter');
  await expect(popover(page)).toBeVisible();
  await expect(popover(page).locator('[role=menuitemradio]')).toHaveCount(VALUES.length);
  await expect(option(page, 'new')).toHaveAttribute('aria-checked', 'true');
  await expect(option(page, 'new')).toBeFocused();
  for (const value of VALUES) {
    const colours = await option(page, value).evaluate((node) => {
      const style = window.getComputedStyle(node);
      return [style.backgroundColor, style.color];
    });
    const expected = await page.evaluate((name) => {
      const probe = document.createElement('span');
      probe.style.cssText = `background:var(--status-${name}-bg);color:var(--status-${name}-ink)`;
      document.body.append(probe);
      const style = window.getComputedStyle(probe);
      const result = [style.backgroundColor, style.color];
      probe.remove();
      return result;
    }, value);
    expect(colours).toEqual(expected);
  }
  await page.keyboard.press('ArrowDown');
  await expect(option(page, 'in-progress')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(popover(page)).not.toBeVisible();
  await expectStatus(page, 'done');
  await expect(chip(page)).toBeFocused();

  await page.keyboard.press('Space');
  await expect(option(page, 'done')).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowUp');
  await expect(option(page, 'in-progress')).toBeFocused();
  await page.keyboard.press('Enter');
  await expectStatus(page, 'in-progress');
});

test('Escape, outside click and choosing the current status change nothing', async ({ page }) => {
  await start(page);
  await assign(page, 'in-progress');
  const depth = await undoDepth(page);

  await chip(page).click();
  await page.keyboard.press('Escape');
  await expect(popover(page)).not.toBeVisible();
  await expect(chip(page)).toBeFocused();

  await chip(page).click();
  await page.mouse.click(5, 5);
  await expect(popover(page)).not.toBeVisible();

  await chip(page).click();
  await option(page, 'in-progress').click();
  await expect(popover(page)).not.toBeVisible();
  await expectStatus(page, 'in-progress');
  expect(await undoDepth(page)).toBe(depth);
});

test('a pinned note keeps its status and the chip does not open the menu', async ({ page }) => {
  await start(page);
  await assign(page, 'done');
  await card(page).locator('.card-pin').click();
  await expect(chip(page)).toHaveAttribute('aria-disabled', 'true');
  await chip(page).click({ force: true });
  await expect(popover(page)).not.toBeVisible();
  await expect(page.locator('#toast')).toContainText('Note đã ghim chỉ xem');
  await expectStatus(page, 'done');
});

test('a dirty Detail draft blocks the change and asks what to do with it', async ({ page }) => {
  await start(page);
  await openRow(page, page.locator('.card-row[data-card-id=' + CARD + ']'));
  await page.locator('#panel-tabs button').nth(2).click();
  const bg = page.locator('[name=appearance-backgroundTransparent]');
  const original = await bg.isChecked();
  await bg.setChecked(!original);
  await chip(page).click();
  await expect(popover(page)).not.toBeVisible();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal [data-choice=cancel]').click();
  await expect(bg).toBeChecked({ checked: !original });
  await expectStatus(page, 'new');
});

test('labels follow the locale', async ({ page }) => {
  await start(page);
  await chip(page).click();
  const texts = () => popover(page).locator('.card-status-option-label').allTextContents();
  expect(await texts()).toEqual(['Mới', 'Đang làm', 'Xong', 'Bị chặn', 'Đã hủy']);
  await page.keyboard.press('Escape');
  await locale(page, 'en');
  await chip(page).click();
  expect(await texts()).toEqual(['New', 'In progress', 'Done', 'Blocked', 'Cancelled']);
  await expect(popover(page)).toHaveAttribute('aria-label', 'Change status');
});

test('status survives JSON export/import and shows in Mind Map', async ({ page }) => {
  await start(page);
  await assign(page, 'in-progress');

  const download = page.waitForEvent('download');
  await exportMenuAction(page, 'export');
  const exported = JSON.parse(await fs.readFile(await (await download).path(), 'utf8'));
  expect(exported.cards.find((c) => c.id === CARD).extensions['card-atlas:status']).toEqual({
    value: 'in-progress',
  });
  // Notes left on the default carry no key at all.
  expect(
    exported.cards.filter((c) => c.id !== CARD).every((c) => !c.extensions?.['card-atlas:status']),
  ).toBe(true);

  await page.reload();
  await page.locator('#file-input').setInputFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await page.locator('[data-choice=apply]').click();
  await expectStatus(page, 'in-progress');

  await view(page, 'mind');
  await expectStatus(page, 'in-progress');
  await expect(chip(page)).toBeVisible();
});
