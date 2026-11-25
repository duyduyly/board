import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { exportMenuAction } from './ui-driver.mjs';

const FIXTURE = JSON.parse(
  fs.readFileSync(new URL('./fixtures/timeline-boards-project.json', import.meta.url), 'utf8'),
);

const boardButton = (page, id) =>
  page.locator(`#timeline-view li.timeline-entry[data-card-id="${id}"] button.timeline-board`);
const scroller = (page) => page.locator('#timeline-view .timeline-scroll');
const scope = (page) => page.locator('nav#board-scope');
const cards = (page) => page.locator('.graph-card');

async function openFixture(page) {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'timeline-boards.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(FIXTURE)),
  });
  const apply = page.locator('[data-choice=apply]');
  if (await apply.isVisible({ timeout: 1500 }).catch(() => false)) await apply.click();
  await expect(page.locator('#timeline-view')).toBeVisible();
}

test.describe('Timeline node boards', () => {
  test('open, add, return, undo and export node boards from Timeline', async ({ page }) => {
    // Narrow viewport so the three dated notes overflow and Timeline can scroll horizontally.
    await page.setViewportSize({ width: 700, height: 900 });
    await openFixture(page);
    await expect(boardButton(page, 'node-a')).toContainText('2 note');
    await expect(boardButton(page, 'node-b')).toContainText('2 note');
    await expect(boardButton(page, 'node-c')).toContainText('Board trống');

    // Scroll Timeline first so the return trip has a position to restore.
    await scroller(page).evaluate((el) => {
      el.scrollLeft = Math.min(120, el.scrollWidth - el.clientWidth);
    });
    const before = await scroller(page).evaluate((el) => el.scrollLeft);
    expect(before).toBeGreaterThan(0);

    await boardButton(page, 'node-a').click();
    await expect(scope(page)).toBeVisible();
    await expect(cards(page)).toHaveCount(2);
    await expect(scope(page).locator('.board-scope-title')).toHaveText('Node A');
    await expect(scope(page).locator('.board-scope-count')).toContainText('2');

    await page.locator('[data-palette-kind=card]').click();
    await expect(cards(page)).toHaveCount(3);
    await expect(scope(page).locator('.board-scope-count')).toContainText('3');

    await scope(page).locator('button[data-scope-action=timeline]').click();
    await expect(page.locator('#timeline-view')).toBeVisible();
    await expect(boardButton(page, 'node-a')).toContainText('3 note');
    await expect(boardButton(page, 'node-a')).toBeFocused();
    expect(Math.abs((await scroller(page).evaluate((el) => el.scrollLeft)) - before)).toBeLessThan(
      2,
    );

    await page.keyboard.press('Control+z');
    await expect(boardButton(page, 'node-a')).toContainText('2 note');

    await boardButton(page, 'node-b').click();
    await expect(scope(page).locator('.board-scope-title')).toHaveText('Node B');
    await expect(cards(page)).toHaveCount(2);
    await expect(page.locator('.graph-card[data-id="a-child-1"]')).toHaveCount(0);
    await expect(page.locator('.graph-card[data-id="b-child-1"]')).toHaveCount(1);
    await scope(page).locator('button[data-scope-action=timeline]').click();
    await expect(page.locator('#timeline-view')).toBeVisible();

    // Root Note Board does not show board children.
    await page.locator('[data-map-view="card"]').click();
    await expect(page.locator('#timeline-view')).toBeHidden();
    await expect(page.locator('.graph-card[data-id="node-d"]')).toHaveCount(1);
    await expect(page.locator('.graph-card[data-id="a-child-1"]')).toHaveCount(0);
    await expect(page.locator('.graph-card[data-id="b-child-1"]')).toHaveCount(0);

    // Export keeps the owner extension on children.
    const downloadPromise = page.waitForEvent('download');
    await exportMenuAction(page, 'export');
    const download = await downloadPromise;
    const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    const child = exported.cards.find((c) => c.id === 'a-child-1');
    expect(child.extensions['card-atlas:owner'].nodeId).toBe('node-a');
  });

  test('count button label follows the locale', async ({ page }) => {
    await openFixture(page);
    await page.locator('#locale').selectOption('en');
    await expect(boardButton(page, 'node-a')).toContainText('2 notes');
    await expect(boardButton(page, 'node-a')).toHaveAttribute(
      'aria-label',
      /Open the board of Node A \(2 notes\)/,
    );
  });
});
