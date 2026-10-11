import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const example = await fs.readFile('assets/data/example.json', 'utf8');
async function sample(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở ví dụ', exact: true }).click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
}
async function selectService(page) {
  await page.locator('.card-row[data-card-id="card-user-service"]').click();
  await expect(page.locator('#panel-title')).toHaveText('User Service');
}
async function exportData(page) {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-action=export]').click();
  const d = await downloadPromise;
  return JSON.parse(await fs.readFile(await d.path(), 'utf8'));
}

test('primary screen, documentation and vi/en without content changes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await sample(page);
  await selectService(page);
  await expect(page.locator('.diagram svg')).toBeVisible();
  await expect(page.locator('.diagram')).toContainText('User Service');
  await expect(page.locator('#relations-list')).toContainText('Quan hệ đi vào');
  const a = await exportData(page);
  await page.locator('#locale').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Overview', exact: true })).toBeVisible();
  const b = await exportData(page);
  expect(a).toEqual(b);
  await page.screenshot({ path: 'planning/design/editor-browser.png' });
  expect(errors).toEqual([]);
});

test('editor draft survives locale switch, guard cancel/discard and Apply', async ({ page }) => {
  await sample(page);
  await selectService(page);
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('input[name=title]').fill('Changed Service');
  await page.locator('#locale').selectOption('en');
  await expect(page.locator('input[name=title]')).toHaveValue('Changed Service');
  await page.locator('.card-row[data-card-id="card-database"]').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal-locale').selectOption('vi');
  await expect(page.locator('#modal')).toContainText('Giữ các chỉnh sửa?');
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('input[name=title]')).toHaveValue('Changed Service');
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(page.locator('#panel-title')).toHaveText('Changed Service');
  await page.locator('[data-action=undo]').click();
  await expect(page.locator('#panel-title')).toHaveText('User Service');
});

test('drag card one undo, duplicate and cascade deletion', async ({ page }) => {
  await sample(page);
  const c = page.locator('.graph-card[data-id="card-user-api"]');
  const box = await c.boundingBox();
  const before = await exportData(page);
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 95, { steps: 8 });
  await page.mouse.up();
  const moved = await exportData(page);
  expect(moved.cards[0].position).not.toEqual(before.cards[0].position);
  await page.locator('[data-action=undo]').click();
  const restored = await exportData(page);
  expect(restored.cards).toEqual(before.cards);
  await c.dblclick();
  await page.locator('#duplicate').click();
  await expect(page.locator('.graph-card')).toHaveCount(4);
  await page.locator('#delete').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
  await page.locator('[data-action=undo]').click();
  await expect(page.locator('.graph-card')).toHaveCount(4);
});

test('connector empty drop creates card and relation atomically', async ({ page }) => {
  await sample(page);
  await selectService(page);
  const connector = page.locator('.graph-card[data-id="card-user-service"] .connector');
  const box = await connector.boundingBox();
  const canvas = await page.locator('#canvas-region').boundingBox();
  await page.mouse.move(box.x + 9, box.y + 9);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + 90, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('.graph-card')).toHaveCount(4);
  const p = await exportData(page);
  expect(p.relations).toHaveLength(3);
  await page.locator('[data-action=undo]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
  const restored = await exportData(page);
  expect(restored.relations).toHaveLength(2);
});

