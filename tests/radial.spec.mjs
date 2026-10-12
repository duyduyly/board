import { openSearch } from './ui-driver.mjs';
import { projectAction, locale, theme, view, openRow } from './ui-driver.mjs';
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
async function sample(page) {
  await page.goto('/');
  await page.locator('[data-action=mind-example]').click();
  await expect(page.locator('.card-row')).toHaveCount(12);
  await locale(page, 'en');
  await view(page, 'mind');
  await projectAction(page, 'fit');
}
async function state(page) {
  return page.evaluate(async () => {
    const { store, layoutPreview } = await import('/assets/js/app.js');
    return {
      project: store.project,
      dirty: store.dirty,
      history: store.undoStack.length,
      view: store.activeView,
      viewport: store.viewport,
      collapsed: [...store.collapsed],
      preview: Boolean(layoutPreview),
      overlaps: layoutPreview?.result.overlaps,
    };
  });
}
async function select(page, id) {
  await openRow(page, page.locator('.card-row[data-card-id="' + id + '"]'));
  await projectAction(page, 'focus');
}
async function collapse(page, id) {
  await select(page, id);
  await page.locator('[data-action=close]').click();
  await page.locator('.graph-card[data-id="' + id + '"] .branch-toggle').click();
}
test('radial preview Cancel Reset Apply and one Undo preserve model and Card Map', async ({
  page,
}) => {
  const errors = [],
    requests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (r.url().startsWith('http') && !r.url().startsWith('http://127.0.0.1:4173'))
      requests.push(r.url());
  });
  await sample(page);
  const before = await state(page);
  await projectAction(page, 'layout');
  await expect(page.locator('#layout-preview-bar')).toBeVisible();
  let current = await state(page);
  expect(current.project).toEqual(before.project);
  expect(current.history).toBe(before.history);
  expect(current.dirty).toBe(before.dirty);
  expect(current.overlaps).toBe(0);
  await page.locator('[data-action=layout-reset]').click();
  expect((await state(page)).project).toEqual(before.project);
  await page.locator('[data-action=layout-cancel]').click();
  expect((await state(page)).viewport).toEqual(before.viewport);
  await projectAction(page, 'layout');
  await locale(page, 'vi');
  await expect(page.locator('#layout-preview-bar')).toContainText('Xem trước bố trí radial');
  await theme(page);
  await page.screenshot({ path: 'planning/design/radial-preview-dark.png' });
  await locale(page, 'en');
  await page.locator('[data-action=layout-apply]').click();
  current = await state(page);
  expect(current.history).toBe(before.history + 1);
  expect(current.project.cards).toEqual(before.project.cards);
  expect(current.project.relations).toEqual(before.project.relations);
  await expect(page.locator('#layout-preview-bar')).toBeHidden();
  await page.screenshot({ path: 'planning/design/radial-applied-dark.png' });
  await projectAction(page, 'undo');
  expect((await state(page)).project).toEqual(before.project);
  await projectAction(page, 'redo');
  expect((await state(page)).project).toEqual(current.project);
  await projectAction(page, 'layout');
  await page.locator('[data-action=layout-apply]').click();
  await expect(page.locator('#layout-preview-bar')).toBeHidden();
  expect((await state(page)).history).toBe(current.history);
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
});
test('layout draft guards and switch cancellation keep drafts and viewport', async ({ page }) => {
  await sample(page);
  await select(page, 'english-s-use');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('input[name=title]').fill('Unapplied title');
  await projectAction(page, 'layout');
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('input[name=title]')).toHaveValue('Unapplied title');
  expect((await state(page)).preview).toBe(false);
  await projectAction(page, 'layout');
  await page.locator('[data-choice=apply]').click();
  const before = await state(page);
  expect(before.project.cards.find((c) => c.id === 'english-s-use').title).toBe('Unapplied title');
  await view(page, 'card');
  expect((await state(page)).preview).toBe(false);
  await expect(page.locator('#layout-preview-bar')).toBeHidden();
  await view(page, 'mind');
  expect((await state(page)).project).toEqual(before.project);
});
test('preview locks mutations, drag, export and keyboard history; Escape cancels', async ({
  page,
}) => {
  await sample(page);
  await select(page, 'english-overview');
  await page.getByRole('button', { name: 'Format', exact: true }).click();
  const before = await state(page);
  await projectAction(page, 'layout');
  await expect(page.locator('[data-action=export]')).toBeDisabled();
  await expect(page.locator('[data-action=add]')).toBeDisabled();
  expect(await page.locator('#panel-body').evaluate((e) => e.inert)).toBe(true);
  const box = await page.locator('.graph-card[data-id=english-overview]').boundingBox();
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y + 70, { steps: 6 });
  await page.mouse.up();
  expect((await state(page)).project).toEqual(before.project);
  await page.keyboard.press('Control+z');
  expect((await state(page)).history).toBe(before.history);
  await page.keyboard.press('Escape');
  await expect(page.locator('#layout-preview-bar')).toBeHidden();
  expect((await state(page)).project).toEqual(before.project);
});
test('collapse hides only branch descendants and incident references; search reveals ancestors', async ({
  page,
}) => {
  await sample(page);
  const before = await state(page);
  await collapse(page, 'english-s-use');
  await expect(page.locator('.graph-card[data-id=english-s-sounds]')).toBeHidden();
  await expect(page.locator('.graph-card[data-id=english-ed-sounds]')).toBeVisible();
  await expect(page.locator('.graph-card[data-id=english-s-use] .branch-toggle')).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(page.locator('.graph-card[data-id=english-s-use] .branch-toggle')).toContainText(
    '+2',
  );
  const after = await state(page);
  expect(after.project).toEqual(before.project);
  expect(after.history).toBe(before.history);
  expect(after.dirty).toBe(before.dirty);
  expect(
    await page.evaluate(async () => {
      const { adapter } = await import('/assets/js/app.js');
      return adapter.cy.getElementById('r:cross-1').style('display');
    }),
  ).toBe('none');
  const downloadPromise = page.waitForEvent('download');
  await projectAction(page, 'export');
  const downloaded = await downloadPromise;
  const p = JSON.parse(await fs.readFile(await downloaded.path(), 'utf8'));
  expect(p.cards).toHaveLength(12);
  expect(p.relations).toHaveLength(13);
  expect(JSON.stringify(p)).not.toContain('collapsed');
  if (await page.locator('#detail-panel').isVisible())
    await page.locator('[data-action=close]').click();
  await openSearch(page);
  await page.locator('#search').fill('/s/ /z/');
  await openRow(page, page.locator('.card-row[data-card-id=english-s-sounds]'));
  await expect(page.locator('.graph-card[data-id=english-s-sounds]')).toBeVisible();
  await expect(page.locator('#panel-title')).toHaveText('-s/-es · /s/ /z/ /ɪz/');
  expect((await state(page)).collapsed).toEqual([]);
});
test('collapse moves hidden selection safely and preview restores collapse on Cancel and Apply', async ({
  page,
}) => {
  await sample(page);
  await select(page, 'english-s-sounds');
  await page.evaluate(async () => {
    const { adapter } = await import('/assets/js/app.js');
    await adapter.callbacks.collapse('english-s-use');
  });
  await expect(page.locator('#panel-title')).toHaveText('-s/-es · Công thức');
  const collapsed = await state(page);
  await projectAction(page, 'layout');
  await expect(page.locator('.graph-card[data-id=english-s-sounds]')).toBeVisible();
  await page.locator('[data-action=layout-cancel]').click();
  expect((await state(page)).collapsed).toEqual(collapsed.collapsed);
  await expect(page.locator('.graph-card[data-id=english-s-sounds]')).toBeHidden();
  await projectAction(page, 'layout');
  await page.locator('[data-action=layout-apply]').click();
  expect((await state(page)).collapsed).toEqual(collapsed.collapsed);
  await page.locator('[data-action=expand-all]').click();
  await expect(page.locator('.graph-card[data-id=english-s-sounds]')).toBeVisible();
});
test('missing Root does not layout and collapsed state stays session only after reload', async ({
  page,
}) => {
  await sample(page);
  await collapse(page, 'english-overview');
  expect((await state(page)).collapsed).toEqual(['english-overview']);
  await page.reload();
  expect((await state(page)).collapsed).toEqual([]);
  await projectAction(page, 'home');
  await page.locator('[data-action=example]').click();
  await expect(page.locator('.graph-card[data-id=card-user-api]')).toBeVisible();
  await locale(page, 'en');
  await view(page, 'mind');
  const before = await state(page);
  await projectAction(page, 'layout');
  await expect(page.locator('#toast')).toContainText('set it as Root');
  expect((await state(page)).project).toEqual(before.project);
  expect((await state(page)).preview).toBe(false);
});

