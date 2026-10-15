import { setGeometry } from './mind-map.js';
export const TYPOGRAPHY = 'card-atlas:typography';
export const textFields = ['title', 'summary', 'type'];
export const fontFamilies = {
  system: "'Segoe UI', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "Consolas, 'Courier New', monospace",
};
export function textStyle(card, field) {
  return card.extensions?.[TYPOGRAPHY]?.[field] || {};
}
export function setOverview(card, values, styles) {
  for (const field of textFields) card[field] = values[field];
  if (Array.isArray(values.tags)) card.tags = [...values.tags];
  else if (typeof values.tags === 'string')
    card.tags = values.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  const value = Object.fromEntries(
    textFields.filter((f) => Object.keys(styles[f]).length).map((f) => [f, { ...styles[f] }]),
  );
  if (Object.keys(value).length) {
    card.extensions ||= {};
    card.extensions[TYPOGRAPHY] = value;
  } else if (card.extensions) {
    delete card.extensions[TYPOGRAPHY];
    if (!Object.keys(card.extensions).length) delete card.extensions;
  }
}

export function uniformProfile(card, styles) {
  return Object.fromEntries(
    textFields.map((field) => [
      field,
      {
        fontSize:
          field === 'title'
            ? (card.extensions?.['card-atlas:appearance']?.titleFontSize ?? 14.5)
            : field === 'summary'
              ? 11
              : 9,
        color: card.style.textColor,
        fontFamily: 'system',
        ...styles[field],
      },
    ]),
  );
}
export function applyUniformStyles(project, profile, view, measure) {
  for (const card of project.cards) {
    card.extensions ||= {};
    card.extensions[TYPOGRAPHY] = structuredClone(profile);
  }
  for (const card of project.cards) {
    if (card.extensions?.['card-atlas:appearance']?.sizeMode !== 'fit') continue;
    const size = measure(card);
    if (!size) throw new Error('fitOverflow');
    setGeometry(project, card.id, view, 'size', size);
  }
}
