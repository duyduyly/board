import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { fanoutProject } from './auto-routing-fixture.mjs';
const state = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return { p: store.project, n: store.undoStack.length };
  });
async function setup(page, p = fanoutProject()) {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'fanout.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.locator('[data-choice=apply]').click();
  await expect(page.locator('.graph-card')).toHaveCount(p.cards.length);
  await page.locator('[data-action=fit]').click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { adapter } = await import('/assets/js/app.js');
        return adapter.cy
          .getElementById('r:' + adapter.lastProject.relations[0].id)
          .style('visibility');
      }),
    )
    .toBe('visible');
}
async function enable(page) {
  await page.locator('#project-menu summary').click();
  await page.locator('[data-action=auto-route-all]').click();
}
async function actualPaths(page) {
  return page.evaluate(async () => {
    const { adapter, store } = await import('/assets/js/app.js');
    return store.project.relations
      .filter((r) => r.extensions?.['card-atlas:edge']?.modes?.[store.activeView] === 'auto')
      .map((r) => {
        const e = adapter.cy.getElementById('r:' + r.id);
        return {
          id: r.id,
          points: [e.sourceEndpoint(), ...(e.segmentPoints() || []), e.targetEndpoint()],
          boxes: adapter.cy
            .nodes()
            .filter((n) => ![r.source, r.target].includes(n.data('appId')))
            .map((n) => n.boundingBox()),
        };
      });
  });
}
function clear(paths) {
  for (const p of paths)
    for (let i = 1; i < p.points.length; i++) {
      const a = p.points[i - 1],
        b = p.points[i];
      expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true);
      expect(Math.abs(a.x - b.x) < 0.1 || Math.abs(a.y - b.y) < 0.1).toBe(true);
      for (const box of p.boxes) {
        const hit =
          Math.abs(a.x - b.x) < 0.1
            ? a.x > box.x1 + 0.1 &&
              a.x < box.x2 - 0.1 &&
              Math.max(a.y, b.y) > box.y1 + 0.1 &&
              Math.min(a.y, b.y) < box.y2 - 0.1
            : a.y > box.y1 + 0.1 &&
              a.y < box.y2 - 0.1 &&
              Math.max(a.x, b.x) > box.x1 + 0.1 &&
              Math.min(a.x, b.x) < box.x2 - 0.1;
        expect(hit).toBe(false);
      }
    }
}

