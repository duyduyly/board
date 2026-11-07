import { test, expect } from '@playwright/test';
import { projectAction } from './ui-driver.mjs';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 320, height: 640 },
]) {
  test(`dark format panel supports keyboard controls at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.locator('[data-template=personal]').click();
    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await projectAction(page, 'inspector');
    const tabs = page.locator('#inspector-tabs button');
    await tabs.nth(3).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#inspector-edge-hint')).toBeVisible();
    await tabs.first().focus();
    await expect(tabs.first()).toBeFocused();
    await page.keyboard.press('Space');
    const typography = page.locator('#inspector-global [name=typography]');
    await expect(typography).toBeVisible();
    await expect(typography).not.toBeChecked();
    await typography.focus();
    await expect(typography).toBeFocused();
    await page.keyboard.press('Space');
    await expect(typography).toBeChecked();
    const size = page.locator('#inspector-global [name=bulk-title-fontSize]');
    await size.focus();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('23');
    await tabs.nth(3).focus();
    await page.keyboard.press('Enter');
    await tabs.first().focus();
    await page.keyboard.press('Enter');
    await expect(size).toHaveValue('23');
    await page.locator('#inspector-close').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#modal')).toBeVisible();
    await page.locator('#modal [data-choice=discard]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#format-inspector')).toBeHidden();
  });
}
