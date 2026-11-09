import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { projectAction, locale, theme, openRow } from './ui-driver.mjs';

const example = JSON.parse(await fs.readFile('assets/data/example.json', 'utf8'));
const viewports = [
  { width: 1440, height: 900 },
  { width: 1000, height: 800 },
];

async function sample(page) {
  await page.goto('/');
  await page.locator('[data-action=example]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
}
async function emptyProject(page) {
  await page.goto('/');
  await projectAction(page, 'new');
  await page.locator('#new-project-title').fill('Empty');
  await page.locator('[data-choice=create]').click();
  await expect(page.locator('#project-name')).toHaveText('Empty');
}
const history = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return store.project.cards.length + ':' + store.project.relations.length;
  });

for (const viewport of viewports)
  for (const mode of ['light', 'dark'])
    test(`Mind convert explains empty and all-pinned projects ${viewport.width} ${mode}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await emptyProject(page);
      if (mode === 'dark') await theme(page);
      await projectAction(page, 'convert-mind');
      await expect(page.locator('#toast')).toHaveText(/Chưa có note nào/);
      await expect(page.locator('#modal')).not.toBeVisible();
      await locale(page, 'en');
      await projectAction(page, 'convert-mind');
      await expect(page.locator('#toast')).toHaveText(/no notes to build a Mind Map/);

      await page.goto('/');
      await page.locator('[data-action=example]').click();
      for (const id of ['card-user-api', 'card-user-service', 'card-database'])
        await page.locator(`.graph-card[data-id="${id}"] .card-pin`).click();
      if (mode === 'dark') await theme(page);
      await projectAction(page, 'convert-mind');
      await expect(page.locator('#toast')).toHaveText(/Mọi note đang ghim/);
      await expect(page.locator('#modal')).not.toBeVisible();
      await locale(page, 'en');
      await projectAction(page, 'convert-mind');
      await expect(page.locator('#toast')).toHaveText(/All notes are pinned/);
    });

for (const how of ['key', 'button'])
  test(`deleting a note reports cascaded relations and Undo restores them (${how})`, async ({
    page,
  }) => {
    await sample(page);
    const before = await history(page);
    if (how === 'key') {
      await page
        .locator('.graph-card[data-id="card-user-service"]')
        .click({ position: { x: 4, y: 4 } });
      await page.keyboard.press('Delete');
    } else {
      await openRow(page, page.locator('.card-row[data-card-id="card-user-service"]'));
      await page.locator('#panel-tabs button').nth(1).click();
      await page.locator('#delete').click();
    }
    await expect(page.locator('.graph-card')).toHaveCount(2);
    await expect(page.locator('#toast')).toContainText('“User Service” và 2 quan hệ');
    await expect(page.locator('#toast')).toHaveAttribute('data-position', 'bottom');
    expect(await history(page)).toBe('2:0');
    await page.keyboard.press('Control+z');
    await expect(page.locator('.graph-card')).toHaveCount(3);
    expect(await history(page)).toBe(before);
  });

test('toast shows user titles as text, not HTML', async ({ page }) => {
  const project = structuredClone(example);
  project.cards[0].title = '<img src=x onerror=window.xss=1>';
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'p.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('#modal [data-choice=apply]').click();
  await page.locator('.graph-card[data-id="card-user-api"]').click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('Delete');
  await expect(page.locator('#toast')).toContainText('<img src=x onerror=window.xss=1>');
  await expect(page.locator('#toast img')).toHaveCount(0);
  expect(await page.evaluate(() => window.xss)).toBeUndefined();
});

test('import preview names the file and gives line and column for syntax errors', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{\n "version": }'),
  });
  const modal = page.locator('#modal');
  await expect(modal).toContainText('broken.json');
  await expect(modal).toContainText('dòng 2, cột');
  await expect(modal).not.toContainText('$file');
  await expect(modal.locator('[data-choice=apply]')).toBeDisabled();
  await modal.locator('[data-choice=cancel]').click();
  await locale(page, 'en');
  await page.locator('#file-input').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{\n "version": }'),
  });
  await expect(modal).toContainText('line 2, column');
});

test('valid import folds technical adjustments into a closed disclosure', async ({ page }) => {
  const project = structuredClone(example);
  project.relations.push({ ...project.relations[0], id: 'relation-no-style', style: undefined });
  delete project.relations.at(-1).style;
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'adjusted.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  const modal = page.locator('#modal');
  await expect(modal).toBeVisible();
  const details = modal.locator('details.import-technical');
  await expect(details).toHaveCount(1);
  expect(await details.evaluate((el) => el.open)).toBe(false);
  await expect(details.locator('li').first()).toBeHidden();
  await details.locator('summary').click();
  await expect(details.locator('li').first()).toBeVisible();
  await expect(modal.locator('[data-choice=apply]')).toBeEnabled();
});

test('duplicate relation warning stays visible outside the closed technical disclosure', async ({
  page,
}) => {
  const project = structuredClone(example);
  project.relations.push({ ...project.relations[0], id: 'relation-duplicate' });
  delete project.relations.at(-1).style;
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'duplicate.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  const modal = page.locator('#modal');
  await expect(modal).toBeVisible();
  const details = modal.locator('details.import-technical');
  expect(await details.evaluate((el) => el.open)).toBe(false);
  const warning = modal.locator('ul.issues li', { hasText: 'relations[' });
  await expect(warning.first()).toBeVisible();
  expect(await warning.first().evaluate((li) => li.closest('details') === null)).toBe(true);
  await expect(modal.locator('[data-choice=apply]')).toBeEnabled();
});

test('data-i18n-aria follows the global locale', async ({ page }) => {
  await page.goto('/');
  const labelled = page.locator('[data-i18n-aria]');
  const count = await labelled.count();
  test.skip(count === 0, 'index.html has no data-i18n-aria attributes yet (owned by T08)');
  const read = () => labelled.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  const vi = await read();
  await locale(page, 'en');
  const en = await read();
  expect(en).not.toEqual(vi);
  expect(en).toContain('Card Atlas — Home');
  expect(vi).toContain('Card Atlas — Trang chủ');
  await expect(page.locator('#locale')).toHaveCount(1);
});
