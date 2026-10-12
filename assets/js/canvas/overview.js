import { nodeStyle } from '../graph/mind-map.js';
import { attachmentDataURL, IMAGE_NAMESPACE } from '../detail/attachments.js';
import { applyAppearance } from '../detail/appearance.js';
import { applyShape } from './shape-view.js';
import { t } from '../i18n/index.js';
export function overviewElement(card, view, size = card.size, renderShape = true) {
  const el = document.createElement('article');
  el.className = 'graph-card';
  const config = nodeStyle(card),
    simple = view === 'mind' || config.kind !== 'card';
  el.classList.toggle('simple-node', simple);
  el.classList.toggle('image-only', config.kind === 'image');
  const title = document.createElement('h3');
  title.textContent = card.title;
  title.title = card.title;
  if (simple) {
    if (['image', 'image-text'].includes(config.kind)) {
      const frame = document.createElement('div');
      frame.className = 'node-image-frame';
      const image = document.createElement('img');
      image.alt = config.imageAlt || card.title;
      image.draggable = false;
      image.style.objectFit = config.imageFit;
      const status = document.createElement('span');
      status.className = 'node-image-status';
      status.textContent = t('imageLoading');
      image.onload = () => {
        status.hidden = true;
      };
      image.onerror = () => {
        status.hidden = false;
        status.textContent = t('imageFailed');
      };
      frame.append(image, status);
      el.append(frame);
      image.src =
        attachmentDataURL(card.extensions?.[IMAGE_NAMESPACE]?.[config.coverImageId]) || '';
    }
    if (config.kind !== 'image') el.append(title);
  } else {
    const kicker = document.createElement('div');
    kicker.className = 'card-kicker';
    if (card.type) {
      const badge = document.createElement('span');
      badge.className = 'card-badge type-badge';
      badge.textContent = card.type;
      badge.title = card.type;
      kicker.append(badge);
    }
    const summary = document.createElement('p');
    summary.className = 'card-summary';
    summary.textContent = card.summary;
    const meta = document.createElement('div');
    meta.className = 'card-meta';
    const tags = [...new Set(card.tags)].filter((tag) => tag !== card.type);
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
    el.append(kicker, title, summary, meta);
  }
  applyAppearance(el, card);
  el.style.width = size.width + 'px';
  el.style.height = size.height + 'px';
  if (renderShape) applyShape(el, card, size);
  return el;
}
