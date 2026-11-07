import { test, expect } from '@playwright/test';

test('palette image is present in the canonical HTML document and editor', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('[data-palette-kind=image-text]').click();
  await (await chooser).setFiles('tests/fixtures/english-endings.png');
  const node = page.locator('.graph-card[data-node-kind=image-text]');
  await expect(node).toHaveCount(1);
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.find(
      (c) => c.extensions?.['card-atlas:node']?.kind === 'image-text',
    ),
  );
  const doc = card.extensions['card-atlas:document'];
  expect(doc.components[0].tag).toBe('img');
  expect(doc.components[0].attributes.src).toBe(
    'attachment:' + card.extensions['card-atlas:node'].coverImageId,
  );
  expect(card.content).toBe('english-endings.png');
  await node.focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(page.frameLocator('#block-editor .gjs-frame').locator('img')).toBeVisible();
});

test('local image settings and attachment survive project export and import', async ({ page }) => {
  const external = [];
  page.on('request', (r) => {
    if (
      !r.url().startsWith('http://127.0.0.1:4173') &&
      !r.url().startsWith('data:') &&
      !r.url().startsWith('attachment:') &&
      !r.url().startsWith('about:')
    )
      external.push(r.url());
  });
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page
    .locator('#block-editor input[type=file][accept^="image/"]:not([data-image-replace-file])')
    .setInputFiles('tests/fixtures/english-endings.png');
  const frame = page.frameLocator('#block-editor .gjs-frame');
  const image = frame.locator('figure img');
  await expect(image).toBeVisible();
  await image.click();
  await page.locator('[data-image-control=alt]').fill('Bảng chữ cái');
  await page.locator('[data-image-control=alt]').blur();
  await page.locator('[data-image-control=caption]').fill('Chú thích mẫu');
  await page.locator('[data-image-control=caption]').blur();
  await page.locator('[data-image-control=width]').fill('320');
  await page.locator('[data-image-control=width]').blur();
  await page.locator('[data-image-control=height]').fill('180');
  await page.locator('[data-image-control=height]').blur();
  await page.locator('[data-image-control=fit]').selectOption('cover');
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  const json = JSON.stringify(card.extensions['card-atlas:document']);
  expect(json).toContain('attachment:');
  expect(json).toContain('Bảng chữ cái');
  expect(json).toContain('Chú thích mẫu');
  expect(json).toContain('object-fit');
  expect(Object.keys(card.extensions['card-atlas:images'])).toHaveLength(1);
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-action=export]').click();
  const download = await downloadPromise;
  const file = await download.path();
  await page.locator('#file-input').setInputFiles(file);
  await page.locator('[data-choice=apply]').click();
  await page.locator(`[data-id="${card.id}"]`).focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute('alt', 'Bảng chữ cái');
  await expect(image).toHaveAttribute('width', '320');
  await expect(image).toHaveAttribute('height', '180');
  await expect(frame.locator('figcaption')).toHaveText('Chú thích mẫu');
  expect(external).toEqual([]);
});

test('invalid image file is rejected without adding an attachment', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page
    .locator('#block-editor input[type=file][accept^="image/"]:not([data-image-replace-file])')
    .setInputFiles({
      name: 'fake.png',
      mimeType: 'image/png',
      buffer: Buffer.from('not an image'),
    });
  await expect(page.locator('.block-editor-notice')).toContainText('không hợp lệ');
  await expect(page.frameLocator('#block-editor .gjs-frame').locator('img')).toHaveCount(0);
});

test('image reset removes dimensions and fit but keeps description and caption', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page
    .locator('#block-editor input[type=file][accept^="image/"]:not([data-image-replace-file])')
    .setInputFiles('tests/fixtures/english-endings.png');
  const frame = page.frameLocator('#block-editor .gjs-frame');
  const img = frame.locator('figure img');
  await expect(img).toBeVisible();
  await img.click();
  await page.locator('[data-image-control=alt]').fill('Mô tả');
  await page.locator('[data-image-control=alt]').blur();
  await page.locator('[data-image-control=caption]').fill('Chú thích');
  await page.locator('[data-image-control=caption]').blur();
  await page.locator('[data-image-control=width]').fill('2001');
  expect(
    await page.locator('[data-image-control=width]').evaluate((input) => input.checkValidity()),
  ).toBe(false);
  await page.locator('[data-image-control=width]').fill('400');
  await page.locator('[data-image-control=width]').blur();
  await page.locator('[data-image-control=height]').fill('200');
  await page.locator('[data-image-control=height]').blur();
  await page.locator('[data-image-control=fit]').selectOption('cover');
  await page.locator('[data-image-reset]').click();
  await expect(img).not.toHaveAttribute('width');
  await expect(img).not.toHaveAttribute('height');
  await expect(img).toHaveAttribute('alt', 'Mô tả');
  await expect(frame.locator('figcaption')).toHaveText('Chú thích');
});

test('local attachment survives project serialization and import', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page
    .locator('#block-editor input[type=file][accept^="image/"]:not([data-image-replace-file])')
    .setInputFiles('tests/fixtures/english-endings.png');
  const image = page.frameLocator('#block-editor .gjs-frame').locator('figure img');
  await expect(image).toBeVisible();
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const data = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { serialize } = await import('/assets/js/json/validator.js');
    return {
      id: store.project.cards.at(-1).id,
      json: serialize(store.project, store.viewport, store.viewports),
    };
  });
  expect(data.json).toContain('attachment:');
  await page.locator('#file-input').setInputFiles({
    name: 'export.json',
    mimeType: 'application/json',
    buffer: Buffer.from(data.json),
  });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-choice=replace]').click();
  await page.locator(`[data-id="${data.id}"] .card-open`).click();
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(image).toBeVisible();
});
