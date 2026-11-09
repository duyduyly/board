import { discardDraft } from './ui-driver.mjs';
import { test, expect } from '@playwright/test';
import { projectAction } from './ui-driver.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('bulk formatting shows scope, confirms overwrites and remains undoable', async ({ page }, info) => {
  await page.goto('/');
  const project = {
    version: '1.0', metadata: { title: 'Scope' },
    cards: [
      { id: 'a', title: 'A', content: '', position: { x: 0, y: 0 } },
      { id: 'b', title: 'B', content: '', position: { x: 400, y: 0 } },
      { id: 'p', title: 'Pinned', content: '', position: { x: 800, y: 0 }, extensions: { 'card-atlas:metadata': { pinned: true } } },
    ],
    relations: [{ id: 'ab', source: 'a', target: 'b' }, { id: 'ap', source: 'a', target: 'p' }],
  };
  await page.locator('#file-input').setInputFiles({ name: 'scope.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await page.locator('#modal [data-choice=apply]').click();
  await projectAction(page, 'inspector');
  const global = page.locator('#inspector-global');
  await expect(global).toContainText('2 note chưa ghim');
  await expect(global).toContainText('1 mũi tên không bị khóa');
  const apply = global.locator('button[type=submit]');
  await expect(apply).toBeDisabled();
  await global.locator('[name=typography]').check();
  await expect(apply).toBeEnabled();
  await global.locator('.inspector-global-actions button[type=button]').click();
  await page.locator('#modal [data-choice=discard]').click();
  await expect(global.locator('[name=typography]')).not.toBeChecked();
  await expect(apply).toBeDisabled();
  await global.locator('[name=typography]').check();
  const headerBefore = await page.locator('#format-inspector > header').boundingBox();
  await global.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => global.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const headerAfter = await page.locator('#format-inspector > header').boundingBox();
  expect(headerAfter.y).toBeCloseTo(headerBefore.y, 0);
  await expect(apply).toBeInViewport();
  await page.screenshot({ path: join(tmpdir(), 'card-atlas-format-panel-' + info.project.name + '.png') });
  const before = await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project));
  await apply.click();
  await expect(page.locator('#modal')).toContainText('ghi đè');
  await page.locator('#modal [data-choice=cancel]').click();
  expect(await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project))).toBe(before);
  await apply.click();
  await page.locator('#modal [data-choice=apply]').click();
  const after = await page.evaluate(async () => (await import('/assets/js/app.js')).store.project);
  expect(after.cards[0].extensions['card-atlas:typography']).toBeTruthy();
  expect(after.cards[2].extensions['card-atlas:typography']).toBeUndefined();
  await page.locator('#inspector-close').click();
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project))).toBe(before);
});

test('connector tab explains why no connector is available', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await projectAction(page, 'inspector');
  await page.locator('#inspector-tabs button').nth(3).click();
  await expect(page.locator('#inspector-edge-hint')).toBeVisible();
  await expect(page.locator('#inspector-edge-hint')).toContainText('Chọn một mũi tên');
});

test('global draft survives tab switches and closing asks before discarding it', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await projectAction(page, 'inspector');
  const global = page.locator('#inspector-global');
  await global.locator('[name=typography]').check();
  await global.locator('[name=bulk-title-fontSize]').fill('');
  await page.locator('#inspector-tabs button').nth(3).click();
  await page.locator('#inspector-tabs button').first().click();
  await expect(global.locator('[name=bulk-title-fontSize]')).toHaveValue('');
  await expect(global.locator('button[type=submit]')).toBeDisabled();
  await global.locator('[name=bulk-title-fontSize]').fill('23');
  const before = await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project));
  await page.locator('#inspector-tabs button').nth(3).click();
  await expect(page.locator('#inspector-edge-hint')).toBeVisible();
  await page.locator('#inspector-tabs button').first().click();
  await expect(global.locator('[name=typography]')).toBeChecked();
  await expect(global.locator('[name=bulk-title-fontSize]')).toHaveValue('23');
  await page.locator('[data-id=personal-0] [data-overview-field=title]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal [data-choice=cancel]').click();
  await expect(page.locator('#card-overview-editor')).not.toHaveAttribute('open', '');
  await expect(global.locator('[name=bulk-title-fontSize]')).toHaveValue('23');
  await page.locator('[data-id=personal-0]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal [data-choice=cancel]').click();
  await expect(global.locator('[name=bulk-title-fontSize]')).toHaveValue('23');
  await page.locator('#inspector-close').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal [data-choice=cancel]').click();
  await expect(global.locator('[name=bulk-title-fontSize]')).toHaveValue('23');
  await page.locator('#inspector-close').click();
  await page.locator('#modal [data-choice=discard]').click();
  await expect(page.locator('#format-inspector')).not.toBeVisible();
  expect(await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project))).toBe(before);
});

