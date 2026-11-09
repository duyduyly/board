import { view as switchMapView, locale } from './ui-driver.mjs';
import { test, expect } from '@playwright/test';

// Branch focus (06/R3): session-only dimming of everything outside the selected card's branch.
const DIM_OPACITY_MAX = 0.5;
const CARD_SIZE = { width: 220, height: 120 };
const BRANCH = { 'card-atlas:mind-map': { kind: 'branch' } };
const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const POSITIONS = {
  a: { x: 40, y: 120 },
  b: { x: 280, y: 120 },
  c: { x: 520, y: 40 },
  d: { x: 520, y: 220 },
  e: { x: 280, y: 380 },
  f: { x: 40, y: 380 },
  g: { x: 520, y: 420 },
};
// a -> b -> {c, d}; b -> e is a reference link (followed in Note Board only); f, g are loose.
const RELATIONS = [
  ['ab', 'a', 'b', BRANCH],
  ['bc', 'b', 'c', BRANCH],
  ['bd', 'b', 'd', BRANCH],
  ['be', 'b', 'e', {}],
];

function fixture(ids, relations, positions, mindRoot) {
  const cards = ids.map((id) => ({
    id,
    title: 'Card ' + id,
    summary: 'Example ' + id,
    type: 'test',
    tags: [],
    content: '# ' + id,
    position: { ...positions[id] },
    size: { ...CARD_SIZE },
    style: { backgroundColor: '#ffffff', textColor: '#203047', borderColor: '#64748b' },
    extensions: {},
  }));
  const project = {
    version: '1.0',
    metadata: { title: 'Branch focus', description: '' },
    canvas: { zoom: 1, position: { x: 40, y: 30 } },
    cards,
    relations: relations.map(([id, source, target, extensions]) => ({
      id,
      source,
      target,
      extensions,
    })),
    extensions: {},
  };
  if (mindRoot)
    project.extensions = {
      'card-atlas:mind-map': { rootId: mindRoot },
      'card-atlas:views': {
        mindMap: {
          positions: Object.fromEntries(cards.map((c) => [c.id, { ...c.position }])),
          sizes: Object.fromEntries(cards.map((c) => [c.id, { ...c.size }])),
          viewport: { zoom: 1, position: { x: 40, y: 30 } },
        },
      },
    };
  return project;
}
async function load(page, project) {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'focus.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await expect(page.locator('.graph-card')).toHaveCount(project.cards.length);
}
const loadTree = (page) => load(page, fixture(IDS, RELATIONS, POSITIONS, 'a'));
const card = (page, id) => page.locator(`.graph-card[data-id="${id}"]`);
const focusButton = (page) => page.locator('[data-action=focus]');
// Click a part of the card that is not an editable field or control (those open popups).
async function choose(page, id) {
  const point = await blankPoint(page, id);
  await page.mouse.click(point.x, point.y);
}
const toggleFocus = (page) => focusButton(page).click();
const state = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return JSON.stringify({
      project: store.project,
      undo: store.undoStack.length,
      redo: store.redoStack.length,
      dirty: store.dirty,
      view: store.activeView,
    });
  });
const opacities = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll('.graph-card')].map((el) => [
        el.dataset.id,
        Number(window.getComputedStyle(el).opacity),
      ]),
    ),
  );
const edgeDim = (page) =>
  page.evaluate(async () => {
    const { adapter } = await import('/assets/js/app.js');
    return Object.fromEntries(
      adapter.cy
        .edges()
        .map((e) => [
          e.id().replace(/^r:/, ''),
          e.hasClass('focus-dimmed') && Number(e.style('opacity')) < 0.5,
        ]),
    );
  });
const visibleIds = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.graph-card')].map((el) => el.dataset.id).sort(),
  );
