import { setDraftTitle, setDraftFontSize } from './overview-test-helpers.mjs';
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const open = async (page) => {
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  await expect(page.locator('[data-palette-shape=circle]')).toBeEnabled();
};
test('basic shapes share Canvas and Format geometry, preserve data and portable JSON', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await page.locator('.graph-card[data-id=card-user-service]').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Format', exact: true }).click();
  for (const shape of [
    'rectangle',
    'rounded',
    'square',
    'circle',
    'ellipse',
    'diamond',
    'star',
    'heart',
    'octagon',
    'arrow',
    'isosceles-triangle',
    'right-triangle',
    'triangle',
    'hexagon',
  ]) {
    await page.locator('[name=appearance-shape]').selectOption(shape);
    await expect(page.locator('#format-card-preview .graph-card')).toHaveAttribute(
      'data-shape',
      shape,
    );
    await expect(page.locator('#format-card-preview polygon')).toHaveCount(1);
  }
  await setDraftFontSize(page, '48');
  await page.locator('#panel-body form button[type=submit]').click();
  await page.locator('[data-action=close]').click();
  const card = page.locator('.graph-card[data-id=card-user-service]');
  await expect(card).toHaveAttribute('data-shape', 'hexagon');
  await expect(card.locator('.card-summary')).toHaveCount(0);
  const snapshot = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return store.project;
  });
  expect(snapshot.cards[0].summary).toBeTruthy();
  await page.screenshot({ path: 'planning/design/feedback-03-basic-shape.png' });
  await page.locator('#theme-toggle').click();
  await page.locator('#map-view').selectOption('mind');
  await expect(card.locator('polygon')).toHaveCount(1);
  expect(errors).toEqual([]);
});
test('image palette, compact shapes, transparent theme and responsive navigation preserve attachments', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const requests = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('data:'))
      requests.push(r.url());
  });
  await open(page);
  const source = JSON.parse(await fs.readFile('assets/data/node-transfer-example.json', 'utf8'));
  const image = Object.values(source.cards[0].extensions['card-atlas:images'])[0];
  const chooser = page.waitForEvent('filechooser');
  await page.locator('[data-palette-kind=image]').click();
  await (
    await chooser
  ).setFiles({
    name: image.name,
    mimeType: image.mimeType,
    buffer: Buffer.from(image.data, 'base64'),
  });
  const card = page.locator('.graph-card[data-node-kind=image]');
  await expect(card).toHaveCount(1);
  await expect(card.locator('img')).toBeVisible();
  await expect
    .poll(() => card.locator('img').evaluate((el) => el.complete && el.naturalWidth > 0))
    .toBe(true);
  await card.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Format', exact: true }).click();
  for (const shape of [
    'rectangle',
    'rounded',
    'square',
    'circle',
    'ellipse',
    'diamond',
    'star',
    'heart',
    'octagon',
    'arrow',
    'isosceles-triangle',
    'right-triangle',
    'triangle',
    'hexagon',
  ]) {
    await page.locator('[name=appearance-shape]').selectOption(shape);
    await expect(page.locator('#format-card-preview img')).toBeVisible();
  }
  await page.locator('[name=appearance-backgroundTransparent]').check();
  await page.locator('[name=appearance-borderTransparent]').check();
  await page.locator('[name=appearance-sizeMode]').selectOption('fit');
  await page.locator('#panel-body form button[type=submit]').click();
  await page.locator('[data-action=close]').click();
  await page.locator('#locale').selectOption('en');
  await page.locator('#theme-toggle').click();
  await page.locator('#map-view').selectOption('mind');
  await expect(card.locator('img')).toBeVisible();
  await card.click();
  await expect(card.locator('.resize-handle')).toBeVisible();
  for (const width of [1440, 1050]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page.locator('#locale')).toBeInViewport();
    await page.locator('[data-action=fit]').click();
    await page.screenshot({ path: 'planning/design/feedback-03-image-' + width + '.png' });
  }
  await page.locator('[data-action=search]').click();
  await page.locator('#search').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#search-drawer')).not.toBeVisible();
  await expect(page.locator('[data-action=search]')).toBeFocused();
  const state = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return {
      project: store.project,
      storage: localStorage.length,
      db: await window.indexedDB.databases(),
    };
  });
  expect(state.project.cards.at(-1).extensions['card-atlas:images']).toBeTruthy();
  expect(state.storage).toBe(0);
  expect(state.db).toEqual([]);
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
});
test('palette keyboard and drag create at viewport coordinates; search and project tools remain accessible', async ({
  page,
}) => {
  await open(page);
  await page.locator('[data-palette-shape=circle]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.graph-card')).toHaveCount(4);
  const circle = page.locator('.graph-card[data-shape=circle]');
  await expect(circle).toHaveAttribute('aria-pressed', 'true');
  const rect = await page.locator('#canvas-region').boundingBox();
  const source = await page.locator('[data-palette-shape=diamond]').boundingBox();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * 0.6, rect.y + rect.height * 0.35, { steps: 16 });
  await page.mouse.up();
  await expect(page.locator('.graph-card')).toHaveCount(5);
  const center = await page.locator('.graph-card[data-shape=diamond]').boundingBox();
  expect(Math.abs(center.x + center.width / 2 - (rect.x + rect.width * 0.6))).toBeLessThan(4);
  await page.locator('[data-action=search]').click();
  await page.locator('#search').fill('User Service');
  await expect(page.locator('.card-row')).toHaveCount(2);
  await page.locator('.card-row[data-card-id=card-user-service]').click();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(page.locator('#search-drawer')).not.toBeVisible();
  await page.locator('[data-action=close]').click();
  await page.locator('#project-menu > summary').click();
  await expect(page.locator('#counts')).toContainText('5');
  await page.locator('[data-action=format]').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('[data-choice=cancel]').click();
  await page.screenshot({ path: 'planning/design/feedback-03-palette.png' });
});
test('resize commits once, keeps active-view geometry and cancels Escape/blur; connector remains separate', async ({
  page,
}) => {
  await open(page);
  await page.locator('[data-palette-shape=circle]').click();
  const card = page.locator('.graph-card[data-shape=circle]');
  const before = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return { size: store.project.cards.at(-1).size, history: store.undoStack.length };
  });
  const drag = async (dx, dy, end = true) => {
    const b = await card.locator('.resize-handle').boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 6 });
    if (end) await page.mouse.up();
  };
  await drag(80, 50);
  const after = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return { size: store.project.cards.at(-1).size, history: store.undoStack.length };
  });
  expect(after.history).toBe(before.history + 1);
  expect(after.size.width).toBe(after.size.height);
  expect(after.size.width).toBeGreaterThan(before.size.width);
  await drag(100, 100, false);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect(
    await page.evaluate(async () => {
      const { store } = await import('/assets/js/app.js');
      return store.project.cards.at(-1).size;
    }),
  ).toEqual(after.size);
  await drag(40, 40, false);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  expect(
    await page.evaluate(async () => {
      const { store } = await import('/assets/js/app.js');
      return store.undoStack.length;
    }),
  ).toBe(after.history);
  await page.locator('[data-action=undo]').click();
  expect(
    await page.evaluate(async () => {
      const { store } = await import('/assets/js/app.js');
      return store.project.cards.at(-1).size;
    }),
  ).toEqual(before.size);
  await page.locator('#map-view').selectOption('mind');
  await card.click();
  await drag(60, 60);
  const sizes = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { geometry } = await import('/assets/js/graph/mind-map.js');
    const c = store.project.cards.at(-1);
    return [c.size, geometry(store.project, c, 'mind').size];
  });
  expect(sizes[0]).toEqual(before.size);
  expect(sizes[1]).not.toEqual(before.size);
  await expect(card.locator('.connector')).toHaveCount(1);
});
test('font72 Fit text is atomic, survives locale/theme and round-trip; overflow blocks Apply', async ({
  page,
}) => {
  await open(page);
  await page.locator('[data-palette-shape=triangle]').click();
  const card = page.locator('.graph-card[data-shape=triangle]');
  await card.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Format', exact: true }).click();
  await setDraftFontSize(page, '72');
  await page.locator('[name=appearance-sizeMode]').selectOption('fit');
  const width = await page.locator('[name=width]').inputValue();
  expect(Number(width)).toBeGreaterThan(240);
  await page.locator('#detail-locale').selectOption('en');
  expect(Number(await page.locator('[name=width]').inputValue())).toBeCloseTo(Number(width), 8);
  await page.locator('#detail-theme').click();
  expect(Number(await page.locator('[name=width]').inputValue())).toBeCloseTo(Number(width), 8);
  const history = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return store.undoStack.length;
  });
  await page.locator('#panel-body form button[type=submit]').click();
  const applied = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { stage, serialize } = await import('/assets/js/json/validator.js');
    return {
      history: store.undoStack.length,
      result: stage(serialize(store.project)),
      size: store.project.cards.at(-1).size,
    };
  });
  expect(applied.history).toBe(history + 1);
  expect(applied.result.errors).toEqual([]);
  expect(
    applied.result.project.cards.at(-1).extensions['card-atlas:typography'].title.fontSize,
  ).toBe(72);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await setDraftTitle(page, 'Very long title '.repeat(200));
  await page.locator('#panel-body form button[type=submit]').click();
  await expect(page.locator('.form-errors').first()).toContainText('cannot fit');
  expect(
    await page.evaluate(async () => {
      const { store } = await import('/assets/js/app.js');
      return store.undoStack.length;
    }),
  ).toBe(applied.history);
  await page.locator('#cancel-draft').click();
  await page.locator('[data-action=close]').click();
  await page.locator('[data-action=fit]').click();
  await page.screenshot({ path: 'planning/design/feedback-03-fit-dark.png' });
});
test('bundled shapes import, polygon edges and corner hit areas match; Mind Fit leaves Card geometry intact', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles('assets/data/basic-shapes-example.json');
  await page.locator('[data-choice=apply]').click();
  await expect(page.locator('.graph-card[data-shape]')).toHaveCount(8);
  await page.locator('[data-action=fit]').click();
  const geometryCheck = await page.evaluate(async () => {
    const { adapter, store } = await import('/assets/js/app.js');
    const { shapePoints, shapeAnchor } = await import('/assets/js/graph/shape-registry.js');
    return store.project.cards.map((c) => {
      const node = adapter.cy.getElementById('c:' + c.id),
        el = adapter.cards.get(c.id),
        points = shapePoints(c.extensions['card-atlas:appearance'].shape, c.size, 10);
      return {
        shape: c.extensions['card-atlas:appearance'].shape,
        svg: el.querySelector('polygon').getAttribute('points'),
        expected: points.map((p) => p.x + ',' + p.y).join(' '),
        cy: node.data('polygon'),
        expectedCy: points.flatMap((p) => [
          (p.x / c.size.width) * 2 - 1,
          (p.y / c.size.height) * 2 - 1,
        ]),
        anchor: shapeAnchor(points, { x: c.size.width / 2, y: c.size.height / 2 }, { x: 1, y: 0 }),
        connector: {
          x: parseFloat(el.querySelector('.connector').style.left) + 9,
          y: parseFloat(el.querySelector('.connector').style.top) + 9,
        },
      };
    });
  });
  for (const g of geometryCheck) {
    expect(g.svg).toBe(g.expected);
    expect(g.cy).toEqual(g.expectedCy);
    expect(g.connector.x).toBeCloseTo(g.anchor.x, 2);
    expect(g.connector.y).toBeCloseTo(g.anchor.y, 2);
  }
  const corner = await page.locator('.graph-card[data-id=shape-circle]').boundingBox();
  await page.mouse.click(corner.x + 1, corner.y + 1);
  await expect(page.locator('.graph-card[data-id=shape-circle]')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.locator('#map-view').selectOption('mind');
  await page.locator('[data-action=fit]').click();
  const card = page.locator('.graph-card[data-id=shape-circle]');
  await card.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Format', exact: true }).click();
  await setDraftFontSize(page, '72');
  await page.locator('[name=appearance-sizeMode]').selectOption('fit');
  await page.locator('#panel-body form button[type=submit]').click();
  const result = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { geometry } = await import('/assets/js/graph/mind-map.js');
    const c = store.project.cards.find((c) => c.id === 'shape-circle');
    return {
      card: c.size,
      mind: geometry(store.project, c, 'mind').size,
      history: store.undoStack.length,
    };
  });
  expect(result.card).toEqual({ width: 280, height: 220 });
  expect(result.mind.width).toBe(result.mind.height);
  expect(result.history).toBe(1);
  await page.locator('[data-action=close]').click();
  await page.locator('[data-action=fit]').click();
  const fitTitle = await page.locator('.graph-card[data-id=shape-circle] h3').evaluate((el) => ({
    text: el.textContent,
    width: el.clientWidth,
    scrollWidth: el.scrollWidth,
    height: el.clientHeight,
    scrollHeight: el.scrollHeight,
  }));
  expect(fitTitle.text).toBe('circle');
  expect(fitTitle.scrollWidth).toBeLessThanOrEqual(fitTitle.width + 1);
  expect(fitTitle.scrollHeight).toBeLessThanOrEqual(fitTitle.height + 1);
  await page.screenshot({ path: 'planning/design/feedback-03-example-mind.png' });
});
