import { test, expect } from '@playwright/test';

// R4 / CA-UI-03: icon, pencil-stroke and branch-toggle restyling must not change the geometry or
// hit area of card controls. Only boxes relative to the card and hit-testing are asserted, never
// the glyph, colour or stroke, so the spec stays valid after the pencil icon pass.

const PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const node = (kind, extra = {}) => ({ 'card-atlas:node': { kind }, ...extra });
const card = (id, x, y, width, height, extensions = {}) => ({
  id,
  title: id,
  summary: `${id} summary`,
  content: `# ${id}`,
  position: { x, y },
  size: { width, height },
  extensions,
});
const shaped = (shape) => ({
  ...node('card'),
  'card-atlas:appearance': { shape, sizeMode: 'manual' },
});

const cards = () => [
  card('paper', 40, 40, 240, 160, node('card')),
  card('text', 340, 40, 220, 120, node('text')),
  card('imgtext', 620, 40, 260, 180, {
    'card-atlas:node': { kind: 'image-text', coverImageId: 'cover' },
    'card-atlas:images': { cover: { name: 'c.png', mimeType: 'image/png', data: PIXEL } },
  }),
  card('rounded', 40, 300, 220, 140, shaped('rounded')),
  card('rectangle', 340, 300, 220, 140, shaped('rectangle')),
  card('diamond', 620, 300, 220, 140, shaped('diamond')),
  card('pinned', 940, 40, 220, 140, { ...node('card'), 'card-atlas:metadata': { pinned: true } }),
];

const branch = (id, source, target) => ({
  id,
  source,
  target,
  label: '',
  type: 'default',
  description: '',
  style: { color: '#64748b', line: 'solid', arrow: 'end' },
  extensions: { 'card-atlas:mind-map': { kind: 'branch' } },
});

// paper -> text -> diamond keeps `text` as an open branch; paper -> rounded -> rectangle is the
// branch the spec collapses through its visible toggle.
const project = {
  version: '1.0',
  metadata: { title: 'Card controls invariants' },
  cards: cards(),
  relations: [
    branch('r1', 'paper', 'text'),
    branch('r2', 'paper', 'rounded'),
    branch('r3', 'text', 'diamond'),
    branch('r4', 'rounded', 'rectangle'),
  ],
  extensions: { 'card-atlas:mind-map': { rootId: 'paper' } },
};

const VIEW_CARDS = {
  card: cards().map((c) => c.id),
  mind: ['paper', 'text', 'rounded', 'imgtext', 'pinned', 'diamond'],
};
const CONTROLS = ['pin', 'open', 'connector', 'resize', 'toggle', 'date'];
const SELECTORS = {
  pin: '.card-pin',
  open: '.card-open',
  connector: '.connector',
  resize: '.resize-handle',
  toggle: '.branch-toggle',
  date: '.card-created-date',
};

// Model-space { x, y, w, h } of each control relative to its card (rect / zoom), recorded on the
// pre-06 tree (server 4178, Chrome, 1440x900, vi, light, card selected), then re-checked on the
// current tree. Missing key = control absent for that card/view.
const BOXES = {
  card: {
    paper: {
      pin: { x: 106, y: -19, w: 28, h: 34 },
      open: { x: 205, y: 39, w: 24, h: 24 },
      connector: { x: 230, y: 71, w: 18, h: 18 },
      resize: { x: 232, y: 152, w: 14, h: 14 },
      date: { x: 13, y: 7.91, w: 92, h: 20.19 },
    },
    text: {
      pin: { x: 96, y: -19, w: 28, h: 34 },
      open: { x: 187, y: 89, w: 24, h: 24 },
      connector: { x: 210, y: 51, w: 18, h: 18 },
      resize: { x: 212, y: 112, w: 14, h: 14 },
      date: { x: 13, y: 7.91, w: 82, h: 20.19 },
    },
    imgtext: {
      pin: { x: 116, y: -19, w: 28, h: 34 },
      open: { x: 227, y: 149, w: 24, h: 24 },
      connector: { x: 250, y: 81, w: 18, h: 18 },
      resize: { x: 252, y: 172, w: 14, h: 14 },
      date: { x: 13, y: 7.91, w: 95.06, h: 20.19 },
    },
    rounded: {
      pin: { x: 96, y: -20, w: 28, h: 34 },
      open: { x: 172, y: -24, w: 24, h: 24 },
      connector: { x: 211, y: 61, w: 18, h: 18 },
      resize: { x: 213, y: 133, w: 14, h: 14 },
      date: { x: 12, y: 6.91, w: 83, h: 20.19 },
    },
    rectangle: {
      pin: { x: 96, y: -20, w: 28, h: 34 },
      open: { x: 172, y: -24, w: 24, h: 24 },
      connector: { x: 211, y: 61, w: 18, h: 18 },
      resize: { x: 213, y: 133, w: 14, h: 14 },
      date: { x: 12, y: 6.91, w: 83, h: 20.19 },
    },
    diamond: {
      pin: { x: 168, y: -29.5, w: 28, h: 34 },
      open: { x: 144.77, y: 3.22, w: 24, h: 24 },
      connector: { x: 213.7, y: 63.7, w: 12.6, h: 12.6 },
      date: { x: 0, y: -21.59, w: 93.06, h: 18.19 },
    },
    pinned: {
      pin: { x: 96, y: -19, w: 28, h: 34 },
      open: { x: 185, y: 39, w: 24, h: 24 },
      date: { x: 13, y: 8.41, w: 82, h: 19.19 },
    },
  },
  mind: {
    paper: {
      pin: { x: 206, y: -27.5, w: 28, h: 34 },
      open: { x: 226, y: 48, w: 24, h: 24 },
      connector: { x: 249, y: 31, w: 18, h: 18 },
      resize: { x: 251, y: 71, w: 14, h: 14 },
      toggle: { x: -9, y: 29, w: 22, h: 22 },
      date: { x: 2, y: -19.59, w: 93.06, h: 18.19 },
    },
    text: {
      pin: { x: 207, y: -28.5, w: 28, h: 34 },
      open: { x: 227, y: 49, w: 24, h: 24 },
      connector: { x: 250, y: 31, w: 18, h: 18 },
      resize: { x: 252, y: 72, w: 14, h: 14 },
      toggle: { x: -10, y: 29, w: 22, h: 22 },
      date: { x: 1, y: -20.59, w: 93.06, h: 18.19 },
    },
    rounded: {
      pin: { x: 208, y: -29.5, w: 28, h: 34 },
      open: { x: 162, y: -24, w: 24, h: 24 },
      connector: { x: 251, y: 31, w: 18, h: 18 },
      resize: { x: 253, y: 73, w: 14, h: 14 },
      toggle: { x: -11, y: 29, w: 24.23, h: 22 },
      date: { x: 0, y: -21.59, w: 93.06, h: 18.19 },
    },
    imgtext: {
      pin: { x: 207, y: -28.5, w: 28, h: 34 },
      open: { x: 227, y: 159, w: 24, h: 24 },
      connector: { x: 250, y: 86, w: 18, h: 18 },
      resize: { x: 252, y: 182, w: 14, h: 14 },
      date: { x: 1, y: -20.59, w: 93.06, h: 18.19 },
    },
    pinned: {
      pin: { x: 207, y: -28.5, w: 28, h: 34 },
      open: { x: 227, y: 49, w: 24, h: 24 },
      date: { x: 1, y: -20.09, w: 93.06, h: 17.19 },
    },
    diamond: {
      pin: { x: 208, y: -29.5, w: 28, h: 34 },
      open: { x: 152.58, y: -14.58, w: 24, h: 24 },
      connector: { x: 253.7, y: 33.7, w: 12.6, h: 12.6 },
      date: { x: 0, y: -21.59, w: 93.06, h: 18.19 },
    },
  },
};
const RECT_TOLERANCE = 0.5;
const BOX_TOLERANCE = 0.5;
const SELECT_INSET = { x: 8, y: 8 };
const DUMP = Boolean(process.env.CARD_CONTROLS_DUMP);

