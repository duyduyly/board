import { test, expect } from '@playwright/test';

async function openEditor(page) {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(page.locator('[data-editor-mode=visual]')).toBeEnabled();
}

test('visual and HTML code modes share one draft and round-trip', async ({ page }) => {
  await openEditor(page);
  await page.locator('[data-block-label=blockParagraph]').click();
  const frame = page.frameLocator('#block-editor .gjs-frame');
  const p = frame.locator('p');
  await p.dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('Từ editor');
  await page.locator('[data-editor-mode=html]').click();
  const source = page.locator('[data-editor-source]');
  await expect(source).toBeVisible();
  await expect(source).toHaveCSS('min-height', '420px');
  await expect(source).toHaveText(/Từ editor/);
  await expect(page.locator('[data-editor-mode=html]')).toHaveAttribute('aria-pressed', 'true');
  await source.fill('<div class="alert alert-info"><strong>HTML sửa tay</strong></div>');
  await page.locator('[data-editor-mode=visual]').click();
  await expect(frame.locator('.alert strong')).toHaveText('HTML sửa tay');
  await page.locator('[data-editor-mode=html]').click();
  await expect(source).toHaveText(/HTML sửa tay/);
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  expect(card.content).toContain('HTML sửa tay');
  await page.locator(`[data-id="${card.id}"]`).focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(frame.locator('.alert strong')).toHaveText('HTML sửa tay');
});

test('complex supported HTML survives visual changes and repeated mode switches', async ({ page }) => {
  await openEditor(page);
  await page.locator('[data-editor-mode=html]').click();
  const source = page.locator('[data-editor-source]');
  await source.fill('<section class="container"><div class="row"><div class="col-md-6" style="color:#123456"><p><strong>Keep</strong> inline</p><table class="table table-bordered"><tbody><tr><td colspan="2">Cell</td></tr></tbody></table></div></div></section>');
  await page.locator('[data-editor-mode=visual]').click();
  const frame = page.frameLocator('#block-editor .gjs-frame');
  await expect(frame.locator('section table td')).toHaveText('Cell');
  await page.locator('[data-block-label=blockParagraph]').click();
  await page.locator('[data-editor-mode=html]').click();
  const result = await source.textContent();
  expect(result).toContain('class="container"');
  expect(result).toContain('class="col-md-6"');
  expect(result).toMatch(/color:\s*(#123456|rgb\(18,\s*52,\s*86\))/);
  expect(result).toContain('colspan="2"');
  expect(result).toContain('<strong>Keep</strong>');
});

test('unsafe code is not silently removed or committed and can be discarded', async ({ page }) => {
  await openEditor(page);
  await page.locator('[data-editor-mode=html]').click();
  const source = page.locator('[data-editor-source]');
  const raw = '<p>Giữ bản nháp</p><script>window.bad=1</script>';
  await source.fill(raw);
  await page.locator('[data-editor-mode=visual]').click();
  await expect(source).toHaveText(raw);
  await expect(page.locator('.block-editor-notice')).toContainText('không an toàn');
  await expect(page.locator('#panel-body [type=submit]')).toBeDisabled();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(source).toHaveText(raw);
  await page.locator('#detail-panel [data-action=close]').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('[data-choice=cancel]').click();
  await expect(source).toHaveText(raw);
  await page.locator('#detail-panel [data-action=close]').click();
  await page.locator('[data-choice=discard]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  expect(card.content).toBe('');
  expect(await page.evaluate(() => window.bad)).toBeUndefined();
});

test('invalid HTML code cannot be lost by switching to format', async ({ page }) => {
  await openEditor(page);
  await page.locator('[data-editor-mode=html]').click();
  const source = page.locator('[data-editor-source]');
  await source.fill('<p onclick="alert(1)">Unsafe</p>');
  await page.locator('#panel-tabs button').last().click();
  await expect(source).toBeVisible();
  await expect(source).toHaveText('<p onclick="alert(1)">Unsafe</p>');
  await expect(page.locator('.block-editor-notice')).toContainText('không an toàn');
});

test('valid source can move to format and remain in draft', async ({ page }) => {
  await openEditor(page);
  await page.locator('[data-editor-mode=html]').click();
  await page.locator('[data-editor-source]').fill('<p>Format transition</p>');
  await page.locator('#panel-tabs button').last().click();
  await expect(page.locator('#block-editor')).toHaveCount(0);
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const id = await page.evaluate(
    async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).id,
  );
  await page.locator(`[data-id="${id}"]`).focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(page.frameLocator('#block-editor .gjs-frame').locator('p')).toHaveText(
    'Format transition',
  );
});

test('source mode can reject missing image references without dropping the code', async ({
  page,
}) => {
  await openEditor(page);
  await page.locator('[data-editor-mode=html]').click();
  const source = page.locator('[data-editor-source]');
  const text = '<img src="attachment:missing" alt="Image">';
  await source.fill(text);
  await page.locator('[data-editor-mode=visual]').click();
  await expect(source).toBeVisible();
  await expect(source).toHaveText(text);
  await expect(page.locator('.block-editor-notice')).not.toBeEmpty();
});

test('applying directly from HTML code commits exactly once and undo restores the note', async ({
  page,
}) => {
  await openEditor(page);
  const history = await page.evaluate(
    async () => (await import('/assets/js/app.js')).store.undoStack.length,
  );
  await page.locator('[data-editor-mode=html]').click();
  await page.locator('[data-editor-source]').fill('<h2>HTML trực tiếp</h2><p>Nội dung</p>');
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const after = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return { history: store.undoStack.length, content: store.project.cards.at(-1).content };
  });
  expect(after.history).toBe(history + 1);
  expect(after.content).toContain('HTML trực tiếp');
  await page.keyboard.press('Control+z');
  expect(
    await page.evaluate(
      async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).content,
    ),
  ).toBe('');
});

test('mode buttons remain usable at a narrow supported desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openEditor(page);
  await page.locator('[data-editor-mode=html]').click();
  await expect(page.locator('[data-editor-source]')).toBeVisible();
  await page.locator('[data-editor-source]').fill('<p>Mobile</p>');
  await page.locator('[data-editor-mode=visual]').click();
  await expect(page.frameLocator('#block-editor .gjs-frame').locator('p')).toHaveText('Mobile');
});
