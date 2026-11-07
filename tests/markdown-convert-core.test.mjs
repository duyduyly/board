import test from 'node:test';
import assert from 'node:assert/strict';
import { convertMarkdownCard } from '../scripts/markdown-convert.mjs';
import { documentHTML } from '../assets/js/graph/html-document.js';

test('offline Markdown conversion preserves structure, code, local image and reports unsupported source', () => {
  const source =
    '# Heading\n\nA **bold** &amp; < word.\n\n- [x] Done\n- Next\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```java\nif (a < b) run();\n```\n\n```mermaid\ngraph LR\n A-->B\n```\n\n![image](attachment:img1)\n\n<script>alert(1)</script>';
  const original = {
    id: 'x',
    content: source,
    extensions: {
      'custom:keep': { x: 1 },
      'card-atlas:images': { img1: { name: 'x.png', mimeType: 'image/png', data: 'iVBORw0KGgo=' } },
    },
  };
  const { card, warnings } = convertMarkdownCard(original);
  const html = documentHTML(card.extensions['card-atlas:document']);
  assert.match(html, /<h1>Heading<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<table/);
  assert.match(html, /\[x\] Done/);
  assert.match(html, /if \(a &lt; b\)/);
  assert.match(html, /attachment:img1/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /data-origin="legacy-mermaid"/);
  assert.match(html, /data-origin="legacy-raw-html"/);
  assert.ok(warnings.some((w) => w.kind === 'mermaid-preserved'));
  assert.ok(warnings.some((w) => w.kind === 'html-preserved-as-code'));
  assert.deepEqual(card.extensions['custom:keep'], { x: 1 });
  assert.equal(original.content, source);
  assert.deepEqual(convertMarkdownCard(card).card, card);
});

test('unknown or external images and unsafe links are preserved as visible source with warnings', () => {
  const { card, warnings } = convertMarkdownCard({
    content: '![alt](https://example.com/a.png)\n\n[bad](javascript:alert(1))',
  });
  const html = documentHTML(card.extensions['card-atlas:document']);
  assert.match(html, /!\[alt\]/);
  assert.match(html, /javascript:/);
  assert.doesNotMatch(html, /<img|href=/);
  assert.match(html, /data-origin="legacy-external-image"/);
  assert.match(html, /data-origin="legacy-unsupported"/);
  assert.equal(warnings.length, 2);
});

test('legacy text color syntax remains visible and styled', () => {
  const { card, warnings } = convertMarkdownCard({ content: 'A [red & bold]{color:#FF1200} note' });
  const html = documentHTML(card.extensions['card-atlas:document']);
  assert.match(html, /<span style="color:#FF1200">red &amp; bold<\/span>/);
  assert.equal(warnings.length, 0);
});

test('inline code preserves literal entity-like characters', () => {
  const { card } = convertMarkdownCard({ content: 'Example `&amp; <tag>`.' });
  const html = documentHTML(card.extensions['card-atlas:document']);
  assert.match(html, /<code>&amp;amp; &lt;tag&gt;<\/code>/);
});

test('ordered list start and fenced code text survive conversion', () => {
  const input = '4. Fourth\n5. Fifth\n\n```java\nint n = 1;\n```';
  const { card } = convertMarkdownCard({ content: input });
  const html = documentHTML(card.extensions['card-atlas:document']);
  assert.match(html, /<ol start="4">/);
  assert.match(html, /<code class="language-java">int n = 1;<\/code>/);
});

test('unrecognized named entities are retained and reported', () => {
  const { card, warnings } = convertMarkdownCard({ content: 'Copyright &copy; 2026' });
  assert.match(documentHTML(card.extensions['card-atlas:document']), /&amp;copy;/);
  assert.ok(warnings.some((warning) => warning.kind === 'unknown-entity-preserved'));
});