test('invalid import preserves active project and valid import round-trip', async ({ page }) => {
  await sample(page);
  await page
    .locator('#file-input')
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(page.locator('#modal')).toContainText('Cú pháp JSON');
  await expect(page.locator('[data-choice=apply]')).toBeDisabled();
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
  const p = await exportData(page);
  await page.locator('#file-input').setInputFiles({
    name: 'good.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await expect(page.locator('#modal')).toContainText('Xem trước');
  await page.locator('[data-choice=apply]').click();
  await expect(page.locator('#modal')).not.toBeVisible();
  const restored = await exportData(page);
  expect(restored).toEqual(p);
});

test('applied export keeps draft; replacement cancel retains work', async ({ page }) => {
  await sample(page);
  await selectService(page);
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('textarea[name=content]').fill('# Unsaved Draft');
  const dl = page.waitForEvent('download');
  await page.locator('[data-action=export]').click();
  await page.locator('[data-choice=applied]').click();
  await dl;
  await expect(page.locator('textarea[name=content]')).toHaveValue('# Unsaved Draft');
  await page.locator('.toolbar [data-action=new]').click();
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await page.locator('.toolbar [data-action=new]').click();
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
});

test('Markdown safety, blocked images, invalid Mermaid and no external requests', async ({
  page,
}) => {
  const external = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('blob:'))
      external.push(r.url());
  });
  await sample(page);
  await selectService(page);
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page
    .locator('textarea[name=content]')
    .fill(
      '# Safe\n\n<script>window.hacked=true</script>\n\n[evil](javascript:alert(1))\n\n![test](https://example.com/private.png)\n\n' +
        String.fromCharCode(96).repeat(3) +
        'mermaid\nnot a diagram\n' +
        String.fromCharCode(96).repeat(3),
    );
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await page.getByRole('button', { name: 'Tổng quan', exact: true }).click();
  await expect(page.locator('.blocked-image')).toBeVisible();
  await expect(page.locator('.form-errors')).toContainText('Không thể render');
  expect(await page.evaluate(() => window.hacked)).toBeUndefined();
  expect(await page.locator('.markdown a[href^="javascript:"]').count()).toBe(0);
  expect(external).toEqual([]);
  expect(
    await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
  ).toEqual({ local: 0, session: 0 });
});

test('search, keyboard input isolation, panel resize, desktop notice', async ({ page }) => {
  await sample(page);
  await page.locator('#search').fill('storage');
  await expect(page.locator('.card-row')).toHaveCount(1);
  await page.locator('.card-row').click();
  await expect(page.locator('#panel-title')).toHaveText('Database');
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('input[name=title]').focus();
  await page.keyboard.press('Delete');
  await expect(page.locator('.graph-card')).toHaveCount(3);
  const divider = await page.locator('#panel-divider').boundingBox();
  await page.mouse.move(divider.x + 4, divider.y + 40);
  await page.mouse.down();
  await page.mouse.move(divider.x - 120, divider.y + 40);
  await page.mouse.up();
  expect((await page.locator('#detail-panel').boundingBox()).width).toBeGreaterThan(400);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.mobile-notice')).toBeVisible();
});

test('Format Guide example/schema downloads keep dirty state', async ({ page }) => {
  await sample(page);
  await selectService(page);
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('input[name=title]').fill('changed');
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await page.locator('[data-action=format]').click();
  const d = page.waitForEvent('download');
  await page.locator('#schema-download').click();
  const schema = JSON.parse(await fs.readFile(await (await d).path(), 'utf8'));
  expect(schema.properties.version.const).toBe('1.0');
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('#save-state')).toContainText('Chưa xuất');
});

test('Connect mode, relation editor endpoints and style, self-loop rejected', async ({ page }) => {
  await sample(page);
  await selectService(page);
  await page.locator('[data-action=connect]').click();
  await page.locator('.graph-card[data-id="card-database"]').click();
  const data = await exportData(page);
  expect(data.relations).toHaveLength(3);
  await page.locator('[data-action=fit]').click();
  const edgePoint = await page.evaluate(async () => {
    const { adapter } = await import('/assets/js/app.js');
    const edge = adapter.cy.edges().last();
    return edge.renderedMidpoint();
  });
  const rect = await page.locator('#canvas-region').boundingBox();
  await page.mouse.click(rect.x + edgePoint.x, rect.y + edgePoint.y);
  await expect(page.locator('input[name=label]')).toBeVisible();
  await page.locator('input[name=label]').fill('optional');
  await page.locator('select[name=line]').selectOption('dashed');
  await page.locator('select[name=arrow]').selectOption('both');
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  const edited = await exportData(page);
  expect(edited.relations.at(-1).style).toMatchObject({ line: 'dashed', arrow: 'both' });
  await page.locator('select[name=target]').selectOption(edited.relations.at(-1).source);
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(page.locator('.form-errors')).toContainText('chính thẻ');
  await page.locator('#cancel-draft').click();
  await page.locator('#delete').click();
  expect((await exportData(page)).relations).toHaveLength(2);
});

