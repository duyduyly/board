import { openSearch } from './ui-driver.mjs';
import { projectAction, locale, theme, view, openRow } from './ui-driver.mjs';
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const example = await fs.readFile('assets/data/example.json', 'utf8');
const legacyEnglish = (
  await fs.readFile('tests/fixtures/english-endings-legacy.json', 'utf8')
).trim();
async function sample(page) {
  await page.goto('/');
  await page.locator('[data-action=example]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
}
async function selectService(page) {
  await openRow(page, page.locator('.card-row[data-card-id="card-user-service"]'));
  await expect(page.locator('#panel-title')).toHaveText('User Service');
}
async function exportData(page) {
  const downloadPromise = page.waitForEvent('download');
  await projectAction(page, 'export');
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
  await locale(page, 'en');
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
  await locale(page, 'en');
  await expect(page.locator('input[name=title]')).toHaveValue('Changed Service');
  await openRow(page, page.locator('.card-row[data-card-id="card-database"]'));
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal-locale').selectOption('vi');
  await expect(page.locator('#modal')).toContainText('Giữ các chỉnh sửa?');
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('input[name=title]')).toHaveValue('Changed Service');
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(page.locator('#panel-title')).toHaveText('Changed Service');
  await projectAction(page, 'undo');
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
  await projectAction(page, 'undo');
  const restored = await exportData(page);
  expect(restored.cards).toEqual(before.cards);
  await c.dblclick();
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('#duplicate').click();
  await expect(page.locator('.graph-card')).toHaveCount(4);
  await page.locator('#delete').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
  await projectAction(page, 'undo');
  await expect(page.locator('.graph-card')).toHaveCount(4);
});

