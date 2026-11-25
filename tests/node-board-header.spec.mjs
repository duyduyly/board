import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { view } from './ui-driver.mjs';

const FIXTURE = fs.readFileSync(
  new URL('./fixtures/timeline-boards-project.json', import.meta.url),
  'utf8',
);

const scope = (page) => page.locator('#board-scope');
const titleBtn = (page) => scope(page).locator('button.board-scope-title');
const summaryBtn = (page) => scope(page).locator('button.board-scope-summary');
const countEl = (page) => scope(page).locator('.board-scope-count');
const editor = (page) => page.locator('#card-overview-editor');
const entry = (page, id) => page.locator(`#timeline-view li.timeline-entry[data-card-id="${id}"]`);
const boardButton = (page, id) => entry(page, id).locator('[data-timeline-action="board-open"]');
const undo = (page) => page.locator('[data-action=undo]').first().click();

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

async function openNodeBoard(page, id) {
  if (!(await page.locator('#timeline-view').isVisible())) await view(page, 'timeline');
  await boardButton(page, id).first().click();
  await expect(scope(page)).toBeVisible();
}

async function editField(page, button, text) {
  await button.click();
  await expect(editor(page)).toBeVisible();
  await page.locator('#overview-text').fill(text);
  await editor(page).locator('button[type=submit]').click();
  await expect(editor(page)).not.toBeVisible();
}

test.describe('Node board header', () => {
  test('shows title, summary placeholder and note count', async ({ page }) => {
    await openProject(page);
    await openNodeBoard(page, 'node-a');
    await expect(titleBtn(page)).toHaveText('Node A');
    await expect(summaryBtn(page)).toHaveClass(/is-empty/);
    await expect(summaryBtn(page)).toHaveText('Thêm mô tả ngắn');
    await expect(countEl(page)).toContainText('2 note');
  });

  test('title edit updates header and Timeline card; Undo restores in one step', async ({
    page,
  }) => {
    await openProject(page);
    await openNodeBoard(page, 'node-a');
    await editField(page, titleBtn(page), 'Node A renamed');
    await expect(titleBtn(page)).toHaveText('Node A renamed');
    await expect(titleBtn(page)).toBeFocused();

    await scope(page).locator('[data-scope-action=timeline]').click();
    const cardTitle = entry(page, 'node-a').locator('button.timeline-title');
    await expect(cardTitle).toHaveText('Node A renamed');
    await undo(page);
    await expect(cardTitle).toHaveText('Node A');
    await boardButton(page, 'node-a').first().click();
    await expect(titleBtn(page)).toHaveText('Node A');
  });

  test('summary edit fills the empty placeholder, then changes the text', async ({ page }) => {
    await openProject(page);
    await openNodeBoard(page, 'node-a');
    await editField(page, summaryBtn(page), 'First summary');
    await expect(summaryBtn(page)).toHaveText('First summary');
    await expect(summaryBtn(page)).not.toHaveClass(/is-empty/);
    await editField(page, summaryBtn(page), 'Second summary');
    await expect(summaryBtn(page)).toHaveText('Second summary');
    await undo(page);
    await expect(summaryBtn(page)).toHaveText('First summary');
    await undo(page);
    await expect(summaryBtn(page)).toHaveClass(/is-empty/);
  });

  test('Cancel and Escape commit nothing and return focus to the button', async ({ page }) => {
    await openProject(page);
    await openNodeBoard(page, 'node-a');
    await titleBtn(page).click();
    await page.locator('#overview-text').fill('Discarded');
    await editor(page).locator('[data-overview-cancel]').click();
    await expect(editor(page)).not.toBeVisible();
    await expect(titleBtn(page)).toHaveText('Node A');
    await expect(titleBtn(page)).toBeFocused();

    await summaryBtn(page).click();
    await page.locator('#overview-text').fill('Discarded');
    await page.keyboard.press('Escape');
    await expect(editor(page)).not.toBeVisible();
    await expect(summaryBtn(page)).toHaveClass(/is-empty/);
    await expect(summaryBtn(page)).toBeFocused();
  });

  test('keyboard: Tab reaches the title and Enter opens the editor', async ({ page }) => {
    await openProject(page);
    await openNodeBoard(page, 'node-a');
    await scope(page).locator('[data-scope-action=root]').focus();
    await page.keyboard.press('Tab');
    await expect(titleBtn(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(editor(page)).toBeVisible();
    await expect(page.locator('#overview-field')).toHaveValue('title');
  });

  test('pinned node shows a toast and opens no editor', async ({ page }) => {
    await openProject(page);
    await view(page, 'card');
    const nodeCard = page.locator('.graph-card[data-id="node-a"]');
    await expect(nodeCard).toBeVisible();
    await page.locator('[data-action=fit]').click();
    await nodeCard.locator('.card-pin').click();
    await expect(nodeCard.locator('.card-pin')).toHaveAttribute('aria-pressed', 'true');
    await openNodeBoard(page, 'node-a');
    await titleBtn(page).click({ force: true });
    await expect(page.locator('#toast')).toBeVisible();
    await expect(page.locator('#toast')).toContainText('ghim');
    await expect(editor(page)).not.toBeVisible();
    await expect(scope(page).locator('.board-scope-pin')).toBeVisible();
    await expect(titleBtn(page)).toHaveAttribute('aria-label', /ghim/);
    await expect(summaryBtn(page)).toBeHidden();
  });

  test('back returns to Timeline focusing the board button; project link goes to Note Board', async ({
    page,
  }) => {
    await openProject(page);
    await openNodeBoard(page, 'node-a');
    await scope(page).locator('[data-scope-action=timeline]').click();
    await expect(page.locator('#timeline-view')).toBeVisible();
    await expect(boardButton(page, 'node-a').first()).toBeFocused();

    await boardButton(page, 'node-a').first().click();
    await expect(scope(page)).toBeVisible();
    const project = scope(page).locator('[data-scope-action=root]');
    await expect(project).toHaveText('Timeline boards fixture');
    await project.click();
    await expect(page.locator('#timeline-view')).toBeHidden();
    await expect(page.locator('.graph-card[data-id="node-a"]')).toBeVisible();
  });

  test('labels follow the locale', async ({ page }) => {
    await openProject(page);
    await openNodeBoard(page, 'node-a');
    await page.locator('#locale').selectOption('en');
    await expect(scope(page).locator('[data-scope-action=timeline]')).toHaveText('Timeline');
    await expect(summaryBtn(page)).toHaveText('Add a short summary');
    await expect(countEl(page)).toContainText('2 notes');
    await page.locator('#locale').selectOption('vi');
    await expect(summaryBtn(page)).toHaveText('Thêm mô tả ngắn');
    await expect(countEl(page)).toContainText('2 note trong board');
  });
});
