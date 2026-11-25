import { test, expect } from '@playwright/test';
import { projectAction } from './ui-driver.mjs';

const GROUPS = 'card-atlas:groups';
const card = (id, title, x, y, extensions) => ({
  id,
  title,
  content: '',
  position: { x, y },
  ...(extensions ? { extensions } : {}),
});

async function loadProject(page, { groups = true, many = 0 } = {}) {
  const project = {
    version: '1.0',
    metadata: { title: 'Add to group' },
    cards: [
      card('a', 'Vision', 0, 0),
      card('b', 'Sign up', 0, 330),
      card('c', 'Sign in', 300, 330),
      card('d', 'OTP', 650, 330),
      card('e', 'Loose', 800, 0),
      card('f', 'Other', 1000, 330),
      card('p', 'Pinned', 1100, 0, { 'card-atlas:metadata': { pinned: true } }),
      ...Array.from({ length: many }, (_, i) => card('m' + i, 'Member ' + i, 1300 + i * 40, 0)),
    ],
    relations: [],
    ...(groups
      ? {
          extensions: {
            [GROUPS]: {
              groups: [
                { id: 'outer', title: 'Product', cardIds: ['a'] },
                { id: 'inner', title: 'Auth', cardIds: ['b', 'c'], parentId: 'outer' },
                { id: 'deep', title: 'Security', cardIds: ['d'], parentId: 'inner' },
                ...Array.from({ length: many }, (_, i) => ({
                  id: 'extra' + i,
                  title: 'Extra ' + i,
                  cardIds: ['m' + i],
                })),
              ],
            },
          },
        }
      : {}),
  };
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'add.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-action=fit]').click();
}

const groupsOf = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return store.project.extensions?.['card-atlas:groups']?.groups ?? [];
  });
const cardIds = async (page, id) => (await groupsOf(page)).find((g) => g.id === id)?.cardIds;
const add = (page) => page.locator('[data-action=group-add]');
const remove = (page) => page.locator('[data-action=group-remove]');
const picker = (page) => page.locator('#group-picker-popover');
const option = (page, id) => page.locator('.group-picker-option[data-group-id=' + id + ']');
const note = (page, id) => page.locator('.graph-card[data-id=' + id + ']');

test('one loose note joins a nested group from the indented picker, in one Undo step', async ({
  page,
}) => {
  await loadProject(page);
  await note(page, 'e').click();
  await expect(add(page)).toBeVisible();
  await expect(remove(page)).toBeHidden();
  await add(page).click();
  await expect(picker(page)).toBeVisible();
  await expect(picker(page).getByRole('menuitem')).toHaveCount(3);
  const indent = (id) =>
    option(page, id).evaluate((el) =>
      parseFloat(el.ownerDocument.defaultView.getComputedStyle(el).paddingLeft),
    );
  expect(await indent('inner')).toBeGreaterThan(await indent('outer'));
  expect(await indent('deep')).toBeGreaterThan(await indent('inner'));
  await expect(option(page, 'inner')).toContainText('Auth');
  await option(page, 'inner').click();
  await expect(picker(page)).not.toBeVisible();
  expect(await cardIds(page, 'inner')).toEqual(['b', 'c', 'e']);
  await expect(page.locator('#toast')).toContainText('Đã thêm 1 note vào “Auth”');
  await projectAction(page, 'undo');
  expect(await cardIds(page, 'inner')).toEqual(['b', 'c']);
});

test('several loose notes and a pinned note can be added together', async ({ page }) => {
  await loadProject(page);
  await note(page, 'e').click();
  await note(page, 'f').click({ modifiers: ['Shift'] });
  await note(page, 'p').click({ modifiers: ['Shift'] });
  await add(page).click();
  await option(page, 'outer').click();
  expect(await cardIds(page, 'outer')).toEqual(['a', 'e', 'f', 'p']);
  await projectAction(page, 'undo');
  expect(await cardIds(page, 'outer')).toEqual(['a']);
});

