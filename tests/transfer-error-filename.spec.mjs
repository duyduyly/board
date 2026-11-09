import { test, expect } from '@playwright/test';
import { openSearch } from './ui-driver.mjs';

async function importBroken(page, name, locale = 'vi') {
  await page.goto('/');
  await page.locator('#locale').selectOption(locale);
  await page.locator('[data-template=architecture]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
  await openSearch(page);
  await page.locator('.card-row[data-card-id=card-user-service]').click();
  if (!(await page.locator('.node-transfer-tools').evaluate((e) => e.open)))
    await page.locator('.node-transfer-tools summary').click();
  await page.locator('#import-node-file').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from('{\n  "cards": [,\n}'),
  });
  await expect(page.locator('#modal')).toBeVisible();
}

for (const [locale, pattern] of [
  ['vi', /dòng \d+, cột \d+/],
  ['en', /line \d+, column \d+/],
]) {
  test(
    'node import syntax error shows file name and line/column (' + locale + ')',
    async ({ page }) => {
      await importBroken(page, 'broken-node.json', locale);
      const text = await page.locator('#modal pre').innerText();
      expect(text).toContain('broken-node.json');
      expect(text).toMatch(pattern);
      expect(text).not.toContain('$file');
    },
  );
}

test('file name with HTML is shown as text, not parsed', async ({ page }) => {
  await importBroken(page, '<img src=x onerror=window.__x=1>.json');
  await expect(page.locator('#modal pre')).toContainText('<img src=x onerror=window.__x=1>.json');
  await expect(page.locator('#modal img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__x)).toBeUndefined();
});
