import { test, expect } from '@playwright/test';

test('nested Bootstrap layout survives Apply and reopen', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  const frame = page.frameLocator('#block-editor .gjs-frame');
  await page.locator('[data-block-label=blockContainer]').click();
  await frame.locator('.container').click({ position: { x: 4, y: 4 } });
  await page.locator('[data-block-label=blockRow]').click();
  const row = frame.locator('.container > .row');
  await expect(row).toHaveCount(1);
  await row.click({ position: { x: 4, y: 4 } });
  await page.locator('[data-block-label=blockColumn]').click();
  await expect(row.locator(':scope > .col-md-6')).toHaveCount(1);
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  await page.locator(`[data-id="${card.id}"]`).focus();
  await page.keyboard.press('Enter');
  await expect(frame.locator('.container > .row > .col-md-6')).toHaveCount(1);
});

test('layout settings persist responsive width, gap and text alignment', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  const frame = page.frameLocator('#block-editor .gjs-frame');
  await page.locator('[data-block-label=blockColumns]').click();
  const row = frame.locator('.row');
  await row.click({ position: { x: 4, y: 4 } });
  await page.locator('[data-layout-control=gap]').selectOption('5');
  await expect(row).toHaveClass(/g-5/);
  await page.locator('[data-layout-control=align]').selectOption('center');
  await expect(row).toHaveClass(/text-center/);
  const col = frame.locator('.col-md-6').first();
  await col.click({ position: { x: 4, y: 4 } });
  await page.locator('[data-layout-control=breakpoint]').selectOption('lg');
  await page.locator('[data-layout-control=width]').selectOption('4');
  await expect(frame.locator('.col-lg-4')).toHaveCount(1);
  await expect(frame.locator('.col-lg-4')).toHaveClass(/col-md-6/);
  const iframe = page.locator('#block-editor .gjs-frame');
  for (const [width, fraction] of [
    [700, 1],
    [850, 0.5],
    [1200, 1 / 3],
  ]) {
    await iframe.evaluate((element, value) => {
      element.style.width = value + 'px';
    }, width);
    await expect
      .poll(async () => {
        const rowBox = await row.boundingBox();
        const colBox = await frame.locator('.col-lg-4').boundingBox();
        return Math.abs(colBox.width / rowBox.width - fraction);
      })
      .toBeLessThan(0.03);
  }
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  await page.locator(`[data-id="${card.id}"]`).focus();
  await page.keyboard.press('Enter');
  await expect(frame.locator('.row')).toHaveClass(/g-5/);
  await expect(frame.locator('.row')).toHaveClass(/text-center/);
  await expect(frame.locator('.col-lg-4')).toHaveCount(1);
  await expect(frame.locator('.col-lg-4')).toHaveClass(/col-md-6/);
});

test('layout reset removes supported formatting while retaining nested content', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('[data-block-label=blockColumns]').click();
  const frame = page.frameLocator('#block-editor .gjs-frame');
  const row = frame.locator('.row');
  await row.click({ position: { x: 4, y: 4 } });
  await page.locator('[data-layout-control=gap]').selectOption('5');
  await page.locator('[data-layout-control=align]').selectOption('center');
  await page.locator('[data-layout-reset]').click();
  await expect(row).not.toHaveClass(/g-5|text-center/);
  await expect(row.locator('p')).toHaveCount(2);
  const col = frame.locator('.col-md-6').first();
  await col.click({ position: { x: 4, y: 4 } });
  await page.locator('[data-layout-reset]').click();
  await expect(frame.locator('.row > .col')).toHaveCount(1);
  await expect(row.locator('p')).toHaveCount(2);
});
