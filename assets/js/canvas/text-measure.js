import { overviewElement } from './overview.js';
import { fitTextSize } from '../graph/fit-text.js';
import { appearance } from '../detail/appearance.js';
import { nodeStyle } from '../graph/mind-map.js';
export function measureOverview(card, preview, view) {
  preview ||= overviewElement(card, view);
  const a = appearance(card),
    clone = preview.cloneNode(true);
  clone.classList.add('overview-measure');
  clone.classList.remove('shaped-node');
  const content = clone.querySelector('.shape-content');
  if (content) {
    clone.replaceChildren(...content.children);
  }
  for (const c of clone.querySelectorAll('svg,button,.node-hierarchy-marker,.card-status-strip'))
    c.remove();
  clone.style.cssText =
    preview.style.cssText +
    ';position:fixed;left:-10000px;top:0;height:auto;padding:0;border:0;visibility:hidden;pointer-events:none';
  document.body.append(clone);
  const cache = new Map();
  try {
    return fitTextSize(
      a.shape,
      (width) => {
        if (cache.has(width)) return cache.get(width);
        clone.style.width = width + 'px';
        const result = {
          width: clone.scrollWidth,
          height: clone.scrollHeight + (clone.classList.contains('paper-note') ? 24 : 0),
        };
        cache.set(width, result);
        return result;
      },
      { imageOnly: nodeStyle(card).kind === 'image', radius: a.radius },
    );
  } finally {
    clone.remove();
  }
}
