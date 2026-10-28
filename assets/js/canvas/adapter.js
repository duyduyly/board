import { overviewElement, updateCardMetadata } from './overview.js';
import { isPinned } from '../graph/card-metadata.js';
import { edgeRoute } from '../graph/edge-routing.js';
import { installResize } from './resize-node.js';
import { installMultiSelection, startGroupDrag } from './multi-selection.js';
import { createGroupFrames } from './group-frames.js';
import { applyShape } from './shape-view.js';
import { appearance } from '../detail/appearance.js';
import { projectIndex } from '../graph/project-index.js';
import { visibility } from '../graph/radial-layout.js';
import { geometry, nodeStyle, MIND, relationKind, branchInfo } from '../graph/mind-map.js';
import { applyAppearance } from '../detail/appearance.js';
import cytoscape from '../../vendor/cytoscape-entry.js';
import { t, getLocale } from '../i18n/index.js';
const cid = (id) => 'c:' + id,
  rid = (id) => 'r:' + id;
export class GraphAdapter {
  constructor(region, layer, callbacks) {
    this.region = region;
    this.layer = layer;
    this.callbacks = callbacks;
    this.cards = new Map();
    this.selectedCards = new Set();
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
            shape: 'data(nodeShape)',
            'shape-polygon-points': 'data(polygon)',
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
            'min-zoomed-font-size': 8,
            color: '#52645b',
            'text-background-color': '#f5f7f5',
            'text-background-opacity': 1,
            'text-background-padding': 4,
            'text-rotation': 'autorotate',
            'arrow-scale': 0.8,
          },
        },
        {
          selector: 'edge.mind-edge',
          style: {
            'curve-style': 'unbundled-bezier',
            'control-point-distances': 55,
            'control-point-weights': 0.5,
            width: 2.5,
          },
        },
        {
          selector: 'edge.reference-edge',
          style: { 'line-style': 'dashed', opacity: 0.55, width: 1.3 },
        },
        { selector: 'edge.viewport-moving, edge.group-preview', style: { visibility: 'hidden' } },
        { selector: 'edge.selected', style: { width: 3, 'line-color': '#28594b' } },
        { selector: 'edge.route-straight', style: { 'curve-style': 'straight' } },
        {
          selector: 'edge.route-orthogonal',
          style: { 'curve-style': 'taxi', 'taxi-direction': 'auto', 'taxi-turn': '50%' },
        },
        {
          selector: 'edge.route-zigzag',
          style: {
            'curve-style': 'segments',
            'segment-distances': '28 -28 28',
            'segment-weights': '0.25 0.5 0.75',
          },
        },
      ],
    });
    this.cy.on('viewport', () => {
      this.cancelGesture?.();
      this.deferEdges();
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
    installMultiSelection(this);
    this.groupFrames = createGroupFrames(this);
    this.observer = new ResizeObserver(() => {
      this.cy.resize();
      this.view();
    });
    this.observer.observe(region);
  }
  sync(project, selection, view = 'card', options = {}) {
    this.cancelGesture?.();
    this.cancelResize?.();
    this.selectedCards = new Set(
      options.selectedCards || (selection?.kind === 'card' ? [selection.id] : []),
    );
    if (
      this.activeView !== view ||
      this.lastPreview !== options.positions ||
      this.lastCollapsed !== options.collapsed
    ) {
      this.lastPreview = options.positions;
      this.lastCollapsed = options.collapsed;
      this.lastProject = null;
      this.activeView = view;
    }
    if (this.lastProject === project) {
      this.paintSelection(this.selectedCards);
      if (this.lastSelection?.kind === 'relation')
        this.cy.getElementById(rid(this.lastSelection.id)).removeClass('selected');
      if (selection?.kind === 'relation')
        this.cy.getElementById(rid(selection.id)).addClass('selected');
      if (this.lastLocale !== getLocale()) {
        for (const el of this.cards.values()) {
          for (const text of el.querySelectorAll('[data-overview-field]'))
            text.setAttribute(
              'aria-label',
              el.classList.contains('pinned-card')
                ? t('pinnedReadOnly')
                : t('editOverviewField', {
                    field: t(text.dataset.overviewField),
                    value: text.textContent,
                  }),
            );
          const b = el.querySelector('.connector');
          if (b.title !== t('dragConnector')) {
            b.title = t('dragConnector');
            b.setAttribute('aria-label', t('dragConnector'));
          }
        }
        for (const el of this.cards.values()) {
          const resize = el.querySelector('.resize-handle');
          if (resize) {
            resize.title = t('resizeNode');
            resize.setAttribute('aria-label', t('resizeNode'));
          }
          const toggle = el.querySelector('.branch-toggle');
          if (toggle) {
            toggle.setAttribute(
              'aria-label',
              t(toggle.dataset.expanded === 'true' ? 'collapseBranch' : 'expandBranchCount', {
                count: toggle.dataset.count,
                title: el.getAttribute('aria-label'),
              }),
            );
            toggle.title = toggle.getAttribute('aria-label');
          }
          const count = el.querySelector('.card-open');
          if (count) {
            count.title =
              t('openDetail') + ' · ' + t('connectionCount', { count: count.dataset.count });
            count.setAttribute(
              'aria-label',
              t('openDetail') + ': ' + el.getAttribute('aria-label'),
            );
          }
          const more = el.querySelector('.more-tags');
          if (more) more.title = t('moreTags', { tags: more.dataset.tags });
        }
        for (const [id, el] of this.cards)
          updateCardMetadata(el, projectIndex(project).cards.get(id));
        this.lastLocale = getLocale();
      }
      this.lastSelection = selection;
      this.groupFrames.sync(project, this.hiddenNodes || new Set());
      this.view();
      return;
    }
    this.lastSelection = selection;
    this.lastProject = project;
    const info = branchInfo(project);
    const index = projectIndex(project);
    const visible = visibility(project, view === 'mind' ? options.collapsed : undefined);
    this.hiddenNodes = view === 'mind' ? visible.hidden : new Set();
    const { degrees } = index;
    this.cy.batch(() => {
      const desired = new Set([
        ...project.cards.map((c) => cid(c.id)),
        ...project.relations.map((r) => rid(r.id)),
      ]);
      this.cy.elements().forEach((e) => {
        if (!desired.has(e.id())) e.remove();
      });
      for (const originalCard of project.cards) {
        const g = geometry(project, originalCard, view);
        const c = {
          ...originalCard,
          ...g,
          position: options.positions?.[originalCard.id] || g.position,
        };
        let node = this.cy.getElementById(cid(c.id));
        const data = {
          id: cid(c.id),
          appId: c.id,
          width: c.size.width,
          height: c.size.height,
          nodeShape: appearance(c).shape ? 'polygon' : 'round-rectangle',
          polygon: [-1, -1, 1, -1, 1, 1, -1, 1],
        };
        const pos = { x: c.position.x + c.size.width / 2, y: c.position.y + c.size.height / 2 };
        if (node.empty()) node = this.cy.add({ group: 'nodes', data, position: pos });
        else {
          node.data(data);
          node.position(pos);
        }
        if (isPinned(c)) node.ungrabify();
        else node.grabify();
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
              this.callbacks.open({ kind: 'card', id: c.id });
            }
          });
        }
        el.hidden = this.hiddenNodes.has(c.id);
        node.style('display', el.hidden ? 'none' : 'element');
        el.replaceChildren();
        const overview = overviewElement(c, view, c.size, false);
        el.classList.toggle('paper-note', overview.classList.contains('paper-note'));
        el.classList.toggle('compact-summary', overview.classList.contains('compact-summary'));
        el.append(...overview.children);
        for (const target of el.querySelectorAll('[data-overview-field]')) {
          target.tabIndex = 0;
          target.setAttribute('role', 'button');
          target.setAttribute(
            'aria-label',
            isPinned(c)
              ? t('pinnedReadOnly')
              : t('editOverviewField', {
                  field: t(target.dataset.overviewField),
                  value: target.textContent,
                }),
          );
          target.onpointerdown = (e) => e.stopPropagation();
          target.ondblclick = (e) => e.stopPropagation();
          const edit = (e) => {
            e.stopPropagation();
            if (isPinned(c)) {
              this.callbacks.open({ kind: 'card', id: c.id });
              return;
            }
            if (!this.callbacks.locked())
              this.callbacks.overview(c.id, target, target.dataset.overviewField);
          };
          target.onclick = edit;
          target.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              edit(e);
            }
          };
        }
        const date = el.querySelector('.card-created-date');
        date.tabIndex = isPinned(c) ? -1 : 0;
        date.setAttribute('aria-disabled', String(isPinned(c)));
        updateCardMetadata(el, c);
        date.onpointerdown = (e) => e.stopPropagation();
        date.ondblclick = (e) => e.stopPropagation();
        const openDate = () => {
          if (!isPinned(c) && !this.callbacks.locked()) this.callbacks.date(c.id, date);
        };
        date.onclick = openDate;
        date.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            openDate();
          }
        };
        const pin = el.querySelector('.card-pin');
        pin.disabled = false;
        for (const event of ['pointerdown', 'dblclick'])
          pin.addEventListener(event, (e) => e.stopPropagation());
        pin.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
        });
        pin.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!this.callbacks.locked()) {
            const focused = document.activeElement === pin;
            this.callbacks.pin(c.id);
            if (focused)
              this.cards.get(c.id)?.querySelector('.card-pin')?.focus({ preventScroll: true });
          }
        });
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
        const kicker = el.querySelector('.card-kicker');
        if (kicker) kicker.append(open);
        else el.append(open);
        const connector = document.createElement('button');
        connector.className = 'connector';
        connector.disabled = isPinned(c);
        connector.title = t('dragConnector');
        connector.setAttribute('aria-label', t('dragConnector'));
        connector.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          this.connectorStart(e, c.id);
        });
        const config = nodeStyle(c),
          simple = view === 'mind' || config.kind !== 'card';
        el.classList.toggle('simple-node', simple);
        el.classList.toggle('image-only', config.kind === 'image');
        el.classList.toggle(
          'root-node',
          view === 'mind' && project.extensions?.[MIND]?.rootId === c.id,
        );
        el.classList.toggle('detached-node', view === 'mind' && !info.get(c.id)?.connected);
        el.dataset.nodeKind = config.kind;
        el.style.setProperty(
          '--branch-color',
          view === 'mind' ? info.get(c.id)?.color || '#347d68' : c.style.borderColor,
        );
        if (view === 'mind') {
          const marker = document.createElement('span');
          marker.className = 'node-hierarchy-marker';
          marker.dataset.i18n =
            project.extensions?.[MIND]?.rootId === c.id
              ? 'rootNode'
              : info.get(c.id)?.connected
                ? 'branchNode'
                : 'detachedNode';
          marker.textContent = t(marker.dataset.i18n);
          el.append(marker);
        }
        const children = visible.children.get(c.id) || [];
        if (view === 'mind' && children.length) {
          const collapsed = options.collapsed?.has(c.id),
            button = document.createElement('button');
          button.type = 'button';
          button.className = 'branch-toggle';
          button.dataset.count = collapsed ? visible.counts.get(c.id) || 0 : 0;
          button.dataset.expanded = String(!collapsed);
          button.textContent = collapsed ? '+' + button.dataset.count : '−';
          button.setAttribute('aria-expanded', String(!collapsed));
          button.setAttribute(
            'aria-label',
            t(collapsed ? 'expandBranchCount' : 'collapseBranch', {
              count: button.dataset.count,
              title: c.title,
            }),
          );
          button.title = button.getAttribute('aria-label');
          button.disabled = Boolean(options.positions);
          for (const name of ['pointerdown', 'dblclick', 'keydown'])
            button.addEventListener(name, (e) => e.stopPropagation());
          button.onclick = (e) => {
            e.stopPropagation();
            this.callbacks.collapse?.(c.id);
          };
          el.append(button);
        }
        el.append(connector);
        applyAppearance(el, c);
        el.style.width = c.size.width + 'px';
        el.style.height = c.size.height + 'px';
        el.style.left = c.position.x + 'px';
        el.style.top = c.position.y + 'px';
        const points = applyShape(el, c, c.size);
        if (points)
          node.data(
            'polygon',
            points.flatMap((p) => [(p.x / c.size.width) * 2 - 1, (p.y / c.size.height) * 2 - 1]),
          );
        installResize(this, el, c, c.size);
        el.classList.toggle('selected', this.selectedCards.has(c.id));
        el.setAttribute('aria-label', c.title);
        el.setAttribute('aria-pressed', String(this.selectedCards.has(c.id)));
      }
      for (const [id, el] of this.cards)
        if (!index.cards.has(id)) {
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
          color:
            view === 'mind'
              ? r.extensions?.[MIND]?.color || info.get(r.target)?.color || r.style.color
              : r.style.color,
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
        edge.style(
          'display',
          this.hiddenNodes.has(r.source) || this.hiddenNodes.has(r.target) ? 'none' : 'element',
        );
        edge.toggleClass('mind-edge', view === 'mind');
        edge.toggleClass('reference-edge', view === 'mind' && relationKind(r) === 'reference');
        for (const route of ['straight', 'orthogonal', 'zigzag'])
          edge.toggleClass('route-' + route, edgeRoute(r) === route);
        edge.toggleClass('selected', selection?.kind === 'relation' && selection.id === r.id);
      }
    });
    this.lastLocale = getLocale();
    this.paintedSelection = new Set(this.selectedCards);
    this.groupFrames.sync(project, this.hiddenNodes);
    this.view();
  }
  paintSelection(ids) {
    for (const id of new Set([...(this.paintedSelection || []), ...ids])) {
      if (Boolean(this.paintedSelection?.has(id)) === ids.has(id)) continue;
      const el = this.cards.get(id);
      el?.classList.toggle('selected', ids.has(id));
      el?.setAttribute('aria-pressed', String(ids.has(id)));
    }
    this.paintedSelection = new Set(ids);
  }
  deferEdges() {
    if (this.cy.edges().length < 1000) return;
    if (!this.edgeTimer) this.cy.edges().addClass('viewport-moving');
    clearTimeout(this.edgeTimer);
    this.edgeTimer = setTimeout(() => {
      this.edgeTimer = null;
      this.cy.edges().removeClass('viewport-moving');
    }, 160);
  }
  view() {
    const p = this.cy.pan(),
      z = this.cy.zoom();
    this.layer.style.transform = 'translate(' + p.x + 'px,' + p.y + 'px) scale(' + z + ')';
    this.groupFrames?.paint();
    // Keep the full graph model; skip rasterizing offscreen DOM cards in large maps.
    const large = this.cards.size >= 200;
    const width = this.region.clientWidth,
      height = this.region.clientHeight;
    for (const node of this.cy.nodes()) {
      const el = this.cards.get(node.data('appId'));
      if (!el) continue;
      const pos = node.position();
      const halfWidth = (node.data('width') * z) / 2,
        halfHeight = (node.data('height') * z) / 2;
      const x = pos.x * z + p.x,
        y = pos.y * z + p.y;
      const outside =
        x + halfWidth < -120 ||
        y + halfHeight < -120 ||
        x - halfWidth > width + 120 ||
        y - halfHeight > height + 120;
      const visible = !large || !outside || el.contains(document.activeElement);
      const value = visible ? '' : 'hidden';
      if (el.style.visibility !== value) el.style.visibility = value;
    }
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
    const visible = this.cy.elements().filter((e) => e.style('display') !== 'none');
    const frames = this.groupFrames.bounds();
    if (frames.length && visible.nodes().length) {
      const b = visible.boundingBox();
      const left = Math.min(b.x1, ...frames.map((f) => f.x)),
        top = Math.min(b.y1, ...frames.map((f) => f.y));
      const right = Math.max(b.x2, ...frames.map((f) => f.x + f.width)),
        bottom = Math.max(b.y2, ...frames.map((f) => f.y + f.height));
      const zoom = Math.min(
        4,
        Math.max(
          0.1,
          Math.min(
            (this.region.clientWidth - 130) / (right - left),
            (this.region.clientHeight - 130) / (bottom - top),
          ),
        ),
      );
      this.cy.viewport({
        zoom,
        pan: {
          x: this.region.clientWidth / 2 - ((left + right) * zoom) / 2,
          y: this.region.clientHeight / 2 - ((top + bottom) * zoom) / 2,
        },
      });
      this.view();
      return;
    }
    if (visible.nodes().length) this.cy.fit(visible, 65);
    else this.cy.viewport({ zoom: 1, pan: { x: 0, y: 0 } });
    this.view();
  }
  focus(id) {
    const n = this.cy.getElementById(cid(id));
    if (!n.empty()) {
      const zoom = Math.min(
        1.1,
        Math.max(
          0.3,
          Math.min(
            (this.region.clientWidth - 100) / n.data('width'),
            (this.region.clientHeight - 140) / n.data('height'),
          ),
        ),
      );
      const center = n.position();
      this.cy.viewport({
        zoom,
        pan: {
          x: this.region.clientWidth / 2 - center.x * zoom,
          y: this.region.clientHeight / 2 - center.y * zoom,
        },
      });
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
    if (
      e.target.closest(
        '.connector, .card-open, .branch-toggle, .resize-handle, .card-pin, .card-created-date, [data-overview-field]',
      ) ||
      this.space ||
      e.button !== 0
    )
      return;
    if (this.callbacks.locked()) {
      this.callbacks.select({ kind: 'card', id });
      return;
    }
    if (!startGroupDrag(this, e, id)) this.callbacks.select({ kind: 'card', id });
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
