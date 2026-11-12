import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PROMPT_ASSET, PROMPT_SOURCE, promptText } from '../scripts/sync-prompt.mjs';

test('promptText keeps only the part between the two rules', () => {
  assert.equal(promptText('intro\n\n---\n\nRules\n- a\n\n---\n\nUsage\n'), 'Rules\n- a\n');
  assert.equal(promptText('intro\r\n---\r\nBody\r\n---\r\nend'), 'Body\n');
  assert.throws(() => promptText('no rules here'));
});

test('the prompt asset the editor copies matches docs/board-html-prompt.md', async () => {
  const expected = promptText(await readFile(PROMPT_SOURCE, 'utf8'));
  const asset = (await readFile(PROMPT_ASSET, 'utf8')).replace(/\r\n/g, '\n');
  assert.equal(asset, expected, 'Run `npm run sync:prompt` after editing ' + PROMPT_SOURCE);
  assert.match(asset, /Yêu cầu nội dung của tôi/);
  assert.doesNotMatch(asset, /Cách dùng kết quả trong Board/);
});