test('card and text drafts survive tab switches without changing the project', async ({ page }) => {
  page.setDefaultTimeout(5000);
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-id=personal-0]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(2).click();
  const before = await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project));
  await page.locator('[name=width]').fill('300');
  await page.locator('[data-hex-for=backgroundColor]').fill('#12');
  await page.locator('#inspector-tabs button').nth(1).click();
  await page.locator('#overview-text').fill('Tiêu đề đang sửa');
  await page.locator('#inspector-tabs button').nth(2).click();
  await expect(page.locator('[name=width]')).toHaveValue('300');
  await expect(page.locator('[data-hex-for=backgroundColor]')).toHaveValue('#12');
  await expect(page.locator('#panel-body button[type=submit]')).toBeDisabled();
  await page.locator('#inspector-tabs button').nth(1).click();
  await expect(page.locator('#overview-text')).toHaveValue('Tiêu đề đang sửa');
  await expect(page.locator('[data-overview-scope]')).toContainText('cùng lúc');
  await page.locator('[data-overview-apply]').click();
  await expect(page.locator('#card-overview-editor')).toHaveAttribute('open', '');
  await expect(page.locator('#toast')).toContainText('chưa hợp lệ');
  expect(await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project))).toBe(before);
  await page.locator('#inspector-tabs button').nth(2).click();
  await expect(page.locator('[name=width]')).toHaveValue('300');
  await expect(page.locator('[data-hex-for=backgroundColor]')).toHaveValue('#12');
  await page.locator('[data-hex-for=backgroundColor]').fill('#2468ac');
  await page.locator('#inspector-tabs button').nth(1).click();
  await expect(page.locator('#overview-text')).toHaveValue('Tiêu đề đang sửa');
  await page.locator('[data-overview-apply]').click();
  await expect(page.locator('#card-overview-editor')).not.toHaveAttribute('open', '');
  const card = await page.evaluate(async () => (await import('/assets/js/app.js')).store.project.cards.find((item) => item.id === 'personal-0'));
  expect(card.title).toBe('Tiêu đề đang sửa');
  expect(card.size.width).toBe(300);
  expect(card.style.backgroundColor.toLowerCase()).toBe('#2468ac');
  await page.locator('#inspector-close').click();
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project))).toBe(before);
});

test('bulk apply cannot silently discard invalid card input', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-id=personal-0]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(2).click();
  const before = await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project));
  await page.locator('[data-hex-for=backgroundColor]').fill('#12');
  await page.locator('#inspector-tabs button').first().click();
  await page.locator('#inspector-global [name=typography]').check();
  await page.locator('#inspector-global button[type=submit]').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal [data-choice=apply]').click();
  await expect(page.locator('#toast')).toContainText('chưa hợp lệ');
  expect(await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project))).toBe(before);
  await page.locator('#inspector-tabs button').nth(2).click();
  await expect(page.locator('[data-hex-for=backgroundColor]')).toHaveValue('#12');
});

