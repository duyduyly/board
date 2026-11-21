import { test, expect } from '@playwright/test';
import { theme as toggleTheme, locale } from './ui-driver.mjs';

// The Word export button sits next to "Export project" and must not push the toolbar past the viewport.
const NAMES = { vi: 'Xuất Word', en: 'Export Word' };
const ICON_ONLY_WIDTHS = [801, 820, 900, 950];
const FIT_WIDTHS = [801, 820, 900, 950, 1000, 1050, 1150, 1440];
const word = (page) => page.locator('.toolbar [data-action=export-word]');

const openProject = async (page) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await expect(page.locator('.graph-card')).toHaveCount(4);
};

test('Word export button follows Export project and is hidden on the home gallery', async ({
  page,
}) => {
  await page.goto('/');
  await expect(word(page)).toBeHidden();
  await page.locator('[data-template=personal]').click();
  await expect(page.locator('.graph-card')).toHaveCount(4);
  await expect(word(page)).toBeVisible();
  const order = await page
    .locator('.toolbar-actions > [data-action]')
    .evaluateAll((els) => els.map((el) => el.dataset.action));
  expect(order.indexOf('export-word')).toBe(order.indexOf('export') + 1);
  await page.locator('.brand').click();
  await expect(page.locator('.home-page')).toBeVisible();
  await expect(word(page)).toBeHidden();
});

for (const lang of ['vi', 'en'])
  test(`Word export button has accessible name and title in ${lang}`, async ({ page }) => {
    await openProject(page);
    await locale(page, lang);
    await expect(word(page)).toHaveAttribute('aria-label', NAMES[lang]);
    await expect(word(page)).toHaveAccessibleName(NAMES[lang]);
    expect(await word(page).getAttribute('title')).toContain('.docx');
    await expect(word(page).locator('svg')).toHaveAttribute('aria-hidden', 'true');
  });

test('Tab moves focus from Export project to the Word export button', async ({ page }) => {
  await openProject(page);
  await page.locator('.toolbar [data-action=export]').focus();
  await page.keyboard.press('Tab');
  await expect(word(page)).toBeFocused();
});

for (const width of ICON_ONLY_WIDTHS)
  for (const lang of ['vi', 'en'])
    test(`Word export label collapses to icon at ${width}px in ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openProject(page);
      await locale(page, lang);
      await expect(word(page)).toBeVisible();
      await expect(word(page).locator('.toolbar-label')).toBeHidden();
      await expect(word(page)).toHaveAccessibleName(NAMES[lang]);
    });

test('Word export label is visible above 950px', async ({ page }) => {
  await page.setViewportSize({ width: 1050, height: 800 });
  await openProject(page);
  await expect(word(page).locator('.toolbar-label')).toBeVisible();
});

for (const width of FIT_WIDTHS)
  for (const lang of ['vi', 'en'])
    for (const theme of ['light', 'dark'])
      test(`toolbar with Word export fits ${width}px in ${lang} ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await openProject(page);
        await locale(page, lang);
        if (theme === 'dark') await toggleTheme(page);
        const overflow = await page
          .locator('.toolbar')
          .evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
        expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        const box = await word(page).boundingBox();
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      });

// Chosen at 801-880px: the project name keeps 52px (about 3 characters) and the full name is on hover.
const NAME_WIDTHS = [801, 820, 850, 880];
for (const width of NAME_WIDTHS)
  for (const lang of ['vi', 'en'])
    for (const theme of ['light', 'dark'])
      test(`project name keeps 52px and a full title at ${width}px in ${lang} ${theme}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 });
        await openProject(page);
        await locale(page, lang);
        if (theme === 'dark') await toggleTheme(page);
        const name = page.locator('#project-name');
        const box = await name.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(52);
        const title = await name.getAttribute('title');
        expect(title).toContain(await name.textContent());
        expect(title).toBe(await name.getAttribute('aria-label'));
      });
