import { IMAGE_NAMESPACE, validImageAttachment } from '../detail/attachments.js';
import { cardComments, commentBlocks } from '../graph/card-comments.js';
import { DEFAULT_STATUS, effectiveStatus } from '../graph/card-status.js';
import { cardGroups } from '../graph/card-groups.js';
import { DOCUMENT } from '../graph/html-document.js';
import { nodeStyle } from '../graph/mind-map.js';
import { projectIndex } from '../graph/project-index.js';
import { documentBlocks } from './document-blocks.js';
import { outline } from './order.js';

/**
 * Pure mapping from a project to the Word export IR (see planner/plan.md sections 2.2-2.4).
 * Labels are already translated by the caller; positions, styles, pins and dates are not exported.
 *
 * @typedef {import('../graph/types.js').Project} Project
 * @typedef {import('../graph/types.js').Card} Card
 * @typedef {import('../graph/types.js').Relation} Relation
 * @typedef {import('./order.js').OutlineGroup} OutlineGroup
 * @typedef {import('./document-blocks.js').Block} Block
 * @typedef {import('./document-blocks.js').Inline} Inline
 * @typedef {{ ungrouped: string, links: string, type: string, tags: string, legacySource: string, mermaidSource: string, remoteImage: string, image: string, group: string, contents: string, contentsHint: string, contentsTip: string, comments: string, commentTime?: (iso: string) => string, status?: string, statuses?: Record<string, string> }} Labels
 * @typedef {{ title: string, description: string, blocks: Block[] }} DocModel
 * @typedef {{ project: Project, index: ReturnType<typeof projectIndex>, labels: Labels, listIds: { next: number }, cardMark: Map<string, string>, groups: Map<string, { title: string, bookmark: string }>, openings: Map<string, string>, groupLinks: Map<string, string[]> }} Context
 */

const MAX_HEADING_LEVEL = 9;
const FIRST_LIST_ID = 1;
const ARROWS = { end: '→', start: '←', both: '↔', none: '—' };
const DEFAULT_ARROW = 'end';
const ATTACHMENT_PREFIX = 'attachment:';
const PARAGRAPH_BREAK = /\r?\n[ \t]*\r?\n/;
const LINE_BREAK = /\r?\n/;
const LINK_STYLE = 'LinkItem';

/** @param {string} value @returns {Inline} */
const text = (value) => ({ type: 'text', text: value });
/** @param {string} style @param {Inline[]} inlines @returns {Block} */
const paragraph = (style, inlines) => ({ type: 'paragraph', style, inlines });
/** @param {string} anchor @param {string} label @returns {Inline} */
const anchorLink = (anchor, label) => ({ type: 'link', anchor, children: [text(label)] });

/** Lowercased text with whitespace collapsed, the form used to compare titles. */
const normalizeTitle = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * Opening card of each group: the first direct card whose title equals the group title. It is
 * printed under the group heading instead of repeating it.
 * @param {OutlineGroup[]} roots @param {Project} project
 * @returns {Map<string, string>} group id to card id
 */
function openingCards(roots, project) {
  const titles = new Map(project.cards.map((c) => [c.id, normalizeTitle(c.title)]));
  /** @type {Map<string, string>} */
  const result = new Map();
  /** @param {OutlineGroup} group */
  const visit = (group) => {
    const wanted = normalizeTitle(group.title);
    const opening = wanted && group.cardIds.find((id) => titles.get(id) === wanted);
    if (opening) result.set(group.id, opening);
    group.children.forEach(visit);
  };
  roots.forEach(visit);
  return result;
}

/**
 * Cards in the order they appear under their own heading: each group's own cards, then its
 * subgroups. Opening cards have no heading of their own and are left out.
 * @param {{ groups: OutlineGroup[], ungrouped: string[] }} tree @param {Map<string, string>} openings
 */
function emissionOrder({ groups, ungrouped }, openings) {
  /** @type {string[]} */
  const ids = [];
  /** @param {OutlineGroup} group */
  const visit = (group) => {
    ids.push(...group.cardIds.filter((id) => id !== openings.get(group.id)));
    group.children.forEach(visit);
  };
  groups.forEach(visit);
  return [...ids, ...ungrouped];
}