test('combined card and uniform text Apply skips pinned cards and is one Undo', async ({ page }) => {
  await page.goto('/');
  const project = {
    version: '1.0', metadata: { title: 'Combined' },
    cards: [
      { id: 'a', title: 'A', content: '', position: { x: 0, y: 0 } },
      { id: 'b', title: 'B', content: '', position: { x: 400, y: 0 } },
      { id: 'p', title: 'Pinned', content: '', position: { x: 800, y: 0 }, extensions: { 'card-atlas:metadata': { pinned: true } } },
    ], relations: [],
  };
  await page.locator('#file-input').setInputFiles({ name: 'combined.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await page.locator('#modal [data-choice=apply]').click();
  const before = await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project));
  await page.locator('[data-id=a]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(2).click();
  await page.locator('[name=width]').fill('300');
  await page.locator('#inspector-tabs button').nth(1).click();
  await page.locator('#overview-size').fill('23');
  await page.locator('#overview-uniform').check();
  await page.locator('[data-overview-apply]').click();
  const result = await page.evaluate(async () => (await import('/assets/js/app.js')).store.project);
  expect(result.cards[0].size.width).toBe(300);
  expect(result.cards[1].extensions['card-atlas:typography'].title.fontSize).toBe(23);
  expect(result.cards[2].extensions['card-atlas:typography']).toBeUndefined();
  await page.locator('#inspector-close').click();
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project))).toBe(before);
});

test('bulk apply leaves a pending text draft intact', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-id=personal-0]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(2).click();
  const before = await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project));
  await page.locator('#inspector-tabs button').nth(1).click();
  await page.locator('#overview-text').fill('Bản nháp cần giữ');
  await page.locator('#inspector-tabs button').first().click();
  await page.locator('#inspector-global [name=typography]').check();
  await page.locator('#inspector-global button[type=submit]').click();
  await expect(page.locator('#toast')).toContainText('bản nháp Chữ & tags');
  expect(await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project))).toBe(before);
  await page.locator('#inspector-tabs button').nth(1).click();
  await expect(page.locator('#overview-text')).toHaveValue('Bản nháp cần giữ');
});

test('connector draft survives switching to global settings', async ({ page }) => {
  await page.goto('/');
  const project = {
    version: '1.0', metadata: { title: 'Connector draft' },
    cards: [
      { id: 'a', title: 'A', content: '', position: { x: 60, y: 100 }, size: { width: 260, height: 220 } },
      { id: 'b', title: 'B', content: '', position: { x: 460, y: 100 }, size: { width: 260, height: 220 } },
    ],
    relations: [{ id: 'r', source: 'a', target: 'b' }],
  };
  await page.locator('#file-input').setInputFiles({ name: 'edge.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await page.locator('#modal [data-choice=apply]').click();
  const before = await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project));
  const region = await page.locator('#canvas-region').boundingBox();
  const midpoint = await page.evaluate(async () => (await import('/assets/js/app.js')).adapter.cy.getElementById('r:r').renderedMidpoint());
  await page.mouse.click(region.x + midpoint.x, region.y + midpoint.y);
  await expect(page.locator('[name=edge-route]')).toBeVisible();
  await page.locator('[name=edge-route]').selectOption('zigzag');
  await page.locator('#inspector-tabs button').first().click();
  await page.locator('#inspector-tabs button').nth(3).click();
  await expect(page.locator('[name=edge-route]')).toHaveValue('zigzag');
  expect(await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project))).toBe(before);
  await page.locator('#panel-body button[type=submit]').click();
  const route = await page.evaluate(async () => (await import('/assets/js/app.js')).store.project.relations[0].extensions['card-atlas:edge'].route);
  expect(route).toBe('zigzag');
});

test('standalone text draft survives switching tabs and can be canceled', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-id=personal-0] [data-overview-field=title]').click();
  const before = await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project));
  await page.locator('#overview-text').fill('Chữ chưa áp dụng');
  await page.locator('#inspector-tabs button').first().click();
  await page.locator('#inspector-tabs button').nth(1).click();
  await expect(page.locator('#overview-text')).toHaveValue('Chữ chưa áp dụng');
  await page.locator('[data-overview-cancel]').click();
  expect(await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project))).toBe(before);
});

