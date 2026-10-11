/** V1 prevents diagram source from configuring renderers or fetching resources. */
export function isSafeDiagramSource(source) {
  return !/%%\{|^\s*---|\b(?:https?|data|javascript|file):|\b(?:img|image)\s*:|(?:^|[;\n])\s*(?:style|classDef|click)\b/i.test(
    source,
  );
}
