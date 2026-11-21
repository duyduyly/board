import { clone } from '../common/data.js';
import { GROUPS } from '../graph/card-groups.js';
import { MIND, VIEWS } from '../graph/mind-map.js';
import { serialize, stage } from './validator.js';

const supportedProjectExtensions = new Set([GROUPS, MIND, VIEWS]);

// Derive a portable project without mutating the live project or its selection.
// Unknown project namespaces may contain references that cannot safely be
// rewritten; callers must disclose excludedNamespaces before exporting.
export function selectionFile(project, selectedIds, { viewport, viewports } = {}) {
  if (
    !selectedIds ||
    typeof selectedIds === 'string' ||
    typeof selectedIds[Symbol.iterator] !== 'function'
  )
    throw new Error('selectionInvalid');
  const ids = new Set(selectedIds);
  if (!ids.size) throw new Error('selectionEmpty');
  const existing = new Set(project.cards.map((card) => card.id));
  if ([...ids].some((id) => !existing.has(id))) throw new Error('selectionMissing');

  const cards = project.cards.filter((card) => ids.has(card.id)).map(clone);
  const relations = project.relations
    .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    .map(clone);
  const output = {
    version: project.version,
    metadata: clone(project.metadata || {}),
    canvas: clone(project.canvas || { zoom: 1, position: { x: 0, y: 0 } }),
    cards,
    relations,
  };
  const extensions = {};
  const source = project.extensions || {};
  const excludedNamespaces = Object.keys(source).filter(
    (key) => !supportedProjectExtensions.has(key),
  );
  const partialGroups = [];
  if (source[GROUPS]) {
    const groups = source[GROUPS].groups.flatMap((group) => {
      const cardIds = group.cardIds.filter((id) => ids.has(id));
      if (!cardIds.length) return [];
      if (cardIds.length !== group.cardIds.length)
        partialGroups.push({
          id: group.id,
          title: group.title,
          selected: cardIds.length,
          total: group.cardIds.length,
        });
      const exported = { ...clone(group), cardIds };
      // Arrows whose card is left out would point at nothing in the exported file.
      const links = (group.links || []).filter((link) => ids.has(link.source));
      if (links.length) exported.links = clone(links);
      else delete exported.links;
      return [exported];
    });
    // Keep the parents of exported groups so nesting survives. A parent with no selected note is
    // kept with no notes (and no arrows from unselected notes); a parent left out drops parentId.
    const byId = new Map(source[GROUPS].groups.map((group) => [group.id, group]));
    const kept = new Map(groups.map((group) => [group.id, group]));
    for (const group of groups) {
      let parent = byId.get(group.parentId);
      while (parent && !kept.has(parent.id)) {
        const empty = { ...clone(parent), cardIds: [] };
        const links = (parent.links || []).filter((link) => ids.has(link.source));
        if (links.length) empty.links = links;
        else delete empty.links;
        kept.set(parent.id, empty);
        parent = byId.get(parent.parentId);
      }
    }
    const nested = [...kept.values()];
    for (const group of nested)
      if (group.parentId && !kept.has(group.parentId)) delete group.parentId;
    if (nested.length) extensions[GROUPS] = { groups: nested };
  }
  if (source[MIND]) {
    const mind = clone(source[MIND]);
    if (mind.rootId && !ids.has(mind.rootId)) delete mind.rootId;
    extensions[MIND] = mind;
  }
  if (source[VIEWS]) {
    const views = clone(source[VIEWS]);
    if (views.mindMap) {
      for (const key of ['positions', 'sizes']) {
        if (views.mindMap[key])
          views.mindMap[key] = Object.fromEntries(
            Object.entries(views.mindMap[key]).filter(([id]) => ids.has(id)),
          );
      }
    }
    extensions[VIEWS] = views;
  }
  if (Object.keys(extensions).length) output.extensions = extensions;

  const text = serialize(output, viewport || output.canvas, viewports || null);
  const result = stage(text);
  if (result.errors.length) {
    const error = new Error('selectionInvalid');
    error.issues = result.errors;
    throw error;
  }
  return {
    text,
    excludedNamespaces,
    partialGroups,
    excludedRelations: project.relations.length - relations.length,
  };
}
