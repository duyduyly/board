import { test, expect } from '@playwright/test';

test('complete showcase opens from Gallery, captions and both views render offline', async ({
  page,
}) => {
  const errors = [],
    remote = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('data:'))
      remote.push(r.url());
  });
  await page.goto('/');
  await expect(page.locator('[data-template=showcase]')).toContainText('Bộ mẫu đầy đủ');
  await page.locator('#locale').selectOption('en');
  await expect(page.locator('[data-template=showcase]')).toContainText('Complete examples');
  await page.locator('[data-template=showcase]').click();
  await expect(page.locator('.graph-card')).toHaveCount(37);
  await expect(page.locator('.group-frame')).toHaveCount(6);
  await expect(page.locator('[data-id=story-0] .card-summary')).toContainText('ArrayList');
  await expect(page.locator('[data-id=story-0] h3')).toContainText('CÂU HỎI');
  const before = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { stage, serialize } = await import('/assets/js/json/validator.js');
    const roundtrip = stage(serialize(store.project));
    return { project: store.project, errors: roundtrip.errors };
  });
  expect(before.errors).toEqual([]);
  const memberships = new Map(
    before.project.extensions['card-atlas:groups'].groups.flatMap((g) =>
      g.cardIds.map((id) => [id, g.id]),
    ),
  );
  for (const edge of before.project.relations)
    expect(memberships.get(edge.source)).toBe(memberships.get(edge.target));
  expect(
    new Set(before.project.relations.map((e) => e.extensions['card-atlas:edge'].route)).size,
  ).toBe(4);
  await page.screenshot({ path: 'planning/design/showcase-start.png' });
  await page.evaluate(async () => {
    const { adapter } = await import('/assets/js/app.js');
    adapter.setViewport({ zoom: 0.5, position: { x: -1150, y: -850 } });
  });
  await page.screenshot({ path: 'planning/design/cornell-study-lab.png' });
  const view = page.locator('#map-view');
  await view.selectOption('mind');
  await expect(page.locator('.group-frame')).toHaveCount(6);
  await page.locator('#theme-toggle').click();
  await page.setViewportSize({ width: 1050, height: 900 });
  await page.screenshot({ path: 'planning/design/showcase-mind-dark.png' });
  const after = await page.evaluate(async () => (await import('/assets/js/app.js')).store.project);
  expect(after).toEqual(before.project);
  expect(errors).toEqual([]);
  expect(remote).toEqual([]);
});
