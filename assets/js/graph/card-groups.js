export const GROUPS = 'card-atlas:groups';
export const cardGroups = (project) => project.extensions?.[GROUPS]?.groups || [];

export function groupIssues(project) {
  const value = project.extensions?.[GROUPS];
  if (value === undefined) return [];
  const error = { path: 'extensions.' + GROUPS, code: 'groups' };
  if (!value || !Array.isArray(value.groups)) return [error];
  const ids = new Set(),
    members = new Set(),
    cards = new Set(project.cards.map((c) => c.id));
  for (const group of value.groups) {
    if (ids.has(group.id)) return [error];
    ids.add(group.id);
    for (const id of group.cardIds) {
      if (!cards.has(id) || members.has(id)) return [error];
      members.add(id);
    }
  }
  return [];
}

export function createGroup(project, group) {
  const occupied = new Set(cardGroups(project).flatMap((g) => g.cardIds));
  if (group.cardIds.some((id) => occupied.has(id))) throw Error('groupAlreadyAssigned');
  project.extensions ||= {};
  project.extensions[GROUPS] ||= { groups: [] };
  project.extensions[GROUPS].groups.push(structuredClone(group));
}

export function removeGroup(project, id) {
  if (!project.extensions?.[GROUPS]) return;
  project.extensions[GROUPS].groups = cardGroups(project).filter((g) => g.id !== id);
}

export function cleanupGroups(project) {
  const ids = new Set(project.cards.map((c) => c.id));
  if (!project.extensions?.[GROUPS]) return;
  project.extensions[GROUPS].groups = cardGroups(project)
    .map((g) => ({ ...g, cardIds: g.cardIds.filter((id) => ids.has(id)) }))
    .filter((g) => g.cardIds.length);
}

// Derived bounds only: a frame never becomes another source of persisted geometry.
export function frameBounds(rects, ids) {
  const members = ids.map((id) => rects.get(id)).filter(Boolean);
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
