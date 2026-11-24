export const STATUS = 'card-atlas:status';
export const STATUS_VALUES = /** @type {const} */ ([
  'new',
  'in-progress',
  'done',
  'blocked',
  'cancelled',
]);
export const DEFAULT_STATUS = 'new';

/** @typedef {typeof STATUS_VALUES[number]} CardStatusValue */

/** @param {any} card @returns {CardStatusValue | null} */
export const cardStatus = (card) => card?.extensions?.[STATUS]?.value || null;

/**
 * Status shown for a note: a missing key means the default NEW, so no data migration is needed.
 * @param {any} card @returns {CardStatusValue}
 */
export const effectiveStatus = (card) => cardStatus(card) ?? DEFAULT_STATUS;

/**
 * Sets the card status; call only inside a store commit. Choosing the default drops the key
 * (null means the same), keeping the JSON minimal. Returns false when the effective status is
 * unchanged so callers can skip the commit.
 * @param {any} card
 * @param {CardStatusValue | null} value
 * @returns {boolean}
 */
export function setStatus(card, value) {
  if (value !== null && !STATUS_VALUES.includes(value)) throw new Error('statusInvalid');
  const next = value ?? DEFAULT_STATUS;
  if (effectiveStatus(card) === next) return false;
  if (next === DEFAULT_STATUS) {
    delete card.extensions[STATUS];
    if (!Object.keys(card.extensions).length) delete card.extensions;
  } else {
    card.extensions ||= {};
    card.extensions[STATUS] = { value: next };
  }
  return true;
}
