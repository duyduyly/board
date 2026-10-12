import { VIEWS, MIND } from '../graph/mind-map.js';
import { blank, validate } from '../json/validator.js';
const clone = (x) => structuredClone(x);
const content = (p) => {
  const ext = clone(p.extensions);
  if (ext?.[VIEWS]?.mindMap) delete ext[VIEWS].mindMap.viewport;
  return JSON.stringify({
    version: p.version,
    metadata: p.metadata,
    cards: p.cards,
    relations: p.relations,
    ...(ext ? { extensions: ext } : {}),
  });
};
const diff = (a, b) => {
  const changes = [];
  for (const key of ['metadata', 'extensions'])
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key]))
      changes.push({ kind: key, before: a[key], after: b[key] });
  for (const kind of ['cards', 'relations']) {
    const x = new Map(a[kind].map((v) => [v.id, v])),
      y = new Map(b[kind].map((v) => [v.id, v]));
    for (const id of new Set([...x.keys(), ...y.keys()]))
      if (JSON.stringify(x.get(id)) !== JSON.stringify(y.get(id)))
        changes.push({
          kind,
          id,
          before: x.get(id),
          after: y.get(id),
          beforeIndex: a[kind].findIndex((v) => v.id === id),
          afterIndex: b[kind].findIndex((v) => v.id === id),
        });
  }
  return clone(changes);
};
export class ProjectStore {
  constructor({ maxHistory = 100, maxBytes = 20 * 1024 * 1024 } = {}) {
    this.maxHistory = maxHistory;
    this.maxBytes = maxBytes;
    this.project = blank();
    this.activeView = 'card';
    this.collapsed = new Set();
    this.viewports = { card: clone(this.project.canvas) };
    this.undoStack = [];
    this.redoStack = [];
    this.baseline = content(this.project);
    this.viewBaseline = JSON.stringify(this.viewports);
    this.adjusted = false;
    this.notice = false;
    this.listeners = new Set();
  }
  get viewport() {
    return this.viewports[this.activeView];
  }
  switchView(view) {
    if (!['card', 'mind'].includes(view)) return;
    this.activeView = view;
    this.viewports[view] ||= clone(
      this.project.extensions?.[VIEWS]?.mindMap?.viewport || { zoom: 1, position: { x: 0, y: 0 } },
    );
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit() {
    for (const fn of this.listeners) fn();
  }
  get dirty() {
    return this.adjusted || content(this.project) !== this.baseline;
  }
  get viewChanged() {
    return JSON.stringify(this.viewports) !== this.viewBaseline;
  }
  replace(p, adjusted = false) {
    this.project = clone(p);
    this.collapsed = new Set();
    this.activeView = 'card';
    this.viewports = { card: clone(p.canvas) };
    if (p.extensions?.[VIEWS]?.mindMap?.viewport)
      this.viewports.mind = clone(p.extensions[VIEWS].mindMap.viewport);
    this.undoStack = [];
    this.redoStack = [];
    this.baseline = content(p);
    this.viewBaseline = JSON.stringify(this.viewports);
    this.adjusted = adjusted;
    this.emit();
  }
  exported() {
    this.baseline = content(this.project);
    this.viewBaseline = JSON.stringify(this.viewports);
    this.adjusted = false;
    this.emit();
  }
  commit(mutator) {
    const next = clone(this.project);
    mutator(next);
    const result = validate(next);
    if (result.errors.length) {
      const e = new Error('invalidProject');
      e.issues = result.errors;
      throw e;
    }
    const changes = diff(this.project, next);
    if (!changes.length) return false;
    const entry = { changes, bytes: new TextEncoder().encode(JSON.stringify(changes)).length };
    this.project = next;
    this.redoStack = [];
    this.notice = false;
    if (entry.bytes > this.maxBytes) {
      this.undoStack = [];
      this.notice = true;
    } else {
      this.undoStack.push(entry);
      while (
        this.undoStack.length > this.maxHistory ||
        this.undoStack.reduce((n, x) => n + x.bytes, 0) > this.maxBytes
      )
        this.undoStack.shift();
    }
    this.emit();
    return true;
  }
  replay(entry, direction) {
    const p = clone(this.project);
    for (const c of entry.changes.filter((c) => c.kind === 'metadata' || c.kind === 'extensions')) {
      const value = clone(c[direction]);
      if (value === undefined) delete p[c.kind];
      else p[c.kind] = value;
    }
    for (const kind of ['cards', 'relations']) {
      const list = entry.changes.filter((c) => c.kind === kind);
      const ids = new Set(list.map((c) => c.id));
      p[kind] = p[kind].filter((e) => !ids.has(e.id));
      for (const c of list
        .filter((c) => c[direction] !== undefined)
        .sort((a, b) => a[direction + 'Index'] - b[direction + 'Index']))
        p[kind].splice(c[direction + 'Index'], 0, clone(c[direction]));
    }
    this.project = p;
    this.emit();
  }
  undo() {
    const e = this.undoStack.pop();
    if (e) {
      this.redoStack.push(e);
      this.replay(e, 'before');
    }
  }
  redo() {
    const e = this.redoStack.pop();
    if (e) {
      this.undoStack.push(e);
      this.replay(e, 'after');
    }
  }
  setView(zoom, position) {
    this.viewports[this.activeView] = { zoom, position: clone(position) };
  }
}
export const newId = (kind) => kind + '-' + crypto.randomUUID();
export function newCard(position, title = 'New Card') {
  return {
    id: newId('card'),
    title,
    summary: '',
    type: 'default',
    tags: [],
    content: '',
    position,
    size: { width: 260, height: 190 },
    style: { backgroundColor: '#FFFFFF', textColor: '#0F172A', borderColor: '#CBD5E1' },
  };
}
export function newRelation(source, target) {
  return {
    id: newId('relation'),
    source,
    target,
    label: '',
    description: '',
    type: 'default',
    style: { color: '#64748b', line: 'solid', arrow: 'end' },
  };
}
export function remove(p, selection) {
  if (selection.kind === 'card') {
    p.cards = p.cards.filter((c) => c.id !== selection.id);
    const m = p.extensions?.[VIEWS]?.mindMap;
    if (m) {
      delete m.positions?.[selection.id];
      delete m.sizes?.[selection.id];
    }
    if (p.extensions?.[MIND]?.rootId === selection.id) delete p.extensions[MIND].rootId;
    p.relations = p.relations.filter((r) => r.source !== selection.id && r.target !== selection.id);
  } else p.relations = p.relations.filter((r) => r.id !== selection.id);
}
export function search(cards, query) {
  const q = query.toLocaleLowerCase().trim();
  return cards.filter((c) =>
    [c.title, c.summary, c.type, ...c.tags, c.content].some((s) =>
      s.toLocaleLowerCase().includes(q),
    ),
  );
}

export function searchExcerpt(card, query) {
  const text = (card.content || '').replace(/\s+/g, ' ');
  const q = query.toLocaleLowerCase().trim();
  const index = text.toLocaleLowerCase().indexOf(q);
  if (!q || index < 0) return '';
  const start = Math.max(0, index - 35);
  return (
    (start ? '…' : '') +
    text.slice(start, index + q.length + 65) +
    (index + q.length + 65 < text.length ? '…' : '')
  );
}
