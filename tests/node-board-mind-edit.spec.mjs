import fs from 'node:fs';
import { TextDecoder } from 'node:util';
import { test, expect } from '@playwright/test';
import { locale, projectAction, exportMenuAction, view, openRow } from './ui-driver.mjs';
import { readZip } from './docx-zip-reader.mjs';

const FIXTURE = fs.readFileSync(
  new URL('./fixtures/node-board-mind-project.json', import.meta.url),
  'utf8',
);

const card = (page, id) => page.locator(`.graph-card[data-id="${id}"]`);
const toast = (page) => page.locator('#toast');
const mindButton = (page) => page.locator('[data-map-view="mind"]');
const MIND = 'card-atlas:mind-map';

const snapshot = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return {
      project: store.project,
      history: store.undoStack.length,
      collapsed: [...store.collapsed],
      view: store.activeView,
    };
  });
const mindExt = async (page) => (await snapshot(page)).project.extensions[MIND];

async function openProject(page) {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'node-board-mind.json',
    mimeType: 'application/json',
    buffer: Buffer.from(FIXTURE),
  });
  const apply = page.locator('[data-choice=apply]');
  if (await apply.isVisible({ timeout: 1500 }).catch(() => false)) await apply.click();
  await expect(page.locator('#timeline-view')).toBeVisible();
  await locale(page, 'en');
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

async function openNodeAMind(page) {
  await openProject(page);
  await openNodeBoard(page, 'node-a');
  await mindButton(page).click();
  await expect(mindButton(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page, 'a-child-1')).toBeVisible();
  await expect(card(page, 'a-child-2')).toBeVisible();
}

async function openDetail(page, id) {
  await openRow(page, page.locator('.card-row[data-card-id="' + id + '"]'));
  await expect(page.locator('#detail-panel')).toBeVisible();
}

async function openFormat(page, id) {
  await openDetail(page, id);
  await page.getByRole('button', { name: 'Format', exact: true }).click();
  await expect(page.locator('#set-root')).toBeVisible();
}

test('Arrange in a node board previews, Cancel changes nothing, Apply is one Undo', async ({
  page,
}) => {
  await openNodeAMind(page);
  const before = await snapshot(page);
  await page.locator('[data-action=layout]').click();
  await expect(page.locator('#layout-preview-bar')).toBeVisible();
  let now = await snapshot(page);
  expect(now.project).toEqual(before.project);
  expect(now.history).toBe(before.history);

  await page.locator('[data-action=layout-cancel]').click();
  await expect(page.locator('#layout-preview-bar')).toBeHidden();
  now = await snapshot(page);
  expect(now.project).toEqual(before.project);
  expect(now.history).toBe(before.history);

  await page.locator('[data-action=layout]').click();
  await page.locator('[data-action=layout-apply]').click();
  await expect(page.locator('#layout-preview-bar')).toBeHidden();
  now = await snapshot(page);
  expect(now.history).toBe(before.history + 1);

  await projectAction(page, 'undo');
  now = await snapshot(page);
  expect(now.project).toEqual(before.project);
  expect(now.history).toBe(before.history);
});

test('collapsing and expanding branches stays inside the node board', async ({ page }) => {
  await openNodeAMind(page);
  await card(page, 'a-child-1').locator('.branch-toggle').click();
  await expect(card(page, 'a-child-2')).toBeHidden();
  await expect(card(page, 'a-child-1')).toBeVisible();
  expect((await snapshot(page)).collapsed).toContain('a-child-1');

  // Project board Mind Map keeps every note of its own tree (node-d -> node-e).
  await page.locator('[data-scope-action=root]').click();
  await expect(page.locator('#board-scope')).toBeHidden();
  await mindButton(page).click();
  await expect(mindButton(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page, 'node-d')).toBeVisible();
  await expect(card(page, 'node-e')).toBeVisible();
  const projectCollapsed = (await snapshot(page)).collapsed;
  expect(projectCollapsed).not.toContain('node-d');

  await openNodeBoard(page, 'node-a');
  await mindButton(page).click();
  await expect(card(page, 'a-child-1')).toBeVisible();
  await expect(card(page, 'a-child-2')).toBeHidden();
  await page.locator('[data-action=expand-all]').click();
  await expect(card(page, 'a-child-2')).toBeVisible();
  expect((await snapshot(page)).collapsed).not.toContain('a-child-1');
});

