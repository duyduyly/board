import { t } from '../i18n/index.js';
const icons = {
  blockParagraph: '¶', blockHeading: 'H', blockList: '☷', blockOrderedList: '≡',
  blockQuote: '❝', blockDivider: '―', blockContainer: '▣', blockRow: '▤',
  blockColumn: '▥', blockColumns: '▦', blockCard: '▧', blockAlert: '△',
  blockBadge: '◆', blockTable: '▦', blockCode: '</>', blockButton: '▱',
  blockUndo: '↶', blockRedo: '↷', insertImage: '▧', htmlImportTitle: '⇥',
  editorVisual: '✎', editorHTML: '</>',
  propertiesReset: '↺', imageReplace: '⇄', tableAddRow: '⊞', tableDeleteRow: '⊟', tableAddColumn: '⊕', tableDeleteColumn: '⊖', tableMergeRight: '⊡', blockLinkApply: '✓', htmlImportReview: '⌕',
  htmlImportAccept: '✓', cancel: '×',
  cmFind: '⌕', htmlFormat: '≋',
};
export function labelIcon(button, key) {
  button.textContent = icons[key];
  button.title = t(key);
  button.setAttribute('aria-label', t(key));
}
