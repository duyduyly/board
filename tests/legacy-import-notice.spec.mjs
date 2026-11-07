import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('legacy project import warns before replacing the current project', async ({ page }) => {
  const bytes = await readFile('tests/fixtures/legacy/example.json');
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: bytes });
  const dialog = page.locator('#modal');
  await expect(dialog).toContainText('Markdown cũ');
  await expect(dialog.locator('[data-choice=apply]')).toBeEnabled();
  await dialog.locator('[data-choice=cancel]').click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.template-tile').first()).toBeVisible();
});

test('legacy project warning follows the global language', async ({ page }) => {
  const bytes = await readFile('tests/fixtures/legacy/example.json');
  await page.goto('/');
  await page.locator('#locale').selectOption('en');
  await page.locator('#file-input').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: bytes });
  await expect(page.locator('#modal')).toContainText('legacy Markdown format');
});

test('legacy overview preserves the source as inert text', async ({ page }) => {
  const project = JSON.parse(await readFile('tests/fixtures/legacy/example.json', 'utf8'));
  const card = project.cards.find((item) => item.id === 'card-user-service');
  card.content = '# Preserved\n\n<script>window.legacyRan = true</script>\n\n![remote](https://example.invalid/a.png)';
  const external = [];
  page.on('request', (request) => { if (request.url().includes('example.invalid')) external.push(request.url()); });
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await page.locator('#modal [data-choice=apply]').click();
  await page.locator('[data-id=card-user-service]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').first().click();
  await expect(page.locator('.legacy-source-notice')).toContainText('Markdown cũ');
  await expect(page.locator('.legacy-source-text')).toHaveText(card.content);
  expect(await page.evaluate(() => window.legacyRan)).toBeUndefined();
  expect(external).toEqual([]);
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(page.locator('#panel-body .legacy-source-text')).toHaveText(card.content);
  await expect(page.locator('#panel-body textarea[name=content]')).toHaveCount(0);
  await page.locator('#panel-body [type=submit]').click();
  const stored = await page.evaluate(async () => (await import('/assets/js/app.js')).store.project.cards.find((item) => item.id === 'card-user-service').content);
  expect(stored).toBe(card.content);
});
