// Publishes the reusable part of docs/board-html-prompt.md (between its two `---` rules) under
// assets/, the only folder the app may read at runtime. Run after editing the prompt:
//   npm run sync:prompt
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const PROMPT_SOURCE = 'docs/board-html-prompt.md';
export const PROMPT_ASSET = 'assets/data/board-html-prompt.md';

/** @param {string} markdown @returns {string} */
export function promptText(markdown) {
  const parts = markdown.replace(/\r\n/g, '\n').split(/^---\s*$/m);
  if (parts.length < 3) throw new Error('The prompt must sit between two --- rules.');
  return parts.slice(1, -1).join('---').trim() + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await fs.writeFile(PROMPT_ASSET, promptText(await fs.readFile(PROMPT_SOURCE, 'utf8')));
  console.log('Wrote ' + PROMPT_ASSET);
}
