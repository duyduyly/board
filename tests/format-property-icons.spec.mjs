import { test, expect } from '@playwright/test';
import { projectAction } from './ui-driver.mjs';

for (const [locale, width] of [
  ['vi', 1440],
  ['en', 390],
]) {
  test(`format properties remain editable and grouped with icons in ${locale}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await page.locator('[data-template=personal]').click();
    if (locale === 'en') await page.locator('#locale').selectOption('en');
    await projectAction(page, 'inspector');
    const global = page.locator('#inspector-global');
    await expect(global.locator('fieldset.inspector-config-group')).toHaveCount(2);
    await expect(global.locator('legend .format-property-icon')).toHaveCount(2);
    await global.locator('[name=typography]').check();
    await expect(
      global.locator('label:has([name=bulk-title-fontSize]) .format-property-icon'),
    ).toBeVisible();
    await global.locator('[name=typography]').uncheck();
    await page.locator('#inspector-close').click();
    await page.locator('[data-id=personal-0] [data-overview-field=title]').click();
    await expect(
      page.locator('#inspector-text [data-label=field] .format-property-icon'),
    ).toBeVisible();
    await expect(page.locator('#overview-text')).toHaveValue('Inbox');
    await page.locator('#inspector-tabs button').nth(2).click();
    const group = page.locator('#inspector-fields details[data-format-group=displaySettings]');
    await expect(group.locator('summary .format-property-icon')).toBeVisible();
    await expect(
      group.locator('label:has([name=appearance-shape]) .format-property-icon'),
    ).toBeVisible();
    await group.locator('summary').click();
    await expect(group).not.toHaveAttribute('open', '');
    await group.locator('summary').click();
    await expect(group.locator('[name=appearance-shape]')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

test('connector properties have collapsible icon groups without changing the project', async ({
  page,
}) => {
  await page.goto('/');
  const project = {
    version: '1.0',
    metadata: { title: 'Properties' },
    cards: [
      { id: 'a', title: 'A', content: '', position: { x: 0, y: 0 } },
      { id: 'b', title: 'B', content: '', position: { x: 400, y: 0 } },
    ],
    relations: [{ id: 'r', source: 'a', target: 'b' }],
  };
  await page
    .locator('#file-input')
    .setInputFiles({
      name: 'properties.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
  await page.locator('#modal [data-choice=apply]').click();
  await page.locator('[data-action=fit]').click();
  const before = await page.evaluate(async () =>
    JSON.stringify((await import('/assets/js/app.js')).store.project),
  );
  const region = await page.locator('#canvas-region').boundingBox();
  const midpoint = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).adapter.cy.getElementById('r:r').renderedMidpoint(),
  );
  await page.mouse.click(region.x + midpoint.x, region.y + midpoint.y);
  const sections = page.locator('#inspector-fields details.inspector-relation-section');
  await expect(sections).toHaveCount(4);
  for (const section of await sections.all())
    await expect(section.locator('summary .format-property-icon')).toBeVisible();
  const route = sections.first();
  await expect(route.locator('label:has([name=edge-route]) .format-property-icon')).toBeVisible();
  await route.locator('summary').click();
  await expect(route.locator('[name=edge-route]')).toBeHidden();
  await route.locator('summary').click();
  await expect(route.locator('[name=edge-route]')).toBeVisible();
  expect(
    await page.evaluate(async () =>
      JSON.stringify((await import('/assets/js/app.js')).store.project),
    ),
  ).toBe(before);
});