test('connector empty drop creates card and relation atomically', async ({ page }) => {
  await sample(page);
  await selectService(page);
  await page.locator('[data-action=close]').click();
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
  await projectAction(page, 'undo');
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
  await projectAction(page, 'export');
  await page.locator('[data-choice=applied]').click();
  await dl;
  await expect(page.locator('textarea[name=content]')).toHaveValue('# Unsaved Draft');
  await projectAction(page, 'new');
  await page.locator('[data-choice=cancel]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await projectAction(page, 'new');
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
  await openSearch(page);
  await page.locator('#search').fill('storage');
  await expect(page.locator('.card-row')).toHaveCount(1);
  await openRow(page, page.locator('.card-row'));
  await expect(page.locator('#panel-title')).toHaveText('Database');
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('input[name=title]').focus();
  await page.keyboard.press('Delete');
  await expect(page.locator('.graph-card')).toHaveCount(3);
  await page.locator('[data-action=expand]').click();
  expect((await page.locator('#detail-panel').boundingBox()).width).toBe(1440);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.mobile-notice')).toBeVisible();
});

test('Format Guide example/schema downloads keep dirty state', async ({ page }) => {
  await sample(page);
  await selectService(page);
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('input[name=title]').fill('changed');
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await projectAction(page, 'format');
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
  await projectAction(page, 'connect');
  await page.locator('.graph-card[data-id="card-database"]').click();
  const data = await exportData(page);
  expect(data.relations).toHaveLength(3);
  await projectAction(page, 'fit');
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
  await page.locator('[data-action=example]').click();
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
  await locale(page, 'en');
  await page.locator('#file-input').setInputFiles({
    name: 'example.json',
    mimeType: 'application/json',
    buffer: Buffer.from(example),
  });
  await expect(page.locator('#modal')).toContainText('Import preview');
  await page.getByRole('button', { name: 'Apply import', exact: true }).click();
  await openSearch(page);
  await page.locator('#search').fill('storage');
  await openRow(page, page.locator('.card-row'));
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('input[name=title]').fill('Database Updated');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('#save-state')).toContainText('Unsaved changes');
  await page.locator('textarea[name=content]').fill('# New English Draft');
  await projectAction(page, 'export');
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
  await projectAction(page, 'export');
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
  await locale(page, 'en');
  await page.locator('[data-action=english-example]').click();
  await expect(page.locator('.graph-card')).toHaveCount(12);
  await openRow(page, page.locator('.card-row[data-card-id="english-overview"]'));
  await expect(page.locator('#panel-body')).toContainText('Lộ trình học');
  await locale(page, 'vi');
  await openRow(page, page.locator('.card-row[data-card-id="english-ed-sounds"]'));
  await expect(page.locator('#panel-body')).toContainText('/ɪd/');
  const exported = await exportData(page);
  expect(exported.cards).toHaveLength(12);
  expect(exported.relations).toHaveLength(12);
  await page.locator('#file-input').setInputFiles({
    name: 'lesson.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await page.getByRole('button', { name: 'Áp dụng dữ liệu', exact: true }).click();
  const reexported = await exportData(page);
  // Sidebar selection intentionally focuses the node; viewport is session state.
  expect({ ...reexported, canvas: exported.canvas }).toEqual(exported);
  await openRow(page, page.locator('.card-row[data-card-id="english-s-sounds"]'));
  await expect(page.locator('#panel-body')).toContainText('/ɪz/');
  await view(page, 'mind');
  await expect(page.locator('.graph-card[data-node-kind=text]')).toHaveCount(12);
  expect(exported.extensions['card-atlas:mind-map'].rootId).toBe('english-overview');
  expect(
    exported.relations.filter((r) => r.extensions['card-atlas:mind-map'].kind === 'branch'),
  ).toHaveLength(11);
  await openRow(page, page.locator('.card-row[data-card-id=english-practice]'));
  await expect(page.locator('#panel-body ol li')).toHaveCount(12);
  await page.screenshot({ path: 'planning/design/english-endings-example.png' });
  expect(errors).toEqual([]);
});

test('Badges, theme and Fit/Focus preserve project, history and drafts', async ({ page }) => {
  await page.route('**/assets/data/english-endings-example.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: legacyEnglish }),
  );
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
  await expect(page.locator('.graph-card[data-id="english-s-use"] .card-open')).toHaveAttribute(
    'title',
    'Mở Detail · 3 quan hệ',
  );
  await openRow(page, page.locator('.card-row[data-card-id="english-s-use"]'));
  await projectAction(page, 'fit');
  const fitZoom = await page.locator('#zoom-value').textContent();
  await projectAction(page, 'focus');
  expect(await page.locator('#zoom-value').textContent()).not.toEqual(fitZoom);
  const cardBox = await page.locator('.graph-card[data-id="english-s-use"]').boundingBox();
  const frame = await page.locator('#canvas-region').boundingBox();
  expect(Math.abs(cardBox.x + cardBox.width / 2 - frame.x - frame.width / 2)).toBeLessThan(3);
  expect(Math.abs(cardBox.y + cardBox.height / 2 - frame.y - frame.height / 2)).toBeLessThan(3);
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('input[name=title]').fill('Unsaved grammar draft');
  await theme(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('input[name=title]')).toHaveValue('Unsaved grammar draft');
  await locale(page, 'en');
  await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-label', 'Switch to light mode');
  await expect(page.locator('input[name=title]')).toHaveValue('Unsaved grammar draft');
  await projectAction(page, 'fit');
  expect(await snapshot()).toEqual(baseline);
  await theme(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await snapshot()).toEqual(baseline);
  await page.locator('#cancel-draft').click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.graph-card')).toHaveCount(0);
});

test('Focus relation fits both endpoints after panel resize', async ({ page }) => {
  await sample(page);
  await projectAction(page, 'fit');
  const point = await page.evaluate(async () => {
    const { adapter } = await import('/assets/js/app.js');
    return adapter.cy.edges().first().renderedMidpoint();
  });
  const initialFrame = await page.locator('#canvas-region').boundingBox();
  await page.mouse.click(initialFrame.x + point.x, initialFrame.y + point.y);
  await expect(page.locator('input[name=label]')).toBeVisible();
  await page.locator('[data-action=expand]').click();
  await projectAction(page, 'focus');
  const frame = await page.locator('#canvas-region').boundingBox();
  for (const id of ['card-user-api', 'card-user-service']) {
    const box = await page.locator('.graph-card[data-id="' + id + '"]').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(frame.x);
    expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width);
    expect(box.y).toBeGreaterThanOrEqual(frame.y);
    expect(box.y + box.height).toBeLessThanOrEqual(frame.y + frame.height);
  }
  await page.locator('[data-action=close]').click();
  await expect(page.locator('[data-action=focus]')).toBeEnabled();
});

test('New Project names blank projects and preserves work when replacement is cancelled', async ({
  page,
}) => {
  await page.goto('/');
  await projectAction(page, 'new');
  await expect(page.locator('#new-project-title')).toBeFocused();
  await page.locator('#new-project-title').fill('   ');
  await expect(page.locator('[data-choice=create]')).toBeDisabled();
  await page.locator('#modal-locale').selectOption('en');
  await expect(page.locator('[data-choice=create]')).toBeDisabled();
  await page.locator('#new-project-title').fill('  English Practice  ');
  await page.locator('#new-project-title').press('Enter');
  await expect(page.locator('#project-name')).toHaveText('English Practice');
  await expect(page.locator('#toast')).toHaveText('New project created');
  await locale(page, 'vi');
  await projectAction(page, 'home');
  await page.locator('[data-action=example]').click();
  await page.locator('[data-action=add]').click();
  await expect(page.locator('.graph-card')).toHaveCount(4);
  const snapshot = () =>
    page.evaluate(async () => {
      const { store } = await import('/assets/js/app.js');
      return { project: store.project, undo: store.undoStack.length, dirty: store.dirty };
    });
  const before = await snapshot();
  await projectAction(page, 'new');
  await page.locator('#new-project-title').fill('Next Project');
  await page.locator('[data-choice=create]').click();
  await expect(page.locator('#modal')).toContainText('Thay thế dự án hiện tại?');
  await page.locator('[data-choice=cancel]').click();
  expect(await snapshot()).toEqual(before);
  await projectAction(page, 'new');
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
  await locale(page, 'en');
  await theme(page);
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
  await theme(page);
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
  await projectAction(page, 'undo');
  await expect(page.locator('.embedded-image')).toHaveCount(0);
  await projectAction(page, 'redo');
  await expect(page.locator('.embedded-image')).toBeVisible();
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
  await page.locator('[data-remove-image]').click();
  await expect(page.locator('textarea[name=content]')).not.toContainText('attachment:');
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await page.getByRole('button', { name: 'Tổng quan', exact: true }).click();
  await expect(page.locator('.embedded-image')).toHaveCount(0);
  await projectAction(page, 'undo');
  await expect(page.locator('.embedded-image')).toBeVisible();
});

test('Card action opens overview without movement and click image fits naturally', async ({
  page,
}) => {
  await page.route('**/assets/data/english-endings-example.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: legacyEnglish }),
  );
  await page.goto('/');
  await page.locator('[data-action=english-example]').click();
  const snapshot = () =>
    page.evaluate(async () => {
      const { store } = await import('/assets/js/app.js');
      return { project: store.project, undo: store.undoStack.length, dirty: store.dirty };
    });
  const before = await snapshot();
  const open = page.locator('.graph-card[data-id="english-overview"] .card-open');
  await open.click();
  await expect(page.locator('#panel-title')).toHaveText('Đuôi -s/-es và -ed');
  await expect(page.getByRole('button', { name: 'Tổng quan', exact: true })).toHaveClass(/active/);
  await expect(page.locator('.diagram svg')).toBeVisible();
  const image = page.locator('.embedded-image');
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((i) => i.naturalWidth)).toBe(640);
  await image.hover();
  await expect(page.locator('.image-preview')).toHaveCount(0);
  await image.click();
  const preview = page.locator('.image-preview');
  await expect(preview).toBeVisible();
  await expect(page.locator('.image-preview-image')).toHaveCSS('width', '640px');
  await expect(page.locator('.image-preview-image')).toHaveCSS('height', '280px');
  await expect(preview).toContainText('100%');
  const box = await preview.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(1440);
  await page.screenshot({ path: 'planning/design/card-image-hover-light.png' });
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await theme(page);
  await expect(page.locator('.diagram svg')).toBeVisible();
  await page.locator('.embedded-image').scrollIntoViewIfNeeded();
  const imageBox = await page.locator('.embedded-image').boundingBox();
  await page.mouse.move(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
  await page.locator('.embedded-image').click();
  await expect(preview).toBeVisible();
  await page.screenshot({ path: 'planning/design/card-image-hover-dark.png' });
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  expect(await snapshot()).toEqual(before);
  await locale(page, 'en');
  await expect(page.locator('.graph-card[data-id="english-overview"] .card-open')).toHaveAttribute(
    'aria-label',
    'Open Detail: Đuôi -s/-es và -ed',
  );
});

test('Oversized click image defaults Fit and explicit 100 percent scrolls', async ({ page }) => {
  await page.goto('/');
  const imageData = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1800;
    c.height = 1200;
    c.getContext('2d').fillRect(0, 0, 1800, 1200);
    return c.toDataURL('image/png').split(',')[1];
  });
  const project = JSON.parse(example);
  project.cards[0].title =
    'Understanding the complete authentication workflow across several services';
  project.cards[0].summary =
    'This card describes authentication, authorization and the responsibility of each service in a distributed project.';
  project.cards[0].content = '![Large](attachment:image-large)';
  project.cards[0].extensions = {
    'card-atlas:images': {
      'image-large': { name: 'large.png', mimeType: 'image/png', data: imageData },
    },
  };
  await page.locator('#file-input').setInputFiles({
    name: 'large.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await openRow(page, page.locator('.card-row[data-card-id="card-user-api"]'));
  await expect(page.locator('.graph-card[data-id="card-user-api"] h3')).toHaveCSS(
    '-webkit-line-clamp',
    '2',
  );
  const imageBox = await page.locator('.embedded-image').boundingBox();
  await page.mouse.move(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
  await page.locator('.embedded-image').click();
  const fitBox = await page.locator('.image-preview-image').boundingBox();
  expect(fitBox.width).toBeLessThanOrEqual(1080);
  expect(fitBox.height).toBeLessThanOrEqual(675);
  await page.locator('.image-preview-header button').nth(1).click();
  await expect(page.locator('.image-preview-image')).toHaveCSS('width', '1800px');
  await expect(page.locator('.image-preview-image')).toHaveCSS('height', '1200px');
  const dimensions = await page.locator('.image-preview-frame').evaluate((e) => ({
    width: e.clientWidth,
    height: e.clientHeight,
    scrollWidth: e.scrollWidth,
    scrollHeight: e.scrollHeight,
  }));
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.width);
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.height);
  await page.locator('.image-preview-frame').evaluate((e) => {
    e.scrollLeft = 300;
    e.scrollTop = 200;
  });
  await expect(page.locator('.image-preview')).toBeVisible();
  await page.keyboard.press('Escape');
  await openRow(page, page.locator('.card-row[data-card-id="card-user-service"]'));
  await expect(page.locator('.image-preview')).toHaveCount(0);
});

