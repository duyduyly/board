import { test, expect } from '@playwright/test';

// R1: size, font, color and reset share one compact row. Names are accessible names + tooltips.
const NAMES = {
  vi: { size: 'Cỡ chữ', font: 'Font chữ', color: 'Màu chữ', reset: 'Đặt lại định dạng mục này' },
  en: {
    size: 'Font size',
    font: 'Font family',
    color: 'Text color',
    reset: 'Reset this field style',
  },
};
const CONTROLS = ['#overview-size', '#overview-font', '#overview-color', '[data-overview-reset]'];
const ROW_TOLERANCE = 6;

const openDock = async (page, { locale, theme }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  if (locale === 'en') await page.locator('#locale').selectOption('en');
  if (theme === 'dark') {
    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  }
  await page.locator('[data-id=personal-0] [data-overview-field=title]').click();
  await expect(page.locator('#format-inspector')).toBeVisible();
  await expect(page.locator('#overview-size')).toBeVisible();
};

const rects = (page) =>
  page.evaluate(
    (selectors) => selectors.map((s) => document.querySelector(s).getBoundingClientRect().toJSON()),
    CONTROLS,
  );

const expectOneRow = async (page) => {
  const boxes = await rects(page);
  const centers = boxes.map((b) => b.top + b.height / 2);
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(ROW_TOLERANCE);
  for (let i = 1; i < boxes.length; i++) expect(boxes[i].left).toBeGreaterThan(boxes[i - 1].left);
};

for (const theme of ['light', 'dark'])
  for (const locale of ['vi', 'en'])
    test(`typography row is one row with accessible names in ${locale} ${theme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openDock(page, { locale, theme });
      const dock = await page.locator('#format-inspector').evaluate((el) => el.clientWidth);
      expect(dock).toBeGreaterThan(320);
      const n = NAMES[locale];
      await expect(page.locator('#overview-size')).toHaveAccessibleName(n.size);
      await expect(page.locator('#overview-font')).toHaveAccessibleName(n.font);
      await expect(page.locator('#overview-color')).toHaveAccessibleName(n.color);
      await expect(page.locator('[data-overview-reset]')).toHaveAccessibleName(n.reset);
      await expect(page.locator('label[for=overview-size]')).toHaveAttribute('title', n.size);
      await expect(page.locator('[data-overview-reset]')).toHaveAttribute('title', n.reset);
      for (const key of ['size', 'font', 'color'])
        await expect(
          page.locator(`label[for=overview-${key}] .format-property-icon`),
        ).toBeVisible();
      await expectOneRow(page);
      const overflow = await page
        .locator('.overview-style-grid')
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

test('typography row does not overflow a 320px dock and Tab order is size, font, color, reset', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openDock(page, { locale: 'vi', theme: 'light' });
  await page.locator('#format-inspector').evaluate((el) => {
    el.style.width = '320px';
    el.style.minWidth = '0';
    el.style.maxWidth = '320px';
  });
  await expect
    .poll(() => page.locator('#format-inspector').evaluate((el) => el.clientWidth))
    .toBeLessThanOrEqual(320);
  await expectTextFits(page);
  const overflow = await page.evaluate(() => {
    const dock = document.querySelector('#format-inspector').getBoundingClientRect();
    return [
      ...document.querySelectorAll(
        '.overview-style-grid > *, .overview-style-grid input, .overview-style-grid select, [data-overview-reset]',
      ),
    ].filter((n) => n.getBoundingClientRect().right > dock.right + 1).length;
  });
  expect(overflow).toBe(0);
  await page.locator('#overview-size').focus();
  for (const selector of CONTROLS.slice(1)) {
    await page.keyboard.press('Tab');
    await expect(page.locator(selector)).toBeFocused();
  }
});

test('size outside 8-72 is blocked, in-range size applies in one Undo step, reset clears it', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openDock(page, { locale: 'en', theme: 'light' });
  const title = page.locator('.graph-card[data-id=personal-0] h3');
  const apply = page.locator('[data-overview-apply]');
  const before = await title.evaluate((el) => window.getComputedStyle(el).fontSize);
  await page.locator('#overview-size').fill('73');
  await expect(page.locator('#overview-size')).toHaveJSProperty('validity.rangeOverflow', true);
  await expect(apply).toBeDisabled();
  await page.locator('#overview-size').fill('7');
  await expect(apply).toBeDisabled();
  await page.locator('#overview-size').fill('26');
  await page.locator('#overview-font').selectOption('mono');
  await page.locator('#overview-color').fill('#884422');
  await page.locator('#overview-color').dispatchEvent('input');
  await apply.click();
  await expect(title).toHaveCSS('font-size', '26px');
  await expect(title).toHaveCSS('color', 'rgb(136, 68, 34)');
  await page.locator('[data-action=undo]').first().click();
  await expect(title).toHaveCSS('font-size', before);
  await expect(title).not.toHaveCSS('color', 'rgb(136, 68, 34)');
});

const SELECT_ARROW = 20;

const expectTextFits = async (page) => {
  const clipped = await page.evaluate((SELECT_ARROW) => {
    const canvas = document.createElement('canvas').getContext('2d');
    return ['#overview-size', '#overview-font'].flatMap((selector) => {
      const el = document.querySelector(selector);
      const style = window.getComputedStyle(el);
      canvas.font = style.font;
      const text =
        selector === '#overview-size'
          ? el.value || el.placeholder
          : el.selectedOptions[0].textContent;
      // A native select also reserves room for its arrow.
      const arrow = el.tagName === 'SELECT' ? SELECT_ARROW : 0;
      // Edge and Firefox report a smaller clientWidth for number inputs even though the text renders in full
      // (checked with screenshots), so inputs are measured from the border box instead.
      const box =
        el.tagName === 'INPUT'
          ? el.offsetWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth)
          : el.clientWidth;
      const room = box - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - arrow;
      return canvas.measureText(text).width <= room ? [] : [selector + ':' + text];
    });
  }, SELECT_ARROW);
  expect(clipped).toEqual([]);
};

for (const theme of ['light', 'dark'])
  for (const locale of ['vi', 'en'])
    test(`typography values and placeholder are not clipped and controls have hover titles in ${locale} ${theme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openDock(page, { locale, theme });
      // An empty size shows the localized default placeholder, the widest text of this field.
      await page.locator('#overview-size').fill('');
      await expect(page.locator('#overview-size')).toHaveAttribute('placeholder', /.+/);
      await expectTextFits(page);
      const n = NAMES[locale];
      await expect(page.locator('#overview-size')).toHaveAttribute('title', n.size);
      await expect(page.locator('#overview-font')).toHaveAttribute('title', n.font);
      await expect(page.locator('#overview-color')).toHaveAttribute('title', n.color);
      await expect(page.locator('[data-overview-reset]')).toHaveAttribute('title', n.reset);
    });