test('image opt-in only after click and fresh session resets it', async ({ page }) => {
  let requests = 0;
  await page.route('https://example.com/**', async (route) => {
    requests++;
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
    });
  });
  await sample(page);
  await selectService(page);
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('textarea[name=content]').fill('![test](https://example.com/image.svg)');
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await page.getByRole('button', { name: 'Tổng quan', exact: true }).click();
  await expect(page.locator('.blocked-image')).toBeVisible();
  expect(requests).toBe(0);
  await page.locator('#allow-images').click();
  await expect(page.locator('.markdown img')).toBeVisible();
  await expect.poll(() => requests).toBe(1);
  page.once('dialog', (d) => d.accept());
  await page.reload();
  await page.getByRole('button', { name: 'Mở ví dụ', exact: true }).click();
  await selectService(page);
  await expect(page.locator('#allow-images')).toBeVisible();
});

test('normalization warning, dirty state and beforeunload only for content', async ({ page }) => {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'minimal.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ version: '1.0', cards: [{ id: 'a', title: 'A' }], relations: [] }),
    ),
  });
  await expect(page.locator('#modal')).toContainText('Đã bổ sung');
  await page.locator('[data-choice=apply]').click();
  await expect(page.locator('#save-state')).toContainText('Chưa xuất');
  expect(
    await page.evaluate(
      () => !window.dispatchEvent(new Event('beforeunload', { cancelable: true })),
    ),
  ).toBe(true);
  await exportData(page);
  expect(
    await page.evaluate(
      () => !window.dispatchEvent(new Event('beforeunload', { cancelable: true })),
    ),
  ).toBe(false);
  await page.locator('[data-action=zoom-in]').click();
  await expect(page.locator('#save-state')).toContainText('góc nhìn');
  expect(
    await page.evaluate(
      () => !window.dispatchEvent(new Event('beforeunload', { cancelable: true })),
    ),
  ).toBe(false);
});

test('English workflow import, edit, search and export guards', async ({ page }) => {
  await page.goto('/');
  await page.locator('#locale').selectOption('en');
  await page.locator('#file-input').setInputFiles({
    name: 'example.json',
    mimeType: 'application/json',
    buffer: Buffer.from(example),
  });
  await expect(page.locator('#modal')).toContainText('Import preview');
  await page.getByRole('button', { name: 'Apply import', exact: true }).click();
  await page.locator('#search').fill('storage');
  await page.locator('.card-row').click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('input[name=title]').fill('Database Updated');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('#save-state')).toContainText('Unsaved changes');
  await page.locator('textarea[name=content]').fill('# New English Draft');
  await page.locator('[data-action=export]').click();
  await expect(page.locator('#modal')).toContainText('Export with unapplied edits?');
  await page.locator('#modal').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('textarea[name=content]')).toHaveValue('# New English Draft');
  await page.locator('#cancel-draft').click();
  const data = await exportData(page);
  expect(data.cards.find((c) => c.id === 'card-database').title).toBe('Database Updated');
  await expect(page.locator('#save-state')).toContainText('Export initiated');
});

test('wheel zoom and Space drag pan preserve card data', async ({ page }) => {
  await sample(page);
  const initial = await exportData(page);
  const canvas = await page.locator('#canvas-region').boundingBox();
  await page.mouse.move(canvas.x + 80, canvas.y + 50);
  await page.mouse.wheel(0, -100);
  await expect
    .poll(async () => parseFloat(await page.locator('#zoom-value').textContent()))
    .not.toBe(Math.round(initial.canvas.zoom * 100));
  await page.keyboard.down('Space');
  await page.mouse.down();
  await page.mouse.move(canvas.x + 160, canvas.y + 100, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  const updated = await exportData(page);
  expect(updated.cards).toEqual(initial.cards);
  expect(updated.canvas).not.toEqual(initial.canvas);
});

test('failed export preserves dirty and Escape cancels connector creation', async ({ page }) => {
  await sample(page);
  await selectService(page);
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('input[name=title]').fill('Must keep');
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await page.evaluate(() => {
    window.originalAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = () => {
      throw Error('simulated download failure');
    };
  });
  await page.locator('[data-action=export]').click();
  await expect(page.locator('#toast')).toContainText('Xuất file thất bại');
  await expect(page.locator('#save-state')).toContainText('Chưa xuất');
  await page.evaluate(() => (HTMLAnchorElement.prototype.click = window.originalAnchorClick));
  const box = await page
    .locator('.graph-card[data-id="card-user-service"] .connector')
    .boundingBox();
  const canvas = await page.locator('#canvas-region').boundingBox();
  await page.mouse.move(box.x + 9, box.y + 9);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 100, canvas.y + 100);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.graph-card')).toHaveCount(3);
  expect((await exportData(page)).relations).toHaveLength(2);
});

