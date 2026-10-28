import { applyAndContinue } from './ui-driver.mjs';
import { projectAction } from './ui-driver.mjs';
import { test, expect } from '@playwright/test';
async function start(page) {
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  await page.locator('#locale').selectOption('en');
}
const source = (p) => p.locator('.graph-card[data-id=card-user-service]');
test('uniform style on Canvas preserves other text, is undo atomic and survives views/JSON', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page);
  await source(page).locator('h3').click();
  await page.locator('#overview-text').fill('Only source renamed');
  await page.locator('#overview-size').fill('24');
  await page.locator('#overview-font').selectOption('serif');
  await page.locator('#overview-uniform').check();
  await expect(page.locator('[data-overview-locale]')).toHaveCount(0);
  await expect(page.locator('#overview-uniform')).toBeChecked();
  await expect
    .poll(async () => {
      const r = await page.locator('#card-overview-editor').boundingBox();
      return r.y + r.height;
    })
    .toBeLessThanOrEqual(890);
  await page.screenshot({ path: 'planning/design/uniform-overview.png' });
  await page.locator('[data-overview-apply]').click();
  for (const title of await page.locator('.graph-card h3').all())
    await expect(title).toHaveCSS('font-size', '24px');
  await expect(page.locator('.graph-card[data-id=card-user-api] h3')).toHaveText('User API');
  await expect(source(page).locator('h3')).toHaveText('Only source renamed');
  const data = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { stage, serialize } = await import('/assets/js/json/validator.js');
    return {
      history: store.undoStack.length,
      errors: stage(serialize(store.project)).errors,
      styles: store.project.cards.map((c) => c.extensions['card-atlas:typography']),
    };
  });
  expect(data.history).toBe(1);
  expect(data.errors).toEqual([]);
  expect(data.styles.every((s) => JSON.stringify(s) === JSON.stringify(data.styles[0]))).toBe(true);
  await page.locator('[data-action=undo]').first().click();
  await expect(source(page).locator('h3')).toHaveText('User Service');
  await page.locator('[data-action=redo]').first().click();
  await page.locator('#map-view').selectOption('mind');
  for (const title of await page.locator('.graph-card h3').all())
    await expect(title).toHaveCSS('font-size', '24px');
  await source(page).locator('h3').click();
  await expect(page.locator('#overview-uniform')).not.toBeChecked();
  await page.locator('#overview-uniform').check();
  await page.locator('#overview-size').fill('30');
  await page.locator('[data-overview-cancel]').click();
  await expect(source(page).locator('h3')).toHaveCSS('font-size', '24px');
  expect(errors).toEqual([]);
});
test('uniform Detail draft waits for Apply and Cancel discards all-card changes', async ({
  page,
}) => {
  await start(page);
  await source(page).locator('.card-open').click();
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('#edit-card-overview').click();
  await page.locator('#overview-size').fill('22');
  await page.locator('#overview-uniform').check();
  await page.locator('[data-overview-apply]').click();
  await expect(source(page).locator('h3')).not.toHaveCSS('font-size', '22px');
  await page.locator('#edit-card-overview').click();
  await expect(page.locator('#overview-uniform')).toBeChecked();
  await page.locator('[data-overview-cancel]').click();
  await page.locator('#cancel-draft').click();
  await page.locator('#edit-card-overview').click();
  await expect(page.locator('#overview-uniform')).not.toBeChecked();
  await page.locator('#overview-uniform').check();
  await page.locator('#overview-size').fill('23');
  await page.locator('[data-overview-apply]').click();
  await page.locator('[name=content]').fill('# Keep this source content');
  await applyAndContinue(page, page.locator('#panel-body form [type=submit]'));
  for (const title of await page.locator('.graph-card h3').all())
    await expect(title).toHaveCSS('font-size', '23px');
  await page.locator('[data-action=close]').click();
  await page.locator('[data-action=undo]').first().click();
  await expect(source(page).locator('h3')).not.toHaveCSS('font-size', '23px');
});

test('opt-in recovery restores pending shared style without committing it early', async ({
  page,
}) => {
  await start(page);
  await source(page).locator('.card-open').click();
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('#edit-card-overview').click();
  await page.locator('#overview-size').fill('21');
  await page.locator('#overview-uniform').check();
  await page.locator('[data-overview-apply]').click();
  await projectAction(page, 'recovery');
  await page.locator('[data-choice=enable]').click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { readRecovery } = await import('/assets/js/store/recovery.js');
        return (await readRecovery())?.uniformStyles?.title?.fontSize;
      }),
    )
    .toBe(21);
  page.on('dialog', (d) => d.accept());
  await page.reload();
  await page.locator('[data-choice=restore]').click();
  await page.locator('#edit-card-overview').click();
  await expect(page.locator('#overview-uniform')).toBeChecked();
  await page.locator('[data-overview-cancel]').click();
  await expect(source(page).locator('h3')).not.toHaveCSS('font-size', '21px');
  await applyAndContinue(page, page.locator('#panel-body form [type=submit]'));
  for (const title of await page.locator('.graph-card h3').all())
    await expect(title).toHaveCSS('font-size', '21px');
});