test('supplied fanout auto routing, manual option, view isolation, Undo and overlapping-view warning', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await setup(page);
  const before = await state(page);
  await enable(page);
  await expect(page.locator('#auto-route-status')).toContainText('6');
  const after = await state(page);
  expect(after.n).toBe(before.n + 1);
  expect(after.p.cards).toEqual(before.p.cards);
  expect(after.p.extensions).toEqual(before.p.extensions);
  clear(await actualPaths(page));
  await page.screenshot({ path: 'planning/design/auto-fanout.png' });
  await page.keyboard.press('Control+z');
  expect((await state(page)).p).toEqual(before.p);
  await page.keyboard.press('Control+Shift+z');
  expect((await state(page)).p).toEqual(after.p);
  await page.locator('#map-view').selectOption('mind');
  await enable(page);
  await expect(page.locator('#auto-route-status')).toHaveClass(/warning/);
  const mind = await state(page);
  expect(mind.p.cards).toEqual(before.p.cards);
  expect(mind.p.extensions).toEqual(before.p.extensions);
  await page.locator('#map-view').selectOption('card');
  await expect(page.locator('#auto-route-status')).not.toHaveClass(/warning/);
  await page.locator('[data-action=fit]').click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { adapter } = await import('/assets/js/app.js');
        return adapter.cy.getElementById('r:wire-0').style('visibility');
      }),
    )
    .toBe('visible');
  const mid = await page.evaluate(async () => {
    const { adapter } = await import('/assets/js/app.js');
    return adapter.cy.getElementById('r:wire-0').renderedMidpoint();
  });
  const b = await page.locator('#canvas-region').boundingBox();
  await page.mouse.click(b.x + mid.x, b.y + mid.y);
  await expect(page.locator('[name=edge-mode]')).toHaveValue('auto');
  const selected = await page.evaluate(
    async () => (await import('/assets/js/app.js')).adapter.lastSelection.id,
  );
  await page.locator('[data-action=edge-adjust]').click();
  await expect(page.locator('.edge-adjust-handle')).toBeVisible();
  expect(
    (await state(page)).p.relations.find((r) => r.id === selected).extensions['card-atlas:edge']
      .modes.card,
  ).toBe('manual');
  const source = page.locator('[data-edge-handle=source]');
  await source.focus();
  await page.keyboard.press('ArrowUp');
  const manual = (await state(page)).p.relations.find((r) => r.id === selected).extensions[
    'card-atlas:edge'
  ].corners.card;
  expect(manual).toBeDefined();
  await page.locator('[data-edge-action=done]').click();
  await enable(page);
  expect(
    (await state(page)).p.relations.find((r) => r.id === selected).extensions['card-atlas:edge']
      .modes.card,
  ).toBe('manual');
  expect(errors).toEqual([]);
});
test('automatic routes recalculate after native card drag; pinned and explicit manual edges stay untouched', async ({
  page,
}) => {
  const p = fanoutProject();
  p.cards[1].extensions = { 'card-atlas:metadata': { pinned: true } };
  p.relations[1].extensions['card-atlas:edge'].modes = { card: 'manual' };
  await setup(page, p);
  const before = await state(page);
  await enable(page);
  const active = await state(page);
  expect(active.n).toBe(before.n + 1);
  expect(active.p.relations[0]).toEqual(before.p.relations[0]);
  expect(active.p.relations[1]).toEqual(before.p.relations[1]);
  clear(await actualPaths(page));
  const id = 'fan-4',
    el = page.locator('[data-id=' + id + ']');
  const point = await el.evaluate((el) => {
    const b = el.getBoundingClientRect();
    for (let y = b.bottom - 3; y > b.top; y -= 3)
      for (let x = b.left + 3; x < b.right; x += 3)
        if (document.elementFromPoint(x, y) === el) return { x, y };
    throw Error('No blank drag point');
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 50, point.y + 30, { steps: 8 });
  await page.mouse.up();
  const moved = await state(page);
  expect(moved.n).toBe(active.n + 1);
  expect(moved.p.cards.find((c) => c.id === id).position).not.toEqual(
    active.p.cards.find((c) => c.id === id).position,
  );
  expect(moved.p.cards[1]).toEqual(before.p.cards[1]);
  clear(await actualPaths(page));
});

test('mode selector restores manual corners and persists automatic choice through JSON', async ({
  page,
}) => {
  const p = {
    version: '1.0',
    cards: [
      { id: 'a', title: 'A', position: { x: 80, y: 280 }, size: { width: 180, height: 120 } },
      { id: 'b', title: 'B', position: { x: 800, y: 280 }, size: { width: 180, height: 120 } },
    ],
    relations: [
      {
        id: 'r',
        source: 'a',
        target: 'b',
        label: 'mode',
        extensions: {
          'card-atlas:edge': {
            route: 'orthogonal',
            corners: {
              card: {
                axis: 'horizontal',
                source: { x: 200, y: -150 },
                target: { x: -200, y: -180 },
              },
            },
          },
        },
      },
    ],
  };
  await setup(page, p);
  await page.locator('#locale').selectOption('en');
  async function open() {
    await expect
      .poll(() =>
        page.evaluate(async () =>
          (await import('/assets/js/app.js')).adapter.cy.getElementById('r:r').style('visibility'),
        ),
      )
      .toBe('visible');
    const point = await page.evaluate(async () =>
      (await import('/assets/js/app.js')).adapter.cy.getElementById('r:r').renderedMidpoint(),
    );
    const box = await page.locator('#canvas-region').boundingBox();
    await page.mouse.click(box.x + point.x, box.y + point.y);
    await expect(page.locator('[name=edge-mode]')).toBeVisible();
  }
  await open();
  await page.locator('[name=edge-mode]').selectOption('auto');
  await page.locator('#panel-body form [type=submit]').click();
  await page.locator('[data-action=close]').click();
  const auto = await state(page);
  expect(auto.p.relations[0].extensions['card-atlas:edge'].modes.card).toBe('auto');
  expect(auto.p.relations[0].extensions['card-atlas:edge'].corners.card).toEqual(
    p.relations[0].extensions['card-atlas:edge'].corners.card,
  );
  await open();
  await page.locator('[name=edge-mode]').selectOption('manual');
  await page.locator('#panel-body form [type=submit]').click();
  await page.locator('[data-action=close]').click();
  expect((await state(page)).p.relations[0].extensions['card-atlas:edge'].corners.card).toEqual(
    p.relations[0].extensions['card-atlas:edge'].corners.card,
  );
  await open();
  await page.locator('[name=edge-mode]').selectOption('auto');
  await page.locator('#panel-body form [type=submit]').click();
  await page.locator('[data-action=close]').click();
  const downloading = page.waitForEvent('download');
  await page.locator('.toolbar [data-action=export]').click();
  const file = await downloading,
    buffer = await fs.readFile(await file.path());
  expect(JSON.parse(buffer.toString()).relations[0].extensions['card-atlas:edge'].modes.card).toBe(
    'auto',
  );
  await page
    .locator('#file-input')
    .setInputFiles({ name: 'auto-roundtrip.json', mimeType: 'application/json', buffer });
  await page.locator('[data-choice=apply]').click();
  const imported = (await state(page)).p.relations[0].extensions['card-atlas:edge'];
  expect(imported.modes.card).toBe('auto');
  expect(imported.corners.card).toEqual(p.relations[0].extensions['card-atlas:edge'].corners.card);
  await page.locator('#theme-toggle').click();
  await page.setViewportSize({ width: 1050, height: 900 });
  await page.locator('[data-action=fit]').click();
  await expect(page.locator('#auto-route-status')).toHaveCSS('color', 'rgb(228, 238, 232)');
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await import('/assets/js/app.js')).adapter.cy.getElementById('r:r').style('visibility'),
      ),
    )
    .toBe('visible');
  await page.screenshot({ path: 'planning/design/auto-routing-dark-1050.png' });
});
