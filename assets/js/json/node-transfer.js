import { TYPOGRAPHY } from '../graph/card-typography.js';
import { CARD_META } from '../graph/card-metadata.js';
import { clone } from '../common/data.js';
import { validate, stage, serialize } from './validator.js';
import { NODE, MIND, VIEWS, geometry, setGeometry } from '../graph/mind-map.js';
import { APPEARANCE } from '../detail/appearance.js';
import { IMAGE_NAMESPACE } from '../detail/attachments.js';
import { marked } from '../../vendor/marked-entry.js';

const known = new Set([CARD_META, TYPOGRAPHY, NODE, APPEARANCE, IMAGE_NAMESPACE]);
export function transferError(code, issues = []) {
  const error = new Error(code);
  error.issues = issues;
  return error;
}
export function assertProject(project) {
  const result = validate(project);
  if (result.errors.length) throw transferError('transferInvalid', result.errors);
  return project;
}
export function attachmentIds(content) {
  const ids = new Set([...content.matchAll(/attachment:([A-Za-z0-9_-]+)/g)].map((m) => m[1]));
  marked.walkTokens(marked.lexer(content), (token) => {
    if (!['image', 'link'].includes(token.type) || !token.href.startsWith('attachment:')) return;
    if (!/^attachment:[A-Za-z0-9_-]+$/.test(token.href))
      throw transferError('transferMissingImage');
    ids.add(token.href.slice('attachment:'.length));
  });
  return ids;
}
export function assertReferences(card) {
  const ids = attachmentIds(card.content || '');
  const cover = card.extensions?.[NODE]?.coverImageId;
  if (cover) ids.add(cover);
  const images = card.extensions?.[IMAGE_NAMESPACE] || {};
  for (const id of ids) if (!Object.hasOwn(images, id)) throw transferError('transferMissingImage');
  return ids;
}
export function excludedProjectNamespaces(project) {
  return Object.keys(project.extensions || {}).filter((key) => ![MIND, VIEWS].includes(key));
}
export function nodeFile(project, card, { includeUnused = true, excludeUnknown = false } = {}) {
  const excluded = excludedProjectNamespaces(project);
  if (excluded.length && !excludeUnknown) throw transferError('transferAcknowledge');
  const selected = clone(card);
  const used = assertReferences(selected);
  if (!includeUnused && selected.extensions?.[IMAGE_NAMESPACE])
    selected.extensions[IMAGE_NAMESPACE] = Object.fromEntries(
      Object.entries(selected.extensions[IMAGE_NAMESPACE]).filter(([id]) => used.has(id)),
    );
  const output = {
    version: '1.0',
    metadata: { title: selected.title, description: selected.summary },
    canvas: clone(project.canvas),
    cards: [selected],
    relations: [],
  };
  const extensions = {};
  if (project.extensions?.[MIND]?.rootId === selected.id)
    extensions[MIND] = { rootId: selected.id };
  const sourceView = project.extensions?.[VIEWS]?.mindMap;
  if (sourceView) {
    const view = {};
    for (const key of ['positions', 'sizes'])
      if (Object.hasOwn(sourceView[key] || {}, selected.id))
        view[key] = { [selected.id]: clone(sourceView[key][selected.id]) };
    if (sourceView.viewport) view.viewport = clone(sourceView.viewport);
    extensions[VIEWS] = { mindMap: view };
  }
  if (Object.keys(extensions).length) output.extensions = extensions;
  assertProject(output);
  return serialize(output);
}
export function stageNode(text, bytes) {
  const result = stage(text, bytes);
  if (result.errors.length) throw transferError('transferInvalid', result.errors);
  if (result.project.cards.length !== 1 || result.project.relations.length)
    throw transferError('transferOneCard');
  assertReferences(result.project.cards[0]);
  return result;
}
export function extensionConflicts(current, incoming) {
  return Object.keys(incoming.extensions || {}).filter(
    (key) =>
      !known.has(key) &&
      Object.hasOwn(current.extensions || {}, key) &&
      JSON.stringify(current.extensions[key]) !== JSON.stringify(incoming.extensions[key]),
  );
}
export function mergeNode(current, incoming, { takeFormat = false, takeUnknown = false } = {}) {
  assertReferences(incoming);
  const card = clone(current);
  for (const key of ['title', 'summary', 'type', 'tags', 'content'])
    card[key] = clone(incoming[key]);
  const images = { ...clone(current.extensions?.[IMAGE_NAMESPACE] || {}) };
  const mapping = new Map();
  for (const [id, image] of Object.entries(incoming.extensions?.[IMAGE_NAMESPACE] || {})) {
    let next = id,
      suffix = 1;
    while (Object.hasOwn(images, next) && JSON.stringify(images[next]) !== JSON.stringify(image))
      next = id + '-import-' + suffix++;
    Object.defineProperty(images, next, {
      value: clone(image),
      enumerable: true,
      writable: true,
      configurable: true,
    });
    mapping.set(id, next);
  }
  card.content = card.content.replace(/attachment:([A-Za-z0-9_-]+)/g, (all, id) =>
    mapping.has(id) ? 'attachment:' + mapping.get(id) : all,
  );
  card.extensions = { ...card.extensions };
  if (Object.keys(images).length) card.extensions[IMAGE_NAMESPACE] = images;
  for (const [key, value] of Object.entries(incoming.extensions || {}))
    if (!known.has(key) && (takeUnknown || !Object.hasOwn(card.extensions, key)))
      card.extensions[key] = clone(value);
  if (takeFormat) {
    card.style = clone(incoming.style);
    for (const key of [NODE, APPEARANCE, TYPOGRAPHY]) {
      if (incoming.extensions?.[key]) card.extensions[key] = clone(incoming.extensions[key]);
      else delete card.extensions[key];
    }
    const node = card.extensions[NODE];
    if (node?.coverImageId) node.coverImageId = mapping.get(node.coverImageId) || node.coverImageId;
  }
  assertReferences(card);
  return { card, remapped: [...mapping].filter(([id, next]) => id !== next) };
}
export function updateNodeProject(project, id, merged, source, view, takeFormat) {
  const next = clone(project);
  const index = next.cards.findIndex((card) => card.id === id);
  if (index < 0) throw transferError('transferInvalid');
  next.cards[index] = clone(merged);
  if (takeFormat) setGeometry(next, id, view, 'size', geometry(source, source.cards[0], view).size);
  return assertProject(next);
}
export function addNodeProject(project, source, id, view, position) {
  if (project.cards.some((card) => card.id === id)) throw transferError('transferInvalid');
  const next = clone(project),
    card = clone(source.cards[0]);
  card.id = id;
  card.position = clone(position);
  assertReferences(card);
  next.cards.push(card);
  if (view === 'mind') {
    setGeometry(next, id, view, 'position', position);
    setGeometry(next, id, view, 'size', geometry(source, source.cards[0], view).size);
  }
  return assertProject(next);
}
