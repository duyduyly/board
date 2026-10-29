import { view as switchMapView } from './ui-driver.mjs';
import { applyAndContinue } from './ui-driver.mjs';
import { test, expect } from '@playwright/test';
import { setDraftTitle, expectDraftTitle } from './overview-test-helpers.mjs';
test('Canvas popup inherits global locale, edits text/style atomically and resets to defaults', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  await page.locator('#locale').selectOption('en');
  const card = page.locator('.graph-card[data-id=card-user-service]'),
    title = card.locator('h3'),
    popup = page.locator('#card-overview-editor');
  await title.click();
  await expect(popup).toBeVisible();
  await page.locator('#overview-text').fill('New title');
  await page.locator('#overview-size').fill('24');
  await page.locator('#overview-font').selectOption('serif');
  await page.locator('#overview-color').fill('#884422');
  await page.locator('#overview-color').dispatchEvent('input');
  await expect(page.locator('[data-overview-locale]')).toHaveCount(0);
  await expect(page.locator('#overview-text')).toHaveValue('New title');
  await page.locator('#overview-field').selectOption('summary');
  await page.locator('#overview-text').fill('A new summary');
  await page.locator('#overview-field').selectOption('type');
  await page.locator('#overview-text').fill('GUIDE');
  await page.screenshot({ path: 'planning/design/overview-editor-light.png' });
  await page.locator('[data-overview-apply]').click();
  await expect(title).toHaveText('New title');
  await expect(title).toHaveCSS('font-size', '24px');
  await expect(title).toHaveCSS('color', 'rgb(136, 68, 34)');
  await expect(card.locator('.card-summary')).toHaveText('A new summary');
  await expect(card.locator('.type-badge')).toHaveText('GUIDE');
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  await page.locator('[data-action=undo]').first().click();
  await expect(title).toHaveText('User Service');
  await page.locator('[data-action=redo]').first().click();
  await expect(title).toHaveText('New title');
  await switchMapView(page, 'mind');
  await title.focus();
  await title.press('Enter');
  await page.locator('#overview-text').fill('Cancelled');
  await page.keyboard.press('Escape');
  await expect(title).toHaveText('New title');
  await page.locator('#theme-toggle').click();
  await title.click();
  await page.locator('[data-overview-reset]').click();
  await page.screenshot({ path: 'planning/design/overview-editor-dark.png' });
  await page.locator('[data-overview-apply]').click();
  await expect(title).not.toHaveCSS('font-size', '24px');
  expect(errors).toEqual([]);
});
test('Detail Edit keeps Markdown primary and popup edits stay in the shared draft until Apply', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  const card = page.locator('.graph-card[data-id=card-user-service]');
  await card.locator('.card-open').click();
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(page.locator('#panel-body [name=title]')).toHaveCount(0);
  await page.locator('[name=content]').fill('# Draft content');
  await setDraftTitle(page, 'Draft title');
  await expectDraftTitle(page, 'Draft title');
  await expect(card.locator('h3')).toHaveText('User Service');
  await page.locator('#panel-tabs button').nth(2).click();
  await expect(page.locator('#format-card-preview h3')).toHaveText('Draft title');
  await applyAndContinue(page, page.locator('#panel-body form [type=submit]'));
  await expect(card.locator('h3')).toHaveText('Draft title');
  await page.locator('[data-action=close]').click();
  await page.locator('[data-action=undo]').first().click();
  await expect(card.locator('h3')).toHaveText('User Service');
  const data = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { stage, serialize } = await import('/assets/js/json/validator.js');
    return {
      errors: stage(serialize(store.project)).errors,
      content: store.project.cards.find((c) => c.id === 'card-user-service').content,
    };
  });
  expect(data.errors).toEqual([]);
  expect(data.content).not.toBe('# Draft content');
});

test('invalid staged fields cannot commit; fractional sizes and independent summary/type styles round-trip', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1050, height: 900 });
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  const card = page.locator('.graph-card[data-id=card-user-service]'),
    popup = page.locator('#card-overview-editor');
  await card.locator('h3').click();
  await page.locator('#overview-text').fill('');
  await page.locator('[data-overview-apply]').click();
  await expect(popup).toBeVisible();
  await expect(card.locator('h3')).toHaveText('User Service');
  await page.locator('#overview-text').fill('Fractional');
  await page.locator('#overview-size').fill('73');
  await page.locator('#overview-field').selectOption('summary');
  await page.locator('[data-overview-apply]').click();
  await expect(popup.locator('[role=alert]')).toBeVisible();
  await page.locator('#overview-field').selectOption('title');
  await page.locator('#overview-size').fill('14.25');
  await page.locator('#overview-field').selectOption('summary');
  await page.locator('#overview-size').fill('20');
  await page.locator('#overview-font').selectOption('mono');
  await page.locator('#overview-field').selectOption('type');
  await page.locator('#overview-size').fill('18');
  await page.locator('#overview-color').fill('#28594b');
  await page.locator('#overview-color').dispatchEvent('input');
  await page.locator('[data-overview-apply]').click();
  await expect(popup).not.toBeVisible();
  await expect(card.locator('h3')).toHaveCSS('font-size', '14.25px');
  await expect(card.locator('.card-summary')).toHaveCSS('font-size', '20px');
  await expect(card.locator('.type-badge')).toHaveCSS('font-size', '18px');
  await expect(card.locator('.type-badge')).toHaveCSS('line-height', '25.2px');
  const result = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { serialize, stage } = await import('/assets/js/json/validator.js');
    const staged = stage(serialize(store.project));
    return {
      errors: staged.errors,
      style: staged.project.cards.find((c) => c.id === 'card-user-service').extensions[
        'card-atlas:typography'
      ],
    };
  });
  expect(result.errors).toEqual([]);
  expect(result.style.title.fontSize).toBe(14.25);
  expect(result.style.summary.fontFamily).toBe('mono');
  expect(result.style.type.color).toBe('#28594b');
});
