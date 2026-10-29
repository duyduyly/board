import { view as switchMapView } from './ui-driver.mjs';
import { test, expect } from '@playwright/test';
import { newCard } from '../assets/js/store/project-store.js';

test('Note paper typography has title, summary and metadata hierarchy with measurable Fit', async ({
  page,
}) => {
  const note = newCard({ x: 80, y: 100 }, 'Một ý tưởng mỗi tờ note');
  note.summary =
    'Ghi lại ý chính bằng vài câu ngắn. Dùng tiêu đề rõ ràng để dễ xem lại và ghi nhớ.';
  note.type = 'LEARNING';
  note.tags = ['active recall', 'Java'];
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'note.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: '1.0',
        metadata: { title: 'Note paper' },
        cards: [note],
        relations: [],
      }),
    ),
  });
  await page.locator('[data-choice=apply]').click();
  const card = page.locator('.graph-card');
  await expect(card.locator('h3')).toHaveCSS('font-size', '20px');
  await expect(card.locator('.card-summary')).toHaveCSS('font-size', '14px');
  const layout = await card.evaluate((el) =>
    ['h3', '.card-summary', '.card-kicker', '.card-meta'].map((selector) => {
      const r = el.querySelector(selector).getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    }),
  );
  for (let i = 1; i < layout.length; i++)
    expect(layout[i].top).toBeGreaterThanOrEqual(layout[i - 1].bottom);
  const fit = await page.evaluate(async (id) => {
    const { store } = await import('/assets/js/app.js');
    const { measureOverview } = await import('/assets/js/canvas/text-measure.js');
    return measureOverview(
      store.project.cards.find((c) => c.id === id),
      null,
      'card',
    );
  }, note.id);
  expect(fit.width).toBeGreaterThan(0);
  expect(fit.height).toBeGreaterThan(0);
  await page.screenshot({ path: 'planning/design/note-paper-layout.png' });
});
test('new Note paper is square in both views; imported cards retain geometry and creation undoes', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-template=architecture]').click();
  await expect(page.locator('.graph-card')).toHaveCount(3);
  await expect(page.locator('[data-map-view=card]')).toHaveText('Note Board');
  await page.locator('#locale').selectOption('en');
  await expect(page.locator('[data-map-view=card]')).toHaveText('Note Board');
  await page.locator('#locale').selectOption('vi');
  const original = await page.evaluate(
    async () => (await import('/assets/js/app.js')).store.project.cards,
  );
  for (const view of ['card', 'mind']) {
    await switchMapView(page, view);
    await expect(page.locator('[data-palette-kind=card]')).toHaveText('Note paper');
    await page.locator('[data-palette-kind=card]').click();
    await expect(page.locator('.graph-card')).toHaveCount(4);
    const value = await page.evaluate(async () => {
      const { store } = await import('/assets/js/app.js');
      const { geometry } = await import('/assets/js/graph/mind-map.js');
      const card = store.project.cards.at(-1);
      return {
        card,
        mind: geometry(store.project, card, 'mind').size,
        old: store.project.cards.slice(0, 3),
      };
    });
    expect(value.old).toEqual(original);
    expect(value.card.size).toEqual({ width: 260, height: 260 });
    expect(value.mind).toEqual(value.card.size);
    expect(value.card.style.backgroundColor).toBe('#FFF2B0');
    if (view === 'card')
      await expect(page.locator('[data-id="' + value.card.id + '"]')).toHaveClass(/paper-note/);
    else await expect(page.locator('[data-id="' + value.card.id + '"]')).toHaveClass(/mind-node/);
    await page.screenshot({ path: 'planning/design/new-note-' + view + '.png' });
    await page.keyboard.press('Control+z');
    await expect(page.locator('.graph-card')).toHaveCount(3);
  }
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detail-panel')).toBeVisible();
  const size = await page.evaluate(
    async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).size,
  );
  expect(size).toEqual({ width: 260, height: 260 });
});
