import { test, expect } from '@playwright/test';
import { view as switchMapView } from './ui-driver.mjs';

// Measures real computed colours (WCAG 2.x) and real bounding boxes of the visible controls.
const contrastOf = (page, selector) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      const rgba = (css) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = '#000';
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return { r, g, b, a: a / 255 };
      };
      const over = (top, bottom) => {
        const a = top.a + bottom.a * (1 - top.a);
        const mix = (k) => (top[k] * top.a + bottom[k] * bottom.a * (1 - top.a)) / (a || 1);
        return { r: mix('r'), g: mix('g'), b: mix('b'), a };
      };
      let background = { r: 255, g: 255, b: 255, a: 1 },
        opacity = 1;
      const chain = [];
      for (let n = el; n; n = n.parentElement) chain.push(n);
      for (const n of chain) opacity *= parseFloat(window.getComputedStyle(n).opacity);
      for (const n of chain.reverse()) {
        const bg = rgba(window.getComputedStyle(n).backgroundColor);
        if (bg.a > 0) background = over(bg, background);
      }
      const ink = rgba(window.getComputedStyle(el).color);
      const text = over({ ...ink, a: ink.a * opacity }, background);
      const lum = ({ r, g, b }) =>
        [r, g, b]
          .map((v) => v / 255)
          .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      const [hi, lo] = [lum(text), lum(background)].sort((a, b) => b - a);
      return (hi + 0.05) / (lo + 0.05);
    });
const overlaps = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const theme of ['light', 'dark'])
  test(`muted texts keep 4.5:1 contrast in ${theme} theme`, async ({ page }) => {
    await page.goto('/');
    await page.locator('#file-input').setInputFiles('assets/data/english-endings-example.json');
    await page.locator('[data-choice=apply]').click();
    await switchMapView(page, 'card');
    await page.locator('[data-palette-shape=rectangle]').click();
    const card = page.locator('.graph-card[data-shape=rectangle]');
    await card.locator('.card-pin').click();
    await expect(card).toHaveClass(/paper-note/);
    if (theme === 'dark') {
      await page.locator('#theme-toggle').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    }
    const ratios = {
      date: await contrastOf(page, '.paper-note .card-created-date'),
      hint: await contrastOf(page, '.canvas-hint'),
      unselectedView: await contrastOf(page, '#map-view button[aria-pressed="false"]'),
    };
    console.log(theme, JSON.stringify(ratios));
    for (const [name, ratio] of Object.entries(ratios))
      expect(ratio, name).toBeGreaterThanOrEqual(4.5);
  });

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 800 },
])
  test(`toast, hint and mind banner do not overlap at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.locator('#file-input').setInputFiles('assets/data/mind-map-example.json');
    await page.locator('[data-choice=apply]').click();
    for (const mode of ['card', 'mind']) {
      await switchMapView(page, mode);
      // Bottom toast: show the real toast element exactly as feedback.js does.
      await page.evaluate(() => {
        const toast = document.querySelector('#toast');
        toast.textContent =
          'Đã xóa note “Một tiêu đề khá dài” và 3 quan hệ. Nhấn Ctrl+Z để hoàn tác.';
        toast.dataset.position = 'bottom';
        toast.hidden = false;
      });
      const zoom = await page.locator('.zoom-controls').boundingBox();
      const toast = await page.locator('#toast').boundingBox();
      expect(overlaps(toast, zoom), mode + ' toast vs zoom').toBe(false);
      const hint = page.locator('.canvas-hint');
      const banner = page.locator('#mind-view-banner');
      if ((await hint.isVisible()) && (await banner.isVisible()))
        expect(
          overlaps(await hint.boundingBox(), await banner.boundingBox()),
          mode + ' hint vs banner',
        ).toBe(false);
      if (mode === 'mind') await expect(banner).toBeVisible();
    }
  });

test('convert dialog label keeps a gap above its select', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-map-view=mind]').click();
  const select = page.locator('#mind-convert-root');
  await expect(select).toBeVisible();
  const label = await select.evaluate((el) => {
    const l = el.closest('label');
    const range = document.createRange();
    range.selectNodeContents(l.firstChild);
    return range.getBoundingClientRect().bottom;
  });
  expect((await select.boundingBox()).y - label).toBeGreaterThanOrEqual(6);
});

for (const theme of ['light', 'dark'])
  test(`detail edit action bar is an opaque bar flush with the scroll edge in ${theme}`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('[data-template=personal]').click();
    await page.locator('[data-palette-kind=card]').click();
    await page.keyboard.press('Enter');
    await page.locator('#panel-tabs button').nth(1).click();
    await page.locator('[data-editor-mode=html]').click();
    await page
      .locator('[data-editor-source]')
      .fill('<h1>T</h1>' + '<p>Long paragraph text for scroll.</p>'.repeat(80));
    await page.locator('[data-editor-mode=visual]').click();
    if (theme === 'dark') await page.locator('#detail-theme').click();
    const bar = await page
      .locator('#panel-body .editor-actions:has([type=submit])')
      .evaluate((el) => {
        const cs = window.getComputedStyle(el);
        const body = el.closest('.panel-body').getBoundingClientRect();
        return {
          position: cs.position,
          alpha: cs.backgroundColor.startsWith('rgba') ? 0 : 1,
          border: cs.borderTopWidth,
          gap: body.bottom - el.getBoundingClientRect().bottom,
        };
      });
    expect(bar.position).toBe('sticky');
    expect(bar.alpha).toBe(1);
    expect(bar.border).toBe('1px');
    expect(bar.gap).toBeLessThanOrEqual(1);
  });
