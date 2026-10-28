import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { setDraftTitle } from './overview-test-helpers.mjs';
const state = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return { p: store.project, n: store.undoStack.length };
  });
async function setup(page, locale = 'vi') {
  await page.goto('/');
  await page.locator('#locale').selectOption(locale);
  const image = {
    name: 'lesson.png',
    mimeType: 'image/png',
    data: (await fs.readFile('tests/fixtures/english-endings.png')).toString('base64'),
  };
  const cards = ['card', 'text', 'image', 'image-text'].map((kind, i) => ({
    id: 'kind-' + i,
    title: 'Title ' + i,
    summary: 'Summary ' + i,
    content: '# Original',
    position: { x: 60 + (i % 2) * 400, y: 100 + Math.floor(i / 2) * 320 },
    size: { width: 260, height: 220 },
    extensions: {
      'card-atlas:node': { kind, ...(i >= 2 ? { coverImageId: 'cover' } : {}) },
      ...(i >= 2 ? { 'card-atlas:images': { cover: image } } : {}),
    },
  }));
  const p = {
    version: '1.0',
    metadata: { title: 'Apply lifecycle' },
    cards,
    relations: [{ id: 'r', source: 'kind-0', target: 'kind-1', label: 'link' }],
  };
  await page.locator('#file-input').setInputFiles({
    name: 'apply.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.locator('[data-choice=apply]').click();
}
async function openCard(page, i, tab) {
  await page.locator('[data-id=kind-' + i + ']').focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(tab).click();
}
async function apply(page) {
  await page.locator('#panel-body form [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
}
for (const locale of ['vi', 'en'])
  test(
    'successful Apply closes every card kind/Edit/Format/relation/project and announces at top in ' +
      locale,
    async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await setup(page, locale);
      for (let i = 0; i < 4; i++) {
        await openCard(page, i, 1);
        const before = await state(page);
        await page.locator('[name=content]').fill('# Saved ' + i);
        await setDraftTitle(page, 'Saved title ' + i);
        await expect(page.locator('#detail-panel')).toBeVisible();
        expect((await state(page)).n).toBe(before.n);
        await apply(page);
        await expect(page.locator('[data-id=kind-' + i + ']')).toBeFocused();
        const saved = await state(page);
        expect(saved.n).toBe(before.n + 1);
        expect(saved.p.cards[i].title).toBe('Saved title ' + i);
        expect(saved.p.cards[i].content).toBe('# Saved ' + i);
        await openCard(page, i, 2);
        await page.locator('[name=width]').fill('300');
        await apply(page);
        expect((await state(page)).p.cards[i].size.width).toBe(300);
      }
      const region = await page.locator('#canvas-region').boundingBox();
      const mid = await page.evaluate(async () =>
        (await import('/assets/js/app.js')).adapter.cy.getElementById('r:r').renderedMidpoint(),
      );
      await page.mouse.click(region.x + mid.x, region.y + mid.y);
      await page.locator('[name=edge-route]').selectOption('orthogonal');
      await apply(page);
      expect((await state(page)).p.relations[0].extensions['card-atlas:edge'].route).toBe(
        'orthogonal',
      );
      await page.locator('#project-name').click();
      await page.locator('[name=title]').fill('Saved project');
      await apply(page);
      expect((await state(page)).p.metadata.title).toBe('Saved project');
      const count = (await state(page)).n;
      await page.locator('#project-name').click();
      await apply(page);
      expect((await state(page)).n).toBe(count);
      const toast = page.locator('#toast');
      await expect(toast).toBeVisible();
      await expect(toast).toHaveAttribute('data-position', 'top');
      await expect(toast).toContainText(
        locale === 'vi' ? 'Cập nhật định dạng thành công' : 'Formatting updated successfully',
      );
      expect((await toast.boundingBox()).y).toBeLessThan(120);
      expect(errors).toEqual([]);
      await page.screenshot({ path: 'planning/design/apply-success-' + locale + '.png' });
    },
  );
test('invalid Format stays open with no success notice or history; Canvas title/date commits close and announce', async ({
  page,
}) => {
  await setup(page);
  await openCard(page, 0, 2);
  const before = await state(page);
  await page.locator('[name=width]').fill('0');
  await page.locator('#panel-body form [type=submit]').click();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(page.locator('#toast')).not.toBeVisible();
  expect(await state(page)).toEqual(before);
  await page.locator('#cancel-draft').click();
  await page.locator('[data-action=close]').click();
  await page.locator('[data-id=kind-0] [data-overview-field=title]').click();
  await page.locator('#overview-text').fill('Canvas title');
  await page.locator('[data-overview-apply]').click();
  await expect(page.locator('#card-overview-editor')).not.toBeVisible();
  await expect(page.locator('#toast')).toHaveAttribute('data-position', 'top');
  expect((await state(page)).p.cards[0].title).toBe('Canvas title');
  await page.locator('[data-id=kind-0] .card-created-date').click();
  await page.locator('#card-date-input').fill('2026-11-01');
  await page.locator('[data-date-apply]').click();
  await expect(page.locator('#card-date-editor')).not.toBeVisible();
  await expect(page.locator('#toast')).toContainText('Cập nhật định dạng thành công');
});
