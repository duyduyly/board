import { test, expect } from '@playwright/test';

test('ChatGPT shortcut hides and restores without changing project, history or session storage', async ({
  page,
}) => {
  const errors = [];
  const external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173')) external.push(r.url());
  });
  await page.goto('/');
  await expect(page.locator('#chatgpt-launcher')).not.toBeVisible();
  await page.locator('[data-template=architecture]').click();
  const state = () =>
    page.evaluate(async () => {
      const { store } = await import('/assets/js/app.js');
      return JSON.stringify({
        project: store.project,
        undo: store.undoStack.length,
        redo: store.redoStack.length,
        dirty: store.dirty,
        local: { ...localStorage },
        session: { ...sessionStorage },
      });
    });
  const before = await state();
  await page.locator('#chatgpt-hide').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#chatgpt-launcher')).toBeHidden();
  await expect(page.locator('#project-menu > summary')).toBeFocused();
  await page.locator('#project-menu > summary').click();
  await expect(page.locator('#chatgpt-visible')).not.toBeChecked();
  await page.locator('#chatgpt-visible').check();
  await expect(page.locator('#chatgpt-launcher')).toBeVisible();
  await page.locator('#project-menu > summary').click();
  await page.locator('#locale').selectOption('en');
  await expect(page.locator('#chatgpt-open')).toHaveAccessibleName(
    'Open ChatGPT in a separate window',
  );
  await page.locator('#theme-toggle').click();
  await page.setViewportSize({ width: 1050, height: 900 });
  const bounds = await page.locator('#chatgpt-launcher').boundingBox();
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(1050);
  expect(bounds.y).toBeGreaterThan(72);
  expect(bounds.y + bounds.height).toBeLessThan(800);
  await page.screenshot({ path: 'planning/design/chatgpt-dark-1050.png' });
  await expect(page.locator('#graph')).toBeVisible();
  expect(await state()).toBe(before);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  await page.reload();
  await page.locator('[data-template=architecture]').click();
  await expect(page.locator('#chatgpt-launcher')).toBeVisible();
});

test('ChatGPT opens isolated external window and menu offers normal tab fallback', async ({
  page,
  context,
}) => {
  const requests = [];
  await context.route('https://chatgpt.com/**', async (route) => {
    requests.push({ url: route.request().url(), referer: route.request().headers().referer });
    await route.fulfill({
      contentType: 'text/html',
      body: '<title>External destination test</title><h1>External destination test</h1>',
    });
  });
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  await page.screenshot({ path: 'planning/design/chatgpt-light-1440.png' });
  // Observe the real window.open call while retaining browser behavior.
  await page.evaluate(() => {
    const original = window.open;
    window.open = (...args) => {
      window.chatgptOpenArgs = args;
      return original.apply(window, args);
    };
  });
  const opened = context.waitForEvent('page');
  await page.locator('#chatgpt-open').focus();
  await page.keyboard.press('Enter');
  const popup = await opened;
  await popup.waitForLoadState();
  expect(popup.url()).toBe('https://chatgpt.com/');
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  const args = await page.evaluate(() => window.chatgptOpenArgs);
  expect(args[2]).toContain('popup,noopener,noreferrer,resizable=yes');
  expect(requests).toEqual([{ url: 'https://chatgpt.com/', referer: undefined }]);
  await popup.close();
  // Simulate a blocked popup, then use the visible native-link fallback.
  await page.evaluate(() => {
    window.open = () => null;
  });
  await page.locator('#chatgpt-open').click();
  await page.locator('#project-menu > summary').click();
  const link = page.locator('.chatgpt-settings > a');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await page.screenshot({ path: 'planning/design/chatgpt-menu.png' });
  const tabOpened = context.waitForEvent('page');
  await link.click();
  const tab = await tabOpened;
  await tab.waitForLoadState();
  expect(tab.url()).toBe('https://chatgpt.com/');
  expect(await tab.evaluate(() => window.opener)).toBeNull();
  await tab.close();
});
