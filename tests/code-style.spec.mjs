import { test, expect } from '@playwright/test';
test('fenced code highlights safely offline and preserves code, fallback and Mermaid', async ({
  page,
}) => {
  const errors = [],
    remote = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173') && !r.url().startsWith('data:'))
      remote.push(r.url());
  });
  await page.goto('/');
  const java = 'public class Hello { String text = "<img src=x onerror=alert(1)>"; int n = 42; }';
  await page.evaluate(async (java) => {
    const host = document.createElement('div');
    host.id = 'code-test';
    host.className = 'markdown';
    document.body.append(host);
    const { renderMarkdown } = await import('/assets/js/detail/markdown.js');
    await renderMarkdown(
      host,
      '```java\n' +
        java +
        '\n```\n\n```unknown\n<script>alert(1)</script>\n```\n\n```mermaid\ngraph LR\nA-->B\n```',
    );
  }, java);
  const code = page.locator('#code-test .syntax-highlight');
  await expect(code).toHaveText(java);
  await expect(code.locator('.hljs-keyword').first()).toBeVisible();
  await expect(page.locator('#code-test img, #code-test script')).toHaveCount(0);
  await expect(page.locator('#code-test pre').nth(1)).toContainText('<script>alert(1)</script>');
  await expect(page.locator('#code-test .diagram svg')).toBeVisible();
  const light = await code
    .locator('.hljs-keyword')
    .first()
    .evaluate((e) => window.getComputedStyle(e).color);
  await page.locator('#theme-toggle').click();
  const dark = await code
    .locator('.hljs-keyword')
    .first()
    .evaluate((e) => window.getComputedStyle(e).color);
  expect(dark).not.toBe(light);
  await expect(code).toHaveText(java);
  expect(errors).toEqual([]);
  expect(remote).toEqual([]);
  await code.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'planning/design/code-style-dark.png' });
  const fallbacks = await page.evaluate(async () => {
    const { renderMarkdown } = await import('/assets/js/detail/markdown.js');
    const host = document.createElement('div');
    const languages = ['js', 'ts', 'json', 'html', 'css', 'python', 'sql', 'sh'];
    await renderMarkdown(
      host,
      languages.map((lang) => '```' + lang + '\nconst x = "hello";\n```').join('\n\n'),
    );
    const count = host.querySelectorAll('.syntax-highlight').length;
    await renderMarkdown(host, '```java\n' + 'x'.repeat(20001) + '\n```\n\n```\nplain\n```');
    return {
      count,
      fallback: host.querySelectorAll('.syntax-highlight').length,
      text: host.textContent,
    };
  });
  expect(fallbacks.count).toBe(8);
  expect(fallbacks.fallback).toBe(0);
  expect(fallbacks.text).toContain('plain');
});
