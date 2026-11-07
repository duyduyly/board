import { test, expect } from '@playwright/test';

test('Mind Map text title opens the inspector and applies one undoable edit', async ({ page }) => {
  await page.goto('/');
  const cards = ['root', 'text', 'locked'].map((id, index) => ({
    id,
    title: id,
    summary: '',
    content: '',
    tags: [],
    type: 'note',
    position: { x: 70 + index * 300, y: 100 },
    size: { width: 220, height: 140 },
    style: { backgroundColor: '#ffffff', textColor: '#222222', borderColor: '#444444' },
    extensions: {
      'card-atlas:node': { kind: id === 'root' ? 'card' : 'text' },
      ...(id === 'locked' ? { 'card-atlas:metadata': { pinned: true } } : {}),
    },
  }));
  const project = {
    version: '1.0',
    metadata: { title: 'Mind' },
    cards,
    relations: [],
    extensions: { 'card-atlas:mind-map': { rootId: 'root' } },
  };
  await page.locator('#file-input').setInputFiles({
    name: 'mind.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-map-view=mind]').click();
  await page.locator('[data-id=root] [data-overview-field=title]').click();
  await expect(page.locator('#format-inspector')).toBeVisible();
  await expect(page.locator('#overview-field')).toHaveValue('title');
  await expect(page.locator('#overview-text')).toHaveValue('root');
  await page.locator('[data-overview-cancel]').click();
  const title = page.locator('[data-id=text] [data-overview-field=title]');
  await title.click();
  await expect(page.locator('#format-inspector')).toBeVisible();
  await expect(page.locator('#overview-field')).toHaveValue('title');
  await expect(page.locator('#overview-text')).toHaveValue('text');
  await page.locator('#overview-text').fill('Updated title');
  await page.locator('[data-overview-apply]').click();
  await expect(page.locator('[data-id=text] [data-overview-field=title]')).toHaveText(
    'Updated title',
  );
  await page.locator('[data-action=undo]').click();
  await expect(page.locator('[data-id=text] [data-overview-field=title]')).toHaveText('text');
  await page.locator('[data-id=text] [data-overview-field=title]').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#overview-text')).toHaveValue('text');
  await page.locator('[data-id=text] [data-overview-field=title]').dblclick();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await page.locator('#detail-panel [data-action=close]').click();
  await page.locator('[data-id=locked] [data-overview-field=title]').click();
  await expect(page.locator('#overview-text')).not.toHaveValue('locked');
});

test('a text node created from the palette opens title editing in Mind Map', async ({ page }) => {
  await page.goto('/');
  const project = {
    version: '1.0',
    metadata: { title: 'Mind palette' },
    cards: [{ id: 'root', title: 'Root', content: '', position: { x: 50, y: 50 } }],
    relations: [],
    extensions: { 'card-atlas:mind-map': { rootId: 'root' } },
  };
  await page
    .locator('#file-input')
    .setInputFiles({
      name: 'mind.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-map-view=mind]').click();
  await page.locator('[data-palette-kind=text]').click();
  const created = page.locator('.graph-card[data-node-kind=text]').last();
  await expect(created.locator('.card-summary')).toHaveCount(0);
  expect(await page.evaluate(async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).summary)).toBe('');
  const title = page.locator('.graph-card[data-node-kind=text] [data-overview-field=title]').last();
  const value = await title.textContent();
  await title.click();
  await expect(page.locator('#format-inspector')).toBeVisible();
  await expect(page.locator('#overview-field')).toHaveValue('title');
  await expect(page.locator('#overview-text')).toHaveValue(value);
});