async function load(page) {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'controls.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
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

// Transitions would make a mid-flight sample meaningless.
const settle = (page) =>
  page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  );

// Read-only: card rect vs model, plus every control box relative to the card and its hit test.
const measure = (page, id, view) =>
  page.evaluate(
    async ([cardId, activeView, selectors]) => {
      const { adapter, store } = await import('/assets/js/app.js');
      const { geometry } = await import('/assets/js/graph/mind-map.js');
      const zoom = adapter.cy.zoom();
      const el = adapter.cards.get(cardId);
      const r = el.getBoundingClientRect();
      const model = geometry(
        store.project,
        store.project.cards.find((c) => c.id === cardId),
        activeView,
      );
      const controls = {};
      for (const [name, selector] of Object.entries(selectors)) {
        const c = el.querySelector(selector);
        const b = c?.getBoundingClientRect();
        if (!c || !b.width || !b.height || window.getComputedStyle(c).display === 'none') continue;
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        controls[name] = {
          x: (b.left - r.left) / zoom,
          y: (b.top - r.top) / zoom,
          w: b.width / zoom,
          h: b.height / zoom,
          hit: Boolean(hit && c.contains(hit)),
        };
      }
      return { model: model.size, w: r.width / zoom, h: r.height / zoom, controls };
    },
    [id, view, SELECTORS],
  );

// Click a corner of the card so the click lands on card chrome, not an editable text field.
async function selectCard(page, id) {
  const box = await page.locator(`.graph-card[data-id=${id}]`).boundingBox();
  await page.mouse.click(box.x + SELECT_INSET.x, box.y + SELECT_INSET.y);
  await settle(page);
}

async function collapseBranch(page, id) {
  const toggle = page.locator(`.graph-card[data-id=${id}] .branch-toggle`);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.locator('[data-action=fit]').click();
  await settle(page);
}

for (const view of ['card', 'mind'])
  test(`${view}: card controls keep box and hit area`, async ({ page }) => {
    await load(page);
    await openView(page, view);
    if (view === 'mind') await collapseBranch(page, 'rounded');
    const seen = {};
    for (const id of VIEW_CARDS[view]) {
      await selectCard(page, id);
      const m = await measure(page, id, view);
      seen[id] = m.controls;
      if (DUMP) continue;
      expect(Math.abs(m.w - m.model.width), `${id} width`).toBeLessThanOrEqual(RECT_TOLERANCE);
      expect(Math.abs(m.h - m.model.height), `${id} height`).toBeLessThanOrEqual(RECT_TOLERANCE);
      for (const name of CONTROLS) {
        const got = m.controls[name];
        const want = BOXES[view][id][name];
        expect(Boolean(got), `${view}/${id}/${name} present`).toBe(Boolean(want));
        if (!got) continue;
        expect(got.hit, `${view}/${id}/${name} hit at centre`).toBe(true);
        // The date label width follows its text, so only its origin and height are geometry.
        for (const k of name === 'date' ? ['x', 'y', 'h'] : ['x', 'y', 'w', 'h'])
          expect(Math.abs(got[k] - want[k]), `${view}/${id}/${name}.${k}`).toBeLessThanOrEqual(
            BOX_TOLERANCE,
          );
      }
    }
    if (DUMP) console.log('DUMP ' + JSON.stringify({ [view]: seen }));
  });
