import { test, expect } from '@playwright/test';
test('new note opens local block editor, Apply commits once and Undo retains original document', async ({
  page,
  browserName,
}) => {
  const errors = [];
  const external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (
      !r.url().startsWith('http://127.0.0.1:4173') &&
      !r.url().startsWith('data:') &&
      !r.url().startsWith('about:')
    )
      external.push(r.url());
  });
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await expect(page.locator('#block-editor .gjs-frame')).toBeVisible({ timeout: 20000 });
  await page.locator('.block-editor-tools [data-block-label=blockHeading]').click();
  const frame = page.frameLocator('#block-editor .gjs-frame');
  await expect(frame.locator('h2')).toHaveCount(1);
  await frame.locator('h2').dblclick();
  await page.keyboard.press('Control+a');
  await page.keyboard.insertText('Block content Tiếng Việt');
  await expect(frame.locator('h2')).toHaveText('Block content Tiếng Việt');
  await page.locator('#detail-panel [data-action=close]').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('[data-choice=cancel]').click();
  await expect(frame.locator('h2')).toHaveText('Block content Tiếng Việt');
  await page.screenshot({ path: 'planning/design/block-editor-integrated.png' });
  const heading = await frame.locator('h2').elementHandle();
  await page.locator('#detail-theme').click();
  expect(await heading.evaluate((el) => el.isConnected)).toBe(true);
  await expect(frame.locator('h2')).toHaveText('Block content Tiếng Việt');
  if (browserName === 'chromium') {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(async () => navigator.clipboard.writeText('safe pasted text'));
    await frame.locator('h2').dblclick();
    await page.keyboard.press('Control+v');
    await expect(frame.locator('h2')).toContainText('safe pasted text');
    await expect(frame.locator('img')).toHaveCount(0);
    await page.keyboard.insertText(' continued');
    await expect(frame.locator('h2')).toContainText('safe pasted text continued');
  }
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await import('/assets/js/app.js')).store.project.cards.at(-1).content,
      ),
    )
    .toBe('');
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const result = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  expect(result.extensions['card-atlas:document'].components.length).toBeGreaterThan(0);
  expect(result.content).toContain('Block content');
  expect(result.content).toContain('Tiếng Việt');
  if (browserName === 'chromium') expect(result.content).toContain('safe pasted text continued');
  await page.keyboard.press('Control+z');
  expect(
    await page.evaluate(
      async () =>
        (await import('/assets/js/app.js')).store.project.cards.at(-1).extensions[
          'card-atlas:document'
        ].components,
    ),
  ).toEqual([]);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('pinned HTML content uses an isolated local Bootstrap readonly surface', async ({ page }) => {
  await page.goto('/');
  const doc = {
    version: 1,
    format: 'html-bs5',
    components: [
      {
        tag: 'div',
        attributes: { class: 'row' },
        children: [
          { tag: 'p', attributes: { class: 'col-md-6' }, children: ['Safe HTML'] },
          {
            tag: 'pre',
            attributes: {},
            children: [
              { tag: 'code', attributes: {}, children: ['<script>never execute</script>'] },
            ],
          },
        ],
      },
    ],
  };
  const p = {
    version: '1.0',
    cards: [
      {
        id: 'locked',
        title: 'HTML document',
        content: 'Safe HTML',
        extensions: { 'card-atlas:metadata': { pinned: true }, 'card-atlas:document': doc },
      },
    ],
    relations: [],
  };
  await page.locator('#file-input').setInputFiles({
    name: 'html.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-id=locked]').focus();
  await page.keyboard.press('Enter');
  const frame = page.frameLocator('.html-document-frame');
  await expect(frame.locator('.row')).toHaveCSS('display', 'flex');
  await expect(frame.locator('code')).toHaveText('<script>never execute</script>');
  expect(await page.locator('.html-document-frame').getAttribute('sandbox')).not.toContain(
    'allow-scripts',
  );
  await expect(page.locator('#block-editor')).toHaveCount(0);
  await page.screenshot({ path: 'planning/design/block-editor-readonly.png' });
});
