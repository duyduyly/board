import { test, expect } from '@playwright/test';

test('Edge downloads a project with an image and reimports its attachment', async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== 'edge',
    'This check targets the installed Microsoft Edge browser.',
  );
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('[data-palette-kind=image-text]').click();
  await (await chooser).setFiles('tests/fixtures/english-endings.png');
  await expect(page.locator('.graph-card[data-node-kind=image-text]')).toHaveCount(1);
  const original = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.find(
      (card) => card.extensions?.['card-atlas:node']?.kind === 'image-text',
    ),
  );
  expect(Object.keys(original.extensions['card-atlas:images'])).toHaveLength(1);
  const pendingDownload = page.waitForEvent('download');
  await page.locator('[data-action=export]').click();
  const download = await pendingDownload;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  expect(await download.failure()).toBeNull();
  const downloadedFile = await download.path();
  expect(downloadedFile).toBeTruthy();
  const countCards = () =>
    page.evaluate(async () => (await import('/assets/js/app.js')).store.project.cards.length);
  const savedCount = await countCards();
  await page.locator('[data-palette-kind=card]').click();
  await expect.poll(countCards).toBe(savedCount + 1);
  await page.locator('#file-input').setInputFiles(downloadedFile);
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-choice=replace]').click();
  await expect.poll(countCards).toBe(savedCount);
  await expect
    .poll(async () =>
      page.evaluate(async (id) => {
        const card = (await import('/assets/js/app.js')).store.project.cards.find(
          (item) => item.id === id,
        );
        return card?.extensions?.['card-atlas:images'];
      }, original.id),
    )
    .toEqual(original.extensions['card-atlas:images']);
});
