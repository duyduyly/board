import { test, expect } from '@playwright/test';

const MIND = 'card-atlas:mind-map';
const SHAPES = ['triangle', 'star', 'heart', 'diamond', 'arrow'];

/** A Mind Map with a root and unlinked nodes: one plain card and one node per shape, each with a leaf. */
function project() {
  const kinds = [null, ...SHAPES];
  const cards = [{ id: 'root', title: 'Root', content: '', position: { x: 0, y: 0 } }];
  const positions = { root: { x: 0, y: 0 } };
  const sizes = {};
  kinds.forEach((shape, index) => {
    const side = index % 2 ? -1 : 1;
    const y = Math.floor(index / 2) * 230 - 230;
    cards.push({
      id: 'node' + index,
      title: shape || 'card',
      content: '',
      position: { x: 0, y: 0 },
      size: { width: 200, height: 160 },
      ...(shape ? { extensions: { 'card-atlas:appearance': { shape } } } : {}),
    });
    cards.push({
      id: 'leaf' + index,
      title: 'leaf ' + index,
      content: '',
      position: { x: 0, y: 0 },
    });
    positions['node' + index] = { x: side * 420, y };
    positions['leaf' + index] = { x: side * 800, y };
    sizes['node' + index] = { width: 200, height: 160 };
  });
  return {
    version: '1.0',
    metadata: { title: 'Mind links' },
    cards,
    relations: [],
    extensions: {
      [MIND]: { rootId: 'root' },
      'card-atlas:views': { mindMap: { positions, sizes } },
    },
  };
}

async function openMindMap(page) {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'mind.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project())),
  });
  await page.locator('[data-choice=apply]').click();
  await page.locator('#map-view button').nth(1).click();
  await page.locator('[data-action=fit]').click();
  await expect(page.locator('.graph-card')).toHaveCount(1 + 2 * (SHAPES.length + 1));
}

const card = (page, id) => page.locator('.graph-card[data-id=' + id + ']');

/** Draws a link with the keyboard: Enter on the source connector, then Enter on the target note. */
async function link(page, source, target) {
  await card(page, source).locator('.connector').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#connect-hint')).toBeVisible();
  await card(page, target).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#connect-hint')).toBeHidden();
}

const relations = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return store.project.relations.map((edge) => ({
      source: edge.source,
      target: edge.target,
      kind: edge.extensions?.['card-atlas:mind-map']?.kind || 'reference',
    }));
  });

test('a hand-drawn link in the Mind Map gives every shape a working collapse toggle', async ({
  page,
}) => {
  await openMindMap(page);
  await expect(page.locator('.branch-toggle')).toHaveCount(0);
  for (let index = 0; index <= SHAPES.length; index += 1) {
    const node = 'node' + index;
    const leaf = 'leaf' + index;
    await link(page, node, leaf);
    const toggle = card(page, node).locator('.branch-toggle');
    await expect(toggle, node).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await expect(card(page, leaf)).toBeHidden();
    await expect(card(page, node).locator('.branch-toggle')).toHaveText('+1');
    await card(page, node).locator('.branch-toggle').click();
    await expect(card(page, leaf)).toBeVisible();
  }
  const all = await relations(page);
  expect(all).toHaveLength(SHAPES.length + 1);
  expect(all.every((edge) => edge.kind === 'branch')).toBe(true);
});

test('a second parent or a link back to an ancestor stays a reference', async ({ page }) => {
  await openMindMap(page);
  await link(page, 'root', 'node0');
  await link(page, 'node0', 'leaf0');
  await link(page, 'node1', 'leaf0');
  await link(page, 'leaf0', 'root');
  expect(await relations(page)).toEqual([
    { source: 'root', target: 'node0', kind: 'branch' },
    { source: 'node0', target: 'leaf0', kind: 'branch' },
    { source: 'node1', target: 'leaf0', kind: 'reference' },
    { source: 'leaf0', target: 'root', kind: 'reference' },
  ]);
  await expect(card(page, 'node1').locator('.branch-toggle')).toHaveCount(0);
});

test('links drawn on the Note Board are left as plain links', async ({ page }) => {
  await openMindMap(page);
  await page.locator('#map-view button').nth(0).click();
  await page.locator('[data-action=fit]').click();
  await link(page, 'node0', 'leaf0');
  expect(await relations(page)).toEqual([{ source: 'node0', target: 'leaf0', kind: 'reference' }]);
});
