import { test, expect } from '@playwright/test';
import { projectAction } from './ui-driver.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 768, height: 1024 }]) {
  test(`format inspector works at ${viewport.width}px without losing a draft`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.locator('[data-template=personal]').click();
    await expect(page.locator('.workspace')).toBeVisible();
    await expect(page.locator('#canvas-region')).toBeVisible();
    const canvasBounds = await page.locator('#canvas-region').boundingBox();
    for (const button of await page.locator('.zoom-controls button').all()) {
      const box = await button.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(canvasBounds.x);
      expect(box.x + box.width).toBeLessThanOrEqual(canvasBounds.x + canvasBounds.width);
    }
    await page.screenshot({ path: join(tmpdir(), `card-atlas-workspace-${viewport.width}-${info.project.name}.png`) });
    await projectAction(page, 'inspector');
    const inspector = page.locator('#format-inspector');
    const global = page.locator('#inspector-global');
    await expect(inspector).toBeVisible();
    await global.locator('[name=typography]').check();
    await global.locator('[name=bulk-title-fontSize]').fill('23');
    await page.locator('#inspector-tabs button').nth(3).click();
    await expect(page.locator('#inspector-edge-hint')).toBeVisible();
    await page.locator('#inspector-tabs button').first().click();
    await expect(global.locator('[name=bulk-title-fontSize]')).toHaveValue('23');
    const apply = global.locator('button[type=submit]');
    await expect(apply).toBeInViewport();
    const bounds = await inspector.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: join(tmpdir(), `card-atlas-format-${viewport.width}-${info.project.name}.png`) });
    await page.locator('#inspector-close').click();
    await expect(page.locator('#modal')).toBeVisible();
    await page.locator('#modal [data-choice=discard]').click();
    await expect(inspector).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}

test.describe('touch interaction', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('opens a note and reaches card formatting using touch', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-template=personal]').tap();
    await page.locator('[data-action=fit]').tap();
    const open = page.locator('[data-id=personal-0] .card-open');
    await expect(open).toBeInViewport();
    await open.tap();
    await expect(page.locator('#detail-panel')).toBeVisible();
    await page.locator('#panel-tabs button').nth(2).tap();
    await expect(page.locator('#format-inspector')).toBeVisible();
    await expect(page.locator('#panel-body [name=width]')).toBeVisible();
    await page.locator('#panel-body [name=width]').fill('310');
    await page.locator('#panel-body [type=submit]').tap();
    const project = await page.evaluate(async () => (await import('/assets/js/app.js')).store.project);
    expect(project.cards.find((card) => card.id === 'personal-0').size.width).toBe(310);
  });
  test('opens the content editor and saves HTML on a phone viewport', async ({ page }, info) => {
    await page.goto('/');
    await page.locator('[data-template=personal]').tap();
    await page.locator('[data-action=fit]').tap();
    await page.locator('[data-id=personal-0] .card-open').tap();
    await page.locator('#panel-tabs button').nth(1).tap();
    await expect(page.locator('[data-editor-mode=visual]')).toBeEnabled();
    await page.locator('[data-editor-mode=html]').tap();
    const source = page.locator('[data-editor-source]');
    await source.fill('<p>Mobile HTML</p>');
    await page.screenshot({ path: join(tmpdir(), `card-atlas-editor-mobile-${info.project.name}.png`) });
    await page.locator('#panel-body [type=submit]').tap();
    const project = await page.evaluate(async () => (await import('/assets/js/app.js')).store.project);
    expect(project.cards.find((card) => card.id === 'personal-0').content).toContain('Mobile HTML');
  });
});