/** Title and bookmark of every group in the outline. @param {OutlineGroup[]} roots */
function groupInfo(roots) {
  /** @type {Map<string, { title: string, bookmark: string }>} */
  const info = new Map();
  /** @param {OutlineGroup} group */
  const visit = (group) => {
    info.set(group.id, { title: group.title, bookmark: group.bookmark });
    group.children.forEach(visit);
  };
  roots.forEach(visit);
  return info;
}

/** Group ids that have an arrow from each card, in group order. @param {Project} project */
function groupLinksBySource(project) {
  /** @type {Map<string, string[]>} */
  const result = new Map();
  for (const group of cardGroups(project))
    for (const link of group.links || []) {
      const list = result.get(link.source) || [];
      list.push(group.id);
      result.set(link.source, list);
    }
  return result;
}

/** Whether a document tree contains an `img` pointing at attachment `id`. */
function referencesAttachment(doc, id) {
  const nodes = Array.isArray(doc) ? doc : doc?.components;
  const wanted = ATTACHMENT_PREFIX + id;
  const visit = (node) =>
    Boolean(node) &&
    typeof node === 'object' &&
    (node.attributes?.src === wanted ||
      (Array.isArray(node.children) && node.children.some(visit)));
  return Array.isArray(nodes) && nodes.some(visit);
}

/** Display label of the card status, or null for the default NEW (kept out to stay compact).
 * @param {Card} card @param {Labels} labels */
function statusText(card, labels) {
  const value = effectiveStatus(card);
  return value === DEFAULT_STATUS ? null : (labels.statuses?.[value] ?? value);
}

/**
 * Meta line of a card. `withStatus` adds the status for a group's opening card, which has no
 * heading of its own to carry it.
 * @param {Card} card @param {Labels} labels @param {boolean} [withStatus] @returns {Block[]}
 */
function metaBlocks(card, labels, withStatus = false) {
  const parts = [];
  const status = withStatus ? statusText(card, labels) : null;
  if (status) parts.push((labels.status ?? 'Status') + ': ' + status);
  if (card.type) parts.push(labels.type + ': ' + card.type);
  if (card.tags?.length) parts.push(labels.tags + ': ' + card.tags.join(', '));
  return parts.length ? [paragraph('Meta', [text(parts.join(' · '))])] : [];
}

/** The node cover image as its own paragraph, unless the document already shows it. */
function coverBlocks(card, doc) {
  const style = nodeStyle(card);
  const images = card.extensions?.[IMAGE_NAMESPACE] || {};
  const id = style.coverImageId;
  if (!id || !Object.hasOwn(images, id) || !validImageAttachment(images[id])) return [];
  if (referencesAttachment(doc, id)) return [];
  const { name, mimeType, data } = images[id];
  const image = {
    type: 'image',
    key: card.id + '/' + id,
    mimeType,
    data,
    alt: style.imageAlt || name,
  };
  return [{ type: 'paragraph', inlines: [image] }];
}

/** Legacy Markdown source as plain paragraphs: blank lines split them, single newlines break. */
function legacyBlocks(content, labels) {
  const paragraphs = content
    .split(PARAGRAPH_BREAK)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => ({
      type: 'paragraph',
      inlines: chunk
        .split(LINE_BREAK)
        .flatMap((line, i) => (i ? [{ type: 'break' }, text(line)] : [text(line)])),
    }));
  return paragraphs.length ? [paragraph('Meta', [text(labels.legacySource)]), ...paragraphs] : [];
}

/** Plain text of a block's inlines, whitespace collapsed and lowercased, for duplicate checks. */
function normalizedText(block) {
  const collect = (inlines) => (inlines || []).map((i) => i.text ?? collect(i.children)).join('');
  return normalizeTitle(collect(block.inlines));
}

/** Whether `block` is of `type` and its text equals `value` (after the same normalization). */
function repeatsText(block, type, value) {
  const wanted = normalizeTitle(value);
  return Boolean(wanted) && block?.type === type && normalizedText(block) === wanted;
}

/**
 * Drops a leading heading equal to the card title, then a leading paragraph equal to the summary:
 * the card already prints both, so the document would repeat them.
 * @param {Block[]} blocks @param {Card} card
 */
function withoutRepeatedHead(blocks, card) {
  const rest = repeatsText(blocks[0], 'heading', card.title) ? blocks.slice(1) : blocks;
  return repeatsText(rest[0], 'paragraph', card.summary) ? rest.slice(1) : rest;
}