test('Writing workspace preserves caret and scroll across theme and locale and previews safely', async ({
  page,
}) => {
  await sample(page);
  await selectService(page);
  await page.locator('#panel-tabs button').nth(1).click();
  const input = page.locator('textarea[name=content]');
  const text =
    '# Draft document\n\n## First section\n\nUniqueInsideBodyOnly\n\n## Second section\n\n' +
    'Long paragraph.\n\n'.repeat(100);
  await input.fill(text);
  await input.evaluate(async (e) => {
    e.selectionStart = 80;
    e.selectionEnd = 90;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    e.scrollTop = 250;
  });
  const before = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return { project: store.project, undo: store.undoStack.length };
  });
  await theme(page);
  expect(await input.evaluate((e) => [e.selectionStart, e.selectionEnd, e.scrollTop])).toEqual([
    80, 90, 250,
  ]);
  await locale(page, 'en');
  expect(await input.evaluate((e) => [e.selectionStart, e.selectionEnd, e.scrollTop])).toEqual([
    80, 90, 250,
  ]);
  await page.locator('#writing-toggle').click();
  await expect(page.locator('html')).toHaveClass(/writing-mode/);
  expect((await input.boundingBox()).width).toBeGreaterThan(700);
  await page.locator('#draft-preview-toggle').click();
  await expect(page.locator('.draft-preview')).toContainText('UniqueInsideBodyOnly');
  await expect(page.locator('.document-contents button')).toHaveCount(3);
  expect(
    await page.evaluate(async () => {
      const { store } = await import('/assets/js/app.js');
      return { project: store.project, undo: store.undoStack.length };
    }),
  ).toEqual(before);
  await page.screenshot({ path: 'planning/design/writing-preview-dark.png' });
  await page.locator('#draft-preview-toggle').click();
  await expect(input).toHaveValue(text);
  expect(await input.evaluate((e) => [e.selectionStart, e.selectionEnd])).toEqual([80, 90]);
  await page.locator('#template-select').selectOption('guide');
  await expect(input).toHaveValue(
    text + '\n\n# Guide\n\n## Goal\n\n## Prerequisites\n\n## Steps\n\n## Verify results\n\n',
  );
  await page.locator('#writing-exit').click();
  await expect(page.locator('html')).not.toHaveClass(/writing-mode/);
  await page.locator('.editor [type=submit]').click();
  await page.locator('[data-action=close]').click();
  await openSearch(page);
  await page.locator('#search').fill('UniqueInsideBodyOnly');
  await expect(page.locator('.card-row')).toHaveCount(1);
  await expect(page.locator('.search-excerpt mark')).toHaveText('UniqueInsideBodyOnly');
});

