import { test, expect } from '@playwright/test';
import { locale, view } from './ui-driver.mjs';

const relCount = (page) =>
  page.evaluate(async () => (await import('/assets/js/app.js')).store.project.relations.length);
const undoCount = (page) =>
  page.evaluate(async () => (await import('/assets/js/app.js')).store.undoStack.length);

async function open(page, lang, mode) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  if (lang === 'en') await locale(page, 'en');
  await page.locator('[data-template=architecture]').click();
  if (mode === 'mind') await view(page, 'mind');
  await expect(page.locator('.graph-card[data-id]').first()).toBeVisible();
  return page.locator('.graph-card[data-id]');
}

for (const [lang, mode] of [
  ['vi', 'note'],
  ['en', 'note'],
  ['vi', 'mind'],
  ['en', 'mind'],
]) {
  test(
    'keyboard connector creates one undoable relation ' + lang + ' ' + mode,
    async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const cards = await open(page, lang, mode);
      const ids = await cards.evaluateAll((els) => els.map((e) => e.dataset.id));
      const [a, b] = ids;
      const before = await relCount(page);
      const history = await undoCount(page);
      const cardA = page.locator('.graph-card[data-id="' + a + '"]');
      const connector = cardA.locator('.connector');
      await connector.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#connect-hint')).toBeVisible();
      await expect(page.locator('#connect-hint')).toContainText(
        lang === 'vi' ? 'Chọn note đích' : 'Choose a target',
      );
      const cardB = page.locator('.graph-card[data-id="' + b + '"]');
      await cardB.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#connect-hint')).toBeHidden();
      expect(await relCount(page)).toBe(before + 1);
      expect(await undoCount(page)).toBe(history + 1);
      await page.keyboard.press('Control+z');
      await expect.poll(() => relCount(page)).toBe(before);
      expect(errors).toEqual([]);
    },
  );
}

test('Escape cancels keyboard connect; self-loop and pinned are blocked', async ({ page }) => {
  const cards = await open(page, 'vi', 'note');
  const ids = await cards.evaluateAll((els) => els.map((e) => e.dataset.id));
  const before = await relCount(page);
  const history = await undoCount(page);
  const a = page.locator('.graph-card[data-id="' + ids[0] + '"]');
  await a.locator('.connector').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#connect-hint')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#connect-hint')).toBeHidden();
  await expect(page.locator('#connection-preview')).toBeHidden();
  // self-loop
  await a.locator('.connector').focus();
  await page.keyboard.press('Enter');
  await a.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#connect-hint')).toBeHidden();
  await expect(page.locator('#toast')).toBeVisible();
  await expect(page.locator('#toast')).not.toBeEmpty();
  // pinned source disabled
  const p = page.locator('.graph-card[data-id="' + ids[1] + '"]');
  await p.locator('.card-pin').click();
  await expect(p.locator('.connector')).toBeDisabled();
  // pinned target stays blocked
  await a.locator('.connector').focus();
  await page.keyboard.press('Enter');
  await p.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#toast')).toContainText(/ghim|pinned/i);
  expect(await relCount(page)).toBe(before);
  expect(await undoCount(page)).toBe(history + 1); // only the pin toggle
});
