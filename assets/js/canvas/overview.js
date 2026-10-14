import { cardMetadata } from '../graph/card-metadata.js';
import { nodeStyle } from '../graph/mind-map.js';
import { attachmentDataURL, IMAGE_NAMESPACE } from '../detail/attachments.js';
import { applyAppearance, appearance } from '../detail/appearance.js';
import { applyShape } from './shape-view.js';
import { t, getLocale } from '../i18n/index.js';
const dateFormats = new Map();
function dateFormat() {
  const locale = getLocale();
  if (!dateFormats.has(locale))
    dateFormats.set(
      locale,
      new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    );
  return dateFormats.get(locale);
}
export function overviewElement(card, view, size = card.size, renderShape = true) {
  const el = document.createElement('article');
  el.className = 'graph-card';
  const config = nodeStyle(card),
    simple = view === 'mind' || config.kind !== 'card';
  el.classList.toggle('simple-node', simple);
  el.classList.toggle('image-only', config.kind === 'image');
  const shape = appearance(card).shape;
  el.classList.toggle('paper-note', ['rectangle', 'rounded', 'square'].includes(shape) || !shape);
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
  const strip = document.createElement('div');
  strip.className = 'card-status-strip';
  const date = document.createElement('time');
  date.className = 'card-created-date';
  date.setAttribute('role', 'button');
  date.setAttribute('aria-disabled', 'true');
  date.tabIndex = -1;
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = 'card-pin';
  pin.disabled = true;
  strip.append(date, pin);
  el.append(strip);
  updateCardMetadata(el, card);
  applyAppearance(el, card);
  el.style.width = size.width + 'px';
  el.style.height = size.height + 'px';
  if (renderShape) applyShape(el, card, size);
  return el;
}

export function updateCardMetadata(el, card) {
  const meta = cardMetadata(card),
    date = el.querySelector('.card-created-date'),
    pin = el.querySelector('.card-pin');
  el.classList.toggle('pinned-card', Boolean(meta.pinned));
  if (date) {
    if (meta.createdDate) {
      const [year, month, day] = meta.createdDate.split('-');
      date.dateTime = meta.createdDate;
      date.textContent = day + '/' + month + '/' + year;
      date.title =
        t('cardDate') +
        ': ' +
        meta.createdDate +
        (meta.createdAt ? ' · ' + t('originalCreatedAt') + ': ' + meta.createdAt : '');
    } else if (meta.createdAt) {
      date.dateTime = meta.createdAt;
      date.textContent = dateFormat().format(new Date(meta.createdAt));
      date.title = t('createdAt') + ': ' + meta.createdAt;
    } else {
      date.removeAttribute('datetime');
      date.textContent = t('creationUnknown');
      date.title = t('creationUnknown');
    }
  }
  if (date)
    date.setAttribute(
      'aria-label',
      date.getAttribute('aria-disabled') === 'false'
        ? t('editCardDate', { date: date.textContent })
        : date.title,
    );
  if (pin) {
    pin.setAttribute('aria-pressed', String(Boolean(meta.pinned)));
    pin.title = t(meta.pinned ? 'unpinCard' : 'pinCard');
    pin.setAttribute('aria-label', pin.title);
  }
}