/** @param {Card} card @param {number} level @param {Context} ctx @returns {Block[]} */
function bodyBlocks(card, level, ctx) {
  const doc = card.extensions?.[DOCUMENT];
  if (doc)
    return withoutRepeatedHead(
      documentBlocks(doc, {
        cardId: card.id,
        headingBase: level,
        images: card.extensions?.[IMAGE_NAMESPACE] || {},
        labels: ctx.labels,
        listIds: ctx.listIds,
      }),
      card,
    );
  return card.content ? legacyBlocks(card.content, ctx.labels) : [];
}

/** One line for an outgoing relation. @param {Relation} relation @param {Context} ctx */
function relationBlock(relation, ctx) {
  const target = ctx.index.cards.get(relation.target);
  const arrow = ARROWS[relation.style?.arrow] || ARROWS[DEFAULT_ARROW];
  const title = target?.title || relation.target;
  const mark = ctx.cardMark.get(relation.target);
  /** @type {Inline[]} */
  const inlines = [text(arrow + ' '), mark ? anchorLink(mark, title) : text(title)];
  if (relation.label?.trim()) inlines.push(text(' (' + relation.label.trim() + ')'));
  if (relation.description?.trim()) inlines.push(text(' — ' + relation.description.trim()));
  return paragraph(LINK_STYLE, inlines);
}

/** Arrow from a card to a group frame. @param {string} groupId @param {Context} ctx */
function groupLinkBlock(groupId, ctx) {
  const group = ctx.groups.get(groupId);
  return paragraph(LINK_STYLE, [
    text('→ ' + ctx.labels.group + ': '),
    anchorLink(group.bookmark, group.title),
  ]);
}

/** Links section: relations leaving the card, then arrows to groups. */
function linkBlocks(card, level, ctx) {
  const relations = (ctx.index.outgoing.get(card.id) || []).map((r) => relationBlock(r, ctx));
  const groups = (ctx.groupLinks.get(card.id) || [])
    .filter((id) => ctx.groups.has(id))
    .map((id) => groupLinkBlock(id, ctx));
  if (!relations.length && !groups.length) return [];
  /** @type {Block} */
  const heading = {
    type: 'heading',
    level: Math.min(level + 1, MAX_HEADING_LEVEL),
    inlines: [text(ctx.labels.links)],
  };
  return [heading, ...relations, ...groups];
}

/** One comment block as IR: a paragraph with line breaks, or one list-item per entry. */
function commentBlock(block, ctx) {
  if (block.type === 'paragraph')
    return [
      {
        type: 'paragraph',
        inlines: block.lines.flatMap((line, i) =>
          i ? [{ type: 'break' }, text(line)] : [text(line)],
        ),
      },
    ];
  const listId = ctx.listIds.next++;
  return block.items.map((item) => ({
    type: 'list-item',
    ordered: block.ordered,
    level: 0,
    listId,
    ...(block.ordered && block.start ? { start: block.start } : {}),
    inlines: [text(item)],
  }));
}

/** Comments section: one dated Meta line per comment, then its paragraphs and lists. */
function commentSection(card, level, ctx) {
  const comments = cardComments(card);
  if (!comments.length) return [];
  /** @type {Block} */
  const heading = {
    type: 'heading',
    level: Math.min(level + 1, MAX_HEADING_LEVEL),
    inlines: [text(ctx.labels.comments)],
  };
  const entries = comments.flatMap((comment) => [
    paragraph('Meta', [text(ctx.labels.commentTime?.(comment.createdAt) ?? comment.createdAt)]),
    ...commentBlocks(comment.text).flatMap((block) => commentBlock(block, ctx)),
  ]);
  return [heading, ...entries];
}

/** @param {string} id @param {number} level @param {Context} ctx @returns {Block[]} */
function cardBlocks(id, level, ctx) {
  const card = ctx.index.cards.get(id);
  const status = statusText(card, ctx.labels);
  /** @type {Block} */
  const heading = {
    type: 'heading',
    level,
    inlines: [text(status ? card.title + ' [' + status + ']' : card.title)],
    bookmark: ctx.cardMark.get(id),
    card: true,
  };
  return [heading, ...cardContent(card, level, ctx)];
}

/** Everything of a card below its heading; `level` is the heading level it would have;
 * `withStatus` puts the status in the Meta line because no heading shows it. */
