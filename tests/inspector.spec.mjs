import { projectAction as toolbarProjectAction } from './ui-driver.mjs';
import { test, expect } from '@playwright/test';

test('right inspector formats card, text and edges without modal; global actions skip pins and undo once', async ({
  page,
}) => {
  await page.goto('/');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const card = (id, x, pinned = false) => ({
    id,
    title: id,
    summary: 'summary',
    content: '# Markdown',
    position: { x, y: 100 },
    size: { width: 260, height: 190 },
    style: {
      backgroundColor: id === 'a' ? '#e3efe8' : '#ffffff',
      textColor: '#23332d',
      borderColor: '#28594b',
    },
    ...(pinned ? { extensions: { 'card-atlas:metadata': { pinned: true } } } : {}),
  });
  await page.locator('#file-input').setInputFiles({
    name: 'inspector.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: '1.0',
        metadata: { title: 'Inspector' },
        cards: [card('a', 0), card('b', 400), card('p', 800, true)],
        relations: [
          {
            id: 'r',
            source: 'a',
            target: 'b',
            extensions: { 'card-atlas:edge': { route: 'orthogonal' } },
          },
        ],
      }),
    ),
  });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-id=a]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#detail-panel')).toBeVisible();
  expect(await page.locator('#detail-panel').evaluate((e) => e.matches(':modal'))).toBe(true);
  await page.locator('#panel-tabs button').nth(2).click();
  await expect(page.locator('#format-inspector')).toBeVisible();
  expect(await page.locator('#detail-panel').evaluate((e) => e.matches(':modal'))).toBe(false);
  await page.locator('[name=width]').fill('310');
  await page.screenshot({ path: 'planning/design/inspector-card.png' });
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  await page.locator('#inspector-tabs button').nth(1).click();
  await page.locator('#overview-text').fill('Updated title');
  await page.screenshot({ path: 'planning/design/inspector-text.png' });
  await page.locator('[data-overview-apply]').click();
  await expect(page.locator('#toast')).toContainText('thành công');
  await page.locator('#inspector-tabs button').nth(0).click();
  await page.locator('#inspector-global [name=routes]').check();
  await page.locator('#inspector-global [name=surface]').check();
  await page.locator('#inspector-global [name=typography]').check();
  const beforeBulk = await page.evaluate(
    async () => (await import('/assets/js/app.js')).store.undoStack.length,
  );
  await page.locator('[name=bulk-title-fontSize]').fill('0');
  await page.locator('#inspector-global button').click();
  expect(
    await page.evaluate(async () => (await import('/assets/js/app.js')).store.undoStack.length),
  ).toBe(beforeBulk);
  await page.locator('[name=bulk-title-fontSize]').fill('22');
  await page.locator('[name=bulk-title-fontFamily]').selectOption('serif');
  await page.locator('[name=bulk-summary-fontSize]').fill('13');
  await page.screenshot({ path: 'planning/design/inspector-bulk-typography.png' });
  await page.locator('#inspector-global button').click();
  const snapshot = () =>
    page.evaluate(async () => {
      const { store } = await import('/assets/js/app.js');
      return { p: store.project, n: store.undoStack.length };
    });
  const saved = await snapshot();
  expect(saved.p.cards[0].title).toBe('Updated title');
  expect(saved.p.cards[0].size.width).toBe(310);
  expect(saved.p.cards[2].size.width).toBe(260);
  expect(saved.p.cards[1].style.backgroundColor).toBe('#e3efe8');
  expect(saved.p.cards[2].style.backgroundColor).toBe('#ffffff');
  expect(saved.p.cards[1].extensions['card-atlas:typography'].title.fontSize).toBe(22);
  expect(saved.p.cards[1].extensions['card-atlas:typography'].title.fontFamily).toBe('serif');
  expect(saved.p.cards[1].extensions['card-atlas:typography'].summary.fontSize).toBe(13);
  expect(saved.p.cards[2].extensions['card-atlas:typography']).toBeUndefined();
  expect(saved.p.relations[0].extensions['card-atlas:edge'].modes.card).toBe('auto');
  await page.screenshot({ path: 'planning/design/inspector-global.png' });
  await page.locator('#inspector-close').click();
  await page.keyboard.press('Control+z');
  expect((await snapshot()).n).toBe(saved.n - 1);
  const box = await page.locator('#canvas-region').boundingBox();
  const mid = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).adapter.cy.getElementById('r:r').renderedMidpoint(),
  );
  await page.mouse.click(box.x + mid.x, box.y + mid.y);
  await expect(page.locator('#format-inspector')).toBeVisible();
  await page.locator('[name=edge-route]').selectOption('zigzag');
  await page.locator('#panel-body [type=submit]').click();
  expect((await snapshot()).p.relations[0].extensions['card-atlas:edge'].route).toBe('zigzag');
  await page.locator('#inspector-close').click();
  await page.locator('#locale').selectOption('en');
  await page.setViewportSize({ width: 1050, height: 780 });
  await toolbarProjectAction(page, 'inspector');
  await expect(page.locator('#inspector-tabs')).toContainText('Arrows');
  await expect(page.locator('#inspector-global')).toBeVisible();
  await page.screenshot({ path: 'planning/design/inspector-english-1050.png' });
  expect(errors).toEqual([]);
});
