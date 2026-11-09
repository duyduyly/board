import { test, expect } from '@playwright/test';
import { theme as toggleTheme, locale } from './ui-driver.mjs';

// Computed-style checks of the motion layer and the toolbar history buttons on the real UI.
const SECONDS = (value) =>
  value.split(',').map((part) => parseFloat(part) * (part.includes('ms') ? 0.001 : 1));
const MIN_MS = 120;
const MAX_MS = 200;
const MIN_DISABLED_CONTRAST = 3;
const NARROW = { width: 1000, height: 800 };

const openProject = async (page) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await expect(page.locator('.graph-card')).toHaveCount(4);
};
const durations = (page, selector) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const style = window.getComputedStyle(el);
      return { duration: style.transitionDuration, property: style.transitionProperty };
    });
const luminance = ([r, g, b]) =>
  [r, g, b]
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
// Effective ink (colour x ancestor opacity) over the toolbar surface, as rgb triples.
const disabledInk = (page, selector) =>
  page.locator(selector).evaluate((el) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (css) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    let opacity = 1;
    const chain = [];
    for (let n = el; n; n = n.parentElement) chain.push(n);
    for (const n of chain) opacity *= parseFloat(window.getComputedStyle(n).opacity);
    let bg = [255, 255, 255];
    for (const n of chain.reverse()) {
      const [r, g, b, a] = rgba(window.getComputedStyle(n).backgroundColor);
      if (a > 0) bg = [r, g, b].map((v, i) => v * a + bg[i] * (1 - a));
    }
    const [r, g, b, a] = rgba(window.getComputedStyle(el).color);
    const alpha = a * opacity;
    return { ink: [r, g, b].map((v, i) => v * alpha + bg[i] * (1 - alpha)), bg };
  });

for (const mode of ['light', 'dark'])
  test(`controls ease in 120-200ms and cards stay untouched in ${mode}`, async ({ page }) => {
    await openProject(page);
    if (mode === 'dark') await toggleTheme(page);
    for (const selector of [
      '[data-map-view=mind]',
      '[data-action=import]',
      '#locale',
      '#template-search, .toolbar button',
    ]) {
      const { duration, property } = await durations(page, selector);
      for (const seconds of SECONDS(duration)) {
        expect(seconds * 1000, selector).toBeGreaterThanOrEqual(MIN_MS);
        expect(seconds * 1000, selector).toBeLessThanOrEqual(MAX_MS);
      }
      expect(property, selector).not.toContain('transform');
      expect(property, selector).not.toBe('all');
    }
    const card = await durations(page, '.graph-card');
    expect(card.property).not.toContain('background-color');
    expect(card.property).not.toContain('box-shadow');
  });

test('reduced motion removes control transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openProject(page);
  for (const selector of ['[data-map-view=mind]', '[data-action=import]', '#locale']) {
    const { duration } = await durations(page, selector);
    for (const seconds of SECONDS(duration)) expect(seconds, selector).toBe(0);
  }
});

test('dragging a card adds no transition to the card or the canvas', async ({ page }) => {
  await openProject(page);
  const before = await durations(page, '.graph-card');
  const box = await page.locator('.graph-card').first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + 52, { steps: 4 });
  const during = await durations(page, '.graph-card');
  await page.mouse.up();
  expect(during).toEqual(before);
  expect((await durations(page, '#canvas-region')).property).not.toContain('transform');
});

for (const theme of ['light', 'dark'])
  test(`disabled Undo/Redo stay visible and square in ${theme}`, async ({ page }) => {
    await openProject(page);
    if (theme === 'dark') await toggleTheme(page);
    for (const action of ['undo', 'redo']) {
      const button = page.locator(`.history-buttons [data-action=${action}]`);
      await expect(button).toBeDisabled();
      // The theme swap itself eases for one transition; wait for the settled colours.
      await expect
        .poll(async () => {
          const { ink, bg } = await disabledInk(page, `.history-buttons [data-action=${action}]`);
          return contrast(ink, bg);
        }, action)
        .toBeGreaterThanOrEqual(MIN_DISABLED_CONTRAST);
      const box = await button.boundingBox();
      expect(box.width, action).toBeGreaterThanOrEqual(box.height - 1);
    }
  });

for (const lang of ['vi', 'en'])
  for (const theme of ['light', 'dark'])
    test(`toolbar fits 1000px in ${lang} ${theme}`, async ({ page }) => {
      await page.setViewportSize(NARROW);
      await openProject(page);
      await locale(page, lang);
      if (theme === 'dark') await toggleTheme(page);
      const overflow = await page
        .locator('.toolbar')
        .evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        NARROW.width,
      );
    });

// Undo/Redo must match the neighbouring toolbar buttons at every supported width, not only at 1440.
const SIZE_TOLERANCE = 1;
const HISTORY_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1000, height: 800 },
  { width: 801, height: 800 },
];
for (const viewport of HISTORY_VIEWPORTS)
  for (const lang of ['vi', 'en'])
    for (const theme of ['light', 'dark'])
      test(`Undo/Redo match neighbour height and stay square at ${viewport.width}px in ${lang} ${theme}`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await openProject(page);
        await locale(page, lang);
        if (theme === 'dark') await toggleTheme(page);
        const neighbour = await page.locator('[data-action=import]').boundingBox();
        for (const action of ['undo', 'redo']) {
          const box = await page.locator(`.history-buttons [data-action=${action}]`).boundingBox();
          expect(Math.abs(box.height - neighbour.height), `${action} height`).toBeLessThanOrEqual(
            SIZE_TOLERANCE,
          );
          expect(Math.abs(box.width - box.height), `${action} square`).toBeLessThanOrEqual(
            SIZE_TOLERANCE,
          );
          expect(Math.abs(box.y - neighbour.y), `${action} y`).toBeLessThanOrEqual(SIZE_TOLERANCE);
        }
      });
