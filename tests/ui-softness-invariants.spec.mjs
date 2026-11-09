import { test, expect } from '@playwright/test';

// R4 / CA-UI-03: softer chrome (radius, shadow, default card radius) must not change geometry.
// Only geometry and hit areas are asserted here, never the radius value itself, so the spec
// stays valid when the default card radius moves from 2px to 6px.

const PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const node = (kind, extra = {}) => ({ 'card-atlas:node': { kind }, ...extra });
const card = (id, x, y, width, height, extensions = {}, summary = `${id} summary`) => ({
  id,
  title: id,
  summary,
  content: `# ${id}`,
  position: { x, y },
  size: { width, height },
  extensions,
});
const shaped = (shape) => ({
  ...node('card'),
  'card-atlas:appearance': { shape, sizeMode: 'manual' },
});

const baseCards = () => [
  card('paper', 40, 40, 240, 160, node('card')),
  card('text', 340, 40, 220, 120, node('text')),
  card('imgtext', 620, 40, 260, 180, {
    ...node('image-text', {}),
    'card-atlas:node': { kind: 'image-text', coverImageId: 'cover' },
    'card-atlas:images': { cover: { name: 'c.png', mimeType: 'image/png', data: PIXEL } },
  }),
  card('rounded', 40, 300, 220, 140, shaped('rounded')),
  card('rectangle', 340, 300, 220, 140, shaped('rectangle')),
  card('diamond', 620, 300, 220, 140, shaped('diamond')),
  card('pinned', 940, 40, 220, 140, {
    ...node('card'),
    'card-atlas:metadata': { pinned: true },
  }),
];

const relation = {
  id: 'r1',
  source: 'paper',
  target: 'text',
  label: '',
  type: 'default',
  description: '',
  style: { color: '#64748b', line: 'solid', arrow: 'end' },
  extensions: { 'card-atlas:mind-map': { kind: 'branch' } },
};

const projectOf = (cards) => ({
  version: '1.0',
  metadata: { title: 'Softness invariants' },
  cards,
  relations: [relation],
  extensions: { 'card-atlas:mind-map': { rootId: 'paper' } },
});

// Measured on the pre-04 snapshot (server 4174, Chrome, 1440x900, vi), then re-checked on the
// current tree. Values are model geometry, so they do not depend on the radius token.
const FIT_FONT_12_SIZE = { width: 240, height: 160 };
const FIT_FONT_72_SIZE = { width: 240, height: 448 };
const RELATION_ENDPOINTS = {
  card: {
    source: { x: 280, y: 111.72413793103448 },
    target: { x: 340, y: 107.58620689655173 },
  },
  mind: {
    source: { x: 279.0909090909091, y: 120 },
    target: { x: 360.9090909090909, y: 120 },
  },
};
const RECT_TOLERANCE = 0.5;
const CORNER_INSET = 3;
const MIN_TEXT_CONTRAST = 4.5;
const NARROW_VIEWPORT = { width: 1000, height: 800 };

async function load(page, cards = baseCards()) {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'softness.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(projectOf(cards))),
  });
  await page.locator('[data-choice=apply]').click();
  await expect(page.locator('.graph-card')).not.toHaveCount(0);
}

async function openView(page, view) {
  await page.locator(`[data-map-view="${view}"]`).click();
  if (await page.locator('#mind-convert-root').isVisible())
    await page.locator('[data-choice=apply]').click();
  await expect(page.locator(`[data-map-view="${view}"]`)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-action=fit]').click();
}

// Read-only snapshot of model geometry and Cytoscape state for the active view.
const readGeometry = (page, view) =>
  page.evaluate(async (activeView) => {
    const { adapter, store } = await import('/assets/js/app.js');
    const { geometry } = await import('/assets/js/graph/mind-map.js');
    const region = document.querySelector('#canvas-region').getBoundingClientRect();
    const zoom = adapter.cy.zoom();
    const cards = store.project.cards.map((c) => {
      const g = geometry(store.project, c, activeView);
      const el = adapter.cards.get(c.id).getBoundingClientRect();
      const rendered = adapter.cy.getElementById('c:' + c.id).renderedPosition();
      return {
        id: c.id,
        model: g,
        zoom,
        cx: el.left + el.width / 2 - (region.left + rendered.x),
        cy: el.top + el.height / 2 - (region.top + rendered.y),
        w: el.width / zoom,
        h: el.height / zoom,
      };
    });
    const edge = adapter.cy.getElementById('r:r1');
    return { cards, source: edge.sourceEndpoint(), target: edge.targetEndpoint() };
  }, view);

