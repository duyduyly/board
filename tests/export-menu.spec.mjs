import { test, expect } from '@playwright/test';
import { theme as toggleTheme, locale } from './ui-driver.mjs';

// One Export menu holds the project (JSON), Word and Markdown exports and must not push the
// toolbar past the viewport.
const NAMES = {
  vi: {
    menu: 'Xuất',
    export: 'Xuất dự án',
    'export-word': 'Xuất Word',
    'export-markdown': 'Xuất Markdown',
  },
  en: {
    menu: 'Export',
    export: 'Export project',
    'export-word': 'Export Word',
    'export-markdown': 'Export Markdown',
  },
};
const HINTS = { export: '.json', 'export-word': '.docx', 'export-markdown': '.zip' };
const ACTIONS = ['export', 'export-word', 'export-markdown'];
const FIT_WIDTHS = [801, 820, 900, 950, 1000, 1050, 1150, 1440];
const menu = (page) => page.locator('#export-menu');
const summary = (page) => page.locator('#export-menu > summary');
const item = (page, action) => page.locator('#export-menu [data-action="' + action + '"]');

const openProject = async (page) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await expect(page.locator('.graph-card')).toHaveCount(5);
};

test('Export menu sits after Import and is hidden on the home gallery', async ({ page }) => {
  await page.goto('/');
  await expect(summary(page)).toBeHidden();
  await page.locator('[data-template=personal]').click();
  await expect(page.locator('.graph-card')).toHaveCount(5);
  await expect(summary(page)).toBeVisible();
  const order = await page
    .locator('.toolbar-actions > *')
    .evaluateAll((els) => els.map((el) => el.dataset.action || el.id));
  expect(order.indexOf('export-menu')).toBe(order.indexOf('import') + 1);
  for (const action of ACTIONS) await expect(item(page, action)).toBeHidden();
  await summary(page).click();
  const actions = await menu(page)
    .locator('[data-action]')
    .evaluateAll((els) => els.map((el) => el.dataset.action));
  expect(actions).toEqual(ACTIONS);
  await page.locator('.brand').click();
  await expect(page.locator('.home-page')).toBeVisible();
  await expect(summary(page)).toBeHidden();
});

for (const lang of ['vi', 'en'])
  test(`Export menu items have names and hints in ${lang}`, async ({ page }) => {
    await openProject(page);
    await locale(page, lang);
    await expect(summary(page)).toContainText(NAMES[lang].menu);
    await summary(page).click();
    for (const action of ACTIONS) {
      await expect(item(page, action)).toHaveAccessibleName(NAMES[lang][action]);
      await expect(item(page, action)).toHaveAccessibleDescription(
        new RegExp(HINTS[action].replace('.', '\\.')),
      );
    }
  });

test('keyboard: Enter opens the menu, Tab reaches items, Escape closes and refocuses', async ({
  page,
}) => {
  await openProject(page);
  await summary(page).focus();
  await page.keyboard.press('Enter');
  await expect(menu(page)).toHaveAttribute('open', '');
  for (const action of ACTIONS) {
    await page.keyboard.press('Tab');
    await expect(item(page, action)).toBeFocused();
  }
  await page.keyboard.press('Escape');
  await expect(menu(page)).not.toHaveAttribute('open', '');
  await expect(summary(page)).toBeFocused();
});

test('clicking outside closes the menu; the help menu and Export menu do not stay open together', async ({
  page,
}) => {
  await openProject(page);
  await summary(page).click();
  await expect(item(page, 'export')).toBeVisible();
  await page.locator('#project-menu > summary').click();
  await expect(item(page, 'export')).toBeHidden();
  await expect(page.locator('#project-menu')).toHaveAttribute('open', '');
  await summary(page).click();
  await expect(page.locator('#project-menu')).not.toHaveAttribute('open', '');
  await expect(item(page, 'export')).toBeVisible();
  // The toolbar's own left padding is an empty spot outside every control.
  await page.locator('.toolbar').click({ position: { x: 4, y: 4 } });
  await expect(item(page, 'export')).toBeHidden();
});

for (const width of FIT_WIDTHS)
  for (const lang of ['vi', 'en'])
    for (const theme of ['light', 'dark'])
      test(`toolbar and open Export menu fit ${width}px in ${lang} ${theme}`, async ({ page }) => {
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
        await summary(page).click();
        for (const action of ACTIONS) {
          await expect(item(page, action)).toBeInViewport({ ratio: 1 });
        }
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
