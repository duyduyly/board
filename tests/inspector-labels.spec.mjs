import { test, expect } from '@playwright/test';

// U5/U6: dock tab labels and field names are visible above the 320px container breakpoint and
// screen-reader only at or below it. Real computed styles and boxes, no hidden events.
const SINGLE_COLUMN_MAX = 320;
const MIN_CONTRAST = 4.5;

const contrastOf = (locator) =>
  locator.evaluate((el) => {
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
    let background = { r: 255, g: 255, b: 255, a: 1 };
    const chain = [];
    for (let n = el; n; n = n.parentElement) chain.push(n);
    for (const n of chain.reverse()) {
      const bg = rgba(window.getComputedStyle(n).backgroundColor);
      if (bg.a > 0) background = over(bg, background);
    }
    const lum = ({ r, g, b }) =>
      [r, g, b]
        .map((v) => v / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const [hi, lo] = [lum(rgba(window.getComputedStyle(el).color)), lum(background)].sort(
      (a, b) => b - a,
    );
    return (hi + 0.05) / (lo + 0.05);
  });

const openDock = async (page, { locale, theme, width }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  if (locale === 'en') await page.locator('#locale').selectOption('en');
  if (theme === 'dark') {
    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  }
  await page.locator('[data-id=personal-0] [data-overview-field=title]').click();
  await expect(page.locator('#format-inspector')).toBeVisible();
};

const isSrOnly = (locator) =>
  locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return (
      box.width <= 1 && box.height <= 1 && window.getComputedStyle(el).clipPath === 'inset(50%)'
    );
  });

for (const width of [1440, 1000])
  for (const theme of ['light', 'dark'])
    for (const locale of ['vi', 'en'])
      test(`dock tabs and field names are readable at ${width}px in ${locale} ${theme}`, async ({
        page,
      }) => {
        await openDock(page, { locale, theme, width });
        const dock = await page.locator('#format-inspector').evaluate((el) => el.clientWidth);
        expect(dock).toBeGreaterThan(SINGLE_COLUMN_MAX);
        const tabs = page.locator('#inspector-tabs button');
        await expect(tabs).toHaveCount(4);
        const boxes = [];
        for (const tab of await tabs.all()) {
          const label = tab.locator('.inspector-tab-label');
          await expect(label).toBeVisible();
          await expect(label).toHaveText(await tab.getAttribute('aria-label'));
          // Single line and not truncated by ellipsis.
          expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
          expect(await label.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(20);
          boxes.push(await tab.boundingBox());
        }
        expect(new Set(boxes.map((b) => Math.round(b.width))).size).toBe(1);
        expect(new Set(boxes.map((b) => Math.round(b.height))).size).toBe(1);
        expect(
          await page
            .locator('#inspector-tabs')
            .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        ).toBe(true);

        await tabs.nth(1).click();
        // R1: the typography row is icon-only; its three names are accessible names + tooltips.
        const names = [];
        for (const name of await page.locator('#inspector-text .format-property-name').all())
          if (!(await name.evaluate((el) => el.closest('.overview-style-grid')))) names.push(name);
        expect(names.length).toBeGreaterThanOrEqual(2);
        for (const name of names) {
          await expect(name).toBeVisible();
          expect(await name.evaluate((el) => window.getComputedStyle(el).fontSize)).toBe('12px');
          expect(await contrastOf(name)).toBeGreaterThanOrEqual(MIN_CONTRAST);
        }
        const expected = locale === 'vi' ? ['Mục cần sửa', 'Tags'] : ['Field', 'Tags'];
        const text = (await Promise.all(names.map((n) => n.textContent()))).join('|');
        for (const word of expected) expect(text).toContain(word);
        const typography =
          locale === 'vi'
            ? {
                '#overview-size': 'Cỡ chữ',
                '#overview-font': 'Font chữ',
                '#overview-color': 'Màu chữ',
              }
            : {
                '#overview-size': 'Font size',
                '#overview-font': 'Font family',
                '#overview-color': 'Text color',
              };
        for (const [selector, label] of Object.entries(typography)) {
          await expect(page.locator(selector)).toHaveAccessibleName(label);
          await expect(page.locator(`label[for="${selector.slice(1)}"]`)).toHaveAttribute(
            'title',
            label,
          );
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
      });

for (const width of [390, 320])
  test(`dock stays inside the viewport at ${width}px`, async ({ page }) => {
    await openDock(page, { locale: 'vi', theme: 'light', width });
    const tabs = page.locator('#inspector-tabs');
    expect(await tabs.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    for (const index of [0, 1, 2, 3]) {
      await page.locator('#inspector-tabs button').nth(index).click();
      const overflow = await page.locator('#format-inspector').evaluate(
        (el) =>
          [...el.querySelectorAll('input, select, textarea, button, label')].filter((n) => {
            const box = n.getBoundingClientRect();
            return box.width > 0 && box.right > el.getBoundingClientRect().right + 1;
          }).length,
      );
      expect(overflow).toBe(0);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

test('dock labels become screen-reader only when the dock is at or below the breakpoint', async ({
  page,
}) => {
  await openDock(page, { locale: 'vi', theme: 'light', width: 1440 });
  await page.locator('#format-inspector').evaluate((el, max) => {
    el.style.width = max + 'px';
    el.style.minWidth = '0';
    el.style.maxWidth = max + 'px';
  }, SINGLE_COLUMN_MAX);
  const tabs = page.locator('#inspector-tabs button');
  for (const tab of await tabs.all()) {
    expect(await isSrOnly(tab.locator('.inspector-tab-label'))).toBe(true);
    await expect(tab).toHaveAccessibleName(await tab.getAttribute('aria-label'));
  }
  await tabs.nth(1).click();
  const name = page.locator('#inspector-text .format-property-name').first();
  expect(await isSrOnly(name)).toBe(true);
  expect(
    await page.locator('#inspector-tabs').evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
});

test('dock fields share radius, border and background; hidden groups stay hidden', async ({
  page,
}) => {
  await openDock(page, { locale: 'vi', theme: 'light', width: 1440 });
  await page.locator('#inspector-tabs button').nth(1).click();
  const fields = page.locator('#inspector-text').locator('input[type=text], select, textarea');
  expect(await fields.count()).toBeGreaterThanOrEqual(3);
  const styles = await fields.evaluateAll((nodes) =>
    nodes.map((n) => {
      const cs = window.getComputedStyle(n);
      return [
        cs.borderTopWidth,
        cs.borderTopLeftRadius,
        cs.backgroundColor,
        cs.borderTopColor,
      ].join('|');
    }),
  );
  expect(new Set(styles).size).toBe(1);
  expect(styles[0].split('|')[0]).toBe('1px');
  expect(styles[0].split('|')[1]).toBe('8px');
  const hiddenVisible = await page
    .locator('#format-inspector')
    .evaluate(
      (el) =>
        [...el.querySelectorAll('[hidden]')].filter(
          (n) => window.getComputedStyle(n).display !== 'none',
        ).length,
    );
  expect(hiddenVisible).toBe(0);
  await page.locator('#inspector-tabs button').nth(2).click();
  const section = page.locator('#inspector-fields .format-section').first();
  expect(await section.evaluate((el) => window.getComputedStyle(el).borderTopLeftRadius)).toBe(
    '12px',
  );
});
