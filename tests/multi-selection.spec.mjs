import { test, expect } from '@playwright/test';

const snapshot = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return {
      p: store.project,
      history: store.undoStack.length,
      dirty: store.dirty,
      viewport: store.viewport,
    };
  });
const card = (page, id) => page.locator(`.graph-card[data-id="${id}"]`);
async function setup(page) {
  await page.goto('/');
  const cards = ['a', 'b', 'c', 'd'].map((id, i) => ({
    id,
    title: 'Card ' + id,
    summary: 'Example ' + id,
    type: 'test',
    tags: [],
    content: '# Lesson ' + id + '\n\nFull content',
    position: { x: 50 + (i % 2) * 320, y: 50 + Math.floor(i / 2) * 240 },
    size: { width: 220, height: 160 },
    style: { backgroundColor: '#ffffff', textColor: '#203047', borderColor: '#64748b' },
    extensions:
      i === 1
        ? { 'card-atlas:metadata': { pinned: true } }
        : i === 2
          ? { 'card-atlas:node': { kind: 'text' } }
          : {},
  }));
  const project = {
    version: '1.0',
    metadata: { title: 'Multi selection', description: '' },
    canvas: { zoom: 1, position: { x: 40, y: 30 } },
    cards,
    relations: [
      {
        id: 'ab',
        source: 'a',
        target: 'b',
        extensions: { 'card-atlas:mind-map': { kind: 'branch' } },
      },
    ],
    extensions: {
      'card-atlas:mind-map': { rootId: 'a' },
      'card-atlas:views': {
        mindMap: {
          positions: Object.fromEntries(cards.map((c) => [c.id, { ...c.position }])),
          sizes: Object.fromEntries(cards.map((c) => [c.id, { ...c.size }])),
          viewport: { zoom: 1, position: { x: 40, y: 30 } },
        },
      },
    },
  };
  await page.locator('#file-input').setInputFiles({
    name: 'multi.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await expect(page.locator('.graph-card')).toHaveCount(4);
}
async function choose(page, id, shift = false, text = false) {
  const el = text ? card(page, id).locator('h3') : card(page, id);
  const box = await el.boundingBox();
  await el.click({
    modifiers: shift ? ['Shift'] : [],
    ...(text ? {} : { position: { x: 25, y: box.height - 24 } }),
  });
}
async function drag(page, id, dx, dy, finish = true) {
  const box = await card(page, id).boundingBox();
  await page.mouse.move(box.x + 25, box.y + box.height - 24);
  await page.mouse.down();
  await page.mouse.move(box.x + 25 + dx, box.y + box.height - 24 + dy, { steps: 8 });
  if (finish) await page.mouse.up();
}
test('Shift selection across text/pin and keyboard, group drag is one undo in both views', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await setup(page);
  for (const view of ['card', 'mind']) {
    await page.locator('#map-view').selectOption(view);
    await choose(page, 'a');
    await choose(page, 'b', true, true);
    await choose(page, 'c', true, true);
    await expect(page.locator('.graph-card.selected')).toHaveCount(3);
    await expect(page.locator('#card-overview-editor')).not.toBeVisible();
    await expect(page.locator('#detail-panel')).not.toBeVisible();
    await choose(page, 'c', true, true);
    await expect(page.locator('.graph-card.selected')).toHaveCount(2);
    await card(page, 'c').focus();
    await page.keyboard.press('Shift+Space');
    await expect(page.locator('.graph-card.selected')).toHaveCount(3);
    const before = await snapshot(page);
    await drag(page, 'a', 70, 35, false);
    expect((await snapshot(page)).p).toEqual(before.p);
    await page.mouse.up();
    const after = await snapshot(page);
    expect(after.history).toBe(before.history + 1);
    const positions = (p) =>
      view === 'card'
        ? Object.fromEntries(p.cards.map((c) => [c.id, c.position]))
        : p.extensions['card-atlas:views'].mindMap.positions;
    for (const id of ['a', 'c']) {
      expect(positions(after.p)[id].x - positions(before.p)[id].x).toBeCloseTo(70, 1);
      expect(positions(after.p)[id].y - positions(before.p)[id].y).toBeCloseTo(35, 1);
    }
    expect(after.p.cards[1]).toEqual(before.p.cards[1]);
    expect(positions(after.p).b).toEqual(positions(before.p).b);
    await page.keyboard.press('Control+z');
    expect((await snapshot(page)).p).toEqual(before.p);
    await page.keyboard.press('Control+Shift+z');
    expect((await snapshot(page)).p).toEqual(after.p);
    await page.locator('#locale').selectOption('en');
    await expect(page.locator('#selection-count')).toContainText('3 cards selected');
    await page.keyboard.press('Delete');
    expect((await snapshot(page)).p).toEqual(after.p);
    await page.locator('[data-action=clear-selection]').click();
    await expect(page.locator('.graph-card.selected')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
test('reverse marquee at zoom adds visible nodes without panning or history, Escape cancels group preview', async ({
  page,
}) => {
  await setup(page);
  await page.locator('[data-action=zoom-out]').click();
  await page.locator('[data-action=zoom-out]').click();
  await choose(page, 'c');
  const a = await card(page, 'a').boundingBox(),
    b = await card(page, 'b').boundingBox();
  const before = await snapshot(page);
  await page.keyboard.down('Shift');
  await page.mouse.move(b.x + b.width + 12, b.y + b.height + 12);
  await page.mouse.down();
  await page.mouse.move(a.x - 12, a.y - 12, { steps: 10 });
  await expect(page.locator('.selection-marquee')).toHaveCount(1);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.locator('.graph-card.selected')).toHaveCount(3);
  expect(await snapshot(page)).toEqual(before);
  await drag(page, 'a', 40, 25, false);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect(await snapshot(page)).toEqual(before);
  expect(await card(page, 'a').boundingBox()).toEqual(a);
  await expect(page.locator('.selection-marquee')).toHaveCount(0);
  await expect(page.locator('.graph-card.selected')).toHaveCount(3);
  await drag(page, 'a', 40, 25, false);
  await card(page, 'a').dispatchEvent('pointercancel');
  await page.mouse.up();
  expect(await snapshot(page)).toEqual(before);
  expect(await card(page, 'a').boundingBox()).toEqual(a);
  await page.evaluate(() =>
    document.querySelector('#canvas-region').addEventListener(
      'pointerdown',
      (e) => {
        window.gesturePointer = e.pointerId;
      },
      { once: true, capture: true },
    ),
  );
  await drag(page, 'a', 40, 25, false);
  await card(page, 'a').evaluate((el) => el.releasePointerCapture(window.gesturePointer));
  await page.mouse.move(a.x + 60, a.y + a.height - 10);
  await page.mouse.up();
  expect(await snapshot(page)).toEqual(before);
  expect(await card(page, 'a').boundingBox()).toEqual(a);
  await page.keyboard.press('Escape');
  await expect(page.locator('.graph-card.selected')).toHaveCount(0);
});
test('group selection clears for Detail/view and hidden collapsed nodes are excluded from marquee', async ({
  page,
}) => {
  await setup(page);
  await choose(page, 'a');
  await choose(page, 'c', true);
  await card(page, 'a').locator('.card-open').click();
  await expect(page.locator('#detail-panel')).toBeVisible();
  await expect(page.locator('.graph-card.selected')).toHaveCount(1);
  await page.locator('[data-action=close]').click();
  await choose(page, 'c', true);
  await page.locator('#map-view').selectOption('mind');
  await expect(page.locator('.graph-card.selected')).toHaveCount(1);
  await card(page, 'a').locator('.branch-toggle').click();
  await expect(card(page, 'b')).toBeHidden();
  await page.keyboard.press('Escape');
  const a = await card(page, 'a').boundingBox(),
    d = await card(page, 'd').boundingBox();
  await page.keyboard.down('Shift');
  await page.mouse.move(a.x - 10, a.y - 10);
  await page.mouse.down();
  await page.mouse.move(d.x + d.width + 10, d.y + d.height + 10, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.locator('.graph-card.selected')).toHaveCount(3);
  await expect(card(page, 'b')).not.toHaveClass(/selected/);
  await page.locator('#theme-toggle').click();
  await page.screenshot({ path: 'planning/design/multi-selection-dark.png' });
});

test('zoomed group uses graph delta, blank clears, blur and view switch cancel previews', async ({
  page,
}) => {
  await setup(page);
  await page.locator('[data-action=zoom-out]').click();
  await choose(page, 'a');
  await choose(page, 'c', true);
  const before = await snapshot(page);
  await drag(page, 'a', 50, 25);
  const after = await snapshot(page);
  for (const index of [0, 2]) {
    expect(after.p.cards[index].position.x - before.p.cards[index].position.x).toBeCloseTo(
      50 / before.viewport.zoom,
      1,
    );
    expect(after.p.cards[index].position.y - before.p.cards[index].position.y).toBeCloseTo(
      25 / before.viewport.zoom,
      1,
    );
  }
  await drag(page, 'a', 35, 15, false);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  expect((await snapshot(page)).p).toEqual(after.p);
  await drag(page, 'a', 35, 15, false);
  await page.locator('#map-view').selectOption('mind');
  await page.mouse.up();
  expect((await snapshot(page)).p).toEqual(after.p);
  await expect(page.locator('.graph-card.selected')).toHaveCount(1);
  await choose(page, 'c', true);
  const region = await page.locator('#canvas-region').boundingBox();
  await page.mouse.click(region.x + region.width - 80, region.y + region.height - 160);
  await expect(page.locator('.graph-card.selected')).toHaveCount(0);
  await choose(page, 'a');
  await choose(page, 'c', true);
  await card(page, 'a').locator('h3').click();
  await expect(page.locator('#card-overview-editor')).toBeVisible();
  await expect(page.locator('.graph-card.selected')).toHaveCount(1);
  await page.keyboard.press('Escape');
  const captured = await snapshot(page);
  expect(captured.p).toEqual(after.p);
  expect(captured.history).toBe(after.history);
});
