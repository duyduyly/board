import { locale } from './ui-driver.mjs';
import { test, expect } from '@playwright/test';

async function dragBlank(page, locator) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + 30, box.y + box.height - 8);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + box.height + 40, { steps: 8 });
  await page.mouse.up();
}
const snapshot = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return JSON.stringify({ project: store.project, history: store.undoStack.length });
  });

test('pinned card is read-only in both views, unpin unlocks and Undo restores lock', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  const card = page.locator('.graph-card[data-id=card-user-service]');
  await card.locator('.card-pin').click();
  const before = await snapshot(page);
  await dragBlank(page, card);
  expect(await snapshot(page)).toBe(before);
  await expect(card.locator('.resize-handle')).toHaveCount(0);
  await expect(card.locator('.connector')).toBeDisabled();
  await expect(card.locator('time')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#card-date-editor')).not.toBeVisible();
  await page.keyboard.press('Delete');
  expect(await snapshot(page)).toBe(before);
  await card.locator('h3').click();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(page.locator('#panel-body .markdown')).toContainText('User Service');
  await expect(page.locator('#panel-tabs button').nth(1)).toBeDisabled();
  await expect(page.locator('#panel-tabs button').nth(2)).toBeDisabled();
  await expect(page.locator('#card-overview-editor')).not.toBeVisible();
  await expect(page.locator('.node-transfer-tools')).toHaveCount(0);
  await page.keyboard.press('Delete');
  expect(await snapshot(page)).toBe(before);
  await locale(page, 'en');
  await expect(page.locator('.pinned-lock-notice')).toContainText('read-only');
  await page.screenshot({ path: 'planning/design/pinned-read-only.png' });
  await page.locator('#detail-unpin').click();
  await expect(page.locator('#panel-tabs button').nth(1)).toBeEnabled();
  await page.locator('[data-action=close]').click();
  await expect(card.locator('.resize-handle')).toHaveCount(1);
  await page.locator('[data-action=undo]').first().click();
  await expect(card.locator('.resize-handle')).toHaveCount(0);
  await page.locator('#map-view').selectOption('mind');
  const pinnedMind = await snapshot(page);
  await dragBlank(page, card);
  expect(await snapshot(page)).toBe(pinnedMind);
  await page.locator('#theme-toggle').click();
  await card.locator('.card-pin').focus();
  await page.keyboard.press('Enter');
  await expect(card.locator('.card-pin')).toHaveAttribute('aria-pressed', 'false');
  const unlocked = await snapshot(page);
  await dragBlank(page, card);
  expect(await snapshot(page)).not.toBe(unlocked);
  expect(errors).toEqual([]);
});

test('pinned image can be viewed but not resized or edited, and unpin restores controls', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { stage } = await import('/assets/js/json/validator.js');
    const text = await (await fetch('/assets/data/mind-map-example.json')).text();
    store.replace(stage(text).project);
  });
  const image = page.locator('.graph-card[data-id=illustration]');
  await page.locator('[data-action=fit]').click();
  await image.locator('.card-pin').click();
  await page.locator('#map-view').selectOption('mind');
  await page.locator('[data-action=fit]').click();
  const before = await snapshot(page);
  await dragBlank(page, image);
  expect(await snapshot(page)).toBe(before);
  await image.locator('.card-open').click();
  await expect(page.locator('#detail-unpin')).toBeVisible();
  await expect(page.locator('#panel-body textarea')).toHaveCount(0);
  await expect(page.locator('#panel-tabs button').nth(2)).toBeDisabled();
  await page.locator('#detail-unpin').click();
  await expect(page.locator('#panel-tabs button').nth(2)).toBeEnabled();
});

test('uniform styling and radial layout retain pinned node geometry and styles', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  const locked = page.locator('.graph-card[data-id=card-user-api]');
  await locked.locator('.card-pin').click();
  await page.locator('.graph-card[data-id=card-user-service] h3').click();
  await page.locator('#overview-size').fill('24');
  await expect(page.locator('[data-uniform-label]')).toContainText('2');
  await page.locator('#overview-uniform').check();
  await page.locator('[data-overview-apply]').click();
  await expect(locked.locator('h3')).not.toHaveCSS('font-size', '24px');
  await page.locator('#map-view').selectOption('mind');
  const state = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { MIND, geometry } = await import('/assets/js/graph/mind-map.js');
    const { radialLayout, applyLayout } = await import('/assets/js/graph/radial-layout.js');
    // Initialize a root with a separate command; the pinned card's own role stays unchanged.
    store.commit((p) => {
      p.extensions ||= {};
      p.extensions[MIND] = { rootId: 'card-user-service' };
    });
    const before = geometry(store.project, store.project.cards[0], 'mind');
    const result = radialLayout(store.project);
    store.commit((p) => applyLayout(p, result));
    return { before, after: geometry(store.project, store.project.cards[0], 'mind') };
  });
  expect(state.after).toEqual(state.before);
});