test('Mermaid embedded resources and configuration blocked before rendering', async ({ page }) => {
  const external = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('blob:'))
      external.push(r.url());
  });
  await sample(page);
  await selectService(page);
  const fence = String.fromCharCode(96).repeat(3);
  for (const source of [
    '%%{init: {"themeCSS":"@import url(https://example.com/style.css)"}}%%\nflowchart LR\n A-->B',
    'flowchart LR\n A@{ img: "https://example.com/image.png" }',
  ]) {
    await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
    await page.locator('textarea[name=content]').fill(fence + 'mermaid\n' + source + '\n' + fence);
    await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
    await page.getByRole('button', { name: 'Tổng quan', exact: true }).click();
    await expect(page.locator('.form-errors')).toContainText('V1 không cho');
  }
  expect(external).toEqual([]);
});

test('English endings example opens, renders and round-trips in both locales', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#locale').selectOption('en');
  await page.getByRole('button', { name: 'English example: -s/-es and -ed', exact: true }).click();
  await expect(page.locator('.graph-card')).toHaveCount(11);
  await page.locator('.card-row[data-card-id="english-overview"]').click();
  await expect(page.locator('.diagram svg')).toBeVisible();
  await page.locator('#locale').selectOption('vi');
  await page.locator('.card-row[data-card-id="english-ed-sounds"]').click();
  await expect(page.locator('#panel-body')).toContainText('/ɪd/');
  const exported = await exportData(page);
  expect(exported.cards).toHaveLength(11);
  expect(exported.relations).toHaveLength(13);
  await page.locator('#file-input').setInputFiles({
    name: 'lesson.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await page.getByRole('button', { name: 'Áp dụng dữ liệu', exact: true }).click();
  expect(await exportData(page)).toEqual(exported);
  await page.locator('.card-row[data-card-id="english-s-sounds"]').click();
  await expect(page.locator('#panel-body')).toContainText('/ɪz/');
  await page.screenshot({ path: 'planning/design/english-endings-example.png' });
  expect(errors).toEqual([]);
});

test('Badges, theme and Fit/Focus preserve project, history and drafts', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-action=focus]')).toBeDisabled();
  await page.locator('[data-action=english-example]').click();
  const snapshot = () =>
    page.evaluate(async () => {
      const { store } = await import('/assets/js/app.js');
      return {
        project: store.project,
        undo: store.undoStack.length,
        redo: store.redoStack.length,
        dirty: store.dirty,
      };
    });
  const baseline = await snapshot();
  await expect(page.locator('.graph-card[data-id="english-s-use"] .type-badge')).toHaveText('s-es');
  await expect(page.locator('.graph-card[data-id="english-s-use"] .tag-badge')).toHaveCount(2);
  await expect(page.locator('.graph-card[data-id="english-s-use"] .card-degree')).toHaveAttribute(
    'aria-label',
    '3 quan hệ',
  );
  await page.locator('.card-row[data-card-id="english-s-use"]').click();
  await page.locator('[data-action=fit]').click();
  const fitZoom = await page.locator('#zoom-value').textContent();
  await page.locator('[data-action=focus]').click();
  expect(await page.locator('#zoom-value').textContent()).not.toEqual(fitZoom);
  const cardBox = await page.locator('.graph-card[data-id="english-s-use"]').boundingBox();
  const frame = await page.locator('#canvas-region').boundingBox();
  expect(Math.abs(cardBox.x + cardBox.width / 2 - frame.x - frame.width / 2)).toBeLessThan(3);
  expect(Math.abs(cardBox.y + cardBox.height / 2 - frame.y - frame.height / 2)).toBeLessThan(3);
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('input[name=title]').fill('Unsaved grammar draft');
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('input[name=title]')).toHaveValue('Unsaved grammar draft');
  await page.locator('#locale').selectOption('en');
  await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-label', 'Switch to light mode');
  await expect(page.locator('input[name=title]')).toHaveValue('Unsaved grammar draft');
  await page.locator('[data-action=fit]').click();
  expect(await snapshot()).toEqual(baseline);
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await snapshot()).toEqual(baseline);
  await page.locator('#cancel-draft').click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.graph-card')).toHaveCount(0);
});

