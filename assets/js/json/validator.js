import { imageAttachmentIssues } from '../detail/attachments.js';
import Ajv from '../../vendor/ajv-entry.js';
import schema from './schema.js';
const check = new Ajv({ allErrors: true, strict: false, strictNumbers: true }).compile(schema);
export const LIMITS = { file: 10 * 1024 * 1024, cards: 500, relations: 2000, content: 100000 };
const copy = (x) => JSON.parse(JSON.stringify(x));
export function validate(raw) {
  const errors = [],
    warnings = [];
  if (!check(raw))
    for (const e of check.errors) {
      let path = e.instancePath
        .replace(/\/([^/]+)/g, (_, p) => (/^\d+$/.test(p) ? '[' + p + ']' : '.' + p))
        .replace(/^\./, '');
      const prop = e.params.missingProperty || e.params.additionalProperty;
      if (prop) path += (path ? '.' : '') + prop;
      errors.push({ path: path || '$root', code: e.keyword, params: e.params });
    }
  if (errors.length) return { errors, warnings };
  const pending = [{ value: raw, path: '$root' }],
    seen = new WeakSet();
  while (pending.length) {
    const { value, path } = pending.pop();
    if (typeof value === 'number' && !Number.isFinite(value)) {
      errors.push({ path, code: 'jsonValue' });
      continue;
    }
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) continue;
    if (typeof value !== 'object') {
      errors.push({ path, code: 'jsonValue' });
      continue;
    }
    if (seen.has(value)) continue;
    seen.add(value);
    for (const [key, next] of Object.entries(value))
      pending.push({
        value: next,
        path: path + (Array.isArray(value) ? '[' + key + ']' : '.' + key),
      });
  }
  if (errors.length) return { errors, warnings };
  try {
    if (new TextEncoder().encode(JSON.stringify(raw, null, 2) + '\n').length > LIMITS.file)
      errors.push({ path: '$project', code: 'fileLimit' });
  } catch {
    errors.push({ path: '$root', code: 'jsonEncoding' });
  }
  if (errors.length) return { errors, warnings };
  const ids = new Set(),
    edgeIds = new Set(),
    duplicates = new Set();
  raw.cards.forEach((c, i) => {
    errors.push(...imageAttachmentIssues(c, 'cards[' + i + '].extensions.card-atlas:images'));
    if (ids.has(c.id)) errors.push({ path: 'cards[' + i + '].id', code: 'duplicateId' });
    ids.add(c.id);
  });
  raw.relations.forEach((r, i) => {
    if (edgeIds.has(r.id)) errors.push({ path: 'relations[' + i + '].id', code: 'duplicateId' });
    edgeIds.add(r.id);
    for (const field of ['source', 'target'])
      if (!ids.has(r[field]))
        errors.push({
          path: 'relations[' + i + '].' + field,
          code: 'missingEndpoint',
          params: { id: r[field] },
        });
    if (r.source === r.target)
      errors.push({ path: 'relations[' + i + '].target', code: 'selfLoop' });
    const key = JSON.stringify([r.source, r.target, r.type ?? 'default', r.label ?? '']);
    if (duplicates.has(key))
      warnings.push({ path: 'relations[' + i + ']', code: 'duplicateRelation' });
    duplicates.add(key);
  });
  return { errors, warnings };
}
export function normalize(raw) {
  const p = copy(raw);
  const adjustments = [];
  const fill = (obj, key, value, path) => {
    if (obj[key] === undefined) {
      Object.defineProperty(obj, key, {
        value: copy(value),
        writable: true,
        enumerable: true,
        configurable: true,
      });
      adjustments.push({ path, code: 'defaultAdded' });
    }
  };
  fill(p, 'metadata', {}, 'metadata');
  fill(p.metadata, 'title', 'Untitled Project', 'metadata.title');
  fill(p.metadata, 'description', '', 'metadata.description');
  fill(p, 'canvas', {}, 'canvas');
  fill(p.canvas, 'zoom', 1, 'canvas.zoom');
  fill(p.canvas, 'position', { x: 0, y: 0 }, 'canvas.position');
  p.cards.forEach((c, i) => {
    const base = 'cards[' + i + ']';
    for (const [k, v] of Object.entries({
      summary: '',
      type: 'default',
      tags: [],
      content: '',
      size: { width: 260, height: 140 },
      style: {},
    }))
      fill(c, k, v, base + '.' + k);
    for (const [k, v] of Object.entries({
      backgroundColor: '#FFFFFF',
      textColor: '#0F172A',
      borderColor: '#CBD5E1',
    }))
      fill(c.style, k, v, base + '.style.' + k);
  });
  const existing = p.cards.filter((c) => c.position);
  const x = existing.length
    ? Math.max(...existing.map((c) => c.position.x + c.size.width)) + 60
    : 0;
  const y = existing.length ? Math.min(...existing.map((c) => c.position.y)) : 0;
  let n = 0;
  p.cards.forEach((c, i) => {
    if (!c.position) {
      fill(
        c,
        'position',
        { x: x + (n % 4) * 320, y: y + Math.floor(n / 4) * 220 },
        'cards[' + i + '].position',
      );
      n++;
    }
  });
  p.relations.forEach((r, i) => {
    const base = 'relations[' + i + ']';
    for (const [k, v] of Object.entries({ label: '', description: '', type: 'default', style: {} }))
      fill(r, k, v, base + '.' + k);
    for (const [k, v] of Object.entries({ color: '#64748b', line: 'solid', arrow: 'end' }))
      fill(r.style, k, v, base + '.style.' + k);
  });
  return { project: p, adjustments };
}
export function stage(text, bytes = new TextEncoder().encode(text).length) {
  if (bytes > LIMITS.file)
    return { errors: [{ path: '$file', code: 'fileLimit' }], warnings: [], adjustments: [] };
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { errors: [{ path: '$file', code: 'syntax' }], warnings: [], adjustments: [] };
  }
  const result = validate(raw);
  if (result.errors.length) return { ...result, adjustments: [] };
  const normalized = normalize(raw);
  const final = validate(normalized.project);
  if (final.errors.length) return { ...final, adjustments: normalized.adjustments };
  return { ...result, ...normalized };
}
export function serialize(project, viewport = project.canvas) {
  return JSON.stringify({ ...project, canvas: copy(viewport) }, null, 2) + '\n';
}
export function filename(title) {
  const name = title
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 100);
  return (name || 'graph-project') + '.json';
}
export function blank() {
  return normalize({
    version: '1.0',
    metadata: { title: 'Untitled Project', description: '' },
    canvas: { zoom: 1, position: { x: 0, y: 0 } },
    cards: [],
    relations: [],
  }).project;
}
