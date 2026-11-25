import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { exportMenuAction, view } from './ui-driver.mjs';

const FIXTURE = new URL('./fixtures/timeline-project.json', import.meta.url);
const timelineButton = (page) => page.locator('[data-map-view=timeline]');
const timelineView = (page) => page.locator('section#timeline-view');
const entries = (page) => page.locator('#timeline-view .timeline-entry');

async function startBoard(page) {
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  await expect(page.locator('.graph-card').first()).toBeVisible();
}
async function importFile(page, buffer) {
  await page.locator('#file-input').setInputFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer,
  });
  await page
    .locator('[data-choice=apply]')
    .click({ timeout: 2000 })
    .catch(() => {});
}
async function importFixture(page) {
  await importFile(page, await fs.readFile(FIXTURE));
}
async function menuAction(page, action) {
  if (!(await page.locator('#project-menu').evaluate((e) => e.open)))
    await page.locator('#project-menu > summary').click();
  await page.locator('[data-action="' + action + '"]').click();
}
async function createTimeline(page) {
  await menuAction(page, 'timeline-create');
  await expect(timelineView(page)).toBeVisible();
}
const expectTimeline = async (page) => {
  await expect(timelineView(page)).toBeVisible();
  await expect(timelineButton(page)).toHaveAttribute('aria-pressed', 'true');
};
const expectBoard = async (page) => {
  await expect(timelineView(page)).not.toBeVisible();
  await expect(page.locator('[data-map-view=card]')).toHaveAttribute('aria-pressed', 'true');
};

test('a project without Timeline hides the view button and opens the Note Board', async ({
  page,
}) => {
  await startBoard(page);
  await expect(timelineButton(page)).toBeHidden();
  await expect(timelineView(page)).not.toBeVisible();
  await expectBoard(page);
  await page.locator('#project-menu > summary').click();
  await expect(page.locator('[data-action=timeline-create]')).toBeVisible();
  await expect(page.locator('[data-action=timeline-remove]')).toBeHidden();
});

test('create Timeline from the ? menu, then Undo and Redo move one step', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startBoard(page);
  await createTimeline(page);
  await expectTimeline(page);
  await expect(page.locator('#toast')).toBeVisible();
  await expect(page.locator('#toast')).toContainText('Timeline');

  await page.keyboard.press('Control+z');
  await expectBoard(page);
  await expect(timelineButton(page)).toBeHidden();

  // Redo restores the configuration only; the session stays on the active view.
  await page.keyboard.press('Control+Shift+z');
  await expect(timelineButton(page)).toBeVisible();
  await view(page, 'timeline');
  await expectTimeline(page);
  expect(errors).toEqual([]);
});

test('importing a Timeline project opens straight into Timeline with its notes', async ({
  page,
}) => {
  await page.goto('/');
  await importFixture(page);
  await expectTimeline(page);
  await expect(entries(page).first()).toBeVisible();
});

test('Home then Continue returns to Timeline', async ({ page }) => {
  await page.goto('/');
  await importFixture(page);
  await expectTimeline(page);
  await page.locator('[data-action=home]').click();
  await expect(timelineView(page)).not.toBeVisible();
  await page.locator('[data-action=continue]').click();
  await expectTimeline(page);
});

test('switch Timeline, Note Board, Mind Map and back to Timeline', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await importFixture(page);
  await expectTimeline(page);

  await view(page, 'card');
  await expectBoard(page);
  await view(page, 'mind');
  await expect(timelineView(page)).not.toBeVisible();
  await expect(page.locator('[data-map-view=mind]')).toHaveAttribute('aria-pressed', 'true');
  await view(page, 'timeline');
  await expectTimeline(page);
  await expect(entries(page).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('remove Timeline: Cancel keeps it, confirm returns to board keeping notes, Undo restores', async ({
  page,
}) => {
  await page.goto('/');
  await importFixture(page);
  await expectTimeline(page);
  const stored = () =>
    page.evaluate(async () => {
      const { store } = await import('/assets/js/app.js');
      return {
        count: store.project.cards.length,
        scheduled: store.project.cards.filter((c) => c.extensions?.['card-atlas:schedule']).length,
      };
    });
  const before = await stored();

  await menuAction(page, 'timeline-remove');
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal [data-choice=cancel]').click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await expectTimeline(page);

  await menuAction(page, 'timeline-remove');
  await page.locator('#modal [data-choice=remove]').click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await expectBoard(page);
  await expect(timelineButton(page)).toBeHidden();
  expect(await stored()).toEqual(before);

  // Undo restores the configuration only; the session stays on the active view.
  await page.keyboard.press('Control+z');
  await expect(timelineButton(page)).toBeVisible();
  await view(page, 'timeline');
  await expectTimeline(page);
  expect(await stored()).toEqual(before);
});

test('a dirty Detail draft blocks the view switch until resolved; Cancel keeps the draft', async ({
  page,
}) => {
  await page.goto('/');
  await importFixture(page);
  await expectTimeline(page);
  await view(page, 'card');
  await expectBoard(page);

  await page.locator('.graph-card').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detail-panel')).toBeVisible();
  await page.locator('#panel-tabs button').nth(2).click();
  const bg = page.locator('[name=appearance-backgroundTransparent]');
  const original = await bg.isChecked();
  await bg.setChecked(!original);

  await timelineButton(page).click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal [data-choice=cancel]').click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(timelineView(page)).not.toBeVisible();
  await expect(bg).toBeChecked({ checked: !original });
});

test('export then import keeps Timeline and every schedule', async ({ page }) => {
  await page.goto('/');
  await importFixture(page);
  await expectTimeline(page);
  const original = JSON.parse(await fs.readFile(FIXTURE, 'utf8'));
  const schedules = (p) =>
    Object.fromEntries(p.cards.map((c) => [c.id, c.extensions?.['card-atlas:schedule'] ?? null]));

  const downloading = page.waitForEvent('download');
  await exportMenuAction(page, 'export');
  const exported = JSON.parse(await fs.readFile(await (await downloading).path(), 'utf8'));
  expect(exported.extensions['card-atlas:timeline']).toBeTruthy();
  expect(schedules(exported)).toEqual(schedules(original));

  await page.locator('[data-action=home]').click();
  await importFile(page, Buffer.from(JSON.stringify(exported)));
  await expectTimeline(page);
  const reimported = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return store.project;
  });
  expect(reimported.extensions['card-atlas:timeline']).toBeTruthy();
  expect(schedules(reimported)).toEqual(schedules(original));
});
