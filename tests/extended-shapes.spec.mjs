import { setDraftFontSize } from './overview-test-helpers.mjs';
import { test, expect } from '@playwright/test';
const extended = ['star', 'heart', 'octagon', 'arrow', 'isosceles-triangle', 'right-triangle'];
test('extended shapes Fit72, shared anchors, active view and safe content round-trip', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/Card Atlas/);
  await page.locator('#file-input').setInputFiles('assets/data/mixed-shapes-example.json');
  await page.locator('[data-choice=apply]').click();
  await expect(page.locator('.graph-card[data-shape]')).toHaveCount(14);
  for (const view of ['card', 'mind']) {
    await page.locator('#map-view').selectOption(view);
    for (const shape of extended) {
      const card = page.locator('.graph-card[data-id="shape-' + shape + '"]');
      await card.focus();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Format', exact: true }).click();
      await setDraftFontSize(page, '72', 'summary', 'Fit');
      await page.locator('[name=appearance-sizeMode]').selectOption('fit');
      await page.locator('#panel-body form button[type=submit]').click();
      await page.locator('[data-action=close]').click();
      await expect(card).toHaveAttribute('data-size-mode', 'fit');
      const fit = await card.locator('.card-summary').evaluate((el) => ({
        w: el.clientWidth,
        sw: el.scrollWidth,
        h: el.clientHeight,
        sh: el.scrollHeight,
      }));
      expect(fit.sw).toBeLessThanOrEqual(fit.w + 1);
      expect(fit.sh).toBeLessThanOrEqual(fit.h + 1);
    }
  }
  await page.locator('#locale').selectOption('en');
  await page.locator('#theme-toggle').click();
  await page.locator('[data-action=fit]').click();
  const check = await page.evaluate(async () => {
    const { store, adapter } = await import('/assets/js/app.js');
    const { geometry } = await import('/assets/js/graph/mind-map.js');
    const { shapePoints, shapeAnchor, safeArea, hitShape } =
      await import('/assets/js/graph/shape-registry.js');
    const { stage, serialize } = await import('/assets/js/json/validator.js');
    return {
      valid: stage(serialize(store.project)).errors,
      items: store.project.cards
        .filter((c) => c.tags.includes('extended'))
        .map((c) => {
          const size = geometry(store.project, c, 'mind').size;
          const shape = c.extensions['card-atlas:appearance'].shape;
          const pts = shapePoints(shape, size);
          const a = safeArea(shape, size);
          const el = adapter.cards.get(c.id);
          const anchor = shapeAnchor(
            pts,
            { x: size.width / 2, y: size.height / 2 },
            { x: 1, y: 0 },
          );
          return {
            shape,
            inside:
              hitShape(pts, { x: a.x, y: a.y }) &&
              hitShape(pts, { x: a.x + a.width, y: a.y + a.height }),
            anchor,
            handle: {
              x: parseFloat(el.querySelector('.connector').style.left) + 9,
              y: parseFloat(el.querySelector('.connector').style.top) + 9,
            },
          };
        }),
    };
  });
  expect(check.valid).toEqual([]);
  for (const c of check.items) {
    expect(c.inside).toBe(true);
    expect(c.handle.x).toBeCloseTo(c.anchor.x, 2);
    expect(c.handle.y).toBeCloseTo(c.anchor.y, 2);
  }
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'planning/design/feedback-04-mixed-dark.png' });
});
