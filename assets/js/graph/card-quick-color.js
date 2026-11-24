import { nodeStyle } from './mind-map.js';

/** Pastel paper colours already used by the bundled examples; the yellow one is the new-note default. */
export const QUICK_BACKGROUNDS = /** @type {const} */ ([
  { id: 'sage', value: '#E3EFE8' },
  { id: 'blue', value: '#E8F0FB' },
  { id: 'purple', value: '#F1EAFA' },
  { id: 'pink', value: '#F4E4EF' },
  { id: 'peach', value: '#FFF1DF' },
  { id: 'teal', value: '#E3F1F2' },
]);
/** Id of the "Default" swatch: the background a new node of that kind starts with. */
export const DEFAULT_BACKGROUND_ID = 'default';
const NOTE_BACKGROUND = '#FFF2B0';
const PLAIN_BACKGROUND = '#FFFFFF';

/** @param {any} card @returns {string} */
export const defaultBackground = (card) =>
  nodeStyle(card).kind === 'card' ? NOTE_BACKGROUND : PLAIN_BACKGROUND;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** A swatch id, or a #RRGGBB value from the custom colour picker. @param {string} id @param {any} card @returns {string | null} */
export function quickBackgroundValue(id, card) {
  if (HEX_COLOR.test(id)) return id.toUpperCase();
  if (id === DEFAULT_BACKGROUND_ID) return defaultBackground(card);
  return QUICK_BACKGROUNDS.find((c) => c.id === id)?.value ?? null;
}

/**
 * Swatch id matching the card's background, or null for a custom colour (nothing is marked then).
 * @param {any} card @returns {string | null}
 */
export function currentQuickBackground(card) {
  const value = String(card.style.backgroundColor).toUpperCase();
  if (value === defaultBackground(card).toUpperCase()) return DEFAULT_BACKGROUND_ID;
  return QUICK_BACKGROUNDS.find((c) => c.value.toUpperCase() === value)?.id ?? null;
}

/**
 * Sets only style.backgroundColor; call inside a store commit. Returns false when unchanged.
 * @param {any} card @param {string} id @returns {boolean}
 */
export function setQuickBackground(card, id) {
  const value = quickBackgroundValue(id, card);
  if (!value) throw new Error('quickColorInvalid');
  if (card.style.backgroundColor.toUpperCase() === value) return false;
  card.style.backgroundColor = value;
  return true;
}
