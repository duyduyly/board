import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { exportMenuAction } from './ui-driver.mjs';

const FIXTURE = JSON.parse(
  fs.readFileSync(new URL('./fixtures/timeline-boards-project.json', import.meta.url), 'utf8'),
);

const cards = (page) => page.locator('.graph-card');
const card = (page, id) => page.locator(`.graph-card[data-id="${id}"]`);
const frames = (page) => page.locator('section.board-frame');
const frame = (page, id) => page.locator(`section.board-frame[data-node-id="${id}"]`);
const frameOpen = (page, id) => page.locator(`button.board-frame-open[data-node-id="${id}"]`);
const undo = (page) => page.locator('[data-action=undo]');
const scope = (page) => page.locator('#board-scope');

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

async function openOverview(page) {
  await openFixture(page);
  await page.locator('.timeline-overview[data-timeline-action=overview]').click();
  await expect(page.locator('#canvas-region')).toHaveClass(/board-overview/);
  await expect(cards(page)).toHaveCount(9);
}

const intersects = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.describe('Timeline overview board ("Xem tất cả")', () => {
  test('shows every note grouped in separate frames', async ({ page }) => {
    await openOverview(page);
    await expect(scope(page).locator('.board-scope-overview-title')).toHaveText('Tất cả note');
    await expect(scope(page).locator('.board-scope-count')).toContainText('9 note');
    await expect(scope(page).locator('.board-scope-count')).toContainText('2 board');
    await expect(scope(page).locator('.board-scope-hint')).toBeVisible();

    await expect(frames(page)).toHaveCount(2);
    await expect(frames(page).nth(0)).toHaveAttribute('data-node-id', 'node-a');
    await expect(frames(page).nth(1)).toHaveAttribute('data-node-id', 'node-b');
    await expect(frame(page, 'node-c')).toHaveCount(0);

    const boxA = await frame(page, 'node-a').boundingBox();
    const boxB = await frame(page, 'node-b').boundingBox();
    expect(intersects(boxA, boxB)).toBe(false);
    for (const id of ['node-c', 'node-d', 'node-e']) {
      const cardBox = await card(page, id).boundingBox();
      expect(intersects(boxA, cardBox)).toBe(false);
      expect(intersects(boxB, cardBox)).toBe(false);
    }
  });

  test('is a read-only layout: no drag, no delete, undo stays empty', async ({ page }) => {
    await openOverview(page);
    await expect(undo(page)).toBeDisabled();
    const target = card(page, 'a-child-1');
    const before = await target.boundingBox();
    const cx = before.x + before.width / 2;
    const cy = before.y + before.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy + 40, { steps: 6 });
    await page.mouse.up();
    const after = await target.boundingBox();
    expect(Math.abs(after.x - before.x)).toBeLessThan(1);
    expect(Math.abs(after.y - before.y)).toBeLessThan(1);
    await expect(undo(page)).toBeDisabled();

    await target.click();
    await page.keyboard.press('Delete');
    await expect(page.locator('#toast')).toBeVisible();
    await expect(page.locator('#toast')).toContainText('Xem tất cả');
    await expect(cards(page)).toHaveCount(9);
    await expect(undo(page)).toBeDisabled();
  });

  test('header shows only the overview title and a drag explains the lock once', async ({
    page,
  }) => {
    await openOverview(page);
    await expect(scope(page).locator('button.board-scope-title')).toBeHidden();
    await expect(scope(page).locator('.board-scope-summary')).toBeHidden();
    await page.keyboard.press('Tab');
    const target = card(page, 'a-child-1');
    const box = await target.boundingBox();
    // Pressed on the card edge: the centre is the quick-edit text field, which is not a drag handle.
    const cx = box.x + 4;
    const cy = box.y + 4;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 40, cy + 30, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator('#toast')).toBeVisible();
    await expect(page.locator('#toast')).toContainText('Xem tất cả');
  });

  test('multi-selection works with Shift-click and marquee', async ({ page }) => {
    await openOverview(page);
    await card(page, 'a-child-1').click();
    await card(page, 'a-child-2').click({ modifiers: ['Shift'] });
    await expect(card(page, 'a-child-1')).toHaveClass(/selected/);
    await expect(card(page, 'a-child-2')).toHaveClass(/selected/);

    await page.keyboard.press('Escape');
    await expect(page.locator('.graph-card.selected')).toHaveCount(0);
    const a = await card(page, 'b-child-1').boundingBox();
    const b = await card(page, 'b-child-2').boundingBox();
    await page.keyboard.down('Shift');
    await page.mouse.move(
      Math.max(a.x + a.width, b.x + b.width) + 10,
      Math.max(a.y + a.height, b.y + b.height) + 10,
    );
    await page.mouse.down();
    await page.mouse.move(Math.min(a.x, b.x) - 10, Math.min(a.y, b.y) - 10, { steps: 12 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect(card(page, 'b-child-1')).toHaveClass(/selected/);
    await expect(card(page, 'b-child-2')).toHaveClass(/selected/);
  });

  test('status chip and quick title edit are one undo step each', async ({ page }) => {
    await openOverview(page);
    const target = card(page, 'a-child-1');
    await target.locator('.card-status-chip').click();
    await page.locator('#card-status-popover [data-status="done"]').click();
    await expect(page.locator('#card-status-popover')).not.toBeVisible();
    await expect(target.locator('.card-status-chip')).toContainText('Xong');
    await undo(page).click();
    await expect(target.locator('.card-status-chip')).not.toContainText('Xong');
    await expect(undo(page)).toBeDisabled();

    await target.locator('[data-overview-field=title]').click();
    await page.locator('#overview-text').fill('Tiêu đề mới');
    await page.locator('[data-overview-apply]').click();
    await expect(page.locator('#card-overview-editor')).not.toBeVisible();
    await expect(target).toContainText('Tiêu đề mới');
    await undo(page).click();
    await expect(target).toContainText('A child 1');
    await expect(undo(page)).toBeDisabled();
  });

  test('open a frame and come back to the overview with focus on that frame', async ({ page }) => {
    await openOverview(page);
    await frameOpen(page, 'node-a').click();
    await expect(scope(page).locator('.board-scope-title')).toHaveText('Node A');
    await expect(cards(page)).toHaveCount(2);
    const back = scope(page).locator('[data-scope-action=timeline]');
    await expect(back).toHaveText('Tất cả note');
    await back.click();
    await expect(page.locator('#canvas-region')).toHaveClass(/board-overview/);
    await expect(cards(page)).toHaveCount(9);
    await expect(frameOpen(page, 'node-a')).toBeFocused();
  });

  test('search selects a note inside the overview and keeps the mode', async ({ page }) => {
    await openOverview(page);
    await page.locator('[data-action=search]').click();
    await page.locator('#search').fill('B child 2');
    await page.locator('.card-row[data-card-id="b-child-2"]').click();
    await expect(card(page, 'b-child-2')).toHaveClass(/selected/);
    await expect(page.locator('#canvas-region')).toHaveClass(/board-overview/);
    const region = await page.locator('#canvas-region').boundingBox();
    const box = await card(page, 'b-child-2').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(region.x - 1);
    expect(box.y).toBeGreaterThanOrEqual(region.y - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(region.x + region.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(region.y + region.height + 1);
  });

  test('Mind Map leaves the mode; locale switch relabels the header', async ({ page }) => {
    await openOverview(page);
    await page.locator('#locale').selectOption('en');
    await expect(scope(page).locator('.board-scope-overview-title')).toHaveText('All notes');
    await expect(scope(page).locator('.board-scope-count')).toContainText('9 notes');
    await expect(scope(page).locator('.board-scope-count')).toContainText('2 boards');
    await page.locator('#locale').selectOption('vi');

    await page.locator('[data-map-view=mind]').click();
    const convert = page.locator('#mind-convert-root');
    if (await convert.isVisible({ timeout: 1500 }).catch(() => false))
      await page.locator('[data-choice=apply]').click();
    await expect(page.locator('#canvas-region')).not.toHaveClass(/board-overview/);
    await expect(scope(page)).toBeHidden();
  });

  test('export after panning keeps the original positions and adds no fields', async ({ page }) => {
    await openOverview(page);
    const region = await page.locator('#canvas-region').boundingBox();
    const sx = region.x + region.width - 30;
    const sy = region.y + region.height - 30;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx - 80, sy - 50, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('#canvas-region')).toHaveClass(/board-overview/);

    const downloadPromise = page.waitForEvent('download');
    await exportMenuAction(page, 'export');
    const download = await downloadPromise;
    const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    expect(exported.cards.map((c) => c.id).sort()).toEqual(FIXTURE.cards.map((c) => c.id).sort());
    for (const original of FIXTURE.cards) {
      const out = exported.cards.find((c) => c.id === original.id);
      expect(out.position).toEqual(original.position);
      expect(Object.keys(out).sort()).toEqual(Object.keys(original).sort());
      expect(Object.keys(out.extensions ?? {}).sort()).toEqual(
        Object.keys(original.extensions ?? {}).sort(),
      );
    }
  });
});
