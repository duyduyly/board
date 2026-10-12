/** @type {Record<string, string>} */
const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** @param {unknown} s @returns {string} */
export const escapeHTML = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => escapes[c] || c);
