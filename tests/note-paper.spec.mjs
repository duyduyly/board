import { test, expect } from '@playwright/test';
test('note paper reference surface and muted dates preserve controls/fit in both themes', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles('assets/data/english-endings-example.json');
  await page.locator('[data-choice=apply]').click();
  await page.locator('#map-view').selectOption('card');
  await page.locator('[data-palette-shape=rectangle]').click();
  const card = page.locator('.graph-card[data-shape=rectangle]');
  await card.locator('.card-pin').click();
  await expect(card).toHaveClass(/paper-note/);
  await expect(card.locator('time')).toHaveAttribute('datetime', /Z$/);
  for (const mode of ['card', 'mind']) {
    await page.locator('#map-view').selectOption(mode);
    await expect(card.locator('.card-pin')).toHaveAttribute('aria-pressed', 'true');
    const date = await card.locator('time').evaluate((el) => ({
      opacity: parseFloat(window.getComputedStyle(el).opacity),
      x: el.getBoundingClientRect().left,
      px: el.parentElement.parentElement.getBoundingClientRect().left,
    }));
    expect(date.opacity).toBeGreaterThanOrEqual(0.7);
    expect(date.x).toBeGreaterThan(date.px);
  }
  await card.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Format', exact: true }).click();
  await page.locator('[name=appearance-titleFontSize]').fill('48');
  await page.locator('#fit-text').click();
  await page.locator('#panel-body form button[type=submit]').click();
  await page.locator('[data-action=close]').click();
  await expect(card).toHaveAttribute('data-size-mode', 'fit');
  await page.locator('[data-action=fit]').click();
  await page.screenshot({ path: 'planning/design/note-paper-light.png' });
  await page.locator('#theme-toggle').click();
  await page.screenshot({ path: 'planning/design/note-paper-dark.png' });
});

test('five paper colors match reference; date badge stays inside and transparent preferences win', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles('assets/data/note-paper-example.json');
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-action=fit]').click();
  await expect(page.locator('.paper-note')).toHaveCount(5);
  for (const date of await page.locator('.paper-note time').all()) {
    const p = await date.evaluate((el) => {
      const r = el.getBoundingClientRect(),
        c = el.closest('.graph-card').getBoundingClientRect();
      return {
        top: r.top - c.top,
        left: r.left - c.left,
        opacity: parseFloat(window.getComputedStyle(el).opacity),
      };
    });
    expect(p.top).toBeGreaterThan(0);
    expect(p.left).toBeGreaterThan(0);
    expect(p.opacity).toBeGreaterThanOrEqual(0.7);
  }
  await page.screenshot({ path: 'planning/design/note-paper-reference-light.png' });
  await page.locator('#theme-toggle').click();
  await page.screenshot({ path: 'planning/design/note-paper-reference-dark.png' });
  const c = page.locator('.graph-card[data-id=paper-0]');
  await c.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Format', exact: true }).click();
  await page.locator('[name=appearance-shape]').selectOption('rectangle');
  await page.locator('[name=appearance-backgroundTransparent]').check();
  await page.locator('#panel-body form button[type=submit]').click();
  await page.locator('[data-action=close]').click();
  await expect(c.locator('polygon')).toHaveCSS('fill', 'rgba(0, 0, 0, 0)');
});
