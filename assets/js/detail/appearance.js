import { shapes } from '../graph/shape-registry.js';
export const APPEARANCE = 'card-atlas:appearance';
export const appearanceDefaults = {
  radius: 10,
  borderWidth: 1,
  titleFontSize: 14.5,
  align: 'left',
  shadow: 'soft',
  backgroundTransparent: false,
  borderTransparent: false,
  sizeMode: 'manual',
};
export function appearance(card) {
  return { ...appearanceDefaults, ...card.extensions?.[APPEARANCE] };
}
export function appearanceIssues(card, path) {
  const value = card.extensions?.[APPEARANCE];
  if (value === undefined) return [];
  const bounds = { radius: [0, 100], borderWidth: [0, 8], titleFontSize: [12, 72] };
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return [{ path, code: 'appearance' }];
  const invalid = Object.entries(value).some(([key, v]) =>
    bounds[key]
      ? typeof v !== 'number' || !Number.isFinite(v) || v < bounds[key][0] || v > bounds[key][1]
      : ['backgroundTransparent', 'borderTransparent'].includes(key)
        ? typeof v !== 'boolean'
        : key === 'shape'
          ? !Object.hasOwn(shapes, v)
          : key === 'sizeMode'
            ? !['manual', 'fit'].includes(v)
            : key === 'align'
              ? !['left', 'center', 'right'].includes(v)
              : key === 'shadow'
                ? !['none', 'soft'].includes(v)
                : true,
  );
  return invalid ? [{ path, code: 'appearance' }] : [];
}
export function applyAppearance(el, card) {
  const a = appearance(card);
  el.style.setProperty('--card-background', card.style.backgroundColor);
  el.style.setProperty('--card-ink', card.style.textColor);
  el.style.setProperty('--card-border', card.style.borderColor);
  el.style.borderRadius = a.radius + 'px';
  el.style.borderWidth = a.borderWidth + 'px';
  el.style.setProperty('--title-font-size', a.titleFontSize + 'px');
  el.style.textAlign = a.align;
  el.dataset.sizeMode = a.sizeMode;
  el.classList.toggle('no-card-shadow', a.shadow === 'none');
  el.classList.toggle('transparent-background', a.backgroundTransparent);
  el.classList.toggle('transparent-border', a.borderTransparent);
}
