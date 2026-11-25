import { IMAGE_NAMESPACE } from '../detail/attachments.js';
export const NODE = 'card-atlas:node',
  VIEWS = 'card-atlas:views',
  MIND = 'card-atlas:mind-map';
export const nodeStyle = (c) => ({ kind: 'card', imageFit: 'contain', ...c.extensions?.[NODE] });
export const relationKind = (r) => r.extensions?.[MIND]?.kind || 'reference';
export function geometry(p, c, view = 'card') {
  if (view === 'card') return { position: c.position, size: c.size };
  const m = p.extensions?.[VIEWS]?.mindMap;
  return {
    position: m?.positions?.[c.id] || c.position,
    size: m?.sizes?.[c.id] || {
      width: 260,
      height: ['image', 'image-text'].includes(nodeStyle(c).kind) ? 190 : 80,
    },
  };
}
export function setGeometry(p, id, view, field, value) {
  if (view === 'card') p.cards.find((c) => c.id === id)[field] = structuredClone(value);
  else {
    p.extensions ||= {};
    p.extensions[VIEWS] ||= {};
    p.extensions[VIEWS].mindMap ||= {};
    const m = p.extensions[VIEWS].mindMap;
    const key = field === 'position' ? 'positions' : 'sizes';
    m[key] ||= {};
    Object.defineProperty(m[key], id, {
      value: structuredClone(value),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
}
const boardRootsOf = (p) => p.extensions?.[MIND]?.boardRoots;
/** Mind root of the project board (board null) or of the board owned by node `board`. */
export function mindRootOf(p, board = null) {
  const mind = p.extensions?.[MIND];
  if (board === null) return mind?.rootId;
  const roots = boardRootsOf(p);
  return roots && Object.hasOwn(roots, board) ? roots[board] : undefined;
}
/** Every root of the project: the project board root and each node board root. */
export function mindRoots(p) {
  const roots = new Set(),
    rootId = p.extensions?.[MIND]?.rootId,
    byBoard = boardRootsOf(p);
  if (rootId !== undefined) roots.add(rootId);
  if (byBoard && typeof byBoard === 'object')
    for (const id of Object.values(byBoard)) roots.add(id);
  return roots;
}
export function setRoot(p, id, detach = false, board = null) {
  const parents = p.relations.filter((r) => relationKind(r) === 'branch' && r.target === id);
  if (parents.length && !detach) throw Error('rootParent');
  for (const r of parents) r.extensions[MIND] = { ...r.extensions[MIND], kind: 'reference' };
  p.extensions ||= {};
  p.extensions[MIND] = { ...p.extensions[MIND] };
  const mind = p.extensions[MIND];
  if (board === null) {
    if (id) mind.rootId = id;
    else delete mind.rootId;
    return;
  }
  const roots = { ...mind.boardRoots };
  if (id)
    Object.defineProperty(roots, board, {
      value: id,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  else delete roots[board];
  if (Object.keys(roots).length) mind.boardRoots = roots;
  else delete mind.boardRoots;
}
/**
 * Kind for a link drawn by hand in the Mind Map: it extends the tree as a branch when the target
 * has no parent yet and is not the root or an ancestor of the source; otherwise it is a reference.
 */
export function newLinkKind(p, source, target) {
  if (mindRoots(p).has(target)) return 'reference';
  const parents = new Map();
  for (const r of p.relations) if (relationKind(r) === 'branch') parents.set(r.target, r.source);
  if (parents.has(target)) return 'reference';
  const seen = new Set();
  for (let id = source; id !== undefined && !seen.has(id); id = parents.get(id)) {
    if (id === target) return 'reference';
    seen.add(id);
  }
  return 'branch';
}
export function branchInfo(p) {
  const root = p.extensions?.[MIND]?.rootId,
    parents = new Map();
  for (const r of p.relations) if (relationKind(r) === 'branch') parents.set(r.target, r.source);
  const colors = ['#347d68', '#b86b38', '#6678ba', '#ad5c8b', '#648740', '#258e9b'],
    result = new Map();
  for (const c of p.cards) {
    let id = c.id,
      first = id;
    const seen = new Set();
    while (parents.has(id) && !seen.has(id)) {
      seen.add(id);
      first = id;
      id = parents.get(id);
    }
    let hash = 0;
    for (const ch of first) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    result.set(c.id, { connected: id === root, color: colors[hash % colors.length] });
  }
  return result;
}
export function mindIssues(p) {
  const errors = [],
    ids = new Set(p.cards.map((c) => c.id)),
    obj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const bad = (path) => errors.push({ path, code: 'mindMap' });
  const keys = (v, allowed, path) => {
    if (!obj(v)) {
      bad(path);
      return false;
    }
    for (const k of Object.keys(v)) if (!allowed.includes(k)) bad(path + '.' + k);
    return true;
  };
  const point = (v, path, size = false) => {
    const ks = size ? ['width', 'height'] : ['x', 'y'];
    if (keys(v, ks, path))
      for (const k of ks) if (!Number.isFinite(v[k]) || (size && v[k] <= 0)) bad(path + '.' + k);
  };
  p.cards.forEach((c, i) => {
    const n = c.extensions?.[NODE],
      path = 'cards[' + i + '].extensions.' + NODE;
    if (n !== undefined && keys(n, ['kind', 'coverImageId', 'imageFit', 'imageAlt'], path)) {
      if (!['card', 'text', 'image', 'image-text'].includes(n.kind)) bad(path + '.kind');
      if (n.imageFit !== undefined && !['contain', 'cover'].includes(n.imageFit))
        bad(path + '.imageFit');
      if (n.imageAlt !== undefined && typeof n.imageAlt !== 'string') bad(path + '.imageAlt');
      if (
        n.coverImageId !== undefined &&
        (typeof n.coverImageId !== 'string' ||
          !Object.hasOwn(c.extensions?.[IMAGE_NAMESPACE] || {}, n.coverImageId))
      )
        bad(path + '.coverImageId');
      if (['image', 'image-text'].includes(n.kind) && !n.coverImageId) bad(path + '.coverImageId');
    }
  });
  const views = p.extensions?.[VIEWS];
  if (
    views !== undefined &&
    keys(views, ['mindMap'], 'extensions.' + VIEWS) &&
    views.mindMap !== undefined
  ) {
    const m = views.mindMap,
      path = 'extensions.' + VIEWS + '.mindMap';
    if (keys(m, ['positions', 'sizes', 'viewport'], path)) {
      for (const field of ['positions', 'sizes']) {
        if (m[field] === undefined) continue;
        if (!obj(m[field])) {
          bad(path + '.' + field);
          continue;
        }
        for (const [id, v] of Object.entries(m[field])) {
          if (!ids.has(id)) bad(path + '.' + field + '.' + id);
          point(v, path + '.' + field + '.' + id, field === 'sizes');
        }
      }
      if (m.viewport !== undefined && keys(m.viewport, ['zoom', 'position'], path + '.viewport')) {
        if (!Number.isFinite(m.viewport.zoom) || m.viewport.zoom < 0.1 || m.viewport.zoom > 4)
          bad(path + '.viewport.zoom');
        point(m.viewport.position, path + '.viewport.position');
      }
    }
  }
  const config = p.extensions?.[MIND];
  const roots = new Set();
  if (config !== undefined && keys(config, ['rootId', 'boardRoots'], 'extensions.' + MIND)) {
    const root = config.rootId;
    if (root !== undefined) {
      if (typeof root === 'string' && ids.has(root)) roots.add(root);
      else bad('extensions.' + MIND + '.rootId');
    }
    const byBoard = config.boardRoots;
    if (
      byBoard !== undefined &&
      keys(byBoard, Object.keys(byBoard), 'extensions.' + MIND + '.boardRoots')
    )
      for (const [node, id] of Object.entries(byBoard)) {
        if (ids.has(node) && typeof id === 'string' && ids.has(id)) roots.add(id);
        else bad('extensions.' + MIND + '.boardRoots.' + node);
      }
  }
  const parents = new Map();
  p.relations.forEach((r, i) => {
    const m = r.extensions?.[MIND],
      path = 'relations[' + i + '].extensions.' + MIND;
    if (m !== undefined && keys(m, ['kind', 'color'], path)) {
      if (!['branch', 'reference'].includes(m.kind)) bad(path + '.kind');
      if (
        m.color !== undefined &&
        (typeof m.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(m.color))
      )
        bad(path + '.color');
      if (m.kind === 'branch') {
        if (parents.has(r.target) || roots.has(r.target)) bad(path + '.kind');
        parents.set(r.target, r.source);
      }
    }
  });
  for (const id of parents.keys()) {
    let n = id;
    const seen = new Set();
    while (parents.has(n)) {
      if (seen.has(n)) {
        bad('relations.branchCycle');
        break;
      }
      seen.add(n);
      n = parents.get(n);
    }
  }
  return errors;
}
