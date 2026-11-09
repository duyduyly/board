import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

for (const [locale, width] of [
  ['vi', 1440],
  ['en', 390],
  ['vi', 320],
]) {
  test(`icon controls edit card and restore on Undo in ${locale} at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await page.locator('[data-template=personal]').click();
    if (locale === 'en') await page.locator('#locale').selectOption('en');
    await page.locator('[data-id=personal-0] [data-overview-field=title]').click();
    await page.locator('#inspector-tabs button').nth(2).click();
    const label = page.locator('#inspector-fields label:has([name="appearance-align"])');
    const center = label.locator('button[data-format-choice=center]');
    const picker = page.locator('#inspector-fields [name=backgroundColor]');
    const hex = page.locator('#inspector-fields [data-hex-for=backgroundColor]');
    await expect(picker).toBeVisible();
    await expect(hex).toHaveValue(/^#[0-9a-f]{6}$/i);
    expect((await center.boundingBox()).width).toBeLessThanOrEqual(40);
    expect((await picker.boundingBox()).width).toBeLessThanOrEqual(40);
    await expect(label).toHaveAttribute('title', locale === 'vi' ? 'Căn chữ' : 'Text alignment');
    await expect(label.locator('.format-property-icon')).toBeVisible();
    // U5: the name is visible above the 320px dock breakpoint and screen-reader only at or below it.
    const name = label.locator('.format-property-name');
    if (width <= 320) {
      expect(await name.evaluate((el) => window.getComputedStyle(el).clipPath)).toBe('inset(50%)');
    } else {
      await expect(name).toBeVisible();
      expect(await name.evaluate((el) => window.getComputedStyle(el).clipPath)).toBe('none');
    }
    await expect(center).toHaveAttribute('aria-pressed', 'false');
    await expect(center).toHaveAttribute('title', /.+/);
    await center.focus();
    await page.keyboard.press('Space');
    await expect(center).toHaveAttribute('aria-pressed', 'true');
    await expect(label.locator('select')).toHaveValue('center');
    await page.screenshot({
      path: join(tmpdir(), `board-format-icon-controls-${info.project.name}-${width}.png`),
    });
    await page.locator('#panel-body button[type=submit]').click();
    await expect
      .poll(async () =>
        page.evaluate(
          async () =>
            (await import('/assets/js/app.js')).store.project.cards.find(
              (c) => c.id === 'personal-0',
            ).extensions['card-atlas:appearance']?.align,
        ),
      )
      .toBe('center');
    await page.locator('#inspector-close').click();
    await page.keyboard.press('Control+z');
    await expect
      .poll(async () =>
        page.evaluate(
          async () =>
            (await import('/assets/js/app.js')).store.project.cards.find(
              (c) => c.id === 'personal-0',
            ).extensions['card-atlas:appearance']?.align || 'left',
        ),
      )
      .toBe('left');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

test('connector line and arrow icons update the existing draft and undo', async ({ page }) => {
  const project = {
    version: '1.0',
    metadata: { title: 'Icon choices' },
    cards: [
      { id: 'a', title: 'A', content: '', position: { x: 0, y: 0 } },
      { id: 'b', title: 'B', content: '', position: { x: 400, y: 0 } },
    ],
    relations: [{ id: 'r', source: 'a', target: 'b' }],
  };
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('#modal [data-choice=apply]').click();
  await page.locator('[data-action=fit]').click();
  const region = await page.locator('#canvas-region').boundingBox();
  const midpoint = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).adapter.cy.getElementById('r:r').renderedMidpoint(),
  );
  await page.mouse.click(region.x + midpoint.x, region.y + midpoint.y);
  const line = page.locator('#inspector-fields label:has([name=line])');
  const arrow = page.locator('#inspector-fields label:has([name=arrow])');
  await line.locator('[data-format-choice=dashed]').click();
  await arrow.locator('[data-format-choice=both]').click();
  await expect(line.locator('[data-format-choice=dashed]')).toHaveAttribute('aria-pressed', 'true');
  await expect(arrow.locator('[data-format-choice=both]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#panel-body button[type=submit]').click();
  await expect
    .poll(async () =>
      page.evaluate(
        async () => (await import('/assets/js/app.js')).store.project.relations[0].style,
      ),
    )
    .toMatchObject({ line: 'dashed', arrow: 'both' });
  await page.locator('#inspector-close').click();
  await page.keyboard.press('Control+z');
  await expect
    .poll(async () =>
      page.evaluate(
        async () => (await import('/assets/js/app.js')).store.project.relations[0].style.line,
      ),
    )
    .toBe('solid');
});