test('Focus relation fits both endpoints after panel resize', async ({ page }) => {
  await sample(page);
  await page.locator('[data-action=fit]').click();
  const point = await page.evaluate(async () => {
    const { adapter } = await import('/assets/js/app.js');
    return adapter.cy.edges().first().renderedMidpoint();
  });
  const initialFrame = await page.locator('#canvas-region').boundingBox();
  await page.mouse.click(initialFrame.x + point.x, initialFrame.y + point.y);
  await expect(page.locator('input[name=label]')).toBeVisible();
  await page.locator('[data-action=expand]').click();
  await page.locator('[data-action=focus]').click();
  const frame = await page.locator('#canvas-region').boundingBox();
  for (const id of ['card-user-api', 'card-user-service']) {
    const box = await page.locator('.graph-card[data-id="' + id + '"]').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(frame.x);
    expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width);
    expect(box.y).toBeGreaterThanOrEqual(frame.y);
    expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height);
  }
  await page.locator('[data-action=close]').click();
  await expect(page.locator('[data-action=focus]')).toBeDisabled();
});

test('New Project names blank projects and preserves work when replacement is cancelled', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('.toolbar [data-action=new]').click();
  await expect(page.locator('#new-project-title')).toBeFocused();
  await page.locator('#new-project-title').fill('   ');
  await expect(page.locator('[data-choice=create]')).toBeDisabled();
  await page.locator('#modal-locale').selectOption('en');
  await expect(page.locator('[data-choice=create]')).toBeDisabled();
  await page.locator('#new-project-title').fill('  English Practice  ');
  await page.locator('#new-project-title').press('Enter');
  await expect(page.locator('#project-name')).toHaveText('English Practice');
  await expect(page.locator('#toast')).toHaveText('New project created');
  await page.locator('#locale').selectOption('vi');
  await page.locator('[data-action=example]').click();
  await page.locator('[data-action=add]').click();
  await expect(page.locator('.graph-card')).toHaveCount(4);
  const snapshot = () =>
    page.evaluate(async () => {
      const { store } = await import('/assets/js/app.js');
      return { project: store.project, undo: store.undoStack.length, dirty: store.dirty };
    });
  const before = await snapshot();
  await page.locator('.toolbar [data-action=new]').click();
  await page.locator('#new-project-title').fill('Next Project');
  await page.locator('[data-choice=create]').click();
  await expect(page.locator('#modal')).toContainText('Thay thế dự án hiện tại?');
  await page.locator('[data-choice=cancel]').click();
  expect(await snapshot()).toEqual(before);
  await page.locator('.toolbar [data-action=new]').click();
  await page.locator('#new-project-title').fill('Next Project');
  await page.locator('[data-choice=create]').click();
  await page.locator('[data-choice=replace]').click();
  await expect(page.locator('#project-name')).toHaveText('Next Project');
  await expect(page.locator('.graph-card')).toHaveCount(0);
  await expect(page.locator('[data-action=undo]')).toBeDisabled();
  await expect(page.locator('#zoom-value')).toHaveText('100%');
  expect((await snapshot()).dirty).toEqual(false);
});