test('Markdown export includes draft text and embedded images without changing project', async ({
  page,
}) => {
  await page.route('**/assets/data/english-endings-example.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: legacyEnglish }),
  );
  await page.goto('/');
  await page.locator('[data-action=english-example]').click();
  await openRow(page, page.locator('.card-row[data-card-id="english-overview"]'));
  await page.locator('#panel-tabs button').nth(1).click();
  const promise = page.waitForEvent('download');
  await page.locator('#download-markdown').click();
  const download = await promise;
  const content = await fs.readFile(await download.path(), 'utf8');
  expect(download.suggestedFilename()).toMatch(/\.md$/);
  expect(content).toContain('data:image/png;base64,');
  expect(content).not.toContain('attachment:');
});

test('Local recovery is opt-in, restores draft after reload and deletes data when disabled', async ({
  page,
}) => {
  await sample(page);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await selectService(page);
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('textarea[name=content]').fill('# Unapplied recovery draft');
  await projectAction(page, 'recovery');
  await page.locator('[data-choice=enable]').click();
  await expect(page.locator('#recovery-status')).toContainText('khôi phục');
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { readRecovery } = await import('/assets/js/store/recovery.js');
        return (await readRecovery())?.draft?.content;
      }),
    )
    .toBe('# Unapplied recovery draft');
  page.on('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(page.locator('[data-choice=restore]')).toBeVisible();
  await page.locator('[data-choice=restore]').click();
  await expect(page.locator('textarea[name=content]')).toHaveValue('# Unapplied recovery draft');
  await expect(page.locator('.graph-card')).toHaveCount(3);
  await page.locator('#cancel-draft').click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { readRecovery } = await import('/assets/js/store/recovery.js');
        return (await readRecovery())?.draft?.content;
      }),
    )
    .not.toBe('# Unapplied recovery draft');
  await projectAction(page, 'recovery');
  await page.locator('[data-choice=disable]').click();
  await expect.poll(() => page.evaluate(() => localStorage.length)).toBe(0);
  expect(
    await page.evaluate(async () =>
      (await window.indexedDB.databases()).some((db) => db.name === 'card-atlas-recovery'),
    ),
  ).toBe(false);
});

