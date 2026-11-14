import { t } from '../i18n/index.js';
const icons = {
  blockParagraph: '¶', blockHeading: 'H', blockList: '☷', blockOrderedList: '≡',
  blockQuote: '❝', blockDivider: '―', blockContainer: '▣', blockRow: '▤',
  blockColumn: '▥', blockColumns: '◫', blockCard: '▭', blockAlert: '△',
  blockBadge: '◆', blockTable: '▦', blockCode: '</>', blockButton: '▱',
  blockUndo: '↶', blockRedo: '↷', insertImage: '▧', htmlImportTitle: '⇥',
  editorVisual: '✎', editorHTML: '</>',
  propertiesReset: '↺', imageReplace: '⇄', tableAddRow: '⊞', tableDeleteRow: '⊟', tableAddColumn: '⊕', tableDeleteColumn: '⊖', tableMergeRight: '⊡', blockLinkApply: '✓', htmlImportReview: '⌕',
  htmlImportAccept: '✓', cancel: '×',
  cmFind: '⌕', htmlFormat: '≋',
  aiPromptCopy: '✦', htmlSamplesTitle: '?', elementLibrary: '❖',
};
// The most used actions show a short text label beside the icon; the rest keep a tooltip only.
const labels = {
  blockParagraph: 'blockParagraph', blockHeading: 'blockHeading', blockList: 'blockList',
  blockTable: 'blockTable', insertImage: 'insertImageShort',
  htmlImportTitle: 'htmlImportTitle', elementLibrary: 'elementLibraryShort',
};
export function labelIcon(button, key) {
  if (labels[key]) {
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = icons[key];
    const label = document.createElement('span');
    label.className = 'editor-button-label';
    label.textContent = t(labels[key]);
    button.classList.add('editor-button-labeled');
    button.replaceChildren(icon, label);
  } else button.textContent = icons[key];
  button.title = t(key);
  button.setAttribute('aria-label', t(key));
}
