import { textFields, textStyle, fontFamilies } from '../graph/card-typography.js';
import { cardMetadata } from '../graph/card-metadata.js';
import { commentCount } from '../graph/card-comments.js';
import { effectiveStatus } from '../graph/card-status.js';
import { nodeStyle } from '../graph/mind-map.js';
import { attachmentDataURL, IMAGE_NAMESPACE } from '../detail/attachments.js';
import { applyAppearance, appearance } from '../detail/appearance.js';
import { applyShape } from './shape-view.js';
import { t, getLocale, statusLabel } from '../i18n/index.js';
const dateFormats = new Map();
export const compactOverview = (card, size) =>
  nodeStyle(card).kind === 'text' && Boolean(card.summary) && size.height < 120;
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
  el.dataset.nodeKind = config.kind;
  el.classList.toggle('mind-node', view === 'mind');
  el.classList.toggle('simple-node', simple);
  el.classList.toggle('image-only', config.kind === 'image');
  el.classList.toggle('compact-summary', compactOverview(card, size));
  const shape = appearance(card).shape;
  el.classList.toggle(
    'paper-note',
    view !== 'mind' && (['rectangle', 'rounded', 'square'].includes(shape) || !shape),
  );
  const title = document.createElement('h3');
  title.textContent = card.title;
  title.title = card.title;
  const summary = document.createElement('p');
  summary.className = 'card-summary';
  summary.textContent = card.summary;
  summary.title = card.summary;
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
    if (!['image', 'image-text'].includes(config.kind)) el.append(title);
    if (card.summary && config.kind !== 'card') el.append(summary);
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
    el.append(title, summary, kicker, meta);
  }
  applyTypography(el, card);
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
  const status = document.createElement('button');
  status.type = 'button';
  status.className = 'card-status-chip';
  status.setAttribute('aria-haspopup', 'menu');
  const statusText = document.createElement('span');
  statusText.className = 'card-status-text';
  status.append(statusText);
  const comments = document.createElement('span');
  comments.className = 'card-comment-count';
  comments.setAttribute('role', 'img');
  comments.hidden = true;
  const color = document.createElement('button');
  color.type = 'button';
  color.className = 'card-color-button';
  color.setAttribute('aria-haspopup', 'menu');
  strip.append(date, status, comments, color, pin);
  el.append(strip);
  updateCardMetadata(el, card);
  applyAppearance(el, card);
  if (
    view === 'mind' &&
    config.kind === 'card' &&
    !shape &&
    card.extensions?.['card-atlas:appearance']?.radius === undefined
  )
    el.style.borderRadius = '20px';
  el.style.width = size.width + 'px';
  el.style.height = size.height + 'px';
  if (renderShape) applyShape(el, card, size);
  return el;
}

export function updateCardMetadata(el, card) {
  const meta = cardMetadata(card),
    date = el.querySelector('.card-created-date'),
    status = el.querySelector('.card-status-chip'),
    comments = el.querySelector('.card-comment-count'),
    color = el.querySelector('.card-color-button'),
    pin = el.querySelector('.card-pin');
  el.classList.toggle('pinned-card', Boolean(meta.pinned));
  if (meta.pinned) el.setAttribute('aria-description', t('pinnedReadOnly'));
  else el.removeAttribute('aria-description');
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
  if (status) {
    const value = effectiveStatus(card),
      label = statusLabel(value);
    el.dataset.cardStatus = value;
    status.querySelector('.card-status-text').textContent = label;
    status.title = meta.pinned ? t('statusPinnedHint') : t('statusChangeFor', { status: label });
    status.setAttribute('aria-label', status.title);
    status.setAttribute('aria-disabled', String(Boolean(meta.pinned)));
  }
  if (color) {
    color.title = t(meta.pinned ? 'quickColorPinnedHint' : 'quickColor');
    color.setAttribute('aria-label', color.title);
    color.setAttribute('aria-disabled', String(Boolean(meta.pinned)));
  }
  if (comments) {
    const count = commentCount(card);
    comments.hidden = count === 0;
    comments.textContent = String(count);
    comments.title = count === 1 ? t('commentCountOne') : t('commentCount', { count });
    comments.setAttribute('aria-label', comments.title);
  }
  if (pin) {
    pin.setAttribute('aria-pressed', String(Boolean(meta.pinned)));
    pin.title = t(meta.pinned ? 'unpinCard' : 'pinCard');
    pin.setAttribute('aria-label', pin.title);
  }
}

function applyTypography(el, card) {
  for (const field of textFields) {
    const target = el.querySelector(
      { title: 'h3', summary: '.card-summary', type: '.type-badge' }[field],
    );
    if (!target) continue;
    target.dataset.overviewField = field;
    const style = textStyle(card, field);
    if (style.fontSize) {
      if (field === 'type') target.style.lineHeight = '1.4';
      target.style.fontSize = style.fontSize + 'px';
      if (field === 'summary') target.style.maxHeight = style.fontSize * 1.4 * 3 + 'px';
    }
    if (style.color) target.style.color = style.color;
    if (style.fontFamily) target.style.fontFamily = fontFamilies[style.fontFamily];
  }
}
