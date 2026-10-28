import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const state = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return { p: store.project, n: store.undoStack.length };
  });
for (const route of ['curved', 'orthogonal'])
  test(
    'manual ' + route + ' drag, cancellation, keyboard, reset and view separation',
    async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto('/');
      const cards = [
        ['a', 50],
        ['b', 750],
        ['obstacle', 400],
      ].map(([id, x]) => ({
        id,
        title: id,
        position: { x, y: 220 },
        size: { width: 180, height: 120 },
      }));
      const p = {
        version: '1.0',
        cards,
        relations: [
          {
            id: 'r',
            source: 'a',
            target: 'b',
            label: 'link',
            extensions: { 'card-atlas:edge': { route } },
          },
        ],
      };
      await page.locator('#file-input').setInputFiles({
        name: 'edge.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(p)),
      });
      await page.locator('[data-choice=apply]').click();
      const region = await page.locator('#canvas-region').boundingBox();
      const point = await page.evaluate(async () => {
        const { adapter } = await import('/assets/js/app.js');
        return adapter.cy.getElementById('r:r').renderedSourceEndpoint();
      });
      await page.mouse.click(region.x + point.x + 30, region.y + point.y);
      await page.locator('[data-action=edge-adjust]').click();
      const handle = page.locator('.edge-adjust-handle');
      await expect(handle).toBeVisible();
      const initial = await state(page);
      let box = await handle.boundingBox();
      await page.mouse.move(box.x + 12, box.y + 12);
      await page.mouse.down();
      await page.mouse.move(box.x + 12, box.y - 180, { steps: 6 });
      expect((await state(page)).n).toBe(initial.n);
      await page.keyboard.press('Escape');
      await page.mouse.up();
      expect(await state(page)).toEqual(initial);
      box = await handle.boundingBox();
      await page.mouse.move(box.x + 12, box.y + 12);
      await page.mouse.down();
      await page.mouse.move(box.x + 12, box.y - 200, { steps: 6 });
      await page.mouse.up();
      const moved = await state(page);
      expect(moved.n).toBe(initial.n + 1);
      expect(moved.p.relations[0].extensions['card-atlas:edge'].adjustments.card).toBeLessThan(0);
      if (route === 'orthogonal') {
        const points = await page.evaluate(async () => {
          const { adapter } = await import('/assets/js/app.js');
          const e = adapter.cy.getElementById('r:r');
          return [e.sourceEndpoint(), ...e.segmentPoints(), e.targetEndpoint()];
        });
        for (let i = 1; i < points.length; i++)
          expect(
            Math.abs(points[i].x - points[i - 1].x) < 1 ||
              Math.abs(points[i].y - points[i - 1].y) < 1,
          ).toBe(true);
      }
      await page.screenshot({ path: 'planning/design/manual-edge-' + route + '.png' });
      await handle.focus();
      await page.keyboard.press('ArrowUp');
      expect((await state(page)).n).toBe(moved.n + 1);
      await page.keyboard.press('Control+z');
      expect((await state(page)).p).toEqual(moved.p);
      await page.locator('[data-edge-action=reset]').click();
      expect(
        (await state(page)).p.relations[0].extensions['card-atlas:edge'].adjustments,
      ).toBeUndefined();
      await page.keyboard.press('Control+z');
      expect((await state(page)).p).toEqual(moved.p);
      await page.locator('#map-view').selectOption('mind');
      await expect(handle).toBeVisible();
      await handle.focus();
      await page.keyboard.press('ArrowRight');
      const both = (await state(page)).p.relations[0].extensions['card-atlas:edge'].adjustments;
      expect(both.card).toBe(moved.p.relations[0].extensions['card-atlas:edge'].adjustments.card);
      expect(both.mind).toBeDefined();
      await page.locator('[data-edge-action=done]').click();
      await expect(handle).toBeHidden();
      expect(errors).toEqual([]);
    },
  );
