import { test, expect } from '@playwright/test';
const document = {
  version: 1,
  format: 'html-bs5',
  components: [
    { tag: 'h1', attributes: {}, children: ['First heading'] },
    { tag: 'p', attributes: {}, children: ['Alpha knowledge'] },
    { tag: 'h2', attributes: {}, children: ['Second heading'] },
    { tag: 'p', attributes: {}, children: ['Beta summary'] },
  ],
};
const project = {
  version: '1.0',
  cards: [
    {
      id: 'html-search',
      title: 'Example',
      summary: '',
      content: '<p>stale decoy</p>',
      extensions: { 'card-atlas:metadata': { pinned: true }, 'card-atlas:document': document },
    },
  ],
  relations: [],
};
async function load(page) {
  await page.goto('/');
  await page
    .locator('#file-input')
    .setInputFiles({
      name: 'html.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
  await page.locator('[data-choice=apply]').click();
}

test('search uses document text rather than stale serialized markup', async ({ page }) => {
  await load(page);
  await page.locator('[data-action=search]').click();
  await page.locator('#search').fill('Alpha');
  const row = page.locator('[data-card-id=html-search]');
  await expect(row).toBeVisible();
  await expect(row.locator('.search-excerpt')).toContainText('Alpha knowledge');
  await expect(row.locator('.search-excerpt')).not.toContainText('<p>');
  await page.locator('#search').fill('stale decoy');
  await expect(row).toHaveCount(0);
});

test('HTML readonly document offers a working table of contents', async ({ page }) => {
  await load(page);
  await page.locator('[data-id=html-search]').focus();
  await page.keyboard.press('Enter');
  const frame = page.frameLocator('.html-document-frame');
  // The outline now sits beside the document (sticky rail) instead of inside the viewer frame.
  const nav = page.locator('.reading-contents');
  await expect(nav).toBeVisible();
  const items = nav.locator('.reading-contents-list button');
  await expect(items).toHaveCount(2);
  await expect(items.nth(1)).toHaveText('Second heading');
  await items.nth(1).click();
  await expect(frame.locator('#document-heading-1')).toHaveText('Second heading');
});