async function expectBranch(page, branch, dimmedEdges) {
  await expect
    .poll(async () => {
      const o = await opacities(page);
      return Object.keys(o)
        .filter((id) => o[id] < DIM_OPACITY_MAX)
        .sort();
    })
    .toEqual((await visibleIds(page)).filter((id) => !branch.includes(id)));
  const o = await opacities(page);
  for (const id of branch) expect(o[id]).toBe(1);
  if (dimmedEdges) {
    const edges = await edgeDim(page);
    for (const [id, dimmed] of Object.entries(edges))
      expect(dimmed, 'edge ' + id).toBe(dimmedEdges.includes(id));
  }
}
const geometry = (page) =>
  page.evaluate(async () => {
    const { adapter } = await import('/assets/js/app.js');
    const rects = {};
    for (const el of document.querySelectorAll('.graph-card')) {
      const r = el.getBoundingClientRect();
      rects[el.dataset.id] = [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 100) / 100);
    }
    const ends = {};
    for (const e of adapter.cy.edges()) {
      const s = e.sourceEndpoint(),
        t = e.targetEndpoint();
      ends[e.id()] = [s.x, s.y, t.x, t.y].map((n) => Math.round(n * 100) / 100);
    }
    return { rects, ends };
  });
const blankPoint = (page, id) =>
  card(page, id).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    for (let y = 6; y < rect.height - 6; y += 6) {
      for (let x = 6; x < rect.width - 6; x += 6) {
        const target = document.elementFromPoint(rect.left + x, rect.top + y);
        if (target?.closest('.graph-card') !== element) continue;
        if (
          target.closest(
            '.connector, .card-open, .branch-toggle, .resize-handle, .card-pin, .card-created-date, [data-overview-field]',
          )
        )
          continue;
        return { x: rect.left + x, y: rect.top + y };
      }
    }
    throw new Error('No blank area on card');
  });
async function drag(page, id, dx, dy) {
  const start = await blankPoint(page, id);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 });
  await page.mouse.up();
}

test('Note Board: toggle dims everything outside the branch, follows selection, exits by button and Escape', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await loadTree(page);
  await expect(focusButton(page)).toBeDisabled();
  await choose(page, 'a');
  await expect(focusButton(page)).toBeEnabled();
  await expect(focusButton(page)).toHaveAttribute('aria-pressed', 'false');
  expect(Object.values(await opacities(page)).every((v) => v === 1)).toBe(true);
  // Selecting alone does not start Focus.
  await toggleFocus(page);
  await expect(focusButton(page)).toHaveAttribute('aria-pressed', 'true');
  // Note Board follows every outgoing relation, including the reference link to e.
  await expectBranch(page, ['a', 'b', 'c', 'd', 'e'], []);
  expect(await edgeDim(page)).toMatchObject({ ab: false, bc: false, bd: false, be: false });
  // Another card switches the branch while the mode stays on.
  await choose(page, 'c');
  await expect(focusButton(page)).toHaveAttribute('aria-pressed', 'true');
  await expectBranch(page, ['c'], ['ab', 'bc', 'bd', 'be']);
  await choose(page, 'b');
  await expectBranch(page, ['b', 'c', 'd', 'e'], ['ab']);
  // First Escape exits Focus only and keeps the selection; the second clears it.
  await page.keyboard.press('Escape');
  await expect(focusButton(page)).toHaveAttribute('aria-pressed', 'false');
  expect(Object.values(await opacities(page)).every((v) => v === 1)).toBe(true);
  expect(Object.values(await edgeDim(page)).some(Boolean)).toBe(false);
  await expect(card(page, 'b')).toHaveClass(/selected/);
  await page.keyboard.press('Escape');
  await expect(card(page, 'b')).not.toHaveClass(/selected/);
  // Pressing the button again exits as well.
  await choose(page, 'a');
  await toggleFocus(page);
  await expectBranch(page, ['a', 'b', 'c', 'd', 'e']);
  await toggleFocus(page);
  await expect(focusButton(page)).toHaveAttribute('aria-pressed', 'false');
  expect(Object.values(await opacities(page)).every((v) => v === 1)).toBe(true);
  expect(errors).toEqual([]);
});