for (const view of ['card', 'mind'])
  test(`${view}: DOM card rects equal model geometry and relation endpoints are stable`, async ({
    page,
  }) => {
    await load(page);
    await openView(page, view);
    const snap = await readGeometry(page, view);
    for (const c of snap.cards) {
      expect(Math.abs(c.w - c.model.size.width), c.id + ' width').toBeLessThanOrEqual(
        RECT_TOLERANCE,
      );
      expect(Math.abs(c.h - c.model.size.height), c.id + ' height').toBeLessThanOrEqual(
        RECT_TOLERANCE,
      );
      expect(Math.abs(c.cx), c.id + ' center x').toBeLessThanOrEqual(RECT_TOLERANCE);
      expect(Math.abs(c.cy), c.id + ' center y').toBeLessThanOrEqual(RECT_TOLERANCE);
    }
    for (const end of ['source', 'target'])
      for (const axis of ['x', 'y'])
        expect(snap[end][axis], `${end}.${axis}`).toBeCloseTo(
          RELATION_ENDPOINTS[view][end][axis],
          1,
        );
  });

test('card: unshaped card corners and the resize handle keep their hit areas', async ({ page }) => {
  await load(page);
  await openView(page, 'card');
  // Select the paper note so its resize handle is rendered (pinned cards have none).
  await page.locator('.graph-card[data-id=paper]').click({ position: { x: 120, y: 80 } });
  for (const id of ['paper', 'text']) {
    const box = await page.locator(`.graph-card[data-id=${id}]`).boundingBox();
    const points = [
      [box.x + CORNER_INSET, box.y + CORNER_INSET],
      [box.x + box.width - CORNER_INSET, box.y + CORNER_INSET],
      [box.x + CORNER_INSET, box.y + box.height - CORNER_INSET],
      [box.x + box.width - CORNER_INSET, box.y + box.height - CORNER_INSET],
    ];
    for (const [x, y] of points) {
      const hit = await page.evaluate(
        ([px, py]) => document.elementFromPoint(px, py)?.closest('.graph-card')?.dataset.id ?? null,
        [x, y],
      );
      expect(hit, `${id} corner (${x},${y})`).toBe(id);
    }
  }
  const handle = page.locator('.graph-card[data-id=paper] .resize-handle');
  await expect(handle).toBeVisible();
  const hb = await handle.boundingBox();
  const hitHandle = await page.evaluate(
    ([px, py]) => document.elementFromPoint(px, py)?.classList.contains('resize-handle') ?? false,
    [hb.x + hb.width / 2, hb.y + hb.height / 2],
  );
  expect(hitHandle).toBe(true);
});

for (const size of [12, 72])
  test(`card: Fit at font ${size} gives the recorded size`, async ({ page }) => {
    await load(page);
    await openView(page, 'card');
    await page.locator('.graph-card[data-id=paper]').focus();
    await page.keyboard.press('Enter');
    await page.locator('#panel-tabs button').nth(2).click();
    await page.locator('#edit-card-overview').click();
    await page.locator('#overview-field').selectOption('summary');
    await page.locator('#overview-size').fill(String(size));
    await page.locator('[data-overview-apply]').click();
    await page.locator('#inspector-tabs button').nth(2).click();
    await page.locator('[name=appearance-sizeMode]').selectOption('fit');
    await page.locator('#panel-body [type=submit]').click();
    await expect(page.locator('#detail-panel')).not.toBeVisible();
    const fitted = await page.evaluate(async () => {
      const { store } = await import('/assets/js/app.js');
      return store.project.cards.find((c) => c.id === 'paper').size;
    });
    expect(fitted).toEqual(size === 12 ? FIT_FONT_12_SIZE : FIT_FONT_72_SIZE);
  });

