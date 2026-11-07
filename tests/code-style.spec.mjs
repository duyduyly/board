import { test, expect } from '@playwright/test';

test('HTML code examples highlight offline and preserve literal code', async ({ page }) => {
  const remote = [], errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4173') && !request.url().startsWith('data:')) remote.push(request.url());
  });
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { parseDocument, resolvedHTML } = await import('/assets/js/detail/html-content.js');
    const highlighter = (await import('/assets/vendor/highlight-entry.js')).default;
    const source = 'class Demo { String html = "<script>bad()</script>"; int n = 42; }';
    const escaped = source.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const langs = ['java', 'javascript', 'typescript', 'json', 'xml', 'css', 'python', 'sql', 'bash', 'unknown'];
    const html = langs.map((lang) => `<pre><code class="language-${lang}">${escaped}</code></pre>`).join('');
    const parsed = parseDocument(html);
    const card = { extensions: { 'card-atlas:document': parsed.document } };
    const host = document.createElement('div');
    host.innerHTML = resolvedHTML(card, false, highlighter);
    return { source, texts: [...host.querySelectorAll('code')].map((node) => node.textContent),
      highlighted: [...host.querySelectorAll('code')].map((node) => !!node.querySelector('span')),
      unsafe: host.querySelectorAll('script,img').length, removed: parsed.removed };
  });
  expect(result.removed).toEqual([]);
  expect(result.texts).toEqual(Array(10).fill(result.source));
  expect(result.highlighted[0]).toBe(true);
  expect(result.highlighted[9]).toBe(false);
  expect(result.unsafe).toBe(0);
  expect(errors).toEqual([]);
  expect(remote).toEqual([]);
});
