export const GROUPS = 'card-atlas:groups';
export const cardGroups = (project) => project.extensions?.[GROUPS]?.groups || [];

/** Groups may nest up to this many levels (a top-level group is level 1). */
export const MAX_GROUP_DEPTH = 3;

/** Parent and children of every group; a parentId that names no group counts as no parent. */
export function groupTree(project) {
  const groups = cardGroups(project);
  const byId = new Map(groups.map((g) => [g.id, g]));
  const children = new Map(groups.map((g) => [g.id, []]));
  for (const g of groups)
    if (g.parentId && byId.has(g.parentId)) children.get(g.parentId).push(g.id);
  return { byId, children };
}

/** Level of a group: 1 for a top-level group; Infinity when its parents form a cycle. */
export function groupDepth(project, id) {
  const { byId } = groupTree(project);
  const seen = new Set();
  let depth = 0;
  for (let g = byId.get(id); g; g = byId.get(g.parentId)) {
    if (seen.has(g.id)) return Infinity;
    seen.add(g.id);
    depth += 1;
  }
  return depth;
}

/** Ids of every group nested inside `id`, deepest last. */
export function descendantGroups(project, id) {
  const { children } = groupTree(project);
  const result = [];
  const pending = [...(children.get(id) || [])];
  while (pending.length) {
    const next = pending.shift();
    if (result.includes(next)) continue;
    result.push(next);
    pending.push(...(children.get(next) || []));
  }
  return result;
}

/** Number of levels from `id` down to its deepest subgroup (1 when it has none). */
function groupHeight(project, id) {
  const { children } = groupTree(project);
  const height = (gid, seen) =>
    seen.has(gid)
      ? Infinity
      : 1 +
        Math.max(0, ...(children.get(gid) || []).map((c) => height(c, new Set([...seen, gid]))));
  return height(id, new Set());
}

/** Cards of a group and of all its subgroups: what moves when the frame is dragged. */
export function groupCardIds(project, id) {
  const { byId } = groupTree(project);
  return [id, ...descendantGroups(project, id)].flatMap((gid) => byId.get(gid)?.cardIds || []);
}

export function groupIssues(project) {
  const value = project.extensions?.[GROUPS];
  if (value === undefined) return [];
  const error = { path: 'extensions.' + GROUPS, code: 'groups' };
  if (!value || !Array.isArray(value.groups)) return [error];
  const ids = new Set(),
    members = new Set(),
    linkIds = new Set(),
    cards = new Set(project.cards.map((c) => c.id));
  for (const group of value.groups) {
    if (ids.has(group.id)) return [error];
    ids.add(group.id);
    for (const id of group.cardIds) {
      if (!cards.has(id) || members.has(id)) return [error];
      members.add(id);
    }
    for (const link of group.links || []) {
      if (linkIds.has(link.id) || !cards.has(link.source)) return [error];
      linkIds.add(link.id);
    }
  }
  const { children } = groupTree(project);
  for (const group of value.groups) {
    if (group.parentId !== undefined && (!ids.has(group.parentId) || group.parentId === group.id))
      return [error];
    if (groupDepth(project, group.id) > MAX_GROUP_DEPTH) return [error];
    // A group with neither notes nor subgroups would draw nothing.
    if (!group.cardIds.length && !children.get(group.id).length) return [error];
  }
  return [];
}

/**
 * Where a new group made from `ids` goes: top level when no card is grouped, inside group G when
 * every card sits directly in G. Mixed selections and too-deep nesting return an issue key.
 * @returns {{ parentId: string | null } | { issue: 'groupAlreadyAssigned' | 'groupTooDeep' }}
 */
export function newGroupParent(project, ids) {
  const owner = new Map(cardGroups(project).flatMap((g) => g.cardIds.map((id) => [id, g.id])));
  const parents = new Set(ids.map((id) => owner.get(id) || null));
  if (parents.size !== 1) return { issue: 'groupAlreadyAssigned' };
  const [parentId] = parents;
  if (parentId && groupDepth(project, parentId) >= MAX_GROUP_DEPTH)
    return { issue: 'groupTooDeep' };
  return { parentId };
}

/** Adds a group; cards taken from a parent group move into the new subgroup. */
export function createGroup(project, group) {
  const place = newGroupParent(project, group.cardIds);
  if (place.issue) throw Error(place.issue);
  project.extensions ||= {};
  project.extensions[GROUPS] ||= { groups: [] };
  const added = structuredClone(group);
  if (place.parentId) {
    added.parentId = place.parentId;
    const parent = cardGroups(project).find((g) => g.id === place.parentId);
    parent.cardIds = parent.cardIds.filter((id) => !group.cardIds.includes(id));
  } else delete added.parentId;
  project.extensions[GROUPS].groups.push(added);
}

