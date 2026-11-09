import { test, expect } from '@playwright/test';

const VIEWPORT = { width: 1000, height: 800 };
const MIN_EDITOR_HEIGHT = 300;

async function openEditor(page, locale, theme) {
  await page.setViewportSize(VIEWPORT);
  await page.goto('/');
  await page.locator('#locale').selectOption(locale);
  if (theme === 'dark')
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.locator('[data-template=personal]').click();
  await expect(page.locator('[data-palette-kind=card]')).toBeEnabled();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(page.locator('#block-editor')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('.block-editor-canvas')).toBeVisible();
}

for (const locale of ['vi', 'en']) {
  for (const theme of ['light', 'dark']) {
    test(`Detail editor keeps >=300px visible at 1000x800 (${locale}, ${theme})`, async ({
      page,
    }) => {
      await openEditor(page, locale, theme);
      const metrics = await page.evaluate(() => {
        const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
        const canvas = rect('.block-editor-canvas');
        const actions = rect('#panel-body .editor-actions');
        const body = rect('#panel-body');
        const top = Math.max(canvas.top, body.top);
        const bottom = Math.min(canvas.bottom, actions.top);
        return {
          visible: bottom - top,
          actionsBottom: actions.bottom,
          actionsRight: actions.right,
          bodyScrollTop: document.querySelector('#panel-body').scrollTop,
          pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
          bodyOverflow:
            document.querySelector('#panel-body').scrollWidth >
            document.querySelector('#panel-body').clientWidth,
        };
      });
      expect(metrics.visible).toBeGreaterThanOrEqual(MIN_EDITOR_HEIGHT);
      expect(metrics.pageOverflow).toBe(false);
      expect(metrics.bodyOverflow).toBe(false);
      expect(metrics.actionsBottom).toBeLessThanOrEqual(VIEWPORT.height);
      expect(metrics.actionsRight).toBeLessThanOrEqual(VIEWPORT.width);
      const submit = page.locator('#panel-body .editor-actions button[type=submit]');
      await expect(submit).toBeInViewport();
      await expect(page.locator('#panel-body .editor-actions button').first()).toBeInViewport();
    });
  }
}

test('icon actions use the same glyph size as toolbar buttons and keep behavior', async ({
  page,
}) => {
  await openEditor(page, 'vi', 'light');
  const sizes = await page.evaluate(() => {
    const size = (element) => parseFloat(window.getComputedStyle(element).fontSize);
    return {
      toggle: size(document.querySelector('#html-writing-toggle span')),
      download: size(document.querySelector('#download-html span')),
      tool: size(document.querySelector('.block-editor-tools button')),
      mode: size(document.querySelector('.block-editor-mode button')),
    };
  });
  expect(sizes.toggle).toBe(sizes.tool);
  expect(sizes.download).toBe(sizes.tool);
  expect(sizes.mode).toBe(sizes.tool);
  await page.locator('[data-editor-mode=html]').click();
  await expect(page.locator('[data-editor-source]')).toBeVisible();
  await page.locator('[data-editor-mode=visual]').click();
  await expect(page.locator('.block-editor-canvas')).toBeVisible();
});
