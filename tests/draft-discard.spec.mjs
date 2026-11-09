import { test, expect } from '@playwright/test';
import { locale, openRow, projectAction, theme } from './ui-driver.mjs';

const historyLength = (page) =>
  page.evaluate(async () => (await import('/assets/js/app.js')).store.undoStack.length);

async function openFormat(page) {
  await page.goto('/');
  await page.locator('[data-action=example]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
}

async function openDirtyDraft(page) {
  await openRow(page, page.locator('.card-row[data-card-id=card-user-service]'));
  await page.locator('#panel-tabs button').nth(2).click();
  const bg = page.locator('[name=appearance-backgroundTransparent]');
  const original = await bg.isChecked();
  await bg.setChecked(!original);
  return { bg, original };
}

for (const lang of ['vi', 'en']) {
  for (const mode of ['light', 'dark']) {
    test(
      'dirty discard asks first, Cancel/Escape keep draft [' + lang + ' ' + mode + ']',
      async ({ page }) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await openFormat(page);
        await locale(page, lang);
        if (mode === 'dark') await theme(page);
        await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
        const { bg, original } = await openDirtyDraft(page);
        const history = await historyLength(page);
        const discard = page.locator('#cancel-draft');
        await expect(discard).toHaveText(lang === 'vi' ? 'Bỏ thay đổi' : 'Discard changes');
        await expect(page.locator('#panel-body [type=submit]')).toHaveText(
          lang === 'vi' ? 'Áp dụng' : 'Apply',
        );
        // Primary action is last in the action bar.
        const order = await page
          .locator('#panel-body .editor-actions:has([type=submit]) button')
          .evaluateAll((buttons) => buttons.map((b) => b.id || b.type));
        expect(order.at(-1)).toBe('submit');
        await discard.click();
        await expect(page.locator('#modal')).toBeVisible();
        await expect(page.locator('#modal [data-choice=cancel]')).toBeVisible();
        await page.locator('#modal [data-choice=cancel]').click();
        await expect(page.locator('#modal')).not.toBeVisible();
        await expect(bg).toBeChecked({ checked: !original });
        await expect(discard).toBeFocused();
        await discard.click();
        await page.keyboard.press('Escape');
        await expect(page.locator('#modal')).not.toBeVisible();
        await expect(page.locator('#detail-panel')).toBeVisible();
        await expect(bg).toBeChecked({ checked: !original });
        await discard.click();
        await page.locator('#modal [data-choice=discard]').click();
        await expect(page.locator('#modal')).not.toBeVisible();
        await expect(page.locator('[name=appearance-backgroundTransparent]')).toBeChecked({
          checked: original,
        });
        expect(await historyLength(page)).toBe(history);
        await discard.click();
        await expect(page.locator('#modal')).not.toBeVisible();
        expect(errors).toEqual([]);
      },
    );
  }
}

test('clean draft discards without dialog', async ({ page }) => {
  await openFormat(page);
  await openRow(page, page.locator('.card-row[data-card-id=card-user-service]'));
  await page.locator('#panel-tabs button').nth(2).click();
  await page.locator('#cancel-draft').click();
  await expect(page.locator('#modal')).not.toBeVisible();
});

test('dock global discard is guarded when dirty', async ({ page }) => {
  await openFormat(page);
  await projectAction(page, 'inspector');
  const global = page.locator('#inspector-global');
  await expect(global).toBeVisible();
  const discard = global.locator('.inspector-global-actions button:not([type=submit])');
  await expect(discard).toHaveText('Bỏ thay đổi');
  await expect(global.locator('.inspector-global-actions button').last()).toHaveAttribute(
    'type',
    'submit',
  );
  await discard.click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await global.locator('[name=typography]').check();
  await discard.click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal [data-choice=cancel]').click();
  await expect(global.locator('[name=typography]')).toBeChecked();
  await discard.click();
  await page.locator('#modal [data-choice=discard]').click();
  await expect(global.locator('[name=typography]')).not.toBeChecked();
});

test('narrow viewport keeps both action buttons visible', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await openFormat(page);
  await openDirtyDraft(page);
  for (const selector of ['#cancel-draft', '#panel-body [type=submit]']) {
    const box = await page.locator(selector).boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(1000);
    expect(box.y + box.height).toBeLessThanOrEqual(800);
  }
});
