import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { view } from './ui-driver.mjs';

const FIXTURE = fs.readFileSync(
  new URL('./fixtures/timeline-boards-project.json', import.meta.url),
  'utf8',
);

const card = (page, id) => page.locator(`.graph-card[data-id="${id}"]`);
const toast = (page) => page.locator('#toast');
const scopeCount = (page) => page.locator('.board-scope-count');
const projectCards = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return store.project.cards.map((c) => c.id).sort();
  });

async function openProject(page) {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'boards.json',
    mimeType: 'application/json',
    buffer: Buffer.from(FIXTURE),
  });
  const apply = page.locator('[data-choice=apply]');
  if (await apply.isVisible({ timeout: 1500 }).catch(() => false)) await apply.click();
  await expect(page.locator('#timeline-view')).toBeVisible();
}

async function openRootBoard(page) {
  await view(page, 'card');
  await expect(card(page, 'node-a')).toBeVisible();
}

async function openNodeBoard(page, nodeId) {
  if (!(await page.locator('#timeline-view').isVisible())) await view(page, 'timeline');
  await page
    .locator(
      `#timeline-view li.timeline-entry[data-card-id="${nodeId}"] [data-timeline-action="board-open"]`,
    )
    .first()
    .click();
  await expect(page.locator('#board-scope')).toBeVisible();
}

async function removeTimelineFromMenu(page) {
  await page.locator('#project-menu > summary').click();
  await page.locator('[data-action="timeline-remove"]').click();
}

test('Delete on a node with a board asks first; Cancel keeps it; confirm removes it and Undo restores the board', async ({
  page,
}) => {
  await openProject(page);
  await openRootBoard(page);
  await card(page, 'node-a').click();
  await page.keyboard.press('Delete');
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal [data-choice=cancel]').click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await expect(card(page, 'node-a')).toBeVisible();

  await page.keyboard.press('Delete');
  await page.locator('#modal [data-choice=remove]').click();
  await expect(card(page, 'node-a')).toHaveCount(0);
  await expect(toast(page)).toBeVisible();
  expect(await projectCards(page)).not.toContain('a-child-1');

  await page.keyboard.press('Control+z');
  await expect(card(page, 'node-a')).toBeVisible();
  await openNodeBoard(page, 'node-a');
  await expect(scopeCount(page)).toContainText('2 note');
});

test('a pinned note in a board blocks deleting its node and removing Timeline', async ({
  page,
}) => {
  await openProject(page);
  await openNodeBoard(page, 'node-b');
  await card(page, 'b-child-1').locator('.card-pin').click();
  await page.locator('[data-scope-action=timeline]').click();
  await expect(page.locator('#timeline-view')).toBeVisible();

  await openRootBoard(page);
  await card(page, 'node-b').click();
  await page.keyboard.press('Delete');
  await expect(toast(page)).toBeVisible();
  await expect(page.locator('#modal')).not.toBeVisible();
  await expect(card(page, 'node-b')).toBeVisible();

  await removeTimelineFromMenu(page);
  await expect(page.locator('#modal')).not.toBeVisible();
  await expect(toast(page)).toContainText('ghim');
  await expect(page.locator('[data-map-view=timeline]')).toBeVisible();
});

test('removing Timeline moves board notes to the project board and Undo restores them', async ({
  page,
}) => {
  await openProject(page);
  await openRootBoard(page);
  await removeTimelineFromMenu(page);
  await expect(page.locator('#modal')).toContainText('4');
  await page.locator('#modal [data-choice=remove]').click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await expect(page.locator('#timeline-view')).toBeHidden();
  await expect(page.locator('[data-action="timeline-remove"]')).toBeHidden();
  await page.locator('[data-action=fit]').click();
  await expect(page.locator('.graph-card')).toHaveCount(9);
  await expect(card(page, 'a-child-1')).toBeVisible();

  await page.keyboard.press('Control+z');
  await openNodeBoard(page, 'node-a');
  await expect(scopeCount(page)).toContainText('2 note');
});

test('search finds a note inside a board, opens that board and selects the note', async ({
  page,
}) => {
  await openProject(page);
  await openRootBoard(page);
  await page.locator('[data-action=search]').click();
  await page.locator('#search').fill('B child 2');
  await page.locator('.card-row[data-card-id="b-child-2"]').click();
  await expect(page.locator('#board-scope')).toBeVisible();
  await expect(page.locator('.board-scope-title')).toHaveText('Node B');
  await expect(card(page, 'b-child-2')).toHaveClass(/selected/);
});

