import { test, expect } from '@playwright/test';

const GROUPS = {
  vi: ['Hướng dẫn', 'Công cụ dự án', 'Phiên làm việc'],
  en: ['Guide', 'Project tools', 'Session'],
};
const ACTIONS = {
  'menu-group-help': ['help', 'format'],
  'menu-group-project': ['inspector', 'convert-mind', 'auto-route-all'],
  'menu-group-session': ['recovery'],
};

async function openMenu(page) {
  await page.locator('#quick-help').click();
  await expect(page.locator('#project-menu')).toHaveJSProperty('open', true);
}

test('help menu groups controls under translated headings without changing actions', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  for (const loc of ['vi', 'en']) {
    await page.locator('#locale').selectOption(loc);
    if (!(await page.locator('#project-menu').evaluate((e) => e.open))) await openMenu(page);
    await expect(page.locator('#project-menu section.menu-group')).toHaveCount(3);
    await expect(page.locator('#project-menu .menu-group-title')).toHaveText(GROUPS[loc]);
    for (const [id, actions] of Object.entries(ACTIONS)) {
      const section = page.locator(`section[aria-labelledby="${id}"]`);
      const got = await section
        .locator('button[data-action]')
        .evaluateAll((els) => els.map((e) => e.dataset.action));
      expect(got).toEqual(actions);
    }
    await expect(page.locator('#project-menu a[href^="https://chatgpt.com"]')).toHaveCount(1);
    await expect(page.locator('#project-menu button')).toHaveCount(6);
  }
});

test('Escape closes the menu and returns focus to the help button', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  await openMenu(page);
  await page.locator('[data-action=help]').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#modal')).not.toBeVisible();
  await expect(page.locator('#quick-help')).toBeFocused();
});

for (const theme of ['light', 'dark']) {
  test(`menu fits at 1000x800 in ${theme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.goto('/');
    await page.locator('[data-template=architecture]').click();
    if ((await page.locator('html').getAttribute('data-theme')) !== theme)
      await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await openMenu(page);
    const body = page.locator('#project-menu .project-menu-body');
    const box = await body.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1000);
    expect(box.y + box.height).toBeLessThanOrEqual(800);
    const overflowX = await body.evaluate((e) => e.scrollWidth > e.clientWidth);
    expect(overflowX).toBe(false);
    const titleColor = await page
      .locator('.menu-group-title')
      .first()
      .evaluate((e) => window.getComputedStyle(e).color);
    const bg = await body.evaluate((e) => window.getComputedStyle(e).backgroundColor);
    expect(titleColor).not.toBe(bg);
  });
}
