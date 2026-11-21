import { test, expect } from '@playwright/test';
import { projectAction, view } from './ui-driver.mjs';

const GROUPS = 'card-atlas:groups';
const card = (id, title, x, y) => ({ id, title, content: '', position: { x, y } });

async function loadProject(page) {
  const project = {
    version: '1.0',
    metadata: { title: 'Nested groups' },
    cards: [
      card('a', 'Vision', 0, 0),
      card('b', 'Sign up', 0, 330),
      card('c', 'Sign in', 300, 330),
      card('d', 'OTP', 650, 330),
      card('e', 'Loose', 0, 900),
    ],
    relations: [],
    extensions: {
      [GROUPS]: {
        groups: [
          { id: 'outer', title: 'Product', cardIds: ['a'] },
          { id: 'inner', title: 'Auth', cardIds: ['b', 'c'], parentId: 'outer' },
          { id: 'deep', title: 'Security', cardIds: ['d'], parentId: 'inner' },
        ],
      },
    },
  };
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'nested.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-action=fit]').click();
  await expect(page.locator('.group-frame')).toHaveCount(3);
}

const frame = (page, id) => page.locator('.group-frame[data-group-id=' + id + ']');
const handle = (page, id) => frame(page, id).locator('.group-frame-handle');
const state = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return {
      groups: store.project.extensions['card-atlas:groups']?.groups ?? [],
      positions: Object.fromEntries(store.project.cards.map((c) => [c.id, c.position])),
    };
  });
const contains = (outer, inner) =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.width >= inner.x + inner.width &&
  outer.y + outer.height >= inner.y + inner.height;

test('nested frames enclose each other and count the notes of every level', async ({ page }) => {
  await loadProject(page);
  const outer = await frame(page, 'outer').boundingBox();
  const inner = await frame(page, 'inner').boundingBox();
  const deep = await frame(page, 'deep').boundingBox();
  expect(contains(outer, inner)).toBe(true);
  expect(contains(inner, deep)).toBe(true);
  await expect(handle(page, 'outer')).toHaveText('Product · 4');
  await expect(handle(page, 'inner')).toHaveText('Auth · 3');
  await expect(handle(page, 'deep')).toHaveText('Security · 1');
  await view(page, 'mind');
  await page.locator('[data-action=fit]').click();
  await expect(page.locator('.group-frame:visible')).toHaveCount(3);
});

test('selecting notes inside one group creates a subgroup of it', async ({ page }) => {
  await loadProject(page);
  await page.locator('.graph-card[data-id=b]').click();
  await page.locator('.graph-card[data-id=c]').click({ modifiers: ['Shift'] });
  const create = page.locator('[data-action=group-create]');
  await expect(create).toBeEnabled();
  await expect(create).toHaveAttribute('title', 'Tạo nhóm con từ các note đang chọn');
  await create.click();
  await expect(page.locator('.group-editor')).toContainText('nhóm con trong “Auth”');
  await page.keyboard.type('Forms');
  await page.locator('[data-choice=save-group]').click();
  await expect(page.locator('.group-frame')).toHaveCount(4);
  const groups = (await state(page)).groups;
  const forms = groups.find((g) => g.title === 'Forms');
  expect(forms.parentId).toBe('inner');
  expect(forms.cardIds).toEqual(['b', 'c']);
  expect(groups.find((g) => g.id === 'inner').cardIds).toEqual([]);
  await projectAction(page, 'undo');
  await expect(page.locator('.group-frame')).toHaveCount(3);
});

test('notes from different groups, or grouped and loose notes, cannot form a group', async ({
  page,
}) => {
  await loadProject(page);
  await page.locator('.graph-card[data-id=a]').click();
  await page.locator('.graph-card[data-id=b]').click({ modifiers: ['Shift'] });
  const create = page.locator('[data-action=group-create]');
  await expect(create).toBeDisabled();
  await page.keyboard.press('Escape');
  const deep = (await state(page)).groups.find((g) => g.id === 'deep');
  expect(deep.cardIds).toEqual(['d']);
  await page.locator('.graph-card[data-id=d]').click();
  await page.locator('.graph-card[data-id=e]').click({ modifiers: ['Shift'] });
  await expect(create).toBeDisabled();
});

test('dragging the outer frame moves the notes of every nested group, as one Undo step', async ({
  page,
}) => {
  await loadProject(page);
  const before = await state(page);
  const box = await handle(page, 'outer').boundingBox();
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + box.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  const after = await state(page);
  const moved = (id) => after.positions[id].x - before.positions[id].x;
  for (const id of ['a', 'b', 'c', 'd']) expect(moved(id), id).toBeGreaterThan(20);
  expect(after.positions.e).toEqual(before.positions.e);
  await projectAction(page, 'undo');
  expect((await state(page)).positions).toEqual(before.positions);
});

test('ungrouping a middle group moves its notes and subgroup up one level', async ({ page }) => {
  await loadProject(page);
  await frame(page, 'inner').locator('[data-group-action=ungroup]').click();
  await expect(page.locator('.group-frame')).toHaveCount(2);
  const groups = (await state(page)).groups;
  expect(groups.find((g) => g.id === 'outer').cardIds).toEqual(['a', 'b', 'c']);
  expect(groups.find((g) => g.id === 'deep').parentId).toBe('outer');
  await expect(handle(page, 'outer')).toHaveText('Product · 4');
});

test('the dialog lists subgroups and moves a group to another parent', async ({ page }) => {
  await loadProject(page);
  await frame(page, 'inner').locator('[data-group-action=edit]').click();
  await expect(page.locator('.group-editor-section legend', { hasText: 'Nhóm con' })).toHaveText(
    'Nhóm con (1)',
  );
  await expect(page.locator('.group-editor-item', { hasText: 'Security' })).toContainText('1 note');
  const parent = page.getByLabel('Nằm trong nhóm');
  await expect(parent).toHaveValue('outer');
  await parent.selectOption('');
  await page.locator('[data-choice=save-group]').click();
  const inner = (await state(page)).groups.find((g) => g.id === 'inner');
  expect(inner.parentId).toBeUndefined();
  await expect(handle(page, 'outer')).toHaveText('Product · 1');
  // Taking a note out of a subgroup returns it to the parent group.
  await frame(page, 'deep').locator('[data-group-action=edit]').click();
  await expect(page.getByLabel('Nằm trong nhóm').locator('option')).toHaveText([
    'Không (nhóm ngoài cùng)',
    'Product',
    'Auth',
  ]);
  await page.keyboard.press('Escape');
});