/** Ungroups: the group's notes and subgroups move up one level; nothing is deleted. */
export function removeGroup(project, id) {
  if (!project.extensions?.[GROUPS]) return;
  const groups = cardGroups(project);
  const removed = groups.find((g) => g.id === id);
  if (!removed) return;
  const parent = groups.find((g) => g.id === removed.parentId);
  if (parent) parent.cardIds = [...parent.cardIds, ...removed.cardIds];
  for (const child of groups)
    if (child.parentId === id) {
      if (parent) child.parentId = parent.id;
      else delete child.parentId;
    }
  project.extensions[GROUPS].groups = groups.filter((g) => g.id !== id);
}

/**
 * Applies the group dialog inside a store command. Notes taken out of a subgroup go back to its
 * parent group; `parentId` (null for top level) must be one of `parentOptions`.
 */
export function updateGroup(project, id, { title, description, cardIds, linkIds, parentId }) {
  const groups = cardGroups(project);
  const group = groups.find((g) => g.id === id);
  const removed = group.cardIds.filter((card) => !cardIds.includes(card));
  const parent = groups.find((g) => g.id === group.parentId);
  if (parent && removed.length) parent.cardIds = [...parent.cardIds, ...removed];
  group.title = title;
  group.cardIds = group.cardIds.filter((card) => cardIds.includes(card));
  if (description) group.description = description;
  else delete group.description;
  const links = (group.links || []).filter((link) => linkIds.includes(link.id));
  if (links.length) group.links = links;
  else delete group.links;
  if (parentId !== undefined && parentId !== (group.parentId || null)) {
    if (parentId && !parentOptions(project, id).some((g) => g.id === parentId))
      throw Error('groupTooDeep');
    if (parentId) group.parentId = parentId;
    else delete group.parentId;
  }
}

/** Groups that `id` may be moved into: not itself or its subgroups, and within the depth limit. */
export function parentOptions(project, id) {
  const blocked = new Set([id, ...descendantGroups(project, id)]);
  const height = groupHeight(project, id);
  return cardGroups(project).filter(
    (g) => !blocked.has(g.id) && groupDepth(project, g.id) + height <= MAX_GROUP_DEPTH,
  );
}

export function cleanupGroups(project) {
  const ids = new Set(project.cards.map((c) => c.id));
  if (!project.extensions?.[GROUPS]) return;
  let groups = cardGroups(project).map((g) => {
    const next = { ...g, cardIds: g.cardIds.filter((id) => ids.has(id)) };
    if (g.links) {
      const links = g.links.filter((link) => ids.has(link.source));
      if (links.length) next.links = links;
      else delete next.links;
    }
    return next;
  });
  // Dropping an empty subgroup can leave its parent empty too, so repeat until nothing changes.
  for (let changed = true; changed;) {
    const parents = new Set(groups.map((g) => g.parentId).filter(Boolean));
    const kept = groups.filter((g) => g.cardIds.length || parents.has(g.id));
    changed = kept.length !== groups.length;
    groups = kept;
  }
  project.extensions[GROUPS].groups = groups;
}

/**
 * Why an arrow from `source` to group `groupId` cannot be added, or null when it can.
 * @returns {'groupLinkMember' | 'groupLinkExists' | 'groupLinkMissing' | null}
 */
export function groupLinkIssue(project, groupId, source) {
  const group = cardGroups(project).find((g) => g.id === groupId);
  if (!group || !project.cards.some((c) => c.id === source)) return 'groupLinkMissing';
  if (groupCardIds(project, groupId).includes(source)) return 'groupLinkMember';
  if ((group.links || []).some((link) => link.source === source)) return 'groupLinkExists';
  return null;
}

/** Adds an arrow from a card to a group inside a store command; the caller checks groupLinkIssue. */
export function addGroupLink(project, groupId, link) {
  const group = cardGroups(project).find((g) => g.id === groupId);
  group.links = [...(group.links || []), { id: link.id, source: link.source }];
}

