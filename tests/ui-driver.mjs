// Explicit user paths for the modal UI; never bypass inert or call product internals.
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
  await page
    .locator('[data-action="' + action + '"]')
    .first()
    .click();
}
export async function locale(page, value) {
  await page
    .locator((await page.locator('#detail-panel').isVisible()) ? '#detail-locale' : '#locale')
    .selectOption(value);
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
  await row.click();
}
