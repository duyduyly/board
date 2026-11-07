import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { convertMarkdownCard } from './markdown-convert.mjs';
import { validate, LIMITS } from '../assets/js/json/validator.js';

const args = process.argv.slice(2);
if (args[0] !== '--out' || !args[1] || args.length < 3) {
  console.error(
    'Usage: node scripts/convert-markdown-files.mjs --out NEW_DIRECTORY INPUT.json [INPUT.json ...]',
  );
  process.exitCode = 2;
} else {
  try {
    const output = resolve(args[1]);
    const inputs = args.slice(2).map((path) => resolve(path));
    const names = inputs.map((path) => basename(path));
    if (
      new Set(inputs).size !== inputs.length ||
      new Set(names.map((n) => n.toLowerCase())).size !== names.length
    )
      throw Error('Duplicate input or filename');
    if (
      inputs.some((p) => p === output || p.startsWith(output + '\\') || p.startsWith(output + '/'))
    )
      throw Error('Output directory must not contain input files');
    const prepared = [];
    for (const [index, path] of inputs.entries()) {
      const bytes = await readFile(path);
      if (bytes.length > LIMITS.file) throw Error('File too large: ' + path);
      const original = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      const issues = validate(original).errors;
      if (issues.length) throw Error('Invalid input: ' + path + ' ' + JSON.stringify(issues));
      const converted = structuredClone(original);
      const reports = [];
      converted.cards = original.cards.map((card) => {
        const result = convertMarkdownCard(card);
        reports.push({ id: card.id, skipped: result.skipped, warnings: result.warnings });
        return result.card;
      });
      const result = validate(converted);
      if (result.errors.length)
        throw Error('Invalid result: ' + path + ' ' + JSON.stringify(result.errors));
      const json = JSON.stringify(converted, null, 2) + '\n';
      if (Buffer.byteLength(json) > LIMITS.file) throw Error('Converted file too large: ' + path);
      prepared.push({
        path,
        name: names[index],
        bytes,
        json,
        report: reports,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
    await mkdir(output, { recursive: false });
    await mkdir(resolve(output, 'backup'));
    await mkdir(resolve(output, 'converted'));
    for (const file of prepared) {
      await writeFile(resolve(output, 'backup', file.name), file.bytes, { flag: 'wx' });
      await writeFile(resolve(output, 'converted', file.name), file.json, { flag: 'wx' });
    }
    const manifest = {
      createdAt: new Date().toISOString(),
      files: prepared.map((file) => ({
        input: file.path,
        name: file.name,
        originalSha256: file.sha256,
        convertedSha256: createHash('sha256').update(file.json).digest('hex'),
        cards: file.report,
      })),
    };
    await writeFile(resolve(output, 'report.json'), JSON.stringify(manifest, null, 2) + '\n', {
      flag: 'wx',
    });
    console.log(
      JSON.stringify({
        output,
        files: prepared.length,
        cards: prepared.reduce((sum, file) => sum + file.report.length, 0),
        warnings: prepared.reduce(
          (sum, file) => sum + file.report.reduce((n, card) => n + card.warnings.length, 0),
          0,
        ),
      }),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
