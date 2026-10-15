import { expect } from '@playwright/test';
export async function setDraftTitle(page, value) {
  await page.locator('#edit-card-overview').click();
  await page.locator('#overview-field').selectOption('title');
  await page.locator('#overview-text').fill(value);
  await page.locator('[data-overview-apply]').click();
  await expect(page.locator('#card-overview-editor')).not.toBeVisible();
}
export async function readDraftTitle(page) {
  await page.locator('#edit-card-overview').click();
  await page.locator('#overview-field').selectOption('title');
  const value = await page.locator('#overview-text').inputValue();
  await page.locator('[data-overview-cancel]').click();
  return value;
}
export async function expectDraftTitle(page, value) {
  expect(await readDraftTitle(page)).toBe(value);
}

export async function setDraftFontSize(page, value) {
  await page.locator('#edit-card-overview').click();
  await page.locator('#overview-field').selectOption('title');
  await page.locator('#overview-size').fill(value);
  await page.locator('[data-overview-apply]').click();
  await expect(page.locator('#card-overview-editor')).not.toBeVisible();
}
