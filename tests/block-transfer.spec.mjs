import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('HTML node import previews the document and retains its attachment', async ({ page }) => {
  const image = (await readFile('tests/fixtures/english-endings.png')).toString('base64');
  const incoming = {
    version: '1.0',
    cards: [
      {
        id: 'foreign',
        title: 'Imported',
        content: 'Stale',
        extensions: {
          'card-atlas:images': { photo: { name: 'photo.png', mimeType: 'image/png', data: image } },
          'card-atlas:document': {
            version: 1,
            format: 'html-bs5',
            components: [
              { tag: 'h2', attributes: {}, children: ['HTML preview'] },
              { tag: 'img', attributes: { src: 'attachment:photo', alt: 'Photo' }, children: [] },
            ],
          },
        },
      },
    ],
    relations: [],
  };
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('.node-transfer-tools summary').click();
  await page
    .locator('#import-node-file')
    .setInputFiles({
      name: 'node.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(incoming)),
    });
  const preview = page.frameLocator('#modal .transfer-preview .html-document-frame');
  await expect(preview.locator('h2')).toHaveText('HTML preview');
  await expect(preview.locator('img')).toBeVisible();
  await page.locator('[data-choice=accept]').click();
  const frame = page.frameLocator('#block-editor .gjs-frame');
  await expect(frame.locator('h2')).toHaveText('HTML preview');
  await expect(frame.locator('img')).toBeVisible();
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  expect(card.content).toContain('HTML preview');
  expect(Object.keys(card.extensions['card-atlas:images'])).toContain('photo');
});