test('Set Root in a node board asks to detach, changes only that board root and Undo restores it', async ({
  page,
}) => {
  await openNodeAMind(page);
  const before = await snapshot(page);
  expect((await mindExt(page)).boardRoots['node-a']).toBe('a-child-1');

  await openFormat(page, 'a-child-2');
  await page.locator('#set-root').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal [data-choice=cancel]').click();
  expect((await snapshot(page)).project).toEqual(before.project);

  await page.locator('#set-root').click();
  await page.locator('#modal [data-choice=detach]').click();
  let now = await snapshot(page);
  const ext = now.project.extensions[MIND];
  expect(ext.boardRoots['node-a']).toBe('a-child-2');
  expect(ext.rootId).toBe('node-d');
  expect(now.history).toBe(before.history + 1);

  await page.locator('[data-action=undo]').click();
  now = await snapshot(page);
  expect(now.project).toEqual(before.project);
});

test('deleting the board root shows the no-root hint and the next Mind Map entry asks for a root again', async ({
  page,
}) => {
  await openNodeAMind(page);
  await openFormat(page, 'a-child-1');
  await page.locator('#delete').click();
  const confirm = page.locator('#modal [data-choice=remove]');
  if (await confirm.isVisible({ timeout: 1000 }).catch(() => false)) await confirm.click();
  await expect(card(page, 'a-child-1')).toHaveCount(0);
  expect((await mindExt(page)).boardRoots?.['node-a']).toBeUndefined();
  await expect(page.locator('#mind-map-hint')).toBeVisible();

  await page.locator('[data-map-view="card"]').click();
  await expect(mindButton(page)).toHaveAttribute('aria-pressed', 'false');
  await mindButton(page).click();
  await expect(page.locator('#mind-convert-root')).toBeVisible();
  await page.locator('#modal [data-choice=cancel]').click();
  await expect(page.locator('#modal')).not.toBeVisible();
});

test('deleting a node on the project board asks first and Undo restores its board root', async ({
  page,
}) => {
  await openProject(page);
  await view(page, 'card');
  await expect(card(page, 'node-a')).toBeVisible();
  const before = await snapshot(page);
  expect(before.project.extensions[MIND].boardRoots['node-a']).toBe('a-child-1');

  await card(page, 'node-a').click();
  await page.keyboard.press('Delete');
  await page.locator('#modal [data-choice=remove]').click();
  await expect(card(page, 'node-a')).toHaveCount(0);
  const removed = await snapshot(page);
  expect(removed.project.cards.map((c) => c.id)).not.toContain('a-child-1');
  expect(removed.project.extensions[MIND]?.boardRoots?.['node-a']).toBeUndefined();

  await page.keyboard.press('Control+z');
  await expect(card(page, 'node-a')).toBeVisible();
  const restored = await snapshot(page);
  expect(restored.project).toEqual(before.project);
});

test('a pinned board root cannot be replaced as the Mind Map root', async ({ page }) => {
  await openNodeAMind(page);
  await card(page, 'a-child-1').locator('.card-pin').click();
  const before = await snapshot(page);

  await openFormat(page, 'a-child-2');
  await page.locator('#set-root').click();
  const detach = page.locator('#modal [data-choice=detach]');
  if (await detach.isVisible({ timeout: 1000 }).catch(() => false)) await detach.click();
  await expect(toast(page)).toBeVisible();
  const now = await snapshot(page);
  expect(now.project.extensions[MIND].boardRoots['node-a']).toBe('a-child-1');
  expect(now.project).toEqual(before.project);
});

test('keyboard reaches Mind Map by Tab and Enter and Escape cancels the layout preview', async ({
  page,
}) => {
  await openProject(page);
  await openNodeBoard(page, 'node-a');
  await mindButton(page).focus();
  await expect(mindButton(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(mindButton(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page, 'a-child-1')).toBeVisible();

  const before = await snapshot(page);
  await page.locator('[data-action=layout]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#layout-preview-bar')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#layout-preview-bar')).toBeHidden();
  const now = await snapshot(page);
  expect(now.project).toEqual(before.project);
  expect(now.history).toBe(before.history);
});

test('Markdown export from the project Mind Map lists a node before its board notes', async ({
  page,
}) => {
  await openProject(page);
  await view(page, 'mind');
  await expect(card(page, 'node-d')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exportMenuAction(page, 'export-markdown'),
  ]);
  expect(await download.failure()).toBeNull();
  const zip = readZip(new Uint8Array(fs.readFileSync(await download.path())));
  const md = [...zip.entries()].find(([name]) => name.endsWith('.md'));
  const text = new TextDecoder().decode(md[1]);
  const a = text.indexOf('Node A');
  const c1 = text.indexOf('A child 1');
  const c2 = text.indexOf('A child 2');
  expect(a).toBeGreaterThanOrEqual(0);
  expect(c1).toBeGreaterThan(a);
  expect(c2).toBeGreaterThan(c1);
});
