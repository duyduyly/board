import { test, expect } from '@playwright/test';
import { locale, projectAction } from './ui-driver.mjs';

const PASTE_OFFSET = 36;

const state = (page) =>
  page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return {
      cards: store.project.cards.map((card) => ({
        id: card.id,
        title: card.title,
        position: card.position,
        pinned: Boolean(card.extensions?.['card-atlas:metadata']?.pinned),
      })),
      relations: store.project.relations.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
      })),
      undo: store.undoStack.length,
      selected: [...document.querySelectorAll('.graph-card.selected')].map((el) => el.dataset.id),
    };
  });

async function loadProject(page) {
  const project = {
    version: '1.0',
    metadata: { title: 'Copy paste' },
    cards: [
      { id: 'a', title: 'A', content: '', position: { x: 0, y: 0 } },
      {
        id: 'b',
        title: 'B pinned',
        content: '',
        position: { x: 320, y: 0 },
        extensions: { 'card-atlas:metadata': { pinned: true } },
      },
      { id: 'c', title: 'Outside', content: '', position: { x: 0, y: 440 } },
    ],
    relations: [
      { id: 'ab', source: 'a', target: 'b' },
      { id: 'bc', source: 'b', target: 'c' },
    ],
  };
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'source.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-action=fit]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
}

async function marqueePair(page) {
  const a = await page.locator('.graph-card[data-id=a]').boundingBox();
  const b = await page.locator('.graph-card[data-id=b]').boundingBox();
  await page.keyboard.down('Shift');
  await page.mouse.move(b.x + b.width + 10, b.y + b.height + 10);
  await page.mouse.down();
  await page.mouse.move(a.x - 10, a.y - 10, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await expect(page.locator('.graph-card.selected')).toHaveCount(2);
}

const copyOf = (after, before) =>
  after.cards.filter((card) => !before.cards.some((old) => old.id === card.id));

test('Ctrl+C then Ctrl+V pastes a staggered copy of one note and each paste is one Undo step', async ({
  page,
}) => {
  await loadProject(page);
  await page.locator('.graph-card[data-id=c]').click();
  const before = await state(page);
  await page.keyboard.press('Control+c');
  await expect(page.locator('#toast')).toContainText('Đã sao chép 1 note');
  expect((await state(page)).undo).toBe(before.undo);

  await page.keyboard.press('Control+v');
  await expect(page.locator('.graph-card')).toHaveCount(4);
  await expect(page.locator('#toast')).toContainText('Đã thêm 1 bản sao');
  const first = await state(page);
  const [copy] = copyOf(first, before);
  expect(copy.title).toBe('Outside');
  expect(copy.position).toEqual({ x: PASTE_OFFSET, y: 440 + PASTE_OFFSET });
  expect(first.selected).toEqual([copy.id]);
  expect(first.undo).toBe(before.undo + 1);
  expect(first.relations).toHaveLength(2);

  await page.keyboard.press('Control+v');
  await expect(page.locator('.graph-card')).toHaveCount(5);
  const second = await state(page);
  const [next] = copyOf(second, first);
  expect(next.position).toEqual({ x: PASTE_OFFSET * 2, y: 440 + PASTE_OFFSET * 2 });

  await projectAction(page, 'undo');
  await expect(page.locator('.graph-card')).toHaveCount(4);
  await projectAction(page, 'undo');
  await expect(page.locator('.graph-card')).toHaveCount(3);
  expect((await state(page)).cards).toEqual(before.cards);
});

test('copying a marquee selection keeps the connector between the notes and unpins the copies', async ({
  page,
}) => {
  await loadProject(page);
  await marqueePair(page);
  const before = await state(page);
  await page.keyboard.press('Control+c');
  await expect(page.locator('#toast')).toContainText('Đã sao chép 2 note');
  await page.keyboard.press('Control+v');
  await expect(page.locator('.graph-card')).toHaveCount(5);
  const after = await state(page);
  const copies = copyOf(after, before);
  expect(copies.map((card) => card.title).sort()).toEqual(['A', 'B pinned']);
  expect(copies.every((card) => !card.pinned)).toBe(true);
  expect(after.cards.find((card) => card.id === 'b').pinned).toBe(true);
  expect(after.selected.sort()).toEqual(copies.map((card) => card.id).sort());
  const added = after.relations.filter((edge) => !['ab', 'bc'].includes(edge.id));
  expect(added).toHaveLength(1);
  expect(added[0].source).toBe(copies.find((card) => card.title === 'A').id);
  expect(added[0].target).toBe(copies.find((card) => card.title === 'B pinned').id);
  expect(after.undo).toBe(before.undo + 1);

  await projectAction(page, 'undo');
  await expect(page.locator('.graph-card')).toHaveCount(3);
  expect((await state(page)).relations).toEqual(before.relations);
});

test('the Duplicate button and Ctrl+D copy the selection without replacing the copy buffer', async ({
  page,
}) => {
  await loadProject(page);
  await page.locator('.graph-card[data-id=c]').click();
  await page.keyboard.press('Control+c');
  // Escape clears the selection, so the marquee below selects only A and B.
  await page.keyboard.press('Escape');
  await expect(page.locator('.graph-card.selected')).toHaveCount(0);
  await marqueePair(page);
  const duplicate = page.locator('#selection-tools [data-action=selection-duplicate]');
  await expect(duplicate).toHaveText('Nhân bản');
  await duplicate.click();
  await expect(page.locator('.graph-card')).toHaveCount(5);

  await page.keyboard.press('Control+d');
  await expect(page.locator('.graph-card')).toHaveCount(7);

  await page.keyboard.press('Control+v');
  await expect(page.locator('.graph-card')).toHaveCount(8);
  const titles = (await state(page)).cards.map((card) => card.title);
  expect(titles.filter((title) => title === 'Outside')).toHaveLength(2);
});

test('paste does nothing without a copy, while typing in a field, or while Detail is open', async ({
  page,
}) => {
  await loadProject(page);
  await page.keyboard.press('Control+v');
  await expect(page.locator('.graph-card')).toHaveCount(3);

  await page.locator('.graph-card[data-id=c]').click();
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+f');
  await page.keyboard.type('Out');
  await page.keyboard.press('Control+v');
  await expect(page.locator('.graph-card')).toHaveCount(3);
  await page.keyboard.press('Escape');

  await page.locator('.graph-card[data-id=c]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detail-panel')).toBeVisible();
  await page.keyboard.press('Control+v');
  await expect(page.locator('.graph-card')).toHaveCount(3);
});

test('English locale reports copy and paste in English', async ({ page }) => {
  await loadProject(page);
  await locale(page, 'en');
  await page.locator('.graph-card[data-id=c]').click();
  await page.keyboard.press('Control+c');
  await expect(page.locator('#toast')).toContainText('Copied 1 notes');
  await page.keyboard.press('Control+v');
  await expect(page.locator('#toast')).toContainText('Added 1 copies');
});