test('New Project remains visible and usable at smaller desktop widths', async ({ page }) => {
  await page.goto('/');
  for (const width of [1050, 900, 820]) {
    await page.setViewportSize({ width, height: 800 });
    const button = page.locator('.toolbar [data-action=new]');
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    const localeBox = await page.locator('#locale').boundingBox();
    expect(localeBox.x + localeBox.width).toBeLessThanOrEqual(width);
    await button.click();
    await expect(page.locator('#new-project-title')).toBeVisible();
    await page.locator('[data-choice=cancel]').click();
  }
  await page.screenshot({ path: 'planning/design/new-project-desktop.png' });
});

test('embedded image upload is portable in JSON and Detail needs no external request', async ({
  page,
}) => {
  const external = [],
    errors = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:4173'))
      external.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  const bytes = await fs.readFile('tests/fixtures/english-endings.png');
  await sample(page);
  await selectService(page);
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('textarea[name=content]').fill('# Image in JSON');
  await page
    .locator('#embedded-image-input')
    .setInputFiles({ name: 'english-endings.png', mimeType: 'image/png', buffer: bytes });
  await expect(page.locator('textarea[name=content]')).toContainText('attachment:image-');
  const beforeApply = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return store.project.cards.find((c) => c.id === 'card-user-service').extensions?.[
      'card-atlas:images'
    ];
  });
  expect(beforeApply).toBeUndefined();
  await page.locator('#locale').selectOption('en');
  await page.locator('#theme-toggle').click();
  await expect(page.locator('.attachment-row')).toContainText('english-endings.png');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect
    .poll(() => page.locator('.embedded-image').evaluate((image) => image.naturalWidth))
    .toBe(640);
  const exported = await exportData(page);
  const card = exported.cards.find((c) => c.id === 'card-user-service');
  const attachments = card.extensions['card-atlas:images'];
  expect(Object.values(attachments)[0]).toEqual({
    name: 'english-endings.png',
    mimeType: 'image/png',
    data: bytes.toString('base64'),
  });
  expect(card.extensions['example:source']).toBeTruthy();
  await page.reload();
  await page.locator('#file-input').setInputFiles({
    name: 'with-image.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await page.locator('[data-choice=apply]').click();
  await selectService(page);
  await expect
    .poll(() => page.locator('.embedded-image').evaluate((image) => image.naturalWidth))
    .toBe(640);
  expect(await exportData(page)).toEqual(exported);
  await page.locator('#theme-toggle').click();
  await page.screenshot({ path: 'planning/design/embedded-image-detail.png' });
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('embedded image drafts cancel, removal undoes and SVG upload is rejected', async ({
  page,
}) => {
  const png = await fs.readFile('tests/fixtures/english-endings.png');
  await sample(page);
  await selectService(page);
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  const original = await page.locator('textarea[name=content]').inputValue();
  await page.locator('#embedded-image-input').setInputFiles({
    name: 'bad.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  await expect(page.locator('#toast')).toContainText('Ảnh không hợp lệ');
  await expect(page.locator('textarea[name=content]')).toHaveValue(original);
  await page
    .locator('#embedded-image-input')
    .setInputFiles({ name: 'chart.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.attachment-row')).toHaveCount(1);
  await page.locator('#cancel-draft').click();
  await expect(page.locator('.attachment-row')).toHaveCount(0);
  await expect(page.locator('textarea[name=content]')).toHaveValue(original);
  await page.locator('textarea[name=content]').fill('# Chart');
  await page
    .locator('#embedded-image-input')
    .setInputFiles({ name: 'chart.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.attachment-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await page.getByRole('button', { name: 'Tổng quan', exact: true }).click();
  await expect(page.locator('.embedded-image')).toBeVisible();
  await page.locator('[data-action=undo]').click();
  await expect(page.locator('.embedded-image')).toHaveCount(0);
  await page.locator('[data-action=redo]').click();
  await expect(page.locator('.embedded-image')).toBeVisible();
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('[data-remove-image]').click();
  await expect(page.locator('textarea[name=content]')).not.toContainText('attachment:');
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await page.getByRole('button', { name: 'Tổng quan', exact: true }).click();
  await expect(page.locator('.embedded-image')).toHaveCount(0);
  await page.locator('[data-action=undo]').click();
  await expect(page.locator('.embedded-image')).toBeVisible();
});
