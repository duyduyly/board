import { test, expect } from '@playwright/test';
test('renderer prototype single curved edge and text bounds', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { store, adapter } = await import('/assets/js/app.js');
    const { newCard, newRelation } = await import('/assets/js/store/project-store.js');
    const { blank } = await import('/assets/js/json/validator.js');
    const p = blank();
    p.cards = [newCard({ x: 30, y: 30 }, 'Root'), newCard({ x: 380, y: 130 }, 'Topic')];
    p.relations = [newRelation(p.cards[0].id, p.cards[1].id)];
    store.replace(p);
    store.switchView('mind');
    adapter.sync(store.project, null, 'mind');
    adapter.fit();
  });
  await expect(page.locator('.simple-node')).toHaveCount(2);
  const curve = await page.evaluate(async () => {
    const { adapter } = await import('/assets/js/app.js');
    const e = adapter.cy.edges()[0];
    return {
      style: e.style('curve-style'),
      points: e.controlPoints(),
      width: adapter.cy.nodes()[0].width(),
    };
  });
  expect(curve.style).toBe('unbundled-bezier');
  expect(curve.points.length).toBeGreaterThan(0);
  expect(curve.width).toBe(260);
  await page.screenshot({ path: 'planning/design/mind-map-prototype.png' });
});

