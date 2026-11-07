import { test, expect } from '@playwright/test';
import { projectAction } from './ui-driver.mjs';

test('opt-in recovery restores pending unsafe HTML source without executing it', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-editor-mode=html]').click();
  const source = page.locator('[data-editor-source]');
  const raw = '<p>Khôi phục</p><script>window.bad=1</script>';
  await source.fill(raw);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(
    await page.evaluate(async () =>
      (await window.indexedDB.databases()).some((db) => db.name === 'card-atlas-recovery'),
    ),
  ).toBe(false);
  await projectAction(page, 'recovery');
  await page.locator('[data-choice=enable]').click();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await (await import('/assets/js/store/recovery.js')).readRecovery())?.editorSource
            ?.source,
      ),
    )
    .toBe(raw);
  page.on('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(page.locator('[data-choice=restore]')).toBeVisible();
  await page.locator('[data-choice=restore]').click();
  await expect(source).toHaveText(raw);
  await expect(page.locator('[data-editor-mode=html]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-editor-mode=visual]').click();
  await expect(source).toHaveText(raw);
  expect(await page.evaluate(() => window.bad)).toBeUndefined();
  await source.fill('<p>Khôi phục thành công</p>');
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  expect(
    await page.evaluate(
      async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).content,
    ),
  ).toContain('Khôi phục thành công');
  await projectAction(page, 'recovery');
  await page.locator('[data-choice=disable]').click();
  await expect.poll(() => page.evaluate(() => localStorage.length)).toBe(0);
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await window.indexedDB.databases()).some((db) => db.name === 'card-atlas-recovery'),
      ),
    )
    .toBe(false);
});

test('opt-in recovery restores visual HTML draft without committing it', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=blockParagraph]').click();
  const p = page.frameLocator('#block-editor .gjs-frame').locator('p');
  await p.dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('Draft visual');
  await projectAction(page, 'recovery');
  await page.locator('[data-choice=enable]').click();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await (await import('/assets/js/store/recovery.js')).readRecovery())?.draft?.content,
      ),
    )
    .toContain('Draft visual');
  page.on('dialog', (dialog) => dialog.accept());
  await page.reload();
  await page.locator('[data-choice=restore]').click();
  await expect(p).toHaveText('Draft visual');
  expect(
    await page.evaluate(
      async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).content,
    ),
  ).toBe('');
});

test('project export applies valid pending source and refuses unsafe pending source', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-editor-mode=html]').click();
  const source = page.locator('[data-editor-source]');
  await source.fill('<script>bad()</script>');
  await projectAction(page, 'export');
  await expect(source).toHaveText('<script>bad()</script>');
  await page.locator('[data-choice=apply]').click();
  await expect(source).toHaveText('<script>bad()</script>');
  await expect(page.locator('.block-editor-notice')).toContainText('không an toàn');
  await source.fill('<p>Saved before export</p>');
  await page.evaluate(() => {
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      window.exportedBlob = blob;
      return original(blob);
    };
  });
  await projectAction(page, 'export');
  await page.locator('[data-choice=apply]').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.exportedBlob))).toBe(true);
  const data = JSON.parse(await page.evaluate(() => window.exportedBlob.text()));
  expect(data.cards.at(-1).content).toContain('Saved before export');
});
