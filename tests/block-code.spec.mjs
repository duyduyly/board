import { test, expect } from '@playwright/test';

test('code editor preserves literal Java and escapes executable markup', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=blockCode]').click();
  const frame = page.frameLocator('#block-editor .gjs-frame');
  const code = frame.locator('pre code');
  await code.click();
  const source =
    'class Demo {\n  String html = "<script>window.evil = 1</script>";\n  int n = 42;\n}';
  await page.locator('[data-code-text]').click();
  await expect(page.locator('[data-code-text]')).toBeFocused();
  await page.locator('[data-code-text]').fill(source);
  await expect(page.locator('[data-code-text]')).toHaveValue(source);
  await expect(code).toHaveText(source);
  await page.locator('[data-code-language]').selectOption('java');
  await expect(code).toHaveText(source);
  await expect(frame.locator('script')).toHaveCount(0);
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  expect(card.content).toContain(source);
  expect(JSON.stringify(card.extensions['card-atlas:document'])).toContain('language-java');
  await page.locator(`[data-id="${card.id}"]`).focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(code).toHaveText(source);
  expect(await page.evaluate(() => window.evil)).toBeUndefined();
});

test('read-only code highlights Java and JSON without executing markup', async ({ page }) => {
  await page.goto('/');
  const project = {
    version: '1.0',
    cards: [
      {
        id: 'code-test',
        title: 'Code',
        content: 'Example',
        extensions: {
          'card-atlas:metadata': { pinned: true },
          'card-atlas:document': {
            version: 1,
            format: 'html-bs5',
            components: [
              {
                tag: 'pre',
                attributes: {},
                children: [
                  {
                    tag: 'code',
                    attributes: { class: 'language-java' },
                    children: ['class Demo { int n = 42; }'],
                  },
                ],
              },
              {
                tag: 'pre',
                attributes: {},
                children: [
                  {
                    tag: 'code',
                    attributes: { class: 'language-json' },
                    children: ['{"html":"<script>bad()</script>","count":2}'],
                  },
                ],
              },
            ],
          },
        },
      },
    ],
    relations: [],
  };
  await page.locator('#file-input').setInputFiles({
    name: 'code.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-id=code-test]').focus();
  await page.keyboard.press('Enter');
  const frame = page.frameLocator('.html-document-frame');
  await expect(frame.locator('code').first().locator('.hljs-keyword')).toHaveText('class');
  await expect(frame.locator('code').nth(1)).toContainText('<script>bad()</script>');
  await expect(frame.locator('code').nth(1).locator('script')).toHaveCount(0);
  await expect(frame.locator('code').nth(1).locator('.hljs-attr')).toHaveCount(2);
});

test('JSON code remains exact after editing and reopen', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=blockCode]').click();
  const code = page.frameLocator('#block-editor .gjs-frame').locator('pre code');
  await code.click();
  const input = page.locator('[data-code-text]');
  await input.click();
  await expect(input).toBeFocused();
  const source = '{\n  "quote": "a & b",\n  "value": 42\n}';
  await input.fill(source);
  await page.locator('[data-code-language]').selectOption('json');
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  const card = await page.evaluate(async () =>
    (await import('/assets/js/app.js')).store.project.cards.at(-1),
  );
  expect(card.content).toContain(source);
  await page.locator(`[data-id="${card.id}"]`).focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(code).toHaveText(source);
  await expect(code).toHaveClass(/language-json/);
});
