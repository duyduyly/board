import { test, expect } from '@playwright/test';

// Collapsed branch toggle (Mind Map): clearer presentation, same geometry and behaviour.
// Geometry constants were measured on the tree before change 06 (root toggle of
// assets/data/mind-map-example.json at 1440x900, fit zoom): bbox relative to its card.
const OPEN_BOX = { dx: -9, dy: 59, w: 22, h: 22 };
const COLLAPSED_BOX = { dx: -9, dy: 59, w: 29.63, h: 22 };
const BOX_TOLERANCE = 0.5;
const MIN_TEXT_CONTRAST = 4.5;
// Width follows the text (22px for the minus sign, 29.63px for +10), so the bbox checks cover it.
const UNCHANGED_PROPS = [
  'height',
  'padding',
  'fontSize',
  'lineHeight',
  'borderWidth',
  'left',
  'top',
  'transform',
];

const luminance = ([r, g, b]) =>
  [r, g, b]
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const openMind = async (page, locale, theme) => {
  await page.goto('/');
  await page.locator('#locale').selectOption(locale);
  await page.evaluate((value) => {
    document.documentElement.dataset.theme = value;
  }, theme);
  await page.locator('#file-input').setInputFiles('assets/data/mind-map-example.json');
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-map-view=mind]').click();
  await expect(page.locator('.branch-toggle').first()).toBeVisible();
};
const rootToggle = (page) => page.locator('.branch-toggle').first();
const measure = (toggle) =>
  toggle.evaluate((el, props) => {
    const rect = el.getBoundingClientRect();
    const card = el.closest('.graph-card').getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return {
      box: { dx: rect.x - card.x, dy: rect.y - card.y, w: rect.width, h: rect.height },
      style: Object.fromEntries(props.map((name) => [name, style[name]])),
      text: el.textContent,
      expanded: el.getAttribute('aria-expanded'),
      label: el.getAttribute('aria-label'),
    };
  }, UNCHANGED_PROPS);
const expectBox = (actual, expected) => {
  for (const key of Object.keys(expected))
    expect(Math.abs(actual[key] - expected[key])).toBeLessThanOrEqual(BOX_TOLERANCE);
};

for (const locale of ['vi', 'en'])
  for (const theme of ['light', 'dark'])
    test(`Collapsed branch toggle is distinct but keeps geometry ${locale} ${theme}`, async ({
      page,
    }) => {
      await openMind(page, locale, theme);
      const toggle = rootToggle(page);
      const card = page.locator('.graph-card.root-node');
      const transition = await card.evaluate(
        (el) => window.getComputedStyle(el).transitionDuration,
      );
      await page.mouse.move(700, 600);
      const open = await measure(toggle);
      expect(open.expanded).toBe('true');
      expectBox(open.box, OPEN_BOX);
      const openLook = await toggle.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return { background: style.backgroundColor, shadow: style.boxShadow };
      });

      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await page.mouse.move(700, 600);
      const collapsed = await measure(toggle);
      expect(collapsed.text).toMatch(/^\+\d+$/);
      expect(collapsed.label).toContain(collapsed.text.slice(1));
      expectBox(collapsed.box, COLLAPSED_BOX);
      expect(collapsed.style).toEqual(open.style);
      expect(await card.evaluate((el) => window.getComputedStyle(el).transitionDuration)).toBe(
        transition,
      );

      const look = await toggle.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return { background: style.backgroundColor, shadow: style.boxShadow };
      });
      expect(look.background).not.toBe(openLook.background);
      expect(look.shadow).not.toBe('none');
      expect(look.shadow).not.toBe(openLook.shadow);
      await page.screenshot({ path: test.info().outputPath(`collapsed-${locale}-${theme}.png`) });
    });

for (const theme of ['light', 'dark'])
  test(`Collapsed toggle text keeps AA contrast on every branch colour ${theme}`, async ({
    page,
  }) => {
    await openMind(page, 'vi', theme);
    // Probes mirror the collapsed toggle inside each card so every branch colour is covered.
    const results = await page.evaluate(() => {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      const rgb = (css) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      return [...document.querySelectorAll('.graph-card')]
        .filter((card) => card.querySelector('.branch-toggle'))
        .map((card) => {
          const probe = document.createElement('button');
          probe.className = 'branch-toggle';
          probe.setAttribute('aria-expanded', 'false');
          probe.textContent = '+9';
          card.append(probe);
          const style = window.getComputedStyle(probe);
          const result = { bg: rgb(style.backgroundColor), ink: rgb(style.color) };
          probe.remove();
          return result;
        });
    });
    expect(results.length).toBeGreaterThan(1);
    for (const { bg, ink } of results)
      expect(contrast(ink, bg)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

// Focus button (zoom bar, no border): the pressed state must show a ring without changing its box.
for (const theme of ['light', 'dark'])
  test(`Focus button pressed shows an inset ring and keeps its box ${theme}`, async ({ page }) => {
    await openMind(page, 'vi', theme);
    await page.locator('.graph-card.root-node').click();
    const focus = page.locator('[data-action=focus]');
    const read = () =>
      focus.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          box: [rect.x, rect.y, rect.width, rect.height],
          shadow: style.boxShadow,
          pressed: el.getAttribute('aria-pressed'),
        };
      });
    await page.mouse.move(700, 600);
    const off = await read();
    expect(off.pressed).toBe('false');
    await focus.click();
    await page.mouse.move(700, 600);
    const on = await read();
    expect(on.pressed).toBe('true');
    expect(on.shadow).toContain('inset');
    expect(on.shadow).not.toBe(off.shadow);
    expect(on.box).toEqual(off.box);
  });