// Derived bounds only: a frame never becomes another source of persisted geometry.
export function frameBounds(rects, ids, inner = []) {
  // Subgroup frames count as members, so a parent frame encloses them with room for its title.
  const members = [
    ...ids.map((id) => rects.get(id)).filter(Boolean),
    ...inner.map((b) => ({
      position: { x: b.x, y: b.y },
      size: { width: b.width, height: b.height },
    })),
  ];
  if (!members.length) return null;
  const x = Math.min(...members.map((g) => g.position.x)) - 28;
  const y = Math.min(...members.map((g) => g.position.y)) - 60;
  return {
    x,
    y,
    width: Math.max(280, Math.max(...members.map((g) => g.position.x + g.size.width)) + 28 - x),
    height: Math.max(...members.map((g) => g.position.y + g.size.height)) + 28 - y,
  };
}

/** The group a card sits in directly, or null. */
export function groupOfCard(project, cardId) {
  return cardGroups(project).find((g) => g.cardIds.includes(cardId)) || null;
}

/**
 * Every group as a tree walked depth-first, for pickers: top-level groups first, children under
 * their parent. `count` is the number of notes in the group and its subgroups.
 * @returns {{ id: string, title: string, depth: number, count: number }[]}
 */
export function groupOutline(project) {
  const { byId, children } = groupTree(project);
  const result = [];
  const walk = (id, depth, seen) => {
    if (seen.has(id)) return;
    const group = byId.get(id);
    result.push({
      id,
      title: group.title,
      depth,
      count: groupCardIds(project, id).length,
    });
    for (const child of children.get(id)) walk(child, depth + 1, new Set([...seen, id]));
  };
  for (const g of cardGroups(project))
    if (!g.parentId || !byId.has(g.parentId)) walk(g.id, 1, new Set());
  return result;
}

/**
 * Adds ungrouped notes to a group inside a store command. Arrows from these notes to the group or
 * to one of its parents would now point at their own group, so they are dropped in the same command.
 * @returns {number} how many arrows were dropped
 */
export function addCardsToGroup(project, groupId, ids) {
  const { byId } = groupTree(project);
  const group = byId.get(groupId);
  if (!group) throw Error('groupLinkMissing');
  if (ids.some((id) => groupOfCard(project, id))) throw Error('groupAlreadyAssigned');
  group.cardIds = [...group.cardIds, ...ids];
  let dropped = 0;
  const seen = new Set();
  for (let g = group; g && !seen.has(g.id); g = byId.get(g.parentId)) {
    seen.add(g.id);
    if (!g.links) continue;
    const links = g.links.filter((link) => !ids.includes(link.source));
    dropped += g.links.length - links.length;
    if (links.length) g.links = links;
    else delete g.links;
  }
  return dropped;
}

/** Notes selected for removal, grouped by the group they sit in directly. */
function removalsByGroup(project, ids) {
  const removals = new Map();
  for (const g of cardGroups(project)) {
    const taken = g.cardIds.filter((id) => ids.includes(id));
    if (taken.length) removals.set(g.id, taken);
  }
  return removals;
}

/**
 * Why `ids` cannot leave their groups, or null when they can: a group may not end up with neither
 * notes nor subgroups.
 * @returns {'groupNeedsMember' | 'groupNeedsMemberNested' | null}
 */
export function removeFromGroupIssue(project, ids) {
  const removals = removalsByGroup(project, ids);
  if (!removals.size) return null;
  const draft = {
    ...project,
    extensions: { ...project.extensions, [GROUPS]: structuredClone(project.extensions[GROUPS]) },
  };
  applyRemoval(draft, ids);
  const { children } = groupTree(draft);
  const empty = cardGroups(draft).find((g) => !g.cardIds.length && !children.get(g.id).length);
  if (!empty) return null;
  return empty.parentId ? 'groupNeedsMemberNested' : 'groupNeedsMember';
}

function applyRemoval(project, ids) {
  const removals = removalsByGroup(project, ids);
  for (const g of cardGroups(project)) {
    const taken = removals.get(g.id);
    if (!taken) continue;
    updateGroup(project, g.id, {
      title: g.title,
      description: g.description,
      cardIds: g.cardIds.filter((id) => !taken.includes(id)),
      linkIds: (g.links || []).map((link) => link.id),
    });
  }
}

/**
 * Takes notes out of their group inside a store command: notes of a subgroup go back to its parent,
 * notes of a top-level group leave all groups. Ungrouped ids are ignored.
 */
export function removeCardsFromGroup(project, ids) {
  const issue = removeFromGroupIssue(project, ids);
  if (issue) throw Error(issue);
  applyRemoval(project, ids);
}