test('Recovery failure is visible and export remains available', async ({ page }) => {
  await sample(page);
  await page.evaluate(() => {
    window.indexedDB.open = () => {
      throw new Error('quota');
    };
  });
  await projectAction(page, 'recovery');
  await page.locator('[data-choice=enable]').click();
  await expect(page.locator('#recovery-status')).toContainText('Không lưu');
  const data = await exportData(page);
  expect(data.cards).toHaveLength(3);
});

test('Format shares draft, previews appearance and applies one undo with portable JSON', async ({
  page,
}) => {
  await sample(page);
  await selectService(page);
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('input[name=title]').fill('Styled service');
  await page.locator('#panel-tabs button').nth(2).click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await page.locator('[name=width]').fill('360');
  await page.locator('[name=height]').fill('230');
  await page.locator('[name=appearance-radius]').fill('24');
  await page.locator('[name=appearance-borderWidth]').fill('3');
  await page.locator('[name=appearance-titleFontSize]').fill('18');
  await page.locator('[name=appearance-align]').selectOption('center');
  await expect(page.locator('#format-card-preview .graph-card')).toHaveCSS('border-radius', '24px');
  await expect(page.locator('#format-card-preview h3')).toHaveText('Styled service');
  await expect(page.locator('#cards-layer .graph-card[data-id="card-user-service"]')).toHaveCSS(
    'width',
    '260px',
  );
  await page.screenshot({ path: 'planning/design/detail-format-light.png' });
  await page.locator('.editor [type=submit]').click();
  const card = page.locator('#cards-layer .graph-card[data-id="card-user-service"]');
  await expect(card).toHaveCSS('width', '360px');
  await expect(card).toHaveCSS('border-radius', '24px');
  await expect(card.locator('h3')).toHaveCSS('font-size', '18px');
  await projectAction(page, 'undo');
  await expect(card).toHaveCSS('width', '260px');
  await expect(card.locator('h3')).toHaveText('User Service');
  await projectAction(page, 'redo');
  const data = await exportData(page);
  expect(
    data.cards.find((c) => c.id === 'card-user-service').extensions['card-atlas:appearance'].radius,
  ).toBe(24);
  await page.locator('#panel-tabs button').nth(2).click();
  await page.locator('[name=appearance-radius]').fill('40');
  await page.locator('#cancel-draft').click();
  await expect(page.locator('[name=appearance-radius]')).toHaveValue('24');
  await locale(page, 'en');
  await theme(page);
  await page.screenshot({ path: 'planning/design/detail-format-dark.png' });
  await expect(page.locator('#panel-tabs button').nth(2)).toHaveText('Format');
});