test('Mind Map is unavailable inside a board', async ({ page }) => {
  await openProject(page);
  await openNodeBoard(page, 'node-a');
  const mind = page.locator('[data-map-view=mind]');
  await expect(mind).toHaveAttribute('aria-disabled', 'true');
  await mind.click({ force: true });
  await expect(toast(page)).toBeVisible();
  await expect(page.locator('[data-map-view=card]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#board-scope')).toBeVisible();
});

test('pasting in another board adds the copy only to that board', async ({ page }) => {
  await openProject(page);
  await openNodeBoard(page, 'node-a');
  await card(page, 'a-child-1').click();
  await page.keyboard.press('Control+c');
  await page.locator('[data-scope-action=timeline]').click();
  await expect(page.locator('#timeline-view')).toBeVisible();

  await openNodeBoard(page, 'node-b');
  await expect(scopeCount(page)).toContainText('2 note');
  await page.keyboard.press('Control+v');
  await expect(scopeCount(page)).toContainText('3 note');
  await expect(page.locator('.graph-card')).toHaveCount(3);

  await page.locator('[data-scope-action=timeline]').click();
  await openNodeBoard(page, 'node-a');
  await expect(scopeCount(page)).toContainText('2 note');
});

test('a dirty Detail draft blocks leaving a board via the breadcrumb; Cancel stays', async ({
  page,
}) => {
  await openProject(page);
  await openNodeBoard(page, 'node-a');
  await card(page, 'a-child-1').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detail-panel')).toBeVisible();
  await page.locator('#panel-tabs button').nth(2).click();
  const bg = page.locator('[name=appearance-backgroundTransparent]');
  const original = await bg.isChecked();
  await bg.setChecked(!original);

  await page.locator('[data-scope-action=timeline]').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal [data-choice=cancel]').click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await expect(page.locator('#board-scope')).toBeVisible();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(bg).toBeChecked({ checked: !original });
});

test('redoing the deletion of the open board node leaves the board with a notice', async ({
  page,
}) => {
  await openProject(page);
  await openRootBoard(page);
  await card(page, 'node-a').click();
  await page.keyboard.press('Delete');
  await page.locator('#modal [data-choice=remove]').click();
  await expect(card(page, 'node-a')).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(card(page, 'node-a')).toBeVisible();

  await openNodeBoard(page, 'node-a');
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('#board-scope')).toBeHidden();
  await expect(page.locator('#timeline-view')).toBeVisible();
  await expect(toast(page)).toContainText('Board đã đóng');
});

test('a parent note shows a board badge on the project board that opens its board', async ({
  page,
}) => {
  await openProject(page);
  await openRootBoard(page);
  const badge = card(page, 'node-a').locator('.card-board-badge');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText('2');
  await expect(card(page, 'node-c').locator('.card-board-badge')).toBeHidden();
  await badge.click();
  await expect(page.locator('#board-scope')).toBeVisible();
  await expect(page.locator('.board-scope-title')).toHaveText('Node A');
  await expect(page.locator('.card-board-badge:visible')).toHaveCount(0);
});

test('Note Board inside a board and the project breadcrumb both lead to the project board', async ({
  page,
}) => {
  await openProject(page);
  await openNodeBoard(page, 'node-a');
  await page.locator('[data-map-view=card]').click();
  await expect(page.locator('#board-scope')).toBeHidden();
  await expect(card(page, 'node-a')).toBeVisible();
  await expect(page.locator('#timeline-view')).toBeHidden();

  await openNodeBoard(page, 'node-a');
  await page.locator('#board-scope [data-scope-action=root]').click();
  await expect(page.locator('#board-scope')).toBeHidden();
  await expect(card(page, 'node-a')).toBeVisible();
});

test('singular wording for a board with one note', async ({ page }) => {
  await openProject(page);
  await page.locator('#locale').selectOption('en');
  await openNodeBoard(page, 'node-a');
  await card(page, 'a-child-1').click();
  await page.keyboard.press('Delete');
  await expect(scopeCount(page)).toHaveText('1 note in this board');
});
