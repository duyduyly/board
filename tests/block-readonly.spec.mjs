import { test, expect } from '@playwright/test';

test('HTML document can be viewed, image opened and edited again', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page
    .locator('#block-editor input[type=file][accept^="image/"]')
    .setInputFiles('tests/fixtures/english-endings.png');
  const img = page.frameLocator('#block-editor .gjs-frame').locator('figure img');
  await expect(img).toBeVisible();
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const id = await page.evaluate(
    async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).id,
  );
  await page.locator(`[data-id="${id}"]`).focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').first().click();
  const viewer = page.frameLocator('.html-document-frame');
  const viewed = viewer.locator('figure img');
  await expect(viewed).toBeVisible();
  await expect(viewed).toHaveAttribute('role', 'button');
  await viewed.click();
  await expect(page.locator('.image-preview[open]')).toBeVisible();
  await expect(page.locator('.image-preview-image')).toBeVisible();
  await page.locator('.image-preview-header button').last().click();
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(page.frameLocator('#block-editor .gjs-frame').locator('figure img')).toBeVisible();
  expect(errors).toEqual([]);
});

test('pinned HTML image remains read-only and opens with keyboard', async ({ page }) => {
  await page.goto('/');
  const png =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nk4UAAAAASUVORK5CYII=';
  const project = {
    version: '1.0',
    cards: [
      {
        id: 'pinned-img',
        title: 'Pinned',
        content: 'Caption',
        extensions: {
          'card-atlas:metadata': { pinned: true },
          'card-atlas:images': { 'img-1': { name: 'pixel.png', mimeType: 'image/png', data: png } },
          'card-atlas:document': {
            version: 1,
            format: 'html-bs5',
            components: [
              {
                tag: 'figure',
                attributes: {},
                children: [
                  {
                    tag: 'img',
                    attributes: { src: 'attachment:img-1', alt: 'Pixel' },
                    children: [],
                  },
                  { tag: 'figcaption', attributes: {}, children: ['Caption'] },
                ],
              },
            ],
          },
        },
      },
    ],
    relations: [],
  };
  await page
    .locator('#file-input')
    .setInputFiles({
      name: 'pinned.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-id=pinned-img]').focus();
  await page.keyboard.press('Enter');
  const viewer = page.frameLocator('.html-document-frame');
  const image = viewer.locator('img');
  await expect(image).toBeVisible();
  await image.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.image-preview[open]')).toBeVisible();
  await page.locator('.image-preview-header button').last().click();
  await expect(page.locator('#block-editor')).toHaveCount(0);
});