function cardContent(card, level, ctx, withStatus = false) {
  const doc = card.extensions?.[DOCUMENT];
  return [
    ...(card.summary ? [paragraph('Subtitle', [text(card.summary)])] : []),
    ...metaBlocks(card, ctx.labels, withStatus),
    ...coverBlocks(card, doc),
    ...bodyBlocks(card, level, ctx),
    ...linkBlocks(card, level, ctx),
    ...commentSection(card, level, ctx),
  ];
}

/** @param {OutlineGroup} group @param {Context} ctx @returns {Block[]} */
function groupBlocks(group, ctx) {
  /** @type {Block[]} */
  const blocks = [
    { type: 'heading', level: group.depth, inlines: [text(group.title)], bookmark: group.bookmark },
  ];
  if (group.description) blocks.push(paragraph('Lead', [text(group.description)]));
  const openingId = ctx.openings.get(group.id);
  if (openingId)
    blocks.push(...cardContent(ctx.index.cards.get(openingId), group.depth, ctx, true));
  for (const id of group.cardIds)
    if (id !== openingId) blocks.push(...cardBlocks(id, group.depth + 1, ctx));
  for (const child of group.children) blocks.push(...groupBlocks(child, ctx));
  return blocks;
}

/**
 * Contents entries below a top-level group, in document order; level is the depth below it.
 * @param {OutlineGroup} group @param {Context} ctx
 * @returns {{ text: string, anchor: string, level: number }[]}
 */
function groupEntries(group, ctx) {
  const level = group.depth - 1;
  const own = group.cardIds
    .filter((id) => id !== ctx.openings.get(group.id))
    .map((id) => ({
      text: ctx.index.cards.get(id).title,
      anchor: ctx.cardMark.get(id),
      level,
    }));
  const nested = group.children.flatMap((child) => [
    { text: child.title, anchor: child.bookmark, level: child.depth - 1 },
    ...groupEntries(child, ctx),
  ]);
  return [...own, ...nested];
}

/** Sections of the contents page: one per top-level group, then loose cards. */
function contentsSections(tree, ctx) {
  const loose = tree.ungrouped.map((id) => ({
    text: ctx.index.cards.get(id).title,
    anchor: ctx.cardMark.get(id),
    level: 0,
  }));
  if (!tree.groups.length) return [{ label: null, entries: loose }];
  const sections = tree.groups.map((group) => ({
    label: group.title,
    entries: groupEntries(group, ctx),
  }));
  return loose.length ? [...sections, { label: ctx.labels.ungrouped, entries: loose }] : sections;
}

/**
 * Builds the Word document model. Groups are chapters shared by both views; `view` only decides
 * the order of cards.
 * @param {Project} project
 * @param {{ view?: 'card' | 'mind', labels: Labels }} options
 * @returns {DocModel}
 */
export function wordDocument(project, { view = 'card', labels }) {
  const tree = outline(project, view);
  const openings = openingCards(tree.groups, project);
  /** @type {Context} */
  const ctx = {
    project,
    index: projectIndex(project),
    labels,
    listIds: { next: FIRST_LIST_ID },
    cardMark: new Map(emissionOrder(tree, openings).map((id, i) => [id, 'c' + (i + 1)])),
    groups: groupInfo(tree.groups),
    openings,
    groupLinks: groupLinksBySource(project),
  };
  // An opening card has no heading to carry a bookmark, so links to it use its group's bookmark.
  for (const [groupId, cardId] of openings)
    ctx.cardMark.set(cardId, ctx.groups.get(groupId).bookmark);
  /** @type {Block[]} */
  const blocks = [];
  if (ctx.cardMark.size)
    blocks.push(
      {
        type: 'toc',
        title: labels.contents,
        hint: labels.contentsHint,
        tip: labels.contentsTip,
        sections: contentsSections(tree, ctx),
      },
      { type: 'page-break' },
    );
  for (const group of tree.groups) blocks.push(...groupBlocks(group, ctx));
  const grouped = tree.groups.length > 0;
  if (grouped && tree.ungrouped.length)
    blocks.push({ type: 'heading', level: 1, inlines: [text(labels.ungrouped)] });
  const level = grouped ? 2 : 1;
  for (const id of tree.ungrouped) blocks.push(...cardBlocks(id, level, ctx));
  return {
    title: project.metadata.title,
    description: project.metadata.description || '',
    blocks,
  };
}
