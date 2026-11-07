import { test, expect } from '@playwright/test';

for (const [locale, example] of [
  ['vi', 'Nhấn để chỉnh sửa nội dung ví dụ.'],
  ['en', 'Click to edit this example text.'],
]) {
  test(`image and text palette creates editable example in ${locale}`, async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-template=personal]').click();
    if (locale === 'en') await page.locator('#locale').selectOption('en');
    await expect(page.locator('[data-palette-kind=image]')).toHaveCount(0);
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-palette-kind=image-text]').click();
    await (await chooser).setFiles('tests/fixtures/english-endings.png');
    const node = page.locator('.graph-card[data-node-kind=image-text]');
    await expect(node).toHaveCount(1);
    await expect(node.locator('img')).toBeVisible();
    await expect(node.locator('.card-summary')).toHaveText(example);
    await node.locator('.card-summary').click();
    await expect(page.locator('#card-overview-editor')).toBeVisible();
    await expect(page.locator('#overview-field')).toHaveValue('summary');
    await page.locator('#overview-text').fill('My edited example');
    await page.locator('[data-overview-apply]').click();
    await expect(node.locator('.card-summary')).toHaveText('My edited example');
    await page.locator('[data-action=undo]').click();
    await expect(node.locator('.card-summary')).toHaveText(example);
    await page.locator('[data-action=redo]').click();
    await expect(node.locator('.card-summary')).toHaveText('My edited example');
  });
}

test('dragging image and text to the canvas opens file selection and creates a node there', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  const region = page.locator('#canvas-region');
  const box = await region.boundingBox();
  const target = { x: box.width * 0.7, y: box.height * 0.7 };
  const chooser = page.waitForEvent('filechooser');
  await page.locator('[data-palette-kind=image-text]').dragTo(region, { targetPosition: target });
  await (await chooser).setFiles('tests/fixtures/english-endings.png');
  const node = page.locator('.graph-card[data-node-kind=image-text]');
  await expect(node).toHaveCount(1);
  await expect(node.locator('img')).toBeVisible();
  await expect(node.locator('.card-summary')).toHaveText('Nhấn để chỉnh sửa nội dung ví dụ.');
  const rect = await node.boundingBox();
  expect(Math.abs(rect.x + rect.width / 2 - (box.x + target.x))).toBeLessThan(5);
  expect(Math.abs(rect.y + rect.height / 2 - (box.y + target.y))).toBeLessThan(5);
});
