import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { projectAction } from './ui-driver.mjs';
const state = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return { p: store.project, history: store.undoStack.length };
  });
const card = (page, id) => page.locator(`.graph-card[data-id="${id}"]`);
async function setup(page, smallText = false) {
  await page.goto('/');
  const image = {
    name: 'caption.png',
    mimeType: 'image/png',
    data: (await fs.readFile('tests/fixtures/english-endings.png')).toString('base64'),
  };
  const cards = ['a', 'b', 'c', 'd'].map((id, i) => ({
    id,
    title: 'Title ' + id,
    summary: 'Summary ' + id,
    content: '# Original ' + id,
    position: { x: (i % 2) * 400 + 60, y: Math.floor(i / 2) * 280 + 70 },
    size: { width: 260, height: i === 0 && smallText ? 80 : 220 },
    extensions: {
      'card-atlas:node': {
        kind: ['text', 'image-text', 'image', 'card'][i],
        ...([1, 2].includes(i) ? { coverImageId: 'cover' } : {}),
      },
      ...([1, 2].includes(i) ? { 'card-atlas:images': { cover: image } } : {}),
      ...(i === 1 ? { 'card-atlas:metadata': { pinned: true } } : {}),
    },
  }));
  const p = {
    version: '1.0',
    metadata: { title: 'Frames and captions' },
    canvas: { zoom: 1, position: { x: 40, y: 30 } },
    cards,
    relations: [{ id: 'r', source: 'a', target: 'd', label: 'link' }],
    extensions: {
      'card-atlas:views': {
        mindMap: {
          positions: Object.fromEntries(cards.map((c) => [c.id, c.position])),
          sizes: Object.fromEntries(cards.map((c) => [c.id, c.size])),
          viewport: { zoom: 1, position: { x: 40, y: 30 } },
        },
      },
    },
  };
  await page.locator('#file-input').setInputFiles({
    name: 'frames.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.locator('[data-choice=apply]').click();
  await expect(page.locator('.graph-card')).toHaveCount(4);
}
test('legacy 80px text nodes show a readable summary without changing geometry', async ({
  page,
}) => {
  await setup(page, true);
  const before = await state(page);
  for (const view of ['card', 'mind']) {
    await page.locator('#map-view').selectOption(view);
    const bounds = await card(page, 'a').boundingBox();
    const summary = await card(page, 'a').locator('.card-summary').boundingBox();
    expect(summary.height).toBeGreaterThan(12);
    expect(summary.y + summary.height).toBeLessThanOrEqual(bounds.y + bounds.height);
    await expect(card(page, 'a').locator('h3')).toHaveText('Title a');
  }
  expect((await state(page)).p).toEqual(before.p);
});
async function select(page, id, shift = false) {
  const box = await card(page, id).boundingBox();
  await card(page, id).click({
    position: { x: 25, y: box.height - 16 },
    modifiers: shift ? ['Shift'] : [],
  });
}
test('image summary replaces Canvas title, text shows both; Detail retains title and popup edits summary', async ({
  page,
}) => {
  await setup(page);
  for (const view of ['card', 'mind']) {
    await page.locator('#map-view').selectOption(view);
    await expect(card(page, 'a').locator('h3')).toHaveText('Title a');
    await expect(card(page, 'a').locator('.card-summary')).toHaveText('Summary a');
    for (const id of ['b', 'c']) {
      await expect(card(page, id).locator('h3')).toHaveCount(0);
      await expect(card(page, id).locator('.card-summary')).toHaveText('Summary ' + id);
    }
    await card(page, 'b').locator('.card-open').click();
    await expect(page.locator('#panel-title')).toHaveText('Title b');
    await page.locator('[data-action=close]').click();
  }
  await card(page, 'c').locator('.card-summary').click();
  await expect(page.locator('#overview-field')).toHaveValue('summary');
  await page.locator('#overview-text').fill('New image caption');
  await page.locator('[data-overview-apply]').click();
  await expect(card(page, 'c').locator('.card-summary')).toHaveText('New image caption');
  expect((await state(page)).p.cards[2].title).toBe('Title c');
});
test('named frames drag members with pinned card fixed, cancel, rename, ungroup and Undo in both views', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await setup(page);
  await select(page, 'a');
  await select(page, 'b', true);
  await page.locator('[data-action=group-create]').click();
  await page.locator('[name=group-name]').fill('Learning group');
  await page.locator('[data-choice=save-group]').click();
  const frame = page.locator('.group-frame'),
    handle = frame.locator('.group-frame-handle');
  await expect(frame).toBeVisible();
  await expect(handle).toContainText('Learning group');
  for (const view of ['card', 'mind']) {
    await page.locator('#map-view').selectOption(view);
    const before = await state(page);
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + 30, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 80, box.y + 45, { steps: 8 });
    expect((await state(page)).p).toEqual(before.p);
    await page.mouse.up();
    const after = await state(page);
    expect(after.history).toBe(before.history + 1);
    expect(after.p.cards[1]).toEqual(before.p.cards[1]);
    const positions = (p) =>
      view === 'card'
        ? Object.fromEntries(p.cards.map((c) => [c.id, c.position]))
        : p.extensions['card-atlas:views'].mindMap.positions;
    expect(positions(after.p).a.x - positions(before.p).a.x).toBeCloseTo(50, 1);
    expect(positions(after.p).b).toEqual(positions(before.p).b);
    await page.keyboard.press('Control+z');
    expect((await state(page)).p).toEqual(before.p);
    await page.keyboard.press('Control+Shift+z');
    expect((await state(page)).p).toEqual(after.p);
    const next = await handle.boundingBox();
    await page.mouse.move(next.x + 20, next.y + 10);
    await page.mouse.down();
    await page.mouse.move(next.x + 50, next.y + 40, { steps: 5 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect((await state(page)).p).toEqual(after.p);
  }
  await frame.locator('[data-group-action=edit]').click();
  await page.locator('[name=group-name]').fill('Renamed');
  await page.locator('[data-choice=save-group]').click();
  await expect(handle).toContainText('Renamed');
  await frame.locator('[data-group-action=ungroup]').click();
  await expect(frame).toHaveCount(0);
  await expect(page.locator('.graph-card')).toHaveCount(4);
  await page.keyboard.press('Control+z');
  await expect(frame).toHaveCount(1);
  await page.locator('#locale').selectOption('en');
  await page.locator('#theme-toggle').click();
  await page.screenshot({ path: 'planning/design/group-frame-dark.png' });
  expect(errors).toEqual([]);
});
test('routing editor persists straight, orthogonal and zigzag with Undo, preserving endpoints', async ({
  page,
}) => {
  await setup(page);
  await card(page, 'a').locator('.card-open').click();
  const links = page.locator('#relations-list [data-rel]');
  if (await links.count()) await links.first().click();
  else {
    await page.locator('[data-action=close]').click();
    const region = await page.locator('#canvas-region').boundingBox();
    // Click the visible connection label between the diagonal endpoints.
    await page.mouse.click(region.x + 40 + 390, region.y + 30 + 320);
  }
  await expect(page.locator('[name=edge-route]')).toBeVisible();
  for (const [route, style] of [
    ['straight', 'straight'],
    ['orthogonal', 'taxi'],
    ['zigzag', 'segments'],
    ['curved', 'bezier'],
  ]) {
    const before = await state(page);
    await page.locator('[name=edge-route]').selectOption(route);
    await page.locator('#panel-body form [type=submit]').click();
    const s = await state(page);
    expect(s.p.relations[0].extensions['card-atlas:edge'].route).toBe(route);
    expect([s.p.relations[0].source, s.p.relations[0].target]).toEqual(['a', 'd']);
    expect(
      await page.evaluate(async () => {
        const { adapter } = await import('/assets/js/app.js');
        return adapter.cy.getElementById('r:r').style('curve-style');
      }),
    ).toBe(style);
    await projectAction(page, 'undo');
    expect((await state(page)).p).toEqual(before.p);
    await projectAction(page, 'redo');
    expect((await state(page)).p).toEqual(s.p);
  }
});

test('frame drag without pins, membership cleanup and project export/import preserve groups', async ({
  page,
}) => {
  await setup(page);
  await select(page, 'a');
  await select(page, 'c', true);
  await page.locator('[data-action=group-create]').click();
  await page.locator('[name=group-name]').fill('Portable');
  await page.locator('[data-choice=save-group]').click();
  const frame = page.locator('.group-frame'),
    handle = frame.locator('.group-frame-handle');
  const before = await state(page),
    box = await handle.boundingBox();
  await page.mouse.move(box.x + 25, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 65, box.y + 30, { steps: 8 });
  await page.mouse.up();
  const after = await state(page);
  for (const i of [0, 2])
    expect(after.p.cards[i].position.x - before.p.cards[i].position.x).toBeCloseTo(40, 1);
  await frame.locator('[data-group-action=edit]').click();
  for (const box of await page.locator('.group-members input').all()) await box.uncheck();
  await expect(page.locator('[data-choice=save-group]')).toBeDisabled();
  await page.locator('[data-choice=cancel]').click();
  expect((await state(page)).p).toEqual(after.p);
  await page.keyboard.press('Escape');
  await select(page, 'a');
  await page.keyboard.press('Delete');
  await expect(page.locator('.graph-card')).toHaveCount(3);
  await expect(handle).toContainText('· 1');
  await page.keyboard.press('Control+z');
  expect((await state(page)).p).toEqual(after.p);
  const pending = page.waitForEvent('download');
  await page.locator('[data-action=export]').click();
  const exported = JSON.parse(await fs.readFile(await (await pending).path(), 'utf8'));
  expect(exported.extensions['card-atlas:groups']).toEqual(after.p.extensions['card-atlas:groups']);
  await page.locator('#file-input').setInputFiles({
    name: 'roundtrip.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await page.locator('[data-choice=apply]').click();
  await expect(frame).toHaveCount(1);
  await expect(handle).toContainText('Portable');
  await page.locator('[data-action=fit]').click();
  await expect(frame).toBeInViewport({ ratio: 1 });
});
