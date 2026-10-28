export const EDGE = 'card-atlas:edge';
export const routeTypes = ['curved', 'straight', 'orthogonal', 'zigzag'];
export const edgeRoute = (relation) => relation.extensions?.[EDGE]?.route || 'curved';
export function routingIssues(project) {
  const issues = [];
  project.relations.forEach((r, i) => {
    const value = r.extensions?.[EDGE];
    if (
      value !== undefined &&
      (!value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value).some((k) => k !== 'route') ||
        !routeTypes.includes(value.route))
    )
      issues.push({ path: `relations[${i}].extensions.${EDGE}`, code: 'edgeRouting' });
  });
  return issues;
}