test('the picker works from the keyboard and Escape returns focus to the button', async ({
  page,
}) => {
  await loadProject(page);
  await note(page, 'e').click();
  await add(page).focus();
  await page.keyboard.press('Enter');
  await expect(option(page, 'outer')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(option(page, 'inner')).toBeFocused();
  await page.keyboard.press('End');
  await expect(option(page, 'deep')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(option(page, 'outer')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(picker(page)).not.toBeVisible();
  await expect(add(page)).toBeFocused();
  expect(await cardIds(page, 'outer')).toEqual(['a']);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await cardIds(page, 'inner')).toEqual(['b', 'c', 'e']);
});

test('removing a note from a subgroup returns it to the parent group', async ({ page }) => {
  await loadProject(page);
  await note(page, 'b').click();
  await expect(add(page)).toBeHidden();
  await remove(page).click();
  expect(await cardIds(page, 'inner')).toEqual(['c']);
  expect(await cardIds(page, 'outer')).toEqual(['a', 'b']);
  await expect(page.locator('#toast')).toContainText('Đã chuyển 1 note từ “Auth” về “Product”');
  await projectAction(page, 'undo');
  expect(await cardIds(page, 'inner')).toEqual(['b', 'c']);
  expect(await cardIds(page, 'outer')).toEqual(['a']);
});

test('removing a note from a top-level group puts it outside every group', async ({ page }) => {
  await loadProject(page);
  // Product keeps its subgroup, so its only own note may leave.
  await note(page, 'a').click();
  await remove(page).click();
  expect(await cardIds(page, 'outer')).toEqual([]);
  await note(page, 'a').click();
  await expect(add(page)).toBeVisible();
});

test('a mixed selection cannot be added, and Remove only touches grouped notes', async ({
  page,
}) => {
  await loadProject(page);
  await note(page, 'c').click();
  await note(page, 'e').click({ modifiers: ['Shift'] });
  await expect(add(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(add(page)).toHaveAttribute('title', /đã thuộc nhóm/);
  await add(page).click({ force: true });
  await expect(page.locator('#toast')).toContainText('đã thuộc nhóm');
  await expect(picker(page)).not.toBeVisible();
  await remove(page).click();
  expect(await cardIds(page, 'inner')).toEqual(['b']);
  expect(await cardIds(page, 'outer')).toEqual(['a', 'c']);
  await expect(page.locator('#toast')).toContainText('Đã chuyển 1 note từ “Auth” về “Product”');
  expect((await groupsOf(page)).some((g) => g.cardIds.includes('e'))).toBe(false);
});

test('removing the last note of a group is refused with a hint and changes nothing', async ({
  page,
}) => {
  await loadProject(page);
  const before = await groupsOf(page);
  await note(page, 'd').click();
  await remove(page).click();
  await expect(page.locator('#toast')).toContainText('Nhóm cần ít nhất một note');
  expect(await groupsOf(page)).toEqual(before);
});

test('the add button is hidden when the project has no group', async ({ page }) => {
  await loadProject(page, { groups: false });
  await note(page, 'e').click();
  await expect(add(page)).toBeHidden();
  await note(page, 'f').click({ modifiers: ['Shift'] });
  await expect(page.locator('#selection-tools')).toBeVisible();
  await expect(add(page)).toBeHidden();
  await expect(remove(page)).toBeHidden();
});

const badge = (page, id) => note(page, id).locator('.card-group-button');

test('a note own corner button adds it to a group, turns into remove, and Undo restores it', async ({
  page,
}) => {
  await loadProject(page);
  await note(page, 'e').click();
  await expect(badge(page, 'e')).toBeVisible();
  await expect(badge(page, 'e')).toHaveAttribute('data-state', 'free');
  await expect(badge(page, 'e')).toHaveAttribute('aria-label', 'Thêm vào nhóm…');
  await badge(page, 'e').click();
  await expect(picker(page)).toBeVisible();
  await option(page, 'inner').click();
  expect(await cardIds(page, 'inner')).toEqual(['b', 'c', 'e']);
  await expect(badge(page, 'e')).toHaveAttribute('data-state', 'member');
  await expect(badge(page, 'e')).toHaveAttribute('aria-label', 'Bỏ khỏi nhóm “Auth”');
  await badge(page, 'e').click();
  // A subgroup member goes back to the parent group; a second press takes it out entirely.
  expect(await cardIds(page, 'inner')).toEqual(['b', 'c']);
  expect(await cardIds(page, 'outer')).toEqual(['a', 'e']);
  await expect(badge(page, 'e')).toHaveAttribute('aria-label', 'Bỏ khỏi nhóm “Product”');
  await badge(page, 'e').click();
  expect(await cardIds(page, 'outer')).toEqual(['a']);
  await expect(badge(page, 'e')).toHaveAttribute('data-state', 'free');
  await projectAction(page, 'undo');
  expect(await cardIds(page, 'outer')).toEqual(['a', 'e']);
  await projectAction(page, 'undo');
  expect(await cardIds(page, 'inner')).toEqual(['b', 'c', 'e']);
});

test('the corner button refuses to empty a group and is hidden when no group exists', async ({
  page,
}) => {
  await loadProject(page);
  const before = await groupsOf(page);
  await note(page, 'd').click();
  await badge(page, 'd').click();
  await expect(page.locator('#toast')).toContainText('Nhóm cần ít nhất một note');
  expect(await groupsOf(page)).toEqual(before);
  await loadProject(page, { groups: false });
  await note(page, 'e').click();
  await expect(badge(page, 'e')).toBeHidden();
});

test('Tab closes the picker and returns focus to the button', async ({ page }) => {
  await loadProject(page);
  await note(page, 'e').click();
  await add(page).focus();
  await page.keyboard.press('Enter');
  await expect(option(page, 'outer')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(picker(page)).not.toBeVisible();
  await expect(add(page)).toBeFocused();
  expect(await cardIds(page, 'outer')).toEqual(['a']);
});

test('the picker shows a heading with the note count and english singular', async ({ page }) => {
  await loadProject(page);
  await note(page, 'e').click();
  await add(page).click();
  await expect(picker(page).locator('.group-picker-heading')).toHaveText('Thêm 1 note vào nhóm');
  await page.keyboard.press('Escape');
  await page.locator('#locale').selectOption('en');
  await add(page).click();
  await expect(picker(page).locator('.group-picker-heading')).toHaveText('Add 1 note to a group');
  await option(page, 'inner').click();
  await expect(page.locator('#toast')).toContainText('Added 1 note to “Auth”');
  await expect(page.locator('#toast')).not.toContainText('1 notes');
});

test('a picker near the bottom opens above its button; End keeps the last option in view', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 560 });
  await loadProject(page, { many: 12 });
  await note(page, 'e').click();
  await add(page).click();
  await expect(picker(page)).toBeVisible();
  const lists = async () => ({
    button: await add(page).boundingBox(),
    popup: await picker(page).boundingBox(),
  });
  const { button, popup } = await lists();
  const room = 560 - (button.y + button.height) - 8;
  // Only assert the flip when the popup truly cannot fit below the button.
  if (popup.height > room) expect(popup.y + popup.height).toBeLessThanOrEqual(button.y);
  else expect(popup.y).toBeGreaterThanOrEqual(button.y + button.height);
  await page.keyboard.press('End');
  const last = option(page, 'extra11');
  await expect(last).toBeFocused();
  const box = await last.boundingBox();
  const menu = await page.locator('.group-picker-menu').boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(menu.y - 1);
  expect(box.y + box.height).toBeLessThanOrEqual(menu.y + menu.height + 1);
});
