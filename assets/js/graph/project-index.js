/**
 * @typedef {import('./types.js').Project} Project
 * @typedef {import('./types.js').Card} Card
 * @typedef {import('./types.js').Relation} Relation
 * @typedef {object} ProjectIndex
 * @property {ReadonlyMap<string, Card>} cards
 * @property {ReadonlyMap<string, Relation>} relations
 * @property {ReadonlyMap<string, number>} degrees
 * @property {ReadonlyMap<string, readonly Relation[]>} incoming
 * @property {ReadonlyMap<string, readonly Relation[]>} outgoing
 */
// Read-only derived queries. Only use with committed project snapshots, never inside mutators.
/** @type {WeakMap<Project, ProjectIndex>} */
const cache = new WeakMap();
/** @param {Project} project @returns {ProjectIndex} */
export function projectIndex(project) {
  let index = cache.get(project);
  if (index) return index;
  const cards = new Map(project.cards.map((card) => [card.id, card]));
  const relations = new Map(project.relations.map((relation) => [relation.id, relation]));
  /** @type {Map<string, number>} */
  const degrees = new Map();
  /** @type {Map<string, Relation[]>} */
  const incoming = new Map(),
    outgoing = new Map();
  for (const relation of project.relations) {
    for (const id of [relation.source, relation.target])
      degrees.set(id, (degrees.get(id) || 0) + 1);
    if (!incoming.has(relation.target)) incoming.set(relation.target, []);
    if (!outgoing.has(relation.source)) outgoing.set(relation.source, []);
    incoming.get(relation.target)?.push(relation);
    outgoing.get(relation.source)?.push(relation);
  }
  index = { cards, relations, degrees, incoming, outgoing };
  cache.set(project, index);
  return index;
}