test('keyboard collapse, preview locale Escape and compact desktop controls', async ({ page }) => {
  await sample(page);
  await select(page, 'english-s-use');
  await page.locator('[data-action=close]').click();
  const toggle = page.locator('.graph-card[data-id=english-s-use] .branch-toggle');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await locale(page, 'vi');
  await expect(toggle).toHaveAttribute('aria-label', 'Mở nhánh: -s/-es · Công thức (2 node ẩn)');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.setViewportSize({ width: 1050, height: 800 });
  await projectAction(page, 'layout');
  const box = await page.locator('#layout-preview-bar').boundingBox(),
    canvas = await page.locator('#canvas-region').boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(canvas.x + canvas.width);
  await page.screenshot({ path: 'planning/design/radial-preview-1050.png' });
  await page.locator('#locale').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#layout-preview-bar')).toBeHidden();
  await theme(page);
  await page.screenshot({ path: 'planning/design/radial-light-1050.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.mobile-notice')).toBeVisible();
});
test('collapsed recovery restores full graph and draft; relation Focus reveals both endpoints', async ({
  page,
}) => {
  await sample(page);
  await collapse(page, 'english-s-use');
  await collapse(page, 'english-ed-use');
  await page.evaluate(async () => {
    const { adapter } = await import('/assets/js/app.js');
    await adapter.callbacks.select({ kind: 'relation', id: 'cross-1' });
  });
  await projectAction(page, 'focus');
  await expect(page.locator('.graph-card[data-id=english-s-sounds]')).toBeVisible();
  await expect(page.locator('.graph-card[data-id=english-ed-sounds]')).toBeVisible();
  await collapse(page, 'english-s-use');
  await openRow(page, page.locator('.card-row[data-card-id=english-s-use]'));
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('input[name=title]').fill('Recovered collapsed draft');
  await projectAction(page, 'recovery');
  await page.locator('[data-choice=enable]').click();
  await page.waitForTimeout(800);
  await page.reload();
  await page.locator('[data-choice=restore]').click();
  await expect(page.locator('input[name=title]')).toHaveValue('Recovered collapsed draft');
  expect((await state(page)).collapsed).toEqual([]);
  expect((await state(page)).project.cards).toHaveLength(12);
  await page.locator('#cancel-draft').click();
  await projectAction(page, 'recovery');
  await page.locator('[data-choice=disable]').click();
});

