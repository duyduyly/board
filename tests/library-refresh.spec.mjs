import { view as switchMapView } from './ui-driver.mjs';
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
test('all refreshed library templates open in their intended view and Mind templates share content', async ({
  page,
}) => {
  const catalog = JSON.parse(await fs.readFile('assets/data/template-catalog.json', 'utf8'));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const item of catalog) {
    await page.goto('/');
    if (item.category === 'mind') await page.locator('[data-category=mind]').click();
    await page.locator('[data-template="' + item.id + '"]').click();
    const source = JSON.parse(await fs.readFile(item.path, 'utf8'));
    await expect(page.locator('.graph-card')).toHaveCount(source.cards.length);
    await expect(page.locator('#map-view')).toHaveAttribute(
      'data-active-view',
      item.view || 'card',
    );
    if (item.view === 'mind') {
      await expect(page.locator('.paper-note')).toHaveCount(0);
      const curves = await page.evaluate(async () =>
        (await import('/assets/js/app.js')).adapter.cy.edges().map((e) => e.style('curve-style')),
      );
      expect(curves.every((c) => c === 'unbundled-bezier')).toBe(true);
      await switchMapView(page, 'card');
      await expect(page.locator('.graph-card')).toHaveCount(source.cards.length);
    }
  }
  await page.goto('/');
  await page.locator('[data-category=mind]').click();
  await expect(page.locator('.template-tile')).toHaveCount(3);
  await page.locator('#locale').selectOption('en');
  await page.locator('#template-search').fill('knowledge');
  await expect(page.locator('.template-tile')).toHaveCount(1);
  await page.screenshot({ path: 'planning/design/mind-templates-gallery.png' });
  await page.locator('[data-template=mind-knowledge]').click();
  await expect(page.locator('#map-view')).toHaveAttribute('data-active-view', 'mind');
  await expect
    .poll(() => page.evaluate(async () => (await import('/assets/js/app.js')).adapter.cy.zoom()))
    .toBeLessThan(1);
  await page.screenshot({ path: 'planning/design/mind-knowledge-template.png' });
  expect(errors).toEqual([]);
});
