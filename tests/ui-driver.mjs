// Explicit user paths for the modal UI; never bypass inert or call product internals.
import { expect } from '@playwright/test';

// Legacy multi-step editor scenarios intentionally continue editing after Apply.
// Assert the new close lifecycle, then reopen through visible controls/keyboard.
export async function applyAndContinue(page, button) {
  const main = await button.evaluate((el) => Boolean(el.closest('#panel-body form')));
  const target = main
    ? await page.evaluate(async () => {
        const { adapter } = await import('/assets/js/app.js');
        return {
          selection: adapter.lastSelection,
          tab: [...document.querySelectorAll('#panel-tabs button')].findIndex((b) =>
            b.classList.contains('active'),
          ),
        };
      })
    : null;
  await button.click();
  if (!main || (await page.locator('#detail-panel').isVisible())) return;
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const s = target.selection;
  if (s.kind === 'card') {
    await page.locator('.graph-card[data-id="' + s.id + '"]').focus();
    await page.keyboard.press('Enter');
  } else if (s.kind === 'project') await page.locator('#project-name').click();
  else {
    await page.locator('[data-action=focus]').click();
    await expect
      .poll(() =>
        page.evaluate(async (id) => {
          const { adapter } = await import('/assets/js/app.js');
          return adapter.cy.getElementById('r:' + id).style('visibility');
        }, s.id),
      )
      .toBe('visible');
    const p = await page.evaluate(async (id) => {
        const { adapter } = await import('/assets/js/app.js');
        return adapter.cy.getElementById('r:' + id).renderedMidpoint();
      }, s.id),
      b = await page.locator('#canvas-region').boundingBox();
    await page.mouse.click(b.x + p.x, b.y + p.y);
  }
  await expect(page.locator('#detail-panel')).toBeVisible();
  if (s.kind === 'card' && target.tab > 0)
    await page.locator('#panel-tabs button').nth(target.tab).click();
}
export async function projectAction(page, action) {
  if (await page.locator('#detail-panel').isVisible()) {
    const local = page.locator('[data-panel-action="' + action + '"]');
    if (await local.count()) {
      if (!(await page.locator('#detail-tools').evaluate((e) => e.open)))
        await page.locator('#detail-tools summary').click();
      await local.click();
      return;
    }
    await page.locator('[data-action=close]').click();
  }
  if (
    ['format', 'recovery'].includes(action) &&
    !(await page.locator('#project-menu').evaluate((e) => e.open))
  )
    await page.locator('#project-menu > summary').click();
  await page
    .locator('[data-action="' + action + '"]')
    .first()
    .click();
}
export async function locale(page, value) {
  const open = await page.locator('#detail-panel').isVisible();
  const id = open
    ? await page.locator('.graph-card.selected').first().getAttribute('data-id')
    : null;
  const tab = open
    ? await page
        .locator('#panel-tabs button')
        .evaluateAll((buttons) => buttons.findIndex((b) => b.classList.contains('active')))
    : -1;
  if (open) {
    await page.locator('[data-action=close]').click();
    if (await page.locator('#modal').isVisible())
      throw Error('Choose the global locale before editing an unsaved draft.');
  }
  await page.locator('#locale').selectOption(value);
  if (open && id) {
    await page.locator('.graph-card[data-id="' + id + '"]').focus();
    await page.keyboard.press('Enter');
    if (tab > 0) await page.locator('#panel-tabs button').nth(tab).click();
  }
}
export async function theme(page) {
  await page
    .locator((await page.locator('#detail-panel').isVisible()) ? '#detail-theme' : '#theme-toggle')
    .click();
}
export async function view(page, value) {
  if (await page.locator('#detail-panel').isVisible()) {
    if (!(await page.locator('#detail-tools').evaluate((e) => e.open)))
      await page.locator('#detail-tools summary').click();
    await page.locator('#detail-map-view').selectOption(value);
  } else await page.locator('#map-view').selectOption(value);
}
export async function openRow(page, row) {
  if (await page.locator('#detail-panel').isVisible()) {
    await page.locator('[data-action=close]').click();
    if (await page.locator('#modal').isVisible()) return;
  }
  await openSearch(page);
  await row.click();
}

export async function openSearch(page) {
  if (!(await page.locator('#search-drawer').isVisible()))
    await page.locator('[data-action=search]').click();
}
