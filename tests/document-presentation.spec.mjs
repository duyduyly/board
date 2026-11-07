import { test, expect } from '@playwright/test';

test('viewer and visual editor share document styles and keep wide tables scrollable', async ({ page }) => {
  page.setDefaultTimeout(5000);
  await page.setViewportSize({ width: 1050, height: 800 });
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-editor-mode=html]').click();
  await page.locator('[data-editor-source]').fill('<h1>Learning</h1><p>Notes</p><table><tbody><tr><td>Very long content without line breaks for comparison</td><td>Second column</td></tr></tbody></table>');
  await page.locator('[data-editor-mode=visual]').click();
  const visual = page.frameLocator('#block-editor .gjs-frame');
  await expect(visual.locator('table')).toBeVisible();
  const css = await visual.locator('td').first().evaluate((el) => ({ font: window.getComputedStyle(el).fontSize, border: window.getComputedStyle(el).borderTopStyle }));
  await page.locator('#panel-body [type=submit]').click();
  const id = await page.evaluate(async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).id);
  await page.locator(`[data-id="${id}"]`).focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').first().click();
  const viewer = page.frameLocator('.html-document-frame');
  await expect(viewer.locator('table')).toBeVisible();
  expect(await viewer.locator('td').first().evaluate((el) => ({ font: window.getComputedStyle(el).fontSize, border: window.getComputedStyle(el).borderTopStyle }))).toEqual(css);
  expect(await viewer.locator('table').evaluate((el) => window.getComputedStyle(el).overflowX)).toBe('auto');
  await expect.poll(async () => {
    const height = await page.locator('.html-document-frame').evaluate((frame) => frame.clientHeight);
    const contentHeight = await viewer.locator('body').evaluate((body) => body.scrollHeight);
    return contentHeight <= height + 2;
  }).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
