import { test, expect } from '@playwright/test';
import { projectAction, view } from './ui-driver.mjs';

const GROUPS = 'card-atlas:groups';

async function loadProject(page, group = {}) {
  const project = {
    version: '1.0',
    metadata: { title: 'Group links' },
    cards: [
      { id: 'a', title: 'A', content: '', position: { x: 0, y: 0 } },
      { id: 'b', title: 'B', content: '', position: { x: 320, y: 0 } },
      { id: 'c', title: 'Outside', content: '', position: { x: 160, y: 520 } },
    ],
    relations: [],
    extensions: {
      [GROUPS]: { groups: [{ id: 'g1', title: 'Team', cardIds: ['a', 'b'], ...group }] },
    },
  };
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'groups.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-action=fit]').click();
  await expect(page.locator('.group-frame[data-group-id=g1]')).toBeVisible();
}

const group = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return store.project.extensions['card-atlas:groups'].groups[0];
  });
const frame = (page) => page.locator('.group-frame[data-group-id=g1]');
const arrows = (page) => page.locator('.group-links path[data-link-id]');

/** Drags a card's connector and releases it at a page point. */
async function dragConnector(page, id, to) {
  const connector = page.locator('.graph-card[data-id=' + id + '] .connector');
  const from = await connector.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

/** A point inside the frame that is not covered by a member card. */
async function emptyFramePoint(page) {
  const box = await frame(page).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height - 8 };
}

test('the group editor saves a description that shows under the frame title', async ({ page }) => {
  await loadProject(page);
  await expect(frame(page).locator('.group-frame-description')).toBeHidden();
  await frame(page).locator('[data-group-action=edit]').click();
  const field = page.locator('textarea[name=group-description]');
  await expect(field).toBeVisible();
  await field.fill('Owns the onboarding flow');
  await page.locator('[data-choice=save-group]').click();
  const description = frame(page).locator('.group-frame-description');
  await expect(description).toHaveText('Owns the onboarding flow');
  await expect(description).toHaveAttribute('title', 'Owns the onboarding flow');
  expect((await group(page)).description).toBe('Owns the onboarding flow');
  await projectAction(page, 'undo');
  await expect(description).toBeHidden();
  expect((await group(page)).description).toBeUndefined();
});

test('dropping a connector on the group frame draws an arrow to the group, as one Undo step', async ({
  page,
}) => {
  await loadProject(page);
  await dragConnector(page, 'c', await emptyFramePoint(page));
  await expect(page.locator('#toast')).toContainText('Đã nối mũi tên vào nhóm');
  await expect(arrows(page)).toHaveCount(1);
  await expect(arrows(page)).toHaveAttribute('data-source', 'c');
  const saved = await group(page);
  expect(saved.links).toHaveLength(1);
  expect(saved.links[0].source).toBe('c');
  const relations = await page.evaluate(
    async () => (await import('/assets/js/app.js')).store.project.relations.length,
  );
  expect(relations).toBe(0);
  await expect(page.locator('.graph-card')).toHaveCount(3);
  await projectAction(page, 'undo');
  await expect(arrows(page)).toHaveCount(0);
  expect((await group(page)).links).toBeUndefined();
});

test('the keyboard path connects a note to a group through the frame title', async ({ page }) => {
  await loadProject(page);
  await page.locator('.graph-card[data-id=c] .connector').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#connect-hint')).toBeVisible();
  await frame(page).locator('.group-frame-handle').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#connect-hint')).toBeHidden();
  await expect(arrows(page)).toHaveCount(1);
});

test('a member cannot point at its own group and a second arrow from the same note is refused', async ({
  page,
}) => {
  await loadProject(page);
  await dragConnector(page, 'a', await emptyFramePoint(page));
  await expect(page.locator('#toast')).toContainText('đã nằm trong nhóm');
  await expect(arrows(page)).toHaveCount(0);
  await dragConnector(page, 'c', await emptyFramePoint(page));
  await expect(arrows(page)).toHaveCount(1);
  await dragConnector(page, 'c', await emptyFramePoint(page));
  await expect(page.locator('#toast')).toContainText('đã có mũi tên');
  expect((await group(page)).links).toHaveLength(1);
});

test('unchecking an arrow in the group editor removes it, and deleting the note removes it too', async ({
  page,
}) => {
  await loadProject(page, { links: [{ id: 'l1', source: 'c' }] });
  await expect(arrows(page)).toHaveCount(1);
  await frame(page).locator('[data-group-action=edit]').click();
  const row = page.locator('.group-links-list label', { hasText: 'Outside' });
  await expect(row).toBeVisible();
  await row.locator('input').uncheck();
  await page.locator('[data-choice=save-group]').click();
  await expect(arrows(page)).toHaveCount(0);
  expect((await group(page)).links).toBeUndefined();

  await projectAction(page, 'undo');
  await expect(arrows(page)).toHaveCount(1);
  await page.locator('.graph-card[data-id=c]').click();
  await page.keyboard.press('Delete');
  await expect(page.locator('.graph-card[data-id=c]')).toHaveCount(0);
  await expect(arrows(page)).toHaveCount(0);
  expect((await group(page)).links).toBeUndefined();
});

test('arrows to a group are drawn in the Mind Map view as well', async ({ page }) => {
  await loadProject(page, { links: [{ id: 'l1', source: 'c' }] });
  await view(page, 'mind');
  await page.locator('[data-action=fit]').click();
  await expect(frame(page)).toBeVisible();
  await expect(arrows(page)).toHaveCount(1);
});
