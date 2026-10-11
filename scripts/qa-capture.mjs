import { chromium, firefox } from '@playwright/test';
import fs from 'node:fs/promises';
const versions = {};
for (const channel of ['chrome', 'msedge']) {
  const browser = await chromium.launch({ channel });
  versions[channel] = await browser.version();
  await browser.close();
}
const f = await firefox.launch();
versions.firefox = await f.version();
await f.close();
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [],
  warnings = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
  if (m.type() === 'warning') warnings.push(m.text());
});
await page.goto('http://127.0.0.1:4173');
const identity = {
  title: await page.title(),
  url: page.url(),
  firstScreen: await page.locator('h1').textContent(),
};
await page.screenshot({ path: 'planning/design/empty-browser.png' });
await page.getByRole('button', { name: 'Mở ví dụ', exact: true }).click();
await page.locator('.card-row[data-card-id="card-user-service"]').click();
await page.locator('.diagram svg').waitFor();
await page.locator('[data-action=fit]').click();
await page.waitForTimeout(150);
await page.screenshot({ path: 'planning/design/editor-browser.png' });
await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click();
await page.screenshot({ path: 'planning/design/editor-form-browser.png' });
await page.locator('input[name=title]').fill('Draft');
await page.locator('.card-row[data-card-id="card-database"]').click();
await page.locator('#modal').waitFor();
await page.screenshot({ path: 'planning/design/draft-guard-browser.png' });
await page.locator('[data-choice=cancel]').click();
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: 'planning/design/mobile-browser.png' });
await fs.writeFile(
  'planning/browser-qa.json',
  JSON.stringify(
    {
      date: new Date().toISOString(),
      versions,
      identity,
      errors,
      warnings,
      viewports: ['1440x900', '390x844'],
      browserPath: 'IAB unavailable; Playwright fallback',
      proof: [
        'empty screen',
        'fitted graph and documentation',
        'edit form',
        'draft guard',
        'desktop-only mobile notice',
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify({ versions, errors, warnings, identity }, null, 2));
await browser.close();
