export const MERMAID_SOURCE_LIMIT = 20000;
export const MERMAID_MAX_DIAGRAMS = 20;

/**
 * Diagram source must not configure renderers or fetch resources.
 * @param {string} source
 * @returns {boolean}
 */
export function isSafeDiagramSource(source) {
  return !/%%\{|^\s*---|\b(?:https?|data|javascript|file):|\b(?:img|image)\s*:|(?:^|[;\n])\s*(?:style|classDef|click)\b/i.test(
    source,
  );
}
