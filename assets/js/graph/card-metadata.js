export const CARD_META = 'card-atlas:metadata';
export const cardMetadata = (card) => card.extensions?.[CARD_META] || {};
export const isPinned = (card) => Boolean(card && cardMetadata(card).pinned);
export function stampCreated(card, now = new Date().toISOString()) {
  card.extensions ||= {};
  card.extensions[CARD_META] = { ...cardMetadata(card), createdAt: now };
  delete card.extensions[CARD_META].createdDate;
  return card;
}
export function togglePinned(card) {
  card.extensions ||= {};
  card.extensions[CARD_META] = { ...cardMetadata(card), pinned: !cardMetadata(card).pinned };
}
export function metadataIssues(card, path) {
  const meta = cardMetadata(card),
    errors = [];
  if (meta.createdAt !== undefined) {
    const date = new Date(meta.createdAt);
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== meta.createdAt)
      errors.push({
        path: path + '.createdAt',
        code: 'format',
        params: { format: 'UTC timestamp' },
      });
  }
  if (meta.createdDate !== undefined) {
    const date = new Date(meta.createdDate + 'T00:00:00.000Z');
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== meta.createdDate ||
      meta.createdDate.startsWith('0000')
    )
      errors.push({
        path: path + '.createdDate',
        code: 'format',
        params: { format: 'calendar date' },
      });
  }
  return errors;
}
export function cardDateValue(card) {
  const meta = cardMetadata(card);
  if (meta.createdDate) return meta.createdDate;
  if (!meta.createdAt) return '';
  const date = new Date(meta.createdAt);
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
export function setCreatedDate(card, value) {
  const meta = { ...cardMetadata(card) };
  if (value) meta.createdDate = value;
  else delete meta.createdDate;
  if (Object.keys(meta).length) {
    card.extensions ||= {};
    card.extensions[CARD_META] = meta;
  } else if (card.extensions) {
    delete card.extensions[CARD_META];
    if (!Object.keys(card.extensions).length) delete card.extensions;
  }
}
