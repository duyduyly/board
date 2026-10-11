import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
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
  url: page.url(),
  title: await page.title(),
  firstScreen: await page.locator('h1').textContent(),
};
assert.ok(identity.firstScreen);
assert.ok(identity.title.includes('Card Atlas'));
await page.locator('[data-action=english-example]').click();
await page.locator('.card-row[data-card-id="english-s-sounds"]').click();
await page.waitForTimeout(100);
await page.screenshot({ path: 'planning/design/english-light.png' });
await page.locator('#theme-toggle').click();
assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
await page.screenshot({ path: 'planning/design/english-dark.png' });
await page.locator('.card-row[data-card-id="english-overview"]').click();
await page.locator('.diagram svg').waitFor();
assert.ok((await page.locator('.diagram').textContent()).includes('English endings'));
await page.screenshot({ path: 'planning/design/english-dark-mermaid.png' });
await page.locator('.embedded-image').scrollIntoViewIfNeeded();
await page.waitForFunction(() => document.querySelector('.embedded-image')?.naturalWidth === 640);
await page.screenshot({ path: 'planning/design/english-embedded-image.png' });
await page.setViewportSize({ width: 1050, height: 800 });
await page.locator('[data-action=close]').click();
await page.locator('[data-action=fit]').click();
assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
const toolbar = await page.locator('.toolbar').boundingBox();
for (const selector of [
  '#theme-toggle',
  '#locale',
  '[data-action=export]',
  '.toolbar [data-action=new]',
]) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(
    box.x >= toolbar.x && box.x + box.width <= toolbar.x + toolbar.width,
    selector + ' fits toolbar',
  );
}
await page.screenshot({ path: 'planning/design/english-dark-1050.png' });
await page.locator('.toolbar [data-action=new]').click();
await page.locator('#new-project-title').fill('Bài học của tôi');
await page.screenshot({ path: 'planning/design/new-project-dialog.png' });
await page.locator('[data-choice=create]').click();
assert.equal(await page.locator('#project-name').textContent(), 'Bài học của tôi');
assert.equal(await page.locator('.graph-card').count(), 0);
await page.setViewportSize({ width: 390, height: 844 });
assert.ok(await page.locator('.mobile-notice').isVisible());
await page.screenshot({ path: 'planning/design/english-dark-mobile.png' });
assert.deepEqual(errors, []);
assert.deepEqual(warnings, []);
await fs.writeFile(
  'planning/enhancements-qa.json',
  JSON.stringify(
    {
      date: new Date().toISOString(),
      browser: await browser.version(),
      identity,
      errors,
      warnings,
      viewports: ['1440x900', '1050x800', '390x844'],
      browserPath: 'Browser plugin/skill not available; Playwright fallback',
      checks: [
        'page identity and meaningful content',
        'light/dark badges and markdown',
        'dark Mermaid visible text',
        'embedded PNG in English example decoded without external URL',
        'Fit after resize',
        'New Project name dialog and creation at 1050px',
        'toolbar has no clipping at 1050px',
        'desktop-only mobile notice',
      ],
      screenshots: [
        'english-light.png',
        'english-dark.png',
        'english-dark-mermaid.png',
        'english-dark-1050.png',
        'english-dark-mobile.png',
      ],
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify({ identity, errors, warnings }, null, 2));
await browser.close();
