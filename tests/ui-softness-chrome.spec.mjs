import { test, expect } from '@playwright/test';
import { locale, theme } from './ui-driver.mjs';

// T01 softness: chrome uses one symmetric radius scale and soft shadows; colours and cards stay untouched.
const SCALE = { xs: 4, sm: 6, md: 8, segment: 11, lg: 12, xl: 14 };
const HARD_SHADOW = /\) -?[\d.]+px -?[\d.]+px 0px/; // computed "<colour> x y blur spread" with blur 0

const radiusOf = (locator) =>
  locator.evaluate((el) => {
    const cs = window.getComputedStyle(el);
    return [
      cs.borderTopLeftRadius,
      cs.borderTopRightRadius,
      cs.borderBottomRightRadius,
      cs.borderBottomLeftRadius,
    ];
  });

async function expectSymmetric(locator, px, name) {
  const corners = await radiusOf(locator);
  for (const c of corners) expect(c, name).toBe(px + 'px');
}

for (const colorTheme of ['light', 'dark'])
  test(`chrome radius scale and soft shadows (${colorTheme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    if (colorTheme === 'dark') await theme(page);
    const root = await page.evaluate(() => {
      const cs = window.getComputedStyle(document.documentElement);
      return {
        sketch: cs.getPropertyValue('--sketch-radius').trim(),
        md: cs.getPropertyValue('--radius-md').trim(),
        pencil: cs.getPropertyValue('--pencil-shadow').trim(),
        surface: cs.getPropertyValue('--surface-shadow').trim(),
      };
    });
    expect(root.md).toBe(SCALE.md + 'px');
    expect(root.sketch).toBe(SCALE.md + 'px');
    // The card shadow token keeps its hard offset on purpose.
    expect(root.pencil).toMatch(/^3px 4px 0 /);
    expect(root.surface).not.toMatch(/ 0 #/);

    await page.locator('#file-input').setInputFiles('assets/data/mind-map-example.json');
    await page.locator('[data-choice=apply]').click();
    const help = page.locator('.toolbar-actions .quick-help-button');
    await expectSymmetric(help, 999, 'help button is a pill');
    await expectSymmetric(page.locator('#map-view'), SCALE.segment, 'view switch');
    await expectSymmetric(page.locator('#map-view button').first(), SCALE.sm, 'view button');
    await expectSymmetric(page.locator('.zoom-controls'), SCALE.lg, 'zoom bar');
    expect(
      await page.locator('.zoom-controls').evaluate((e) => window.getComputedStyle(e).boxShadow),
    ).not.toMatch(HARD_SHADOW);

    await page.locator('#project-menu > summary').click();
    const body = page.locator('.project-menu-body');
    await expectSymmetric(body, SCALE.lg, 'menu body');
    expect(await body.evaluate((e) => window.getComputedStyle(e).boxShadow)).not.toMatch(
      HARD_SHADOW,
    );
    await page.keyboard.press('Escape');

    await page.locator('.graph-card').first().focus();
    await page.keyboard.press('Enter');
    const detail = page.locator('#detail-panel');
    await expect(detail).toBeVisible();
    const sheet = await detail.evaluate((e) => {
      const cs = window.getComputedStyle(e);
      return { radius: cs.borderTopLeftRadius, shadow: cs.boxShadow };
    });
    expect(sheet.radius).toBe(SCALE.xl + 'px');
    expect(sheet.shadow).not.toMatch(HARD_SHADOW);
  });

test('card shadow and authored geometry are untouched', async ({ page }) => {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles('assets/data/mind-map-example.json');
  await page.locator('[data-choice=apply]').click();
  const shadow = await page
    .locator('.graph-card.paper-note')
    .first()
    .evaluate((e) => window.getComputedStyle(e).boxShadow);
  if (shadow !== 'none') expect(shadow).toMatch(HARD_SHADOW);
});

test('field focus shows a single frame, buttons keep a 2px offset', async ({ page }) => {
  await page.goto('/');
  const search = page.locator('#template-search');
  await search.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(search).toBeFocused();
  expect(await search.evaluate((e) => window.getComputedStyle(e).outlineOffset)).toBe('0px');
  const button = page.locator('.toolbar button').first();
  await button.focus();
  // Tab forward then back: Shift+Tab from the very first control leaves the page in Firefox.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(button).toBeFocused();
  expect(await button.evaluate((e) => window.getComputedStyle(e).outlineOffset)).toBe('2px');
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 800 },
])
  for (const lang of ['vi', 'en'])
    for (const colorTheme of ['light', 'dark'])
      test(`no horizontal overflow ${viewport.width}px ${lang} ${colorTheme}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto('/');
        await locale(page, lang);
        if (colorTheme === 'dark') await theme(page);
        await page.locator('#file-input').setInputFiles('assets/data/mind-map-example.json');
        await page.locator('[data-choice=apply]').click();
        const overflow = () =>
          page.evaluate(() => ({
            page: document.documentElement.scrollWidth > window.innerWidth,
            toolbar: (() => {
              const t = document.querySelector('.toolbar');
              return t.scrollWidth > t.clientWidth + 1;
            })(),
          }));
        expect(await overflow()).toEqual({ page: false, toolbar: false });
        await page.locator('#project-menu > summary').click();
        const box = await page.locator('.project-menu-body').boundingBox();
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(await overflow()).toEqual({ page: false, toolbar: false });
      });
