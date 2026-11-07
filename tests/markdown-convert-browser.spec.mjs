import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { convertMarkdownCard } from '../scripts/markdown-convert.mjs';

test('converted legacy project opens in the integrated visual editor', async ({ page }) => {
  const project = JSON.parse(await readFile('tests/fixtures/legacy/example.json', 'utf8'));
  project.cards.find((card) => card.id === 'card-user-service').content +=
    '\n\n4. Fourth\n5. Fifth';
  project.cards = project.cards.map((card) => convertMarkdownCard(card).card);
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'converted-example.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-id=card-user-service]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  const frame = page.frameLocator('#block-editor .gjs-frame');
  await expect(frame.locator('h1')).toContainText('User Service');
  await expect(frame.locator('ol')).toHaveAttribute('start', '4');
  await expect(frame.locator('code.language-mermaid')).toContainText('flowchart LR');
  await expect(page.locator('.block-editor-legacy-status')).toContainText('Mermaid');
  await page.locator('[data-editor-mode=html]').click();
  await expect(page.locator('[data-editor-source]')).toHaveText(/data-origin="legacy-mermaid"/);
  await page.locator('[data-editor-mode=visual]').click();
  await expect(page.locator('textarea[name=content]')).toHaveCount(0);
  await expect(page.locator('#panel-body [type=submit]')).toBeDisabled();
  await page.locator('#detail-panel [data-action=close]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  await page.locator('[data-id=card-user-service]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(frame.locator('ol')).toHaveAttribute('start', '4');
  await page.locator('#panel-tabs button').first().click();
  await expect(page.frameLocator('.html-document-frame').locator('.legacy-source-status')).toContainText('Mermaid');
});

test('legacy sources are labelled without loading external images or executing HTML', async ({ page }) => {
  const project = JSON.parse(await readFile('tests/fixtures/legacy/example.json', 'utf8'));
  const card = project.cards.find((item) => item.id === 'card-user-service');
  card.content = '```mermaid\ngraph LR\n A-->B\n```\n\n![external](https://example.invalid/test.png)\n\n<script>window.unsafeRan = true</script>';
  project.cards = project.cards.map((item) => convertMarkdownCard(item).card);
  const requests = [];
  page.on('request', (request) => { if (request.url().includes('example.invalid')) requests.push(request.url()); });
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-id=card-user-service]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  const status = page.locator('.block-editor-legacy-status');
  await expect(status).toContainText('Mermaid');
  await expect(status).toContainText('HTML');
  await expect(status).toContainText('Ảnh ngoài');
  await expect(page.locator('#panel-body [type=submit]')).toBeDisabled();
  await page.locator('#detail-panel [data-action=close]').click();
  await page.locator('[data-id=card-user-service]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').first().click();
  const viewer = page.frameLocator('.html-document-frame');
  await expect(viewer.locator('.legacy-source-status')).toHaveCount(3);
  await expect(viewer.locator('body')).toContainText('example.invalid');
  await expect(viewer.locator('script, img')).toHaveCount(0);
  expect(requests).toEqual([]);
});
