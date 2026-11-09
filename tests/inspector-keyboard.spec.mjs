import { test, expect } from '@playwright/test';

const viewports = [
  { width: 1440, height: 900 },
  { width: 1000, height: 800 },
];

for (const locale of ['vi', 'en'])
  for (const theme of ['light', 'dark'])
    for (const viewport of viewports)
      test(`format dock keyboard open/Escape/theme [${locale} ${theme} ${viewport.width}]`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.goto('/');
        await page.locator('[data-template=personal]').click();
        if (locale === 'en') await page.locator('#locale').selectOption('en');
        if (theme === 'dark') await page.locator('#theme-toggle').click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const card = page.locator('.graph-card').first();
        await card.click({ position: { x: 30, y: 150 } });
        await expect(card).toHaveClass(/selected/);

        // Open from the keyboard: ? menu, then the Format item.
        await page.locator('#quick-help').focus();
        await page.keyboard.press('Enter');
        await page.locator('[data-action=inspector]').focus();
        await page.keyboard.press('Enter');
        const dock = page.locator('#format-inspector');
        await expect(dock).toBeVisible();
        await expect(page.locator('#inspector-tabs button.active')).toBeFocused();

        // Escape on a clean dock closes it, returns focus, keeps selection.
        await page.keyboard.press('Escape');
        await expect(dock).toBeHidden();
        await expect(page.locator('#quick-help')).toBeFocused();
        await expect(card).toHaveClass(/selected/);

        // Dirty dock: Escape asks, Cancel keeps dock and draft.
        await page.keyboard.press('Enter');
        await page.locator('[data-action=inspector]').focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('#inspector-tabs button.active')).toBeFocused();
        const typography = page.locator('#inspector-global [name=typography]');
        await typography.check();
        await page.keyboard.press('Escape');
        await expect(page.locator('#modal')).toBeVisible();
        await page.locator('#modal [data-choice=cancel]').click();
        await expect(dock).toBeVisible();
        await expect(typography).toBeChecked();
        await expect(card).toHaveClass(/selected/);

        // Theme change must not trigger the dismiss guard and keeps the draft.
        const other = theme === 'dark' ? 'light' : 'dark';
        await page.locator('#theme-toggle').click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', other);
        await expect(page.locator('#modal')).toBeHidden();
        await expect(dock).toBeVisible();
        await expect(typography).toBeChecked();

        // Escape then Discard closes and restores focus.
        await typography.focus();
        await page.keyboard.press('Escape');
        await page.locator('#modal [data-choice=discard]').click();
        await expect(dock).toBeHidden();
        await expect(page.locator('#quick-help')).toBeFocused();
        await expect(card).toHaveClass(/selected/);
      });

test('Escape in the overview editor closes only that editor', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('#quick-help').click();
  await page.locator('[data-action=inspector]').click();
  await page.locator('.graph-card').first().locator('h3').click();
  await expect(page.locator('#overview-text')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#overview-text')).toBeHidden();
  await expect(page.locator('#format-inspector')).toBeVisible();
});
