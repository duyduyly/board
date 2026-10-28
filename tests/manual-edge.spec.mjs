import { test, expect } from '@playwright/test';
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
