import fs from 'node:fs';
import { test, expect } from '@playwright/test';

const FIXTURE = JSON.parse(
  fs.readFileSync(new URL('./fixtures/timeline-boards-project.json', import.meta.url), 'utf8'),
);

const boardButton = (page, id) =>
  page.locator(`#timeline-view li.timeline-entry[data-card-id="${id}"] button.timeline-board`);
const scope = (page) => page.locator('#board-scope');
const mindTab = (page) => page.locator('[data-map-view=mind]');
const cardTab = (page) => page.locator('[data-map-view=card]');
const dialogOpen = (page) => page.locator('dialog[open]');
const mindNodes = (page) => page.locator('.simple-node');

async function openFixture(page) {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'node-board-mind.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(FIXTURE)),
  });
  const apply = page.locator('[data-choice=apply]');
  if (await apply.isVisible({ timeout: 1500 }).catch(() => false)) await apply.click();
  await expect(page.locator('#timeline-view')).toBeVisible();
}

async function openBoard(page, id) {
  await boardButton(page, id).click();
  await expect(scope(page)).toBeVisible();
}

async function convertBoardMind(page) {
  await mindTab(page).click();
  await expect(dialogOpen(page)).toBeVisible();
  await dialogOpen(page).locator('[data-choice=apply]').click();
  await expect(dialogOpen(page)).toHaveCount(0);
  await expect(mindTab(page)).toHaveAttribute('aria-pressed', 'true');
}

test.describe('Node board Mind Map', () => {
  test('converts the board of a note and keeps the board header across views', async ({ page }) => {
    await openFixture(page);
    await openBoard(page, 'node-a');
    await mindTab(page).click();

    const dlg = dialogOpen(page);
    await expect(dlg).toBeVisible();
    const options = dlg.locator('#mind-convert-root option');
    await expect(options).toHaveCount(2);
    await expect(options.filter({ hasText: 'A child 1' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'A child 2' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'B child' })).toHaveCount(0);
    await expect(options.filter({ hasText: 'Node' })).toHaveCount(0);
    await dlg.locator('[data-choice=apply]').click();

    await expect(page.locator('#toast')).toBeVisible();
    await expect(mindTab(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(scope(page)).toBeVisible();
    await expect(scope(page).locator('.board-scope-title')).toHaveText('Node A');
    await expect(mindNodes(page)).toHaveCount(2);

    // Switching views inside the board keeps the header and never asks again.
    await cardTab(page).click();
    await expect(cardTab(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(scope(page)).toBeVisible();
    await expect(page.locator('.graph-card')).toHaveCount(2);
    await mindTab(page).click();
    await expect(mindTab(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(dialogOpen(page)).toHaveCount(0);
    await expect(scope(page)).toBeVisible();
    await expect(mindNodes(page)).toHaveCount(2);
  });

  test('defaults the root to the selected note of the board', async ({ page }) => {
    await openFixture(page);
    await openBoard(page, 'node-a');
    await page.locator('.graph-card[data-id="a-child-2"]').click();
    await mindTab(page).click();
    await expect(dialogOpen(page)).toBeVisible();
    await expect(dialogOpen(page).locator('#mind-convert-root')).toHaveValue('a-child-2');
    await dialogOpen(page).locator('[data-choice=cancel]').click();
  });

  test('cancel keeps the Note Board; undo removes the board root', async ({ page }) => {
    await openFixture(page);
    await openBoard(page, 'node-a');
    await mindTab(page).click();
    await dialogOpen(page).locator('[data-choice=cancel]').click();
    await expect(dialogOpen(page)).toHaveCount(0);
    await expect(cardTab(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(scope(page)).toBeVisible();

    await convertBoardMind(page);
    await page.locator('[data-action=undo]').first().click();
    await cardTab(page).click();
    await expect(cardTab(page)).toHaveAttribute('aria-pressed', 'true');
    await mindTab(page).click();
    await expect(dialogOpen(page)).toBeVisible();
    await dialogOpen(page).locator('[data-choice=cancel]').click();
    await expect(cardTab(page)).toHaveAttribute('aria-pressed', 'true');
  });

  test('empty board explains itself and stays on Note Board', async ({ page }) => {
    await openFixture(page);
    await openBoard(page, 'node-c');
    await mindTab(page).click();
    await expect(page.locator('#toast')).toBeVisible();
    await expect(dialogOpen(page)).toHaveCount(0);
    await expect(cardTab(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(scope(page)).toBeVisible();
  });

  test('the project board Mind Map is not affected by a node board root', async ({ page }) => {
    await openFixture(page);
    await openBoard(page, 'node-a');
    await convertBoardMind(page);

    await scope(page).locator('button[data-scope-action=root]').click();
    await expect(scope(page)).toBeHidden();
    await expect(page.locator('.graph-card[data-id="a-child-1"]')).toHaveCount(0);
    await mindTab(page).click();
    // Project board: either asks for a root (dialog) or shows its own root; never board children.
    if (
      await dialogOpen(page)
        .isVisible({ timeout: 1500 })
        .catch(() => false)
    ) {
      await expect(dialogOpen(page).locator('#mind-convert-root option')).not.toContainText([
        'A child 1',
      ]);
      await dialogOpen(page).locator('[data-choice=cancel]').click();
    } else {
      await expect(mindNodes(page).filter({ hasText: 'A child' })).toHaveCount(0);
    }
  });

  test('Back returns to the previous view and View all leaves board scope on Mind', async ({
    page,
  }) => {
    await openFixture(page);
    await openBoard(page, 'node-a');
    await convertBoardMind(page);
    await scope(page).locator('button[data-scope-action=timeline]').click();
    await expect(page.locator('#timeline-view')).toBeVisible();

    await page.locator('#timeline-view [data-timeline-action=overview]').click();
    await expect(scope(page)).toBeVisible();
    await mindTab(page).click();
    await expect(scope(page)).toBeHidden();
    await expect(page.locator('#timeline-view')).toBeHidden();
    // The project board has no Mind root yet, so it asks for one among project notes only.
    await expect(dialogOpen(page)).toBeVisible();
    await expect(dialogOpen(page).locator('#mind-convert-root option')).not.toContainText([
      'A child 1',
    ]);
    await dialogOpen(page).locator('[data-choice=apply]').click();
    await expect(mindTab(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(scope(page)).toBeHidden();
  });
});
