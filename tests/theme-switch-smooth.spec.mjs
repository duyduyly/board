import { test, expect } from '@playwright/test';

// Theme switches must repaint controls at once (no eased colour between the two themes), and the
// control transitions must come back afterwards.
const SAMPLE_DELAYS_MS = [0, 30, 70, 150];
const SETTLE_MS = 400;
const CONTROLS = ['button[data-action=import]', '#search', '#locale'];

// Records computed background colours at fixed delays after the real toggle click.
const armSampler = (page) =>
  page.evaluate(
    ({ selectors, delays }) => {
      window.__themeSamples = [];
      document.querySelector('#theme-toggle').addEventListener(
        'click',
        () => {
          for (const delay of delays)
            setTimeout(() => {
              window.__themeSamples.push({
                delay,
                colors: selectors.map(
                  (selector) =>
                    window.getComputedStyle(document.querySelector(selector)).backgroundColor,
                ),
              });
            }, delay);
        },
        { capture: true, once: true },
      );
    },
    { selectors: CONTROLS, delays: SAMPLE_DELAYS_MS },
  );

const buttonDuration = (page) =>
  page
    .locator('button[data-action=import]')
    .evaluate((el) => window.getComputedStyle(el).transitionDuration);

for (const [from, to] of [
  ['light', 'dark'],
  ['dark', 'light'],
])
  test(`controls change colour at once when switching ${from} to ${to}`, async ({ page }) => {
    await page.goto('/');
    if (from === 'dark') {
      await page.locator('#theme-toggle').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await page.waitForTimeout(SETTLE_MS);
    }
    await armSampler(page);
    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', to);
    await page.waitForTimeout(SETTLE_MS);
    const samples = await page.evaluate(() => window.__themeSamples);
    expect(samples).toHaveLength(SAMPLE_DELAYS_MS.length);
    const final = await page.evaluate(
      (selectors) =>
        selectors.map((s) => window.getComputedStyle(document.querySelector(s)).backgroundColor),
      CONTROLS,
    );
    for (const sample of samples) expect(sample.colors, `at ${sample.delay}ms`).toEqual(final);
  });

test('theme-switching class is removed so control transitions return', async ({ page }) => {
  await page.goto('/');
  const before = await buttonDuration(page);
  expect(parseFloat(before)).toBeGreaterThan(0);
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).not.toHaveClass(/theme-switching/);
  expect(await buttonDuration(page)).toBe(before);
});

test('reduced motion keeps control transitions at zero after a theme switch', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).not.toHaveClass(/theme-switching/);
  expect(parseFloat(await buttonDuration(page))).toBe(0);
});