test('closing with drafts in both tabs requires explicit discard decisions', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-id=personal-0]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(2).click();
  const before = await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project));
  await page.locator('[name=width]').fill('300');
  await page.locator('#inspector-tabs button').nth(1).click();
  await page.locator('#overview-text').fill('Bản nháp chữ');
  await page.locator('#inspector-tabs button').nth(2).click();
  await page.locator('#inspector-close').click();
  await page.locator('#modal [data-choice=cancel]').click();
  await expect(page.locator('[name=width]')).toHaveValue('300');
  await page.locator('#inspector-tabs button').nth(1).click();
  await expect(page.locator('#overview-text')).toHaveValue('Bản nháp chữ');
  await page.locator('#inspector-tabs button').nth(2).click();
  await page.locator('#inspector-close').click();
  await page.locator('#modal [data-choice=discard]').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal [data-choice=discard]').click();
  await expect(page.locator('#format-inspector')).not.toBeVisible();
  expect(await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project))).toBe(before);
});

test('card format actions and header stay reachable while scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1050, height: 680 });
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-id=personal-0]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(2).click();
  const content = page.locator('#inspector-fields');
  const save = content.locator('button[type=submit]');
  await expect(save).toBeInViewport();
  expect((await save.boundingBox()).y + (await save.boundingBox()).height).toBeLessThanOrEqual(680);
  const top = await page.locator('#format-inspector > header').boundingBox();
  await content.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(save).toBeInViewport();
  expect((await save.boundingBox()).y + (await save.boundingBox()).height).toBeLessThanOrEqual(680);
  expect((await page.locator('#format-inspector > header').boundingBox()).y).toBeCloseTo(top.y, 0);
  await page.locator('#inspector-tabs button').nth(1).click();
  const textContent = page.locator('#inspector-text');
  const textApply = textContent.locator('[data-overview-apply]');
  await expect(textApply).toBeInViewport();
  expect((await textApply.boundingBox()).y + (await textApply.boundingBox()).height).toBeLessThanOrEqual(680);
  await textContent.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(textApply).toBeInViewport();
  await expect(textApply).toBeDisabled();
  const before = await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project));
  await textContent.locator('#overview-text').fill('Xem trước tiêu đề');
  await expect(textContent.locator('.overview-preview')).toHaveText('Xem trước tiêu đề');
  await expect(textApply).toBeEnabled();
  await textContent.locator('[data-overview-cancel]').click();
  expect(await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project))).toBe(before);
});

test('card sections collapse and HEX edits update only the preview until Apply', async ({ page }, info) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-id=personal-0]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(2).click();
  const before = await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project));
  const apply = page.locator('#panel-body button[type=submit]');
  await expect(apply).toBeDisabled();
  const section = page.locator('details[data-format-group=surfaceSettings]');
  await expect(section).toHaveAttribute('open', '');
  await section.locator('summary').click();
  await expect(section).not.toHaveAttribute('open', '');
  await section.locator('summary').click();
  await page.locator('[data-hex-for=backgroundColor]').fill('#12');
  await expect(apply).toBeDisabled();
  await expect(page.locator('#format-draft-status')).toContainText('Chưa lưu');
  await page.locator('[data-hex-for=backgroundColor]').fill('#2468ac');
  await expect(apply).toBeEnabled();
  await expect(page.locator('[name=backgroundColor]')).toHaveValue('#2468ac');
  await expect.poll(() => page.locator('#format-card-preview .graph-card').evaluate((element) => window.getComputedStyle(element).backgroundColor)).toBe('rgb(36, 104, 172)');
  expect(await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project))).toBe(before);
  await page.locator('[name=appearance-sizeMode]').selectOption('fit');
  await expect(page.locator('[name=width]')).toBeDisabled();
  await page.locator('[name=appearance-sizeMode]').selectOption('manual');
  await expect(page.locator('[name=width]')).toBeEnabled();
  await page.screenshot({ path: join(tmpdir(), 'card-atlas-format-card-' + info.project.name + '.png') });
  await discardDraft(page);
  expect(await page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project))).toBe(before);
});
