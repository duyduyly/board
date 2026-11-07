import { test, expect } from '@playwright/test';

test('invalid image reference rejects import without replacing the current project', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  const snapshot = () => page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project));
  const before = await snapshot();
  const project = { version: '1.0', cards: [{ id: 'bad', title: 'Invalid', content: '', extensions: {
    'card-atlas:images': {}, 'card-atlas:document': { version: 1, format: 'html-bs5', components: [
      { tag: 'img', attributes: { src: 42 }, children: [] },
    ] },
  } }], relations: [] };
  await page.locator('#file-input').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator('#modal')).toBeVisible();
  await expect(page.locator('#modal')).toContainText('htmlDocument');
  await expect(page.locator('#modal [data-choice=apply]')).toBeDisabled();
  expect(await snapshot()).toBe(before);
  expect(errors).toEqual([]);
});
