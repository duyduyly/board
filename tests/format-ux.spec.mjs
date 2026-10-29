import { view as switchMapView } from './ui-driver.mjs';
import { applyAndContinue } from './ui-driver.mjs';
import { test, expect } from '@playwright/test';
async function start(page) {
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  await page.locator('.graph-card[data-id=card-user-service] .card-open').click();
}
test('contextual Format has sticky preview and one typography editor; tags stage and undo', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);
  await page.locator('#panel-tabs button').nth(2).click();
  await expect(page.locator('[name=appearance-titleFontSize]')).toHaveCount(0);
  await expect(page.locator('#fit-text')).toHaveCount(0);
  await expect(page.locator('[data-shape]')).toHaveCount(0);
  await expect(page.locator('[data-image-fields]')).not.toBeVisible();
  await expect(page.locator('#set-root')).toHaveCount(0);
  await page.locator('.format-advanced summary').scrollIntoViewIfNeeded();
  await page.locator('.format-advanced summary').click();
  await expect(page.locator('#detail-locale')).toHaveCount(0);
  await expect(page.locator('.format-advanced')).toHaveJSProperty('open', true);
  await expect(page.locator('#detail-locale')).toHaveCount(0);
  const boxes = await page.locator('.format-preview-pane').evaluate((el) => ({
    preview: el.getBoundingClientRect().top,
    body: document.querySelector('#panel-body').getBoundingClientRect().top,
  }));
  expect(boxes.preview).toBeGreaterThanOrEqual(boxes.body - 1);
  await page.screenshot({ path: 'planning/design/format-ux-light.png' });
  await page.locator('#panel-tabs button').nth(1).click();
  expect(await page.locator('#panel-body').evaluate((el) => el.scrollTop)).toBe(0);
  await expect(page.locator('#edit-card-overview')).toBeVisible();
  await page.locator('#edit-card-overview').click();
  await expect(page.locator('[data-overview-apply]')).toHaveText('Cập nhật bản nháp');
  await page.locator('#overview-tags').fill('important, grammar');
  await page.locator('[data-overview-apply]').click();
  await applyAndContinue(page, page.locator('#panel-body form [type=submit]'));
  const tags = () =>
    page.evaluate(async () => {
      const { store } = await import('/assets/js/app.js');
      return store.project.cards.find((c) => c.id === 'card-user-service').tags;
    });
  expect(await tags()).toEqual(['important', 'grammar']);
  await page.locator('[data-action=close]').click();
  await page.locator('[data-action=undo]').first().click();
  expect(await tags()).toEqual(['backend', 'user']);
  expect(errors).toEqual([]);
});
test('display context, integrated rounded preset, Auto Fit and responsive dark preview', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1050, height: 900 });
  await start(page);
  await page.locator('#panel-tabs button').nth(2).click();
  await page.locator('[name=appearance-sizeMode]').selectOption('fit');
  await page.locator('[name=width]').fill('320');
  await expect(page.locator('[name=appearance-sizeMode]')).toHaveValue('manual');
  await expect(page.locator('#format-card-preview .graph-card')).toHaveCSS('width', '320px');
  await page.locator('[name=node-kind]').selectOption('image-text');
  await expect(page.locator('[data-image-fields]')).toBeVisible();
  await page.locator('[name=node-kind]').selectOption('card');
  await page.locator('[name=appearance-shape]').selectOption('circle');
  await expect(page.locator('[data-radius-field]')).not.toBeVisible();
  await page.locator('[name=appearance-shape]').selectOption('rounded');
  await expect(page.locator('[name=appearance-radius]')).toHaveValue('24');
  await page.locator('[name=appearance-sizeMode]').selectOption('fit');
  await expect(page.locator('[name=appearance-sizeMode]')).toHaveValue('fit');
  expect(
    await page
      .locator('#format-card-preview .card-summary')
      .evaluate((el) => el.scrollHeight - el.clientHeight),
  ).toBeLessThanOrEqual(1);
  await page.locator('#detail-theme').click();
  await page.screenshot({ path: 'planning/design/format-ux-dark-1050.png' });
  await page.locator('#cancel-draft').click();
  await page.locator('[data-action=close]').click();
  await switchMapView(page, 'mind');
  await page.locator('.graph-card[data-id=card-user-service] .card-open').click();
  await page.locator('#panel-tabs button').nth(2).click();
  await expect(page.locator('#set-root')).toBeVisible();
});
test('frame reset preserves legacy font defaults and popup override', async ({ page }) => {
  const fs = await import('node:fs/promises');
  const project = JSON.parse(await fs.readFile('assets/data/example.json', 'utf8'));
  const card = project.cards.find((c) => c.id === 'card-user-service');
  card.extensions = {
    'card-atlas:appearance': { titleFontSize: 18, shape: 'rounded', radius: 40 },
    'card-atlas:typography': { title: { fontSize: 24 } },
  };
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'legacy.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await page.locator('.graph-card[data-id=card-user-service] .card-open').click();
  await page.locator('#panel-tabs button').nth(2).click();
  await page.locator('#format-card-preview h3').click();
  await expect(page.locator('[name=appearance-radius]')).toHaveValue('40');
  await expect(page.locator('#card-overview-editor')).not.toBeVisible();
  await page.locator('#reset-appearance').click();
  await expect(page.locator('#format-card-preview h3')).toHaveCSS('font-size', '24px');
  await page.locator('#edit-card-overview').click();
  await page.locator('[data-overview-reset]').click();
  await page.locator('[data-overview-apply]').click();
  await expect(page.locator('#format-card-preview h3')).toHaveCSS('font-size', '18px');
  await applyAndContinue(page, page.locator('#panel-body form [type=submit]'));
  const data = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { serialize, stage } = await import('/assets/js/json/validator.js');
    return stage(serialize(store.project));
  });
  expect(data.errors).toEqual([]);
  expect(
    data.project.cards.find((c) => c.id === 'card-user-service').extensions['card-atlas:appearance']
      .titleFontSize,
  ).toBe(18);
});
