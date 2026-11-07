import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const snapshot = (page) =>
  page.evaluate(async () => JSON.stringify((await import('/assets/js/app.js')).store.project));
const project = {
  version: '1.0',
  metadata: { title: 'Mobile formatting' },
  cards: [
    { id: 'a', title: 'A', content: '', position: { x: 0, y: 0 } },
    { id: 'b', title: 'B', content: '', position: { x: 400, y: 0 } },
    {
      id: 'p',
      title: 'Pinned',
      content: '',
      position: { x: 800, y: 0 },
      extensions: { 'card-atlas:metadata': { pinned: true } },
    },
  ],
  relations: [
    { id: 'r', source: 'a', target: 'b' },
    { id: 'locked', source: 'b', target: 'p' },
  ],
};

async function loadProject(page) {
  await page.goto('/');
  await page
    .locator('#file-input')
    .setInputFiles({
      name: 'mobile.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(project)),
    });
  await page.locator('#modal [data-choice=apply]').tap();
  await page.locator('[data-action=fit]').tap();
}

test('text draft cancel and uniform apply respect pinned cards', async ({ page }) => {
  await loadProject(page);
  const before = await snapshot(page);
  await page.locator('[data-id=a] .card-open').tap();
  await page.locator('#panel-tabs button').nth(2).tap();
  await page.locator('#inspector-tabs button').nth(1).tap();
  await page.locator('#overview-text').fill('Cancelled title');
  await page.locator('[data-overview-cancel]').tap();
  expect(await snapshot(page)).toBe(before);
  await page.locator('#inspector-tabs button').nth(1).tap();
  await page.locator('#overview-text').fill('Updated title');
  await page.locator('#overview-size').fill('23');
  await page.locator('#overview-uniform').check();
  await page.locator('[data-overview-apply]').tap();
  const result = await page.evaluate(async () => (await import('/assets/js/app.js')).store.project);
  expect(result.cards[0].title).toBe('Updated title');
  expect(result.cards[1].extensions['card-atlas:typography'].title.fontSize).toBe(23);
  expect(result.cards[2].extensions?.['card-atlas:typography']).toBeUndefined();
});

test('unlocked connector routing applies and undoes on mobile', async ({ page }) => {
  await loadProject(page);
  const before = await snapshot(page);
  const region = await page.locator('#canvas-region').boundingBox();
  const midpoint = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).adapter.cy.getElementById('r:r').renderedMidpoint(),
  );
  await page.touchscreen.tap(region.x + midpoint.x, region.y + midpoint.y);
  await expect(page.locator('[name=edge-route]')).toBeVisible();
  await page.locator('[name=edge-route]').selectOption('zigzag');
  await page.locator('#panel-body button[type=submit]').tap();
  expect(
    await page.evaluate(
      async () =>
        (await import('/assets/js/app.js')).store.project.relations[0].extensions['card-atlas:edge']
          .route,
    ),
  ).toBe('zigzag');
  await page.locator('#inspector-close').tap();
  await page.keyboard.press('Control+z');
  expect(await snapshot(page)).toBe(before);
});