test('independent corner drags detour obstacle with90degree legs and survive export/import', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('#locale').selectOption('en');
  const p = {
    version: '1.0',
    cards: [
      ['a', 50],
      ['b', 750],
      ['obstacle', 400],
    ].map(([id, x]) => ({
      id,
      title: id,
      position: { x, y: 220 },
      size: { width: 180, height: 120 },
    })),
    relations: [
      {
        id: 'r',
        source: 'a',
        target: 'b',
        label: 'link',
        extensions: { 'card-atlas:edge': { route: 'orthogonal' } },
      },
    ],
  };
  await page.locator('#file-input').setInputFiles({
    name: 'corners.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.locator('[data-choice=apply]').click();
  const region = await page.locator('#canvas-region').boundingBox();
  const ep = await page.evaluate(async () => {
    const { adapter } = await import('/assets/js/app.js');
    return adapter.cy.getElementById('r:r').renderedSourceEndpoint();
  });
  await page.mouse.click(region.x + ep.x + 30, region.y + ep.y);
  await page.locator('[data-action=edge-adjust]').click();
  const source = page.locator('[data-edge-handle=source]'),
    target = page.locator('[data-edge-handle=target]');
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();
  const initial = await state(page);
  async function drag(handle, dx, dy, cancel = false) {
    const b = await handle.boundingBox();
    await page.mouse.move(b.x + 14, b.y + 14);
    await page.mouse.down();
    await page.mouse.move(b.x + 14 + dx, b.y + 14 + dy, { steps: 8 });
    if (cancel) await page.keyboard.press('Escape');
    await page.mouse.up();
  }
  await drag(source, -80, -130, true);
  expect(await state(page)).toEqual(initial);
  await drag(source, -80, -130);
  const one = await state(page);
  expect(one.n).toBe(initial.n + 1);
  const first = one.p.relations[0].extensions['card-atlas:edge'].corners.card;
  await drag(target, 40, -160);
  const two = await state(page);
  expect(two.n).toBe(one.n + 1);
  const corners = two.p.relations[0].extensions['card-atlas:edge'].corners.card;
  expect(corners.source).toEqual(first.source);
  expect(corners.target).not.toEqual(first.target);
  const result = await page.evaluate(async () => {
    const { adapter } = await import('/assets/js/app.js');
    const e = adapter.cy.getElementById('r:r'),
      n = adapter.cy.getElementById('c:obstacle');
    return {
      pts: [e.sourceEndpoint(), ...e.segmentPoints(), e.targetEndpoint()],
      box: n.boundingBox(),
    };
  });
  for (let i = 1; i < result.pts.length; i++) {
    const a = result.pts[i - 1],
      b = result.pts[i],
      box = result.box;
    expect(Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1).toBe(true);
    const hits =
      Math.abs(a.x - b.x) < 1
        ? a.x > box.x1 && a.x < box.x2 && Math.max(a.y, b.y) > box.y1 && Math.min(a.y, b.y) < box.y2
        : a.y > box.y1 &&
          a.y < box.y2 &&
          Math.max(a.x, b.x) > box.x1 &&
          Math.min(a.x, b.x) < box.x2;
    expect(hits).toBe(false);
  }
  await target.hover();
  await expect(target).toHaveCSS('background-color', 'rgb(40, 89, 75)');
  await expect(target).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.screenshot({ path: 'planning/design/independent-edge-corners.png' });
  await source.focus();
  await page.keyboard.press('ArrowLeft');
  expect(
    (await state(page)).p.relations[0].extensions['card-atlas:edge'].corners.card.target,
  ).toEqual(corners.target);
  await page.keyboard.press('Control+z');
  expect((await state(page)).p).toEqual(two.p);
  await page.locator('#map-view').selectOption('mind');
  await source.focus();
  await page.keyboard.press('ArrowUp');
  const both = await state(page);
  expect(both.p.relations[0].extensions['card-atlas:edge'].corners.card).toEqual(corners);
  expect(both.p.relations[0].extensions['card-atlas:edge'].corners.mind).toBeDefined();
  await page.locator('[data-edge-action=reset]').click();
  expect((await state(page)).p.relations[0].extensions['card-atlas:edge'].corners.card).toEqual(
    corners,
  );
  expect(
    (await state(page)).p.relations[0].extensions['card-atlas:edge'].corners.mind,
  ).toBeUndefined();
  await page.locator('[data-edge-action=done]').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.toolbar [data-action=export]').click();
  const download = await downloadPromise;
  const bytes = await fs.readFile(await download.path());
  expect(
    JSON.parse(bytes.toString()).relations[0].extensions['card-atlas:edge'].corners.card,
  ).toEqual(corners);
  await page
    .locator('#file-input')
    .setInputFiles({ name: 'roundtrip.json', mimeType: 'application/json', buffer: bytes });
  await page.locator('[data-choice=apply]').click();
  expect((await state(page)).p.relations[0].extensions['card-atlas:edge'].corners.card).toEqual(
    corners,
  );
  expect(errors).toEqual([]);
});