test('Mind Map follows only branch relations; collapsed nodes stay highlighted with their count', async ({
  page,
}) => {
  await loadTree(page);
  await switchMapView(page, 'mind');
  await choose(page, 'a');
  await toggleFocus(page);
  await expectBranch(page, ['a', 'b', 'c', 'd'], ['be']);
  await card(page, 'b').locator('.branch-toggle').click();
  await expect(card(page, 'b').locator('.branch-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(focusButton(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page, 'c')).toBeHidden();
  expect(await opacities(page)).toMatchObject({ a: 1, b: 1 });
  await expect(card(page, 'b').locator('.branch-toggle')).toContainText('+2');
  await expect(card(page, 'e')).toHaveCSS('opacity', /^0?\.\d+$/);
  // Expanding again restores the hidden nodes with the same highlight.
  await card(page, 'b').locator('.branch-toggle').click();
  await expectBranch(page, ['a', 'b', 'c', 'd'], ['be']);
  // The mode survives a view switch (new geometry, same selection).
  await switchMapView(page, 'card');
  await expect(focusButton(page)).toHaveAttribute('aria-pressed', 'true');
  await expectBranch(page, ['a', 'b', 'c', 'd', 'e']);
});

test('cycles are safe and loose cards leave only themselves highlighted', async ({ page }) => {
  await load(
    page,
    fixture(
      ['x', 'y', 'z'],
      [
        ['xy', 'x', 'y', {}],
        ['yx', 'y', 'x', {}],
      ],
      { x: { x: 40, y: 120 }, y: { x: 340, y: 120 }, z: { x: 340, y: 360 } },
    ),
  );
  await choose(page, 'x');
  await toggleFocus(page);
  const o = await opacities(page);
  expect(o.x).toBe(1);
  expect(o.y).toBe(1);
  await expect(card(page, 'z')).toHaveCSS('opacity', /^0?\.\d+$/);
  await choose(page, 'z');
  await expect(card(page, 'x')).toHaveCSS('opacity', /^0?\.\d+$/);
  await expect(card(page, 'z')).toHaveCSS('opacity', '1');
});

test('Focus is session state only and does not move cards or relation endpoints', async ({
  page,
}) => {
  await loadTree(page);
  await choose(page, 'b');
  const beforeState = await state(page);
  const beforeGeometry = await geometry(page);
  await toggleFocus(page);
  await expectBranch(page, ['b', 'c', 'd', 'e']);
  // Focus centers the selected card by panning/zooming like before, so compare in graph space.
  const onState = await state(page);
  expect(onState).toBe(beforeState);
  const onGeometry = await geometry(page);
  expect(Object.keys(onGeometry.rects)).toEqual(Object.keys(beforeGeometry.rects));
  await toggleFocus(page);
  const afterGeometry = await geometry(page);
  // Toggling off does not change the viewport: the geometry equals the one measured while on.
  expect(afterGeometry).toEqual(onGeometry);
  expect(await state(page)).toBe(beforeState);
  const savedLabel = await page.locator('#save-state').textContent();
  await toggleFocus(page);
  await expect(page.locator('#save-state')).toHaveText(savedLabel);
  await toggleFocus(page);
  // Pan/zoom is the only change: card size ratios and relative placement stay in graph space.
  const ratio = (g) => [
    g.rects.b[2] / g.rects.a[2],
    g.rects.b[3] / g.rects.a[3],
    (g.rects.b[0] - g.rects.a[0]) / g.rects.a[2],
    (g.rects.b[1] - g.rects.a[1]) / g.rects.a[2],
  ];
  const now = ratio(await geometry(page));
  ratio(beforeGeometry).forEach((value, i) => expect(now[i]).toBeCloseTo(value, 1));
});

test('dimmed cards still drag (one undo step) and edit through the popup', async ({ page }) => {
  await loadTree(page);
  await choose(page, 'a');
  await toggleFocus(page);
  await expectBranch(page, ['a', 'b', 'c', 'd', 'e']);
  const before = JSON.parse(await state(page));
  const box = await card(page, 'f').boundingBox();
  await drag(page, 'f', 60, 40);
  const moved = JSON.parse(await state(page));
  expect(moved.undo).toBe(before.undo + 1);
  const after = await card(page, 'f').boundingBox();
  expect(after.x).not.toBeCloseTo(box.x, 0);
  await page.locator('[data-action=undo]').first().click();
  expect(JSON.parse(await state(page)).project).toEqual(before.project);
  // Undo keeps the mode (and the selection) on.
  await expect(focusButton(page)).toHaveAttribute('aria-pressed', 'true');
  await choose(page, 'a');
  await card(page, 'g').locator('h3').click();
  const popup = page.locator('#card-overview-editor');
  await expect(popup).toBeVisible();
  await page.locator('#overview-text').fill('Edited while dimmed');
  await page.locator('[data-overview-apply]').click();
  await expect(card(page, 'g').locator('h3')).toHaveText('Edited while dimmed');
  expect(JSON.parse(await state(page)).undo).toBe(before.undo + 1);
});

test('selecting a relation or clearing the selection exits; Focus on a relation keeps its old behavior', async ({
  page,
}) => {
  await loadTree(page);
  await choose(page, 'a');
  await toggleFocus(page);
  await expect(focusButton(page)).toHaveAttribute('aria-pressed', 'true');
  // Clicking blank canvas clears the selection and leaves Focus.
  const blank = await page.evaluate(() => {
    const region = document.querySelector('#canvas-region').getBoundingClientRect();
    for (let y = region.bottom - 20; y > region.top; y -= 25)
      for (let x = region.left + 20; x < region.right; x += 25) {
        const hit = document.elementFromPoint(x, y);
        if (
          hit?.closest('#canvas-region') &&
          !hit.closest(
            '.graph-card,button,.zoom-controls,.chatgpt-launcher,[hidden],details,#welcome',
          )
        )
          return { x, y };
      }
    throw new Error('No blank canvas point');
  });
  await page.mouse.click(blank.x, blank.y);
  await expect(focusButton(page)).toHaveAttribute('aria-pressed', 'false');
  expect(Object.values(await opacities(page)).every((v) => v === 1)).toBe(true);
  // Relation selection: the old center-on-relation action, no mode.
  const mid = await page.evaluate(async () => {
    const { adapter } = await import('/assets/js/app.js');
    const m = adapter.cy.getElementById('r:ab').renderedMidpoint();
    const box = document.querySelector('#canvas-region').getBoundingClientRect();
    return { x: box.x + m.x, y: box.y + m.y };
  });
  await page.mouse.click(mid.x, mid.y);
  await expect(focusButton(page)).toBeEnabled();
  await toggleFocus(page);
  await expect(focusButton(page)).toHaveAttribute('aria-pressed', 'false');
  expect(Object.values(await opacities(page)).every((v) => v === 1)).toBe(true);
});

test('keyboard: Tab reaches Focus, Enter and Space toggle, title and name follow state in vi and en', async ({
  page,
}) => {
  await loadTree(page);
  await choose(page, 'a');
  await page.locator('[data-action=fit]').focus();
  await page.keyboard.press('Tab');
  await expect(focusButton(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(focusButton(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(focusButton(page)).toHaveAttribute('title', 'Thoát tập trung nhánh (Esc)');
  await page.keyboard.press('Space');
  await expect(focusButton(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(focusButton(page)).toHaveAttribute('title', /^Tập trung nhánh của note đang chọn/);
  await locale(page, 'en');
  await expect(focusButton(page)).toHaveAttribute('title', /^Focus the selected note's branch/);
  await focusButton(page).press('Enter');
  await expect(focusButton(page)).toHaveAttribute('title', 'Exit branch focus (Esc)');
  await expect(focusButton(page)).toHaveAccessibleName('Exit branch focus (Esc)');
  // Locale change keeps the mode and the highlight.
  await locale(page, 'vi');
  await expect(focusButton(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(focusButton(page)).toHaveAttribute('title', 'Thoát tập trung nhánh (Esc)');
  await expectBranch(page, ['a', 'b', 'c', 'd', 'e']);
});

test('Focus does not close or apply a pending Detail draft', async ({ page }) => {
  await loadTree(page);
  await choose(page, 'a');
  await card(page, 'a').locator('.card-open').click();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await page.locator('#detail-tools summary').click();
  const panelFocus = page.locator('[data-panel-action=focus]');
  await panelFocus.click();
  await expect(panelFocus).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#detail-panel')).toBeVisible();
  await panelFocus.click();
  await expect(panelFocus).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#detail-panel')).toBeVisible();
});