// WCAG 2.x ratio from real computed colours, as in ux-contrast-layout.spec.mjs.
const contrastOf = (locator) =>
  locator.evaluate((el) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (css) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: a / 255 };
    };
    const over = (top, bottom) => {
      const a = top.a + bottom.a * (1 - top.a);
      const mix = (k) => (top[k] * top.a + bottom[k] * bottom.a * (1 - top.a)) / (a || 1);
      return { r: mix('r'), g: mix('g'), b: mix('b'), a };
    };
    let background = { r: 255, g: 255, b: 255, a: 1 },
      opacity = 1;
    const chain = [];
    for (let n = el; n; n = n.parentElement) chain.push(n);
    for (const n of chain) opacity *= parseFloat(window.getComputedStyle(n).opacity);
    for (const n of chain.reverse()) {
      const bg = rgba(window.getComputedStyle(n).backgroundColor);
      if (bg.a > 0) background = over(bg, background);
    }
    const ink = rgba(window.getComputedStyle(el).color);
    const text = over({ ...ink, a: ink.a * opacity }, background);
    const lum = ({ r, g, b }) =>
      [r, g, b]
        .map((v) => v / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const [hi, lo] = [lum(text), lum(background)].sort((a, b) => b - a);
    return (hi + 0.05) / (lo + 0.05);
  });

// Colour transitions (added by later motion tasks) would make a mid-flight sample meaningless.
const settle = (page) =>
  page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );

async function expectContrast(page, name, selector) {
  await settle(page);
  const items = page.locator(selector);
  for (let i = 0; i < (await items.count()); i++) {
    const item = items.nth(i);
    if (!(await item.isVisible()) || (await item.isDisabled())) continue;
    expect(await contrastOf(item), `${name} #${i}`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  }
}

const overflow = (page, selector) =>
  page.locator(selector).evaluate((el) => el.scrollWidth - el.clientWidth);

for (const theme of ['light', 'dark'])
  for (const locale of ['vi', 'en'])
    test(`chrome keeps 4.5:1 contrast and fits ${NARROW_VIEWPORT.width}px in ${theme}/${locale}`, async ({
      page,
    }) => {
      await page.setViewportSize(NARROW_VIEWPORT);
      await load(page);
      await openView(page, 'card');
      await page.locator('#locale').selectOption(locale);
      if (theme === 'dark') {
        await page.locator('#theme-toggle').click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      }
      await expectContrast(page, 'toolbar buttons', '.toolbar button');
      await expectContrast(page, 'primary', 'button.primary');
      await expectContrast(page, 'view switch', '#map-view button');
      expect(await overflow(page, '.toolbar'), 'toolbar overflow').toBeLessThanOrEqual(0);

      // Detail toolbar, then the Format dock and its tabs.
      await page.locator('.graph-card[data-id=paper]').focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#detail-panel')).toBeVisible();
      await expectContrast(page, 'detail toolbar', '#detail-panel .panel-header button');
      await expectContrast(page, 'detail tabs', '#panel-tabs button');
      await page.locator('#panel-tabs button').nth(2).click();
      await expect(page.locator('#format-inspector')).toBeVisible();
      await expectContrast(page, 'dock tabs', '#inspector-tabs button');
      await expectContrast(page, 'dock tab labels', '#inspector-tabs .inspector-tab-label');
      await expectContrast(page, 'dock property names', '#format-inspector .format-property-name');
      expect(await overflow(page, '#inspector-tabs'), 'dock tabs overflow').toBeLessThanOrEqual(0);
      expect(await overflow(page, '#format-inspector'), 'dock overflow').toBeLessThanOrEqual(0);

      // Real toast from a visible action: edit the title in the dock text tab.
      await page.locator('#inspector-tabs button').nth(1).click();
      await page.locator('#overview-text').fill('Softness toast');
      await page.locator('[data-overview-apply]').click();
      await expect(page.locator('#toast')).toBeVisible();
      await settle(page);
      expect(await contrastOf(page.locator('#toast')), 'toast').toBeGreaterThanOrEqual(
        MIN_TEXT_CONTRAST,
      );
      const doc = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(doc.scroll, 'page horizontal scroll').toBeLessThanOrEqual(doc.inner);
    });