test('dense edge movement hint restores curves and leaves model unchanged', async ({ page }) => {
  await sample(page);
  const result = await page.evaluate(async () => {
    const { store, adapter } = await import('/assets/js/app.js');
    const p = structuredClone(store.project);
    p.relations = Array.from({ length: 1000 }, (_, i) => ({
      ...p.relations[i % p.relations.length],
      id: 'dense-' + i,
      extensions: { 'card-atlas:mind-map': { kind: 'reference' } },
    }));
    store.replace(p);
    const before = JSON.stringify(store.project);
    adapter.cy.pan({ x: 20, y: 30 });
    const deferred = adapter.cy.edges('.viewport-moving').length;
    await new Promise((r) => setTimeout(r, 300));
    return {
      deferred,
      restored: adapter.cy.edges('.viewport-moving').length,
      unchanged: before === JSON.stringify(store.project),
      dirty: store.dirty,
    };
  });
  expect(result).toEqual({ deferred: 1000, restored: 0, unchanged: true, dirty: false });
});

test('large graph skips offscreen paint and Focus reveals nodes without model changes', async ({
  page,
}) => {
  await sample(page);
  const result = await page.evaluate(async () => {
    const { store, adapter } = await import('/assets/js/app.js');
    const base = store.project.cards[0];
    const cards = Array.from({ length: 200 }, (_, i) => ({
      ...structuredClone(base),
      id: 'large-' + i,
      position: { x: i * 400, y: 100 },
      extensions: { 'card-atlas:node': { kind: 'text' } },
    }));
    store.replace({
      version: '1.0',
      metadata: { title: 'Large', description: '' },
      canvas: { zoom: 1, position: { x: 0, y: 0 } },
      cards,
      relations: [],
    });
    adapter.setViewport({ zoom: 1, position: { x: 0, y: 0 } });
    const before = JSON.stringify(store.project);
    const far = adapter.cards.get('large-199');
    const skipped = far.style.visibility === 'hidden';
    adapter.focus('large-199');
    const revealed = far.style.visibility === '';
    adapter.focus('large-0');
    return {
      skipped,
      revealed,
      firstVisible: adapter.cards.get('large-0').style.visibility === '',
      unchanged: before === JSON.stringify(store.project),
      count: store.project.cards.length,
    };
  });
  expect(result).toEqual({
    skipped: true,
    revealed: true,
    firstVisible: true,
    unchanged: true,
    count: 200,
  });
});
