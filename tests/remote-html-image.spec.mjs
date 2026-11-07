import { test, expect } from '@playwright/test';

const remote = 'https://images.example.test/photo.png?width=900&quality=75';
const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXcAAAAASUVORK5CYII=',
  'base64',
);

async function openEditor(page) {
  await page.route('https://images.example.test/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: pixel }),
  );
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(page.locator('[data-editor-mode=visual]')).toBeEnabled();
}

test('remote image survives HTML, visual editor, save/reopen and HTML export', async ({ page }) => {
  await openEditor(page);
  await page.locator('[data-editor-mode=html]').click();
  const source = page.locator('[data-editor-source]');
  await source.fill(
    `<article><h1>Photography</h1><figure><img src="${remote.replace('&', '&amp;')}" alt="Mountain lake" style="width:100%;max-width:760px;height:auto;display:block;border-radius:8px"><figcaption>Lake</figcaption></figure></article>`,
  );
  await page.locator('[data-editor-mode=visual]').click();
  const img = page.frameLocator('#block-editor .gjs-frame').locator('img');
  await expect(img).toHaveAttribute('src', remote);
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);

  await page.evaluate(() => {
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      window.remoteImageExport = blob;
      return original(blob);
    };
  });
  await page.locator('#download-html').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.remoteImageExport))).toBe(true);
  const html = await page.evaluate(() => window.remoteImageExport.text());
  expect(html).toContain('https://images.example.test/photo.png?width=900&amp;quality=75');
  expect(html).toMatch(/img-src[^;]*https:/);

  await page.locator('#panel-body [type=submit]').click();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  expect(JSON.stringify(card.extensions['card-atlas:document'])).toContain(remote);
  const roundtrip = await page.evaluate(async (id) => {
    const { store } = await import('/assets/js/app.js');
    const { serialize, stage } = await import('/assets/js/json/validator.js');
    const parsed = stage(serialize(store.project, store.viewport, store.viewports));
    return { errors: parsed.errors, card: parsed.project?.cards.find((item) => item.id === id) };
  }, card.id);
  expect(roundtrip.errors).toEqual([]);
  expect(JSON.stringify(roundtrip.card.extensions['card-atlas:document'])).toContain(remote);
  await page.locator(`[data-id="${card.id}"]`).focus();
  await page.keyboard.press('Enter');
  const viewerImg = page.frameLocator('.html-document-frame').locator('img');
  await expect(viewerImg).toHaveAttribute('src', remote);
  await expect
    .poll(() => viewerImg.evaluate((el) => el.complete && el.naturalWidth > 0))
    .toBe(true);
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-editor-mode=html]').click();
  await expect(source).toContainText(
    'https://images.example.test/photo.png?width=900&amp;quality=75',
  );
});

test('HTML import preserves remote images and rejects unsafe image schemes', async ({ page }) => {
  await openEditor(page);
  await page.locator('[data-block-label=htmlImportTitle]').click();
  await page
    .locator('[data-html-source]')
    .fill(
      `<p>Image</p><img src="${remote.replace('&', '&amp;')}" alt="safe"><img src="javascript:alert(1)" alt="unsafe">`,
    );
  await page.locator('[data-html-review]').click();
  const preview = page.locator('[data-html-preview]');
  await expect(preview).toContainText(
    'https://images.example.test/photo.png?width=900&amp;quality=75',
  );
  await expect(preview).not.toContainText('javascript:');
  await expect(page.locator('[data-html-result]')).toContainText('đã loại');
  await page.locator('[data-html-accept]').click();
  await expect(
    page.frameLocator('#block-editor .gjs-frame').locator('img').first(),
  ).toHaveAttribute('src', remote);
});

test('remote image save is undoable and redoable', async ({ page }) => {
  await openEditor(page);
  const cardId = await page.evaluate(
    async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).id,
  );
  const imageSource = () =>
    page.evaluate(async (id) => {
      const card = (await import('/assets/js/app.js')).store.project.cards.find(
        (item) => item.id === id,
      );
      return JSON.stringify(card.extensions['card-atlas:document']);
    }, cardId);
  const before = await imageSource();
  await page.locator('[data-editor-mode=html]').click();
  await page
    .locator('[data-editor-source]')
    .fill(`<p>Photo</p><img src="${remote.replace('&', '&amp;')}" alt="Lake">`);
  await page.locator('#panel-body [type=submit]').click();
  await expect.poll(imageSource).toContain(remote);
  await page.locator('[data-action=undo]').click();
  await expect.poll(imageSource).toBe(before);
  await page.locator('[data-action=redo]').click();
  await expect.poll(imageSource).toContain(remote);
});
