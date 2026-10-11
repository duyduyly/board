import { applyAppearance } from '../detail/appearance.js';
import cytoscape from '../../vendor/cytoscape-entry.js';
import { t } from '../i18n/index.js';
const cid = (id) => 'c:' + id,
  rid = (id) => 'r:' + id;
export class GraphAdapter {
  constructor(region, layer, callbacks) {
    this.region = region;
    this.layer = layer;
    this.callbacks = callbacks;
    this.cards = new Map();
    this.space = false;
    this.moving = false;
    this.cy = cytoscape({
      container: document.querySelector('#graph'),
      elements: [],
      layout: { name: 'preset' },
      minZoom: 0.1,
      maxZoom: 4,
      selectionType: 'single',
      boxSelectionEnabled: false,
      autounselectify: true,
      style: [
        {
          selector: 'node',
          style: {
            shape: 'round-rectangle',
            width: 'data(width)',
            height: 'data(height)',
            'background-opacity': 0,
            'border-width': 0,
            label: '',
          },
        },
        {
          selector: 'edge',
          style: {
            'curve-style': 'bezier',
            'line-color': 'data(color)',
            width: 1.6,
            'target-arrow-color': 'data(color)',
            'source-arrow-color': 'data(color)',
            'target-arrow-shape': 'data(endArrow)',
            'source-arrow-shape': 'data(startArrow)',
            'line-style': 'data(line)',
            label: 'data(label)',
            'font-family': 'Segoe UI, sans-serif',
            'font-size': 11,
            color: '#52645b',
            'text-background-color': '#f5f7f5',
            'text-background-opacity': 1,
            'text-background-padding': 4,
            'text-rotation': 'autorotate',
            'arrow-scale': 0.8,
          },
        },
        { selector: 'edge.selected', style: { width: 3, 'line-color': '#28594b' } },
      ],
    });
    this.cy.on('pan zoom', () => {
      this.view();
      callbacks.viewport(this.cy.zoom(), this.cy.pan());
    });
    this.cy.on('tap', 'edge', (e) =>
      callbacks.select({ kind: 'relation', id: e.target.data('appId') }),
    );
    this.cy.on('tap', (e) => {
      if (e.target === this.cy) callbacks.select(null);
    });
    region.addEventListener('pointerdown', (e) => {
      if (this.space || e.button === 1) this.panStart(e);
    });
    this.observer = new ResizeObserver(() => {
      this.cy.resize();
      this.view();
    });
    this.observer.observe(region);
  }
  sync(project, selection) {
    if (this.lastProject === project) {
      if (this.lastSelection?.kind === 'card') {
        const el = this.cards.get(this.lastSelection.id);
        el?.classList.remove('selected');
        el?.setAttribute('aria-pressed', 'false');
      }
      if (selection?.kind === 'card') {
        const el = this.cards.get(selection.id);
        el?.classList.add('selected');
        el?.setAttribute('aria-pressed', 'true');
      }
      if (this.lastSelection?.kind === 'relation')
        this.cy.getElementById(rid(this.lastSelection.id)).removeClass('selected');
      if (selection?.kind === 'relation')
        this.cy.getElementById(rid(selection.id)).addClass('selected');
      for (const el of this.cards.values()) {
        const b = el.querySelector('.connector');
        if (b.title !== t('dragConnector')) {
          b.title = t('dragConnector');
          b.setAttribute('aria-label', t('dragConnector'));
        }
      }
      for (const el of this.cards.values()) {
        const count = el.querySelector('.card-open');
        if (count) {
          count.title =
            t('openDetail') + ' · ' + t('connectionCount', { count: count.dataset.count });
          count.setAttribute(
            'aria-label',
            t('openDetail') + ': ' + el.querySelector('h3').textContent,
          );
        }
        const more = el.querySelector('.more-tags');
        if (more) more.title = t('moreTags', { tags: more.dataset.tags });
      }
      this.lastSelection = selection;
      this.view();
      return;
    }
    this.lastSelection = selection;
    this.lastProject = project;
    const degrees = new Map();
    for (const relation of project.relations) {
      degrees.set(relation.source, (degrees.get(relation.source) || 0) + 1);
      degrees.set(relation.target, (degrees.get(relation.target) || 0) + 1);
    }
    this.cy.batch(() => {
      const desired = new Set([
        ...project.cards.map((c) => cid(c.id)),
        ...project.relations.map((r) => rid(r.id)),
      ]);
      this.cy.elements().forEach((e) => {
        if (!desired.has(e.id())) e.remove();
      });
      for (const c of project.cards) {
        let node = this.cy.getElementById(cid(c.id));
        const data = { id: cid(c.id), appId: c.id, width: c.size.width, height: c.size.height };
        const pos = { x: c.position.x + c.size.width / 2, y: c.position.y + c.size.height / 2 };
        if (node.empty()) node = this.cy.add({ group: 'nodes', data, position: pos });
        else {
          node.data(data);
          node.position(pos);
        }
        let el = this.cards.get(c.id);
        if (!el) {
          el = document.createElement('article');
          el.className = 'graph-card';
          el.dataset.id = c.id;
          el.tabIndex = 0;
          el.setAttribute('role', 'button');
          this.layer.append(el);
          this.cards.set(c.id, el);
          el.addEventListener('pointerdown', (e) => this.cardStart(e, c.id));
          el.addEventListener('dblclick', () => this.callbacks.open({ kind: 'card', id: c.id }));
          el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              this.callbacks.select({ kind: 'card', id: c.id });
            }
          });
        }
        el.replaceChildren();
        const title = document.createElement('h3');
        title.textContent = c.title;
        title.title = c.title;
        const summary = document.createElement('p');
        summary.className = 'card-summary';
        summary.textContent = c.summary;
        const meta = document.createElement('div');
        meta.className = 'card-meta';
        const kicker = document.createElement('div');
        kicker.className = 'card-kicker';
        if (c.type) {
          const badge = document.createElement('span');
          badge.className = 'card-badge type-badge';
          badge.textContent = c.type;
          badge.title = c.type;
          kicker.append(badge);
        }
        const open = document.createElement('button');
        open.className = 'card-open';
        open.type = 'button';
        open.textContent = '↗';
        open.dataset.count = degrees.get(c.id) || 0;
        open.title = t('openDetail') + ' · ' + t('connectionCount', { count: open.dataset.count });
        open.setAttribute('aria-label', t('openDetail') + ': ' + c.title);
        open.addEventListener('pointerdown', (event) => event.stopPropagation());
        open.addEventListener('dblclick', (event) => event.stopPropagation());
        open.addEventListener('keydown', (event) => event.stopPropagation());
        open.addEventListener('click', (event) => {
          event.stopPropagation();
          this.callbacks.open({ kind: 'card', id: c.id });
        });
        kicker.append(open);
        const tags = [...new Set(c.tags)].filter((tag) => tag !== c.type);
        for (const tag of tags.slice(0, 2)) {
          const badge = document.createElement('span');
          badge.className = 'card-badge tag-badge';
          badge.textContent = tag;
          badge.title = tag;
          meta.append(badge);
        }
        if (tags.length > 2) {
          const more = document.createElement('span');
          more.className = 'card-badge more-tags';
          more.dataset.tags = tags.slice(2).join(', ');
          more.textContent = '+' + (tags.length - 2);
          more.title = t('moreTags', { tags: more.dataset.tags });
          meta.append(more);
        }
        const connector = document.createElement('button');
        connector.className = 'connector';
        connector.title = t('dragConnector');
        connector.setAttribute('aria-label', t('dragConnector'));
        connector.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          this.connectorStart(e, c.id);
        });
        el.append(kicker, title, summary, meta, connector);
        applyAppearance(el, c);
        el.style.width = c.size.width + 'px';
        el.style.height = c.size.height + 'px';
        el.style.left = c.position.x + 'px';
        el.style.top = c.position.y + 'px';
        el.style.setProperty('--card-background', c.style.backgroundColor);
        el.style.setProperty('--card-ink', c.style.textColor);
        el.style.setProperty('--card-border', c.style.borderColor);
        el.classList.toggle('selected', selection?.kind === 'card' && selection.id === c.id);
        el.setAttribute('aria-label', c.title);
        el.setAttribute(
          'aria-pressed',
          String(selection?.kind === 'card' && selection.id === c.id),
        );
      }
      for (const [id, el] of this.cards)
        if (!project.cards.some((c) => c.id === id)) {
          el.remove();
          this.cards.delete(id);
        }
      for (const r of project.relations) {
        let edge = this.cy.getElementById(rid(r.id));
        const data = {
          id: rid(r.id),
          appId: r.id,
          source: cid(r.source),
          target: cid(r.target),
          label: r.label,
          color: r.style.color,
          line:
            r.style.line === 'solid' ? 'solid' : r.style.line === 'dashed' ? 'dashed' : 'dotted',
          startArrow: ['start', 'both'].includes(r.style.arrow) ? 'triangle' : 'none',
          endArrow: ['end', 'both'].includes(r.style.arrow) ? 'triangle' : 'none',
        };
        if (edge.empty()) edge = this.cy.add({ group: 'edges', data });
        else {
          if (edge.data('source') !== data.source || edge.data('target') !== data.target)
            edge.move({ source: data.source, target: data.target });
          edge.data(data);
        }
        edge.toggleClass('selected', selection?.kind === 'relation' && selection.id === r.id);
      }
    });
    this.view();
  }
  view() {
    const p = this.cy.pan(),
      z = this.cy.zoom();
    this.layer.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px) scale(' + z + ')';
    const button = document.querySelector('#zoom-value');
    button.textContent = Math.round(z * 100) + '%';
  }
  graphPoint(clientX, clientY) {
    const rect = this.region.getBoundingClientRect(),
      p = this.cy.pan(),
      z = this.cy.zoom();
    return { x: (clientX - rect.left - p.x) / z, y: (clientY - rect.top - p.y) / z };
  }
  center() {
    const r = this.region.getBoundingClientRect();
    return this.graphPoint(r.left + r.width / 2, r.top + r.height / 2);
  }
  setViewport(v) {
    this.cy.viewport({ zoom: v.zoom, pan: v.position });
    this.view();
  }
  fit() {
    if (this.cy.nodes().length) this.cy.fit(this.cy.elements(), 65);
    else this.cy.viewport({ zoom: 1, pan: { x: 0, y: 0 } });
    this.view();
  }
  focus(id) {
    const n = this.cy.getElementById(cid(id));
    if (!n.empty()) {
      this.cy.zoom(
        Math.min(
          1.1,
          Math.max(
            0.3,
            Math.min(
              (this.region.clientWidth - 100) / n.data('width'),
              (this.region.clientHeight - 140) / n.data('height'),
            ),
          ),
        ),
      );
      this.cy.center(n);
      this.view();
    }
  }
  focusRelation(id) {
    const edge = this.cy.getElementById(rid(id));
    if (edge.empty()) return;
    const group = edge.union(edge.connectedNodes());
    this.cy.fit(group, 80);
    if (this.cy.zoom() > 1.1) {
      this.cy.zoom(1.1);
      this.cy.center(group);
    }
    this.view();
  }
  setTheme(theme) {
    const dark = theme === 'dark';
    this.cy
      .style()
      .selector('edge')
      .style({
        color: dark ? '#b7c8c0' : '#52645b',
        'text-background-color': dark ? '#2a342e' : '#f5f7f5',
      })
      .selector('edge.selected')
      .style({
        'line-color': dark ? '#9bd9bc' : '#28594b',
        'target-arrow-color': dark ? '#9bd9bc' : '#28594b',
        'source-arrow-color': dark ? '#9bd9bc' : '#28594b',
      })
      .update();
  }
  zoom(factor) {
    this.cy.zoom({
      level: Math.min(4, Math.max(0.1, this.cy.zoom() * factor)),
      renderedPosition: { x: this.region.clientWidth / 2, y: this.region.clientHeight / 2 },
    });
  }
  resetZoom() {
    this.cy.zoom({
      level: 1,
      renderedPosition: { x: this.region.clientWidth / 2, y: this.region.clientHeight / 2 },
    });
  }
  cardStart(e, id) {
    if (e.target.closest('.connector, .card-open') || this.space || e.button !== 0) return;
    if (this.callbacks.locked()) {
      this.callbacks.select({ kind: 'card', id });
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const el = this.cards.get(id),
      n = this.cy.getElementById(cid(id)),
      start = this.graphPoint(e.clientX, e.clientY),
      original = { ...n.position() },
      width = n.data('width'),
      height = n.data('height');
    let moved = false;
    el.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const p = this.graphPoint(ev.clientX, ev.clientY),
        dx = p.x - start.x,
        dy = p.y - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      if (moved) {
        n.position({ x: original.x + dx, y: original.y + dy });
        el.style.left = original.x + dx - width / 2 + 'px';
        el.style.top = original.y + dy - height / 2 + 'px';
      }
    };
    const end = (ev) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', cancel);
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (moved)
        this.callbacks.move(id, {
          x: n.position('x') - width / 2,
          y: n.position('y') - height / 2,
        });
      else this.callbacks.select({ kind: 'card', id });
    };
    const cancel = () => {
      n.position(original);
      el.style.left = original.x - width / 2 + 'px';
      el.style.top = original.y - height / 2 + 'px';
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', cancel);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', cancel);
  }
  panStart(e) {
    if (!this.space && e.button !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    const p = { ...this.cy.pan() },
      start = { x: e.clientX, y: e.clientY };
    this.cy.userPanningEnabled(false);
    const move = (ev) =>
      this.cy.pan({ x: p.x + ev.clientX - start.x, y: p.y + ev.clientY - start.y });
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      this.cy.userPanningEnabled(true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
  }
  connectorStart(e, id) {
    if (this.callbacks.locked()) {
      this.callbacks.select({ kind: 'card', id });
      return;
    }
    e.preventDefault();
    const preview = document.querySelector('#connection-preview'),
      path = preview.querySelector('path'),
      rect = this.region.getBoundingClientRect();
    preview.style.display = 'block';
    const start = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    let active = true;
    const move = (ev) =>
      path.setAttribute(
        'd',
        'M ' +
          start.x +
          ' ' +
          start.y +
          ' L ' +
          (ev.clientX - rect.left) +
          ' ' +
          (ev.clientY - rect.top),
      );
    const cleanup = () => {
      active = false;
      preview.style.display = 'none';
      path.removeAttribute('d');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('keydown', key);
      window.removeEventListener('pointercancel', cleanup);
    };
    const end = (ev) => {
      if (!active) return;
      const inside =
        ev.clientX >= rect.left &&
        ev.clientX <= rect.right &&
        ev.clientY >= rect.top &&
        ev.clientY <= rect.bottom;
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.graph-card')
        ?.dataset.id;
      cleanup();
      if (inside)
        this.callbacks.connection(id, target || null, this.graphPoint(ev.clientX, ev.clientY));
    };
    const key = (ev) => {
      if (ev.key === 'Escape') cleanup();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
    window.addEventListener('keydown', key);
    window.addEventListener('pointercancel', cleanup, { once: true });
  }
}
