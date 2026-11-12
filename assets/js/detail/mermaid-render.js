import DOMPurify from '../../vendor/dompurify-entry.js';
import {
  isSafeDiagramSource,
  MERMAID_SOURCE_LIMIT,
  MERMAID_MAX_DIAGRAMS,
} from '../graph/diagram-policy.js';
import { t } from '../i18n/index.js';

const MERMAID_SELECTOR = 'pre > code.language-mermaid';
const MERMAID_MAX_EDGES = 500;
// A wide diagram scrolls sideways instead of shrinking until its labels are unreadable.
const MERMAID_MIN_SCALE = 0.75;
const SVG_PURIFY_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: ['foreignObject'],
};
// Fallbacks mirror the light tokens of document-content.css when a token cannot be read.
const FALLBACK_TOKENS = { ink: '#343c34', surface: '#fffdf7', soft: '#f0eee3', border: '#b7c0b4' };

let diagramCounter = 0;

/** Reads the --doc-* tokens and body font of the reading frame so diagrams follow its theme. */
function frameTheme(doc) {
  const view = doc.defaultView;
  const root = view.getComputedStyle(doc.documentElement);
  const token = (name) => root.getPropertyValue('--doc-' + name).trim() || FALLBACK_TOKENS[name];
  const ink = token('ink');
  const surface = token('surface');
  const soft = token('soft');
  const border = token('border');
  return {
    darkMode: doc.documentElement.getAttribute('data-bs-theme') === 'dark',
    background: surface,
    mainBkg: soft,
    primaryColor: soft,
    primaryTextColor: ink,
    primaryBorderColor: border,
    secondaryColor: surface,
    tertiaryColor: surface,
    nodeBorder: border,
    clusterBkg: surface,
    clusterBorder: border,
    edgeLabelBackground: surface,
    lineColor: ink,
    textColor: ink,
    fontFamily: view.getComputedStyle(doc.body).fontFamily,
  };
}

/** @returns {'ok'|'blocked'|'tooLarge'} */
function classify(source, index) {
  if (index >= MERMAID_MAX_DIAGRAMS || source.length > MERMAID_SOURCE_LIMIT) return 'tooLarge';
  return isSafeDiagramSource(source) ? 'ok' : 'blocked';
}

function addStatus(doc, pre, key) {
  const status = doc.createElement('p');
  status.className = 'board-mermaid-status';
  status.setAttribute('role', 'status');
  status.textContent = t(key);
  pre.before(status);
}

/** Mermaid leaves temporary measuring nodes in the parent body when a render fails. */
function removeTemporaryNodes(id) {
  document.getElementById('d' + id)?.remove();
  document.getElementById(id)?.remove();
}

/** Sanitizes the SVG string and imports it into the frame document; null when it is unusable. */
function importSvg(doc, svgText) {
  const clean = DOMPurify.sanitize(svgText, SVG_PURIFY_CONFIG);
  const parsed = new window.DOMParser().parseFromString(clean, 'image/svg+xml');
  const svg = parsed.documentElement;
  if (svg.nodeName.toLowerCase() !== 'svg' || parsed.querySelector('parsererror')) return null;
  return doc.importNode(svg, true);
}

function createFigure(doc, pre, svg, onLayout) {
  const figure = doc.createElement('figure');
  figure.className = 'board-mermaid';
  figure.setAttribute('aria-label', t('mermaidDiagram'));
  const toggle = doc.createElement('button');
  toggle.type = 'button';
  toggle.className = 'board-mermaid-source';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.textContent = t('mermaidShowSource');
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.textContent = t(expanded ? 'mermaidHideSource' : 'mermaidShowSource');
    pre.hidden = !expanded;
    onLayout();
  });
  const naturalWidth = svg.viewBox?.baseVal?.width;
  if (naturalWidth) svg.style.minWidth = Math.round(naturalWidth * MERMAID_MIN_SCALE) + 'px';
  pre.id = svg.id + '-source';
  toggle.setAttribute('aria-controls', pre.id);
  figure.append(svg, toggle);
  pre.before(figure);
  pre.hidden = true;
}

/**
 * Renders `pre > code.language-mermaid` blocks of a reading-frame document as sanitized SVG.
 * Drawing happens in the parent page (the frame cannot run scripts); the SVG is imported afterwards.
 * @param {Document} doc reading-frame document
 * @param {{ isCurrent?: () => boolean, onLayout?: () => void }} [options]
 * @returns {Promise<void>}
 */
export async function renderMermaidBlocks(
  doc,
  { isCurrent = () => true, onLayout = () => {} } = {},
) {
  const codes = [...doc.querySelectorAll(MERMAID_SELECTOR)];
  if (!codes.length) return;
  const plan = codes.map((code, index) => ({
    code,
    pre: code.parentElement,
    source: code.textContent,
    verdict: classify(code.textContent, index),
  }));
  let mermaid = null;
  if (plan.some((item) => item.verdict === 'ok')) {
    mermaid = (await import('../../vendor/mermaid/mermaid-entry.js')).default;
    if (!isCurrent()) return;
    // ELK is not bundled, so dagre must be explicit; htmlLabels:false keeps the SVG free of foreignObject.
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      htmlLabels: false,
      layout: 'dagre',
      flowchart: { htmlLabels: false },
      maxTextSize: MERMAID_SOURCE_LIMIT,
      maxEdges: MERMAID_MAX_EDGES,
      theme: 'base',
      themeVariables: frameTheme(doc),
    });
  }
  for (const { code, pre, source, verdict } of plan) {
    if (verdict !== 'ok') {
      addStatus(doc, pre, verdict === 'blocked' ? 'mermaidBlocked' : 'mermaidTooLarge');
      onLayout();
      continue;
    }
    const label = pre.previousElementSibling?.classList.contains('legacy-source-status')
      ? pre.previousElementSibling
      : null;
    const id = 'board-mermaid-' + ++diagramCounter;
    let svg = null;
    try {
      const result = await mermaid.render(id, source);
      if (!isCurrent()) return;
      svg = importSvg(doc, result.svg);
    } catch {
      svg = null;
    } finally {
      removeTemporaryNodes(id);
    }
    if (!isCurrent()) return;
    if (svg) {
      createFigure(doc, pre, svg, onLayout);
      if (label && code.closest('[data-origin="legacy-mermaid"]')) {
        label.textContent = t('legacySourceMermaidRendered') + ' ';
      }
    } else {
      addStatus(doc, pre, 'mermaidError');
    }
    onLayout();
  }
}
