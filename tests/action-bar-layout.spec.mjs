import { test, expect } from '@playwright/test';
import { locale, openRow, projectAction, theme } from './ui-driver.mjs';

// F07: the primary action sits in the same place everywhere: status left, [Discard][Apply] flush right.
const PAD_TOLERANCE = 1;

async function measure(bar) {
  return bar.evaluate((el) => {
    const rect = (n) => n.getBoundingClientRect();
    const b = rect(el);
    const cs = window.getComputedStyle(el);
    const submit = rect(el.querySelector('[type=submit]'));
    const cancel = [...el.querySelectorAll('button[type=button]')].map(rect)[0];
    const status = el.querySelector('[role=status]');
    return {
      barRight: b.right,
      padRight: parseFloat(cs.paddingRight),
      submitRight: submit.right,
      submitLeft: submit.left,
      cancelRight: cancel.right,
      statusLeft: status ? rect(status).left : null,
      barLeft: b.left,
      overflow:
        el.scrollWidth > el.clientWidth + 1 ||
        document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

function expectLayout(m, name) {
  expect.soft(m.overflow, name + ' no overflow').toBe(false);
  expect
    .soft(m.barRight - m.submitRight, name + ' submit flush right')
    .toBeLessThanOrEqual(m.padRight + PAD_TOLERANCE);
  expect.soft(m.submitLeft - m.cancelRight, name + ' cancel adjacent').toBeLessThanOrEqual(16);
  expect.soft(m.submitLeft, name + ' cancel before submit').toBeGreaterThan(m.cancelRight - 1);
  if (m.statusLeft !== null)
    expect.soft(m.statusLeft, name + ' status left').toBeLessThanOrEqual(m.barLeft + 24);
}

// Optional visual evidence: SHOT_DIR=<dir> saves one screenshot per bar.
const shot = (page, name) =>
  process.env.SHOT_DIR
    ? page.screenshot({
        path:
          process.env.SHOT_DIR +
          '/' +
          name +
          '-' +
          page.viewportSize().width +
          '-' +
          process.env.SHOT_TAG +
          '.png',
      })
    : null;

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 800 },
])
  for (const lang of ['vi', 'en'])
    for (const mode of ['light', 'dark'])
      test(`action bars: primary flush right [${lang} ${mode} ${viewport.width}]`, async ({
        page,
      }) => {
        process.env.SHOT_TAG = lang + '-' + mode;
        await page.setViewportSize(viewport);
        await page.goto('/');
        await page.locator('[data-action=example]').click();
        await expect(page.locator('.graph-card')).toHaveCount(3);
        await locale(page, lang);
        if (mode === 'dark') await theme(page);

        // Detail Edit (card, tab 1)
        await openRow(page, page.locator('.card-row[data-card-id=card-user-service]'));
        for (const tab of [1]) {
          await page.locator('#panel-tabs button').nth(tab).click();
          const bar = page.locator('#panel-body .editor-actions:has([type=submit])');
          await expect(bar).toBeVisible();
          await shot(page, 'detail');
          expectLayout(await measure(bar), 'detail tab ' + tab);
        }
        await page.locator('[data-action=close]').click();
        await expect(page.locator('#detail-panel')).not.toBeVisible();

        // Format dock: global tab, then card tab
        await projectAction(page, 'inspector');
        const dock = page.locator('#format-inspector');
        await expect(dock).toBeVisible();
        const global = page.locator('#inspector-global .inspector-global-actions');
        await expect(global).toBeVisible();
        await shot(page, 'dock-global');
        expectLayout(await measure(global), 'dock global');
        // the card opened in Detail stays selected, so the dock can show its Card tab
        await page.locator('#inspector-tabs button').nth(2).click();
        const cardBar = page.locator('#inspector-fields .editor-actions:has([type=submit])');
        await expect(cardBar).toBeVisible();
        await shot(page, 'dock-card');
        expectLayout(await measure(cardBar), 'dock card');
      });
