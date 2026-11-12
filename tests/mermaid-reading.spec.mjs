import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { convertMarkdownCard } from '../scripts/markdown-convert.mjs';
import { locale } from './ui-driver.mjs';

const FLOW =
  '<pre><code class="language-mermaid">flowchart LR\n  A[Alpha] --> B[Beta]</code></pre>';
const FRAME = 'iframe.html-document-frame';

async function startImport(page) {
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=htmlImportTitle]').click();
}

async function applyHtml(page, html) {
  await page.locator('[data-html-source]').fill(html);
  await page.locator('[data-html-review]').click();
  await expect(page.locator('[data-html-result]')).toBeVisible();
  await page.locator('[data-html-accept]').click();
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
}

async function openOverview(page) {
  await page.locator('.graph-card').last().focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(0).click();
  return page.frameLocator(FRAME);
}

async function readCard(page, html) {
  await page.goto('/');
  await startImport(page);
  await applyHtml(page, html);
  return openOverview(page);
}

const hasTemporaryNodes = (page) =>
  page.evaluate(() =>
    [...document.body.querySelectorAll('[id]')].some(
      (node) => node.id.startsWith('dboard-mermaid-') || node.id.startsWith('board-mermaid-'),
    ),
  );

test('a valid flowchart is drawn as safe SVG that fits the frame', async ({ page, baseURL }) => {
  const external = [];
  const origin = new URL(baseURL).origin;
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:'))
      external.push(url);
  });
  const frame = await readCard(page, FLOW);
  const figure = frame.locator('figure.board-mermaid');
  await expect(figure.locator('svg')).toHaveCount(1);
  await expect(figure.locator('svg')).toContainText('Alpha');
  await expect(figure.locator('svg')).toContainText('Beta');
  await expect(figure.locator('foreignObject, script')).toHaveCount(0);
  await expect(frame.locator('pre')).toBeHidden();
  await expect(frame.locator('p.board-mermaid-status')).toHaveCount(0);
  await expect
    .poll(async () => {
      const bottom = await figure.evaluate((node) => node.getBoundingClientRect().bottom);
      const height = await page.locator(FRAME).evaluate((node) => node.clientHeight);
      return bottom > 0 && bottom <= height;
    })
    .toBe(true);
  expect(external).toEqual([]);
});

test('the source toggle works from the keyboard', async ({ page }) => {
  const frame = await readCard(page, FLOW);
  const toggle = frame.locator('button.board-mermaid-source');
  await expect(toggle).toHaveText('Xem mã nguồn');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toHaveText('Ẩn mã nguồn');
  await expect(frame.locator('pre')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toHaveText('Xem mã nguồn');
  await expect(frame.locator('pre')).toBeHidden();
});

test('a syntax error keeps the source, shows a status and leaves no temporary nodes', async ({
  page,
}) => {
  const frame = await readCard(
    page,
    '<pre><code class="language-mermaid">flowchart LR\n  A --> -->[ B</code></pre>',
  );
  const status = frame.locator('p.board-mermaid-status[role=status]');
  await expect(status).toContainText('Không vẽ được sơ đồ Mermaid');
  await expect(frame.locator('figure.board-mermaid')).toHaveCount(0);
  await expect(frame.locator('pre')).toBeVisible();
  expect(await hasTemporaryNodes(page)).toBe(false);
});

for (const [name, source] of [
  ['click link', 'flowchart LR\n  A --> B\n  click A "https://example.com"'],
  ['init directive', '%%{init: {"theme": "dark"}}%%\nflowchart LR\n  A --> B'],
]) {
  test('unsupported Mermaid (' + name + ') is blocked and not drawn', async ({ page }) => {
    const frame = await readCard(
      page,
      '<pre><code class="language-mermaid">' + source + '</code></pre>',
    );
    await expect(frame.locator('p.board-mermaid-status')).toContainText('không được hỗ trợ');
    await expect(frame.locator('figure.board-mermaid')).toHaveCount(0);
    await expect(frame.locator('svg')).toHaveCount(0);
    await expect(frame.locator('pre')).toBeVisible();
  });
}

test('English locale shows English labels and statuses', async ({ page }) => {
  await page.goto('/');
  await locale(page, 'en');
  await startImport(page);
  await applyHtml(
    page,
    FLOW +
      '<pre><code class="language-mermaid">flowchart LR\n  A --> B\n  click A "https://example.com"</code></pre>',
  );
  const frame = await openOverview(page);
  await expect(frame.locator('button.board-mermaid-source')).toHaveText('Show source');
  const status = frame.locator('p.board-mermaid-status');
  await expect(status).toContainText('unsupported');
  await expect(status).not.toContainText('không');
});

test('dark theme redraws the diagram with different colours', async ({ page }) => {
  const frame = await readCard(page, FLOW);
  const svg = frame.locator('figure.board-mermaid svg');
  await expect(svg).toHaveCount(1);
  const styleText = () => svg.locator('style').first().textContent();
  const before = await styleText();
  await page.locator('#detail-theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(styleText).not.toBe(before);
  await expect(frame.locator('figure.board-mermaid svg')).toContainText('Alpha');
  await expect(frame.locator('figure.board-mermaid')).toHaveCount(1);
});

test('a converted legacy Mermaid block is drawn and keeps its Mermaid label', async ({ page }) => {
  const project = JSON.parse(await readFile('tests/fixtures/legacy/example.json', 'utf8'));
  project.cards = project.cards.map((card) => convertMarkdownCard(card).card);
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'converted-example.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await page.locator('[data-id=card-user-service]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').first().click();
  const frame = page.frameLocator(FRAME);
  await expect(frame.locator('figure.board-mermaid svg')).toHaveCount(1);
  await expect(frame.locator('.legacy-source-status')).toContainText('Mermaid');
});

test('a wide diagram scrolls sideways instead of shrinking its labels', async ({ page }) => {
  const chain = Array.from(
    { length: 15 },
    (_, index) => 'N' + index + '[Step number ' + index + ']',
  );
  const frame = await readCard(
    page,
    '<pre><code class="language-mermaid">flowchart LR\n  ' + chain.join(' --> ') + '</code></pre>',
  );
  const figure = frame.locator('figure.board-mermaid');
  await expect(figure.locator('svg')).toBeVisible();
  const size = await figure.evaluate((node) => {
    const svg = node.querySelector('svg');
    return {
      scroll: node.scrollWidth,
      client: node.clientWidth,
      scale: svg.getBoundingClientRect().width / svg.viewBox.baseVal.width,
    };
  });
  expect(size.scroll).toBeGreaterThan(size.client);
  expect(size.scale).toBeGreaterThanOrEqual(0.74);
  const controls = await figure
    .locator('button.board-mermaid-source')
    .getAttribute('aria-controls');
  await expect(frame.locator('pre[id="' + controls + '"]')).toHaveCount(1);
});