async function sample(page) {
  await page.goto('/');
  await page.locator('[data-action=mind-example]').click();
  await expect(page.locator('#card-list .card-row')).toHaveCount(12);
  await page.locator('#locale').selectOption('en');
}
async function data(page) {
  return page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return {
      project: store.project,
      dirty: store.dirty,
      history: store.undoStack.length,
      view: store.activeView,
      viewports: store.viewports,
    };
  });
}
async function format(page, id = 'illustration') {
  await page.locator('.card-row[data-card-id="' + id + '"]').click();
  await page.getByRole('button', { name: 'Format', exact: true }).click();
}
test('mixed nodes, image decode, Detail click and curves in both themes', async ({ page }) => {
  const errors = [],
    external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('data:'))
      external.push(r.url());
  });
  await sample(page);
  await expect(page.locator('.graph-card[data-id=illustration] img')).toHaveAttribute(
    'src',
    new RegExp('^data:image/png;base64,'),
  );
  await page.locator('#map-view').selectOption('mind');
  await expect(page.locator('.simple-node')).toHaveCount(12);
  await expect(page.locator('.root-node')).toHaveCount(1);
  await expect(page.locator('.detached-node')).toHaveCount(1);
  await page.locator('.card-row[data-card-id=illustration]').click();
  await page.locator('[data-action=focus]').click();
  const img = page.locator('.graph-card[data-id=illustration] img');
  await expect.poll(() => img.evaluate((i) => i.naturalWidth)).toBeGreaterThan(0);
  await page.locator('[data-action=close]').click();
  await img.click();
  await expect(page.locator('#panel-title')).toHaveText('Minh họa đuôi từ');
  await page.locator('[data-action=theme]').click();
  await page.screenshot({ path: 'planning/design/mind-map-dark.png' });
  await page.locator('[data-action=theme]').click();
  await page.screenshot({ path: 'planning/design/mind-map-light.png' });
  await page.locator('#locale').selectOption('vi');
  await expect(page.locator('#map-view')).toHaveAttribute('aria-label', 'Kiểu bản đồ');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test('switch preserves draft, geometry resize isolation and atomic undo', async ({ page }) => {
  await sample(page);
  const before = await data(page);
  await format(page, 'english-overview');
  await page.locator('input[name=width]').fill('300');
  await page.locator('#map-view').selectOption('mind');
  await expect(page.locator('input[name=width]')).toHaveValue('260');
  await page.locator('input[name=width]').fill('340');
  await page.locator('#map-view').selectOption('card');
  await expect(page.locator('input[name=width]')).toHaveValue('300');
  await page.locator('#map-view').selectOption('mind');
  await expect(page.locator('input[name=width]')).toHaveValue('340');
  await page.locator('.editor button[type=submit]').click();
  const after = await data(page);
  expect(after.project.cards[0].size.width).toBe(300);
  expect(after.project.extensions['card-atlas:views'].mindMap.sizes['english-overview'].width).toBe(
    340,
  );
  expect(after.history).toBe(before.history + 1);
  await page.locator('[data-action=undo]').click();
  expect((await data(page)).project).toEqual(before.project);
});
test('view switch alone leaves model and history unchanged; export retains both viewport sets', async ({
  page,
}) => {
  await sample(page);
  const before = await data(page);
  await page.locator('#map-view').selectOption('mind');
  await page.locator('[data-action=zoom-in]').click();
  await page.locator('#map-view').selectOption('card');
  const after = await data(page);
  expect(after.project).toEqual(before.project);
  expect(after.history).toBe(before.history);
  expect(after.dirty).toBe(before.dirty);
  const output = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { serialize, stage } = await import('/assets/js/json/validator.js');
    const text = serialize(store.project, store.viewport, store.viewports);
    return { project: JSON.parse(text), errors: stage(text).errors };
  });
  expect(output.errors).toEqual([]);
  expect(output.project.extensions['card-atlas:views'].mindMap.viewport).toBeTruthy();
});
test('cover picker style Apply Cancel and referenced attachment deletion guard', async ({
  page,
}) => {
  await sample(page);
  await format(page);
  await page.locator('select[name=node-kind]').selectOption('image-text');
  await page.locator('select[name=node-imageFit]').selectOption('cover');
  await page.locator('#cancel-draft').click();
  await expect(page.locator('select[name=node-kind]')).toHaveValue('image');
  await page.locator('select[name=node-kind]').selectOption('image-text');
  await page.locator('.editor button[type=submit]').click();
  expect(
    (await data(page)).project.cards.find((c) => c.id === 'illustration').extensions[
      'card-atlas:node'
    ].kind,
  ).toBe('image-text');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('[data-remove-image=cover]').click();
  await expect(page.locator('#toast')).toContainText('Choose another cover');
  await expect(page.locator('[data-remove-image=cover]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Format', exact: true }).click();
  await page.locator('select[name=node-kind]').selectOption('text');
  await page.locator('select[name=node-coverImageId]').selectOption('');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('[data-remove-image=cover]').click();
  await page.locator('.editor button[type=submit]').click();
  expect(
    (await data(page)).project.cards.find((c) => c.id === 'illustration').extensions[
      'card-atlas:images'
    ],
  ).toBeUndefined();
});
test('Root detach explicit atomic, relation invariants and delete undo', async ({ page }) => {
  await sample(page);
  await format(page, 'english-s-use');
  const before = await data(page);
  await page.locator('#set-root').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('[data-choice=cancel]').click();
  expect((await data(page)).project).toEqual(before.project);
  await page.locator('#set-root').click();
  await page.locator('[data-choice=detach]').click();
  let state = await data(page);
  expect(state.project.extensions['card-atlas:mind-map'].rootId).toBe('english-s-use');
  expect(state.history).toBe(before.history + 1);
  await page.locator('[data-action=undo]').click();
  expect((await data(page)).project).toEqual(before.project);
  await page.locator('#delete').click();
  expect((await data(page)).project.cards.length).toBe(11);
  await page.locator('[data-action=undo]').click();
  expect((await data(page)).project).toEqual(before.project);
});
test('Mind Map drag duplicate delete and Focus remain atomic', async ({ page }) => {
  await sample(page);
  await page.locator('#map-view').selectOption('mind');
  await page.locator('.card-row[data-card-id=illustration]').click();
  await page.locator('[data-action=focus]').click();
  const before = await data(page),
    box = await page.locator('.graph-card[data-id=illustration]').boundingBox();
  await page.mouse.move(box.x + 40, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 90, { steps: 8 });
  await page.mouse.up();
  const moved = await data(page);
  expect(moved.project.cards).toEqual(before.project.cards);
  expect(moved.project.extensions['card-atlas:views'].mindMap.positions.illustration).not.toEqual(
    before.project.extensions['card-atlas:views'].mindMap.positions.illustration,
  );
  await page.locator('[data-action=undo]').click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#duplicate').click();
  await expect(page.locator('.graph-card')).toHaveCount(13);
  const duplicate = await data(page);
  expect(duplicate.project.cards.at(-1).extensions['card-atlas:node'].kind).toBe('image');
  expect(
    duplicate.project.extensions['card-atlas:views'].mindMap.positions[
      duplicate.project.cards.at(-1).id
    ],
  ).toEqual({
    x: before.project.extensions['card-atlas:views'].mindMap.positions.illustration.x + 36,
    y: before.project.extensions['card-atlas:views'].mindMap.positions.illustration.y + 36,
  });
  await page.locator('#delete').click();
  await expect(page.locator('.graph-card')).toHaveCount(12);
  await page.locator('[data-action=undo]').click();
  await expect(page.locator('.graph-card')).toHaveCount(13);
});
test('opt-in recovery restores Mind Map draft and geometry; disable removes storage', async ({
  page,
}) => {
  await sample(page);
  await page.locator('[data-action=recovery]').click();
  await page.locator('[data-choice=enable]').click();
  await page.locator('#map-view').selectOption('mind');
  await format(page);
  await page.locator('input[name=width]').fill('360');
  await expect(page.locator('#save-state')).toContainText('Unapplied changes');
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('[data-choice=restore]').click();
  await expect(page.locator('#map-view')).toHaveValue('mind');
  await expect(page.locator('input[name=width]')).toHaveValue('360');
  await page.locator('#cancel-draft').click();
  await page.locator('[data-action=recovery]').click();
  await page.locator('[data-choice=disable]').click();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('relation branch validation rejects second parent; image connector stays atomic', async ({
  page,
}) => {
  await sample(page);
  await page.evaluate(async () => {
    const { adapter } = await import('/assets/js/app.js');
    await adapter.callbacks.select({ kind: 'relation', id: 'cross-1' });
  });
  await page.locator('select[name=mind-kind]').selectOption('branch');
  await page.locator('.editor button[type=submit]').click();
  await expect(page.locator('.form-errors')).not.toBeEmpty();
  expect(
    (await data(page)).project.relations.find((r) => r.id === 'cross-1').extensions[
      'card-atlas:mind-map'
    ].kind,
  ).toBe('reference');
  await page.locator('#cancel-draft').click();
  await page.locator('.card-row[data-card-id=illustration]').click();
  await page.locator('[data-action=focus]').click();
  const before = await data(page);
  const handle = await page.locator('.graph-card[data-id=illustration] .connector').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  const empty = await page.evaluate(() => {
    const rect = document.querySelector('#canvas-region').getBoundingClientRect();
    for (let y = rect.top + 20; y < rect.bottom - 80; y += 30)
      for (let x = rect.left + 20; x < rect.right - 20; x += 30) {
        const el = document.elementFromPoint(x, y);
        if (!el?.closest('.graph-card,button,select')) return { x, y };
      }
    throw Error('No empty drop point');
  });
  await page.mouse.move(empty.x, empty.y, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('.graph-card')).toHaveCount(13);
  const after = await data(page);
  expect(after.history).toBe(before.history + 1);
  expect(after.project.relations.length).toBe(before.project.relations.length + 1);
  await page.locator('[data-action=undo]').click();
  expect((await data(page)).project).toEqual(before.project);
});
