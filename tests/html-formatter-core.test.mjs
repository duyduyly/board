import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatHTML } from '../assets/js/detail/html-formatter.js';

test('formats only attribute separators while preserving mixed text and preformatted whitespace', () => {
  const source =
    '<div class="row" style="color: red"><p>A <strong title="x > y">B</strong> C</p><pre><code class="language-js">  a\n &lt;b&gt;\t</code></pre></div>';
  const result = formatHTML(source);
  assert.equal(result.ok, true);
  assert.equal(
    result.html,
    '<div\n  class="row"\n  style="color: red"><p>A <strong\n      title="x > y">B</strong> C</p><pre><code\n      class="language-js">  a\n &lt;b&gt;\t</code></pre></div>',
  );
  assert.deepEqual(formatHTML(result.html), { ok: true, html: result.html, changed: false });
});

test('preserves table cells, quoted attributes, void elements and whitespace', () => {
  const source =
    '<table><tbody><tr><td colspan="2" class="x"> a\n b<br/> c</td><td><img src="attachment:abc" alt="a &amp; b"></td></tr></tbody></table>';
  const result = formatHTML(source);
  assert.equal(result.ok, true);
  assert.match(result.html, /colspan="2"\n\s+class="x"/);
  assert.ok(result.html.includes(' a\n b<br/> c'));
  assert.ok(result.html.includes('alt="a &amp; b"'));
});

test('declines unsupported, unsafe, malformed or ambiguous source without changes', () => {
  for (const source of [
    '<script>x</script>',
    '<p onclick="x">x</p>',
    '<a href="javascript:x">x</a>',
    '<p class="x" class="y">x</p>',
    '<p><b>x</p></b>',
    '<div/>',
    '<!-- unfinished',
    '<!-- invalid--comment -->',
    '<p class=>x</p>',
    '<p title="x>x</p>',
    '<p>x',
  ]) {
    assert.deepEqual(formatHTML(source), { ok: false, html: source, changed: false }, source);
  }
});

test('preserves comments, unquoted attributes and literal less-than text', () => {
  const source =
    '<!-- top --><div class=row title=hello><p>2 < 3 and <3</p><!----><!-- x > y --><img src=attachment:abc alt=diagram></div>';
  const result = formatHTML(source);
  assert.equal(result.ok, true);
  assert.ok(result.html.includes('<!-- top -->'));
  assert.ok(result.html.includes('<!----><!-- x > y -->'));
  assert.ok(result.html.includes('2 < 3 and <3'));
  assert.ok(result.html.includes('class=row'));
  assert.ok(result.html.includes('src=attachment:abc'));
  assert.deepEqual(formatHTML(result.html), { ok: true, html: result.html, changed: false });
});

test('does not mistake a slash in an unquoted value for a self-closing marker', () => {
  const source = '<a href=https://example.com/>link</a>';
  const result = formatHTML(source);
  assert.equal(result.ok, true);
  assert.ok(result.html.includes('href=https://example.com/>'));
});

test('leaves content without attributes unchanged', () => {
  const source = 'before <p> one <em>two</em> three </p> after';
  assert.deepEqual(formatHTML(source), { ok: true, html: source, changed: false });
});

test('preserves attribute spelling, value whitespace and sensitive text across repeated formatting', () => {
  const source =
    '<DIV  class = "row  gap-2"\n title = \' a > b \'>before <span style="font-weight: bold"> x </span> after<pre>\n  one\n\t two\n</pre></DIV>';
  const formatted = formatHTML(source);
  assert.equal(formatted.ok, true);
  assert.ok(formatted.html.includes('class = "row  gap-2"'));
  assert.ok(formatted.html.includes("title = ' a > b '"));
  assert.ok(formatted.html.includes('before <span'));
  assert.ok(formatted.html.includes('> x </span> after<pre>\n  one\n\t two\n</pre>'));
  assert.deepEqual(formatHTML(formatted.html), { ok: true, html: formatted.html, changed: false });
});

test('rejects ambiguous attribute syntax without altering the source', () => {
  for (const source of [
    '<p title="a"title="b">x</p>',
    '<p title="a" TITLE="b">x</p>',
    '<p title="a" class>x</p>',
    '<p title="a" / >x</p>',
  ]) {
    assert.deepEqual(formatHTML(source), { ok: false, html: source, changed: false }, source);
  }
});