test('Text toolbar formats selection and colored text remains safe in preview and overview', async ({
  page,
}) => {
  await sample(page);
  await selectService(page);
  await page.locator('#panel-tabs button').nth(1).click();
  const text = page.locator('textarea[name=content]');
  await text.fill('Important');
  await text.evaluate((e) => {
    e.selectionStart = 0;
    e.selectionEnd = 9;
  });
  await page.locator('[data-text-format=bold]').click();
  await expect(text).toHaveValue('**Important**');
  await text.fill('Important');
  await text.evaluate((e) => {
    e.selectionStart = 0;
    e.selectionEnd = 9;
  });
  await page.locator('[data-text-format=color]').click();
  await expect(text).toHaveValue('[Important]{color:#d34f45}');
  await page.locator('#draft-preview-toggle').click();
  await expect(page.locator('.draft-preview [data-text-color]')).toHaveCSS(
    'color',
    'rgb(211, 79, 69)',
  );
  await page.locator('#draft-preview-toggle').click();
  await text.fill(
    '[Important]{color:#d34f45}\n\n[Bad]{color:red;position:fixed}\n\n[<img src=x onerror=alert(1)>]{color:#123456}',
  );
  await page.locator('.editor [type=submit]').click();
  await page.locator('#panel-tabs button').nth(0).click();
  await expect(page.locator('.markdown [data-text-color]').first()).toHaveCSS(
    'color',
    'rgb(211, 79, 69)',
  );
  await expect(page.locator('.markdown img')).toHaveCount(0);
  await expect(page.locator('.markdown')).toContainText('color:red;position:fixed');
});
